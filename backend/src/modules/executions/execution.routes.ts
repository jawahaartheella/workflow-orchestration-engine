import { Router } from "express";

import { apiKeyAuth } from "../../middleware/api-key-auth.middleware.js";
import { getExecutionsController } from "./execution.controller.js";

const router = Router();

router.get('/', apiKeyAuth, getExecutionsController);

export default router;