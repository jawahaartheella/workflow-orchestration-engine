import { Router } from "express";
import { apiKeyAuth } from "../../middleware/api-key-auth.middleware.js";
import { activateWorkfolwController, createWorkflowController, deactivateWorkfolwController, deleteWorkflowController, getWorkFlowByIdController, getWorkflowsController, updateWorkflowController } from "./workflow.controller.js";
import { startWorkflowExecutionController } from "../executions/execution.controller.js";

const router = Router();

router.get('/', apiKeyAuth, getWorkflowsController);
router.get('/:id', apiKeyAuth, getWorkFlowByIdController);

router.post('/', apiKeyAuth, createWorkflowController);
router.post('/:id/execute', apiKeyAuth, startWorkflowExecutionController);

router.patch('/:id', apiKeyAuth, updateWorkflowController);
router.patch('/:id/activate', apiKeyAuth, activateWorkfolwController);
router.patch('/:id/deactivate', apiKeyAuth, deactivateWorkfolwController);

router.delete('/:id', apiKeyAuth, deleteWorkflowController);

export default router;