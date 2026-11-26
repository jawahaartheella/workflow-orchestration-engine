import apiClient from './api';

function formatApiKey(k) {
  if (!k) return null;
  const id = k._id ? k._id.toString() : (k.id ? k.id.toString() : '');
  const isRevoked = (k.status || '').toLowerCase() === 'revoked';
  return {
    id,
    _id: id,
    name: k.name || 'Unnamed API Key',
    environment: k.environment || 'production',
    scopes: k.scopes || ['workflows:read', 'workflows:execute'],
    keyMasked: k.keyMasked || `wk_live_${id ? id.substring(0, 4) : 'key'}••••••••••••${id ? id.slice(-4) : 'auth'}`,
    fullKey: k.fullKey || k.secret || null,
    status: isRevoked ? 'REVOKED' : 'ACTIVE',
    createdAt: k.createdAt || new Date().toISOString(),
    lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never',
    tenantId: k.tenantId ? k.tenantId.toString() : '',
  };
}

export const apiKeyService = {
  /**
   * Get all keys for active tenant
   */
  async getApiKeys() {
    try {
      const res = await apiClient.get('/api-keys');
      const list = res?.data?.data || res?.data || (Array.isArray(res) ? res : []);
      if (Array.isArray(list)) {
        return list.map(formatApiKey);
      }
      return [];
    } catch (err) {
      console.error('Failed to fetch API keys from backend:', err);
      return [];
    }
  },

  /**
   * Generate a new cryptographic API key
   */
  async generateApiKey({ name, scopes, environment }) {
    try {
      const res = await apiClient.post('/api-keys', { name });
      const created = res?.data?.data || res?.data || res;
      const id = created._id ? created._id.toString() : (created.id ? created.id.toString() : '');
      const secret = created.secret;

      return {
        id,
        _id: id,
        name: created.name || name,
        environment: environment || 'production',
        scopes: scopes || ['workflows:read', 'workflows:execute'],
        fullKey: secret,
        keyMasked: secret ? `${secret.substring(0, 8)}••••••••••••` : `wk_live_${id.substring(0, 4)}••••••••••••${id.slice(-4)}`,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        lastUsedAt: 'Never',
        tenantId: created.tenantId ? created.tenantId.toString() : '',
      };
    } catch (err) {
      console.error('Failed to create API key on backend:', err);
      throw err;
    }
  },

  /**
   * Revoke an active key
   */
  async revokeApiKey(id) {
    try {
      const res = await apiClient.delete(`/api-keys/${id}`);
      return res?.data?.data || res?.data || true;
    } catch (err) {
      console.error(`Failed to revoke API key ${id}:`, err);
      throw err;
    }
  },

  /**
   * Rotate key: revokes existing key and creates a fresh key with the same name
   */
  async rotateApiKey(id) {
    try {
      const keys = await this.getApiKeys();
      const existing = keys.find((k) => k.id === id);
      if (!existing) throw new Error('API key not found to rotate');

      await this.revokeApiKey(id);
      return await this.generateApiKey({
        name: existing.name,
        scopes: existing.scopes,
        environment: existing.environment,
      });
    } catch (err) {
      console.error(`Failed to rotate API key ${id}:`, err);
      throw err;
    }
  },

  /**
   * Delete key permanently / revoke
   */
  async deleteApiKey(id) {
    return await this.revokeApiKey(id);
  },
};

export default apiKeyService;
