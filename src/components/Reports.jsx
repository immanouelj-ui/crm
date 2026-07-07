import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { BarChart3, PieChart, CheckSquare, TrendingUp } from 'lucide-react';

const STATUS_COLORS = {
  Lead: '#8b5cf6',
  Prospect: '#3b82f6',
  Client: '#10b981',
  Inactif: '#94a3b8',
};

const STAGE_COLORS_HEX = {
  Prospect: '#94a3b8',
  Qualifié: '#3b82f6',
  Proposition: '#6366f1',
  Négociation: '#f59e0b',
  Gagné: '#10b981',
  'Fermé perdu': '#ef4444',
};

function DonutChart({ data, total }) {
  const cx = 80, cy = 80, r = 60;
  let startAngle = -Math.PI / 2;
  const slices = [];

  data.forEach(({ label, value, color }) => {
    if (value === 0) return;
    const angle = (value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    slices.push({
      d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`,
      color,
      label,
      value,
    });
    startAngle = endAngle;
  });

  return (
    <div className="flex items-center gap-6">
      <svg width="160" height="160" viewBox="0 0 160 160">
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="white" strokeWidth="2" />
        ))}
        {/* Center hole */}
        <circle cx={cx} cy={cy} r={r * 0.55} fill="white" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="text-xl font-bold" fill="#1e293b" fontSize="20" fontWeight="700">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize="10">contacts</text>
      </svg>
      <div className="space-y-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-sm text-slate-700">{s.label}</span>
            <span className="text-sm font-semibold text-slate-900 ml-auto pl-4">{s.value}</span>
            <span className="text-xs text-slate-400">({Math.round((s.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBar({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-28 flex-shrink-0 text-right">{label}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
            <div
              className="h-6 rounded-full flex items-center justify-end pr-2 transition-all"
              style={{ width: `${Math.max((value / max) * 100, value > 0 ? 8 : 0)}%`, backgroundColor: color || '#6366f1' }}
            >
              {value > 0 && <span className="text-white text-xs font-semibold">{value}</span>}
            </div>
          </div>
          {value === 0 && <span className="text-xs text-slate-400">0</span>}
        </div>
      ))}
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map(({ label, value }) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-slate-600">{value > 0 ? value : ''}</span>
          <div
            className="w-full bg-indigo-500 rounded-t-lg transition-all hover:bg-indigo-600"
            style={{ height: `${Math.max((value / max) * 120, value > 0 ? 8 : 2)}px` }}
          />
          <span className="text-xs text-slate-400 text-center leading-tight">{label}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, iconBg }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${iconBg}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function Reports() {
  const [contacts, setContacts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getContacts(), api.getTasks(), api.getOpportunities()])
      .then(([c, t, o]) => {
        setContacts(c);
        setTasks(t);
        setOpportunities(o);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Status distribution
  const statusCounts = {};
  contacts.forEach(c => {
    const s = c.custom_data?.statut || c.custom_data?.status || 'Inactif';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  const statusData = Object.entries(statusCounts).map(([label, value]) => ({
    label,
    value,
    color: STATUS_COLORS[label] || '#94a3b8',
  }));

  // Pipeline by stage
  const stageCounts = {};
  opportunities.forEach(o => {
    stageCounts[o.stage] = (stageCounts[o.stage] || 0) + 1;
  });
  const stageData = ['Prospect', 'Qualifié', 'Proposition', 'Négociation', 'Gagné', 'Fermé perdu'].map(stage => ({
    label: stage,
    value: stageCounts[stage] || 0,
    color: STAGE_COLORS_HEX[stage],
  }));

  // Tasks stats
  const doneTasks = tasks.filter(t => t.done).length;
  const pendingTasks = tasks.filter(t => !t.done).length;

  // Contacts added per month (last 6 months)
  const now = new Date();
  const monthData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toLocaleDateString('fr-FR', { month: 'short' });
    const count = contacts.filter(c => {
      const cd = new Date(c.created_at);
      return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
    }).length;
    monthData.push({ label: month, value: count });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Rapports</h1>
        <p className="text-slate-500 text-sm mt-1">Analyse de votre activité CRM</p>
      </div>

      {/* Task stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={CheckSquare} label="Tâches terminées" value={doneTasks} iconBg="bg-emerald-500" />
        <StatCard icon={CheckSquare} label="Tâches en attente" value={pendingTasks} iconBg="bg-amber-500" />
        <StatCard icon={TrendingUp} label="Opportunités actives" value={opportunities.filter(o => o.stage !== 'Fermé perdu' && o.stage !== 'Gagné').length} iconBg="bg-indigo-500" />
        <StatCard
          icon={TrendingUp}
          label="Pipeline total"
          value={`${opportunities.filter(o => o.stage !== 'Fermé perdu').reduce((s, o) => s + (o.value || 0), 0).toLocaleString('fr-FR')} €`}
          iconBg="bg-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Donut chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900 text-sm">Contacts par statut</h2>
          </div>
          {contacts.length > 0 ? (
            <DonutChart data={statusData} total={contacts.length} />
          ) : (
            <p className="text-center text-slate-400 text-sm py-8">Aucun contact</p>
          )}
        </div>

        {/* Pipeline by stage */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900 text-sm">Pipeline par étape</h2>
          </div>
          {opportunities.length > 0 ? (
            <HorizontalBar data={stageData} />
          ) : (
            <p className="text-center text-slate-400 text-sm py-8">Aucune opportunité</p>
          )}
        </div>
      </div>

      {/* Contacts per month */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900 text-sm">Contacts ajoutés par mois (6 derniers mois)</h2>
        </div>
        {contacts.length > 0 ? (
          <BarChart data={monthData} />
        ) : (
          <p className="text-center text-slate-400 text-sm py-8">Aucune donnée</p>
        )}
      </div>
    </div>
  );
}
