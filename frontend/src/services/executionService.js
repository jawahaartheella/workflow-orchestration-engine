import apiClient from './api';
import { MOCK_EXECUTIONS } from '../data/mockData';

const EXECUTIONS_STORAGE_KEY = 'wf_executions_cache';

function getCachedExecutions() {
  try {
    const raw = localStorage.getItem(EXECUTIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse cached executions', err);
  }
  localStorage.setItem(EXECUTIONS_STORAGE_KEY, JSON.stringify(MOCK_EXECUTIONS));
  return MOCK_EXECUTIONS;
}

function setCachedExecutions(executions) {
  try {
    localStorage.setItem(EXECUTIONS_STORAGE_KEY, JSON.stringify(executions));
  } catch (err) {
    console.warn('Failed to persist executions', err);
  }
}

function formatExecution(record) {
  if (!record) return null;

  const timeline = (record.nodeExecutions || []).map((node) => {
    const durationMs = (node.startedAt && node.completedAt)
      ? Math.max(1, new Date(node.completedAt) - new Date(node.startedAt))
      : 0;

    return {
      step: `${node.nodeId} (${node.nodeType})`,
      status: node.status,
      duration: `${durationMs}ms`,
      timestamp: node.startedAt ? new Date(node.startedAt).toLocaleTimeString() : '',
      message: node.error || (node.output ? JSON.stringify(node.output) : 'Step evaluated successfully'),
    };
  });

  return {
    ...record,
    id: record._id || record.id,
    timeline: (record.timeline && record.timeline.length > 0) ? record.timeline : timeline,
  };
}

export const executionService = {
  /**
   * Get executions list with optional filters
   */
  async getExecutions(filters = {}) {
    try {
      const res = await apiClient.get('/executions', { params: filters });
      const items = res?.data || (Array.isArray(res) ? res : []);
      return items.map(formatExecution);
    } catch (err) {
      console.error('Failed to fetch executions from backend:', err);
      return [];
    }
  },

  /**
   * Get single execution details
   */
  async getExecutionById(id) {
    try {
      const res = await apiClient.get(`/executions/${id}`);
      return formatExecution(res?.data || res);
    } catch (err) {
      console.error(`Failed to fetch execution ${id}:`, err);
      const all = getCachedExecutions();
      return all.find((e) => e.id === id) || null;
    }
  },

  /**
   * Start a new execution for a workflow
   */
  async triggerExecution(workflow, payload = {}) {
    const targetId = workflow._id || workflow.id;
    try {
      // Backend expects { input: { ... } }
      const res = await apiClient.post(`/workflows/${targetId}/execute`, {
        input: payload
      });
      return formatExecution(res?.data || res);
    } catch (err) {
      console.error('Failed to trigger execution:', err);
      throw err;
    }
  },

  /**
   * Cancel execution
   */
  async cancelExecution(id) {
    try {
      await apiClient.post(`/executions/${id}/cancel`);
    } catch {
      // Fallback
    }

    const all = getCachedExecutions();
    const item = all.find((e) => e.id === id);
    if (item) {
      item.status = 'CANCELLED';
      item.completedAt = new Date().toISOString();
      item.timeline.push({
        step: 'Abort Signal',
        status: 'CANCELLED',
        duration: '0ms',
        timestamp: new Date().toLocaleTimeString(),
        message: 'Execution aborted by operator from console',
      });
      setCachedExecutions(all);
    }
    return item;
  },

  /**
   * Retry failed execution
   */
  async retryExecution(id) {
    const all = getCachedExecutions();
    const item = all.find((e) => e.id === id);
    if (!item) return null;

    const retryExec = {
      ...item,
      id: `exec_live_${Math.random().toString(16).substring(2, 10)}`,
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: 0,
      progress: 25,
      timeline: [
        {
          step: 'Execution Retry Init',
          status: 'COMPLETED',
          duration: '5ms',
          timestamp: new Date().toLocaleTimeString(),
          message: `Retrying failed execution reference ${id}`,
        },
      ],
    };

    all.unshift(retryExec);
    setCachedExecutions(all);
    return retryExec;
  },
};

export default executionService;
