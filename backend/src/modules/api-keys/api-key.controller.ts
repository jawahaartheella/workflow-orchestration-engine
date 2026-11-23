import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { createApiKey, getApiKeysForTenant, revokeApiKey } from "./api-key.service.js";

export const getApiKeysController: RequestHandler = async (_req, res, next) => {
    try {
        const tenantId = res.locals.tenantId as string;
        const keys = await getApiKeysForTenant(tenantId);

        res.status(200).json({
            message: "API keys retrieved successfully",
            data: keys
        });
    } catch (error) {
        next(error);
    }
};

export const createApiKeyController: RequestHandler = async (req, res, next) => {
    try {
        const tenantId = res.locals.tenantId as string;
        const { name } = req.body ?? {};

        if (typeof name !== 'string' || !name.trim()) {
            res.status(400).json({
                message: "API key name is required"
            });
            return;
        }

        const result = await createApiKey(new Types.ObjectId(tenantId), name.trim());

        res.status(201).json({
            message: "API key created successfully",
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const revokeApiKeyController: RequestHandler = async (req, res, next) => {
    try {
        const tenantId = res.locals.tenantId as string;
        const { id } = req.params;

        if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                message: "Invalid API key ID"
            });
            return;
        }

        const revoked = await revokeApiKey(id, tenantId);

        if (!revoked) {
            res.status(404).json({
                message: "API key not found"
            });
            return;
        }

        res.status(200).json({
            message: "API key revoked successfully",
            data: revoked
        });
    } catch (error) {
        next(error);
    }
};
