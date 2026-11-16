import { Router } from "express";
import { apiKeyAuth } from "../../middleware/api-key-auth.middleware.js";
import { TenantModel } from "../tenants/tenant.model.js";
import { createApiKey } from "../api-keys/api-key.service.js";

const router = Router();

// Get the authenticated tenant's identity
router.get('/me', apiKeyAuth, async (_req, res, next) => {
    try {
        const tenantId = res.locals.tenantId as string;
        const tenant = await TenantModel.findById(tenantId);

        if (!tenant) {
            res.status(404).json({ message: "Tenant not found" });
            return;
        }

        res.status(200).json({
            message: "Authentication successful",
            data: {
                tenant: {
                    id: tenant._id.toString(),
                    name: tenant.name,
                    slug: tenant.slug,
                    status: tenant.status
                },
                apiKeyId: res.locals.apiKeyId
            }
        });
    } catch (error) {
        next(error);
    }
});

// List public tenant metadata for tenant switching / demo selection
router.get('/tenants', async (_req, res, next) => {
    try {
        const tenants = await TenantModel.find({ status: 'active' }).select('name slug status createdAt');
        res.status(200).json({
            message: "Tenants retrieved successfully",
            data: tenants
        });
    } catch (error) {
        next(error);
    }
});

// Register a new tenant organization and issue its initial root API key
router.post('/register-tenant', async (req, res, next) => {
    try {
        const { name, slug } = req.body ?? {};

        if (!name || typeof name !== 'string' || !name.trim()) {
            res.status(400).json({ message: "Organization name is required" });
            return;
        }

        const normalizedSlug = (slug && typeof slug === 'string' && slug.trim())
            ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
            : name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

        const existing = await TenantModel.findOne({ slug: normalizedSlug });
        if (existing) {
            res.status(409).json({ message: `Tenant slug '${normalizedSlug}' is already registered` });
            return;
        }

        const tenant = await TenantModel.create({
            name: name.trim(),
            slug: normalizedSlug,
            status: 'active'
        });

        const initialKey = await createApiKey(tenant._id, 'Default Root Key');

        res.status(201).json({
            message: "Organization registered successfully",
            data: {
                tenant: {
                    id: tenant._id.toString(),
                    name: tenant.name,
                    slug: tenant.slug,
                    status: tenant.status
                },
                apiKey: initialKey
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
