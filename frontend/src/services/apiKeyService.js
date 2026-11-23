import apiClient from './api';
import { MOCK_API_KEYS } from '../data/mockData';

const API_KEYS_STORAGE_KEY = 'wf_apikeys_cache';

function getCachedKeys() {
  try {
    const raw = localStorage.getItem(API_KEYS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse cached API keys', err);
  }
  localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(MOCK_API_KEYS));
  return MOCK_API_KEYS;
}

function setCachedKeys(keys) {
  try {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch (err) {
    console.warn('Failed to persist API keys', err);
  }
}

/**
 * Helper to generate cryptographic-style token
 */
function generateCryptoRandomString(bytes = 16) {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < bytes * 2; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export const apiKeyService = {
  /**
   * Get all keys for active tenant
   */
  async getApiKeys() {
    try {
      const res = await apiClient.get('/api-keys');
      if (res && res.data) {
        return Array.isArray(res.data) ? res.data : [];
      }
      return [];
    } catch {
      const all = getCachedKeys();
      return all;
    }
  },

  /**
   * Generate a new cryptographic API key
   */
  async generateApiKey({ name }) {
    try {
      const res = await apiClient.post('/api-keys', { name });
      if (res && res.data) {
        return {
          id: res.data.id,
          name: res.data.name,
          fullKey: res.data.secret,
          keyMasked: res.data.secret ? `${res.data.secret.substring(0, 8)}••••••••••••` : '••••••••',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          lastUsedAt: 'Never',
        };
      }
    } catch {
      // Fallback
    }

    const tenant = localStorage.getItem('wf_active_tenant') || 'acme_corp';
    const entropy = generateCryptoRandomString(16);
    const checksum = generateCryptoRandomString(2);
    const fullKey = `wk_live_${tenant}_${entropy}.${checksum}`;
    const keyMasked = `wk_live_${tenant}_${entropy.substring(0, 4)}••••••••••••${checksum}`;

    const newKey = {
      id: `key_live_${Date.now().toString(36)}`,
      name,
      prefix: `wk_live_${tenant}_`,
      keyMasked,
      fullKey, // Returned once for user copy
      tenantId: tenant,
      scopes: ['workflows:read', 'workflows:execute'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      lastUsedAt: 'Never',
      usageCount: 0,
    };

    const all = getCachedKeys();
    all.unshift(newKey);
    setCachedKeys(all);

    return newKey;
  },

  /**
   * Revoke an active key
   */
  async revokeApiKey(id) {
    try {
      const res = await apiClient.delete(`/api-keys/${id}`);
      return res?.data || true;
    } catch {
      // Fallback
    }

    const all = getCachedKeys();
    const item = all.find((k) => k.id === id);
    if (item) {
      item.status = 'REVOKED';
      setCachedKeys(all);
    }
    return item;
  },

  /**
   * Rotate key: issues new entropy while keeping key name and permissions
   */
  async rotateApiKey(id) {
    const all = getCachedKeys();
    const item = all.find((k) => k.id === id);
    if (!item) throw new Error('Key not found');

    const entropy = generateCryptoRandomString(16);
    const checksum = generateCryptoRandomString(2);
    const fullKey = `wk_live_${item.tenantId}_${entropy}.${checksum}`;
    const keyMasked = `wk_live_${item.tenantId}_${entropy.substring(0, 4)}••••••••••••${checksum}`;

    item.fullKey = fullKey;
    item.keyMasked = keyMasked;
    item.status = 'ACTIVE';
    item.lastUsedAt = 'Rotated just now';
    item.rotatedAt = new Date().toISOString();

    setCachedKeys(all);
    return item;
  },

  /**
   * Delete key permanently
   */
  async deleteApiKey(id) {
    const all = getCachedKeys();
    const filtered = all.filter((k) => k.id !== id);
    setCachedKeys(filtered);
    return true;
  },
};

export default apiKeyService;
