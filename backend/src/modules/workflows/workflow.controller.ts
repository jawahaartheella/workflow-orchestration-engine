import type { RequestHandler } from "express";

import { createWorkflow } from "./workflow.service.js";

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