import type { InferSchemaType } from "mongoose";
import { model, Schema } from "mongoose";
import { TestResourceModel } from "../test-resources/test-resource.model.js";

// Position of the node on the visual workflow canvas
const positionSchema = new Schema(
    {
        x: {type: Number, required: true},
        y: {type: Number, required: true}
    },
    {_id: false},
);

// Each node refers to an operation in the workflow
const workflowNodeSchema = new Schema(
    {
        id: {type: String, required: true},
        type: {type: String, required: true},
        position: {
            type: positionSchema,
            required: true
        },
        data: {
            type: Schema.Types.Mixed,
            default: {}
        }
    },
    {_id: false}
);

// Edges define connections between the nodes
const workflowEdgeSchema = new Schema(
    {
        id: {type: String, required: true},
        source: {type: String, required: true},
        target: {type: String, required: true},
        sourceHandle: {type: String, default: null},
        targetHandle: {type: String, default: null}
    },
    {_id: false}
);


// Complete Workflow Schema
const workflowSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: '',
            trim: true
        },
        tenantId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'Tenant',
            index: true
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'INACTIVE', 'DRAFT'],
            default: 'DRAFT',
            required: true
        },
        nodes: {
            type: [workflowNodeSchema],
            default: []
        },
        edges: {
            type: [workflowEdgeSchema],
            default: []
        },
        version: {
            type: Number,
            default: 1,
            min: 1
        }
    },
    { timestamps: true }
);

export type Workflow = InferSchemaType<typeof workflowSchema>;

export const WorkflowModel = model('Workflow', workflowSchema);