import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, Trash2, Download, FileText, Settings2, ChevronRight, CheckCircle, Clock,
  X, RefreshCw, ArrowRight, Search, FilePlus2, Mail, Package, Send,
  AlertCircle, ChevronDown, Upload, Palette, Building2, Globe,
} from 'lucide-react';

const BASE = '/api';
function tok() { return localStorage.getItem('crm_token'); }
async function apiFetch(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const STATUS = {
  draft:     { label: 'Brouillon',  cls: 'bg-slate-100 text-slate-600' },
  sent:      { label: 'Envoyée',    cls: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Payée',      cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Annulée',    cls: 'bg-red-100 text-red-700' },
  converted: { label: 'Convertie',  cls: 'bg-purple-100 text-purple-700' },
  accepted:  { label: 'Accepté',    cls: 'bg-emerald-100 text-emerald-700' },
  refused:   { label: 'Refusé',     cls: 'bg-red-100 text-red-700' },
};
function Badge({ status }) {
  const s = STATUS[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
const fmt = n => (n||0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
const fmtDate = s => s ? new Date(s).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const today = () => new Date().toISOString().split('T')[0];
const addDays = d => new Date(Date.now() + d * 86400000).toISOString().split('T')[0];
const TVA = [0, 5.5, 10, 20];
const DEF_LINE = { description:'', ref:'', qty:1, unit:'unité', unit_price:0, tva_rate:20 };

// ── Product picker modal ──────────────────────────────────────────────────────
function ProductPicker({ onSelect, onClose }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    apiFetch('GET', '/products').then(setProducts).catch(() => {});
  }, []);
  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.ref||'').toLowerCase().includes(search.toLowerCase())
  );
  const byCategory = filtered.reduce((acc, p) => {
    const cat = p.category || 'Sans catégorie';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Package className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-slate-700">Catalogue produits</span>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-2 border-b border-slate-100">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" autoFocus />
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat}>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{cat}</p>
              {items.map(p => (
                <button key={p.id} onClick={() => onSelect(p)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{p.name}</span>
                      {p.ref && <span className="text-[10px] text-slate-400 font-mono">#{p.ref}</span>}
                    </div>
                    {p.description && <p className="text-xs text-slate-400 truncate">{p.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-700">{fmt(p.unit_price)}</p>
                    <p className="text-[10px] text-slate-400">TVA {p.tva_rate}%</p>
                  </div>
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center py-8 text-sm text-slate-400">Aucun produit trouvé</p>}
        </div>
      </div>
    </div>
  );
}

// ── Send email modal ──────────────────────────────────────────────────────────
function SendEmailModal({ invoice, contactEmail, onClose, onSent }) {
  const [to, setTo] = useState(contactEmail || '');
  const [subject, setSubject] = useState(`${invoice.type === 'quote' ? 'Devis' : 'Facture'} ${invoice.number}`);
  const [body, setBody] = useState(`Bonjour,\n\nVeuillez trouver ci-joint votre ${invoice.type === 'quote' ? 'devis' : 'facture'} ${invoice.number}.\n\nCordialement`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    if (!to) return setError('Email requis');
    setSending(true); setError(null);
    try {
      await apiFetch('POST', `/invoices/${invoice.id}/send-email`, { to, subject, body });
      onSent();
      onClose();
    } catch (e) { setError(e.message); }
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Mail className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-slate-700">Envoyer par email</span>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Destinataire *</label>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="client@example.com" autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Objet</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>
          <p className="text-xs text-slate-400">Le PDF {invoice.number} sera joint automatiquement.</p>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">Annuler</button>
          <button onClick={send} disabled={sending}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Editor ────────────────────────────────────────────────────────────
function InvoiceEditor({ invoice, onSaved, onClose, settings, contacts }) {
  const isNew = !invoice?.id;
  const isQuote = (invoice?.type || 'invoice') === 'quote';

  const [form, setForm] = useState(() => ({
    type: invoice?.type || 'invoice',
    status: invoice?.status || 'draft',
    client_type: invoice?.client_type || 'professionnel',
    contact_id: invoice?.contact_id || '',
    client_name: invoice?.client_name || '',
    client_siret: invoice?.client_siret || '',
    client_tva: invoice?.client_tva || '',
    client_address: invoice?.client_address || '',
    client_zip: invoice?.client_zip || '',
    client_city: invoice?.client_city || '',
    client_country: invoice?.client_country || 'France',
    client_service_code: invoice?.client_service_code || '',
    client_engagement: invoice?.client_engagement || '',
    issue_date: invoice?.issue_date || today(),
    due_date: invoice?.due_date || addDays(settings?.payment_terms || 30),
    valid_until: invoice?.valid_until || addDays(30),
    notes: invoice?.notes || '',
    lines: invoice?.lines?.length ? invoice.lines : [{ ...DEF_LINE }],
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showProductPicker, setShowProductPicker] = useState(null);
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDrop, setShowContactDrop] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setLine = (i, k, v) => setForm(p => {
    const lines = [...p.lines]; lines[i] = { ...lines[i], [k]: v }; return { ...p, lines };
  });

  function addLine() { setForm(p => ({ ...p, lines: [...p.lines, { ...DEF_LINE }] })); }
  function removeLine(i) { setForm(p => ({ ...p, lines: p.lines.filter((_,j) => j !== i) })); }

  function insertProduct(lineIdx, product) {
    setLine(lineIdx, 'description', product.name);
    setLine(lineIdx, 'ref', product.ref || '');
    setLine(lineIdx, 'unit_price', product.unit_price);
    setLine(lineIdx, 'tva_rate', product.tva_rate);
    setLine(lineIdx, 'unit', product.unit || 'unité');
    setShowProductPicker(null);
  }

  function selectContact(contact) {
    const d = contact.custom_data || {};
    set('contact_id', contact.id);
    set('client_name', d.nom || d.name || '');
    set('client_address', d.adresse || '');
    set('client_zip', d.code_postal || '');
    set('client_city', d.ville || '');
    set('client_siret', d.siret || '');
    set('client_tva', d.tva || '');
    setContactSearch(d.nom || d.name || '');
    setShowContactDrop(false);
  }

  const totals = (() => {
    let ht = 0, tva = 0;
    for (const l of form.lines) {
      const lht = (l.qty||0)*(l.unit_price||0);
      ht += lht; tva += lht*((l.tva_rate||0)/100);
    }
    return { ht: Math.round(ht*100)/100, tva: Math.round(tva*100)/100, ttc: Math.round((ht+tva)*100)/100 };
  })();

  async function save() {
    setSaving(true); setError(null);
    try {
      const result = isNew
        ? await apiFetch('POST', '/invoices', form)
        : await apiFetch('PUT', `/invoices/${invoice.id}`, form);
      onSaved(result);
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  const filteredContacts = contacts.filter(c => {
    const n = (c.custom_data?.nom || c.custom_data?.name || '').toLowerCase();
    return n.includes(contactSearch.toLowerCase());
  }).slice(0, 8);

  const accentColor = settings?.accent_color || '#4F46E5';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0"><X className="w-5 h-5" /></button>
        <span className="font-semibold text-slate-700">{isNew ? `Nouveau ${form.type === 'quote' ? 'devis' : 'facture'}` : invoice.number}</span>
        <Badge status={form.status} />
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {!isNew && (
            <>
              <button onClick={() => setShowSendEmail(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 text-slate-600 transition-colors">
                <Mail className="w-4 h-4" /> Envoyer
              </button>
              <a href={`${BASE}/invoices/${invoice.id}/pdf?token=${tok()}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                <Download className="w-4 h-4" /> PDF
              </a>
              <a href={`${BASE}/invoices/${invoice.id}/xml?token=${tok()}`} download
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                <Download className="w-4 h-4" /> XML
              </a>
            </>
          )}
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>

      {error && <div className="mx-6 mt-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Row 1: Type + Status + Dates */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} disabled={!isNew}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:bg-slate-50">
                <option value="invoice">Facture</option>
                <option value="quote">Devis</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Statut</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {(form.type === 'quote'
                  ? ['draft','sent','accepted','refused','converted']
                  : ['draft','sent','paid','cancelled']
                ).map(s => <option key={s} value={s}>{STATUS[s]?.label || s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date d'émission</label>
              <input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {form.type === 'quote' ? 'Valable jusqu\'au' : 'Échéance'}
              </label>
              <input type="date" value={form.type === 'quote' ? form.valid_until : form.due_date}
                onChange={e => set(form.type === 'quote' ? 'valid_until' : 'due_date', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>

          {/* Client block */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-700">Client / Destinataire</h3>
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 ml-auto">
                  {['particulier','professionnel'].map(t => (
                    <button key={t} onClick={() => set('client_type', t)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${form.client_type===t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact selector */}
            <div className="relative">
              <label className="block text-xs text-slate-500 mb-1">Lier à un contact CRM</label>
              <input value={contactSearch} onChange={e => { setContactSearch(e.target.value); setShowContactDrop(true); }}
                onFocus={() => setShowContactDrop(true)}
                placeholder="Rechercher un contact…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              {showContactDrop && filteredContacts.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                  {filteredContacts.map(c => (
                    <button key={c.id} onClick={() => selectContact(c)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 text-left text-sm">
                      <span className="font-medium text-slate-700">{c.custom_data?.nom || c.custom_data?.name || `Contact #${c.id}`}</span>
                      {c.custom_data?.email && <span className="text-slate-400 text-xs">{c.custom_data.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label:'Nom / Raison sociale *', k:'client_name', placeholder:'Mairie de Paris', full:true },
                { label:'SIRET', k:'client_siret', placeholder:'12345678901234' },
                { label:'N° TVA', k:'client_tva', placeholder:'FR12345678901' },
                { label:'Adresse', k:'client_address', placeholder:'1 rue de Rivoli', full:true },
                { label:'Code postal', k:'client_zip', placeholder:'75001' },
                { label:'Ville', k:'client_city', placeholder:'Paris' },
              ].map(f => (
                <div key={f.k} className={f.full ? 'col-span-2' : ''}>
                  <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                  <input value={form[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.placeholder}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              ))}
            </div>

            {/* Chorus Pro */}
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 select-none">
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                Champs Chorus Pro (Personne Publique)
              </summary>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Code service destinataire</label>
                  <input value={form.client_service_code} onChange={e => set('client_service_code', e.target.value)}
                    placeholder="Ex : DGFIP-01"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">N° engagement juridique / Bon de commande</label>
                  <input value={form.client_engagement} onChange={e => set('client_engagement', e.target.value)}
                    placeholder="Ex : EJ2024-0001"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
            </details>
          </div>

          {/* Lines table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: accentColor }} className="text-white text-xs uppercase tracking-wide">
                  <th className="text-left px-3 py-2.5">Désignation</th>
                  <th className="text-right px-3 py-2.5 w-16">Qté</th>
                  <th className="text-right px-3 py-2.5 w-28">P.U. HT</th>
                  <th className="text-right px-3 py-2.5 w-20">TVA</th>
                  <th className="text-right px-3 py-2.5 w-28">Total HT</th>
                  <th className="w-16 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {form.lines.map((l, i) => (
                  <tr key={i} className={`border-b border-slate-100 last:border-b-0 ${i%2===0?'bg-white':'bg-slate-50/50'}`}>
                    <td className="px-3 py-2">
                      <input value={l.description} onChange={e => setLine(i,'description',e.target.value)}
                        placeholder="Désignation de la prestation…"
                        className="w-full border-0 outline-none text-sm text-slate-700 placeholder:text-slate-300 bg-transparent font-medium" />
                      {l.ref && <p className="text-[11px] text-slate-400 font-mono mt-0.5">Réf. {l.ref}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" value={l.qty} onChange={e => setLine(i,'qty',parseFloat(e.target.value)||0)} min="0"
                        className="w-16 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" value={l.unit_price} onChange={e => setLine(i,'unit_price',parseFloat(e.target.value)||0)} min="0" step="0.01"
                        className="w-28 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                    </td>
                    <td className="px-2 py-2">
                      <select value={l.tva_rate} onChange={e => setLine(i,'tva_rate',parseFloat(e.target.value))}
                        className="w-20 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white">
                        {TVA.map(r => <option key={r} value={r}>{r} %</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-700">
                      {fmt((l.qty||0)*(l.unit_price||0))}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setShowProductPicker(i)} title="Insérer un produit"
                          className="p-1 text-slate-300 hover:text-indigo-500 rounded transition-colors">
                          <Package className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeLine(i)}
                          className="p-1 text-slate-300 hover:text-red-400 rounded transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-4">
              <button onClick={addLine}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
              </button>
              <button onClick={() => setShowProductPicker(-1)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 font-medium">
                <Package className="w-3.5 h-3.5" /> Depuis le catalogue
              </button>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-slate-600"><span>Total HT</span><span className="font-medium">{fmt(totals.ht)}</span></div>
              <div className="flex justify-between text-sm text-slate-600"><span>TVA</span><span className="font-medium">{fmt(totals.tva)}</span></div>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between text-base font-bold rounded-lg px-3 py-2 text-white" style={{ backgroundColor: accentColor }}>
                <span>Total TTC</span><span>{fmt(totals.ttc)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes / Conditions</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              placeholder="Conditions de paiement, délais particuliers…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>
        </div>
      </div>

      {showProductPicker !== null && (
        <ProductPicker
          onSelect={p => showProductPicker === -1 ? (addLine(), setShowProductPicker(null)) || insertProduct(form.lines.length, p) : insertProduct(showProductPicker, p)}
          onClose={() => setShowProductPicker(null)}
        />
      )}
      {showSendEmail && (
        <SendEmailModal
          invoice={invoice}
          contactEmail={contacts.find(c => c.id === form.contact_id)?.custom_data?.email || ''}
          onClose={() => setShowSendEmail(false)}
          onSent={() => onSaved({ ...invoice, status: 'sent' })}
        />
      )}
    </div>
  );
}

// ── Product Catalog page ──────────────────────────────────────────────────────
function ProductCatalog({ onClose }) {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null); // null | {} | product
  const [form, setForm] = useState({ ref:'', name:'', description:'', unit_price:0, tva_rate:20, unit:'unité', category:'' });
  const [saving, setSaving] = useState(false);

  const load = () => apiFetch('GET', '/products').then(setProducts).catch(() => {});
  useEffect(() => { load(); }, []);

  function startEdit(p) {
    setEditing(p);
    setForm(p ? { ref:p.ref||'', name:p.name||'', description:p.description||'', unit_price:p.unit_price||0, tva_rate:p.tva_rate||20, unit:p.unit||'unité', category:p.category||'' } : { ref:'', name:'', description:'', unit_price:0, tva_rate:20, unit:'unité', category:'' });
  }

  async function save() {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editing?.id) await apiFetch('PUT', `/products/${editing.id}`, form);
      else await apiFetch('POST', '/products', form);
      await load(); setEditing(null);
    } catch {}
    setSaving(false);
  }

  async function del(id) {
    if (!window.confirm('Supprimer ce produit ?')) return;
    await apiFetch('DELETE', `/products/${id}`);
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  const byCategory = products.reduce((acc, p) => {
    const cat = p.category || 'Sans catégorie';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        <Package className="w-4 h-4 text-indigo-500" />
        <span className="font-semibold text-slate-700">Catalogue produits & services</span>
        <button onClick={() => startEdit({})} className="ml-auto flex items-center gap-1.5 px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {editing !== null && (
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="max-w-2xl grid grid-cols-3 gap-3">
            {[
              { label:'Référence', k:'ref', placeholder:'REF-001' },
              { label:'Nom *', k:'name', placeholder:'Prestation conseil' },
              { label:'Catégorie', k:'category', placeholder:'Consulting' },
            ].map(f => (
              <div key={f.k}>
                <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                <input value={form[f.k]} onChange={e => setForm(p => ({...p, [f.k]: e.target.value}))} placeholder={f.placeholder}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            ))}
            <div className="col-span-3">
              <label className="block text-xs text-slate-500 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Description courte…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">P.U. HT</label>
              <input type="number" value={form.unit_price} onChange={e => setForm(p => ({...p, unit_price: parseFloat(e.target.value)||0}))} min="0" step="0.01"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">TVA</label>
              <select value={form.tva_rate} onChange={e => setForm(p => ({...p, tva_rate: parseFloat(e.target.value)}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {TVA.map(r => <option key={r} value={r}>{r} %</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Unité</label>
              <input value={form.unit} onChange={e => setForm(p => ({...p, unit: e.target.value}))} placeholder="unité"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={save} disabled={saving || !form.name}
              className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50">
              {editing?.id ? 'Modifier' : 'Créer'}
            </button>
            <button onClick={() => setEditing(null)} className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        {products.length === 0 ? (
          <div className="text-center pt-16 text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun produit. Cliquez sur "Ajouter" pour commencer.</p>
          </div>
        ) : Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat} className="mb-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{cat}</p>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {items.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${i>0?'border-t border-slate-100':''} hover:bg-slate-50 group`}>
                  {p.ref && <span className="text-xs font-mono text-slate-400 w-20 flex-shrink-0">{p.ref}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{p.name}</p>
                    {p.description && <p className="text-xs text-slate-400 truncate">{p.description}</p>}
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-sm font-semibold text-slate-700">{fmt(p.unit_price)}</p>
                    <p className="text-xs text-slate-400">TVA {p.tva_rate}% · {p.unit}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(p)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded"><Settings2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Company Settings ──────────────────────────────────────────────────────────
function CompanySettings({ onClose }) {
  const [form, setForm] = useState({ name:'', siret:'', tva_number:'', address:'', zip:'', city:'', country:'France', phone:'', email:'', website:'', iban:'', bic:'', legal_form:'', capital:'', rcs:'', invoice_prefix:'FA', quote_prefix:'DE', payment_terms:30, late_penalty:'3 fois le taux légal', recovery_fee:'40', accent_color:'#4F46E5', invoice_footer:'', chorus_client_id:'', chorus_client_secret:'', chorus_env:'sandbox' });
  const [saved, setSaved] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const logoRef = useRef();

  useEffect(() => {
    apiFetch('GET', '/invoices/settings').then(d => { if (d?.id) setForm(p => ({...p,...d})); }).catch(() => {});
    fetch(`${BASE}/invoices/settings/logo/file?token=${tok()}`).then(r => r.ok ? setLogoUrl(`${BASE}/invoices/settings/logo/file?token=${tok()}&t=${Date.now()}`) : null).catch(() => {});
  }, []);

  const set = (k, v) => setForm(p => ({...p, [k]: v}));

  async function save() {
    await apiFetch('POST', '/invoices/settings', form);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function uploadLogo(file) {
    const fd = new FormData(); fd.append('logo', file);
    await fetch(`${BASE}/invoices/settings/logo`, { method:'POST', headers:{ Authorization:`Bearer ${tok()}` }, body:fd });
    setLogoUrl(`${BASE}/invoices/settings/logo/file?token=${tok()}&t=${Date.now()}`);
  }

  const F = ({ label, k, placeholder, type='text', full }) => (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={form[k]||''} onChange={e => set(k, e.target.value)} placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        <Settings2 className="w-4 h-4 text-slate-400" />
        <span className="font-semibold text-slate-700">Paramètres société & facturation</span>
        <div className="ml-auto flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Enregistré</span>}
          <button onClick={save} className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Enregistrer</button>
        </div>
      </div>

      <div className="px-6 py-4 max-w-2xl mx-auto w-full space-y-4">

        {/* Logo + color */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Palette className="w-4 h-4 text-slate-400" /> Personnalisation</h3>
          <div className="flex items-start gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Logo</label>
              <div onClick={() => logoRef.current?.click()}
                className="w-24 h-16 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-indigo-300 overflow-hidden bg-slate-50">
                {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <Upload className="w-5 h-5 text-slate-300" />}
              </div>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadLogo(e.target.files[0])} />
              <p className="text-[10px] text-slate-400 mt-1">PNG, JPG (max 5 Mo)</p>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Couleur principale</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.accent_color||'#4F46E5'} onChange={e => set('accent_color', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                <span className="text-sm font-mono text-slate-600">{form.accent_color||'#4F46E5'}</span>
              </div>
              <div className="flex gap-1 mt-2">
                {['#4F46E5','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#1E293B'].map(c => (
                  <button key={c} onClick={() => set('accent_color', c)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${form.accent_color===c?'border-slate-500 scale-110':'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Pied de page personnalisé</label>
            <input value={form.invoice_footer||''} onChange={e => set('invoice_footer', e.target.value)}
              placeholder="Texte libre affiché en bas de chaque document…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>

        {/* Société */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400" /> Votre société</h3>
          <div className="grid grid-cols-2 gap-3">
            <F label="Raison sociale *" k="name" placeholder="Ma Société SARL" full />
            <F label="SIRET *" k="siret" placeholder="12345678901234" />
            <F label="N° TVA" k="tva_number" placeholder="FR12345678901" />
            <F label="Adresse" k="address" placeholder="1 rue de la Paix" full />
            <F label="Code postal" k="zip" placeholder="75001" />
            <F label="Ville" k="city" placeholder="Paris" />
            <F label="Téléphone" k="phone" placeholder="01 23 45 67 89" />
            <F label="Email" k="email" placeholder="contact@masociete.fr" />
            <F label="Site web" k="website" placeholder="https://masociete.fr" full />
          </div>
        </div>

        {/* Mentions légales */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Mentions légales</h3>
          <div className="grid grid-cols-2 gap-3">
            <F label="Forme juridique" k="legal_form" placeholder="SARL" />
            <F label="Capital social" k="capital" placeholder="10 000 €" />
            <F label="RCS" k="rcs" placeholder="Paris B 123 456 789" full />
          </div>
        </div>

        {/* Paiement */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Paiement</h3>
          <div className="grid grid-cols-2 gap-3">
            <F label="IBAN" k="iban" placeholder="FR76 3000 6000 01..." full />
            <F label="BIC" k="bic" placeholder="AGRIFRPP" />
            <div>
              <label className="block text-xs text-slate-500 mb-1">Délai paiement (jours)</label>
              <input type="number" value={form.payment_terms||30} onChange={e => set('payment_terms', parseInt(e.target.value)||30)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <F label="Pénalités de retard" k="late_penalty" placeholder="3 fois le taux légal" />
            <F label="Indemnité forfaitaire (€)" k="recovery_fee" placeholder="40" />
            <div className="grid grid-cols-2 gap-3 col-span-2">
              <F label="Préfixe factures" k="invoice_prefix" placeholder="FA" />
              <F label="Préfixe devis" k="quote_prefix" placeholder="DE" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main Billing ──────────────────────────────────────────────────────────────
export default function Billing({ pendingDoc, onPendingDocConsumed }) {
  const [invoices, setInvoices] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [current, setCurrent] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState({});

  const load = useCallback(async () => {
    const [inv, s, cts] = await Promise.all([
      apiFetch('GET', '/invoices').catch(() => []),
      apiFetch('GET', '/invoices/settings').catch(() => ({})),
      fetch(`${BASE}/contacts`, { headers: { Authorization:`Bearer ${tok()}` } }).then(r=>r.json()).catch(()=>[]),
    ]);
    setInvoices(Array.isArray(inv) ? inv : []);
    setSettings(s || {});
    setContacts(Array.isArray(cts) ? cts : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Ouvre l'éditeur pré-rempli si un doc est en attente (depuis fiche contact)
  useEffect(() => {
    if (!pendingDoc || loading) return;
    const { type, contact } = pendingDoc;
    const d = contact?.custom_data || {};
    setCurrent({
      type,
      contact_id: contact?.id || '',
      client_name: d.nom || d.name || '',
      client_address: d.adresse || '',
      client_zip: d.code_postal || '',
      client_city: d.ville || '',
      client_siret: d.siret || '',
      client_tva: d.tva || '',
    });
    setView('edit');
    onPendingDocConsumed?.();
  }, [pendingDoc, loading]);

  function onSaved(inv) {
    setInvoices(prev => {
      const idx = prev.findIndex(i => i.id === inv.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = inv; return n; }
      return [inv, ...prev];
    });
    setCurrent(inv);
  }

  const filtered = invoices.filter(inv => {
    if (filterType !== 'all' && inv.type !== filterType) return false;
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (inv.number||'').toLowerCase().includes(q) || (inv.client_name||'').toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    invoices: invoices.filter(i => i.type==='invoice').length,
    quotes: invoices.filter(i => i.type==='quote').length,
    paid: invoices.filter(i => i.status==='paid').reduce((s,i) => s+(i.total_ttc||0), 0),
    pending: invoices.filter(i => i.type==='invoice' && ['draft','sent'].includes(i.status)).reduce((s,i) => s+(i.total_ttc||0), 0),
  };

  const accent = settings?.accent_color || '#4F46E5';

  if (view === 'settings') return <CompanySettings onClose={() => { setView('list'); load(); }} />;
  if (view === 'catalog') return <ProductCatalog onClose={() => setView('list')} />;
  if (view === 'edit') return (
    <InvoiceEditor invoice={current} settings={settings} contacts={contacts}
      onSaved={inv => { onSaved(inv); setCurrent(inv); }}
      onClose={() => { setView('list'); load(); }} />
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Numéro, client…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50" />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {[{id:'all',l:'Tous'},{id:'invoice',l:'Factures'},{id:'quote',l:'Devis'}].map(f => (
            <button key={f.id} onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterType===f.id?'bg-white shadow-sm text-indigo-600':'text-slate-500 hover:text-slate-700'}`}>
              {f.l}
            </button>
          ))}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-slate-600">
          <option value="all">Tous statuts</option>
          {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setView('catalog')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
            <Package className="w-4 h-4" /> Catalogue
          </button>
          <button onClick={() => setView('settings')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
            <Settings2 className="w-4 h-4" /> Société
          </button>
          <button onClick={() => { setCurrent({ type:'quote' }); setView('edit'); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-indigo-200 bg-indigo-50 rounded-lg text-indigo-600 hover:bg-indigo-100 font-medium">
            <Plus className="w-4 h-4" /> Devis
          </button>
          <button onClick={() => { setCurrent({ type:'invoice' }); setView('edit'); }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 font-medium" style={{ backgroundColor: accent }}>
            <Plus className="w-4 h-4" /> Facture
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        {[
          { label:'Factures', value:stats.invoices, icon:FileText, color:'text-indigo-600' },
          { label:'Devis', value:stats.quotes, icon:FilePlus2, color:'text-slate-600' },
          { label:'Encaissé', value:fmt(stats.paid), icon:CheckCircle, color:'text-emerald-600' },
          { label:'En attente', value:fmt(stats.pending), icon:Clock, color:'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
            <s.icon className={`w-5 h-5 ${s.color} flex-shrink-0`} />
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-base font-semibold text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-6 pb-4">
        {loading ? (
          <div className="flex justify-center pt-12"><RefreshCw className="w-6 h-6 animate-spin" style={{ color: accent }} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center pt-16 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun document</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5">Numéro</th>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">Client</th>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-4 py-2.5">Échéance</th>
                  <th className="text-right px-4 py-2.5">Total TTC</th>
                  <th className="text-left px-4 py-2.5">Statut</th>
                  <th className="w-24 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, idx) => (
                  <tr key={inv.id} onClick={() => { setCurrent(inv); setView('edit'); }}
                    className={`border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-indigo-50/40 transition-colors ${idx%2===0?'bg-white':'bg-slate-50/30'}`}>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{inv.number}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.type==='quote'?'bg-slate-100 text-slate-600':'bg-indigo-50 text-indigo-700'}`}>
                        {inv.type==='quote'?'Devis':'Facture'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{inv.client_name || <span className="text-slate-400 italic text-xs">—</span>}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(inv.due_date||inv.valid_until)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{fmt(inv.total_ttc)}</td>
                    <td className="px-4 py-3"><Badge status={inv.status} /></td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        {inv.type==='quote' && inv.status!=='converted' && (
                          <button onClick={async e => { e.stopPropagation(); if(!window.confirm('Convertir en facture ?')) return; const r = await apiFetch('POST',`/invoices/${inv.id}/convert`); await load(); setCurrent(r); setView('edit'); }}
                            title="Convertir en facture" className="p-1.5 text-slate-400 hover:text-indigo-600 rounded transition-colors">
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        <a href={`${BASE}/invoices/${inv.id}/pdf?token=${tok()}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded transition-colors" title="PDF">
                          <Download className="w-4 h-4" />
                        </a>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
