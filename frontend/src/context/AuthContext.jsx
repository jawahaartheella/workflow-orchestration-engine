import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

const AuthContext = createContext(null);

const DEMO_KEYS = {
  'acme-technologies': 'acme_live_secret_key_demo_98765',
  'beta-solutions': 'beta_live_secret_key_demo_12345',
};

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('wf_api_key') || 'acme_live_secret_key_demo_98765');
  const [activeTenant, setActiveTenant] = useState(() => {
    try {
      const saved = localStorage.getItem('wf_active_tenant_data');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });

  const [tenants, setTenants] = useState([]);
  const [authError, setAuthError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Verify currently saved API key against backend
  const verifyApiKey = useCallback(async (keyToVerify) => {
    const key = keyToVerify || apiKey;
    if (!key) return null;

    setIsVerifying(true);
    setAuthError(null);
    try {
      const res = await apiClient.get('/auth/me', {
        headers: { 'x-api-key': key }
      });

      if (res && res.data && res.data.tenant) {
        const tenantData = {
          ...res.data.tenant,
          id: res.data.tenant.id || res.data.tenant._id,
        };
        setActiveTenant(tenantData);
        localStorage.setItem('wf_active_tenant_data', JSON.stringify(tenantData));
        localStorage.setItem('wf_active_tenant', tenantData.id);
        return tenantData;
      }
    } catch (err) {
      console.warn('Backend API key validation failed, resetting to valid demo key:', err.message);
      if (key !== 'acme_live_secret_key_demo_98765') {
        const fallbackKey = 'acme_live_secret_key_demo_98765';
        localStorage.setItem('wf_api_key', fallbackKey);
        setApiKey(fallbackKey);
      }
      setAuthError(err.message || 'Invalid API key');
    } finally {
      setIsVerifying(false);
    }
    return null;
  }, [apiKey]);

  // Load public tenants list from backend
  const refreshTenants = useCallback(async () => {
    try {
      const res = await apiClient.get('/auth/tenants');
      const tenantList = res?.data || (Array.isArray(res) ? res : []);
      if (Array.isArray(tenantList) && tenantList.length > 0) {
        const mapped = tenantList.map((t) => ({
          ...t,
          id: t._id || t.id,
        }));
        setTenants(mapped);
        setActiveTenant((current) => {
          if (!current && mapped.length > 0) {
            localStorage.setItem('wf_active_tenant_data', JSON.stringify(mapped[0]));
            localStorage.setItem('wf_active_tenant', mapped[0].id);
            return mapped[0];
          }
          return current;
        });
      } else {
        setTenants([]);
      }
    } catch (err) {
      console.warn('Failed to fetch tenants from backend:', err);
      setTenants([]);
    }
  }, []);

  const switchTenant = useCallback(async (tenantId) => {
    const selected = tenants.find((t) => t.id === tenantId || t._id === tenantId || t.slug === tenantId);
    if (selected) {
      const tenantData = {
        ...selected,
        id: selected.id || selected._id,
      };
      setActiveTenant(tenantData);
      localStorage.setItem('wf_active_tenant_data', JSON.stringify(tenantData));
      localStorage.setItem('wf_active_tenant', tenantData.id);

      // Check if there is an explicit API key or demo key for this tenant
      const defaultKey = DEMO_KEYS[selected.slug] || localStorage.getItem(`wf_api_key_${tenantData.id}`);
      if (defaultKey) {
        setApiKey(defaultKey);
        localStorage.setItem('wf_api_key', defaultKey);
        await verifyApiKey(defaultKey);
      }

      // Navigate to the Dashboard when switching tenant context
      navigate('/');
    }
  }, [tenants, verifyApiKey, navigate]);

  useEffect(() => {
    refreshTenants();
    if (apiKey) {
      verifyApiKey(apiKey);
    }
  }, [apiKey, refreshTenants, verifyApiKey]);

  const loginWithApiKey = async (newKey) => {
    localStorage.setItem('wf_api_key', newKey);
    setApiKey(newKey);
    const tenant = await verifyApiKey(newKey);
    if (tenant && tenant.id) {
      localStorage.setItem(`wf_api_key_${tenant.id}`, newKey);
    }
    return tenant;
  };

  const createTenant = async ({ name, slug }) => {
    try {
      const res = await apiClient.post('/auth/register-tenant', { name, slug });
      if (res && res.data && res.data.apiKey) {
        const newKey = res.data.apiKey.secret;
        localStorage.setItem('wf_api_key', newKey);
        setApiKey(newKey);
        setActiveTenant(res.data.tenant);
        refreshTenants();
        return res.data;
      }
    } catch (err) {
      console.error('Failed to register tenant on backend:', err);
      throw err;
    }
  };

  const login = (email, password) => {
    // Retain compatibility for demo login UI
    return true;
  };

  const logout = () => {
    setApiKey('');
    localStorage.removeItem('wf_api_key');
    localStorage.removeItem('wf_active_tenant_data');
  };

  const currentUser = {
    name: activeTenant?.name || 'Admin Engineer',
    email: 'admin@flowforge.io',
    role: 'PLATFORM_ARCHITECT',
  };

  return (
    <AuthContext.Provider
      value={{
        apiKey,
        activeTenant,
        currentUser,
        tenants,
        authError,
        isVerifying,
        switchTenant,
        loginWithApiKey,
        createTenant,
        verifyApiKey,
        refreshTenants,
        login,
        logout,
        isAuthenticated: true, // Allow dashboard access to manage workflows and keys
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
