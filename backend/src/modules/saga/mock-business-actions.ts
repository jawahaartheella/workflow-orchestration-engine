/**
 * Deterministic Mock Business Actions for Saga Orchestration
 * Provides forward actions and compensating actions with built-in idempotency.
 */

interface BusinessActionStore {
    reservations: Map<string, { status: string; items: unknown; timestamp: Date }>;
    payments: Map<string, { status: string; amount: number; currency: string; timestamp: Date }>;
    shipments: Map<string, { status: string; trackingNumber: string; timestamp: Date }>;
}

const actionStore: BusinessActionStore = {
    reservations: new Map(),
    payments: new Map(),
    shipments: new Map()
};

export interface MockActionInput {
    orderId?: string;
    amount?: number;
    currency?: string;
    items?: unknown[];
    failShipment?: boolean;
    shouldFail?: boolean;
    forceFail?: boolean;
    [key: string]: unknown;
}

export const mockBusinessActions = {
    /**
     * Step 1: Forward - Reserve Inventory
     */
    async reserveInventory(payload: MockActionInput) {
        const orderId = payload.orderId || `ORD-${Date.now()}`;
        const reservationKey = `res_${orderId}`;

        const existing = actionStore.reservations.get(reservationKey);
        if (existing) {
            return {
                idempotent: true,
                reservationId: reservationKey,
                status: existing.status,
                items: existing.items,
                message: "Inventory already reserved (idempotent replay)"
            };
        }

        const record = {
            status: "RESERVED",
            items: payload.items || [{ sku: "SKU-PROD-01", quantity: 1 }],
            timestamp: new Date()
        };
        actionStore.reservations.set(reservationKey, record);

        return {
            idempotent: false,
            reservationId: reservationKey,
            orderId,
            status: "RESERVED",
            items: record.items,
            message: "Inventory successfully reserved"
        };
    },

    /**
     * Step 1 Compensation: Release Inventory
     */
    async releaseInventory(payload: MockActionInput & { reservationId?: string; failCompensation?: boolean; failRelease?: boolean }) {
        if (payload.failCompensation === true || payload.failRelease === true) {
            throw new Error(`Inventory release failed: Warehouse ERP write lock timeout during rollback`);
        }

        const orderId = payload.orderId;
        const reservationKey = payload.reservationId || (orderId ? `res_${orderId}` : null);

        if (!reservationKey || !actionStore.reservations.has(reservationKey)) {
            return {
                status: "RELEASED",
                reservationId: reservationKey || "unknown",
                message: "No active reservation found to release (noop/idempotent)"
            };
        }

        actionStore.reservations.set(reservationKey, {
            status: "RELEASED",
            items: [],
            timestamp: new Date()
        });

        return {
            status: "RELEASED",
            reservationId: reservationKey,
            orderId,
            message: "Inventory reservation successfully rolled back & released"
        };
    },

    /**
     * Step 2: Forward - Process Payment
     */
    async processPayment(payload: MockActionInput) {
        const orderId = payload.orderId || `ORD-${Date.now()}`;
        const paymentKey = `pay_${orderId}`;

        const existing = actionStore.payments.get(paymentKey);
        if (existing) {
            return {
                idempotent: true,
                transactionId: paymentKey,
                amount: existing.amount,
                currency: existing.currency,
                status: existing.status,
                message: "Payment already processed (idempotent replay)"
            };
        }

        const amount = Number(payload.amount) || 199.99;
        const currency = (payload.currency as string) || "USD";

        const record = {
            status: "CHARGED",
            amount,
            currency,
            timestamp: new Date()
        };
        actionStore.payments.set(paymentKey, record);

        return {
            idempotent: false,
            transactionId: paymentKey,
            orderId,
            amount,
            currency,
            status: "CHARGED",
            message: `Successfully charged ${currency} ${amount.toFixed(2)}`
        };
    },

    /**
     * Step 2 Compensation: Refund Payment
     */
    async refundPayment(payload: MockActionInput & { transactionId?: string; failCompensation?: boolean; failRefund?: boolean }) {
        if (payload.failCompensation === true || payload.failRefund === true) {
            throw new Error(`Payment refund failed: Payment gateway unreachable during rollback`);
        }

        const orderId = payload.orderId;
        const paymentKey = payload.transactionId || (orderId ? `pay_${orderId}` : null);

        if (!paymentKey || !actionStore.payments.has(paymentKey)) {
            return {
                status: "REFUNDED",
                transactionId: paymentKey || "unknown",
                message: "No active payment found to refund (noop/idempotent)"
            };
        }

        const current = actionStore.payments.get(paymentKey)!;
        actionStore.payments.set(paymentKey, {
            ...current,
            status: "REFUNDED",
            timestamp: new Date()
        });

        return {
            status: "REFUNDED",
            transactionId: paymentKey,
            refundId: `ref_${Date.now()}`,
            amountRefunded: current.amount,
            currency: current.currency,
            message: `Successfully refunded ${current.currency} ${current.amount.toFixed(2)}`
        };
    },

    /**
     * Step 3: Forward - Create Shipment (with configurable failure scenario)
     */
    async createShipment(payload: MockActionInput) {
        const orderId = payload.orderId || `ORD-${Date.now()}`;
        const shipmentKey = `ship_${orderId}`;

        // Configurable failure trigger:
        // Fails if failShipment, shouldFail, forceFail is true, or orderId contains 'FAIL'
        const shouldFail = payload.failShipment === true ||
            payload.shouldFail === true ||
            payload.forceFail === true ||
            (typeof payload.orderId === 'string' && payload.orderId.toUpperCase().includes('FAIL'));

        if (shouldFail) {
            throw new Error(`Carrier fulfillment rejected for Order ${orderId}: Destination warehouse unreachable or out of stock`);
        }

        const existing = actionStore.shipments.get(shipmentKey);
        if (existing) {
            return {
                idempotent: true,
                trackingNumber: existing.trackingNumber,
                status: existing.status,
                message: "Shipment already created (idempotent replay)"
            };
        }

        const trackingNumber = `TRK-${Math.floor(100000000 + Math.random() * 900000000)}`;
        actionStore.shipments.set(shipmentKey, {
            status: "SHIPPED",
            trackingNumber,
            timestamp: new Date()
        });

        return {
            idempotent: false,
            shipmentId: shipmentKey,
            orderId,
            trackingNumber,
            carrier: "FedEx Express",
            status: "SHIPPED",
            message: `Shipment booked with tracking: ${trackingNumber}`
        };
    },

    /**
     * Step 3 Compensation: Cancel Shipment
     */
    async cancelShipment(payload: MockActionInput & { shipmentId?: string }) {
        const orderId = payload.orderId;
        const shipmentKey = payload.shipmentId || (orderId ? `ship_${orderId}` : null);

        if (!shipmentKey || !actionStore.shipments.has(shipmentKey)) {
            return {
                status: "CANCELLED",
                shipmentId: shipmentKey || "unknown",
                message: "No active shipment found to cancel (noop/idempotent)"
            };
        }

        actionStore.shipments.set(shipmentKey, {
            status: "CANCELLED",
            trackingNumber: "",
            timestamp: new Date()
        });

        return {
            status: "CANCELLED",
            shipmentId: shipmentKey,
            message: "Shipment dispatch cancelled"
        };
    }
};
