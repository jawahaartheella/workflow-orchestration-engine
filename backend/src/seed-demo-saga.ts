import 'dotenv/config';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { TenantModel } from './modules/tenants/tenant.model.js';
import { ApiKeyModel } from './modules/api-keys/api-key.model.js';
import { createApiKey } from './modules/api-keys/api-key.service.js';
import { WorkflowModel } from './modules/workflows/workflow.model.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function seedDemoData(): Promise<void> {
    console.log('=== SEEDING DEMO TENANTS, API KEYS & SAGA WORKFLOWS ===');

    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is missing');
    }

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Connected to MongoDB Atlas');

        // 1. Seed or find Tenant: Acme Technologies
        let acmeTenant = await TenantModel.findOne({ slug: 'acme-technologies' });
        if (!acmeTenant) {
            acmeTenant = await TenantModel.create({
                name: 'Acme Technologies',
                slug: 'acme-technologies',
                status: 'active'
            });
            console.log('✓ Created Acme Technologies tenant');
        } else {
            console.log('✓ Found existing Acme Technologies tenant:', acmeTenant._id.toString());
        }

        // 2. Seed Acme API Key (Deterministic Demo Secret)
        const acmeSecret = 'acme_live_secret_key_demo_98765';
        const acmeKeyHash = createHash('sha256').update(acmeSecret).digest('hex');
        let acmeKey = await ApiKeyModel.findOne({ tenantId: acmeTenant._id, keyHash: acmeKeyHash });

        if (!acmeKey) {
            acmeKey = await ApiKeyModel.create({
                tenantId: acmeTenant._id,
                name: 'Acme Primary Key',
                keyHash: acmeKeyHash,
                status: 'active'
            });
            console.log('✓ Seeded active Acme API Key secret:', acmeSecret);
        } else {
            console.log('✓ Found active Acme API Key with ID:', acmeKey._id.toString());
        }

        // 3. Seed or find Tenant: Beta Solutions (for multi-tenant isolation testing)
        let betaTenant = await TenantModel.findOne({ slug: 'beta-solutions' });
        if (!betaTenant) {
            betaTenant = await TenantModel.create({
                name: 'Beta Solutions',
                slug: 'beta-solutions',
                status: 'active'
            });
            console.log('✓ Created Beta Solutions tenant');
        } else {
            console.log('✓ Found existing Beta Solutions tenant:', betaTenant._id.toString());
        }

        const betaSecret = 'beta_live_secret_key_demo_12345';
        const betaKeyHash = createHash('sha256').update(betaSecret).digest('hex');
        let betaKey = await ApiKeyModel.findOne({ tenantId: betaTenant._id, keyHash: betaKeyHash });

        if (!betaKey) {
            betaKey = await ApiKeyModel.create({
                tenantId: betaTenant._id,
                name: 'Beta Primary Key',
                keyHash: betaKeyHash,
                status: 'active'
            });
            console.log('✓ Seeded active Beta API Key secret:', betaSecret);
        } else {
            console.log('✓ Found active Beta API Key with ID:', betaKey._id.toString());
        }

        // 4. Seed Canonical Order Processing Saga Workflow under Acme
        const existingSaga = await WorkflowModel.findOne({
            tenantId: acmeTenant._id,
            name: 'E-Commerce Order Processing Saga'
        });

        const sagaNodes = [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 80, y: 180 },
                data: {
                    label: 'Order Checkout Ingress',
                    description: 'Incoming customer order webhook',
                    config: { triggerType: 'webhook', endpoint: '/v1/orders' }
                }
            },
            {
                id: 'task-reserve-inventory',
                type: 'task',
                position: { x: 320, y: 180 },
                data: {
                    label: 'Reserve Warehouse Inventory',
                    description: 'Forward: reserveInventory | Compensation: releaseInventory',
                    config: { taskType: 'inventory_reserve', action: 'inventory_reserve' }
                }
            },
            {
                id: 'task-charge-payment',
                type: 'task',
                position: { x: 580, y: 180 },
                data: {
                    label: 'Process Customer Payment',
                    description: 'Forward: processPayment | Compensation: refundPayment',
                    config: { taskType: 'payment_charge', action: 'payment_charge' }
                }
            },
            {
                id: 'task-ship-order',
                type: 'task',
                position: { x: 840, y: 180 },
                data: {
                    label: 'Create Carrier Shipment',
                    description: 'Forward: createShipment | Fails if failShipment=true',
                    config: { taskType: 'shipment_create', action: 'shipment_create' }
                }
            },
            {
                id: 'end-order-fulfilled',
                type: 'end',
                position: { x: 1100, y: 180 },
                data: {
                    label: 'Order Fulfilled & Shipped',
                    description: 'Terminal status commit',
                    config: { status: 'COMPLETED', emitEvent: 'order.fulfilled' }
                }
            }
        ];

        const sagaEdges = [
            { id: 'edge-1-2', source: 'start-1', target: 'task-reserve-inventory', sourceHandle: null, targetHandle: null },
            { id: 'edge-2-3', source: 'task-reserve-inventory', target: 'task-charge-payment', sourceHandle: null, targetHandle: null },
            { id: 'edge-3-4', source: 'task-charge-payment', target: 'task-ship-order', sourceHandle: null, targetHandle: null },
            { id: 'edge-4-5', source: 'task-ship-order', target: 'end-order-fulfilled', sourceHandle: null, targetHandle: null }
        ];

        let sagaWorkflow;
        if (!existingSaga) {
            sagaWorkflow = await WorkflowModel.create({
                name: 'E-Commerce Order Processing Saga',
                description: 'Distributed Saga pattern with automated reverse-order compensation (Reserve Inventory -> Charge Card -> Ship Order)',
                tenantId: acmeTenant._id,
                status: 'ACTIVE',
                nodes: sagaNodes,
                edges: sagaEdges,
                version: 1
            });
            console.log('✓ Created ACTIVE Order Processing Saga workflow:', sagaWorkflow._id.toString());
        } else {
            existingSaga.status = 'ACTIVE';
            existingSaga.nodes = sagaNodes as unknown as typeof existingSaga.nodes;
            existingSaga.edges = sagaEdges as unknown as typeof existingSaga.edges;
            await existingSaga.save();
            sagaWorkflow = existingSaga;
            console.log('✓ Updated and ACTIVATED existing Order Processing Saga workflow:', sagaWorkflow._id.toString());
        }

        console.log('\n======================================================');
        console.log('DEMO & EVALUATION CREDENTIALS:');
        console.log('Acme Tenant ID:   ', acmeTenant._id.toString());
        console.log('Acme API Key:     ', acmeSecret);
        console.log('Beta Tenant ID:   ', betaTenant._id.toString());
        console.log('Beta API Key:     ', betaSecret);
        console.log('Saga Workflow ID: ', sagaWorkflow._id.toString());
        console.log('======================================================\n');
    } finally {
        await mongoose.disconnect();
    }
}

seedDemoData().catch((err) => {
    console.error('Seed notice:', err.message);
});
