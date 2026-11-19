import { groupContactFields, contactDisplayName } from '../lib/contactSections.js';
import { calendarDate } from '../lib/calendar.js';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import {
  ChevronLeft, Phone, Mail, Building2, Calendar, Clock,
  TrendingUp, CheckSquare, MoreVertical, Trash2, Plus, Check,
  X, User, FileText, Users, Edit3, MessageSquare, Receipt, FilePlus2, CalendarDays, Smartphone, Printer,
} from 'lucide-react';
import SendMessageModal from './SendMessageModal.jsx';
import Softphone from './Softphone.jsx';
import Attachments from './Attachments.jsx';
import InstallerAssignment from './InstallerAssignment.jsx';
import QontoContactButton from './QontoContactButton.jsx';
import ContactMap, { getBuildingAddress, GoogleMapsLink } from './ContactMap.jsx';
import { getPhotoUrls, isPhotosField } from '../lib/leadPhotos.js';
import { splitLeadNotes, updateLeadNotes } from '../lib/leadNotes.js';
import { Paperclip } from 'lucide-react';
import { triggerCall } from '../lib/call.js';
import { openReceptionPrint } from '../lib/receptionPrint.js';

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

function EditableField({ label, value, fieldDef, onSave, contactId }) {
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
            onClick={e => { e.stopPropagation(); triggerCall(value, contactId); }}
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
  sms:      { label: 'SMS',       iconBg: 'bg-orange-500',   textColor: 'text-orange-700' },
  reunion:  { label: 'Réunion',   iconBg: 'bg-violet-500',   textColor: 'text-violet-700' },
};

function TimelineInteraction({ item, onDelete }) {
  const [hover, setHover] = useState(false);
  const meta = TYPE_META[item.type] || TYPE_META.note;
  const Icon = item.type === 'email' ? Mail
    : item.type === 'whatsapp' ? MessageSquare
    : item.type === 'appel' ? Phone
    : item.type === 'sms' ? Smartphone
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
    date: calendarDate(new Date()),
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

export default function ContactPage({ contactId, onBack, onNavigate, onNewBillingDoc, onOpenPlanning }) {
  const { user } = useAuth();
  const canMessage = user?.role === 'admin' || user?.permissions?.messaging !== false;
  const [contact, setContact] = useState(null);
  const [fields, setFields] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [installers, setInstallers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [showPastAppointments, setShowPastAppointments] = useState(false);
  const [showApptModal, setShowApptModal] = useState(false); // modal (topbar button)
  const [showMenu, setShowMenu] = useState(false);
  const [sendModal, setSendModal] = useState(null); // null | { type: 'email'|'whatsapp' }

  const loadData = useCallback(async () => {
    const [contactList, fieldList, ints, appts] = await Promise.all([
      api.getContacts(),
      api.getFields(),
      api.getContactInteractions(contactId),
      api.getContactAppointments(contactId),
    ]);
    const c = contactList.find(x => x.id === contactId);
    setContact(c);
    const installerMap = new Map();
    for (const client of contactList) {
      const values = client.custom_data || {};
      if (values.installateur_nom && values.installateur_telephone) {
        installerMap.set(values.installateur_telephone, { name: values.installateur_nom, phone: values.installateur_telephone });
      }
    }
    setInstallers([...installerMap.values()]);
    setFields(fieldList);
    setInteractions(ints);
    setAppointments(appts);
    setLoading(false);
  }, [contactId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    function onCallLogged(e) {
      if (e.detail?.contactId === contactId) {
        api.getContactInteractions(contactId).then(setInteractions).catch(() => {});
      }
    }
    window.addEventListener('crm:call-logged', onCallLogged);
    return () => window.removeEventListener('crm:call-logged', onCallLogged);
  }, [contactId]);

  async function saveField(fieldName, value) {
    if (!contact) return;
    const newData = { ...contact.custom_data, [fieldName]: value };
    const updated = await api.updateContact(contact.id, { custom_data: newData });
    setContact(prev => ({ ...prev, custom_data: updated.custom_data }));
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
  const buildingAddress = getBuildingAddress(cd);
  const name = contactDisplayName(cd, contact.id);
  const statusBadge = STATUS_BADGE[cd.statut] || STATUS_BADGE[cd.status] || 'bg-slate-100 text-slate-600';
  const statusVal = cd.statut || cd.status;

  // Last interaction date
  const lastInteraction = interactions.length > 0
    ? interactions.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b)
    : null;

  // Contact activity timeline.
  const timelineItems = [];

  interactions.forEach(i => timelineItems.push({ _type: 'interaction', _date: new Date(i.date), ...i }));
  timelineItems.push({ _type: 'created', _date: new Date(contact.created_at) });

  timelineItems.sort((a, b) => b._date - a._date);

  // Only show fields that are visible in the grid (visible === 1)
  const visibleFields = fields.filter(f => f.visible === 1);
  const notesField = visibleFields.find(f => f.name === 'notes');
  const { summary: leadSummary, notes } = splitLeadNotes(cd.notes);
  const photoFields = fields.filter(field => isPhotosField(field) && getPhotoUrls(cd[field.name]).length);
  const leadPhotoUrls = getPhotoUrls([cd.photos, ...photoFields.map(field => cd[field.name])].flat());
  const mainFields = visibleFields.filter(field => field.name !== 'notes' && !isPhotosField(field));

  const groups = groupContactFields(mainFields);
  const phoneField = fields.find(field => ['phone','tel'].includes(field.type));
  const phone = cd[phoneField?.name] || cd.phone || cd.telephone || cd.tel || cd.mobile || '';
  const emailField = fields.find(field => field.type === 'email');
  const email = cd[emailField?.name] || cd.email || '';
  const upcoming = appointments.filter(a => a.status !== 'cancelled' && new Date(`${String(a.date).slice(0,10)}T${a.end_time}`) >= new Date()).sort((a,b) => String(a.date).localeCompare(String(b.date)) || a.start_time.localeCompare(b.start_time));
  const past = appointments.filter(a => !upcoming.some(item => item.id === a.id)).sort((a,b) => String(b.date).localeCompare(String(a.date)) || b.start_time.localeCompare(a.start_time));
  const renderFields = list => <div className="client-field-grid">{list.map(field => <EditableField key={field.name} label={field.label} value={cd[field.name]} fieldDef={field} onSave={value => saveField(field.name,value)} contactId={contactId}/>)}</div>;
  const printForm = () => { if (!openReceptionPrint(cd)) window.alert('Autorise l’ouverture du nouvel onglet pour imprimer le procès-verbal.'); };
  const appointmentCard = appt => <div key={appt.id} className={`client-appointment ${appt.status === 'cancelled' ? 'is-cancelled' : ''}`}>
    <div className="client-appointment-date"><strong>{Number(String(appt.date).slice(8,10))}</strong><span>{new Date(String(appt.date).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR',{month:'short'})}</span></div>
    <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900">{appt.title || 'Rendez-vous'}</p><p className="mt-1 text-xs text-slate-500">{new Date(String(appt.date).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long'})} · {appt.start_time.slice(0,5)} – {appt.end_time.slice(0,5)}</p><p className="mt-1 text-xs text-slate-400">{appt.status === 'pending' ? 'En attente de confirmation' : appt.status === 'cancelled' ? 'Annulé' : upcoming.includes(appt) ? 'Confirmé' : 'Passé'}</p>{onOpenPlanning && <button type="button" onClick={() => onOpenPlanning(String(appt.date).slice(0,10))} className="text-action mt-2 min-h-8">Voir dans le planning</button>}</div>
  </div>;

  return (
    <div className="client-record">
      <header className="client-record-topbar">
        <button type="button" onClick={onBack} className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ChevronLeft size={16}/>Contacts</button><span className="text-slate-300">/</span><span className="truncate text-sm font-medium">{name}</span>
        <div className="relative ml-auto shrink-0"><button type="button" aria-label="Options du contact" aria-expanded={showMenu} onClick={() => setShowMenu(value=>!value)} className="icon-control"><MoreVertical size={18}/></button>{showMenu&&<div className="absolute right-0 top-full z-30 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"><button type="button" onClick={() => { setShowMenu(false); if (window.confirm('Supprimer ce contact ?')) api.deleteContact(contact.id).then(onBack); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-red-600 hover:bg-red-50"><Trash2 size={15}/>Supprimer</button></div>}</div>
      </header>
      <div className="client-record-profile">
        <div className={`client-record-avatar ${avatarColor(name)}`}>{initials(name)}</div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h1>{name}</h1>{statusVal&&<span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${statusBadge}`}>{statusVal}</span>}</div><div className="client-record-details">{phone&&<a href={`tel:${phone}`}><Phone size={13}/>{phone}</a>}{email&&<a href={`mailto:${email}`}><Mail size={13}/>{email}</a>}{!phone&&!email&&<span>Renseignez les coordonnées ci-dessous</span>}</div>{buildingAddress&&<p className="mt-2 truncate text-xs text-slate-400">{buildingAddress}</p>}</div>
        <div className="client-record-actions"><button type="button" disabled={!phone} onClick={()=>triggerCall(phone,contactId)} className="primary-action disabled:opacity-40"><Phone size={15}/>Appeler</button>{canMessage&&<><button type="button" onClick={()=>setSendModal({type:'whatsapp'})} className="secondary-action"><MessageSquare size={15}/>WhatsApp</button><button type="button" onClick={()=>setSendModal({type:'email'})} className="secondary-action"><Mail size={15}/>E-mail</button><button type="button" onClick={()=>setSendModal({type:'sms'})} className="secondary-action"><Smartphone size={15}/>SMS</button></>}{onNewBillingDoc&&<button type="button" onClick={()=>onNewBillingDoc(contact,'quote')} className="secondary-action"><FilePlus2 size={15}/>Créer un devis</button>}</div>
      </div>
      <nav className="client-record-tabs" aria-label="Sections de la fiche client">{[['overview','Vue d’ensemble'],['installation','Installation'],['documents','Documents'],['activity','Historique']].map(([value,label])=><button key={value} type="button" aria-pressed={activeSection===value} onClick={()=>setActiveSection(value)} className={activeSection===value?'is-active':''}>{label}{value==='activity'&&interactions.length>0&&<span>{interactions.length}</span>}</button>)}</nav>
      <main className="client-record-content scrollbar-thin">
        <div className="client-record-inner">
          <div className={activeSection==='overview'?'record-overview':'hidden'}>
            <div className="record-main-column">
              <section className="record-card"><div className="record-card-heading"><div><h2>Coordonnées & suivi</h2><p>Les informations essentielles du client</p></div><User size={18}/></div><div className="record-card-body">{groups.contact.length?renderFields(groups.contact):<p className="text-sm text-slate-400">Aucun champ de coordonnées visible.</p>}</div></section>
              {groups.address.length>0&&<section className="record-card"><div className="record-card-heading"><div><h2>Adresse du client</h2><p>Localisation du site d’intervention</p></div><Building2 size={18}/></div><div className="record-card-body">{renderFields(groups.address)}</div></section>}
              {notesField&&<section className="record-card"><div className="record-card-heading"><div><h2>Notes du client</h2><p>Les précisions utiles à garder sous la main</p></div><FileText size={18}/></div><div className="record-card-body"><EditableField label={notesField.label} value={notes} fieldDef={notesField} onSave={value=>saveField(notesField.name,updateLeadNotes(leadSummary,value))}/></div></section>}
              {groups.extra.length>0&&<details className="record-card record-additional"><summary>Informations complémentaires <span>{groups.extra.length} champs</span></summary><div className="record-card-body">{renderFields(groups.extra)}</div></details>}
            </div>
            <aside className="record-side-column">
              <section className="record-card"><div className="record-card-heading"><div><h2>Rendez-vous</h2><p>{upcoming.length?`${upcoming.length} à venir`:'Aucun rendez-vous à venir'}</p></div><button type="button" onClick={()=>setShowApptModal(true)} className="icon-control" aria-label="Ajouter un rendez-vous"><Plus size={18}/></button></div><div className="record-appointments">{upcoming.length?upcoming.map(appointmentCard):<div className="record-empty"><CalendarDays size={24}/><p>Planifiez le prochain échange<br/>ou la prochaine installation.</p><button type="button" className="text-action" onClick={()=>setShowApptModal(true)}>Ajouter un rendez-vous</button></div>}{past.length>0&&<><button type="button" className="record-history-toggle" aria-expanded={showPastAppointments} onClick={()=>setShowPastAppointments(value=>!value)}>{showPastAppointments?'Masquer':'Afficher'} les rendez-vous passés et annulés ({past.length})</button>{showPastAppointments&&past.map(appointmentCard)}</>}</div></section>
              {groups.project.length>0&&<section className="record-card"><div className="record-card-heading"><div><h2>Le projet</h2><p>Les caractéristiques principales</p></div><button type="button" className="text-action" onClick={()=>setActiveSection('installation')}>Modifier</button></div><dl className="record-project-summary">{groups.project.filter(field=>cd[field.name]!==undefined&&cd[field.name]!==''&&cd[field.name]!==null).slice(0,5).map(field=><div key={field.name}><dt>{field.label}</dt><dd>{typeof cd[field.name]==='boolean'?(cd[field.name]?'Oui':'Non'):String(cd[field.name])}</dd></div>)}</dl></section>}
              {buildingAddress&&<section className="record-card record-map"><ContactMap key={buildingAddress} address={buildingAddress}/></section>}
              <div className="record-metadata"><p>Créé le <span>{fmtDate(contact.created_at)}</span></p><p>Dernière modification <span>{fmtDate(contact.updated_at)}</span></p>{lastInteraction&&<p>Dernier échange <span>{fmtDate(lastInteraction.date)}</span></p>}</div>
            </aside>
          </div>
          <div className={activeSection==='installation'?'record-installation':'hidden'}>
            <section className="record-card"><div className="record-card-heading"><div><h2>Projet & installation</h2><p>Logement, véhicule, borne et contraintes du chantier</p></div><Building2 size={18}/></div><div className="record-card-body">{groups.project.length?renderFields(groups.project):<p className="text-sm text-slate-400">Les champs techniques du client apparaîtront ici.</p>}</div></section>
            <section className="record-card record-assignment"><div className="record-card-heading"><div><h2>Organisation de l’intervention</h2><p>Installateur, créneau et envoi des coordonnées</p></div><CalendarDays size={18}/></div><div className="record-card-body">{canMessage?<InstallerAssignment key={contactId} contact={contact} appointments={appointments} fields={fields} installers={installers} onSave={async values=>{const updated=await api.updateContact(contact.id,{custom_data:{...contact.custom_data,...values}});setContact(previous=>({...previous,custom_data:updated.custom_data}));}} onSend={setSendModal}/>:<div className="space-y-3 text-sm text-slate-500"><p>Installateur : {cd.installateur_nom||'Non renseigné'}</p><p>Créneau : {[cd.installation_date,cd.installation_heure].filter(Boolean).join(' à ')||'Non renseigné'}</p></div>}</div></section>
          </div>
          <div className={activeSection==='documents'?'record-documents':'hidden'}>
            <section className="record-card"><div className="record-card-heading"><div><h2>Documents commerciaux</h2><p>Préparer les documents et transmettre le client</p></div><Receipt size={18}/></div><div className="record-document-actions">{onNewBillingDoc&&<><button type="button" className="secondary-action" onClick={()=>onNewBillingDoc(contact,'quote')}><FilePlus2 size={17}/>Créer un devis</button><button type="button" className="secondary-action" onClick={()=>onNewBillingDoc(contact,'invoice')}><Receipt size={17}/>Créer une facture</button></>}<button type="button" className="secondary-action" onClick={printForm}><Printer size={17}/>Imprimer la fiche d’intervention</button>{user?.role==='admin'&&<QontoContactButton key={contactId} contactId={contactId}/>}</div></section>
            <section className="record-card"><div className="record-card-heading"><div><h2>Photos & pièces jointes</h2><p>Les fichiers du formulaire et les documents ajoutés au dossier</p></div><Paperclip size={18}/></div><div className="record-card-body"><Attachments key={contactId} contactId={contactId} leadPhotoUrls={leadPhotoUrls}/></div></section>
          </div>
          <section className={activeSection==='activity'?'record-activity':'hidden'}>
            <div className="mb-6"><h2 className="text-xl font-semibold tracking-tight">Historique des échanges</h2><p className="mt-2 text-sm text-slate-500">Notes, messages et confirmations de rendez-vous.</p></div>
            <ActivityComposer contactId={contactId} onCreated={handleInteractionCreated}/>
            <div className="relative"><div className="absolute bottom-0 left-4 top-0 w-px bg-slate-200"/>{timelineItems.map(item=>item._type==='interaction'?<TimelineInteraction key={`int-${item.id}`} item={item} onDelete={handleDeleteInteraction}/>:<TimelineCreated key="created" contact={contact}/>)}{timelineItems.length<=1&&<p className="ml-11 text-sm text-slate-400">Aucun échange enregistré pour le moment.</p>}</div>
          </section>
        </div>
      </main>
      <Softphone/>
      {showApptModal&&<AppointmentModal contactId={contactId} contactName={name} onCreated={appt=>{setAppointments(previous=>[appt,...previous]);api.getContactInteractions(contactId).then(setInteractions).catch(()=>{});}} onClose={()=>setShowApptModal(false)}/>}
      {sendModal&&<SendMessageModal contact={contact} fields={fields} type={sendModal.type} initialPhone={sendModal.initialPhone} initialBody={sendModal.initialBody} recipientName={sendModal.recipientName} onClose={()=>setSendModal(null)} onSent={()=>{setSendModal(null);loadData();}}/>}
    </div>
  );
}
