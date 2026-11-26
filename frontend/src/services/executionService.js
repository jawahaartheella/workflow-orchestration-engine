import apiClient from './api';

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

  const normalizedId = record._id ? record._id.toString() : (record.id ? record.id.toString() : '');

  // Calculate overall execution duration in ms
  const totalDurationMs = (record.startedAt && record.completedAt)
    ? Math.max(1, new Date(record.completedAt) - new Date(record.startedAt))
    : (record.startedAt
      ? Math.max(1, Date.now() - new Date(record.startedAt))
      : 0);

  // Client-side guard: if all nodes completed cleanly, reflect COMPLETED status
  let resolvedStatus = record.status;
  let resolvedCompletedAt = record.completedAt;
  const nodes = record.nodeExecutions || [];
  if (resolvedStatus === 'RUNNING' && nodes.length > 0) {
    const hasFailed = nodes.some((n) => n.status === 'FAILED');
    const lastNode = nodes[nodes.length - 1];
    const isTerminal = lastNode?.nodeType === 'end' || lastNode?.nodeType === 'terminal';
    const allDone = nodes.every((n) => n.status === 'COMPLETED');
    if (!hasFailed && (isTerminal || allDone)) {
      resolvedStatus = 'COMPLETED';
      resolvedCompletedAt = lastNode?.completedAt || new Date();
    }
  }

  return {
    ...record,
    id: normalizedId,
    _id: normalizedId,
    status: resolvedStatus,
    completedAt: resolvedCompletedAt,
    durationMs: record.durationMs || totalDurationMs,
    workflowName: record.workflowName || record.workflowSnapshot?.name || 'Workflow Execution',
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
      if (!Array.isArray(items)) return [];
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
    if (!id) return null;
    try {
      const res = await apiClient.get(`/executions/${id}`);
      return formatExecution(res?.data || res);
    } catch (err) {
      console.error(`Failed to fetch execution ${id}:`, err);
      return null;
    }
  },

  /**
   * Start a new execution for a workflow
   */
  async triggerExecution(workflow, payload = {}) {
    const targetId = workflow._id || workflow.id;
    try {
      const res = await apiClient.post(`/workflows/${targetId}/execute`, {
        input: payload,
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
      const res = await apiClient.post(`/executions/${id}/cancel`);
      return formatExecution(res?.data || res);
    } catch (err) {
      console.error(`Failed to cancel execution ${id}:`, err);
      return null;
    }
  },

  /**
   * Retry failed execution
   */
  async retryExecution(id) {
    try {
      const res = await apiClient.post(`/executions/${id}/retry`);
      return formatExecution(res?.data || res);
    } catch (err) {
      console.error(`Failed to retry execution ${id}:`, err);
      return null;
    }
  },
};

export default executionService;
