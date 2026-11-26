import express from 'express';
import cors from 'cors';
import { apiKeyAuth } from './middleware/api-key-auth.middleware.js';

import authRoutes from './modules/auth/auth.routes.js';
import apiKeyRoutes from './modules/api-keys/api-key.routes.js';
import workflowRoutes from './modules/workflows/workflow.routes.js';
import executionRoutes from './modules/executions/execution.routes.js';


const app = express();

app.use(cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

app.use(express.json()); // Lets express read json request objects

app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Workflow orchestration app is running'
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/executions', executionRoutes);

// Global JSON error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        message: err.message || 'Internal Server Error',
        error: err.name || 'Error'
    });
});

export default app;