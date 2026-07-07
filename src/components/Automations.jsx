import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Plus, Play, Zap, Trash2, ToggleLeft, ToggleRight, Eye, X, ChevronDown, ChevronUp, AlertCircle, Check } from 'lucide-react';

const ACTION_LABELS = { email: '📧 Email', whatsapp: '💬 WhatsApp' };

const STATUT_OPTIONS = ['Lead', 'Prospect', 'Client', 'Inactif'];

function AutomationModal({ automation, templates, onClose, onSave }) {
  const [form, setForm] = useState({
    name: automation?.name || '',
    trigger_statut: automation?.trigger_statut || '',
    trigger_days_inactive: automation?.trigger_days_inactive ?? 30,
    action_type: automation?.action_type || 'email',
    template_id: automation?.template_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Le nom est requis'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        trigger_statut: form.trigger_statut || null,
        trigger_days_inactive: parseInt(form.trigger_days_inactive) || 0,
        template_id: form.template_id ? parseInt(form.template_id) : null,
      };
      if (automation) {
        const r = await api.updateAutomation(automation.id, payload);
        onSave(r);
      } else {
        const r = await api.createAutomation(payload);
        onSave(r);
      }
      onClose();
    } catch (err) { setError(err.message || 'Erreur'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">{automation ? 'Modifier' : 'Nouvelle automatisation'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nom *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Relance prospects inactifs…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Déclencheur</p>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Statut du contact</label>
              <select
                value={form.trigger_statut}
                onChange={e => setForm(f => ({ ...f, trigger_statut: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">— Tous les statuts —</option>
                {STATUT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Inactif depuis (jours)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={form.trigger_days_inactive}
                  onChange={e => setForm(f => ({ ...f, trigger_days_inactive: e.target.value }))}
                  className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <span className="text-xs text-slate-400">jours sans interaction (0 = ignorer)</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-indigo-50 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</p>
            <div className="flex gap-2">
              {['email', 'whatsapp'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, action_type: t }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.action_type === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {ACTION_LABELS[t]}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Modèle de message</label>
              <select
                value={form.template_id}
                onChange={e => setForm(f => ({ ...f, template_id: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">— Aucun modèle —</option>
                {templates.filter(t => t.type === form.action_type).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14}/>{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? '…' : automation ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SimulatePanel({ automation, onClose }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.simulateAutomation(automation.id)
      .then(setResult)
      .catch(e => setResult({ error: e.message }))
      .finally(() => setLoading(false));
  }, [automation.id]);

  return (
    <div className="mt-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-indigo-800">Simulation</span>
        <button onClick={onClose} className="text-indigo-400 hover:text-indigo-600"><X size={14}/></button>
      </div>
      {loading && <div className="text-sm text-indigo-600">Analyse en cours…</div>}
      {result?.error && <div className="text-sm text-red-600">{result.error}</div>}
      {result && !result.error && (
        <>
          <p className="text-sm text-indigo-900 font-medium mb-2">
            {result.count === 0 ? 'Aucun contact ne correspond à ce déclencheur.' : `${result.count} contact${result.count !== 1 ? 's' : ''} ciblé${result.count !== 1 ? 's' : ''}`}
          </p>
          {result.contacts?.length > 0 && (
            <div className="space-y-1">
              {result.contacts.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-xs text-indigo-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0"/>
                  <span className="font-medium">{c.nom}</span>
                  {c.email && <span className="text-indigo-400">{c.email}</span>}
                  {c.statut && <span className="px-1.5 py-0.5 bg-indigo-200 text-indigo-700 rounded-full">{c.statut}</span>}
                </div>
              ))}
              {result.count > result.contacts.length && (
                <p className="text-xs text-indigo-400">… et {result.count - result.contacts.length} autres</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AutomationCard({ automation, templates, onUpdate, onDelete }) {
  const [showSimulate, setShowSimulate] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [editing, setEditing] = useState(false);

  const template = templates.find(t => t.id === automation.template_id);

  async function toggleActive() {
    const updated = await api.updateAutomation(automation.id, { active: automation.active ? 0 : 1 });
    onUpdate(updated);
  }

  async function run() {
    if (!confirm(`Lancer "${automation.name}" maintenant ?`)) return;
    setRunning(true); setRunResult(null);
    try {
      const r = await api.runAutomation(automation.id);
      setRunResult(r);
    } catch (e) { setRunResult({ error: e.message }); }
    finally { setRunning(false); }
  }

  return (
    <>
      <div className={`bg-white rounded-xl border shadow-sm p-5 transition-all ${automation.active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={15} className={automation.active ? 'text-indigo-500' : 'text-slate-300'} />
              <h3 className="font-semibold text-slate-900 truncate">{automation.name}</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              {automation.trigger_statut && (
                <span className="px-2 py-0.5 bg-slate-100 rounded-full">Statut : <b>{automation.trigger_statut}</b></span>
              )}
              {automation.trigger_days_inactive > 0 && (
                <span className="px-2 py-0.5 bg-slate-100 rounded-full">Inactif &gt; <b>{automation.trigger_days_inactive}j</b></span>
              )}
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">{ACTION_LABELS[automation.action_type]}</span>
              {template && <span className="px-2 py-0.5 bg-slate-100 rounded-full">📄 {template.name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={toggleActive} title={automation.active ? 'Désactiver' : 'Activer'}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
              {automation.active ? <ToggleRight size={20} className="text-indigo-600"/> : <ToggleLeft size={20}/>}
            </button>
            <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 text-xs font-medium px-2">Modifier</button>
            <button onClick={() => onDelete(automation.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500">
              <Trash2 size={15}/>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowSimulate(!showSimulate); setRunResult(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Eye size={13}/> Simuler
            {showSimulate ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
          </button>
          <button
            onClick={run}
            disabled={running || !automation.active}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors font-medium"
          >
            <Play size={13}/> {running ? 'En cours…' : 'Lancer'}
          </button>
          {runResult && !runResult.error && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <Check size={13}/> {runResult.message}
            </span>
          )}
          {runResult?.error && (
            <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={13}/> {runResult.error}</span>
          )}
        </div>

        {showSimulate && <SimulatePanel automation={automation} onClose={() => setShowSimulate(false)} />}
      </div>

      {editing && (
        <AutomationModal
          automation={automation}
          templates={templates}
          onClose={() => setEditing(false)}
          onSave={updated => { onUpdate(updated); setEditing(false); }}
        />
      )}
    </>
  );
}

export default function Automations() {
  const [automations, setAutomations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    Promise.all([api.getAutomations(), api.getTemplates()])
      .then(([auts, tmps]) => { setAutomations(auts); setTemplates(tmps); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleCreate(auto) {
    setAutomations(prev => [auto, ...prev]);
  }

  function handleUpdate(updated) {
    setAutomations(prev => prev.map(a => a.id === updated.id ? updated : a));
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette automatisation ?')) return;
    await api.deleteAutomation(id);
    setAutomations(prev => prev.filter(a => a.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="text-indigo-500" size={24}/> Automatisations
          </h1>
          <p className="text-slate-500 text-sm mt-1">Envoyez automatiquement des relances aux contacts selon leur statut et activité.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus size={16}/> Nouvelle règle
        </button>
      </div>

      {/* Info box */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex gap-3">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5"/>
        <div>
          <b>Comment ça marche :</b> Créez une règle avec un déclencheur (statut du contact + nombre de jours sans interaction) et une action (envoyer un email ou WhatsApp via un modèle). Cliquez <b>Simuler</b> pour voir les contacts concernés, puis <b>Lancer</b> pour déclencher les envois.
        </div>
      </div>

      {automations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
          <Zap size={40} className="mx-auto mb-3 text-slate-200"/>
          <p className="text-slate-500 font-medium">Aucune automatisation</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Créez votre première règle de relance automatique</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Créer une règle
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {automations.map(a => (
            <AutomationCard
              key={a.id}
              automation={a}
              templates={templates}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <AutomationModal
          templates={templates}
          onClose={() => setShowCreate(false)}
          onSave={auto => { handleCreate(auto); setShowCreate(false); }}
        />
      )}
    </div>
  );
}
