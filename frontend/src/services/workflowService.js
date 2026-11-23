import apiClient from './api';
import { MOCK_WORKFLOWS, MOCK_TEMPLATES } from '../data/mockData';

const WORKFLOWS_STORAGE_KEY = 'wf_workflows_cache';

/**
 * Initialize cache with mock workflows if empty
 */
function getCachedWorkflows() {
  try {
    const raw = localStorage.getItem(WORKFLOWS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to parse cached workflows, resetting to defaults', err);
  }
  localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(MOCK_WORKFLOWS));
  return MOCK_WORKFLOWS;
}

function setCachedWorkflows(workflows) {
  try {
    localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(workflows));
  } catch (err) {
    console.warn('Failed to persist workflows to localStorage', err);
  }
}

export const workflowService = {
  /**
   * Get all workflows for current tenant
   */
  async getWorkflows() {
    try {
      const res = await apiClient.get('/workflows');
      const items = res?.data || (Array.isArray(res) ? res : []);
      if (!Array.isArray(items)) return [];
      return items.map((w) => ({
        ...w,
        id: w._id || w.id,
        status: (w.status || 'ACTIVE').toUpperCase(),
        tags: Array.isArray(w.tags) ? w.tags : ['orchestration', 'dag'],
        totalExecutions: w.totalExecutions || 0,
        triggerType: w.triggerType || w.nodes?.find((n) => n.type === 'trigger' || n.type === 'start')?.data?.config?.triggerType || 'webhook',
      }));
    } catch (err) {
      console.error('Failed to fetch workflows from backend:', err);
      return [];
    }
  },

  /**
   * Get single workflow by ID
   */
  async getWorkflowById(id) {
    try {
      const res = await apiClient.get(`/workflows/${id}`);
      const wf = res?.data || res;
      if (wf && typeof wf === 'object') {
        return {
          ...wf,
          id: wf._id || wf.id,
          status: (wf.status || 'ACTIVE').toUpperCase(),
        };
      }
      return null;
    } catch (err) {
      console.error(`Failed to fetch workflow ${id} from backend:`, err);
      // If not in database, check mock templates as fallback for template browsing
      const template = MOCK_TEMPLATES.find((t) => t.id === id);
      if (template) {
        return {
          ...template,
          status: 'DRAFT',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      throw err;
    }
  },

  /**
   * Save or update workflow
   */
  async saveWorkflow(workflow) {
    const isExistingBackendId = workflow._id || (workflow.id && /^[0-9a-fA-F]{24}$/.test(workflow.id));
    const targetId = workflow._id || workflow.id;

    const payload = {
      name: workflow.name,
      description: workflow.description || '',
      nodes: workflow.nodes || [],
      edges: workflow.edges || [],
    };

    if (isExistingBackendId) {
      // Update existing workflow
      const res = await apiClient.patch(`/workflows/${targetId}`, payload);
      return res?.data || res;
    } else {
      // Create new workflow
      const res = await apiClient.post('/workflows', payload);
      return res?.data || res;
    }
  },

  /**
   * Delete workflow
   */
  async deleteWorkflow(id) {
    const res = await apiClient.delete(`/workflows/${id}`);
    return res?.data || true;
  },

  /**
   * Duplicate workflow
   */
  async duplicateWorkflow(id) {
    const source = await this.getWorkflowById(id);
    if (!source) throw new Error('Workflow not found to duplicate');

    const res = await apiClient.post('/workflows', {
      name: `${source.name} (Copy)`,
      description: source.description || '',
      nodes: source.nodes || [],
      edges: source.edges || [],
    });

    return res?.data || res;
  },

  /**
   * Toggle workflow status (ACTIVE <-> INACTIVE)
   */
  async toggleWorkflowStatus(id, currentStatus) {
    const targetStatus = currentStatus === 'ACTIVE' ? 'deactivate' : 'activate';
    const res = await apiClient.patch(`/workflows/${id}/${targetStatus}`);
    return res?.data || res;
  },

  /**
   * Fetch templates
   */
  getTemplates() {
    return MOCK_TEMPLATES;
  },
};

export default workflowService;
