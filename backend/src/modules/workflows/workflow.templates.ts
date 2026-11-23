export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    nodeCount: number;
    nodes: Array<{
        id: string;
        type: string;
        position: { x: number; y: number };
        data: Record<string, unknown>;
    }>;
    edges: Array<{
        id: string;
        source: string;
        target: string;
        sourceHandle?: string;
        targetHandle?: string;
        label?: string;
        animated?: boolean;
        style?: Record<string, unknown>;
    }>;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
    {
        id: 'template_ecommerce',
        name: 'E-Commerce Order Fulfillment & Fraud Check',
        description: 'Validates order payload, assesses credit risk score, triggers payment gateway, and routes to shipping.',
        category: 'E-Commerce',
        nodeCount: 7,
        nodes: [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 80, y: 180 },
                data: {
                    label: 'Order Webhook',
                    description: 'POST /v1/webhooks/orders',
                    config: { triggerType: 'webhook', method: 'POST', endpoint: '/v1/webhooks/orders' }
                }
            },
            {
                id: 'api-validate',
                type: 'api',
                position: { x: 340, y: 180 },
                data: {
                    label: 'Validate Inventory',
                    description: 'Check stock with WMS API',
                    config: {
                        method: 'POST',
                        url: 'https://inventory.api.acme.com/v1/stock/reserve',
                        headers: '{"Authorization": "Bearer sk_wms_live"}',
                        timeout: 3000
                    }
                }
            },
            {
                id: 'cond-fraud',
                type: 'condition',
                position: { x: 620, y: 160 },
                data: {
                    label: 'Fraud Score < 0.85?',
                    description: 'Branch on high-risk transactions',
                    config: {
                        expression: 'payload.riskScore < 0.85 && payload.amount < 5000',
                        description: 'Order amount and fraud rating check'
                    }
                }
            },
            {
                id: 'task-payment',
                type: 'task',
                position: { x: 920, y: 80 },
                data: {
                    label: 'Charge Credit Card',
                    description: 'Invoke Stripe Payment Intent',
                    config: {
                        taskType: 'payment_charge',
                        retryLimit: 3,
                        timeout: 5000
                    }
                }
            },
            {
                id: 'task-alert-sec',
                type: 'task',
                position: { x: 920, y: 300 },
                data: {
                    label: 'Flag Fraud Review',
                    description: 'Notify Security Ops Slack channel',
                    config: {
                        taskType: 'slack_alert',
                        channel: '#security-fraud-alerts'
                    }
                }
            },
            {
                id: 'end-success',
                type: 'end',
                position: { x: 1220, y: 80 },
                data: {
                    label: 'Order Confirmed',
                    description: 'Send receipt & dispatch shipment',
                    config: { status: 'COMPLETED', emitEvent: 'order.fulfilled' }
                }
            },
            {
                id: 'end-rejected',
                type: 'end',
                position: { x: 1220, y: 300 },
                data: {
                    label: 'Order Flagged',
                    description: 'Payment blocked pending manual review',
                    config: { status: 'FAILED', emitEvent: 'order.rejected' }
                }
            }
        ],
        edges: [
            { id: 'e1-2', source: 'start-1', target: 'api-validate', animated: true },
            { id: 'e2-3', source: 'api-validate', target: 'cond-fraud', animated: true },
            { id: 'e3-4', source: 'cond-fraud', target: 'task-payment', sourceHandle: 'true', label: 'True (Approved)', style: { stroke: '#10b981', strokeWidth: 2 } },
            { id: 'e3-5', source: 'cond-fraud', target: 'task-alert-sec', sourceHandle: 'false', label: 'False (Flagged)', style: { stroke: '#ef4444', strokeWidth: 2 } },
            { id: 'e4-6', source: 'task-payment', target: 'end-success' },
            { id: 'e5-7', source: 'task-alert-sec', target: 'end-rejected' }
        ]
    },
    {
        id: 'template_batch_sync',
        name: 'Customer Sync & Data Enrichment Loop',
        description: 'Iterates through customer delta batch, enriches CRM attributes, and waits with a rate limit delay.',
        category: 'Data Pipeline',
        nodeCount: 6,
        nodes: [
            {
                id: 'start-cron',
                type: 'start',
                position: { x: 80, y: 150 },
                data: {
                    label: 'Nightly Sync Cron',
                    description: 'Schedule: 0 2 * * *',
                    config: { triggerType: 'schedule', cron: '0 2 * * *' }
                }
            },
            {
                id: 'api-fetch',
                type: 'api',
                position: { x: 320, y: 150 },
                data: {
                    label: 'Fetch CRM Records',
                    description: 'GET /v2/customers/modified',
                    config: { method: 'GET', url: 'https://api.crm.hubspot.com/v2/customers', timeout: 5000 }
                }
            },
            {
                id: 'loop-records',
                type: 'loop',
                position: { x: 580, y: 130 },
                data: {
                    label: 'Process Batch',
                    description: 'Iterate customer items',
                    config: { maxIterations: 500, batchSize: 50, continueOnError: true }
                }
            },
            {
                id: 'delay-throttle',
                type: 'delay',
                position: { x: 840, y: 130 },
                data: {
                    label: 'API Rate Throttler',
                    description: 'Wait 250 milliseconds',
                    config: { duration: 250, unit: 'milliseconds' }
                }
            },
            {
                id: 'task-upsert',
                type: 'task',
                position: { x: 1080, y: 130 },
                data: {
                    label: 'Upsert Data Warehouse',
                    description: 'Write to Snowflake BigQuery table',
                    config: { taskType: 'sql_upsert', targetTable: 'dim_customers' }
                }
            },
            {
                id: 'end-sync',
                type: 'end',
                position: { x: 1320, y: 150 },
                data: {
                    label: 'Sync Finished',
                    description: 'Audit log logged to BigQuery',
                    config: { status: 'COMPLETED' }
                }
            }
        ],
        edges: [
            { id: 'e-cron-fetch', source: 'start-cron', target: 'api-fetch' },
            { id: 'e-fetch-loop', source: 'api-fetch', target: 'loop-records' },
            { id: 'e-loop-delay', source: 'loop-records', target: 'delay-throttle' },
            { id: 'e-delay-task', source: 'delay-throttle', target: 'task-upsert' },
            { id: 'e-task-end', source: 'task-upsert', target: 'end-sync' }
        ]
    }
];
