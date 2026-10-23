import express from 'express';

const app = express();

app.use(express.json()); // Let's express reads json request objects

app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Workflow orchestration app is running'
    });
});

export default app;