import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { ApiKeyModel } from "../modules/api-keys/api-key.model.js";
import { TenantModel } from "../modules/tenants/tenant.model.js";

export const apiKeyAuth: RequestHandler = async (req, res, next) => {
    try {
        // Read the api key from request handler
        const secret = req.header('x-api-key');

        if(!secret) {
            res.status(401).json({
                message: 'API key is required'
            });
            return
        }

        // Hash the supplied secret using the same algorithm used when the API key is created
        const keyHash = createHash('sha256').update(secret).digest('hex');

        // Find the matching key, keyHash is excluded by default, 
        // so explicitly select it from authentication
        const apiKey = await ApiKeyModel.findOne({
            keyHash, 
            status: 'active',
        }).select('+keyHash');

        if(!apiKey) {
            res.status(401).json({
                message: 'Invalid or revoked API key'
            });
            return;
        }

        // Verify that the associated tenant still exists
        const tenant = await TenantModel.findById(apiKey?.tenantId);

        if(!tenant) {
            res.status(401).json({
                message: 'Invalid API key'
            })
            return;
        }

        // Suspended tenants must not access protected endpoints
        if(tenant.status !== 'active') {
            res.status(403).json({
                message: 'Tenant is Suspended'
            });
            return;
        }

        // Establish trusted context for downstream handlers
        res.locals.tenantId = tenant._id.toString();
        res.locals.apiKeyId = apiKey._id.toString();

        // Record successful key usage
        await ApiKeyModel.updateOne(
            {_id: apiKey._id},
            {$set: {lastUsedAt: new Date()}}
        );

        next();
    } catch(error) {
        next(error);
    }
}