import { Types } from "mongoose";
import type { Workflow } from "../../workflows/workflow.model.js";
import type {
    NodeExecuitonStatus,
    NodeExecutionContext,
    WorkflowExecutionResult,
    CompensationStepResult
} from "./node.types.js";
import { nodeRegistry } from "./node-regestrations.js";
import { ExecutionModel } from "../execution.model.js";
import { SagaOrchestrator } from "../../saga/saga.orchestrator.js";

interface ExecuteWorkflowInput {
    executionId: string;
    tenantId: string;
    workflowId: string;
    workflowInput: Record<string, unknown>;
}

export async function executeWorkflow(
    workflow: Workflow,
    executionData: ExecuteWorkflowInput
): Promise<WorkflowExecutionResult> {
    const nodeExecutions: WorkflowExecutionResult['nodeExecutions'] = [];
    const compensationSteps: CompensationStepResult[] = [];
    const previousNodeOutputs: Record<string, unknown> = {};

    const nodes = workflow.nodes ?? [];
    const edges = workflow.edges ?? [];

    let isSaga = false;
    let sagaStatus: WorkflowExecutionResult['sagaStatus'] = 'NONE';

    // 1. Find entry trigger / start node
    const triggerNodes = nodes.filter(node => node.type === 'trigger' || node.type === 'start');

    if (triggerNodes.length === 0) {
        return {
            status: 'FAILED',
            isSaga: false,
            sagaStatus: 'NONE',
            output: null,
            error: 'Workflow contains no trigger or start node.',
            nodeExecutions: [],
            compensationSteps: []
        };
    }

    let currentNode: Workflow['nodes'][number] | undefined = triggerNodes[0];
    const visitedNodes = new Set<string>();

    try {
        while (currentNode) {
            // Cycle detection guard
            if (visitedNodes.has(currentNode.id)) {
                throw new Error(`Circular connection detected at node: ${currentNode.id}`);
            }
            visitedNodes.add(currentNode.id);

            // Prepare node context
            const context: NodeExecutionContext = {
                executionId: executionData.executionId,
                tenantId: executionData.tenantId,
                workflowId: executionData.workflowId,
                workflowInput: executionData.workflowInput,
                previousNodeOutputs
            };

            const handler = nodeRegistry.get(currentNode.type);
            const idempotencyKey = `${executionData.executionId}_${currentNode.id}_${Date.now()}`;

            const nodeExecution = {
                nodeId: currentNode.id,
                nodeType: currentNode.type,
                status: 'RUNNING' as NodeExecuitonStatus,
                input: {
                    ...executionData.workflowInput,
                    ...previousNodeOutputs
                },
                output: null as unknown,
                error: null as string | null,
                startedAt: new Date(),
                completedAt: null as Date | null,
                idempotencyKey,
                isCompensation: false,
                compensatesNodeId: null
            };

            nodeExecutions.push(nodeExecution);

            // Persist step running state to MongoDB if valid ID provided
            if (Types.ObjectId.isValid(executionData.executionId)) {
                await ExecutionModel.updateOne(
                    { _id: executionData.executionId },
                    {
                        $set: { status: 'RUNNING', startedAt: new Date() },
                        $push: { nodeExecutions: nodeExecution }
                    }
                ).catch(() => {});
            }

            // Execute forward step
            const result = await handler.execute(currentNode, context);

            nodeExecution.status = result.status;
            nodeExecution.output = result.output ?? null;
            nodeExecution.error = result.error ?? null;
            nodeExecution.completedAt = new Date();

            // If node defined a compensating action, register it persistently in MongoDB
            if (result.compensation) {
                isSaga = true;
                sagaStatus = 'IN_PROGRESS';

                const compStep: CompensationStepResult = {
                    nodeId: currentNode.id,
                    actionName: result.compensation.actionName,
                    status: 'PENDING',
                    idempotencyKey: `comp_${executionData.executionId}_${currentNode.id}`,
                    input: result.compensation.payload || result.output || {},
                    output: null,
                    error: null,
                    startedAt: null,
                    completedAt: null
                };

                compensationSteps.push(compStep);

                if (Types.ObjectId.isValid(executionData.executionId)) {
                    await ExecutionModel.updateOne(
                        { _id: executionData.executionId },
                        {
                            $set: { isSaga: true, sagaStatus: 'IN_PROGRESS' },
                            $push: { compensationSteps: compStep }
                        }
                    ).catch(() => {});
                }
            }

            // Update step completed in MongoDB
            if (Types.ObjectId.isValid(executionData.executionId)) {
                await ExecutionModel.updateOne(
                    {
                        _id: executionData.executionId,
                        'nodeExecutions.nodeId': currentNode.id
                    },
                    {
                        $set: {
                            'nodeExecutions.$.status': nodeExecution.status,
                            'nodeExecutions.$.output': nodeExecution.output,
                            'nodeExecutions.$.error': nodeExecution.error,
                            'nodeExecutions.$.completedAt': nodeExecution.completedAt
                        }
                    }
                ).catch(() => {});
            }

            // Check for forward failure
            if (result.status === 'FAILED') {
                throw new Error(result.error ?? `Node ${currentNode.id} (${currentNode.type}) failed.`);
            }

            // Store outputs for downstream steps
            previousNodeOutputs[currentNode.id] = result.output;

            // Stop if terminal node
            if (currentNode.type === 'end' || currentNode.type === 'terminal') {
                currentNode = undefined;
                break;
            }

            // Route to next connected node based on branch selection
            const outgoingEdges = edges.filter(edge => edge.source === currentNode?.id);

            if (outgoingEdges.length === 0) {
                currentNode = undefined;
            } else if (result.selectedBranch) {
                // Condition node branching: match sourceHandle (e.g. 'true' or 'false')
                const matchingEdge = outgoingEdges.find(edge => edge.sourceHandle === result.selectedBranch)
                    || outgoingEdges[0];

                const nextNodeId = matchingEdge?.target;
                currentNode = nodes.find(node => node.id === nextNodeId);
            } else {
                // Standard single path
                const nextNodeId = outgoingEdges[0]?.target;
                currentNode = nodes.find(node => node.id === nextNodeId);
            }
        }

        const lastNodeId = nodeExecutions[nodeExecutions.length - 1]?.nodeId;
        const finalOutput = lastNodeId ? previousNodeOutputs[lastNodeId] : null;

        if (isSaga) {
            sagaStatus = 'COMPLETED';
        }

        return {
            status: 'COMPLETED',
            isSaga,
            sagaStatus,
            output: finalOutput,
            error: null,
            nodeExecutions,
            compensationSteps
        };
    } catch (forwardError) {
        const errorMessage = forwardError instanceof Error ? forwardError.message : 'Workflow execution failed.';

        // If this is a Saga with registered compensation steps, execute reverse-order compensation!
        if (isSaga && compensationSteps.length > 0) {
            const context: NodeExecutionContext = {
                executionId: executionData.executionId,
                tenantId: executionData.tenantId,
                workflowId: executionData.workflowId,
                workflowInput: executionData.workflowInput,
                previousNodeOutputs
            };

            let sagaStatus: 'COMPENSATED' | 'COMPENSATION_FAILED' = 'COMPENSATED';
            let finalCompensationSteps: CompensationStepResult[] = [];

            if (Types.ObjectId.isValid(executionData.executionId)) {
                try {
                    const sagaResult = await SagaOrchestrator.executeCompensations(
                        executionData.executionId,
                        workflow,
                        context
                    );
                    sagaStatus = sagaResult.sagaStatus;
                    finalCompensationSteps = sagaResult.compensationResults;
                } catch {
                    // Fall back to direct in-memory compensation execution if DB doc is absent
                }
            }

            if (finalCompensationSteps.length === 0) {
                // Execute reverse-order compensations in-memory (LIFO)
                const reverseCompSteps = [...compensationSteps].reverse();
                let hasFailure = false;
                for (const step of reverseCompSteps) {
                    const targetNode = workflow.nodes.find(n => n.id === step.nodeId);
                    const handler = targetNode ? nodeRegistry.get(targetNode.type) : null;
                    try {
                        if (handler && typeof handler.compensate === 'function' && targetNode) {
                            const compRes = await handler.compensate(targetNode, context, {
                                actionName: step.actionName,
                                ...(step.input as Record<string, unknown>)
                            });
                            step.status = compRes.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
                            step.output = compRes.output;
                            step.error = compRes.error ?? null;
                        } else {
                            step.status = 'COMPLETED';
                        }
                    } catch (cErr) {
                        step.status = 'FAILED';
                        step.error = cErr instanceof Error ? cErr.message : 'Compensation failed';
                        hasFailure = true;
                    }
                    if (step.status === 'FAILED') hasFailure = true;
                    finalCompensationSteps.push(step);

                    nodeExecutions.push({
                        nodeId: `${step.nodeId}_compensation`,
                        nodeType: `compensation:${step.actionName}`,
                        status: step.status as NodeExecuitonStatus,
                        input: step.input,
                        output: step.output,
                        error: step.error,
                        startedAt: new Date(),
                        completedAt: new Date(),
                        idempotencyKey: step.idempotencyKey,
                        isCompensation: true,
                        compensatesNodeId: step.nodeId
                    });
                }
                sagaStatus = hasFailure ? 'COMPENSATION_FAILED' : 'COMPENSATED';
            }

            const latestExec = Types.ObjectId.isValid(executionData.executionId)
                ? await ExecutionModel.findById(executionData.executionId).catch(() => null)
                : null;

            return {
                status: 'FAILED',
                isSaga: true,
                sagaStatus,
                output: null,
                error: `Forward execution failed: ${errorMessage}. Compensations executed with outcome: ${sagaStatus}`,
                nodeExecutions: latestExec ? (latestExec.nodeExecutions as unknown as WorkflowExecutionResult['nodeExecutions']) : nodeExecutions,
                compensationSteps: finalCompensationSteps
            };
        }

        return {
            status: 'FAILED',
            isSaga,
            sagaStatus: isSaga ? 'COMPENSATION_FAILED' : 'NONE',
            output: null,
            error: errorMessage,
            nodeExecutions,
            compensationSteps
        };
    }
}
