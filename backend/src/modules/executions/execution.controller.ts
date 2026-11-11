import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { startWorkflowExecution } from "./execution.servie.js";

export const startWorkflowExecutionController: RequestHandler = async (
    req,
    res,
    next
) => {
    try {
        const { id } = req.params;
        const tenantId = res.locals.tenantId as string;
        const { input } = req.body ?? {};

        // Validate workflow ID
        if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                message: 'Invalid workflow ID.'
            });
            return;
        }

        // Validate execution input
        if (
            input !== undefined &&
            (input === null || typeof input !== 'object' || Array.isArray(input))
        ) {
            res.status(400).json({
                message: 'Execution input must be an object.'
            });
            return;
        }

        const execution = await startWorkflowExecution({
            workflowId: id,
            tenantId,
            input
        });

        res.status(202).json({
            message: 'Workflow execution started successfully.',
            data: execution
        });

    } catch (error) {
        if (error instanceof Error) {
            if (error.message === 'Workflow not found.') {
                res.status(404).json({
                    message: error.message
                });
                return;
            }

            if (error.message === 'Only active workflows can be executed.') {
                res.status(400).json({
                    message: error.message
                });
                return;
            }
        }

        next(error);
    }
};