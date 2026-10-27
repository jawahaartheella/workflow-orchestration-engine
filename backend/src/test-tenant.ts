import 'dotenv/config';
import mongoose, { mongo } from 'mongoose';
import { TenantModel } from './modules/tenants/tenant.model.js';

async function testTenant(): Promise<void> {
    const uri = process.env.MONGODB_URI;

    if(!uri) {
        throw new Error('MongoDB URI is missing');
    }

    try {
        await mongoose.connect(uri);
        console.log("MongoDB Connected");

        const tenant = await TenantModel.create({
            name: 'Acme Technologies',
            slug: 'acme-technologies',
            status: 'active'
        });

        console.log('Tenant Created Successfully!');
        console.log(tenant.toObject());
    } finally {
        await mongoose.disconnect();
    }
} 

testTenant().catch((error: unknown) => {
    console.log("Tenant creation failed: ", error);
    process.exitCode = 1;
});