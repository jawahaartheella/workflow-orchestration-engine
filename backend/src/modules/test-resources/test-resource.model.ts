import type { InferSchemaType } from "mongoose";
import { model, Schema } from "mongoose";

const testResourceSchema = new Schema (
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        tenantId: {
            type: Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
            index: true
        }
    },
    { timestamps: true }
);

export type TestResource = InferSchemaType<typeof testResourceSchema>;

export const TestResourceModel = model(
    'TestResource',
    testResourceSchema
)