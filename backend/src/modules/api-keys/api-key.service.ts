import { randomBytes, createHash } from "node:crypto";
import { Types } from "mongoose";
import { ApiKeyModel } from "./api-key.model.js";

function hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

export async function createApiKey(tenantId: Types.ObjectId, name: string) {
    // create cryptographically secure random secret
    const secret = randomBytes(32).toString('hex');

    // store only the hash never the secret
    const keyHash = hashApiKey(secret);

    const apiKey = await ApiKeyModel.create({
        name,
        keyHash,
        tenantId
    });

    // return the secret once; it cannot be recovered from the hash
    return {
        id: apiKey._id.toString(),
        name: apiKey.name,
        tenantId: apiKey.tenantId.toString(),
        secret
    }
}

export async function getApiKeysForTenant(tenantId: string) {
    return ApiKeyModel.find({
        tenantId: new Types.ObjectId(tenantId)
    }).sort({ createdAt: -1 });
}

export async function revokeApiKey(apiKeyId: string, tenantId: string) {
    return ApiKeyModel.findOneAndUpdate(
        {
            _id: apiKeyId,
            tenantId: new Types.ObjectId(tenantId)
        },
        {
            $set: { status: 'revoked' }
        },
        {
            new: true
        }
    );
}

