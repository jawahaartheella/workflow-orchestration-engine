import 'dotenv/config';
import mongoose from 'mongoose';
import { Worker, type Job } from 'bullmq';
import { getRedisConnectionOptions } from './config/redis.config.js';
import { WORKFLOW_QUEUE_NAME } from './modules/queues/execution.queue.js';
import { processWorkflowJob, type WorkflowJobPayload } from './modules/queues/execution.processor.js';
import { ExecutionModel } from './modules/executions/execution.model.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function startWorker(): Promise<void> {
    console.log('=== STARTING WORKFLOW EXECUTION WORKER ===');

    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is missing from environment');
    }

    // 1. Connect to MongoDB Atlas
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Worker connected to MongoDB Atlas');

    // 2. Worker startup recovery: Reconcile any interrupted executions
    await reconcileInterruptedExecutions();

    // 3. Initialize BullMQ Worker
    const worker = new Worker(
        WORKFLOW_QUEUE_NAME,
        async (job: Job<WorkflowJobPayload>) => {
            console.log(`[Worker] Processing Job ${job.id} for Execution ${job.data.executionId} (Tenant: ${job.data.tenantId})`);
            await processWorkflowJob(job.data);
            console.log(`[Worker] Successfully completed Job ${job.id}`);
        },
        {
            connection: getRedisConnectionOptions(),
            concurrency: Number(process.env.WORKER_CONCURRENCY) || 5
        }
    );

    worker.on('completed', (job) => {
        console.log(`[Worker Event] Job ${job.id} finished successfully.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Worker Event] Job ${job?.id} failed with error:`, err.message);
    });

    worker.on('error', (err) => {
        console.warn(`[Worker Event] Worker connection notice:`, err.message);
    });

    // 4. Graceful Shutdown
    const shutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}. Shutting down worker gracefully...`);
        try {
            await worker.close();
            await mongoose.disconnect();
            console.log('✓ Worker shut down cleanly.');
            process.exit(0);
        } catch (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    console.log(`✓ BullMQ Worker listening on queue "${WORKFLOW_QUEUE_NAME}"`);
}

/**
 * Reconciles jobs that were left in RUNNING status during an unexpected worker restart.
 */
async function reconcileInterruptedExecutions(): Promise<void> {
    try {
        const interrupted = await ExecutionModel.find({
            status: { $in: ['RUNNING', 'COMPENSATING'] }
        });

        if (interrupted.length > 0) {
            console.log(`[Recovery] Found ${interrupted.length} interrupted execution(s). Reconciling...`);
            for (const exec of interrupted) {
                exec.error = 'Execution interrupted by worker restart. Marked for retry or inspection.';
                if (exec.status === 'COMPENSATING') {
                    exec.sagaStatus = 'COMPENSATION_FAILED';
                    exec.status = 'FAILED';
                } else {
                    exec.status = 'FAILED';
                }
                exec.completedAt = new Date();
                await exec.save();
            }
            console.log(`[Recovery] Interrupted executions marked cleanly.`);
        }
    } catch (err) {
        console.warn('[Recovery] Notice during interrupted execution scan:', err);
    }
}

startWorker().catch((error: unknown) => {
    console.error('Fatal worker startup error:', error);
    process.exit(1);
});
