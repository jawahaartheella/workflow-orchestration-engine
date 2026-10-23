import { model, Schema } from 'mongoose';
import type {InferSchemaType} from 'mongoose';

const tenantSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        status: {
            type: String,
            enum: ['active', 'suspended'],
            default: 'active',
            required: true
        },
    },
    {
        timestamps: true
    }
);

export type Tenant = InferSchemaType<typeof tenantSchema>;
export const TenantModel = model('Tenant', tenantSchema);