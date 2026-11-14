import { Types } from "mongoose";
import { WorkflowModel } from "./workflow.model.js";
import type { Workflow } from "./workflow.model.js";
import { validateWorkflowDefinition } from "./workflow.validator.js";

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
