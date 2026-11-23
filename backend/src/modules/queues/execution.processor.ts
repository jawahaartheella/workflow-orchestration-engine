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

    // 5. Execute workflow / Saga through the execution engine
    const result = await executeWorkflow(workflow, {
        executionId: execution._id.toString(),
        tenantId,
        workflowId: workflow._id.toString(),
        workflowInput: input ?? {}
    });

    // 6. Persist final results and status in MongoDB
    const latest = await ExecutionModel.findById(executionId);
    if (latest) {
        latest.status = result.status;
        latest.output = result.output;
        latest.error = result.error;
        latest.isSaga = result.isSaga;
        latest.sagaStatus = result.sagaStatus;
        latest.completedAt = new Date();
        if (result.nodeExecutions && result.nodeExecutions.length > 0) {
            latest.set('nodeExecutions', result.nodeExecutions);
        }
        if (result.compensationSteps && result.compensationSteps.length > 0) {
            latest.set('compensationSteps', result.compensationSteps);
        }
        await latest.save();
    }
}
