import type { NodeExecutionContext, NodeExecutionResult, NodeHandler } from "../node.types.js";
import type { Workflow } from "../../../workflows/workflow.model.js";

export class TriggerNodeHandler implements NodeHandler {
    async execute(
        node: Workflow['nodes'][number], 
        context: NodeExecutionContext
    ): Promise<NodeExecutionResult> {
        return {
            status: 'COMPLETED',
            output: {
                ...context.workflowInput,
                triggeredBy: node.id,
                message: 'Workflow execution started successfully'
            }
        }
    }
}