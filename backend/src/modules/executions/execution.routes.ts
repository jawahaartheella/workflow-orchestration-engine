import { Router } from "express";

import { apiKeyAuth } from "../../middleware/api-key-auth.middleware.js";
import { cancelExecutionController, getExecutionByIdController, getExecutionsController, retryExecutionController } from "./execution.controller.js";

const router = Router();

router.get('/', apiKeyAuth, getExecutionsController);
router.get('/:id', apiKeyAuth, getExecutionByIdController);
router.post('/:id/cancel', apiKeyAuth, cancelExecutionController);
router.post('/:id/retry', apiKeyAuth, retryExecutionController);

export default router;