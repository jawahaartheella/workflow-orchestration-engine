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

