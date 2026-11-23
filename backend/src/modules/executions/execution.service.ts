import { WorkflowModel } from "../workflows/workflow.model.js";
import { ExecutionModel } from "./execution.model.js";
import { enqueueWorkflowExecution } from "../queues/execution.queue.js";

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

    // 4. Create a persistent execution record with status PENDING
    const execution = await ExecutionModel.create({
        workflowId: workflow._id,
        tenantId: data.tenantId,
        status: 'PENDING',
        input: data.input ?? {},
        output: null,
        nodeExecutions: [],
        startedAt: null,
        completedAt: null,
        error: null
    });

    // 5. Enqueue job for background asynchronous worker processing
    await enqueueWorkflowExecution({
        executionId: execution._id.toString(),
        workflowId: workflow._id.toString(),
        tenantId: data.tenantId,
        input: data.input ?? {}
    });

    // 6. Return asynchronous response record immediately
    return execution;
}

export async function getExecutions(tenantId: string) {
    return ExecutionModel.find({
        tenantId
    }).sort({
        createdAt: -1
    });
}

export async function getExecutionById(
    executionId: string,
    tenantId: string
) {
    return ExecutionModel.findOne({
        _id: executionId,
        tenantId
    });
}