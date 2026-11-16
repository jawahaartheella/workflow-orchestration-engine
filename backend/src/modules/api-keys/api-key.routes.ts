import { Router } from "express";
import { apiKeyAuth } from "../../middleware/api-key-auth.middleware.js";
import { createApiKeyController, getApiKeysController, revokeApiKeyController } from "./api-key.controller.js";

const router = Router();

router.get('/', apiKeyAuth, getApiKeysController);
router.post('/', apiKeyAuth, createApiKeyController);
router.delete('/:id', apiKeyAuth, revokeApiKeyController);

export default router;
