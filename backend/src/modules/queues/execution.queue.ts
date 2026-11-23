import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { getRedisConnectionOptions, getRedisHost, getRedisPort } from "../../config/redis.config.js";
import { processWorkflowJob, type WorkflowJobPayload } from "./execution.processor.js";

export const WORKFLOW_QUEUE_NAME = "workflow-executions";

let bullQueue: Queue | null = null;
let isRedisAvailable = false;
let redisCheckDone = false;

async function checkRedisAvailability(): Promise<boolean> {
    if (redisCheckDone) return isRedisAvailable;

    let client: Redis | null = null;
    try {
        client = new Redis(getRedisPort(), getRedisHost(), {
            connectTimeout: 500,
            maxRetriesPerRequest: 0,
            retryStrategy: () => null,
            lazyConnect: true
        });

        // Suppress unhandled error events
        client.on('error', () => {});

        await client.connect();
        await client.ping();
        await client.quit();
        isRedisAvailable = true;
    } catch {
        if (client) {
            try { client.disconnect(); } catch {}
        }
        isRedisAvailable = false;
    }

    redisCheckDone = true;
    return isRedisAvailable;
}

export function getExecutionQueue(): Queue | null {
    if (bullQueue) return bullQueue;

    try {
        bullQueue = new Queue(WORKFLOW_QUEUE_NAME, {
            connection: getRedisConnectionOptions(),
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1500
                },
                removeOnComplete: 100,
                removeOnFail: 200
            }
        });
        return bullQueue;
    } catch (err) {
        console.warn('Failed to initialize BullMQ queue:', err);
        return null;
    }
}

/**
 * Enqueues a workflow execution job for background asynchronous processing.
 */
export async function enqueueWorkflowExecution(payload: WorkflowJobPayload): Promise<{ jobId: string; mode: 'bullmq' | 'in_process' }> {
    const redisAlive = await checkRedisAvailability();

    if (redisAlive) {
        const queue = getExecutionQueue();
        if (queue) {
            const job = await queue.add("execute_workflow", payload, {
                jobId: `job_${payload.executionId}`
            });
            return {
                jobId: job.id ?? payload.executionId,
                mode: 'bullmq'
            };
        }
    }

    // Resilient fallback: Asynchronously process in background task
    setImmediate(async () => {
        try {
            await processWorkflowJob(payload);
        } catch (err) {
            console.error(`In-process execution job failed for execution ${payload.executionId}:`, err);
        }
    });

    return {
        jobId: `local_${payload.executionId}`,
        mode: 'in_process'
    };
}
