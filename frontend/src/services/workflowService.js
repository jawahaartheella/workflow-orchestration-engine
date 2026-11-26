import apiClient from './api';

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
          totalExecutions: w.totalExecutions !== undefined ? w.totalExecutions : 0,
          successRate: w.successRate !== undefined ? w.successRate : 100,
          lastExecutedAt: w.lastExecutedAt || null,
          triggerType: w.triggerType || w.nodes?.find((n) => n.type === 'trigger' || n.type === 'start')?.data?.config?.triggerType || 'webhook',
        };
      });
    } catch (err) {
      console.error('Failed to fetch workflows from backend:', err);
      return [];
    }
  },

  /**
   * Get single workflow by ID or template ID
   */
  async getWorkflowById(id) {
    if (!id) return null;

    if (typeof id === 'string' && id.startsWith('template_')) {
      try {
        const res = await apiClient.get(`/workflows/templates/${id}`);
        const tpl = res?.data || res;
        if (tpl && typeof tpl === 'object') {
          return {
            ...tpl,
            id: tpl.id,
            _id: tpl.id,
            status: 'DRAFT',
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
      } catch (err) {
        console.error(`Failed to fetch workflow template ${id} from backend:`, err);
        return null;
      }
    }

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
      return null;
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
   * Fetch templates from backend API
   */
  async getTemplates() {
    try {
      const res = await apiClient.get('/workflows/templates');
      return res?.data || (Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to fetch templates from backend:', err);
      return [];
    }
  },
};

export default workflowService;
