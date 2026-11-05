import type { RequestHandler } from "express";
import { Types } from "mongoose";

import { createWorkflow, deleteWorkflow, getWorkflowById, getWorkflows, updateWorkflow } from "./workflow.service.js";

export const createWorkflowController: RequestHandler = async (req, res, next) => {
    try {
        const tenantId = res.locals.tenantId as string;

        const { name, description } = req.body;

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
            return
        }

        const workflow = await createWorkflow(tenantId, {
            name: name.trim(),
            description: description.trim()
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
        const { name, description } = req.body;

        if(typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                message: "Invalid workflow Id."
            });

            return
        }

        if(name === undefined && description === undefined) {
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

        const workflow = await updateWorkflow(id, tenantId, {
            ...(name !== undefined && { name: name.trim() }),
            ...(description !== undefined && {description: description.trim()})
        });

        if(!workflow) {
            res.status(404).json({
                message: "Workflow not found."
            });
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