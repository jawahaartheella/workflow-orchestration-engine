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
    const executions = await ExecutionModel.find({
        tenantId
    }).sort({
        createdAt: -1
    });

    // Auto-heal any completed executions left in RUNNING status
    for (const exec of executions) {
        if (exec.status === 'RUNNING' && exec.nodeExecutions && exec.nodeExecutions.length > 0) {
            const nodes = exec.nodeExecutions;
            const hasFailed = nodes.some(n => n.status === 'FAILED');
            const lastNode = nodes[nodes.length - 1];
            const isTerminal = lastNode?.nodeType === 'end' || lastNode?.nodeType === 'terminal';
            const allDone = nodes.every(n => n.status === 'COMPLETED');

            if (!hasFailed && lastNode && (isTerminal || allDone)) {
                exec.status = 'COMPLETED';
                exec.completedAt = lastNode.completedAt || new Date();
                ExecutionModel.updateOne(
                    { _id: exec._id },
                    {
                        $set: {
                            status: 'COMPLETED',
                            completedAt: exec.completedAt,
                            ...(exec.output ? {} : { output: lastNode.output })
                        }
                    }
                ).catch(() => {});
            }
        }
    }

    return executions;
}

export async function getExecutionById(
    executionId: string,
    tenantId: string
) {
    const exec = await ExecutionModel.findOne({
        _id: executionId,
        tenantId
    });

    if (exec && exec.status === 'RUNNING' && exec.nodeExecutions && exec.nodeExecutions.length > 0) {
        const nodes = exec.nodeExecutions;
        const hasFailed = nodes.some(n => n.status === 'FAILED');
        const lastNode = nodes[nodes.length - 1];
        const isTerminal = lastNode?.nodeType === 'end' || lastNode?.nodeType === 'terminal';
        const allDone = nodes.every(n => n.status === 'COMPLETED');

        if (!hasFailed && lastNode && (isTerminal || allDone)) {
            exec.status = 'COMPLETED';
            exec.completedAt = lastNode.completedAt || new Date();
            ExecutionModel.updateOne(
                { _id: exec._id },
                {
                    $set: {
                        status: 'COMPLETED',
                        completedAt: exec.completedAt,
                        ...(exec.output ? {} : { output: lastNode.output })
                    }
                }
            ).catch(() => {});
        }
    }

    return exec;
}

export async function reconcileStuckExecutions(): Promise<void> {
    try {
        const stuck = await ExecutionModel.find({
            status: { $in: ['RUNNING', 'PENDING'] }
        });

        for (const exec of stuck) {
            const nodes = exec.nodeExecutions || [];
            if (nodes.length > 0) {
                const hasFailed = nodes.some(n => n.status === 'FAILED');
                const lastNode = nodes[nodes.length - 1];
                const isTerminal = lastNode?.nodeType === 'end' || lastNode?.nodeType === 'terminal';
                const allDone = nodes.every(n => n.status === 'COMPLETED');

                if (!hasFailed && lastNode && (isTerminal || allDone)) {
                    await ExecutionModel.updateOne(
                        { _id: exec._id },
                        {
                            $set: {
                                status: 'COMPLETED',
                                completedAt: lastNode.completedAt || new Date(),
                                ...(exec.output ? {} : { output: lastNode.output })
                            }
                        }
                    );
                    console.log(`[Reconciliation] Successfully repaired stuck completed execution: ${exec._id}`);
                }
            }
        }
    } catch (err) {
        console.warn('[Reconciliation] Error scanning stuck executions:', err);
    }
}