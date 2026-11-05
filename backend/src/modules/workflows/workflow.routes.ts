import { Router } from "express";
import { apiKeyAuth } from "../../middleware/api-key-auth.middleware.js";
import { createWorkflowController } from "./workflow.controller.js";

const router = Router();

router.post('/', apiKeyAuth, createWorkflowController);

export default router;