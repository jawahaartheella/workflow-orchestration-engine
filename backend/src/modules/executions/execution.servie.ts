import { Types } from "mongoose";
import { WorkflowModel } from "../workflows/workflow.model.js";
import { ExecutionModel } from "./execution.model.js";

interface StartExecutionInput {
    workflowId: string,
    tenantId: string,
    input: Record<string, unknown>
}

export async function startWorkflowExecution(data: StartExecutionInput) {

    // 1. Find the workflow belonging to the authenticated tenant
    const workflow = await WorkflowModel.findOne({
        _id: data.workflowId,
        tenantId: data.tenantId
    });

    // 2. Check whether the workflow exists
    if (!workflow) {
        throw new Error('Workflow not found.');
    }

    // 3. Only active workflows can be executed
    if (workflow.status !== 'ACTIVE') {
        throw new Error('Only active workflows can be executed.');
    }

    // 4. Create a new execution record
    const execution = await ExecutionModel.create({
        workflowId: workflow._id,
        tenantId: data.tenantId,
        status: 'PENDING',
        input: data.input ?? {},
        output: null,
        startedAt: null,
        completedAt: null,
        error: null
    });

    // 5. Return the newly created execution
    return execution;
}