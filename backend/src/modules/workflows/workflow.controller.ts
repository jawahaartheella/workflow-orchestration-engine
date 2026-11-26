import type { RequestHandler } from "express";
import { Types } from "mongoose";

import { createWorkflow, deleteWorkflow, getWorkflowById, getWorkflows, updateWorkflow, updateWorkflowStatus,WorkflowValidationError } from "./workflow.service.js";

export const createWorkflowController: RequestHandler = async (req, res, next) => {
    try {
        const tenantId = res.locals.tenantId as string;

        const { name, description, nodes, edges } = req.body ?? {};

        if(typeof name !== 'string' || !name.trim()) {
            res.status(400).json({
                message: "Workflow name is required!"
            });
            return;
        }

        if(description !== undefined && typeof description !== 'string') {
            res.status(400).json({
                message: "Description should be string."
            });
            return;
        }

        if(nodes !== undefined && !Array.isArray(nodes)) {
            res.status(400).json({
                message: "Nodes must be an array."
            });
            return;
        }

        if(edges !== undefined && !Array.isArray(edges)) {
            res.status(400).json({
                message: "Edges must be an array."
            });
            return;
        }

        const workflow = await createWorkflow(tenantId, {
            name: name.trim(),
            ...(description !== undefined && { description: description.trim() }),
            ...(nodes !== undefined && { nodes }),
            ...(edges !== undefined && { edges })
        });

        res.status(201).json({
            message: "Workflow created successfully!",
            data: workflow
        });

    } catch (error) {
        next(error);
    }
}

export const getWorkflowsController: RequestHandler = async (_req, res, next) => {
    try {
        const tenantId = res.locals.tenantId as string;

        const workflows = await getWorkflows(tenantId);

        res.status(200).json({
            message: "Workflows retrieved successfully!",
            data: workflows,
            count: workflows.length
        });
    } catch(error) {
        next(error);
    }
}

export const getWorkFlowByIdController: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = res.locals.tenantId as string;

        if(typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                message: "Invalid workflow Id."
            });

            return
        }

        const workflow = await getWorkflowById(id, tenantId);

        if(!workflow) {
            res.status(404).json({
                message: 'Workflow not found.'
            });

            return;
        }

        res.status(200).json({
            message: "Workflow retreived successfully!",
            data: workflow
        });
    } catch(error) {
        next(error);
    }
}

export const updateWorkflowController: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = res.locals.tenantId as string;
        const { 
            name, 
            description,
            nodes,
            edges
        } = req.body ?? {};

        if(typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                message: "Invalid workflow Id."
            });

            return
        }

        if(name === undefined && description === undefined && nodes === undefined && edges === undefined) {
            res.status(400).json({
                message: "Provide at least one field to update."
            });

            return;
        }

        if(name !== undefined && (typeof name !== 'string' || !name.trim())) {
            res.status(400).json({
                message: "Name should be string."
            });
            return;
        }

        if(description !== undefined && typeof description !== 'string') {
            res.status(400).json({
                message: "Description should be string."
            });
            return
        }

        if(nodes !== undefined && !Array.isArray(nodes)) {
            res.status(400).json({
                message: 'Nodes must be an array.'
            });

            return;
        }

        if(edges !== undefined && !Array.isArray(edges)) {
            res.status(400).json({
                message: 'Edges must be an array.'
            });

            return;
        }

        const workflow = await updateWorkflow(id, tenantId, {
            ...(name !== undefined && { name: name.trim() }),
            ...(description !== undefined && { description: description.trim() }),
            ...(nodes !== undefined && { nodes }),
            ...(edges !== undefined && { edges })
        });

        if(!workflow) {
            res.status(404).json({
                message: "Workflow not found."
            });

            return;
        }

        res.status(200).json({
            message: "Workflow updated successfully!",
            data: workflow
        });
    } catch(error) {
        next(error);
    }
}

export const deleteWorkflowController: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = res.locals.tenantId as string;

        if(typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                message: "Invalid workflow ID."
            });

            return;
        }

        const workflow = await deleteWorkflow(id, tenantId);

        if(!workflow) {
            res.status(404).json({
                message: "Workflow not found."
            });

            return;
        }

        res.status(200).json({
            message: "Workflow deleted successfully!",
            data: workflow
        });
    } catch(error) {
        next(error)
    }
}

export const activateWorkfolwController: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = res.locals.tenantId as string;

        if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                message: 'Invalid workflow ID.'
            });
            return;
        }

        const workflow = await updateWorkflowStatus(
            id,
            tenantId,
            'ACTIVE'
        );

        if (!workflow) {
            res.status(404).json({
                message: 'Workflow not found.'
            });
            return;
        }
        
        res.status(200).json({
            message: 'Workflow activated successfully!',
            data: workflow
        });

    } catch (error) {
        if(error instanceof WorkflowValidationError) {
            res.status(400).json({
                message: error.message,
                errors: error.errors
            });
            return;
        }

        next(error);
    }
}

export const deactivateWorkfolwController: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = res.locals.tenantId as string;

        if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                message: 'Invalid workflow ID.'
            });
            return;
        }

        const workflow = await updateWorkflowStatus(
            id,
            tenantId,
            'INACTIVE'
        );

        if (!workflow) {
            res.status(404).json({
                message: 'Workflow not found.'
            });
            return;
        }
        
        res.status(200).json({
            message: 'Workflow deactivated successfully!',
            data: workflow
        });

    } catch (error) {
        next(error);
    }
}

export const getWorkflowTemplatesController: RequestHandler = async (_req, res, next) => {
    try {
        const { WORKFLOW_TEMPLATES } = await import("./workflow.templates.js");
        res.status(200).json({
            message: "Workflow templates retrieved successfully!",
            data: WORKFLOW_TEMPLATES
        });
    } catch (error) {
        next(error);
    }
};

export const getWorkflowTemplateByIdController: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { WORKFLOW_TEMPLATES } = await import("./workflow.templates.js");
        const template = WORKFLOW_TEMPLATES.find(t => t.id === id);

        if (!template) {
            res.status(404).json({
                message: "Workflow template not found."
            });
            return;
        }

        res.status(200).json({
            message: "Workflow template retrieved successfully!",
            data: template
        });
    } catch (error) {
        next(error);
    }
};