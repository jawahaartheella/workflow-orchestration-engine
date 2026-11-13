import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { getExecutionById, getExecutions, startWorkflowExecution } from "./execution.servie.js";

export const startWorkflowExecutionController: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = res.locals.tenantId as string;
        const { input } = req.body ?? {};
        
        if(typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                messgae: "Invalid workflow ID"
            });

            return;
        }

        if(input !== undefined && (input === null || typeof input !== 'object' || Array.isArray(input))) {
            res.status(400).json({
                message: "Execution Input should be an object"
            });

            return;
        }

        const execution = await startWorkflowExecution({
            workflowId: id,
            tenantId,
            input
        });

        res.status(202).json({
            message: 'Workflow execution started successfully',
            data: execution
        });
    } catch(error) {
        if(error instanceof Error) {
            if(error.message === 'Workflow not found.') {
                res.status(404).json({
                    message: error.message
                });

                return;
            }

            if(error.message === 'Only active workflows can be executed.') {
                res.status(400).json({
                    messgae: error.message
                });

                return;
            }
        }

        next(error);
    }
}

export const getExecutionsController: RequestHandler = async (req, res, next) => {
    try {
        const tenantId = res.locals.tenantId as string;

        if(!tenantId) {
            res.status(400).json({
                message: 'Missing Tenant ID'
            });

            return;
        }

        const executions = await getExecutions(tenantId);

        res.status(200).json({
            message: 'Retrived executions successfully!',
            data: executions
        });

    } catch(error) {
        next(error);
    }
}

export const getExecutionByIdController: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = res.locals.tenantId as string;

        if(typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                message: 'Invalid Execution ID.'
            });

            return;
        }

        const execution = await getExecutionById(id, tenantId);

        if(!execution) {
            res.status(404).json({
                message: 'Execution not found.'
            });

            return;
        }

        res.status(200).json({
            message: 'Execution retrieved successfully!',
            data: execution
        });
    } catch(error) {
        next(error);
    }
}