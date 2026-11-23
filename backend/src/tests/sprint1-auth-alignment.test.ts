import assert from "node:assert";
import { validateWorkflowDefinition } from "../modules/workflows/workflow.validator.js";
import { nodeRegistry } from "../modules/executions/engine/node-regestrations.js";

async function runSprint1Tests() {
    console.log("=== RUNNING SPRINT 1 VERIFICATION TESTS ===");

    // Test 1: Node Taxonomy Harmonization
    console.log("Test 1: Validating canonical node types...");
    const validWorkflowWithStart = {
        nodes: [
            { id: "start-1", type: "start", position: { x: 10, y: 10 }, data: {} },
            { id: "task-1", type: "task", position: { x: 100, y: 10 }, data: {} },
            { id: "cond-1", type: "condition", position: { x: 200, y: 10 }, data: {} },
            { id: "api-1", type: "api", position: { x: 300, y: 10 }, data: {} },
            { id: "end-1", type: "end", position: { x: 400, y: 10 }, data: {} }
        ],
        edges: [
            { id: "e1", source: "start-1", target: "task-1", sourceHandle: null, targetHandle: null },
            { id: "e2", source: "task-1", target: "cond-1", sourceHandle: null, targetHandle: null },
            { id: "e3", source: "cond-1", target: "api-1", sourceHandle: "true", targetHandle: null },
            { id: "e4", source: "api-1", target: "end-1", sourceHandle: null, targetHandle: null }
        ]
    };

    const errors = validateWorkflowDefinition(validWorkflowWithStart);
    assert.strictEqual(errors.length, 0, `Expected 0 validation errors, got: ${errors.join(", ")}`);
    console.log("✓ Workflow definition with 'start', 'task', 'condition', 'api', 'end' is valid!");

    // Test 2: Trigger node requirement
    console.log("Test 2: Verifying start/trigger requirement...");
    const invalidWorkflowNoTrigger = {
        nodes: [
            { id: "task-1", type: "task", position: { x: 100, y: 10 }, data: {} }
        ],
        edges: []
    };
    const noTriggerErrors = validateWorkflowDefinition(invalidWorkflowNoTrigger);
    assert.ok(
        noTriggerErrors.some(e => e.includes("start or trigger")),
        "Expected error requiring start or trigger node"
    );
    console.log("✓ Correctly rejects workflow missing a start or trigger node.");

    // Test 3: Node Registry Aliases
    console.log("Test 3: Checking Node Registry aliases...");
    assert.ok(nodeRegistry.has("start"), "NodeRegistry must have 'start' registered");
    assert.ok(nodeRegistry.has("trigger"), "NodeRegistry must have 'trigger' registered");
    assert.ok(nodeRegistry.has("api"), "NodeRegistry must have 'api' registered");
    assert.ok(nodeRegistry.has("http"), "NodeRegistry must have 'http' registered");
    console.log("✓ NodeRegistry correctly resolves both 'start' and 'api' aliases!");

    console.log("=== ALL SPRINT 1 TESTS PASSED SUCCESSFULLY! ===");
}

runSprint1Tests().catch((err) => {
    console.error("Sprint 1 Tests Failed:", err);
    process.exit(1);
});
