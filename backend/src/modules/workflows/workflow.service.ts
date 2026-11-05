import { Types } from "mongoose";
import { WorkflowModel } from "./workflow.model.js";

interface CreateWorkflowInput {
    name: string,
    description?: string
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
        nodes: [],
        edges: []
    });

    return workflow;
}

export async function getWorkflows(tenantId: string) {
    const workflows = await WorkflowModel.find({
        tenantId
    }).sort({ createdAt: -1 });

    return workflows;
}

export async function getWorkflowById(workflowId: string, tenantId: string) {
    const workflow = await WorkflowModel.findOne({
        _id: workflowId,
        tenantId
    });

    return workflow
}

interface UpdateWorkflowInput {
    name?: string,
    description?: string
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

