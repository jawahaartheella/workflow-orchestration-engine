import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Layers, ArrowRight, GitBranch, ShoppingCart, Repeat } from 'lucide-react';
import Modal from './Modal';
import { workflowService } from '../services/workflowService';
import { useAuth } from '../context/AuthContext';

export default function CreateWorkflowModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { activeTenant } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank');
  const [templates, setTemplates] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadTemplates() {
      try {
        const list = await workflowService.getTemplates();
        if (isMounted && Array.isArray(list)) {
          setTemplates(list);
        }
      } catch (err) {
        console.warn('Failed to load templates:', err);
      }
    }
    if (isOpen) {
      loadTemplates();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      let initialNodes = [];
      let initialEdges = [];

      if (selectedTemplateId === 'blank') {
        // Blank canvas: start with a single Start trigger node
        initialNodes = [
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
        initialEdges = [];
      } else {
        const found = templates.find((t) => t.id === selectedTemplateId);
        if (found) {
          initialNodes = found.nodes || [];
          initialEdges = found.edges || [];
        }
      }

      const newWorkflow = {
        name: name.trim(),
        description: description.trim() || 'Visual orchestration pipeline',
        nodes: initialNodes,
        edges: initialEdges,
      };

      const saved = await workflowService.saveWorkflow(newWorkflow);
      const targetId = saved?.id || saved?._id;
      setName('');
      setDescription('');
      setSelectedTemplateId('blank');
      onClose();
      if (targetId) {
        navigate(`/builder?id=${targetId}`);
      }
    } catch (err) {
      console.error('Failed to create workflow:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Workflow"
      subtitle={`Provision a visual DAG pipeline in "${activeTenant?.name}".`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
            Workflow Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Real-Time Fraud Assessment & Settlement"
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
            Description
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the operational goals, downstream systems, or SLA requirements..."
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white resize-none focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-2">
            Start From Blueprint Template
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Blank Option */}
            <div
              onClick={() => setSelectedTemplateId('blank')}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                selectedTemplateId === 'blank'
                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  Blank Canvas
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Start from a clean slate with a standalone Start trigger node.
              </p>
            </div>

            {/* Backend Templates */}
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  selectedTemplateId === tpl.id
                    ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold">
                    {tpl.id.includes('ecommerce') ? (
                      <ShoppingCart className="w-3.5 h-3.5" />
                    ) : (
                      <Repeat className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white truncate">
                    {tpl.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  {tpl.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Provisioning...' : 'Open in Canvas'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </Modal>
  );
}
