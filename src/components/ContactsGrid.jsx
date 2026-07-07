import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { api } from '../api.js';
import {
  Plus, Trash2, Download, Upload, Settings2, Search,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, X, Filter, Bookmark, BookmarkCheck, ChevronsUpDown, Phone, PhoneCall, CheckCircle,
} from 'lucide-react';
import FieldManager from './FieldManager.jsx';
import ImportModal from './ImportModal.jsx';

// ── Filter logic ─────────────────────────────────────────────────────────────

function applyFilters(contacts, filters) {
  if (!filters || filters.length === 0) return contacts;
  return contacts.filter(contact => {
    return filters.every(filter => {
      if (!filter.field) return true;
      const val = contact.custom_data?.[filter.field] ?? '';
      switch (filter.op) {
        case 'contains': return String(val).toLowerCase().includes((filter.value || '').toLowerCase());
        case 'not_contains': return !String(val).toLowerCase().includes((filter.value || '').toLowerCase());
        case 'equals': return String(val) === filter.value;
        case 'empty': return !val || val === '';
        case 'not_empty': return !!val && val !== '';
        case 'in': return Array.isArray(filter.value) ? filter.value.includes(val) : val === filter.value;
        case 'not_in': return Array.isArray(filter.value) ? !filter.value.includes(val) : val !== filter.value;
        case 'gt': return Number(val) > Number(filter.value);
        case 'lt': return Number(val) < Number(filter.value);
        case 'gte': return Number(val) >= Number(filter.value);
        case 'lte': return Number(val) <= Number(filter.value);
        case 'before': return val < filter.value;
        case 'after': return val > filter.value;
        default: return true;
      }
    });
  });
}

function operatorsForType(type) {
  switch (type) {
    case 'number':
      return [
        { value: 'equals', label: '=' },
        { value: 'gt', label: '>' },
        { value: 'lt', label: '<' },
        { value: 'gte', label: '>=' },
        { value: 'lte', label: '<=' },
        { value: 'empty', label: 'est vide' },
        { value: 'not_empty', label: "n'est pas vide" },
      ];
    case 'select':
      return [
        { value: 'in', label: 'est' },
        { value: 'not_in', label: "n'est pas" },
        { value: 'empty', label: 'est vide' },
        { value: 'not_empty', label: "n'est pas vide" },
      ];
    case 'checkbox':
      return [
        { value: 'equals', label: 'est coché' },
        { value: 'not_empty', label: "n'est pas coché" },
      ];
    case 'date':
      return [
        { value: 'before', label: 'est avant' },
        { value: 'after', label: 'est après' },
        { value: 'empty', label: 'est vide' },
        { value: 'not_empty', label: "n'est pas vide" },
      ];
    default: // text, email, phone
      return [
        { value: 'contains', label: 'contient' },
        { value: 'not_contains', label: 'ne contient pas' },
        { value: 'equals', label: 'est égal à' },
        { value: 'empty', label: 'est vide' },
        { value: 'not_empty', label: "n'est pas vide" },
      ];
  }
}

function defaultOpForType(type) {
  if (type === 'select') return 'in';
  if (type === 'checkbox') return 'equals';
  if (type === 'number') return 'equals';
  if (type === 'date') return 'after';
  return 'contains';
}

// ── Filter Panel ─────────────────────────────────────────────────────────────

// ── Saved Filters ─────────────────────────────────────────────────────────────

function getSavedFiltersKey() {
  try {
    const token = localStorage.getItem('crm_token');
    if (!token) return 'crm_saved_filters_anon';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return `crm_saved_filters_${payload.id}`;
  } catch { return 'crm_saved_filters_anon'; }
}

function loadSavedFilters() {
  try { return JSON.parse(localStorage.getItem(getSavedFiltersKey()) || '[]'); } catch { return []; }
}

function persistSavedFilters(list) {
  localStorage.setItem(getSavedFiltersKey(), JSON.stringify(list));
}

function FilterPanel({ fields, activeFilters, onFiltersChange, savedFilters, onSaveFilter, onDeleteSavedFilter, onApplySavedFilter }) {
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  function addFilter() {
    const firstField = fields[0];
    if (!firstField) return;
    onFiltersChange([...activeFilters, {
      id: Date.now(),
      field: firstField.name,
      op: defaultOpForType(firstField.type),
      value: firstField.type === 'select' ? [] : '',
    }]);
  }

  function handleSave() {
    if (!saveName.trim()) return;
    onSaveFilter(saveName.trim(), activeFilters);
    setSaveName('');
    setShowSaveInput(false);
  }

  function removeFilter(id) {
    onFiltersChange(activeFilters.filter(f => f.id !== id));
  }

  function updateFilter(id, changes) {
    onFiltersChange(activeFilters.map(f => f.id === id ? { ...f, ...changes } : f));
  }

  function onFieldChange(filterId, newFieldName) {
    const field = fields.find(f => f.name === newFieldName);
    updateFilter(filterId, {
      field: newFieldName,
      op: defaultOpForType(field?.type),
      value: field?.type === 'select' ? [] : '',
    });
  }

  function onOpChange(filterId, newOp) {
    updateFilter(filterId, { op: newOp, value: '' });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-2">
      {activeFilters.length === 0 && (
        <p className="text-xs text-slate-400 italic">Aucun filtre actif. Cliquez sur "Ajouter un filtre" pour commencer.</p>
      )}

      {activeFilters.map(filter => {
        const field = fields.find(f => f.name === filter.field);
        const fieldType = field?.type || 'text';
        const operators = operatorsForType(fieldType);
        const noValueOps = ['empty', 'not_empty'];
        const isSelectIn = fieldType === 'select' && (filter.op === 'in' || filter.op === 'not_in');
        const selectOptions = field ? parseOptions(field.options) : [];

        return (
          <div key={filter.id} className="flex items-center gap-2 flex-wrap">
            {/* Field selector */}
            <select
              value={filter.field}
              onChange={e => onFieldChange(filter.id, e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white text-slate-700"
            >
              {fields.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
            </select>

            {/* Operator selector */}
            <select
              value={filter.op}
              onChange={e => onOpChange(filter.id, e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white text-slate-700"
            >
              {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>

            {/* Value input */}
            {!noValueOps.includes(filter.op) && !isSelectIn && fieldType !== 'checkbox' && (
              fieldType === 'date' ? (
                <input
                  type="date"
                  value={filter.value || ''}
                  onChange={e => updateFilter(filter.id, { value: e.target.value })}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              ) : fieldType === 'number' ? (
                <input
                  type="number"
                  value={filter.value || ''}
                  onChange={e => updateFilter(filter.id, { value: e.target.value })}
                  placeholder="valeur..."
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 w-24 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              ) : (
                <input
                  type="text"
                  value={filter.value || ''}
                  onChange={e => updateFilter(filter.id, { value: e.target.value })}
                  placeholder="valeur..."
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 w-36 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              )
            )}

            {/* Select multi-chip */}
            {isSelectIn && (
              <div className="flex flex-wrap gap-1">
                {selectOptions.map(opt => {
                  const selected = Array.isArray(filter.value) && filter.value.includes(opt.label);
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        const current = Array.isArray(filter.value) ? filter.value : [];
                        const next = selected
                          ? current.filter(v => v !== opt.label)
                          : [...current, opt.label];
                        updateFilter(filter.id, { value: next });
                      }}
                      className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors ${
                        selected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Remove */}
            <button
              onClick={() => removeFilter(filter.id)}
              className="p-1 text-slate-300 hover:text-red-400 rounded transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {/* Saved filters chips */}
      {savedFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-400 self-center">Sauvegardés :</span>
          {savedFilters.map(sf => (
            <div key={sf.id} className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-0.5 group">
              <button
                onClick={() => onApplySavedFilter(sf)}
                className="text-xs text-indigo-700 font-medium hover:text-indigo-900 transition-colors"
              >
                {sf.name}
              </button>
              <button
                onClick={() => onDeleteSavedFilter(sf.id)}
                className="text-indigo-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <button
          onClick={addFilter}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <Plus className="w-3 h-3" />
          Ajouter un filtre
        </button>
        {activeFilters.length > 0 && (
          <>
            <button
              onClick={() => onFiltersChange([])}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Réinitialiser
            </button>
            <div className="ml-auto">
              {showSaveInput ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSaveInput(false); }}
                    placeholder="Nom du filtre…"
                    className="text-xs border border-indigo-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200 w-36"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim()}
                    className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors font-medium"
                  >
                    OK
                  </button>
                  <button onClick={() => setShowSaveInput(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors"
                >
                  <Bookmark className="w-3 h-3" />
                  Enregistrer ce filtre
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Parse options — handles both string[] and {label,color}[] formats
function parseOptions(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    return arr.map(o => (typeof o === 'string' ? { label: o, color: null } : o));
  } catch {
    return [];
  }
}

const COLOR_DOT = {
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  gray: 'bg-slate-400',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-500',
};

const STATUS_BADGE = {
  Lead: 'bg-purple-100 text-purple-700',
  Prospect: 'bg-blue-100 text-blue-700',
  Client: 'bg-emerald-100 text-emerald-700',
  Inactif: 'bg-slate-100 text-slate-600',
};

function NewContactModal({ fields, onClose, onCreated }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const sortedFields = [...fields].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const newContact = await api.createContact({ custom_data: form });
      onCreated(newContact);
    } catch (err) {
      setError(err.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Nouveau contact</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {sortedFields.map((field, i) => {
            const val = form[field.name] ?? '';
            return (
              <div key={field.name}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    value={val}
                    onChange={e => setForm(f => ({ ...f, [field.name]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">—</option>
                    {parseOptions(field.options).map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={!!val}
                    onChange={e => setForm(f => ({ ...f, [field.name]: e.target.checked }))}
                    className="w-4 h-4 accent-indigo-600"
                  />
                ) : field.name === 'notes' ? (
                  <textarea
                    value={val}
                    onChange={e => setForm(f => ({ ...f, [field.name]: e.target.value }))}
                    rows={3}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <input
                    autoFocus={i === 0}
                    type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                    value={val}
                    onChange={e => setForm(f => ({ ...f, [field.name]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>
            );
          })}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Création…' : 'Créer le contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CellEditor({ value, field, onSave, onCancel }) {
  const [val, setVal] = useState(value ?? '');
  const ref = useRef();
  const containerRef = useRef();

  useEffect(() => {
    ref.current?.focus();
    if (field.type === 'select') {
      setTimeout(() => { ref.current?.showPicker?.(); }, 0);
    }
  }, []);

  // Click outside to cancel
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onCancel();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onCancel]);

  function handleKeyDown(e) {
    if (e.key === 'Enter') onSave(val);
    if (e.key === 'Escape') onCancel();
  }

  if (field.type === 'select') {
    const options = parseOptions(field.options);
    return (
      <div ref={containerRef}>
        <select
          ref={ref}
          value={val}
          onChange={e => { onSave(e.target.value); }}
          onClick={e => e.stopPropagation()}
          className="w-full h-full px-2 py-1 text-sm border-0 outline-none bg-indigo-50 rounded cursor-pointer"
        >
          <option value="">—</option>
          {options.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div ref={containerRef}>
        <input
          ref={ref}
          type="checkbox"
          checked={val === true || val === 'true' || val === 1}
          onChange={e => { onSave(e.target.checked); }}
          className="w-4 h-4 accent-indigo-600"
        />
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div ref={containerRef}>
        <input
          ref={ref}
          type="date"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => onSave(val)}
          onKeyDown={handleKeyDown}
          className="w-full h-full px-2 py-1 text-sm border-0 outline-none bg-indigo-50 rounded"
        />
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <input
        ref={ref}
        type={field.type === 'number' ? 'number' : 'text'}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => onSave(val)}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-2 py-1 text-sm border-0 outline-none bg-indigo-50 rounded"
      />
    </div>
  );
}

function CellDisplay({ value, field }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-300 text-xs">—</span>;
  }
  if (field.type === 'checkbox') {
    return <input type="checkbox" checked={!!value} readOnly className="w-4 h-4 accent-indigo-600 pointer-events-none" />;
  }
  if (field.type === 'select') {
    const options = parseOptions(field.options);
    const opt = options.find(o => o.label === value);
    const color = opt?.color;
    const badgeCls = STATUS_BADGE[value] || 'bg-slate-100 text-slate-600';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badgeCls}`}>
        {color && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${COLOR_DOT[color] || 'bg-slate-400'}`} />}
        {value}
      </span>
    );
  }
  if (field.type === 'email') {
    return <span className="text-indigo-600 text-sm">{value}</span>;
  }
  return <span className="text-sm text-slate-800">{String(value)}</span>;
}

const PAGE_SIZE = 50;

export default function ContactsGrid({ selectedContact: externalSelectedContact, onSelectContact }) {
  const [contacts, setContacts] = useState([]);
  const [fields, setFields] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [campaignToast, setCampaignToast] = useState(false);
  const [selectedContact, setSelectedContact] = useState(externalSelectedContact || null);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [page, setPage] = useState(0);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [savedFilters, setSavedFilters] = useState(() => loadSavedFilters());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [quickStatut, setQuickStatut] = useState(null);

  useEffect(() => {
    if (externalSelectedContact) setSelectedContact(externalSelectedContact);
  }, [externalSelectedContact]);

  const loadData = useCallback(async () => {
    const [c, f] = await Promise.all([api.getContacts(), api.getFields()]);
    setContacts(c);
    setFields(f);
    const vis = {};
    f.forEach(field => { vis[field.name] = field.visible === 1; });
    setColumnVisibility(vis);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveCell(contactId, fieldName, newValue) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const newData = { ...contact.custom_data, [fieldName]: newValue };
    const updated = await api.updateContact(contactId, { custom_data: newData });
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, custom_data: updated.custom_data } : c));
    setEditingCell(null);
  }

  async function handleContactCreated(newContact) {
    setContacts(prev => [newContact, ...prev]);
    setPage(0);
    setShowNewContactModal(false);
  }

  async function deleteRow(contactId, e) {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce contact ?')) return;
    await api.deleteContact(contactId);
    setContacts(prev => prev.filter(c => c.id !== contactId));
    setSelectedRows(prev => { const next = new Set(prev); next.delete(contactId); return next; });
  }

  async function deleteSelected() {
    if (!window.confirm(`Supprimer ${selectedRows.size} contact(s) ?`)) return;
    await Promise.all([...selectedRows].map(id => api.deleteContact(id)));
    setContacts(prev => prev.filter(c => !selectedRows.has(c.id)));
    setSelectedRows(new Set());
  }

  async function createCampaignFromSelection() {
    const name = window.prompt('Nom de la campagne d\'appels :');
    if (!name) return;
    await api.createCampaign({ name, contact_ids: [...selectedRows] });
    setSelectedRows(new Set());
    setCampaignToast(true);
    setTimeout(() => setCampaignToast(false), 4000);
  }

  function toggleRow(id) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll(rows) {
    const ids = rows.map(r => r.original.id);
    const allSelected = ids.every(id => selectedRows.has(id));
    if (allSelected) {
      setSelectedRows(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
    } else {
      setSelectedRows(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });
    }
  }

  const columns = React.useMemo(() => {
    return [
      // Checkbox column
      {
        id: '_select',
        header: ({ table }) => {
          const rows = table.getRowModel().rows;
          const allSel = rows.length > 0 && rows.every(r => selectedRows.has(r.original.id));
          return (
            <input
              type="checkbox"
              checked={allSel}
              onChange={() => toggleAll(rows)}
              className="w-3.5 h-3.5 accent-indigo-600"
            />
          );
        },
        size: 36,
        enableSorting: false,
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedRows.has(row.original.id)}
            onChange={() => toggleRow(row.original.id)}
            onClick={e => e.stopPropagation()}
            className="w-3.5 h-3.5 accent-indigo-600"
          />
        ),
      },
      // ID column
      {
        id: '_actions',
        header: 'ID',
        size: 52,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-slate-400 font-mono">{row.original.id}</span>
        ),
      },
      // Dynamic field columns
      ...fields.map((field) => ({
        id: field.name,
        accessorFn: (row) => row.custom_data?.[field.name],
        header: field.label,
        size: field.name === 'notes' ? 220 : field.type === 'email' ? 180 : 140,
        cell: ({ row, getValue }) => {
          const contactId = row.original.id;
          const isEditing = editingCell?.rowId === contactId && editingCell?.fieldName === field.name;

          if (isEditing) {
            return (
              <CellEditor
                value={getValue()}
                field={field}
                onSave={(val) => saveCell(contactId, field.name, val)}
                onCancel={() => setEditingCell(null)}
              />
            );
          }

          const val = getValue();

          // Select fields: single click opens editor directly (no navigation)
          if (field.type === 'select') {
            return (
              <div
                className="cursor-pointer min-h-[22px] flex items-center group/cell relative"
                onClick={(e) => { e.stopPropagation(); setEditingCell({ rowId: contactId, fieldName: field.name }); }}
              >
                {(val === null || val === undefined || val === '') ? (
                  <span className="text-slate-200 text-xs group-hover/cell:text-slate-400 transition-colors">—</span>
                ) : (
                  <CellDisplay value={val} field={field} />
                )}
              </div>
            );
          }

          return (
            <div
              className="min-h-[22px] flex items-center gap-1.5 group/cell relative cursor-text"
              onClick={(e) => { e.stopPropagation(); setEditingCell({ rowId: contactId, fieldName: field.name }); }}
            >
              {(val === null || val === undefined || val === '') ? (
                <span className="text-slate-200 text-xs group-hover/cell:text-slate-400 transition-colors">
                  Cliquer pour éditer
                </span>
              ) : (
                <>
                  <CellDisplay value={val} field={field} />
                  {field.type === 'phone' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('crm:call-number', { detail: { number: val, contactId } })); }}
                      className="opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0 p-1 rounded-md hover:bg-indigo-100"
                      title="Appeler via Twilio"
                    >
                      <Phone className="w-3.5 h-3.5 text-indigo-500" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        },
      })),
      // Dernière modification
      {
        id: '_updated_at',
        header: 'Dernière modif.',
        size: 170,
        enableSorting: true,
        accessorFn: (row) => row.updated_at || row.created_at,
        cell: ({ row }) => {
          const date = row.original.updated_at || row.original.created_at;
          const by = row.original.updated_by;
          if (!date) return null;
          const d = new Date(date);
          const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
          const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          return (
            <div className="min-w-0">
              <div className="text-xs text-slate-600">{dateStr} · {timeStr}</div>
              {by && <div className="text-[10px] text-slate-400 mt-0.5 truncate">{by}</div>}
            </div>
          );
        },
      },
      // Open detail
      {
        id: '_detail',
        header: '',
        size: 36,
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectContact) onSelectContact(row.original.id);
            }}
            className="p-1 text-slate-300 hover:text-indigo-500 rounded opacity-0 group-hover:opacity-100 transition-all"
            title="Voir détail"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        ),
      },
    ];
  }, [fields, editingCell, selectedRows, page]);

  const tableColumnVisibility = React.useMemo(() => {
    const vis = {};
    fields.forEach(f => {
      vis[f.name] = columnVisibility[f.name] !== false && f.visible === 1;
    });
    return vis;
  }, [fields, columnVisibility]);

  const filteredContacts = React.useMemo(() => {
    let result = applyFilters(contacts, activeFilters);
    if (quickStatut) {
      result = result.filter(c => {
        const s = c.custom_data?.statut || c.custom_data?.status || '';
        return s === quickStatut;
      });
    }
    if (globalFilter.trim()) {
      const q = globalFilter.trim().toLowerCase();
      result = result.filter(c => {
        const data = c.custom_data || {};
        return Object.values(data).some(v => v && String(v).toLowerCase().includes(q));
      });
    }
    return result;
  }, [contacts, activeFilters, quickStatut, globalFilter]);

  const table = useReactTable({
    data: filteredContacts,
    columns,
    state: { sorting, columnVisibility: tableColumnVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const allRows = table.getSortedRowModel().rows;
  const totalFiltered = allRows.length;
  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE);
  const pageRows = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleColumnVisibility(fieldName) {
    setColumnVisibility(prev => ({ ...prev, [fieldName]: !prev[fieldName] }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  function handleSaveFilter(name, filters) {
    const entry = { id: Date.now(), name, filters };
    const next = [...savedFilters, entry];
    setSavedFilters(next);
    persistSavedFilters(next);
  }

  function handleDeleteSavedFilter(id) {
    const next = savedFilters.filter(f => f.id !== id);
    setSavedFilters(next);
    persistSavedFilters(next);
  }

  function handleApplySavedFilter(sf) {
    // Regenerate IDs to avoid conflicts
    const filters = sf.filters.map(f => ({ ...f, id: Date.now() + Math.random() }));
    setActiveFilters(filters);
    setPage(0);
    setShowFilters(true);
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 pt-3 pb-0 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap pb-3">
        {/* Search */}
        <div className="relative" style={{ width: '320px' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher dans les contacts..."
            value={globalFilter}
            onChange={e => { setGlobalFilter(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 placeholder:text-slate-400"
          />
          {globalFilter && (
            <button onClick={() => setGlobalFilter('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtres button */}
        <button
          onClick={() => setShowFilters(p => !p)}
          className={`relative flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
            showFilters || activeFilters.length > 0
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtres
          {activeFilters.length > 0 && (
            <span className="ml-0.5 flex items-center justify-center w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full">
              {activeFilters.length}
            </span>
          )}
        </button>

        {/* Sort menu */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
              sorting.length > 0
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
            Trier
            {sorting.length > 0 && (
              <span className="ml-0.5 flex items-center justify-center w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full">
                {sorting.length}
              </span>
            )}
          </button>
          {showSortMenu && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 w-56 py-2 animate-fadein" onClick={e => e.stopPropagation()}>
              <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Trier par</p>
              {[
                { id: '_updated_at', label: 'Dernière modification' },
                { id: 'created_at', label: 'Date de création' },
                ...fields.map(f => ({ id: f.name, label: f.label })),
              ].map(col => {
                const current = sorting.find(s => s.id === col.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => {
                      if (!current) setSorting([{ id: col.id, desc: false }]);
                      else if (!current.desc) setSorting([{ id: col.id, desc: true }]);
                      else setSorting([]);
                      setShowSortMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${current ? 'text-indigo-700 font-medium' : 'text-slate-700'}`}
                  >
                    <span>{col.label}</span>
                    {current && (
                      <span className="flex items-center gap-1 text-xs text-indigo-500">
                        {current.desc ? <><ArrowDown className="w-3 h-3" /> Z→A</> : <><ArrowUp className="w-3 h-3" /> A→Z</>}
                      </span>
                    )}
                  </button>
                );
              })}
              {sorting.length > 0 && (
                <>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => { setSorting([]); setShowSortMenu(false); }}
                    className="w-full px-3 py-2 text-xs text-slate-400 hover:text-red-500 text-left transition-colors"
                  >
                    Effacer le tri
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Columns visibility */}
          <div className="relative">
            <button
              onClick={() => setShowColumnsMenu(!showColumnsMenu)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
            >
              Colonnes
            </button>
            {showColumnsMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-48 py-2 animate-fadein">
                {fields.map(f => (
                  <label key={f.name} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={columnVisibility[f.name] !== false && f.visible === 1}
                      onChange={() => toggleColumnVisibility(f.name)}
                      className="w-3.5 h-3.5 accent-indigo-600"
                    />
                    <span className="text-slate-700">{f.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowFieldManager(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Champs
          </button>

          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
          >
            <Upload className="w-3.5 h-3.5" />
            Importer
          </button>

          <button
            onClick={api.exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter
          </button>

          <button
            onClick={() => setShowNewContactModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Nouveau contact
          </button>
        </div>
        </div>

        {/* Saved filter chips in toolbar */}
        {savedFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-2">
            {savedFilters.map(sf => {
              const isActive = JSON.stringify(activeFilters.map(f => ({ field: f.field, op: f.op, value: f.value })))
                === JSON.stringify(sf.filters.map(f => ({ field: f.field, op: f.op, value: f.value })));
              return (
                <button
                  key={sf.id}
                  onClick={() => handleApplySavedFilter(sf)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  <BookmarkCheck className="w-3 h-3" />
                  {sf.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Filter panel */}
        {showFilters && (
          <div className="px-0 pb-3">
            <FilterPanel
              fields={fields}
              activeFilters={activeFilters}
              onFiltersChange={filters => { setActiveFilters(filters); setPage(0); }}
              savedFilters={savedFilters}
              onSaveFilter={handleSaveFilter}
              onDeleteSavedFilter={handleDeleteSavedFilter}
              onApplySavedFilter={handleApplySavedFilter}
            />
          </div>
        )}

        {/* Quick statut filter chips */}
        {(() => {
          const statutField = fields.find(f => f.name === 'statut' || f.name === 'status');
          const options = statutField?.options ? (() => { try { return JSON.parse(statutField.options); } catch { return []; } })() : ['Lead','Prospect','Client','Inactif'];
          if (!options.length) return null;
          const CHIP_COLORS = { Lead:'bg-purple-100 text-purple-700 border-purple-200', Prospect:'bg-blue-100 text-blue-700 border-blue-200', Client:'bg-emerald-100 text-emerald-700 border-emerald-200', Inactif:'bg-slate-100 text-slate-500 border-slate-200' };
          return (
            <div className="flex items-center gap-1.5 px-4 py-2 border-t border-slate-100 flex-wrap">
              <span className="text-xs text-slate-400 mr-1">Statut :</span>
              <button
                onClick={() => { setQuickStatut(null); setPage(0); }}
                className={`px-2.5 py-1 rounded-full text-xs border font-medium transition-colors ${!quickStatut ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
              >Tous</button>
              {options.map(opt => {
                const label = typeof opt === 'string' ? opt : opt.label || opt;
                const active = quickStatut === label;
                return (
                  <button
                    key={label}
                    onClick={() => { setQuickStatut(active ? null : label); setPage(0); }}
                    className={`px-2.5 py-1 rounded-full text-xs border font-medium transition-colors ${active ? 'bg-slate-800 text-white border-slate-800' : (CHIP_COLORS[label] || 'bg-white text-slate-500 border-slate-200') + ' hover:opacity-80'}`}
                  >{label}</button>
                );
              })}
              {quickStatut && (
                <span className="ml-1 text-xs text-slate-400">
                  — {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          );
        })()}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin" onClick={() => { showColumnsMenu && setShowColumnsMenu(false); showSortMenu && setShowSortMenu(false); }}>
        <table className="w-full border-collapse text-sm" style={{ minWidth: '800px' }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-200">
              {table.getHeaderGroups()[0]?.headers.map(header => (
                <th
                  key={header.id}
                  className={`text-left px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap border-r border-slate-100 last:border-r-0 select-none text-xs uppercase tracking-wide ${
                    header.column.getCanSort() ? 'cursor-pointer hover:bg-slate-100' : ''
                  } ${header.id === 'name' ? 'sticky left-0 bg-slate-50 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)]' : ''}`}
                  style={{ width: header.getSize() }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <span className="text-slate-300">
                        {header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => (
              <tr
                key={row.id}
                onClick={() => onSelectContact && onSelectContact(row.original.id)}
                className={`group border-b border-slate-100 hover:bg-indigo-50/40 transition-colors cursor-pointer ${
                  selectedRows.has(row.original.id) ? 'bg-indigo-50/40' : rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                }`}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={`px-3 py-2 border-r border-slate-100 last:border-r-0 ${
                      cell.column.id === 'name'
                        ? 'sticky left-0 bg-inherit z-[5] shadow-[2px_0_4px_rgba(0,0,0,0.04)]'
                        : ''
                    }`}
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-16 text-slate-400 text-sm">
                  {globalFilter ? (
                    <>Aucun résultat pour "<span className="font-medium">{globalFilter}</span>"</>
                  ) : 'Aucun contact. Cliquez sur "+ Nouveau contact" pour commencer.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowNewContactModal(true)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors py-1 px-2 rounded hover:bg-indigo-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter une ligne
          </button>
          <span className="text-xs text-slate-400">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
            {(globalFilter || activeFilters.length > 0) && ` · ${totalFiltered} filtré${totalFiltered !== 1 ? 's' : ''}`}
          </span>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Page {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              ←
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedRows.size > 0 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4 animate-fadein z-30">
          <span className="text-sm font-medium">{selectedRows.size} sélectionné{selectedRows.size > 1 ? 's' : ''}</span>
          <div className="w-px h-4 bg-slate-600" />
          <button
            onClick={deleteSelected}
            className="text-sm text-red-400 hover:text-red-300 transition-colors font-medium"
          >
            Supprimer
          </button>
          <button
            onClick={api.exportCSV}
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            Exporter
          </button>
          <button
            onClick={createCampaignFromSelection}
            className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Créer une campagne d'appels
          </button>
          <button
            onClick={() => setSelectedRows(new Set())}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modals */}
      {showFieldManager && (
        <FieldManager
          fields={fields}
          onClose={() => setShowFieldManager(false)}
          onSaved={loadData}
        />
      )}
      {showImport && (
        <ImportModal
          fields={fields}
          onClose={() => setShowImport(false)}
          onImported={loadData}
        />
      )}
      {showNewContactModal && (
        <NewContactModal
          fields={fields}
          onClose={() => setShowNewContactModal(false)}
          onCreated={handleContactCreated}
        />
      )}
      {campaignToast && (
        <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium bg-emerald-600">
          <CheckCircle className="w-4 h-4" />
          Campagne créée ! Retrouve-la dans "Campagnes d'appels".
        </div>
      )}
    </div>
  );
}
