import type { Workflow } from "../../workflows/workflow.model.js";

export type NodeExecuitonStatus = | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

// Data passed to a node before execution
export interface NodeExecutionContext {
    executionId: string;
    tenantId: string;
    workflowId: string;

    // Input provided when starting the workflow
    workflowInput: Record<string, unknown>;

    // Outputs produced by previously executed nodes
    previousNodeOutputs: Record<string, unknown>;
}

// Result returned by a node handler
export interface NodeExecutionResult {
    status: 'COMPLETED' | 'FAILED';
    output?: unknown;
    error?: string;
}

// Contract that every node handler must implement
export interface NodeHandler {
    execute(
        node: Workflow['nodes'][number],
        context: NodeExecutionContext
    ): Promise<NodeExecutionResult>
}

export interface WorkflowExecutionResult {
    status: 'COMPLETED' | 'FAILED',
    output: unknown,
    error: string | null,
    nodeExecutions: {
        nodeId: string,
        nodeType: string,
        status: NodeExecuitonStatus,
        input: unknown,
        output: unknown,
        error: string | null,
        startedAt: Date | null,
        completedAt: Date | null
    }[];
}