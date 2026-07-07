import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import ContactDetail from './ContactDetail.jsx';

const STAGES = ['Prospect', 'Qualifié', 'Proposition', 'Négociation', 'Gagné', 'Fermé perdu'];

const STAGE_CONFIG = {
  Prospect:     { header: 'bg-slate-200 text-slate-700',   col: 'bg-slate-100 border-slate-200' },
  Qualifié:     { header: 'bg-blue-100 text-blue-700',     col: 'bg-blue-50/50 border-blue-100' },
  Proposition:  { header: 'bg-indigo-100 text-indigo-700', col: 'bg-indigo-50/50 border-indigo-100' },
  Négociation:  { header: 'bg-amber-100 text-amber-700',   col: 'bg-amber-50/30 border-amber-100' },
  Gagné:        { header: 'bg-emerald-100 text-emerald-700', col: 'bg-emerald-50/30 border-emerald-100' },
  'Fermé perdu': { header: 'bg-red-100 text-red-700',      col: 'bg-red-50/20 border-red-100' },
};

function OppCard({ opp, onDelete, onClickContact }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opp.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm group cursor-default hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2">
        <div {...attributes} {...listeners} className="mt-0.5 cursor-grab text-slate-200 hover:text-slate-400 transition-colors">
          <GripVertical className="w-4 h-4" />
        </div>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onClickContact && opp.contact_id && onClickContact(opp.contact_id)}
        >
          <p className="text-sm font-semibold text-slate-900 truncate">{opp.title}</p>
          {opp.value > 0 && (
            <p className="text-base font-bold text-indigo-600 mt-0.5">{opp.value?.toLocaleString('fr-FR')} €</p>
          )}
          {opp.notes && <p className="text-xs text-slate-400 mt-1 truncate">{opp.notes}</p>}
        </div>
        <button
          onClick={() => onDelete(opp.id)}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function Pipeline({ onSelectContact }) {
  const [opportunities, setOpportunities] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOpp, setNewOpp] = useState({ title: '', value: '', notes: '' });
  const [addingTo, setAddingTo] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [fields, setFields] = useState([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    Promise.all([api.getOpportunities(), api.getContacts(), api.getFields()])
      .then(([opps, ctcts, flds]) => {
        setOpportunities(opps);
        setContacts(ctcts);
        setFields(flds);
        setLoading(false);
      });
  }, []);

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const overOpp = opportunities.find(o => o.id === over.id);
    if (!overOpp) return;
    const draggedOpp = opportunities.find(o => o.id === active.id);
    if (!draggedOpp || draggedOpp.stage === overOpp.stage) return;
    const updated = await api.updateOpportunity(draggedOpp.id, { stage: overOpp.stage });
    setOpportunities(prev => prev.map(o => o.id === updated.id ? updated : o));
  }

  async function addOpportunity(stage) {
    if (!newOpp.title.trim()) return;
    const created = await api.createOpportunity({
      title: newOpp.title,
      value: parseFloat(newOpp.value) || 0,
      stage,
      notes: newOpp.notes,
    });
    setOpportunities(prev => [...prev, created]);
    setNewOpp({ title: '', value: '', notes: '' });
    setAddingTo(null);
  }

  async function deleteOpp(id) {
    if (!window.confirm('Supprimer cette opportunité ?')) return;
    await api.deleteOpportunity(id);
    setOpportunities(prev => prev.filter(o => o.id !== id));
  }

  function handleClickContact(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      setSelectedContact(contact);
      if (onSelectContact) onSelectContact(contact);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalValue = opportunities
    .filter(o => o.stage !== 'Fermé perdu')
    .reduce((sum, o) => sum + (o.value || 0), 0);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
        <p className="text-slate-500 text-sm mt-1">
          {opportunities.filter(o => o.stage !== 'Fermé perdu').length} opportunités · {totalValue.toLocaleString('fr-FR')} € en pipeline
        </p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 scrollbar-thin">
          {STAGES.map(stage => {
            const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.Prospect;
            const stageOpps = opportunities.filter(o => o.stage === stage);
            const stageValue = stageOpps.reduce((sum, o) => sum + (o.value || 0), 0);

            return (
              <div
                key={stage}
                className={`flex-shrink-0 w-64 rounded-2xl border-2 ${cfg.col} flex flex-col max-h-full`}
              >
                {/* Column header */}
                <div className={`px-3 py-3 rounded-t-xl ${cfg.header} flex items-center justify-between`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold">{stage}</p>
                      <span className="text-xs bg-black/10 rounded-full px-1.5 py-0.5 font-semibold">{stageOpps.length}</span>
                    </div>
                    {stageValue > 0 && (
                      <p className="text-xs opacity-70 mt-0.5">{stageValue.toLocaleString('fr-FR')} €</p>
                    )}
                  </div>
                  <button
                    onClick={() => setAddingTo(addingTo === stage ? null : stage)}
                    className="p-1 rounded-lg hover:bg-black/10 transition-colors"
                    title="Ajouter"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
                  {addingTo === stage && (
                    <div className="bg-white border border-indigo-300 rounded-xl p-3 space-y-2 shadow-lg animate-fadein">
                      <input
                        autoFocus
                        type="text"
                        value={newOpp.title}
                        onChange={e => setNewOpp(p => ({ ...p, title: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') addOpportunity(stage); if (e.key === 'Escape') setAddingTo(null); }}
                        placeholder="Titre"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <input
                        type="number"
                        value={newOpp.value}
                        onChange={e => setNewOpp(p => ({ ...p, value: e.target.value }))}
                        placeholder="Valeur (€)"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => addOpportunity(stage)}
                          className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
                        >
                          Ajouter
                        </button>
                        <button
                          onClick={() => { setAddingTo(null); setNewOpp({ title: '', value: '', notes: '' }); }}
                          className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  <SortableContext items={stageOpps.map(o => o.id)} strategy={verticalListSortingStrategy}>
                    {stageOpps.map(opp => (
                      <OppCard
                        key={opp.id}
                        opp={opp}
                        onDelete={deleteOpp}
                        onClickContact={handleClickContact}
                      />
                    ))}
                  </SortableContext>

                  {stageOpps.length === 0 && addingTo !== stage && (
                    <p className="text-xs text-center text-slate-400 py-6">Aucune opportunité</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DndContext>

      {selectedContact && (
        <ContactDetail
          contact={selectedContact}
          fields={fields}
          onClose={() => setSelectedContact(null)}
          onUpdated={() => {}}
        />
      )}
    </div>
  );
}
