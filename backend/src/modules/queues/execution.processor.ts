import { Types } from "mongoose";
import { ExecutionModel } from "../executions/execution.model.js";
import { WorkflowModel } from "../workflows/workflow.model.js";
import { executeWorkflow } from "../executions/engine/execution.engine.js";

export interface WorkflowJobPayload {
    executionId: string;
    workflowId: string;
    tenantId: string;
    input: Record<string, unknown>;
}

export async function processWorkflowJob(payload: WorkflowJobPayload): Promise<void> {
    const { executionId, workflowId, tenantId, input } = payload;

    // 1. Security & Format Validation: Guard against malformed or injected IDs
    if (!Types.ObjectId.isValid(executionId) || !Types.ObjectId.isValid(tenantId) || !Types.ObjectId.isValid(workflowId)) {
        throw new Error(`Security validation failed: Invalid identifiers provided for Execution ${executionId}, Tenant ${tenantId}`);
    }

    // 2. Security & Ownership Validation: Verify execution belongs to authenticated tenant
    const execution = await ExecutionModel.findOne({
        _id: new Types.ObjectId(executionId),
        tenantId: new Types.ObjectId(tenantId)
    });

    if (!execution) {
        throw new Error(`Security validation failed: Execution ${executionId} not found for Tenant ${tenantId}`);
    }

    // 2. Ownership Validation: Verify workflow belongs to authenticated tenant
    const workflow = await WorkflowModel.findOne({
        _id: new Types.ObjectId(workflowId),
        tenantId: new Types.ObjectId(tenantId)
    });

    if (!workflow) {
        throw new Error(`Security validation failed: Workflow ${workflowId} not found for Tenant ${tenantId}`);
    }

    // 3. Idempotency Check: Prevent duplicate business runs if already completed or terminal
    if (['COMPLETED', 'FAILED', 'COMPENSATED', 'COMPENSATION_FAILED'].includes(execution.status)) {
        console.warn(`Idempotency guard: Execution ${executionId} is already in terminal state ${execution.status}. Skipping.`);
        return;
    }

    // 4. Mark execution as RUNNING in MongoDB
    execution.status = 'RUNNING';
    execution.startedAt = execution.startedAt || new Date();
    await execution.save();

    try {
        // 5. Execute workflow / Saga through the execution engine
        const result = await executeWorkflow(workflow, {
            executionId: execution._id.toString(),
            tenantId,
            workflowId: workflow._id.toString(),
            workflowInput: input ?? {}
        });

        // 6. Persist final results and status atomically in MongoDB
        await ExecutionModel.updateOne(
            { _id: new Types.ObjectId(executionId) },
            {
                $set: {
                    status: result.status,
                    output: result.output,
                    error: result.error,
                    isSaga: result.isSaga,
                    sagaStatus: result.sagaStatus,
                    completedAt: new Date(),
                    ...(result.nodeExecutions && result.nodeExecutions.length > 0 ? { nodeExecutions: result.nodeExecutions } : {}),
                    ...(result.compensationSteps && result.compensationSteps.length > 0 ? { compensationSteps: result.compensationSteps } : {})
                }
            }
        );
    } catch (engineError) {
        const errorMsg = engineError instanceof Error ? engineError.message : 'Execution failed';
        console.error(`Execution processing error for ${executionId}:`, errorMsg);

        await ExecutionModel.updateOne(
            { _id: new Types.ObjectId(executionId) },
            {
                $set: {
                    status: 'FAILED',
                    error: errorMsg,
                    completedAt: new Date()
                }
            }
        ).catch(() => {});

        throw engineError;
    }
}
