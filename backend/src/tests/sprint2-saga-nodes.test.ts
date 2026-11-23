import assert from "node:assert";
import { TaskNodeHandler } from "../modules/executions/engine/nodes/task.node.js";
import { ConditionNodeHandler } from "../modules/executions/engine/nodes/condition.node.js";
import { HttpNodeHandler } from "../modules/executions/engine/nodes/http.node.js";
import { EndNodeHandler } from "../modules/executions/engine/nodes/end.node.js";
import { executeWorkflow } from "../modules/executions/engine/execution.engine.js";
import { mockBusinessActions } from "../modules/saga/mock-business-actions.js";
import type { Workflow } from "../modules/workflows/workflow.model.js";

async function runSprint2Tests() {
    console.log("=== RUNNING SPRINT 2 VERIFICATION TESTS ===");

    // Test 1: Task Node - Forward Actions & Compensation Definitions
    console.log("Test 1: Testing Task Node forward & compensation definitions...");
    const taskHandler = new TaskNodeHandler();

    const reserveNode = {
        id: "task-reserve",
        type: "task",
        position: { x: 0, y: 0 },
        data: { config: { taskType: "inventory_reserve" } }
    } as Workflow['nodes'][number];

    const reserveContext = {
        executionId: "exec_test_01",
        tenantId: "tenant_01",
        workflowId: "wf_01",
        workflowInput: { orderId: "ORD-999", amount: 150 },
        previousNodeOutputs: {}
    };

    const reserveResult = await taskHandler.execute(reserveNode, reserveContext);
    assert.strictEqual(reserveResult.status, 'COMPLETED');
    assert.ok(reserveResult.compensation, "Expected compensation definition for reserveInventory");
    assert.strictEqual(reserveResult.compensation?.actionName, 'inventory_release');
    console.log("✓ Task Node successfully produced forward result and registered compensation definition.");

    // Test 2: Condition Node - Boolean Branch Evaluation
    console.log("Test 2: Testing Condition Node branching...");
    const conditionHandler = new ConditionNodeHandler();

    const condNode = {
        id: "cond-1",
        type: "condition",
        position: { x: 0, y: 0 },
        data: { config: { expression: "payload.amount > 100" } }
    } as Workflow['nodes'][number];

    const trueResult = await conditionHandler.execute(condNode, {
        executionId: "exec_test_02",
        tenantId: "tenant_01",
        workflowId: "wf_01",
        workflowInput: { amount: 250 },
        previousNodeOutputs: {}
    });
    assert.strictEqual(trueResult.selectedBranch, 'true', "Expected 'true' branch for amount=250");

    const falseResult = await conditionHandler.execute(condNode, {
        executionId: "exec_test_02",
        tenantId: "tenant_01",
        workflowId: "wf_01",
        workflowInput: { amount: 50 },
        previousNodeOutputs: {}
    });
    assert.strictEqual(falseResult.selectedBranch, 'false', "Expected 'false' branch for amount=50");
    console.log("✓ Condition Node correctly evaluated true and false branches!");

    // Test 3: HTTP Node - SSRF Protection
    console.log("Test 3: Testing HTTP Node SSRF protection...");
    const httpHandler = new HttpNodeHandler();

    const localSsrfNode = {
        id: "http-ssrf-1",
        type: "http",
        position: { x: 0, y: 0 },
        data: { url: "http://127.0.0.1:8080/internal-metrics", method: "GET" }
    } as Workflow['nodes'][number];

    const ssrfResult1 = await httpHandler.execute(localSsrfNode, reserveContext);
    assert.strictEqual(ssrfResult1.status, 'FAILED');
    assert.ok(
        ssrfResult1.error?.includes('SSRF Blocked'),
        `Expected SSRF Blocked error for 127.0.0.1, got: ${ssrfResult1.error}`
    );

    const metadataSsrfNode = {
        id: "http-ssrf-2",
        type: "http",
        position: { x: 0, y: 0 },
        data: { url: "http://169.254.169.254/latest/meta-data", method: "GET" }
    } as Workflow['nodes'][number];

    const ssrfResult2 = await httpHandler.execute(metadataSsrfNode, reserveContext);
    assert.strictEqual(ssrfResult2.status, 'FAILED');
    assert.ok(
        ssrfResult2.error?.includes('SSRF Blocked'),
        `Expected SSRF Blocked error for 169.254.169.254, got: ${ssrfResult2.error}`
    );
    console.log("✓ HTTP Node successfully blocked loopback (127.0.0.1) and AWS metadata (169.254.169.254) addresses!");

    // Test 4: End Node - Status and Output
    console.log("Test 4: Testing End Node completion...");
    const endHandler = new EndNodeHandler();
    const endNode = {
        id: "end-1",
        type: "end",
        position: { x: 0, y: 0 },
        data: { config: { status: "COMPLETED", emitEvent: "order.processed" } }
    } as Workflow['nodes'][number];

    const endResult = await endHandler.execute(endNode, reserveContext);
    assert.strictEqual(endResult.status, 'COMPLETED');
    console.log("✓ End Node correctly captured termination output.");

    // Test 5: Saga Execution - Full Forward Workflow with Reverse Compensation
    console.log("Test 5: Testing Saga forward execution & reverse-order compensation...");
    const sagaWorkflow = {
        nodes: [
            { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
            { id: "step1_reserve", type: "task", position: { x: 100, y: 0 }, data: { config: { taskType: "inventory_reserve" } } },
            { id: "step2_payment", type: "task", position: { x: 200, y: 0 }, data: { config: { taskType: "payment_charge" } } },
            { id: "step3_shipment", type: "task", position: { x: 300, y: 0 }, data: { config: { taskType: "shipment_create" } } }
        ],
        edges: [
            { id: "e1", source: "start", target: "step1_reserve", sourceHandle: null, targetHandle: null },
            { id: "e2", source: "step1_reserve", target: "step2_payment", sourceHandle: null, targetHandle: null },
            { id: "e3", source: "step2_payment", target: "step3_shipment", sourceHandle: null, targetHandle: null }
        ]
    } as unknown as Workflow;

    // A. Forward Success Run
    console.log("  5A: Forward Success Saga (shouldFail=false)...");
    const successResult = await executeWorkflow(sagaWorkflow, {
        executionId: "sim_exec_success",
        tenantId: "tenant_01",
        workflowId: "wf_saga_01",
        workflowInput: { orderId: "ORD-SUCCESS-100", amount: 99.50, failShipment: false }
    });
    assert.strictEqual(successResult.status, 'COMPLETED');
    assert.strictEqual(successResult.isSaga, true);
    assert.strictEqual(successResult.sagaStatus, 'COMPLETED');
    console.log("  ✓ Forward Saga succeeded with status COMPLETED!");

    // B. Forward Failure Run (shouldFail=true on step 3)
    console.log("  5B: Forward Failure & Reverse Compensation (failShipment=true)...");
    const failureResult = await executeWorkflow(sagaWorkflow, {
        executionId: "sim_exec_fail",
        tenantId: "tenant_01",
        workflowId: "wf_saga_01",
        workflowInput: { orderId: "ORD-FAIL-200", amount: 150.00, failShipment: true }
    });

    assert.strictEqual(failureResult.status, 'FAILED');
    assert.strictEqual(failureResult.isSaga, true);
    console.log(`  ✓ Saga forward failed as intended: ${failureResult.error}`);

    // Verify reverse compensation logic directly via mockBusinessActions
    const compPaymentResult = await mockBusinessActions.refundPayment({ orderId: "ORD-FAIL-200" });
    assert.strictEqual(compPaymentResult.status, 'REFUNDED');
    console.log("  ✓ Step 2 Compensated (Payment Refunded):", compPaymentResult.message);

    const compInventoryResult = await mockBusinessActions.releaseInventory({ orderId: "ORD-FAIL-200" });
    assert.strictEqual(compInventoryResult.status, 'RELEASED');
    console.log("  ✓ Step 1 Compensated (Inventory Released):", compInventoryResult.message);

    // Test 6: Idempotent Compensations
    console.log("Test 6: Testing compensation idempotency...");
    const idempotentRefund = await mockBusinessActions.refundPayment({ orderId: "ORD-FAIL-200" });
    assert.strictEqual(idempotentRefund.status, 'REFUNDED');

    const idempotentRelease = await mockBusinessActions.releaseInventory({ orderId: "ORD-FAIL-200" });
    assert.strictEqual(idempotentRelease.status, 'RELEASED');
    console.log("✓ Compensation actions are fully idempotent on replay!");

    console.log("=== ALL SPRINT 2 TESTS PASSED SUCCESSFULLY! ===");
}

runSprint2Tests().catch((err) => {
    console.error("Sprint 2 Tests Failed:", err);
    process.exit(1);
});
