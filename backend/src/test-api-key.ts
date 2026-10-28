
import 'dotenv/config';
import mongoose from 'mongoose';
import { TenantModel } from './modules/tenants/tenant.model.js';
import { createApiKey } from './modules/api-keys/api-key.service.js';

async function testApiKey(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is missing from .env');
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas');

    const tenant = await TenantModel.findOne({
      slug: 'acme-technologies',
    });

    if (!tenant) {
      throw new Error('Tenant not found. Create the tenant first.');
    }

    const result = await createApiKey(
      tenant._id,
      'Development API Key',
    );

    // Show the secret only once for this test.
    console.log('API key created successfully.');
    console.log('Key record ID:', result.id);
    console.log('Tenant ID:', result.tenantId);
    console.log('API key secret (save securely):', result.secret);
  } finally {
    await mongoose.disconnect();
  }
}

testApiKey().catch((error: unknown) => {
  console.error('API key test failed:', error);
  process.exitCode = 1;
});
