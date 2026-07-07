import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Plus, Check, Trash2, Calendar, AlertCircle, X, Search } from 'lucide-react';

const today = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

function getGroup(task) {
  if (!task.due_date) return 'later';
  if (task.due_date < today) return 'overdue';
  if (task.due_date === today) return 'today';
  if (task.due_date === tomorrow) return 'tomorrow';
  if (task.due_date <= weekEnd) return 'week';
  return 'later';
}

const GROUP_LABELS = {
  overdue: { label: 'En retard', cls: 'text-red-600' },
  today: { label: "Aujourd'hui", cls: 'text-amber-600' },
  tomorrow: { label: 'Demain', cls: 'text-slate-700' },
  week: { label: 'Cette semaine', cls: 'text-slate-600' },
  later: { label: 'Plus tard', cls: 'text-slate-500' },
};
const GROUP_ORDER = ['overdue', 'today', 'tomorrow', 'week', 'later'];

function TaskRow({ task, onToggle, onDelete, contacts }) {
  const isOverdue = getGroup(task) === 'overdue';
  const isToday = getGroup(task) === 'today';
  const contact = contacts.find(c => c.id === task.contact_id);
  const contactName = contact?.custom_data?.nom || contact?.custom_data?.name;

  return (
    <div className={`flex items-center gap-3 py-3 px-4 border-b border-slate-50 last:border-b-0 group hover:bg-slate-50/50 transition-colors ${task.done ? 'opacity-50' : ''}`}>
      <button
        onClick={() => onToggle(task)}
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          task.done
            ? 'bg-emerald-500 border-emerald-500'
            : isOverdue
            ? 'border-red-400 hover:bg-red-50'
            : isToday
            ? 'border-amber-400 hover:bg-amber-50'
            : 'border-slate-300 hover:border-indigo-400'
        }`}
      >
        {task.done && <Check className="w-3 h-3 text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.done ? 'line-through text-slate-400' : 'text-slate-900'}`}>
          {task.title}
        </p>
        {task.description && <p className="text-xs text-slate-400 truncate">{task.description}</p>}
      </div>

      {contactName && (
        <span className="text-xs text-slate-400 truncate max-w-[100px] flex-shrink-0">{contactName}</span>
      )}

      {task.due_date && (
        <div className={`flex items-center gap-1 text-xs flex-shrink-0 ${isOverdue ? 'text-red-500 font-medium' : isToday ? 'text-amber-600' : 'text-slate-400'}`}>
          {isOverdue && <AlertCircle className="w-3 h-3" />}
          <Calendar className="w-3 h-3" />
          <span>{task.due_date}</span>
        </div>
      )}

      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all flex-shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '', contact_id: '' });
  const [contactSearch, setContactSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.getTasks(), api.getContacts()]).then(([ts, cs]) => {
      setTasks(ts);
      setContacts(cs);
      setLoading(false);
    });
  }, []);

  async function toggleTask(task) {
    const updated = await api.updateTask(task.id, { done: !task.done });
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
  }

  async function deleteTask(id) {
    await api.deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function addTask() {
    if (!newTask.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: newTask.title,
        description: newTask.description,
        due_date: newTask.due_date || null,
        contact_id: newTask.contact_id || null,
      };
      const created = await api.createTask(payload);
      setTasks(prev => [...prev, created]);
      setNewTask({ title: '', description: '', due_date: '', contact_id: '' });
      setContactSearch('');
      setShowAddPanel(false);
    } finally {
      setSaving(false);
    }
  }

  const filterTabs = [
    { id: 'all', label: 'Toutes' },
    { id: 'today', label: "Aujourd'hui" },
    { id: 'overdue', label: 'En retard' },
    { id: 'week', label: 'Cette semaine' },
    { id: 'done', label: 'Terminées' },
  ];

  function filterTasks(t) {
    if (filter === 'done') return t.done;
    if (filter === 'today') return !t.done && t.due_date === today;
    if (filter === 'overdue') return !t.done && t.due_date && t.due_date < today;
    if (filter === 'week') return !t.done && t.due_date && t.due_date >= today && t.due_date <= weekEnd;
    return true; // all
  }

  const filtered = tasks.filter(filterTasks);
  const dueToday = tasks.filter(t => !t.done && t.due_date === today).length;
  const overdue = tasks.filter(t => !t.done && t.due_date && t.due_date < today).length;

  // Group tasks
  const grouped = {};
  if (filter === 'all' || filter === 'done') {
    filtered.forEach(t => {
      const g = t.done ? 'done' : getGroup(t);
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(t);
    });
  }

  const filteredContacts = contacts.filter(c => {
    const name = c.custom_data?.nom || c.custom_data?.name || '';
    return name.toLowerCase().includes(contactSearch.toLowerCase());
  }).slice(0, 5);

  const selectedContactName = newTask.contact_id
    ? (contacts.find(c => c.id === parseInt(newTask.contact_id))?.custom_data?.nom ||
       contacts.find(c => c.id === parseInt(newTask.contact_id))?.custom_data?.name)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 p-6 overflow-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Tâches</h1>
              <p className="text-slate-500 text-sm mt-1">
                {overdue > 0 && <span className="text-red-500 font-medium">{overdue} en retard · </span>}
                {dueToday > 0 && <span className="text-amber-600 font-medium">{dueToday} aujourd'hui · </span>}
                {tasks.filter(t => !t.done).length} à faire au total
              </p>
            </div>
            <button
              onClick={() => setShowAddPanel(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Nouvelle tâche
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
            {filterTabs.map(f => {
              let count = null;
              if (f.id === 'today') count = dueToday;
              if (f.id === 'overdue') count = overdue;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    filter === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={`text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold ${
                      f.id === 'overdue' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tasks */}
          {filter === 'all' || filter === 'done' ? (
            <div className="space-y-4">
              {GROUP_ORDER.concat(filter === 'done' ? ['done'] : []).map(group => {
                const items = grouped[group];
                if (!items || items.length === 0) return null;
                const cfg = GROUP_LABELS[group] || { label: group, cls: 'text-slate-500' };
                return (
                  <div key={group}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${cfg.cls}`}>{cfg.label}</p>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      {items.map(task => (
                        <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} contacts={contacts} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <EmptyState filter={filter} />
              )}
            </div>
          ) : (
            <div>
              {filtered.length > 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {filtered.map(task => (
                    <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} contacts={contacts} />
                  ))}
                </div>
              ) : (
                <EmptyState filter={filter} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add task panel */}
      {showAddPanel && (
        <div className="w-80 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col shadow-lg animate-fadein">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">Nouvelle tâche</h2>
            <button onClick={() => setShowAddPanel(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-4 flex-1 overflow-auto">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Titre *</label>
              <input
                autoFocus
                type="text"
                value={newTask.title}
                onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setShowAddPanel(false); }}
                placeholder="Titre de la tâche"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Description</label>
              <textarea
                value={newTask.description}
                onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                placeholder="Détails optionnels..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Échéance</label>
              <input
                type="date"
                value={newTask.due_date}
                onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Contact</label>
              {selectedContactName ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <span className="text-sm text-indigo-700 flex-1">{selectedContactName}</span>
                  <button onClick={() => { setNewTask(p => ({ ...p, contact_id: '' })); setContactSearch(''); }} className="text-indigo-400 hover:text-indigo-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    placeholder="Rechercher un contact..."
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                  />
                  {contactSearch && filteredContacts.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                      {filteredContacts.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setNewTask(p => ({ ...p, contact_id: c.id })); setContactSearch(''); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                        >
                          {c.custom_data?.nom || c.custom_data?.name || `Contact #${c.id}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
            <button
              onClick={() => setShowAddPanel(false)}
              className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={addTask}
              disabled={saving || !newTask.title.trim()}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saving ? '...' : 'Créer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ filter }) {
  const messages = {
    today: "Aucune tâche pour aujourd'hui",
    overdue: 'Aucune tâche en retard 🎉',
    week: 'Aucune tâche cette semaine',
    done: 'Aucune tâche terminée',
    all: 'Aucune tâche. Commencez par en créer une !',
  };
  return (
    <div className="text-center py-14 text-slate-400">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <Check className="w-6 h-6 text-slate-300" />
      </div>
      <p className="text-sm">{messages[filter] || 'Aucune tâche'}</p>
    </div>
  );
}
