import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import {
  FileSignature, CreditCard, Newspaper, Building2, CheckCircle2,
  Plus, RefreshCw, ChevronRight, Search, X, AlertCircle, Loader2,
  ExternalLink, Clock, Check, Ban, Edit3, Trash2
} from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────

const ETAPES = [
  { id: 'signature', label: 'Signature', icon: FileSignature, color: 'blue',
    desc: 'En attente de signature DocuSign' },
  { id: 'paiement',  label: 'Paiement',  icon: CreditCard,    color: 'amber',
    desc: 'Signature reçue — en attente de paiement' },
  { id: 'jal',       label: 'Annonce JAL',icon: Newspaper,    color: 'purple',
    desc: 'Paiement reçu — annonce légale à publier' },
  { id: 'inpi',      label: 'Dépôt INPI', icon: Building2,    color: 'orange',
    desc: 'JAL publiée — dépôt INPI en cours' },
  { id: 'termine',   label: 'Terminé',    icon: CheckCircle2,  color: 'green',
    desc: 'Dossier complet' },
];

const COLORS = {
  blue:   { bg: 'bg-blue-50',   header: 'bg-blue-100 text-blue-800',   dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700'   },
  amber:  { bg: 'bg-amber-50',  header: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700'  },
  purple: { bg: 'bg-purple-50', header: 'bg-purple-100 text-purple-800',dot: 'bg-purple-500',badge: 'bg-purple-100 text-purple-700'},
  orange: { bg: 'bg-orange-50', header: 'bg-orange-100 text-orange-800',dot: 'bg-orange-500',badge: 'bg-orange-100 text-orange-700'},
  green:  { bg: 'bg-green-50',  header: 'bg-green-100 text-green-800', dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700'  },
};

const TYPES_FORMALITE = [
  'Constitution', 'Modification', 'Dissolution', 'Liquidation',
  'Cession de parts', 'Augmentation de capital', 'Transfert de siège', 'Autre'
];

const STATUT_ICONS = {
  signe:      <Check className="w-3 h-3 text-green-600" />,
  en_attente: <Clock className="w-3 h-3 text-amber-500" />,
  envoye:     <Clock className="w-3 h-3 text-blue-500" />,
  refuse:     <Ban  className="w-3 h-3 text-red-500"   />,
};

// ── Petits composants ─────────────────────────────────────────────────────────

function Badge({ label, color = 'blue' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COLORS[color]?.badge || 'bg-slate-100 text-slate-700'}`}>
      {label}
    </span>
  );
}

function StatutBadge({ statut }) {
  const map = {
    signe:      { label: 'Signé',       color: 'green'  },
    en_attente: { label: 'En attente',  color: 'amber'  },
    envoye:     { label: 'Envoyé',      color: 'blue'   },
    refuse:     { label: 'Refusé',      color: 'red'    },
    recu:       { label: 'Reçu',        color: 'green'  },
    publiee:    { label: 'Publiée',     color: 'green'  },
    depose:     { label: 'Déposé',      color: 'green'  },
    termine:    { label: 'Terminé',     color: 'green'  },
  };
  const cfg = map[statut] || { label: statut, color: 'blue' };
  return <Badge label={cfg.label} color={cfg.color} />;
}

// ── Carte dossier ─────────────────────────────────────────────────────────────

function DossierCard({ dossier, onEdit, onDelete, onEtapeChange }) {
  const [loading, setLoading] = useState(false);

  async function avancer() {
    const idx = ETAPES.findIndex(e => e.id === dossier.etape);
    if (idx >= ETAPES.length - 1) return;
    setLoading(true);
    try {
      await onEtapeChange(dossier.id, ETAPES[idx + 1].id);
    } finally {
      setLoading(false);
    }
  }

  const etapeCfg = ETAPES.find(e => e.id === dossier.etape);
  const col = COLORS[etapeCfg?.color] || COLORS.blue;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-4 space-y-3">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 truncate">{dossier.client_nom}</p>
          {dossier.type_formalite && (
            <p className="text-xs text-slate-500 mt-0.5">{dossier.type_formalite}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onEdit(dossier)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(dossier.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Infos */}
      <div className="space-y-1.5 text-xs text-slate-600">
        {dossier.client_siren && (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="font-mono">{dossier.client_siren}</span>
          </div>
        )}
        {dossier.docusign_envelope_id && (
          <div className="flex items-center gap-1.5">
            <FileSignature className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">DocuSign :</span>
            <StatutBadge statut={dossier.docusign_statut} />
          </div>
        )}
        {dossier.paiement_montant && (
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>{Number(dossier.paiement_montant).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
            <StatutBadge statut={dossier.paiement_statut} />
          </div>
        )}
        {dossier.jal_nom && (
          <div className="flex items-center gap-1.5">
            <Newspaper className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{dossier.jal_nom}</span>
          </div>
        )}
        {dossier.inpi_numero_depot && (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>Dépôt #{dossier.inpi_numero_depot}</span>
            <StatutBadge statut={dossier.inpi_statut} />
          </div>
        )}
      </div>

      {/* Avancer */}
      {dossier.etape !== 'termine' && (
        <button
          onClick={avancer}
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
          Étape suivante
        </button>
      )}
    </div>
  );
}

// ── Modal nouveau dossier / édition ──────────────────────────────────────────

function DossierModal({ dossier, onClose, onSave }) {
  const [form, setForm] = useState({
    client_nom: '',
    client_email: '',
    client_siren: '',
    type_formalite: 'Constitution',
    etape: 'signature',
    docusign_envelope_id: '',
    docusign_statut: 'en_attente',
    paiement_statut: 'en_attente',
    paiement_date: '',
    paiement_montant: '',
    jal_nom: '',
    jal_reference: '',
    jal_date: '',
    inpi_numero_depot: '',
    inpi_statut: 'en_attente',
    inpi_date: '',
    notes: '',
    ...dossier,
  });
  const [saving, setSaving] = useState(false);
  const [inpiLoading, setInpiLoading] = useState(false);
  const [inpiData, setInpiData] = useState(null);
  const [inpiError, setInpiError] = useState('');

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }

  async function fetchInpi() {
    if (!form.client_siren || form.client_siren.replace(/\s/g,'').length !== 9) {
      setInpiError('SIREN invalide (9 chiffres)');
      return;
    }
    setInpiLoading(true);
    setInpiError('');
    setInpiData(null);
    try {
      const token = localStorage.getItem('crm_token');
      const res = await fetch(`/api/inpi/entreprise/${form.client_siren.replace(/\s/g,'')}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setInpiError(err.error || 'Entreprise non trouvée');
      } else {
        const data = await res.json();
        setInpiData(data);
        // Pré-remplir le nom si vide
        const nom = data?.identite?.denomination || data?.denomination || data?.nom;
        if (nom && !form.client_nom) set('client_nom', nom);
      }
    } catch (e) {
      setInpiError(e.message);
    } finally {
      setInpiLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.paiement_montant === '') payload.paiement_montant = null;
      await onSave(payload);
      onClose();
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {dossier?.id ? 'Modifier le dossier' : 'Nouveau dossier'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-6">
          {/* Client */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Client</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
                <input value={form.client_nom} onChange={e => set('client_nom', e.target.value)} required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">SIREN</label>
              <div className="flex gap-2">
                <input value={form.client_siren} onChange={e => set('client_siren', e.target.value)}
                  placeholder="123 456 789"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button type="button" onClick={fetchInpi} disabled={inpiLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-sm hover:bg-indigo-100 disabled:opacity-50">
                  {inpiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  INPI
                </button>
              </div>
              {inpiError && <p className="text-xs text-red-500 mt-1">{inpiError}</p>}
              {inpiData && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 space-y-1">
                  <p className="font-semibold">{inpiData?.identite?.denomination || inpiData?.denomination || '—'}</p>
                  <p>{inpiData?.identite?.formeJuridique?.libelle || inpiData?.formeJuridique || ''}</p>
                  <p className="text-green-600">Trouvé dans le RNE INPI</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type de formalité</label>
              <select value={form.type_formalite} onChange={e => set('type_formalite', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {TYPES_FORMALITE.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Étape actuelle</label>
              <select value={form.etape} onChange={e => set('etape', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {ETAPES.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>
          </section>

          {/* DocuSign */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-blue-500" /> DocuSign
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ID enveloppe</label>
                <input value={form.docusign_envelope_id} onChange={e => set('docusign_envelope_id', e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Statut signature</label>
                <select value={form.docusign_statut} onChange={e => set('docusign_statut', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="en_attente">En attente</option>
                  <option value="envoye">Envoyé</option>
                  <option value="signe">Signé</option>
                  <option value="refuse">Refusé</option>
                </select>
              </div>
            </div>
          </section>

          {/* Paiement */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-500" /> Paiement
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Statut</label>
                <select value={form.paiement_statut} onChange={e => set('paiement_statut', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="en_attente">En attente</option>
                  <option value="recu">Reçu</option>
                  <option value="partiel">Partiel</option>
                  <option value="refuse">Refusé</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Montant (€)</label>
                <input type="number" step="0.01" value={form.paiement_montant} onChange={e => set('paiement_montant', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input type="date" value={form.paiement_date} onChange={e => set('paiement_date', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </section>

          {/* JAL */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-purple-500" /> Annonce légale (JAL)
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Journal</label>
                <input value={form.jal_nom} onChange={e => set('jal_nom', e.target.value)}
                  placeholder="ex: Le Parisien"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Référence</label>
                <input value={form.jal_reference} onChange={e => set('jal_reference', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date publication</label>
                <input type="date" value={form.jal_date} onChange={e => set('jal_date', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </section>

          {/* INPI */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
              <Building2 className="w-4 h-4 text-orange-500" /> Dépôt INPI
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">N° dépôt</label>
                <input value={form.inpi_numero_depot} onChange={e => set('inpi_numero_depot', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Statut</label>
                <select value={form.inpi_statut} onChange={e => set('inpi_statut', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="en_attente">En attente</option>
                  <option value="depose">Déposé</option>
                  <option value="enregistre">Enregistré</option>
                  <option value="rejete">Rejeté</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date dépôt</label>
                <input type="date" value={form.inpi_date} onChange={e => set('inpi_date', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </section>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {dossier?.id ? 'Enregistrer' : 'Créer le dossier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal recherche INPI ──────────────────────────────────────────────────────

function InpiSearchModal({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const token = localStorage.getItem('crm_token');
      const isSiren = /^\d{9}$/.test(query.replace(/\s/g, ''));
      const url = isSiren
        ? `/api/inpi/entreprise/${query.replace(/\s/g,'')}`
        : `/api/inpi/recherche?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Aucun résultat');
      } else {
        const data = await res.json();
        setResults(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function renderValue(val) {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  }

  function renderObj(obj, depth = 0) {
    if (!obj || typeof obj !== 'object') return <span className="text-slate-600">{renderValue(obj)}</span>;
    return (
      <dl className={depth === 0 ? 'space-y-2' : 'ml-4 space-y-1 border-l-2 border-slate-100 pl-3'}>
        {Object.entries(obj).map(([k, v]) => (
          <div key={k} className="flex gap-2 text-xs">
            <dt className="text-slate-500 font-medium flex-shrink-0 min-w-[140px]">{k}</dt>
            <dd className="text-slate-800 break-all">
              {typeof v === 'object' && v !== null ? renderObj(v, depth + 1) : renderValue(v)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-500" />
            Recherche INPI — RNE
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <form onSubmit={search} className="flex gap-2">
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="SIREN (9 chiffres) ou nom d'entreprise"
              className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Chercher
            </button>
          </form>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {results && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              {renderObj(results)}
            </div>
          )}

          {!results && !error && !loading && (
            <div className="text-center py-10 text-slate-400 text-sm">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Recherchez par SIREN ou nom pour consulter le Registre National des Entreprises</p>
              <p className="text-xs mt-2 text-slate-300">Source : data.inpi.fr (API publique)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function Formalites() {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingInpi, setSyncingInpi] = useState(false);
  const [importing, setImporting] = useState(false);
  const [docusignStatus, setDocusignStatus] = useState(null);
  const [inpiSyncStatus, setInpiSyncStatus] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDossier, setEditingDossier] = useState(null);
  const [showInpi, setShowInpi] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('crm_token');
      const [dossiersData, dsStatus, inpiStatus] = await Promise.all([
        fetch('/api/formalites', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch('/api/docusign/status', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
        fetch('/api/inpi-sync/status', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
      ]);
      setDossiers(Array.isArray(dossiersData) ? dossiersData : []);
      setDocusignStatus(dsStatus);
      setInpiSyncStatus(inpiStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncINPI() {
    setSyncingInpi(true);
    setSyncMsg('');
    try {
      const token = localStorage.getItem('crm_token');
      const res = await fetch('/api/inpi-sync/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSyncMsg('INPI synchronisé — statuts mis à jour.');
      await load();
    } catch (e) {
      setSyncMsg('Erreur INPI : ' + e.message);
    } finally {
      setSyncingInpi(false);
      setTimeout(() => setSyncMsg(''), 6000);
    }
  }

  async function importINPI() {
    if (!confirm('Importer tous les dossiers depuis votre compte INPI Guichet Unique ?')) return;
    setImporting(true);
    setSyncMsg('');
    try {
      const token = localStorage.getItem('crm_token');
      const res = await fetch('/api/inpi-sync/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSyncMsg(`Import INPI : ${data.imported} nouveau(x) dossier(s) importé(s) sur ${data.total} trouvé(s).`);
      await load();
    } catch (e) {
      setSyncMsg('Erreur import : ' + e.message);
    } finally {
      setImporting(false);
      setTimeout(() => setSyncMsg(''), 8000);
    }
  }

  async function syncDocuSign() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const token = localStorage.getItem('crm_token');
      const res = await fetch('/api/docusign/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSyncMsg(`Synchronisation : ${data.synced} enveloppes vérifiées, ${data.updated} dossier(s) mis à jour.`);
      await load();
    } catch (e) {
      setSyncMsg('Erreur : ' + e.message);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 6000);
    }
  }

  async function saveDossier(payload) {
    const token = localStorage.getItem('crm_token');
    if (payload.id) {
      await fetch(`/api/formalites/${payload.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => { if (!r.ok) throw new Error('Erreur serveur'); });
    } else {
      await fetch('/api/formalites', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => { if (!r.ok) throw new Error('Erreur serveur'); });
    }
    await load();
  }

  async function deleteDossier(id) {
    if (!confirm('Supprimer ce dossier ?')) return;
    const token = localStorage.getItem('crm_token');
    await fetch(`/api/formalites/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  async function changeEtape(id, etape) {
    const token = localStorage.getItem('crm_token');
    await fetch(`/api/formalites/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ etape }),
    });
    await load();
  }

  const filtered = dossiers.filter(d =>
    !searchQ ||
    d.client_nom?.toLowerCase().includes(searchQ.toLowerCase()) ||
    d.client_siren?.includes(searchQ) ||
    d.type_formalite?.toLowerCase().includes(searchQ.toLowerCase())
  );

  // Compteurs par étape
  const counts = ETAPES.reduce((acc, e) => {
    acc[e.id] = filtered.filter(d => d.etape === e.id).length;
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Formalités</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Pipeline : Signature → Paiement → JAL → INPI
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Status DocuSign */}
            {docusignStatus && (
              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border ${
                docusignStatus.configured
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${docusignStatus.configured ? 'bg-green-500' : 'bg-slate-300'}`} />
                DocuSign {docusignStatus.configured ? (docusignStatus.env === 'production' ? 'Production' : 'Sandbox') : 'non configuré'}
              </div>
            )}
            {/* Status INPI Sync */}
            {inpiSyncStatus && (
              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border ${
                inpiSyncStatus.configured
                  ? 'bg-orange-50 border-orange-200 text-orange-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${inpiSyncStatus.configured ? 'bg-orange-500 animate-pulse' : 'bg-slate-300'}`} />
                INPI {inpiSyncStatus.configured ? `auto /${inpiSyncStatus.interval}min` : 'non configuré'}
              </div>
            )}

            <button onClick={() => setShowInpi(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-orange-600 border border-orange-200 bg-orange-50 rounded-lg hover:bg-orange-100">
              <Search className="w-4 h-4" /> Recherche RNE
            </button>

            {inpiSyncStatus?.configured && (
              <>
                <button onClick={importINPI} disabled={importing}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-orange-700 border border-orange-300 bg-orange-100 rounded-lg hover:bg-orange-200 disabled:opacity-50">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                  Importer INPI
                </button>
                <button onClick={syncINPI} disabled={syncingInpi}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-orange-600 border border-orange-200 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${syncingInpi ? 'animate-spin' : ''}`} />
                  Sync INPI
                </button>
              </>
            )}
            {docusignStatus?.configured && (
              <button onClick={syncDocuSign} disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync DocuSign
              </button>
            )}
            <button onClick={() => { setEditingDossier(null); setShowModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> Nouveau dossier
            </button>
          </div>
        </div>

        {/* Barre de recherche + message sync */}
        <div className="flex items-center gap-3 mt-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Rechercher un dossier..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {syncMsg && (
            <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              {syncMsg}
            </div>
          )}
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full min-w-max">
            {ETAPES.map(etape => {
              const col = COLORS[etape.color];
              const Icon = etape.icon;
              const cards = filtered.filter(d => d.etape === etape.id);

              return (
                <div key={etape.id} className="w-72 flex flex-col">
                  {/* En-tête colonne */}
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 ${col.header}`}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="font-semibold text-sm">{etape.label}</span>
                    <span className="ml-auto text-xs font-bold bg-white/60 px-2 py-0.5 rounded-full">
                      {cards.length}
                    </span>
                  </div>

                  {/* Cartes */}
                  <div className={`flex-1 rounded-xl border-2 border-dashed p-3 space-y-3 overflow-y-auto ${
                    cards.length === 0 ? 'border-slate-200 bg-slate-50/50' : 'border-transparent bg-transparent'
                  }`}>
                    {cards.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        <Icon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p>Aucun dossier</p>
                      </div>
                    ) : (
                      cards.map(d => (
                        <DossierCard
                          key={d.id}
                          dossier={d}
                          onEdit={dos => { setEditingDossier(dos); setShowModal(true); }}
                          onDelete={deleteDossier}
                          onEtapeChange={changeEtape}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Résumé bas de page */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center gap-6 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">{dossiers.length} dossier{dossiers.length > 1 ? 's' : ''} au total</span>
        {ETAPES.map(e => (
          <span key={e.id}>{e.label} : <strong className="text-slate-700">{counts[e.id]}</strong></span>
        ))}
      </div>

      {/* Modals */}
      {showModal && (
        <DossierModal
          dossier={editingDossier}
          onClose={() => { setShowModal(false); setEditingDossier(null); }}
          onSave={saveDossier}
        />
      )}
      {showInpi && <InpiSearchModal onClose={() => setShowInpi(false)} />}
    </div>
  );
}
