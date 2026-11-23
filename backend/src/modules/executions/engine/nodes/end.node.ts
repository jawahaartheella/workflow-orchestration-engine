import type { Workflow } from "../../../workflows/workflow.model.js";
import type { NodeExecutionContext, NodeExecutionResult, NodeHandler } from "../node.types.js";

interface EndNodeConfig {
    status?: 'COMPLETED' | 'FAILED' | 'CANCELLED';
    emitEvent?: string;
    [key: string]: unknown;
}

export class EndNodeHandler implements NodeHandler {
    async execute(
        node: Workflow['nodes'][number],
        context: NodeExecutionContext
    ): Promise<NodeExecutionResult> {
        const config = (node.data?.config || node.data || {}) as EndNodeConfig;
        const outcomeStatus = config.status || 'COMPLETED';

        return {
            status: outcomeStatus === 'FAILED' ? 'FAILED' : 'COMPLETED',
            output: {
                terminalNodeId: node.id,
                outcomeStatus,
                emitEvent: config.emitEvent || null,
                finalOutputs: context.previousNodeOutputs,
                completedAt: new Date()
            },
            ...(outcomeStatus === 'FAILED' && {
                error: `Workflow explicitly terminated with status: ${outcomeStatus}`
            })
        };
    }
}
