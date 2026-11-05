import { Router } from "express";
import { apiKeyAuth } from "../../middleware/api-key-auth.middleware.js";
import { createWorkflowController, deleteWorkflowController, getWorkFlowByIdController, getWorkflowsController, updateWorkflowController } from "./workflow.controller.js";

const router = Router();

router.post('/', apiKeyAuth, createWorkflowController);
router.get('/', apiKeyAuth, getWorkflowsController);
router.get('/:id', apiKeyAuth, getWorkFlowByIdController);
router.patch('/:id', apiKeyAuth, updateWorkflowController);
router.delete('/:id', apiKeyAuth, deleteWorkflowController);

export default router;