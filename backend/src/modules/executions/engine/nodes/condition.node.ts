import type { Workflow } from "../../../workflows/workflow.model.js";
import type { NodeExecutionContext, NodeExecutionResult, NodeHandler } from "../node.types.js";

interface ConditionConfig {
    expression?: string;
    trueLabel?: string;
    falseLabel?: string;
    [key: string]: unknown;
}

export class ConditionNodeHandler implements NodeHandler {
    async execute(
        node: Workflow['nodes'][number],
        context: NodeExecutionContext
    ): Promise<NodeExecutionResult> {
        try {
            const config = (node.data?.config || node.data || {}) as ConditionConfig;
            const expression = config.expression || 'true';

            // Build safe evaluation context
            const evalScope = {
                payload: {
                    ...context.workflowInput,
                    ...context.previousNodeOutputs
                },
                workflowInput: context.workflowInput,
                previousNodeOutputs: context.previousNodeOutputs
            };

            const outcome = this.evaluateExpression(expression, evalScope);
            const branchOutcome = outcome ? 'true' : 'false';

            return {
                status: 'COMPLETED',
                selectedBranch: branchOutcome,
                output: {
                    evaluatedExpression: expression,
                    conditionMet: outcome,
                    selectedBranch: branchOutcome,
                    branchLabel: outcome ? (config.trueLabel || 'True') : (config.falseLabel || 'False'),
                    evaluatedAt: new Date()
                }
            };
        } catch (error) {
            return {
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Condition evaluation failed'
            };
        }
    }

    /**
     * Safely evaluates simple JavaScript expressions against the scope without exposing globals.
     */
    private evaluateExpression(expression: string, scope: Record<string, unknown>): boolean {
        const trimmed = expression.trim();
        if (!trimmed || trimmed === 'true') return true;
        if (trimmed === 'false') return false;

        // Block dangerous tokens
        const forbiddenTokens = ['process', 'global', 'require', 'import', 'eval', 'Function', 'window', 'document', 'constructor'];
        for (const token of forbiddenTokens) {
            if (new RegExp(`\\b${token}\\b`).test(trimmed)) {
                throw new Error(`Forbidden keyword in expression: ${token}`);
            }
        }

        try {
            // Evaluate expression in isolated function scope
            const fn = new Function('scope', `
                with (scope) {
                    return Boolean(${trimmed});
                }
            `);
            return Boolean(fn(scope));
        } catch (err) {
            console.warn(`Condition evaluation failed for expression "${trimmed}":`, err);
            return false;
        }
    }
}
