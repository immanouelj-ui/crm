import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import {
  ChevronLeft, Phone, Mail, Building2, Calendar, Clock,
  TrendingUp, CheckSquare, MoreVertical, Trash2, Plus, Check,
  X, User, FileText, Users, Edit3, MessageSquare, Receipt, FilePlus2, CalendarDays,
} from 'lucide-react';
import SendMessageModal from './SendMessageModal.jsx';
import Attachments from './Attachments.jsx';
import { Paperclip } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysAgo(d) {
  if (!d) return null;
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return 'hier';
  return `il y a ${diff} j`;
}

const STATUS_BADGE = {
  Lead: 'bg-purple-100 text-purple-700',
  Prospect: 'bg-blue-100 text-blue-700',
  Client: 'bg-emerald-100 text-emerald-700',
  Inactif: 'bg-slate-100 text-slate-600',
};

// ─── Deal Stage Progress Bar ─────────────────────────────────────────────────

const STAGES = ['Prospect', 'Qualification', 'Proposition', 'Négociation', 'Gagné', 'Perdu'];
const STAGE_IDX = { Prospect: 0, Qualification: 1, Proposition: 2, Négociation: 3, Gagné: 4, Perdu: 5 };

function DealProgress({ stage }) {
  const idx = STAGE_IDX[stage] ?? 0;
  const isLost = stage === 'Perdu';
  const isWon = stage === 'Gagné';
  return (
    <div className="flex gap-0.5 mt-2">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${
            isLost ? 'bg-red-300' :
            isWon ? 'bg-emerald-400' :
            i <= idx ? 'bg-indigo-500' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Editable Field ──────────────────────────────────────────────────────────

function parseOptions(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    return arr.map(o => (typeof o === 'string' ? { label: o } : o));
  } catch { return []; }
}

const FIELD_ICON = { email: Mail, phone: Phone, company: Building2 };

function EditableField({ label, value, fieldDef, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? '');
  const inputRef = useRef();
  const type = fieldDef?.type || 'text';
  const Icon = FIELD_ICON[fieldDef?.name] || FIELD_ICON[type] || null;

  useEffect(() => { setVal(value ?? ''); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  function handleBlur() {
    setEditing(false);
    if (val !== (value ?? '')) onSave(val);
  }

  function handleKey(e) {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') { setVal(value ?? ''); setEditing(false); }
  }

  const href = type === 'email' && value ? `mailto:${value}`
    : type === 'phone' && value ? `tel:${value}` : null;

  if (type === 'select') {
    const options = parseOptions(fieldDef?.options);
    return (
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <select
          value={val}
          onChange={e => { setVal(e.target.value); onSave(e.target.value); }}
          className="w-full text-sm text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-white"
        >
          <option value="">—</option>
          {options.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (type === 'checkbox') {
    return (
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <input
          type="checkbox"
          checked={!!(val === true || val === 'true' || val === 1 || val === '1')}
          onChange={e => { setVal(e.target.checked); onSave(e.target.checked); }}
          className="w-4 h-4 accent-indigo-600"
        />
      </div>
    );
  }

  if (type === 'text' && fieldDef?.name === 'notes') {
    return (
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <textarea
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => { if (val !== (value ?? '')) onSave(val); }}
          placeholder="—"
          rows={4}
          className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 placeholder:text-slate-300"
        />
      </div>
    );
  }

  const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'email' ? 'email' : 'text';

  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <div
        className={`group relative flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors ${editing ? 'bg-white border border-indigo-300 ring-2 ring-indigo-100' : 'hover:bg-slate-50 cursor-text'}`}
        onClick={() => !editing && setEditing(true)}
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
        {editing ? (
          <input
            ref={inputRef}
            type={inputType}
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKey}
            className="flex-1 text-sm text-slate-900 bg-transparent outline-none"
          />
        ) : (
          <span className="flex-1 text-sm text-slate-900">
            {value
              ? href
                ? <a href={href} className="text-indigo-600 hover:underline" onClick={e => e.stopPropagation()}>{value}</a>
                : String(value)
              : <span className="text-slate-300">—</span>
            }
          </span>
        )}
        {!editing && type === 'phone' && value && (
          <button
            onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('crm:call-number', { detail: { number: value } })); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 rounded-md hover:bg-indigo-100"
            title="Appeler via Twilio"
          >
            <Phone className="w-3.5 h-3.5 text-indigo-500" />
          </button>
        )}
        {!editing && <Edit3 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
      </div>
    </div>
  );
}

// ─── Activity Composer ────────────────────────────────────────────────────────

const TABS = [
  { id: 'note', label: 'Note', icon: FileText, placeholder: 'Ajouter une note...', color: 'slate' },
  { id: 'email', label: 'Email', icon: Mail, placeholder: "Résumé de l'email...", color: 'blue' },
  { id: 'appel', label: 'Appel', icon: Phone, placeholder: "Notes de l'appel...", color: 'emerald' },
  { id: 'reunion', label: 'Réunion', icon: Users, placeholder: 'Notes de la réunion...', color: 'violet' },
];

const TAB_ACTIVE = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  violet: 'bg-violet-50 text-violet-700',
};

function ActivityComposer({ contactId, onCreated }) {
  const [tab, setTab] = useState('note');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const currentTab = TABS.find(t => t.id === tab);

  async function submit() {
    if (!notes.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const interaction = await api.createContactInteraction(contactId, {
        type: tab,
        date,
        notes: notes.trim(),
      });
      setNotes('');
      onCreated(interaction);
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 shadow-sm bg-white mb-6">
      {/* Tab bar */}
      <div className="flex gap-1 p-3 border-b border-slate-100">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active ? TAB_ACTIVE[t.color] : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      {/* Textarea */}
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder={currentTab.placeholder}
        rows={3}
        className="w-full px-4 py-3 text-sm text-slate-800 resize-none outline-none placeholder:text-slate-300 bg-transparent"
      />
      {/* Footer */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
        />
        <div className="flex-1" />
        <button
          onClick={submit}
          disabled={!notes.trim() || saving}
          className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
      {error && (
        <div className="mx-4 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

const TYPE_META = {
  note:     { label: 'Note',      iconBg: 'bg-slate-500',    textColor: 'text-slate-700' },
  email:    { label: 'Email',     iconBg: 'bg-blue-500',     textColor: 'text-blue-700' },
  whatsapp: { label: 'WhatsApp',  iconBg: 'bg-[#25D366]',   textColor: 'text-[#25D366]' },
  appel:    { label: 'Appel',     iconBg: 'bg-emerald-500',  textColor: 'text-emerald-700' },
  reunion:  { label: 'Réunion',   iconBg: 'bg-violet-500',   textColor: 'text-violet-700' },
};

function TimelineInteraction({ item, onDelete }) {
  const [hover, setHover] = useState(false);
  const meta = TYPE_META[item.type] || TYPE_META.note;
  const Icon = item.type === 'email' ? Mail
    : item.type === 'whatsapp' ? MessageSquare
    : item.type === 'appel' ? Phone
    : item.type === 'reunion' ? Users : FileText;

  return (
    <div className="flex gap-3 relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* Icon circle */}
      <div className={`w-8 h-8 rounded-full ${meta.iconBg} flex items-center justify-center flex-shrink-0 z-10`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      {/* Card */}
      <div className="flex-1 mb-4">
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-semibold uppercase tracking-wide ${meta.textColor}`}>{meta.label}</span>
            {hover && onDelete && (
              <button onClick={() => onDelete(item.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {item.notes && <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.notes}</p>}
          <div className="flex items-center gap-2 mt-2">
            {item.user_name && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                <User className="w-3 h-3" />
                {item.user_name}
              </span>
            )}
            <span className="text-xs text-slate-400">
              {item.created_at
                ? new Date(item.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : fmtDate(item.date)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineTask({ item }) {
  const done = item.done;
  const Icon = CheckSquare;
  const today = new Date().toISOString().split('T')[0];
  const overdue = !done && item.due_date && item.due_date < today;

  return (
    <div className="flex gap-3 mb-4 relative">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${done ? 'bg-emerald-500' : 'bg-slate-200'}`}>
        <Icon className={`w-4 h-4 ${done ? 'text-white' : 'text-slate-500'}`} />
      </div>
      <div className="flex-1 rounded-xl border border-slate-100 bg-white shadow-sm px-4 py-3">
        <p className={`text-sm ${done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.title}</p>
        {item.due_date && (
          <p className={`text-xs mt-1 ${overdue ? 'text-red-500' : done ? 'text-slate-400' : 'text-slate-500'}`}>
            {overdue ? 'En retard · ' : ''}{fmtDate(item.due_date)}
          </p>
        )}
      </div>
    </div>
  );
}

function TimelineOpportunity({ item }) {
  return (
    <div className="flex gap-3 mb-4 relative">
      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 z-10">
        <TrendingUp className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 rounded-xl border border-slate-100 bg-white shadow-sm px-4 py-3">
        <p className="text-sm font-medium text-slate-900">{item.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.value != null && (
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {Number(item.value).toLocaleString('fr-FR')} €
            </span>
          )}
          {item.stage && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{item.stage}</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">{fmtDate(item.created_at)}</p>
      </div>
    </div>
  );
}

function TimelineCreated({ contact }) {
  return (
    <div className="flex gap-3 mb-4 relative">
      <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0 z-10">
        <User className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-500">Contact créé</p>
        <p className="text-xs text-slate-400 mt-0.5">{fmtDate(contact.created_at)}</p>
      </div>
    </div>
  );
}

// ─── Right Column: Deals ──────────────────────────────────────────────────────

function DealCard({ deal, onUpdate }) {
  const [editingStage, setEditingStage] = useState(false);
  const [stage, setStage] = useState(deal.stage);

  async function saveStage(newStage) {
    setStage(newStage);
    setEditingStage(false);
    await api.updateOpportunity(deal.id, { stage: newStage });
    onUpdate();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 mb-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 leading-tight">{deal.title}</p>
        {deal.value != null && (
          <span className="text-base font-bold text-indigo-600 flex-shrink-0">
            {Number(deal.value).toLocaleString('fr-FR')} €
          </span>
        )}
      </div>
      <DealProgress stage={stage} />
      <div className="mt-2">
        {editingStage ? (
          <select
            value={stage}
            onChange={e => saveStage(e.target.value)}
            onBlur={() => setEditingStage(false)}
            autoFocus
            className="text-xs border border-indigo-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200 w-full"
          >
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <button
            onClick={() => setEditingStage(true)}
            className="text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-full transition-colors"
          >
            {stage}
          </button>
        )}
      </div>
    </div>
  );
}

function AddDealForm({ contactId, onCreated, onCancel }) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState('Prospect');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const opp = await api.createOpportunity({
        contact_id: contactId,
        title: title.trim(),
        value: value ? parseFloat(value) : null,
        stage,
      });
      onCreated(opp);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 mb-3">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Titre de l'affaire"
        className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 mb-2 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
      />
      <div className="flex gap-2 mb-2">
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Valeur €"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
        />
        <select
          value={stage}
          onChange={e => setStage(e.target.value)}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
        >
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          Ajouter
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">
          Annuler
        </button>
      </div>
    </form>
  );
}

// ─── Right Column: Tasks ──────────────────────────────────────────────────────

function TaskItem({ task, onToggle }) {
  const today = new Date().toISOString().split('T')[0];
  const overdue = !task.done && task.due_date && task.due_date < today;

  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
      <button
        onClick={() => onToggle(task)}
        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
          task.done
            ? 'bg-emerald-500 border-emerald-500'
            : overdue
            ? 'border-red-400 hover:bg-red-50'
            : 'border-slate-300 hover:border-indigo-400'
        }`}
      >
        {task.done && <Check className="w-2.5 h-2.5 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${task.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {task.title}
        </p>
        {task.due_date && (
          <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
            {overdue ? 'En retard · ' : ''}{fmtDate(task.due_date)}
          </p>
        )}
      </div>
    </div>
  );
}

function AddTaskForm({ contactId, onCreated, onCancel }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const task = await api.createContactTask(contactId, {
        title: title.trim(),
        due_date: dueDate || null,
      });
      onCreated(task);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 mt-2">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Titre de la tâche"
        className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 mb-2 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
      />
      <input
        type="date"
        value={dueDate}
        onChange={e => setDueDate(e.target.value)}
        className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 mb-2 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          Ajouter
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">
          Annuler
        </button>
      </div>
    </form>
  );
}

// ─── Main ContactPage ─────────────────────────────────────────────────────────

// ─── RDV Modal ────────────────────────────────────────────────────────────────
function AppointmentModal({ contactId, contactName, onCreated, onClose }) {
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '09:30',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const appt = await api.createAppointment({ ...form, contact_id: contactId });
      onCreated(appt);
      onClose();
    } catch (err) { setError(err.message); setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800">Nouveau RDV — {contactName}</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
              <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))}
                placeholder="RDV commercial, Appel découverte…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
                <input type="time" value={form.start_time} onChange={e => setForm(f=>({...f,start_time:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
                <input type="time" value={form.end_time} onChange={e => setForm(f=>({...f,end_time:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}
                rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"/>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {loading ? '…' : 'Créer le RDV'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Mini RDV form (sidebar inline) ──────────────────────────────────────────
function AddAppointmentForm({ contactId, contactName, onCreated, onCancel }) {
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '09:30',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const appt = await api.createAppointment({ ...form, contact_id: contactId });
      onCreated(appt);
    } catch (err) { setError(err.message); setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="bg-slate-50 rounded-xl p-3 mb-3 space-y-2">
      <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))}
        placeholder="Titre du RDV" className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5"/>
      <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))}
        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5"/>
      <div className="flex gap-2">
        <input type="time" value={form.start_time} onChange={e => setForm(f=>({...f,start_time:e.target.value}))}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5"/>
        <input type="time" value={form.end_time} onChange={e => setForm(f=>({...f,end_time:e.target.value}))}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5"/>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Annuler</button>
        <button type="submit" disabled={loading} className="flex-1 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {loading ? '…' : 'Créer le RDV'}
        </button>
      </div>
    </form>
  );
}

export default function ContactPage({ contactId, onBack, onNavigate, onNewBillingDoc }) {
  const { user } = useAuth();
  const canMessage = user?.role === 'admin' || user?.permissions?.messaging !== false;
  const [contact, setContact] = useState(null);
  const [fields, setFields] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddAppt, setShowAddAppt] = useState(false); // inline sidebar form
  const [showApptModal, setShowApptModal] = useState(false); // modal (topbar button)
  const [showMenu, setShowMenu] = useState(false);
  const [sendModal, setSendModal] = useState(null); // null | { type: 'email'|'whatsapp' }

  const loadData = useCallback(async () => {
    const [contactList, fieldList, ints, ts, opps, appts] = await Promise.all([
      api.getContacts(),
      api.getFields(),
      api.getContactInteractions(contactId),
      api.getContactTasks(contactId),
      api.getOpportunities(),
      api.getContactAppointments(contactId),
    ]);
    const c = contactList.find(x => x.id === contactId);
    setContact(c);
    setFields(fieldList);
    setInteractions(ints);
    setTasks(ts);
    setOpportunities(opps.filter(o => o.contact_id === contactId));
    setAppointments(appts);
    setLoading(false);
  }, [contactId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveField(fieldName, value) {
    if (!contact) return;
    const newData = { ...contact.custom_data, [fieldName]: value };
    const updated = await api.updateContact(contact.id, { custom_data: newData });
    setContact(prev => ({ ...prev, custom_data: updated.custom_data }));
  }

  async function toggleTask(task) {
    // Optimistic
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
    try {
      await api.updateTask(task.id, { done: !task.done });
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: task.done } : t));
    }
  }

  function handleInteractionCreated(interaction) {
    setInteractions(prev => [interaction, ...prev]);
  }

  function handleDeleteInteraction(id) {
    setInteractions(prev => prev.filter(i => i.id !== id));
    api.deleteInteraction(id).catch(() => loadData());
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Contact introuvable</p>
          <button onClick={onBack} className="text-indigo-600 hover:underline text-sm">← Retour</button>
        </div>
      </div>
    );
  }

  const cd = contact.custom_data || {};
  const name = cd.nom || cd.name || `Contact #${contact.id}`;
  const statusBadge = STATUS_BADGE[cd.statut] || STATUS_BADGE[cd.status] || 'bg-slate-100 text-slate-600';
  const statusVal = cd.statut || cd.status;

  // Last interaction date
  const lastInteraction = interactions.length > 0
    ? interactions.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b)
    : null;

  // Open tasks count
  const openTasksCount = tasks.filter(t => !t.done).length;

  // Total deal value
  const totalDealValue = opportunities.reduce((sum, o) => sum + (Number(o.value) || 0), 0);

  // Build timeline: combine interactions + tasks + opportunities + contact created
  const timelineItems = [];

  interactions.forEach(i => timelineItems.push({ _type: 'interaction', _date: new Date(i.date), ...i }));
  tasks.forEach(t => timelineItems.push({ _type: 'task', _date: new Date(t.created_at || t.due_date || Date.now()), ...t }));
  opportunities.forEach(o => timelineItems.push({ _type: 'opportunity', _date: new Date(o.created_at), ...o }));
  timelineItems.push({ _type: 'created', _date: new Date(contact.created_at) });

  timelineItems.sort((a, b) => b._date - a._date);

  // Only show fields that are visible in the grid (visible === 1)
  const visibleFields = fields.filter(f => f.visible === 1);
  const notesField = visibleFields.find(f => f.name === 'notes');
  const mainFields = visibleFields.filter(f => f.name !== 'notes');

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200 h-14 flex items-center px-6 gap-3 flex-shrink-0 z-10 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mr-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Contacts
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-900 truncate">{name}</span>

        <div className="flex-1" />

        {/* RDV button */}
        <button
          onClick={() => setShowApptModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-violet-50 text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          RDV
        </button>

        {/* Billing buttons */}
        {onNewBillingDoc && (
          <>
            <button
              onClick={() => onNewBillingDoc(contact, 'quote')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              Devis
            </button>
            <button
              onClick={() => onNewBillingDoc(contact, 'invoice')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Receipt className="w-3.5 h-3.5" />
              Facture
            </button>
          </>
        )}

        {/* Action buttons */}
        {(() => {
          const phoneField = fields.find(f => f.type === 'phone' || f.type === 'tel');
          const phoneVal = phoneField ? cd[phoneField.name] : (cd.phone || cd.telephone || cd.tel || '');
          return (
            <a
              href={phoneVal ? `tel:${phoneVal}` : undefined}
              title={phoneVal || 'Aucun numéro'}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg transition-colors ${phoneVal ? 'hover:bg-emerald-100 cursor-pointer' : 'opacity-40 cursor-not-allowed pointer-events-none'}`}
            >
              <Phone className="w-3.5 h-3.5" />
              {phoneVal ? `Appel · ${phoneVal}` : 'Appel'}
            </a>
          );
        })()}
        {canMessage && (
          <button
            onClick={() => setSendModal({ type: 'email' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Email
          </button>
        )}
        {canMessage && (
          <button
            onClick={() => setSendModal({ type: 'whatsapp' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#25D366]/10 text-[#1a9e4c] border border-[#25D366]/30 rounded-lg hover:bg-[#25D366]/20 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setShowMenu(m => !m)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-40 py-1">
              <button
                onClick={() => { setShowMenu(false); if (window.confirm('Supprimer ce contact ?')) { api.deleteContact(contact.id).then(onBack); } }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Hero header ── */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex-shrink-0">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className={`w-16 h-16 rounded-2xl ${avatarColor(name)} flex items-center justify-center text-white text-2xl font-bold flex-shrink-0`}>
            {initials(name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{name}</h1>
              {statusVal && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${statusBadge}`}>{statusVal}</span>
              )}
              {contact.updated_at && (
                <span className="text-xs text-slate-400">Modifié {daysAgo(contact.updated_at)}</span>
              )}
            </div>
            {(cd.poste || cd.company) && (
              <p className="text-sm text-slate-500 mt-0.5">
                {[cd.poste, cd.company].filter(Boolean).join(' · ')}
              </p>
            )}

            {/* Quick stats */}
            <div className="flex items-center gap-6 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Dernière interaction : </span>
                <span className="font-medium text-slate-700">{lastInteraction ? fmtDate(lastInteraction.date) : '—'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-700">{openTasksCount}</span>
                <span>tâche{openTasksCount !== 1 ? 's' : ''} ouverte{openTasksCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-700">{opportunities.length}</span>
                <span>affaire{opportunities.length !== 1 ? 's' : ''}</span>
              </div>
              {totalDealValue > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-semibold text-indigo-600">{totalDealValue.toLocaleString('fr-FR')} €</span>
                  <span>valeur totale</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3-column body ── */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── LEFT: Properties ── */}
        <div className="w-72 bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 px-5 py-5">

          {/* COORDONNÉES — dynamic from fields table, mirrors grid columns */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Coordonnées</p>

          {mainFields.map(field => (
            <EditableField
              key={field.name}
              label={field.label}
              value={cd[field.name]}
              fieldDef={field}
              onSave={v => saveField(field.name, v)}
            />
          ))}

          {notesField && (
            <>
              <div className="border-t border-slate-100 my-4" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">À propos</p>
              <EditableField
                label={notesField.label}
                value={cd[notesField.name]}
                fieldDef={notesField}
                onSave={v => saveField(notesField.name, v)}
              />
            </>
          )}

          <div className="border-t border-slate-100 my-4" />

          {/* DATES */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Dates</p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Créé le</p>
              <p className="text-sm text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {fmtDate(contact.created_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Dernière modification</p>
              <p className="text-sm text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {fmtDate(contact.updated_at)}
              </p>
            </div>
            {lastInteraction && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Dernière interaction</p>
                <p className="text-sm text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {fmtDate(lastInteraction.date)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: Timeline ── */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Activité</p>

          {/* Composer */}
          <ActivityComposer contactId={contactId} onCreated={handleInteractionCreated} />

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100 z-0" />

            {timelineItems.map((item, idx) => {
              if (item._type === 'interaction') {
                return (
                  <TimelineInteraction
                    key={`int-${item.id}`}
                    item={item}
                    onDelete={handleDeleteInteraction}
                  />
                );
              }
              if (item._type === 'task') {
                return <TimelineTask key={`task-${item.id}`} item={item} />;
              }
              if (item._type === 'opportunity') {
                return <TimelineOpportunity key={`opp-${item.id}`} item={item} />;
              }
              if (item._type === 'created') {
                return <TimelineCreated key="created" contact={contact} />;
              }
              return null;
            })}

            {timelineItems.length <= 1 && (
              <div className="ml-11 text-sm text-slate-400 italic">
                Aucune activité pour l'instant. Ajoutez une note ou une interaction ci-dessus.
              </div>
            )}
          </div>
        </div>

        {/* ── RDV modal (topbar button) ── */}
        {showApptModal && (
          <AppointmentModal
            contactId={contactId}
            contactName={name}
            onCreated={appt => {
              setAppointments(prev => [appt, ...prev]);
              api.getContactInteractions(contactId).then(setInteractions).catch(() => {});
            }}
            onClose={() => setShowApptModal(false)}
          />
        )}

        {/* ── Send message modal ── */}
        {sendModal && (
          <SendMessageModal
            contact={contact}
            fields={fields}
            type={sendModal.type}
            onClose={() => setSendModal(null)}
            onSent={() => { setSendModal(null); loadData(); }}
          />
        )}

        {/* ── RIGHT: Deals + Tasks ── */}
        <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto flex-shrink-0 px-5 py-5">

          {/* AFFAIRES */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Affaires</p>
                {opportunities.length > 0 && (
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                    {opportunities.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAddDeal(true)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            </div>

            {showAddDeal && (
              <AddDealForm
                contactId={contactId}
                onCreated={opp => { setOpportunities(prev => [opp, ...prev]); setShowAddDeal(false); }}
                onCancel={() => setShowAddDeal(false)}
              />
            )}

            {opportunities.length === 0 && !showAddDeal && (
              <p className="text-xs text-slate-400 italic">Aucune affaire</p>
            )}

            {opportunities.map(deal => (
              <DealCard key={deal.id} deal={deal} onUpdate={loadData} />
            ))}
          </div>

          <div className="border-t border-slate-100 mb-6" />

          {/* TÂCHES */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Tâches</p>
                {openTasksCount > 0 && (
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                    {openTasksCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAddTask(true)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            </div>

            {tasks.map(task => (
              <TaskItem key={task.id} task={task} onToggle={toggleTask} />
            ))}

            {tasks.length === 0 && !showAddTask && (
              <p className="text-xs text-slate-400 italic">Aucune tâche</p>
            )}

            {showAddTask && (
              <AddTaskForm
                contactId={contactId}
                onCreated={task => { setTasks(prev => [...prev, task]); setShowAddTask(false); }}
                onCancel={() => setShowAddTask(false)}
              />
            )}
          </div>

          <div className="border-t border-slate-100 mb-6 mt-6" />

          {/* RDV */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">RDV</p>
                {appointments.filter(a => a.status !== 'cancelled').length > 0 && (
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                    {appointments.filter(a => a.status !== 'cancelled').length}
                  </span>
                )}
              </div>
              <button onClick={() => setShowAddAppt(true)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>

            {showAddAppt && (
              <AddAppointmentForm
                contactId={contactId}
                contactName={name}
                onCreated={appt => {
                  setAppointments(prev => [appt, ...prev]);
                  setShowAddAppt(false);
                  // Recharger les interactions pour afficher la note auto générée par le backend
                  api.getContactInteractions(contactId).then(setInteractions).catch(() => {});
                }}
                onCancel={() => setShowAddAppt(false)}
              />
            )}

            {appointments.length === 0 && !showAddAppt && (
              <p className="text-xs text-slate-400 italic">Aucun RDV</p>
            )}

            <div className="space-y-2">
              {appointments.map(appt => {
                const isPast = new Date(`${appt.date}T${appt.end_time}`) < new Date();
                const statusColor = appt.status === 'confirmed' ? 'border-indigo-200 bg-indigo-50' :
                  appt.status === 'pending' ? 'border-amber-200 bg-amber-50' :
                  'border-gray-200 bg-gray-50 opacity-60';
                const statusDot = appt.status === 'confirmed' ? 'bg-indigo-500' :
                  appt.status === 'pending' ? 'bg-amber-400' : 'bg-gray-400';
                return (
                  <div key={appt.id} className={`rounded-xl border p-2.5 ${statusColor}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${statusDot}`}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{appt.title || 'RDV'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(appt.date).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' })}
                          {' · '}{appt.start_time}–{appt.end_time}
                        </p>
                        {appt.status === 'pending' && <p className="text-xs text-amber-600 mt-0.5">En attente de confirmation</p>}
                        {isPast && appt.status === 'confirmed' && <p className="text-xs text-slate-400 mt-0.5">Passé</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 mb-6" />

          {/* PIÈCES JOINTES */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Pièces jointes</p>
            </div>
            <Attachments contactId={contactId} />
          </div>
        </div>
      </div>
    </div>
  );
}
