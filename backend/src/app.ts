import express from 'express';

import { apiKeyAuth } from './middleware/api-key-auth.middleware.js';

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

export default app;