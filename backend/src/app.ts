import express from 'express';
import { apiKeyAuth } from './middleware/api-key-auth.middleware.js';

import testResourcesRoutes from './modules/test-resources/test-resource.routes.js';
import workflowRoutes from './modules/workflows/workflow.routes.js';
import executionRoutes from './modules/executions/execution.routes.js';


const app = express();

app.use(express.json()); // Let's express reads json request objects

app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Workflow orchestration app is running'
    });
});

app.get('/api/test-auth', apiKeyAuth, (_req, res) => {
    res.status(200).json({
        message: 'Authentication successful',
        tenantId: res.locals.tenantId,
        apiKeyId: res.locals.apiKeyId
    });
});

app.use('/api/test-resources', testResourcesRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/executions', executionRoutes);

export default app;