import React, { useRef, useState } from 'react';
import { api } from '../api.js';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  X, Plus, Trash2, Eye, EyeOff, GripVertical, ArrowUp, ArrowDown, ArrowLeft,
  Type, Mail, Phone, Hash, Calendar, ChevronDown, CheckSquare
} from 'lucide-react';

const FIELD_TYPES = [
  { value: 'text', label: 'Texte', icon: Type },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Téléphone', icon: Phone },
  { value: 'number', label: 'Nombre', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'select', label: 'Liste déroulante', icon: ChevronDown },
  { value: 'checkbox', label: 'Case à cocher', icon: CheckSquare },
];

const PRESET_COLORS = [
  { name: 'red', cls: 'bg-red-500' },
  { name: 'orange', cls: 'bg-orange-500' },
  { name: 'amber', cls: 'bg-amber-500' },
  { name: 'green', cls: 'bg-emerald-500' },
  { name: 'teal', cls: 'bg-teal-500' },
  { name: 'blue', cls: 'bg-blue-500' },
  { name: 'indigo', cls: 'bg-indigo-500' },
  { name: 'purple', cls: 'bg-violet-500' },
];

function parseOptions(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    return arr.map(o => (typeof o === 'string' ? { label: o, color: null } : o));
  } catch {
    return [];
  }
}

function serializeOptions(arr) {
  return JSON.stringify(arr.map(o => ({ label: o.label, color: o.color || null })));
}

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {PRESET_COLORS.map(c => (
        <button
          key={c.name}
          type="button"
          onClick={() => onChange(c.name)}
          className={`w-5 h-5 rounded-full ${c.cls} transition-transform ${value === c.name ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'hover:scale-110'}`}
          title={c.name}
        />
      ))}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`w-5 h-5 rounded-full bg-slate-200 transition-transform ${!value ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'hover:scale-110'}`}
        title="Aucune couleur"
      />
    </div>
  );
}

function SortableField({ field, index, count, selected, disabled, onEdit, onMove, onVisible, onDelete }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id, disabled,
  });
  const type = FIELD_TYPES.find(item => item.value === field.type);
  const Icon = type?.icon || Type;
  const actionClass = 'inline-flex min-h-9 min-w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30';

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 10 : undefined }}
      className={`flex items-center gap-1 border-b border-slate-100 bg-white px-1 py-2 ${selected ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : ''} ${isDragging ? 'shadow-lg' : ''}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={`Déplacer le champ ${field.label}`}
        title="Glisser pour déplacer"
        className="flex min-h-11 min-w-9 touch-none select-none items-center justify-center rounded text-slate-400 cursor-grab active:cursor-grabbing disabled:opacity-30"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" disabled={disabled} onClick={() => onEdit(field)} className="flex min-w-0 flex-1 items-center gap-2 rounded py-2 text-left hover:text-indigo-600">
        <Icon className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 sm:block" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-800">{field.label}</span>
          <span className="block text-xs text-slate-400">{type?.label || field.type}</span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col">
        <button type="button" className={actionClass} disabled={disabled || index === 0} aria-label={`Monter le champ ${field.label}`} onClick={() => onMove(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
        <button type="button" className={actionClass} disabled={disabled || index === count - 1} aria-label={`Descendre le champ ${field.label}`} onClick={() => onMove(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
      </div>
      <button type="button" disabled={disabled} onClick={() => onVisible(field)} className={actionClass} aria-label={`${field.visible ? 'Masquer' : 'Afficher'} le champ ${field.label}`}>
        {field.visible ? <Eye className="h-4 w-4 text-indigo-500" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <button type="button" disabled={disabled} onClick={() => onDelete(field.id)} className={actionClass} aria-label={`Supprimer le champ ${field.label}`}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

export default function FieldManager({ fields: initialFields, onClose, onSaved }) {
  const [fields, setFields] = useState(initialFields);
  const [selectedField, setSelectedField] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editOptions, setEditOptions] = useState([]);
  const [newOptionText, setNewOptionText] = useState('');
  const [newOptionColor, setNewOptionColor] = useState(null);
  const [newField, setNewField] = useState({ label: '', name: '', type: 'text', options: [] });
  const [newOptionForNew, setNewOptionForNew] = useState('');
  const [newOptionColorForNew, setNewOptionColorForNew] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reordering, setReordering] = useState(false);
  const reorderLock = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function startEdit(field) {
    setSelectedField(field);
    setEditLabel(field.label);
    setEditOptions(parseOptions(field.options));
    setNewOptionText('');
    setNewOptionColor(null);
  }

  async function saveEdit() {
    if (!selectedField) return;
    setSaving(true);
    setError('');
    try {
      await api.updateField(selectedField.id, {
        label: editLabel,
        options: selectedField.type === 'select' ? serializeOptions(editOptions) : selectedField.options,
      });
      setSelectedField(null);
      await onSaved();
      const updated = await api.getFields();
      setFields(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisible(field) {
    const newVisible = field.visible === 1 ? 0 : 1;
    await api.updateField(field.id, { visible: newVisible });
    setFields(prev => prev.map(f => f.id === field.id ? { ...f, visible: newVisible } : f));
    onSaved();
  }

  async function reorderFields(from, to) {
    if (reorderLock.current || saving || from === to || from < 0 || to < 0 || to >= fields.length) return;
    reorderLock.current = true;
    setReordering(true);
    setError('');
    const before = fields;
    const next = arrayMove(fields, from, to).map((field, position) => ({ ...field, position }));
    setFields(next);
    try {
      const results = await Promise.allSettled(next.map(field => api.updateField(field.id, { position: field.position })));
      if (results.some(result => result.status === 'rejected')) {
        await Promise.allSettled(before.map((field, index) => api.updateField(field.id, { position: field.position ?? index })));
        throw new Error("Impossible d’enregistrer l’ordre des champs. Vérifie la connexion puis réessaie.");
      }
      await onSaved();
    } catch (error) {
      setFields(before);
      try { setFields(await api.getFields()); } catch { /* Keep the last known order. */ }
      setError(error.message);
    } finally {
      reorderLock.current = false;
      setReordering(false);
    }
  }

  function moveField(index, direction) {
    return reorderFields(index, index + direction);
  }

  function endDrag({ active, over }) {
    if (!over) return;
    return reorderFields(fields.findIndex(field => field.id === active.id), fields.findIndex(field => field.id === over.id));
  }

  async function deleteField(id) {
    if (!window.confirm('Supprimer ce champ ? Les données seront perdues.')) return;
    await api.deleteField(id);
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedField?.id === id) setSelectedField(null);
    onSaved();
  }

  async function addNewField() {
    if (!newField.label.trim()) { setError('Le libellé est requis'); return; }
    const name = newField.name.trim() || newField.label.trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setSaving(true);
    setError('');
    try {
      await api.createField({
        name,
        label: newField.label.trim(),
        type: newField.type,
        options: newField.type === 'select' ? serializeOptions(newField.options) : null,
      });
      setNewField({ label: '', name: '', type: 'text', options: [] });
      setNewOptionForNew('');
      setNewOptionColorForNew(null);
      const updated = await api.getFields();
      setFields(updated);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function addEditOption() {
    if (!newOptionText.trim()) return;
    setEditOptions(prev => [...prev, { label: newOptionText.trim(), color: newOptionColor }]);
    setNewOptionText('');
    setNewOptionColor(null);
  }

  function addNewOption() {
    if (!newOptionForNew.trim()) return;
    setNewField(prev => ({ ...prev, options: [...prev.options, { label: newOptionForNew.trim(), color: newOptionColorForNew }] }));
    setNewOptionForNew('');
    setNewOptionColorForNew(null);
  }

  const COLOR_DOT = {
    red: 'bg-red-500', orange: 'bg-orange-500', amber: 'bg-amber-500',
    green: 'bg-emerald-500', teal: 'bg-teal-500', blue: 'bg-blue-500',
    indigo: 'bg-indigo-500', purple: 'bg-violet-500',
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[90dvh] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Gestion des champs</h2>
          <button onClick={onClose} disabled={reordering} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left panel: field list */}
          <div className={`w-full shrink-0 flex-col overflow-hidden border-slate-200 md:flex md:w-80 md:border-r ${selectedField ? 'hidden' : 'flex'}`}>
            <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
              {error && (
                <div className="mx-3 mb-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-xs">
                  {error}
                </div>
              )}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={endDrag}>
                <SortableContext items={fields.map(field => field.id)} strategy={verticalListSortingStrategy}>
                  {fields.map((field, index) => (
                    <SortableField key={field.id} field={field} index={index} count={fields.length}
                      selected={selectedField?.id === field.id} disabled={saving || reordering}
                      onEdit={startEdit} onMove={moveField} onVisible={toggleVisible} onDelete={deleteField}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {reordering && <p role="status" className="px-3 py-2 text-xs text-indigo-600">Enregistrement de l’ordre…</p>}
            </div>

            {/* New field form */}
            <div className="border-t border-slate-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nouveau champ</p>
              <input
                type="text"
                value={newField.label}
                onChange={e => setNewField(p => ({ ...p, label: e.target.value }))}
                placeholder="Libellé"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <select
                value={newField.type}
                onChange={e => setNewField(p => ({ ...p, type: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {newField.type === 'select' && (
                <div className="space-y-1">
                  {newField.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {opt.color && <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_DOT[opt.color] || 'bg-slate-400'}`} />}
                      <span className="flex-1 text-xs bg-slate-50 rounded px-2 py-1 truncate">{opt.label}</span>
                      <button onClick={() => setNewField(p => ({ ...p, options: p.options.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <input
                    type="text"
                    value={newOptionForNew}
                    onChange={e => setNewOptionForNew(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addNewOption(); }}
                    placeholder="Option..."
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none"
                  />
                  <ColorPicker value={newOptionColorForNew} onChange={setNewOptionColorForNew} />
                  <button onClick={addNewOption} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Ajouter l'option
                  </button>
                </div>
              )}
              <button
                onClick={addNewField}
                disabled={saving || reordering || !newField.label.trim()}
                className="w-full py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Créer le champ
              </button>
            </div>
          </div>

          {/* Right panel: edit */}
          <div className={`min-w-0 flex-1 overflow-y-auto scrollbar-thin ${selectedField ? 'block' : 'hidden md:block'}`}>
            {selectedField ? (
              <div className="p-5 space-y-4">
                <button type="button" onClick={() => setSelectedField(null)} className="flex min-h-10 items-center gap-2 text-sm text-indigo-600 md:hidden">
                  <ArrowLeft className="h-4 w-4" /> Liste des champs
                </button>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Modifier le champ</h3>
                  <p className="text-xs text-slate-400">Identifiant : <span className="font-mono">{selectedField.name}</span></p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Libellé</label>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Type</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                    {FIELD_TYPES.find(t => t.value === selectedField.type)?.label || selectedField.type}
                    <span className="text-xs text-slate-400">(non modifiable)</span>
                  </div>
                </div>

                {selectedField.type === 'select' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Options</label>
                    <div className="space-y-2 mb-3">
                      {editOptions.map((opt, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="flex flex-wrap gap-1">
                            {PRESET_COLORS.map(c => (
                              <button
                                key={c.name}
                                type="button"
                                onClick={() => setEditOptions(prev => prev.map((o, j) => j === i ? { ...o, color: c.name } : o))}
                                className={`w-4 h-4 rounded-full ${c.cls} transition-transform ${opt.color === c.name ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'hover:scale-110'}`}
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() => setEditOptions(prev => prev.map((o, j) => j === i ? { ...o, color: null } : o))}
                              className={`w-4 h-4 rounded-full bg-slate-200 transition-transform ${!opt.color ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'hover:scale-110'}`}
                            />
                          </div>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {opt.color && <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_DOT[opt.color] || 'bg-slate-400'}`} />}
                            <span className="text-sm text-slate-800 truncate">{opt.label}</span>
                          </div>
                          <button
                            onClick={() => setEditOptions(prev => prev.filter((_, j) => j !== i))}
                            className="text-red-400 hover:text-red-600 flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="border border-dashed border-slate-300 rounded-lg p-3 space-y-2">
                      <input
                        type="text"
                        value={newOptionText}
                        onChange={e => setNewOptionText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addEditOption(); }}
                        placeholder="Nouvelle option..."
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      />
                      <ColorPicker value={newOptionColor} onChange={setNewOptionColor} />
                      <button
                        onClick={addEditOption}
                        className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" /> Ajouter
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setSelectedField(null)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <CheckSquare className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">Sélectionnez un champ à modifier</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-3">
          <button onClick={onClose} disabled={reordering} className="w-full py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
