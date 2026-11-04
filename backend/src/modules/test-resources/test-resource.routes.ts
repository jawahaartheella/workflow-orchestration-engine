import { Router } from "express";
import { apiKeyAuth } from "../../middleware/api-key-auth.middleware.js";
import { getTestResource } from "./test-resources.controller.js";

const router = Router();

router.get('/:id', apiKeyAuth, getTestResource);

export default router;