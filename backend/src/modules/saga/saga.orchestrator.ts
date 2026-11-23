import { ExecutionModel } from "../executions/execution.model.js";
import { nodeRegistry } from "../executions/engine/node-regestrations.js";
import type { Workflow } from "../workflows/workflow.model.js";
import type { NodeExecutionContext, NodeExecutionResult, CompensationStepResult } from "../executions/engine/node.types.js";

export class SagaOrchestrator {
    /**
     * Executes compensation steps in reverse order (LIFO) for an execution.
     * Persists each compensation step state in MongoDB.
     */
    static async executeCompensations(
        executionId: string,
        workflow: Workflow,
        context: NodeExecutionContext
    ): Promise<{
        sagaStatus: 'COMPENSATED' | 'COMPENSATION_FAILED';
        compensationResults: CompensationStepResult[];
    }> {
        // 1. Fetch current execution from MongoDB to get persisted compensation steps
        const execution = await ExecutionModel.findById(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found for compensation`);
        }

        execution.status = 'COMPENSATING';
        execution.sagaStatus = 'COMPENSATING';
        await execution.save();

        // 2. Extract pending compensation steps and reverse them (LIFO)
        const steps = execution.compensationSteps.filter(s => s.status === 'PENDING');
        // Reverse array for reverse-order compensation execution
        const reverseSteps = [...steps].reverse();

        let hasCompensationFailure = false;
        const results: CompensationStepResult[] = [];

        for (const step of reverseSteps) {
            const stepIndex = execution.compensationSteps.findIndex(
                s => s.idempotencyKey === step.idempotencyKey
            );

            // Mark step as RUNNING in MongoDB
            if (stepIndex >= 0 && execution.compensationSteps[stepIndex]) {
                execution.compensationSteps[stepIndex].status = 'RUNNING';
                execution.compensationSteps[stepIndex].startedAt = new Date();
                await execution.save();
            }

            // Find matching node and handler
            const targetNode = workflow.nodes.find(n => n.id === step.nodeId);
            const handler = targetNode ? nodeRegistry.get(targetNode.type) : null;

            let result: NodeExecutionResult;
            try {
                if (handler && typeof handler.compensate === 'function' && targetNode) {
                    result = await handler.compensate(targetNode, context, {
                        actionName: step.actionName,
                        ...(step.input as Record<string, unknown>)
                    });
                } else {
                    result = {
                        status: 'COMPLETED',
                        output: { message: `Generic compensation executed for action ${step.actionName}` }
                    };
                }
            } catch (err) {
                result = {
                    status: 'FAILED',
                    error: err instanceof Error ? err.message : 'Compensation step failed'
                };
            }

            const isSuccess = result.status === 'COMPLETED';
            if (!isSuccess) {
                hasCompensationFailure = true;
            }

            // Update compensation step in MongoDB
            if (stepIndex >= 0 && execution.compensationSteps[stepIndex]) {
                const updatedStep = execution.compensationSteps[stepIndex];
                updatedStep.status = isSuccess ? 'COMPLETED' : 'FAILED';
                updatedStep.output = result.output ?? null;
                updatedStep.error = result.error ?? null;
                updatedStep.completedAt = new Date();

                // Also append a nodeExecution record so the timeline UI visualizes the rollback
                execution.nodeExecutions.push({
                    nodeId: `${step.nodeId}_compensation`,
                    nodeType: `compensation:${step.actionName}`,
                    status: isSuccess ? 'COMPLETED' : 'FAILED',
                    input: step.input,
                    output: result.output ?? {},
                    error: result.error ?? null,
                    startedAt: updatedStep.startedAt ?? null,
                    completedAt: updatedStep.completedAt ?? null,
                    idempotencyKey: step.idempotencyKey,
                    isCompensation: true,
                    compensatesNodeId: step.nodeId
                });

                await execution.save();

                results.push({
                    nodeId: step.nodeId,
                    actionName: step.actionName,
                    status: updatedStep.status as 'COMPLETED' | 'FAILED',
                    idempotencyKey: step.idempotencyKey,
                    input: step.input,
                    output: updatedStep.output,
                    error: updatedStep.error,
                    startedAt: updatedStep.startedAt ?? null,
                    completedAt: updatedStep.completedAt ?? null
                });
            }
        }

        const finalSagaStatus = hasCompensationFailure ? 'COMPENSATION_FAILED' : 'COMPENSATED';
        execution.status = 'FAILED';
        execution.sagaStatus = finalSagaStatus;
        execution.completedAt = new Date();
        await execution.save();

        return {
            sagaStatus: finalSagaStatus,
            compensationResults: results
        };
    }
}
