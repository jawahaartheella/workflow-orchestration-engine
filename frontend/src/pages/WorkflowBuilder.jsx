import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useNodesState, useEdgesState } from '@xyflow/react';
import {
  Save,
  Play,
  RotateCcw,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Trash2,
  Layers,
  ChevronDown,
  Sparkles,
  Sliders,
  ExternalLink,
  Pause,
  StopCircle,
} from 'lucide-react';

import WorkflowCanvas from '../components/WorkflowCanvas';
import NodePalette from '../components/NodePalette';
import NodeConfigPanel from '../components/NodeConfigPanel';
import ValidationPanel from '../components/ValidationPanel';
import ExecutionTimeline from '../components/ExecutionTimeline';
import Modal from '../components/Modal';

import { workflowService } from '../services/workflowService';
import { executionService } from '../services/executionService';
import { socketService } from '../services/socketService';
import { useAuth } from '../context/AuthContext';
import { MOCK_TEMPLATES } from '../data/mockData';

const BLANK_CANVAS_NODES = [
  {
    id: 'start-1',
    type: 'start',
    position: { x: 250, y: 200 },
    data: {
      label: 'Trigger Ingress',
      description: 'Webhook entrypoint',
      config: { triggerType: 'webhook', endpoint: '/v1/webhooks/ingress' },
    },
  },
];

export default function WorkflowBuilder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeTenant } = useAuth();
  const workflowId = searchParams.get('id');

  // Workflow State
  const [workflow, setWorkflow] = useState({
    id: `wf_${Date.now().toString(36)}`,
    name: 'New Workflow',
    description: 'Custom visual DAG workflow execution graph',
    tenantId: activeTenant?.id || '',
    status: 'DRAFT',
    version: '1.0.0',
    nodes: BLANK_CANVAS_NODES,
    edges: [],
  });

  const [nodes, setNodes, onNodesChange] = useNodesState(BLANK_CANVAS_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Undo / Redo History Stack
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // UI Panels State
  const [selectedNode, setSelectedNode] = useState(null);
  const [showPalette, setShowPalette] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [validationResult, setValidationResult] = useState({ isValid: true, errors: [], warnings: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(null);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simActiveNodeId, setSimActiveNodeId] = useState(null);
  const [simTimeline, setSimTimeline] = useState([]);
  const [showSimDrawer, setShowSimDrawer] = useState(false);
  const simCleanupRef = useRef(null);

  // Real Backend Execution State
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [execOrderId, setExecOrderId] = useState(`ORD-${Math.floor(1000 + Math.random() * 9000)}`);
  const [execAmount, setExecAmount] = useState('150.00');
  const [failShipmentToggle, setFailShipmentToggle] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  // Push history state
  const pushHistory = useCallback((currentNodes, currentEdges) => {
    const nextState = {
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      edges: JSON.parse(JSON.stringify(currentEdges)),
    };

    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(nextState);

    // Keep max 25 steps
    if (newHistory.length > 25) newHistory.shift();

    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const state = historyRef.current[historyIndexRef.current];
      setNodes(state.nodes);
      setEdges(state.edges);
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(true);
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const state = historyRef.current[historyIndexRef.current];
      setNodes(state.nodes);
      setEdges(state.edges);
      setCanUndo(true);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }
  };

  // Load workflow if ID passed
  useEffect(() => {
    async function initWorkflow() {
      if (workflowId && workflowId !== 'undefined' && workflowId !== 'null') {
        try {
          const found = await workflowService.getWorkflowById(workflowId);
          if (found) {
            const wfData = {
              ...found,
              id: found._id ? found._id.toString() : found.id,
              _id: found._id ? found._id.toString() : found.id,
            };
            setWorkflow(wfData);
            setNodes(wfData.nodes || []);
            setEdges(wfData.edges || []);
            historyRef.current = [{ nodes: wfData.nodes || [], edges: wfData.edges || [] }];
            historyIndexRef.current = 0;
            return;
          }
        } catch (err) {
          console.error('Failed to load workflow by id:', err);
        }
      }
      // default clean slate init
      const blankWf = {
        id: `wf_${Date.now().toString(36)}`,
        name: 'New Workflow',
        description: 'Visual DAG workflow execution graph',
        tenantId: activeTenant?.id || '',
        status: 'DRAFT',
        version: '1.0.0',
        nodes: BLANK_CANVAS_NODES,
        edges: [],
      };
      setWorkflow(blankWf);
      setNodes(BLANK_CANVAS_NODES);
      setEdges([]);
      historyRef.current = [{ nodes: BLANK_CANVAS_NODES, edges: [] }];
      historyIndexRef.current = 0;
    }
    initWorkflow();
  }, [workflowId, activeTenant?.id]);

  // Keep selected node updated
  const handleNodeSelect = useCallback((node) => {
    setSelectedNode(node);
    if (node) {
      setShowConfig(true);
    }
  }, []);

  // Update node data from config panel
  const handleUpdateNode = useCallback((nodeId, newData) => {
    setNodes((prevNodes) => {
      const updated = prevNodes.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data: newData };
        }
        return n;
      });
      pushHistory(updated, edges);
      return updated;
    });

    setSelectedNode((prev) => (prev ? { ...prev, data: newData } : null));
  }, [edges, pushHistory]);

  // Delete node
  const handleDeleteNode = useCallback((nodeId) => {
    setNodes((prevNodes) => {
      const updatedNodes = prevNodes.filter((n) => n.id !== nodeId);
      setEdges((prevEdges) => {
        const updatedEdges = prevEdges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        );
        pushHistory(updatedNodes, updatedEdges);
        return updatedEdges;
      });
      return updatedNodes;
    });
    setSelectedNode(null);
    setShowConfig(false);
  }, [pushHistory]);

  // Duplicate node
  const handleDuplicateNode = useCallback((node) => {
    const clone = {
      ...JSON.parse(JSON.stringify(node)),
      id: `${node.type}_${Date.now().toString(36)}`,
      position: {
        x: (node.position?.x || 100) + 40,
        y: (node.position?.y || 100) + 40,
      },
      data: {
        ...node.data,
        label: `${node.data?.label || node.type} (Copy)`,
      },
    };
    setNodes((prev) => {
      const updated = prev.concat(clone);
      pushHistory(updated, edges);
      return updated;
    });
    setSelectedNode(clone);
  }, [edges, pushHistory]);

  // Add node from Palette
  const handleAddNodeFromPalette = (type, defaultData) => {
    const newNode = {
      id: `${type}_${Date.now().toString(36)}`,
      type,
      position: {
        x: 350 + Math.random() * 80,
        y: 200 + Math.random() * 80,
      },
      data: { ...defaultData },
    };
    setNodes((prev) => {
      const updated = prev.concat(newNode);
      pushHistory(updated, edges);
      return updated;
    });
    setSelectedNode(newNode);
    setShowConfig(true);
  };

  // Break cycle edge helper
  const handleBreakCycleEdge = (edgeId) => {
    setEdges((prevEdges) => {
      const updated = prevEdges.filter((e) => e.id !== edgeId);
      pushHistory(nodes, updated);
      return updated;
    });
  };

  // Save workflow
  const handleSaveWorkflow = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...workflow,
        nodes,
        edges,
        tenantId: activeTenant?.id || '',
        updatedAt: new Date().toISOString(),
      };
      const saved = await workflowService.saveWorkflow(payload);
      const targetId = saved._id || saved.id;
      setWorkflow(saved);
      if (!workflowId || workflowId !== targetId) {
        navigate(`/builder?id=${targetId}`, { replace: true });
      }
      setSaveToast('Workflow successfully persisted to tenant store!');
      setTimeout(() => setSaveToast(null), 3500);
    } catch (err) {
      console.error('Workflow save error:', err);
      setSaveToast('Failed to save workflow.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify({ ...workflow, nodes, edges }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${workflow.name.toLowerCase().replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON
  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.nodes && parsed.edges) {
          setWorkflow((prev) => ({
            ...prev,
            name: parsed.name || prev.name,
            description: parsed.description || prev.description,
          }));
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          pushHistory(parsed.nodes, parsed.edges);
          setSaveToast('Workflow imported successfully!');
          setTimeout(() => setSaveToast(null), 3000);
        }
      } catch {
        alert('Invalid workflow JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Run Test Simulation
  const handleStartSimulation = () => {
    if (!validationResult.isValid && validationResult.errors.length > 0) {
      setShowValidation(true);
      return;
    }

    setIsSimulating(true);
    setShowSimDrawer(true);
    setSimTimeline([]);

    const cleanup = socketService.simulateExecutionRun(
      `sim_${Date.now()}`,
      nodes,
      ({ status, progress, currentNode, stepLog }) => {
        setSimActiveNodeId(currentNode);
        if (stepLog) {
          setSimTimeline((prev) => [...prev, stepLog]);
        }
        if (status === 'COMPLETED') {
          setIsSimulating(false);
          setSimActiveNodeId(null);
        }
      }
    );

    simCleanupRef.current = cleanup;
  };

  const handleStopSimulation = () => {
    if (simCleanupRef.current) {
      simCleanupRef.current();
    }
    setIsSimulating(false);
    setSimActiveNodeId(null);
  };

  // Real Backend Workflow Execution
  const handleBackendExecute = async () => {
    setIsTriggering(true);
    try {
      // 1. Ensure latest canvas state is persisted to MongoDB
      const saved = await workflowService.saveWorkflow({
        ...workflow,
        nodes,
        edges,
      });
      setWorkflow(saved);

      // 2. Ensure workflow is activated before execution
      if (saved.status !== 'ACTIVE') {
        try {
          await workflowService.toggleWorkflowStatus(saved._id || saved.id, 'DRAFT');
          saved.status = 'ACTIVE';
        } catch (e) {
          console.warn('Activation check:', e);
        }
      }

      // 3. Dispatch execution to BullMQ queue on backend
      const payload = {
        orderId: execOrderId,
        amount: Number(execAmount) || 150.00,
        currency: 'USD',
        failShipment: failShipmentToggle,
        shouldFail: failShipmentToggle,
      };

      const exec = await executionService.triggerExecution(saved, payload);
      setShowExecuteModal(false);
      navigate(`/executions/${exec.id || exec._id}`);
    } catch (err) {
      alert(`Backend Execution Failed: ${err.message || 'Check workflow definition and status'}`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden select-none bg-slate-100 dark:bg-slate-950">
      {/* Top Builder Toolbar */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between gap-4 z-20 shrink-0">
        {/* Left: Workflow Title & Tenant */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={workflow.name}
            onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
            className="text-sm font-bold text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1 py-0.5 rounded transition-all truncate max-w-[220px] sm:max-w-xs"
          />

          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase border ${
              workflow.status === 'ACTIVE'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
            }`}
          >
            {workflow.status}
          </span>
        </div>

        {/* Center: Undo, Redo, Validate DAG, Simulate Run */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="hidden sm:flex items-center gap-1 border-r border-slate-200 dark:border-slate-800 pr-2">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Validation Status Toggle Button */}
          <button
            onClick={() => setShowValidation(!showValidation)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              validationResult.isValid
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50 hover:bg-rose-100 animate-pulse'
            }`}
          >
            {validationResult.isValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            )}
            <span className="hidden sm:inline">
              {validationResult.isValid
                ? 'DAG Valid'
                : `${validationResult.errors.length} Issues`}
            </span>
          </button>

          {/* Real Backend Execution Button */}
          <button
            onClick={() => setShowExecuteModal(true)}
            className="flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run on Backend</span>
          </button>

          {/* Simulate Execution Button */}
          {!isSimulating ? (
            <button
              onClick={handleStartSimulation}
              className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Simulate Run</span>
            </button>
          ) : (
            <button
              onClick={handleStopSimulation}
              className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-sm transition-all animate-pulse"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Stop Sim</span>
            </button>
          )}
        </div>

        {/* Right: Palette Toggle, Save, Export */}
        <div className="flex items-center gap-2">
          {/* JSON Export / Import buttons */}
          <button
            onClick={handleExportJSON}
            title="Export Workflow JSON"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden md:block"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <label
            title="Import Workflow JSON"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer hidden md:block"
          >
            <Upload className="w-3.5 h-3.5" />
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>

          {/* Toggle Palette */}
          <button
            onClick={() => setShowPalette(!showPalette)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1 ${
              showPalette
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700'
                : 'text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Palette</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSaveWorkflow}
            disabled={isSaving}
            className="flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {saveToast && (
        <div className="absolute top-16 right-6 z-50 p-3 bg-emerald-600 text-white rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Main Builder Canvas Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Drag Palette */}
        {showPalette && <NodePalette onAddNode={handleAddNodeFromPalette} />}

        {/* Center Canvas */}
        <div className="flex-1 h-full relative">
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            setNodes={setNodes}
            setEdges={setEdges}
            onNodeSelect={handleNodeSelect}
            onValidationChange={setValidationResult}
            isSimulating={isSimulating}
            activeSimNodeId={simActiveNodeId}
            cycleEdges={validationResult.cycleResult?.cycleEdges || []}
          />
        </div>

        {/* Right Node Configuration Slide-Over Panel */}
        {showConfig && selectedNode && (
          <NodeConfigPanel
            selectedNode={selectedNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onDuplicateNode={handleDuplicateNode}
            onClose={() => {
              setShowConfig(false);
              setSelectedNode(null);
            }}
          />
        )}

        {/* Right Validation Results Slide-Over Panel */}
        {showValidation && (
          <ValidationPanel
            validationResult={validationResult}
            onSelectNode={(nodeId) => {
              const found = nodes.find((n) => n.id === nodeId);
              if (found) {
                setSelectedNode(found);
                setShowConfig(true);
              }
            }}
            onBreakCycleEdge={handleBreakCycleEdge}
            onClose={() => setShowValidation(false)}
          />
        )}
      </div>

      {/* Bottom Simulation Execution Timeline Drawer */}
      {showSimDrawer && (
        <div className="h-64 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-20 shadow-2xl transition-all">
          <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Simulation Execution Diagnostics</span>
              {isSimulating && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 animate-pulse font-semibold">
                  RUNNING...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSimDrawer(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <ExecutionTimeline timeline={simTimeline} />
          </div>
        </div>
      )}

      {/* Backend Execution Configuration Modal */}
      <Modal
        isOpen={showExecuteModal}
        onClose={() => setShowExecuteModal(false)}
        title="Trigger Asynchronous Backend Execution"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-500">
            Enqueues a persistent execution job to the BullMQ worker. The engine will validate tenant ownership, traverse the DAG, and persist results to MongoDB.
          </p>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Order ID / Correlation ID
            </label>
            <input
              type="text"
              value={execOrderId}
              onChange={(e) => setExecOrderId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Transaction Amount (USD)
            </label>
            <input
              type="number"
              step="10"
              value={execAmount}
              onChange={(e) => setExecAmount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-slate-900 dark:text-white"
            />
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={failShipmentToggle}
                onChange={(e) => setFailShipmentToggle(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
              />
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  Simulate Carrier Shipment Failure (Trigger Saga Compensation)
                </span>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                  When checked, step 3 (Shipment) will fail, forcing the Saga engine to roll back completed payment and inventory steps in strict reverse order.
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowExecuteModal(false)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBackendExecute}
              disabled={isTriggering}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5"
            >
              {isTriggering ? 'Dispatching...' : 'Dispatch Execution (HTTP 202)'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
