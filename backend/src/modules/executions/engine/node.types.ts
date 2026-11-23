import type { Workflow } from "../../workflows/workflow.model.js";

export type NodeExecuitonStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface CompensationDefinition {
    actionName: string;
    payload?: Record<string, unknown>;
}

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
    selectedBranch?: 'true' | 'false' | string;
    compensation?: CompensationDefinition;
}

// Contract that every node handler must implement
export interface NodeHandler {
    execute(
        node: Workflow['nodes'][number],
        context: NodeExecutionContext
    ): Promise<NodeExecutionResult>;
    compensate?(
        node: Workflow['nodes'][number],
        context: NodeExecutionContext,
        compensationInput: unknown
    ): Promise<NodeExecutionResult>;
}

export interface CompensationStepResult {
    nodeId: string;
    actionName: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    idempotencyKey: string;
    input: unknown;
    output: unknown;
    error: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
}

export interface WorkflowExecutionResult {
    status: 'COMPLETED' | 'FAILED' | 'COMPENSATED' | 'COMPENSATION_FAILED';
    isSaga: boolean;
    sagaStatus: 'NONE' | 'IN_PROGRESS' | 'COMPLETED' | 'COMPENSATING' | 'COMPENSATED' | 'COMPENSATION_FAILED';
    output: unknown;
    error: string | null;
    nodeExecutions: {
        nodeId: string;
        nodeType: string;
        status: NodeExecuitonStatus;
        input: unknown;
        output: unknown;
        error: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        idempotencyKey?: string | null;
        isCompensation?: boolean;
        compensatesNodeId?: string | null;
    }[];
    compensationSteps: CompensationStepResult[];
}