import { Types } from "mongoose";
import { WorkflowModel } from "./workflow.model.js";
import type { Workflow } from "./workflow.model.js";
import { validateWorkflowDefinition } from "./workflow.validator.js";
import { ExecutionModel } from "../executions/execution.model.js";

interface CreateWorkflowInput {
    name: string,
    description?: string,
    nodes?: Workflow['nodes'],
    edges?: Workflow['edges']
}

export async function createWorkflow(
    tenantId: string,
    input: CreateWorkflowInput
) {
    const workflow = await WorkflowModel.create({
        name: input.name,
        description: input.description ?? '',
        tenantId: new Types.ObjectId(tenantId),
        status: 'DRAFT',
        nodes: input.nodes ?? [],
        edges: input.edges ?? []
    });

    return workflow;
}

export async function getWorkflows(tenantId: string) {
    const workflows = await WorkflowModel.find({
        tenantId
    }).sort({ createdAt: -1 }).lean();

    try {
        const executionStats = await ExecutionModel.aggregate([
            { $match: { tenantId: new Types.ObjectId(tenantId) } },
            {
                $group: {
                    _id: "$workflowId",
                    totalExecutions: { $sum: 1 },
                    completedExecutions: {
                        $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
                    },
                    lastExecutedAt: { $max: "$createdAt" }
                }
            }
        ]);

        const statsMap = new Map<string, { totalExecutions: number; successRate: number; lastExecutedAt: Date | null }>();
        for (const stat of executionStats) {
            if (stat._id) {
                const total = stat.totalExecutions || 0;
                const completed = stat.completedExecutions || 0;
                const rate = total > 0 ? Math.round((completed / total) * 100) : 100;
                statsMap.set(stat._id.toString(), {
                    totalExecutions: total,
                    successRate: rate,
                    lastExecutedAt: stat.lastExecutedAt || null
                });
            }
        }

        return workflows.map(wf => {
            const stats = statsMap.get(wf._id.toString()) || { totalExecutions: 0, successRate: 100, lastExecutedAt: null };
            return {
                ...wf,
                totalExecutions: stats.totalExecutions,
                successRate: stats.successRate,
                lastExecutedAt: stats.lastExecutedAt
            };
        });
    } catch {
        return workflows;
    }
}

export async function getWorkflowById(workflowId: string, tenantId: string) {
    const workflow = await WorkflowModel.findOne({
        _id: workflowId,
        tenantId
    }).lean();

    if (!workflow) return null;

    try {
        const stats = await ExecutionModel.aggregate([
            {
                $match: {
                    workflowId: new Types.ObjectId(workflowId),
                    tenantId: new Types.ObjectId(tenantId)
                }
            },
            {
                $group: {
                    _id: "$workflowId",
                    totalExecutions: { $sum: 1 },
                    completedExecutions: {
                        $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
                    },
                    lastExecutedAt: { $max: "$createdAt" }
                }
            }
        ]);

        const stat = stats[0];
        const total = stat?.totalExecutions || 0;
        const completed = stat?.completedExecutions || 0;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 100;

        return {
            ...workflow,
            totalExecutions: total,
            successRate: rate,
            lastExecutedAt: stat?.lastExecutedAt || null
        };
    } catch {
        return workflow;
    }
}

interface UpdateWorkflowInput {
    name?: string,
    description?: string,
    nodes?: Workflow['nodes'],
    edges?: Workflow['edges']
}

export async function updateWorkflow(
    workflowId: string,
    tenantId: string,
    input: UpdateWorkflowInput
) {
    return WorkflowModel.findOneAndUpdate(
        {
            _id: workflowId,
            tenantId
        },
        {
            $set: input
        },
        {
            new: true,
            runValidators: true
        }
    );
}

export async function deleteWorkflow(
    workflowId: string,
    tenantId: string
) {
    return WorkflowModel.findOneAndDelete({
        _id: workflowId,
        tenantId
    });
}

export class WorkflowValidationError extends Error {
    constructor(public errors: string[]){
        super('Workflow Definition is invalid');
        this.name = "WorkflowValidationError"
    }
}

export async function updateWorkflowStatus(
    workflowId: string,
    tenantId: string,
    status: 'ACTIVE' | 'INACTIVE'
) {
    const workflow = await WorkflowModel.findOne(
        {
            _id: workflowId,
            tenantId
        }
    );

    if(!workflow) {
        return null;
    }

    // Validate only when activating
    if(status === 'ACTIVE') {
        const errors = validateWorkflowDefinition(workflow);

        if(errors.length > 0) {
            throw new WorkflowValidationError(errors);
        }
    }

    workflow.status = status;

    await workflow.save();

    return workflow;
}
