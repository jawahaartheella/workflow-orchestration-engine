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
      return items.map((w) => {
        const normalizedId = w._id ? w._id.toString() : (w.id ? w.id.toString() : '');
        return {
          ...w,
          id: normalizedId,
          _id: normalizedId,
          status: (w.status || 'ACTIVE').toUpperCase(),
          tags: Array.isArray(w.tags) ? w.tags : ['orchestration', 'dag'],
          totalExecutions: w.totalExecutions || 0,
          triggerType: w.triggerType || w.nodes?.find((n) => n.type === 'trigger' || n.type === 'start')?.data?.config?.triggerType || 'webhook',
        };
      });
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
        const normalizedId = wf._id ? wf._id.toString() : (wf.id ? wf.id.toString() : id);
        return {
          ...wf,
          id: normalizedId,
          _id: normalizedId,
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
          id: template.id,
          _id: template.id,
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
    const rawId = workflow._id || workflow.id;
    const isExistingBackendId = rawId && /^[0-9a-fA-F]{24}$/.test(rawId.toString());
    const targetId = rawId ? rawId.toString() : null;

    const payload = {
      name: workflow.name,
      description: workflow.description || '',
      nodes: workflow.nodes || [],
      edges: workflow.edges || [],
    };

    let result = null;
    if (isExistingBackendId && targetId) {
      // Update existing workflow
      const res = await apiClient.patch(`/workflows/${targetId}`, payload);
      result = res?.data || res;
    } else {
      // Create new workflow
      const res = await apiClient.post('/workflows', payload);
      result = res?.data || res;
    }

    const normalizedId = result._id ? result._id.toString() : (result.id ? result.id.toString() : targetId);
    return {
      ...result,
      id: normalizedId,
      _id: normalizedId,
      name: result.name || workflow.name,
      description: result.description !== undefined ? result.description : workflow.description,
      nodes: result.nodes || workflow.nodes,
      edges: result.edges || workflow.edges,
      status: (result.status || workflow.status || 'DRAFT').toUpperCase(),
    };
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
