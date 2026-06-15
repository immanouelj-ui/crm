import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Users, TrendingUp, AlertCircle, Zap, ArrowRight, Check } from 'lucide-react';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const STATUS_COLORS = {
  Lead: 'bg-purple-100 text-purple-700',
  Prospect: 'bg-blue-100 text-blue-700',
  Client: 'bg-emerald-100 text-emerald-700',
  Inactif: 'bg-slate-100 text-slate-600',
};

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-pink-500', 'bg-rose-500',
  'bg-amber-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-blue-500',
];

function avatarColor(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function StatCard({ icon: Icon, label, value, iconBg, danger }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4 border border-slate-100">
      <div className={`p-3 rounded-xl ${iconBg}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${danger ? 'text-red-500' : 'text-slate-900'}`}>{value}</p>
      </div>
    </div>
  );
}

const STAGE_COLORS = {
  Prospect: 'bg-slate-400',
  Qualifié: 'bg-blue-500',
  Proposition: 'bg-indigo-500',
  Négociation: 'bg-amber-500',
  Gagné: 'bg-emerald-500',
  'Fermé perdu': 'bg-red-400',
};

export default function Dashboard({ onNavigate, onSelectContact }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    Promise.all([api.getDashboard(), api.getTasks()])
      .then(([dash, allTasks]) => {
        setData(dash);
        const today = new Date().toISOString().split('T')[0];
        const urgent = allTasks.filter(t => !t.done && t.due_date && t.due_date <= today);
        setTasks(urgent.slice(0, 6));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function toggleTask(task) {
    const updated = await api.updateTask(task.id, { done: true });
    setTasks(prev => prev.filter(t => t.id !== updated.id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const overdueCount = data?.overdueTasks ?? 0;

  // Pipeline by stage
  const stageData = data?.pipelineByStage || [];
  const maxCount = Math.max(...stageData.map(s => s.count), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-slate-500 text-sm mt-1">Vue d'ensemble de votre activité</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total contacts" value={data?.totalContacts ?? 0} iconBg="bg-blue-500" />
        <StatCard
          icon={TrendingUp}
          label="Pipeline total"
          value={`${(data?.openPipelineValue ?? 0).toLocaleString('fr-FR')} €`}
          iconBg="bg-emerald-500"
        />
        <StatCard
          icon={AlertCircle}
          label="Tâches en retard"
          value={overdueCount}
          iconBg={overdueCount > 0 ? 'bg-red-500' : 'bg-slate-400'}
          danger={overdueCount > 0}
        />
        <StatCard icon={Zap} label="Leads cette semaine" value={data?.leadsThisWeek ?? 0} iconBg="bg-violet-500" />
      </div>

      {/* Two column */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Left: Recent contacts */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Activité récente</h2>
            <button
              onClick={() => onNavigate('contacts')}
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
            >
              Voir tous <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {(data?.recentContacts || []).slice(0, 8).map(c => {
              const name = c.custom_data?.name || `Contact #${c.id}`;
              const company = c.custom_data?.company || '';
              const status = c.custom_data?.status;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onSelectContact && onSelectContact(c.id)}
                >
                  <div className={`w-8 h-8 rounded-full ${avatarColor(name)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                    {initials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
                    {company && <p className="text-xs text-slate-400 truncate">{company}</p>}
                  </div>
                  {status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
                      {status}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              );
            })}
            {(!data?.recentContacts || data.recentContacts.length === 0) && (
              <div className="text-center py-10 text-slate-400 text-sm">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Aucun contact pour l'instant
              </div>
            )}
          </div>
        </div>

        {/* Right: Urgent tasks */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Tâches urgentes</h2>
            <button
              onClick={() => onNavigate('tasks')}
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
            >
              Voir toutes <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-slate-600">Tout est à jour !</p>
              <p className="text-xs mt-1">Aucune tâche en retard</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {tasks.map(task => {
                const today = new Date().toISOString().split('T')[0];
                const isOverdue = task.due_date < today;
                return (
                  <div key={task.id} className="flex items-start gap-3 px-5 py-3">
                    <button
                      onClick={() => toggleTask(task)}
                      className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${isOverdue ? 'border-red-400 hover:bg-red-50' : 'border-amber-400 hover:bg-amber-50'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{task.title}</p>
                      <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
                        {isOverdue ? 'En retard · ' : 'Aujourd\'hui · '}{task.due_date}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline par étape */}
      {stageData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Pipeline par étape</h2>
          <div className="space-y-2.5">
            {stageData.map(({ stage, count }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-28 flex-shrink-0">{stage}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${STAGE_COLORS[stage] || 'bg-indigo-400'}`}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
