import { model, Schema, Types } from "mongoose";
import type { InferSchemaType } from "mongoose";

const apiKeySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        keyHash: {
            type: String,
            required: true,
            unique: true,
            select: false
        },
        tenantId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'Tenant',
            index: true
        },
        status: {
            type: String,
            enum: ['active', 'revoked'],
            default: 'active',
            required: true
        },
        lastUsedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

export type APiKey = InferSchemaType<typeof apiKeySchema>;
export const ApiKeyModel = model('ApiKey', apiKeySchema);