import 'dotenv/config';
import mongoose from 'mongoose';

import { TenantModel } from './modules/tenants/tenant.model.js';
import { TestResourceModel } from './modules/test-resources/test-resource.model.js';


async function seedTestResources(): Promise<void> {
    const uri = process.env.MONGODB_URI;

    if(!uri) {
        throw new Error("MONGODB_URI is missing");
    }

    try {
        await mongoose.connect(uri);
        console.log("Connected to Mongodb Atlas");

        const acme = await TenantModel.findOne({
            slug: 'acme-technologies'
        });

        const beta = await TenantModel.findOne({
            slug: 'beta-solutions'
        });

        if(!acme || !beta) {
            console.log("Both tenants should be present before creating resources");
        }

        // Remove previous test records
        await TestResourceModel.deleteMany({
            name: {$in: ['Acme Test Workflow', 'Beta Test Workflow']}
        });

        const resources = await TestResourceModel.insertMany([
            {
                name: 'Acme Test Workflow',
                tenantId: acme?._id
            },
            {
                name: 'Beta Test Workflow',
                tenantId: beta?._id
            }
        ]);

        console.log("Test Resources Created!");
        
        resources.forEach((resource) => {
            console.log({
                id: resource._id.toString(),
                name: resource.name,
                tenantId: resource.tenantId?.toString()
            });
        });
    } finally {
        await mongoose.disconnect();
    }
}

seedTestResources().catch((error: unknown) => {
    console.error("Failed to create Test Resources: ", error);
    process.exitCode = 1;
})