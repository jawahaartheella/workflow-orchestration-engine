import type { Workflow } from "../../workflows/workflow.model.js";
import type { NodeExecuitonStatus, NodeExecutionContext, WorkflowExecutionResult } from "./node.types.js";
import { nodeRegistry } from "./node-regestrations.js";

interface ExecuteWorkflowInput {
    executionId: string;
    tenantId: string;
    workflowId: string;
    workflowInput: Record<string, unknown>
}

export async function executeWorkflow(
    workflow: Workflow,
    executionData: ExecuteWorkflowInput
): Promise<WorkflowExecutionResult> {
    const nodeExecutions: WorkflowExecutionResult['nodeExecutions'] = [];
    
    const previousNodeOutputs: Record<string, unknown> = {};

    const nodes = workflow.nodes;
    const edges = workflow.edges;

    try {
        // 1. Find the trigger node
        const triggerNodes = nodes.filter(node => node.type === 'trigger');

        if(triggerNodes.length !== 1) {
            throw new Error('Workflow must contain exactly one trigger node.');
        }

        // 2. Strat at the trigger node
        let currentNode = triggerNodes[0];

        const visitedNodes = new Set<string>();

        while(currentNode) {
            // 3. Prevent Circular Execution
            if(visitedNodes.has(currentNode.id)) {
                throw new Error(`Circular connection detetcted at node: ${currentNode.id}`);
            }

            visitedNodes.add(currentNode.id);

            // 4. Prepare execution context
            const context : NodeExecutionContext = {
                executionId: executionData.executionId,
                tenantId: executionData.tenantId,
                workflowId: executionData.workflowId,
                workflowInput: executionData.workflowInput,
                previousNodeOutputs
            }

            // 5. Find correct handler
            const handler = nodeRegistry.get(currentNode.type);

            const nodeExecution = {
                nodeId: currentNode.id,
                nodeType: currentNode.type,
                status: 'RUNNING' as NodeExecuitonStatus,
                input: executionData.workflowInput,
                output: null as unknown,
                error: null as string | null,
                startedAt: new Date(),
                completedAt: null as Date | null
            }

            nodeExecutions.push(nodeExecution);

            // 6. Execute the node
            const result = await handler.execute(currentNode, context);

            nodeExecution.status = result.status;
            nodeExecution.output = result.output ?? null;
            nodeExecution.error = result.error ?? null;
            nodeExecution.completedAt = new Date();

            if(result.status === 'FAILED') {
                throw new Error( result.error ?? `Node ${currentNode.id} failed`);
            }

            // 7. Store output and subsequent nodes
            previousNodeOutputs[currentNode.id] = result.output;

            // 8. Find the next connected node
            const outgoingEdges = edges.filter(edge => edge.source === currentNode?.id);

            if(outgoingEdges.length > 1) {
                throw new Error(`Multiple outgoing connections from node ${currentNode.id} are not supported yet.`);
            }

            if(outgoingEdges.length === 0) {
                currentNode = undefined as never;
            } else {
                const nextNodeId = outgoingEdges[0]?.target;

                const nextNode = nodes.find(node => node.id === nextNodeId);

                if(!nextNode) {
                    throw new Error(`Next node ${nextNodeId} could not be found.`);
                }

                currentNode = nextNode;
            }
        }

        // 9. Check for disconnected nodes
        if(visitedNodes.size !== nodes.length) {
            throw new Error(`Workflow contains nodes that cannot be reached from the trigger`);
        }

        const lastNodeId = nodeExecutions[nodeExecutions.length - 1]?.nodeId;

        return {
            status: 'COMPLETED',
            output: lastNodeId ? previousNodeOutputs[lastNodeId] : null,
            error: null,
            nodeExecutions
        }
    } catch(error) {
        return {
            status: 'FAILED',
            output: null,
            error: error instanceof Error
                ? error.message
                : 'Workflow execution failed.',
            nodeExecutions
        }
    }
}