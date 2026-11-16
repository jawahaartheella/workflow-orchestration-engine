import assert from "node:assert";
import { getRedisConnectionOptions } from "../config/redis.config.js";
import { enqueueWorkflowExecution, WORKFLOW_QUEUE_NAME } from "../modules/queues/execution.queue.js";
import { processWorkflowJob } from "../modules/queues/execution.processor.js";

async function runSprint3Tests() {
    console.log("=== RUNNING SPRINT 3 VERIFICATION TESTS ===");

    // Test 1: Centralized Redis Configuration
    console.log("Test 1: Testing Redis configuration management...");
    const redisOptions = getRedisConnectionOptions() as { host?: string; port?: number; maxRetriesPerRequest?: null };
    assert.ok(redisOptions.host !== undefined, "Expected redis host to be defined");
    assert.ok(typeof redisOptions.port === 'number', "Expected redis port to be numeric");
    assert.strictEqual(redisOptions.maxRetriesPerRequest, null, "BullMQ requires maxRetriesPerRequest=null");
    console.log(`✓ Redis connection options configured correctly: host=${redisOptions.host}, port=${redisOptions.port}`);

    // Test 2: Queue Producer & Job Enqueueing
    console.log("Test 2: Testing asynchronous workflow enqueueing...");
    const samplePayload = {
        executionId: "507f1f77bcf86cd799439011",
        workflowId: "507f1f77bcf86cd799439022",
        tenantId: "507f1f77bcf86cd799439033",
        input: { orderId: "ORD-QUEUE-100", amount: 75.00 }
    };

    const enqueueResult = await enqueueWorkflowExecution(samplePayload);
    assert.ok(enqueueResult.jobId, "Expected enqueueWorkflowExecution to return a jobId");
    assert.ok(['bullmq', 'in_process'].includes(enqueueResult.mode), "Expected valid queue mode");
    console.log(`✓ Job successfully enqueued with jobId=${enqueueResult.jobId} (mode=${enqueueResult.mode})`);

    // Test 3: Cross-Tenant Security in Queue Processor
    console.log("Test 3: Testing cross-tenant queue injection rejection...");
    // A spoofed job with invalid/mismatched IDs must be rejected
    const spoofedJob = {
        executionId: "unauthorized_exec_id",
        workflowId: "unauthorized_wf_id",
        tenantId: "unauthorized_tenant_id",
        input: {}
    };

    let securityRejected = false;
    try {
        await processWorkflowJob(spoofedJob);
    } catch (err) {
        securityRejected = true;
        assert.ok(
            (err as Error).message.includes("Security validation failed"),
            `Expected security validation error, got: ${(err as Error).message}`
        );
    }
    assert.ok(securityRejected, "Expected processor to reject cross-tenant spoofed execution");
    console.log("✓ Queue processor strictly validated tenant ownership and rejected unauthorized job!");

    // Test 4: Queue Name Consistency
    console.log("Test 4: Testing BullMQ queue naming convention...");
    assert.strictEqual(WORKFLOW_QUEUE_NAME, "workflow-executions", "Queue name must match target specification");
    console.log(`✓ Queue name matches target specification: "${WORKFLOW_QUEUE_NAME}"`);

    console.log("=== ALL SPRINT 3 TESTS PASSED SUCCESSFULLY! ===");
}

runSprint3Tests().catch((err) => {
    console.error("Sprint 3 Tests Failed:", err);
    process.exit(1);
});
