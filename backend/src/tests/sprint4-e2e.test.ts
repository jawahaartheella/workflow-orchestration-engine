import assert from "node:assert";
import { executeWorkflow } from "../modules/executions/engine/execution.engine.js";
import { enqueueWorkflowExecution, WORKFLOW_QUEUE_NAME } from "../modules/queues/execution.queue.js";
import { processWorkflowJob } from "../modules/queues/execution.processor.js";
import { mockBusinessActions } from "../modules/saga/mock-business-actions.js";
import type { Workflow } from "../modules/workflows/workflow.model.js";

async function runSprint4E2ETests() {
    console.log("=================================================================");
    console.log("       SPRINT 4: FULL END-TO-END SAGA & ORCHESTRATION SUITE       ");
    console.log("=================================================================");

    const e2eSagaWorkflow: Workflow = {
        name: "E-Commerce Distributed Order Saga",
        description: "Multi-step distributed transaction with automated LIFO compensation",
        tenantId: "tenant_acme_01" as any,
        status: "ACTIVE",
        version: 1,
        nodes: [
            {
                id: "start_node",
                type: "start",
                position: { x: 0, y: 0 },
                data: { label: "Order Received Webhook" }
            },
            {
                id: "step1_reserve",
                type: "task",
                position: { x: 200, y: 0 },
                data: {
                    label: "Reserve Inventory",
                    config: { taskType: "inventory_reserve" }
                }
            },
            {
                id: "step2_payment",
                type: "task",
                position: { x: 400, y: 0 },
                data: {
                    label: "Process Credit Card Payment",
                    config: { taskType: "payment_charge" }
                }
            },
            {
                id: "step3_shipment",
                type: "task",
                position: { x: 600, y: 0 },
                data: {
                    label: "Fulfill Carrier Shipment",
                    config: { taskType: "shipment_create" }
                }
            },
            {
                id: "end_node",
                type: "end",
                position: { x: 800, y: 0 },
                data: {
                    label: "Order Fulfillment Finished",
                    config: { status: "COMPLETED", emitEvent: "order.fulfilled" }
                }
            }
        ],
        edges: [
            { id: "e1", source: "start_node", target: "step1_reserve", sourceHandle: null, targetHandle: null },
            { id: "e2", source: "step1_reserve", target: "step2_payment", sourceHandle: null, targetHandle: null },
            { id: "e3", source: "step2_payment", target: "step3_shipment", sourceHandle: null, targetHandle: null },
            { id: "e4", source: "step3_shipment", target: "end_node", sourceHandle: null, targetHandle: null }
        ]
    } as unknown as Workflow;

    // =================================================================
    // TEST 1: Multi-Tenant Isolation Enforcement
    // =================================================================
    console.log("\n[TEST 1] Verifying Multi-Tenant Isolation & Cross-Tenant Boundary Rejection...");
    const tenantAcmeId = "tenant_acme_01";
    const tenantBetaId = "tenant_beta_02";

    assert.strictEqual(
        e2eSagaWorkflow.tenantId,
        tenantAcmeId,
        "Workflow must belong strictly to Acme Technologies"
    );

    // Cross-tenant execution attempt must be detected and rejected
    let crossTenantRejected = false;
    try {
        await processWorkflowJob({
            executionId: "exec_cross_tenant_probe",
            workflowId: "wf_acme_001",
            tenantId: tenantBetaId, // Beta attempting to access Acme
            input: { orderId: "ORD-INTRUDER-999" }
        });
    } catch (err) {
        crossTenantRejected = true;
        assert.ok(
            (err as Error).message.includes("Security validation failed"),
            "Expected cross-tenant attempt to fail security validation"
        );
    }
    assert.strictEqual(crossTenantRejected, true, "Cross-tenant intrusion attempt was successfully rejected");
    console.log("  ✓ Multi-tenant boundary verified: Beta cannot access or trigger Acme workflows.");

    // =================================================================
    // TEST 2: Asynchronous Execution Queueing (HTTP 202 Contract)
    // =================================================================
    console.log("\n[TEST 2] Verifying Asynchronous Execution Queue Dispatch (HTTP 202 Workflow)...");
    const enqueueRes = await enqueueWorkflowExecution({
        executionId: "exec_async_test_01",
        workflowId: "wf_async_01",
        tenantId: tenantAcmeId,
        input: { orderId: "ORD-ASYNC-101", amount: 120.00 }
    });

    assert.ok(enqueueRes.jobId, "Enqueueing must yield a valid queue Job ID");
    assert.ok(['bullmq', 'in_process'].includes(enqueueRes.mode));
    console.log(`  ✓ Async job enqueued successfully: JobId=${enqueueRes.jobId}, QueueMode=${enqueueRes.mode}`);

    // =================================================================
    // TEST 3: Saga Forward Success Path
    // =================================================================
    console.log("\n[TEST 3] Verifying Saga Forward Happy-Path Execution...");
    const successResult = await executeWorkflow(e2eSagaWorkflow, {
        executionId: "exec_saga_success_100",
        tenantId: tenantAcmeId,
        workflowId: "wf_acme_saga_01",
        workflowInput: {
            orderId: "ORD-SUCCESS-2026",
            amount: 249.99,
            failShipment: false
        }
    });

    assert.strictEqual(successResult.status, "COMPLETED", "Workflow status must be COMPLETED");
    assert.strictEqual(successResult.isSaga, true, "Must be identified as a distributed Saga");
    assert.strictEqual(successResult.sagaStatus, "COMPLETED", "Saga status must be COMPLETED");
    assert.strictEqual(successResult.error, null, "There should be no errors on happy path");

    // Check node execution sequence
    const executedNodeIds = successResult.nodeExecutions.map(n => n.nodeId);
    assert.ok(executedNodeIds.includes("step1_reserve"), "Reserve inventory node executed");
    assert.ok(executedNodeIds.includes("step2_payment"), "Payment node executed");
    assert.ok(executedNodeIds.includes("step3_shipment"), "Shipment node executed");
    assert.ok(executedNodeIds.includes("end_node"), "End node executed");

    // Check compensation steps were registered during forward execution
    assert.strictEqual(successResult.compensationSteps.length, 3, "3 compensating actions registered (reserve, payment & shipment)");
    console.log("  ✓ Forward Saga completed successfully: All steps executed in sequential order!");

    // =================================================================
    // TEST 4: Saga Forward Failure & Reverse-Order Compensation (LIFO)
    // =================================================================
    console.log("\n[TEST 4] Verifying Saga Forward Failure with Reverse-Order Compensation (LIFO)...");
    const failureResult = await executeWorkflow(e2eSagaWorkflow, {
        executionId: "exec_saga_fail_shipment_200",
        tenantId: tenantAcmeId,
        workflowId: "wf_acme_saga_01",
        workflowInput: {
            orderId: "ORD-FAIL-SHIPMENT",
            amount: 189.50,
            failShipment: true // Fails at step 3: Fulfill Carrier Shipment
        }
    });

    assert.strictEqual(failureResult.status, "FAILED", "Workflow execution must be marked FAILED");
    assert.strictEqual(failureResult.isSaga, true, "Must be identified as a distributed Saga");
    assert.strictEqual(failureResult.sagaStatus, "COMPENSATED", "Saga status must be COMPENSATED after rollback");
    assert.ok(
        failureResult.error?.includes("Carrier fulfillment rejected"),
        "Error message must specify carrier rejection reason"
    );

    // Verify reverse compensation order (LIFO: Payment Refund first, then Inventory Release)
    const compensationNodeTypes = failureResult.nodeExecutions
        .filter(n => n.isCompensation)
        .map(n => n.nodeType);

    console.log("  Reversed Compensation Trace:", compensationNodeTypes);
    assert.strictEqual(
        compensationNodeTypes[0],
        "compensation:payment_refund",
        "LIFO Step 1: Payment must be refunded before releasing inventory"
    );
    assert.strictEqual(
        compensationNodeTypes[1],
        "compensation:inventory_release",
        "LIFO Step 2: Inventory must be released after payment refund"
    );

    // Check that all compensation steps completed
    const allCompensationsSucceeded = failureResult.compensationSteps.every(c => c.status === "COMPLETED");
    assert.strictEqual(allCompensationsSucceeded, true, "All compensation steps must complete successfully");
    console.log("  ✓ Reverse-order (LIFO) compensation completed cleanly: Payment refunded, then inventory released!");

    // =================================================================
    // TEST 5: Saga Compensation Failure Handling (Human Intervention Flag)
    // =================================================================
    console.log("\n[TEST 5] Verifying Compensation Failure Handling (Unreachable Compensation Service)...");
    const compFailResult = await executeWorkflow(e2eSagaWorkflow, {
        executionId: "exec_saga_comp_fail_300",
        tenantId: tenantAcmeId,
        workflowId: "wf_acme_saga_01",
        workflowInput: {
            orderId: "ORD-COMP-FAIL-300",
            amount: 99.00,
            failShipment: true,
            failCompensation: true // Simulate network timeout or gateway lock during rollback
        }
    });

    assert.strictEqual(compFailResult.status, "FAILED");
    assert.strictEqual(compFailResult.isSaga, true);
    assert.strictEqual(
        compFailResult.sagaStatus,
        "COMPENSATION_FAILED",
        "Saga status must be marked COMPENSATION_FAILED when rollback step fails"
    );

    const failedCompensation = compFailResult.compensationSteps.find(c => c.status === "FAILED");
    assert.ok(failedCompensation, "At least one compensation step must record FAILED status");
    console.log(`  ✓ Compensation failure correctly captured: Status=${compFailResult.sagaStatus}, Error="${failedCompensation?.error}"`);

    // =================================================================
    // TEST 6: Idempotency Verification for Forward & Rollback Actions
    // =================================================================
    console.log("\n[TEST 6] Verifying Business Action Idempotency on Replay...");
    const orderId = "ORD-IDEMPOTENT-400";

    // 1st run: Reserve
    const r1 = await mockBusinessActions.reserveInventory({ orderId });
    assert.strictEqual(r1.idempotent, false, "Initial reservation is not idempotent");

    // 2nd run: Replay Reserve
    const r2 = await mockBusinessActions.reserveInventory({ orderId });
    assert.strictEqual(r2.idempotent, true, "Subsequent reservation replay must be flagged idempotent");

    // 1st run: Charge Payment
    const p1 = await mockBusinessActions.processPayment({ orderId, amount: 50 });
    assert.strictEqual(p1.idempotent, false, "Initial payment is not idempotent");

    // 2nd run: Replay Charge Payment
    const p2 = await mockBusinessActions.processPayment({ orderId, amount: 50 });
    assert.strictEqual(p2.idempotent, true, "Subsequent payment replay must be flagged idempotent");

    // 1st run: Refund
    const ref1 = await mockBusinessActions.refundPayment({ orderId });
    assert.strictEqual(ref1.status, "REFUNDED");

    // 2nd run: Replay Refund
    const ref2 = await mockBusinessActions.refundPayment({ orderId });
    assert.strictEqual(ref2.status, "REFUNDED", "Replay refund must succeed idempotently without double-refunding");

    console.log("  ✓ Idempotency verified: Replayed operations are recognized and protected against duplicate effects.");

    console.log("\n=================================================================");
    console.log("       ALL SPRINT 4 E2E TESTS PASSED WITH 100% SUCCESS RATE!      ");
    console.log("=================================================================\n");
}

runSprint4E2ETests().catch((err) => {
    console.error("\n❌ Sprint 4 E2E Tests Failed:", err);
    process.exit(1);
});
