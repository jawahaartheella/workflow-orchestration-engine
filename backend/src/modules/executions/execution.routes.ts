import { Router } from "express";

import { apiKeyAuth } from "../../middleware/api-key-auth.middleware.js";
import { getExecutionByIdController, getExecutionsController } from "./execution.controller.js";

const router = Router();

router.get('/', apiKeyAuth, getExecutionsController);
router.get('/:id', apiKeyAuth, getExecutionByIdController);

export default router;