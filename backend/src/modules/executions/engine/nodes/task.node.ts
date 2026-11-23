import type { Workflow } from "../../../workflows/workflow.model.js";
import type { NodeExecutionContext, NodeExecutionResult, NodeHandler } from "../node.types.js";
import { mockBusinessActions, type MockActionInput } from "../../../saga/mock-business-actions.js";

interface TaskConfig {
    taskType?: string;
    action?: string;
    retryLimit?: number;
    timeout?: number;
    [key: string]: unknown;
}

export class TaskNodeHandler implements NodeHandler {
    async execute(
        node: Workflow['nodes'][number],
        context: NodeExecutionContext
    ): Promise<NodeExecutionResult> {
        try {
            const config = (node.data?.config || node.data || {}) as TaskConfig;
            const actionType = (config.taskType || config.action || '').toLowerCase();

            // Merge initial workflow input and outputs from previous steps
            const mergedPayload: MockActionInput = {
                ...context.workflowInput,
                ...context.previousNodeOutputs,
                ...(node.data as Record<string, unknown>)
            };

            // Handle specific business actions with matching compensation definitions
            if (actionType === 'inventory_reserve' || actionType === 'reserve_inventory') {
                const result = await mockBusinessActions.reserveInventory(mergedPayload);
                return {
                    status: 'COMPLETED',
                    output: result,
                    compensation: {
                        actionName: 'inventory_release',
                        payload: {
                            orderId: result.orderId,
                            reservationId: result.reservationId
                        }
                    }
                };
            }

            if (actionType === 'payment_charge' || actionType === 'process_payment') {
                const result = await mockBusinessActions.processPayment(mergedPayload);
                return {
                    status: 'COMPLETED',
                    output: result,
                    compensation: {
                        actionName: 'payment_refund',
                        payload: {
                            orderId: result.orderId,
                            transactionId: result.transactionId,
                            amount: result.amount
                        }
                    }
                };
            }

            if (actionType === 'shipment_create' || actionType === 'create_shipment') {
                const result = await mockBusinessActions.createShipment(mergedPayload);
                return {
                    status: 'COMPLETED',
                    output: result,
                    compensation: {
                        actionName: 'shipment_cancel',
                        payload: {
                            orderId: result.orderId,
                            shipmentId: result.shipmentId
                        }
                    }
                };
            }

            // General task logic execution
            return {
                status: 'COMPLETED',
                output: {
                    nodeId: node.id,
                    taskType: actionType || 'custom_task',
                    executedAt: new Date(),
                    payloadSummary: Object.keys(mergedPayload)
                }
            };
        } catch (error) {
            return {
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Task execution failed'
            };
        }
    }

    async compensate(
        node: Workflow['nodes'][number],
        context: NodeExecutionContext,
        compensationInput: unknown
    ): Promise<NodeExecutionResult> {
        try {
            const inputData = (compensationInput || {}) as Record<string, unknown>;
            const payload = {
                ...context.workflowInput,
                ...inputData
            };
            const actionName = (payload.actionName as string || '').toLowerCase();

            if (actionName === 'inventory_release' || actionName === 'release_inventory') {
                const result = await mockBusinessActions.releaseInventory(payload);
                return { status: 'COMPLETED', output: result };
            }

            if (actionName === 'payment_refund' || actionName === 'refund_payment') {
                const result = await mockBusinessActions.refundPayment(payload);
                return { status: 'COMPLETED', output: result };
            }

            if (actionName === 'shipment_cancel' || actionName === 'cancel_shipment') {
                const result = await mockBusinessActions.cancelShipment(payload);
                return { status: 'COMPLETED', output: result };
            }

            return {
                status: 'COMPLETED',
                output: {
                    message: `Compensation executed for node ${node.id}`,
                    compensatedAt: new Date()
                }
            };
        } catch (error) {
            return {
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Compensation failed'
            };
        }
    }
}
