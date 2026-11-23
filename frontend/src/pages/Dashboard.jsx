import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  GitBranch,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  ArrowRight,
  Plus,
  Server,
  Layers,
  Activity,
  ArrowUpRight,
} from 'lucide-react';

import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { MOCK_STATISTICS } from '../data/mockData';
import { workflowService } from '../services/workflowService';
import { executionService } from '../services/executionService';

export default function Dashboard({ onOpenCreateWorkflow }) {
  const navigate = useNavigate();
  const { activeTenant } = useAuth();
  const { isDark } = useTheme();

  const [workflows, setWorkflows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [chartTimeframe, setChartTimeframe] = useState('7d');
  const [stats, setStats] = useState({
    totalWorkflows: 0,
    activeWorkflows: 0,
    totalExecutions: 0,
    successRate: '100.0',
    failedExecutions: 0,
  });
  const [nodeDistribution, setNodeDistribution] = useState(MOCK_STATISTICS.nodeExecutionDistribution);

  useEffect(() => {
    async function loadData() {
      try {
        const wfList = await workflowService.getWorkflows(activeTenant?.id);
        const execList = await executionService.getExecutions({ tenantId: activeTenant?.id });

        const safeWfs = Array.isArray(wfList) ? wfList : [];
        const safeExecs = Array.isArray(execList) ? execList : [];

        setWorkflows(safeWfs);
        setExecutions(safeExecs);

        const totalWf = safeWfs.length;
        const activeWf = safeWfs.filter((w) => w.status === 'ACTIVE').length;
        const totalEx = safeExecs.length;
        const failedEx = safeExecs.filter((e) =>
          ['FAILED', 'COMPENSATION_FAILED', 'COMPENSATED'].includes(e.status)
        ).length;
        const successEx = safeExecs.filter((e) => e.status === 'COMPLETED').length;
        const rate = totalEx > 0 ? ((successEx / totalEx) * 100).toFixed(1) : '100.0';

        setStats({
          totalWorkflows: totalWf,
          activeWorkflows: activeWf,
          totalExecutions: totalEx,
          successRate: rate,
          failedExecutions: failedEx,
        });

        // Compute actual node breakdown from real workflow definitions
        if (safeWfs.length > 0) {
          const counts = {};
          let totalNodes = 0;
          safeWfs.forEach((wf) => {
            (wf.nodes || []).forEach((node) => {
              const type = node.type || 'task';
              counts[type] = (counts[type] || 0) + 1;
              totalNodes++;
            });
          });

          if (totalNodes > 0) {
            const palette = {
              task: { name: 'Task Runner', color: '#6366f1' },
              condition: { name: 'Conditions', color: '#f59e0b' },
              api: { name: 'API Request', color: '#06b6d4' },
              http: { name: 'HTTP Client', color: '#0ea5e9' },
              start: { name: 'Triggers', color: '#10b981' },
              trigger: { name: 'Triggers', color: '#10b981' },
              end: { name: 'Terminal Nodes', color: '#8b5cf6' },
            };

            const dist = Object.entries(counts).map(([type, cnt]) => {
              const meta = palette[type] || { name: type, color: '#94a3b8' };
              return {
                name: meta.name,
                value: Math.round((cnt / totalNodes) * 100),
                color: meta.color,
              };
            });
            setNodeDistribution(dist);
          }
        }
      } catch (err) {
        console.error('Failed to load telemetry stats from backend:', err);
      }
    }
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [activeTenant]);

  const chartData =
    chartTimeframe === '24h'
      ? MOCK_STATISTICS.hourlyTimeline
      : MOCK_STATISTICS.executionTimeline;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Orchestration Telemetry
            </h1>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 font-bold">
              {activeTenant?.name || 'Acme Corp'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Real-time DAG execution analytics, tenant database boundaries, and worker cluster status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/executions')}
            className="flex items-center gap-2 py-2 px-3.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
          >
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Live Monitor</span>
          </button>

          <button
            onClick={onOpenCreateWorkflow}
            className="flex items-center gap-1.5 py-2 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Workflows"
          value={stats.totalWorkflows}
          change={stats.totalWorkflows > 0 ? `${stats.totalWorkflows} registered` : '0 registered'}
          changeType="positive"
          icon={GitBranch}
          color="indigo"
        />
        <StatCard
          title="Active Pipelines"
          value={stats.activeWorkflows}
          change={`${stats.activeWorkflows} active`}
          changeType="positive"
          icon={Zap}
          color="emerald"
        />
        <StatCard
          title="Total Executions"
          value={stats.totalExecutions.toLocaleString()}
          change={`${stats.totalExecutions} total runs`}
          changeType="positive"
          icon={PlayCircle}
          color="cyan"
        />
        <StatCard
          title="Success Rate"
          value={`${stats.successRate}%`}
          change={Number(stats.successRate) >= 90 ? 'Healthy' : 'Audited'}
          changeType={Number(stats.successRate) >= 90 ? 'positive' : 'negative'}
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Failed / Compensated"
          value={stats.failedExecutions.toLocaleString()}
          change={`${stats.failedExecutions} rollbacks`}
          changeType="negative"
          period="audited"
          icon={XCircle}
          color="rose"
        />
      </div>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Line / Area Chart: Execution Volume */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Workflow Execution Throughput
              </h3>
              <p className="text-xs text-slate-400">
                Hourly and daily distribution of pipeline runs
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                onClick={() => setChartTimeframe('24h')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  chartTimeframe === '24h'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                24 Hours
              </button>
              <button
                onClick={() => setChartTimeframe('7d')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  chartTimeframe === '7d'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                7 Days
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorExec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                <XAxis
                  dataKey={chartTimeframe === '24h' ? 'hour' : 'date'}
                  stroke={isDark ? '#64748b' : '#94a3b8'}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartTimeframe === '24h' ? 'total' : 'executions'}
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorExec)"
                  name="Total Executions"
                />
                <Area
                  type="monotone"
                  dataKey="success"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSuccess)"
                  name="Successful"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Execution Distribution by Node Type */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Node Execution Breakdown
            </h3>
            <p className="text-xs text-slate-400">
              Workload weight by DAG step category
            </p>
          </div>

          <div className="h-56 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={nodeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {nodeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val) => `${val}%`}
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderRadius: '10px',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-3 border-t border-slate-100 dark:border-slate-800">
            {nodeDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 dark:text-slate-300 truncate">{item.name}</span>
                <span className="font-bold text-slate-900 dark:text-white ml-auto">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two Columns: Recent Workflows & Live Execution Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Workflows */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Active Workflows
              </h3>
              <p className="text-xs text-slate-400">
                Core DAG definitions running in {activeTenant?.name}
              </p>
            </div>
            <button
              onClick={() => navigate('/workflows')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {workflows.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No workflows registered yet for this tenant. Click "New Workflow" above to create or seed one.
              </div>
            ) : (
              workflows.map((wf) => (
                <div
                  key={wf.id || wf._id}
                  onClick={() => navigate(`/builder?id=${wf.id || wf._id}`)}
                  className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 rounded-xl transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-center font-bold shrink-0">
                      <GitBranch className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {wf.name}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                        <span>Trigger: {wf.triggerType || 'webhook'}</span>
                        <span>•</span>
                        <span>{wf.nodes?.length || 0} nodes</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                        wf.status === 'ACTIVE'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                      }`}
                    >
                      {wf.status}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Executions Stream */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Live Execution Stream
              </h3>
              <p className="text-xs text-slate-400">
                Latest jobs evaluated across workers
              </p>
            </div>
            <button
              onClick={() => navigate('/executions')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Full history</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {executions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No executions recorded yet. Open a workflow to trigger an execution.
              </div>
            ) : (
              executions.map((exec) => (
                <div
                  key={exec.id || exec._id}
                  onClick={() => navigate(`/executions/${exec.id || exec._id}`)}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 rounded-xl transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        exec.status === 'RUNNING' || exec.status === 'COMPENSATING'
                          ? 'bg-indigo-500 animate-pulse'
                          : exec.status === 'COMPLETED'
                          ? 'bg-emerald-500'
                          : exec.status === 'COMPENSATED'
                          ? 'bg-amber-500'
                          : exec.status === 'FAILED'
                          ? 'bg-rose-500'
                          : 'bg-slate-400'
                      }`}
                    />
                    <div className="truncate">
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {exec.workflowName || 'Workflow Execution'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>{exec.id || exec._id}</span>
                        <span>•</span>
                        <span>{exec.durationMs || 0}ms</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                        exec.status === 'RUNNING' || exec.status === 'COMPENSATING'
                          ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 animate-pulse'
                          : exec.status === 'COMPLETED'
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                          : exec.status === 'COMPENSATED'
                          ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : exec.status === 'FAILED'
                          ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {exec.status}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
