import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import { X, Plus, Phone, Mail, Users, Check, Trash2, MoreVertical } from 'lucide-react';

const STAGES = ['Prospect', 'Qualifié', 'Proposition', 'Négociation', 'Gagné', 'Fermé perdu'];
const INTERACTION_TYPES = ['Email', 'Appel', 'Réunion', 'LinkedIn', 'Autre'];

const STAGE_BADGE = {
  Prospect: 'bg-slate-100 text-slate-700',
  Qualifié: 'bg-blue-100 text-blue-700',
  Proposition: 'bg-indigo-100 text-indigo-700',
  Négociation: 'bg-amber-100 text-amber-700',
  Gagné: 'bg-emerald-100 text-emerald-700',
  'Fermé perdu': 'bg-red-100 text-red-700',
};

const INTERACTION_ICON = {
  Appel: { icon: Phone, color: 'bg-emerald-100 text-emerald-600' },
  Email: { icon: Mail, color: 'bg-blue-100 text-blue-600' },
  Réunion: { icon: Users, color: 'bg-violet-100 text-violet-600' },
  LinkedIn: { icon: Users, color: 'bg-sky-100 text-sky-600' },
  Autre: { icon: Users, color: 'bg-slate-100 text-slate-600' },
};

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-pink-500', 'bg-rose-500',
  'bg-amber-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-blue-500',
];
function avatarColor(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

export default function ContactDetail({ contact, fields, onClose, onUpdated }) {
  const [tab, setTab] = useState('info');
  const [interactions, setInteractions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [editData, setEditData] = useState({ ...contact.custom_data });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef();

  const [newInt, setNewInt] = useState({ type: 'Email', date: new Date().toISOString().split('T')[0], notes: '' });
  const [addingInt, setAddingInt] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', due_date: '', description: '' });
  const [addingTask, setAddingTask] = useState(false);
  const [newOpp, setNewOpp] = useState({ title: '', value: '', stage: 'Prospect', notes: '' });
  const [addingOpp, setAddingOpp] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getContactInteractions(contact.id),
      api.getContactTasks(contact.id),
      api.getOpportunities(),
    ]).then(([ints, ts, opps]) => {
      setInteractions(ints);
      setTasks(ts);
      setOpportunities(opps.filter(o => o.contact_id === contact.id));
    });
  }, [contact.id]);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function saveInfo() {
    setSaving(true);
    try {
      await api.updateContact(contact.id, { custom_data: editData });
      setDirty(false);
      if (onUpdated) onUpdated();
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact() {
    if (!window.confirm('Supprimer ce contact ?')) return;
    await api.deleteContact(contact.id);
    if (onUpdated) onUpdated();
    onClose();
  }

  async function submitInteraction() {
    if (!newInt.notes.trim()) return;
    const created = await api.createContactInteraction(contact.id, newInt);
    setInteractions(prev => [created, ...prev]);
    setNewInt({ type: 'Email', date: new Date().toISOString().split('T')[0], notes: '' });
    setAddingInt(false);
  }

  async function submitTask() {
    if (!newTask.title.trim()) return;
    const created = await api.createContactTask(contact.id, newTask);
    setTasks(prev => [...prev, created]);
    setNewTask({ title: '', due_date: '', description: '' });
    setAddingTask(false);
  }

  async function toggleTask(task) {
    const updated = await api.updateTask(task.id, { done: !task.done });
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
  }

  async function submitOpp() {
    if (!newOpp.title.trim()) return;
    const created = await api.createOpportunity({ ...newOpp, contact_id: contact.id, value: parseFloat(newOpp.value) || 0 });
    setOpportunities(prev => [...prev, created]);
    setNewOpp({ title: '', value: '', stage: 'Prospect', notes: '' });
    setAddingOpp(false);
  }

  const displayName = editData?.name || contact.custom_data?.name || `Contact #${contact.id}`;
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-[520px] flex-shrink-0 bg-white shadow-2xl flex flex-col h-full animate-fadein">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl ${avatarColor(displayName)} flex items-center justify-center text-white text-lg font-bold flex-shrink-0`}>
              {initials(displayName)}
            </div>
            <div className="flex-1 min-w-0">
              <input
                className="text-lg font-bold text-slate-900 bg-transparent border-0 outline-none w-full focus:ring-2 focus:ring-indigo-300 rounded px-1 -ml-1"
                value={editData?.name || ''}
                onChange={e => { setEditData(p => ({ ...p, name: e.target.value })); setDirty(true); }}
                placeholder="Nom du contact"
              />
              <p className="text-sm text-slate-500 mt-0.5 px-1">{editData?.company || ''}</p>
            </div>
            <div className="flex items-center gap-1">
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 w-44 py-1 animate-fadein">
                    <button
                      onClick={deleteContact}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer contact
                    </button>
                    <button
                      onClick={() => { api.exportCSV(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Exporter contact
                    </button>
                  </div>
                )}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-4 overflow-x-auto scrollbar-thin">
          <TabButton active={tab === 'info'} onClick={() => setTab('info')}>Informations</TabButton>
          <TabButton active={tab === 'interactions'} onClick={() => setTab('interactions')}>
            Interactions{interactions.length > 0 ? ` (${interactions.length})` : ''}
          </TabButton>
          <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')}>
            Tâches{tasks.length > 0 ? ` (${tasks.length})` : ''}
          </TabButton>
          <TabButton active={tab === 'opportunities'} onClick={() => setTab('opportunities')}>
            Opportunités{opportunities.length > 0 ? ` (${opportunities.length})` : ''}
          </TabButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Info tab */}
          {tab === 'info' && (
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4">
                {fields.map(field => {
                  const val = editData?.[field.name];
                  return (
                    <div key={field.name} className="col-span-1">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{field.label}</p>
                      {field.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={!!(val === true || val === 'true' || val === 1)}
                          onChange={e => { setEditData(p => ({ ...p, [field.name]: e.target.checked })); setDirty(true); }}
                          className="w-4 h-4 accent-indigo-600"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={val || ''}
                          onChange={e => { setEditData(p => ({ ...p, [field.name]: e.target.value })); setDirty(true); }}
                          className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        >
                          <option value="">—</option>
                          {(() => {
                            try {
                              const opts = JSON.parse(field.options || '[]');
                              return opts.map(o => {
                                const label = typeof o === 'string' ? o : o.label;
                                return <option key={label} value={label}>{label}</option>;
                              });
                            } catch { return null; }
                          })()}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                          value={val || ''}
                          onChange={e => { setEditData(p => ({ ...p, [field.name]: e.target.value })); setDirty(true); }}
                          className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          placeholder="—"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Créé le {new Date(contact.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              {dirty && (
                <div className="mt-4 flex gap-2 animate-fadein">
                  <button
                    onClick={saveInfo}
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button
                    onClick={() => { setEditData({ ...contact.custom_data }); setDirty(false); }}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Interactions tab */}
          {tab === 'interactions' && (
            <div className="p-5 space-y-4">
              <button
                onClick={() => setAddingInt(!addingInt)}
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Ajouter une interaction
              </button>

              {addingInt && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3 animate-fadein">
                  <div className="flex gap-2">
                    <select
                      value={newInt.type}
                      onChange={e => setNewInt(p => ({ ...p, type: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                    >
                      {INTERACTION_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <input
                      type="date"
                      value={newInt.date}
                      onChange={e => setNewInt(p => ({ ...p, date: e.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                    />
                  </div>
                  <textarea
                    autoFocus
                    value={newInt.notes}
                    onChange={e => setNewInt(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Notes sur l'interaction..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none bg-white"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setAddingInt(false)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-white">Annuler</button>
                    <button onClick={submitInteraction} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Sauvegarder</button>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="relative">
                {interactions.length > 0 && <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100" />}
                <div className="space-y-4">
                  {interactions.map(int => {
                    const cfg = INTERACTION_ICON[int.type] || INTERACTION_ICON.Autre;
                    const Icon = cfg.icon;
                    return (
                      <div key={int.id} className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${cfg.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-600">{int.type}</span>
                            <span className="text-xs text-slate-400">{int.date}</span>
                          </div>
                          <p className="text-sm text-slate-700">{int.notes}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {interactions.length === 0 && !addingInt && (
                <div className="text-center py-10 text-slate-400 text-sm">
                  <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Aucune interaction enregistrée
                </div>
              )}
            </div>
          )}

          {/* Tasks tab */}
          {tab === 'tasks' && (
            <div className="p-5 space-y-3">
              <button
                onClick={() => setAddingTask(!addingTask)}
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Ajouter une tâche
              </button>

              {addingTask && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3 animate-fadein">
                  <input
                    autoFocus
                    type="text"
                    value={newTask.title}
                    onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="Titre de la tâche"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                  />
                  <input
                    type="date"
                    value={newTask.due_date}
                    onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                  />
                  <textarea
                    value={newTask.description}
                    onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description (optionnel)"
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none bg-white"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setAddingTask(false)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-white">Annuler</button>
                    <button onClick={submitTask} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Sauvegarder</button>
                  </div>
                </div>
              )}

              {tasks.map(task => {
                const isOverdue = !task.done && task.due_date && task.due_date < today;
                return (
                  <div key={task.id} className={`flex items-start gap-3 p-3 border rounded-xl ${task.done ? 'border-slate-100 opacity-60' : isOverdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                    <button
                      onClick={() => toggleTask(task)}
                      className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        task.done ? 'bg-emerald-500 border-emerald-500' : isOverdue ? 'border-red-400 hover:border-red-500' : 'border-slate-300 hover:border-indigo-400'
                      }`}
                    >
                      {task.done && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
                      {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}
                      {task.due_date && (
                        <p className={`text-xs mt-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                          {isOverdue ? 'En retard · ' : 'Échéance : '}{task.due_date}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {tasks.length === 0 && !addingTask && (
                <div className="text-center py-10 text-slate-400 text-sm">Aucune tâche pour ce contact</div>
              )}
            </div>
          )}

          {/* Opportunities tab */}
          {tab === 'opportunities' && (
            <div className="p-5 space-y-3">
              <button
                onClick={() => setAddingOpp(!addingOpp)}
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Ajouter une opportunité
              </button>

              {addingOpp && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3 animate-fadein">
                  <input
                    autoFocus
                    type="text"
                    value={newOpp.title}
                    onChange={e => setNewOpp(p => ({ ...p, title: e.target.value }))}
                    placeholder="Titre de l'opportunité"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newOpp.value}
                      onChange={e => setNewOpp(p => ({ ...p, value: e.target.value }))}
                      placeholder="Valeur (€)"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                    />
                    <select
                      value={newOpp.stage}
                      onChange={e => setNewOpp(p => ({ ...p, stage: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                    >
                      {STAGES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <textarea
                    value={newOpp.notes}
                    onChange={e => setNewOpp(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Notes"
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none bg-white"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setAddingOpp(false)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-white">Annuler</button>
                    <button onClick={submitOpp} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Sauvegarder</button>
                  </div>
                </div>
              )}

              {opportunities.map(opp => (
                <div key={opp.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-slate-900">{opp.title}</p>
                    {opp.value > 0 && (
                      <span className="text-indigo-600 font-bold text-base flex-shrink-0">{opp.value?.toLocaleString('fr-FR')} €</span>
                    )}
                  </div>
                  <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_BADGE[opp.stage] || 'bg-slate-100 text-slate-600'}`}>
                    {opp.stage}
                  </span>
                  {opp.notes && <p className="text-xs text-slate-500 mt-2">{opp.notes}</p>}
                </div>
              ))}

              {opportunities.length === 0 && !addingOpp && (
                <div className="text-center py-10 text-slate-400 text-sm">Aucune opportunité pour ce contact</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
