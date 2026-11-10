import type { InferSchemaType } from "mongoose";
import { model, Schema, Types } from "mongoose";

const executionSchema = new Schema(
    {
        workflowId: {
            type: Types.ObjectId,
            required: true,
            ref: 'Workflow',
            index: true
        },
        tenantId: {
            type: Types.ObjectId,
            required: true,
            ref: 'Tenant',
            index: true
        },
        status: {
            type: String,
            enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
            default: 'PENDING'
        },
        input: {
            type: Schema.Types.Mixed,
            default: {}
        },
        output: {
            type: Schema.Types.Mixed,
            default: null
        },
        startedAt: {
            type: Date,
            default: null
        },
        completedAt: {
            type: Date,
            default: null
        },
        error: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

export type Execution = InferSchemaType<typeof executionSchema>;

export const ExecutionModel = model('Execution', executionSchema);