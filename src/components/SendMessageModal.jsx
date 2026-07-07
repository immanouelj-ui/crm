import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api.js';
import {
  X, Mail, MessageSquare, Paperclip, AlertCircle, CheckCircle,
  Loader2, Trash2,
} from 'lucide-react';

// ── Variable replacement ─────────────────────────────────────────────────────

function fillVariables(text, contact) {
  const data = contact?.custom_data || {};
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return (text || '')
    .replace(/\{\{name\}\}/g, data.name || data.nom || '')
    .replace(/\{\{prenom\}\}/g, (data.name || '').split(' ')[0] || '')
    .replace(/\{\{company\}\}/g, data.company || data.entreprise || '')
    .replace(/\{\{email\}\}/g, data.email || '')
    .replace(/\{\{phone\}\}/g, data.phone || data.telephone || '')
    .replace(/\{\{date\}\}/g, today)
    .replace(/\{\{sender\}\}/g, 'Notre équipe');
}

// Trouve le champ téléphone dans la liste des champs (par type ou par nom)
function findPhone(contact, fields) {
  const cd = contact?.custom_data || {};
  // 1. cherche un champ de type 'phone'
  if (fields) {
    const phoneField = fields.find(f => f.type === 'phone' || f.type === 'tel');
    if (phoneField && cd[phoneField.name]) return cd[phoneField.name];
  }
  // 2. fallbacks communs
  return cd.phone || cd.telephone || cd.tel || cd.mobile || '';
}

// ── Variable chips ───────────────────────────────────────────────────────────

const VARIABLES = [
  { key: '{{name}}', label: 'Nom' },
  { key: '{{company}}', label: 'Entreprise' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{phone}}', label: 'Téléphone' },
  { key: '{{date}}', label: 'Date' },
];

function VariableChips({ onInsert }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {VARIABLES.map(v => (
        <button
          key={v.key}
          type="button"
          onClick={() => onInsert(v.key)}
          className="px-2 py-0.5 text-xs rounded-full border border-indigo-300 text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors"
        >
          {v.key}
        </button>
      ))}
    </div>
  );
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

// ── Email modal ──────────────────────────────────────────────────────────────

function EmailModal({ contact, fields, onClose, onSent }) {
  const [templates, setTemplates] = useState([]);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef();
  const bodyRef = useRef();
  const subjectRef = useRef();

  const MAX_BYTES = 10 * 1024 * 1024;

  useEffect(() => {
    const cd = contact?.custom_data || {};
    // Trouve email dynamiquement
    const emailField = fields?.find(f => f.type === 'email');
    setTo(emailField ? (cd[emailField.name] || '') : (cd.email || ''));
    api.getTemplates().then(list => setTemplates(list.filter(t => t.type === 'email'))).catch(() => {});
  }, [contact, fields]);

  function applyTemplate(tplId) {
    const tpl = templates.find(t => String(t.id) === String(tplId));
    if (!tpl) return;
    setSubject(fillVariables(tpl.subject || '', contact));
    setBody(fillVariables(tpl.body || '', contact));
  }

  function insertVar(key, ref, setter, current) {
    const el = ref.current;
    if (el) {
      const s = el.selectionStart;
      const e = el.selectionEnd;
      const newVal = current.slice(0, s) + key + current.slice(e);
      setter(newVal);
      setTimeout(() => { el.focus(); el.setSelectionRange(s + key.length, s + key.length); }, 0);
    } else {
      setter(prev => prev + key);
    }
  }

  function totalSize() {
    return attachments.reduce((sum, a) => sum + a.size, 0);
  }

  async function handleFiles(files) {
    for (const file of Array.from(files)) {
      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target.result.split(',')[1];
          setAttachments(prev => [...prev, {
            name: file.name,
            size: file.size,
            mime: file.type,
            data: base64,
          }]);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
  }

  function removeAttachment(idx) {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSend() {
    if (!to.trim()) { setError("L'adresse email est requise."); return; }
    if (!subject.trim()) { setError("L'objet est requis."); return; }
    if (totalSize() > MAX_BYTES) { setError("La taille totale des pièces jointes dépasse 10 Mo."); return; }
    setError(null);
    setSending(true);
    // Remplace toutes les variables restantes au moment de l'envoi
    const finalSubject = fillVariables(subject.trim(), contact);
    const finalBody = fillVariables(body.trim(), contact);
    try {
      await api.sendEmail({
        contact_id: contact?.id || null,
        to: to.trim(),
        subject: finalSubject,
        body: finalBody,
        attachments,
      });
      setToast({ type: 'success', message: 'Email envoyé !' });
      setTimeout(() => { onSent && onSent(); onClose(); }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const cd = contact?.custom_data || {};
  const name = cd.nom || cd.name || `Contact #${contact?.id}`;
  const sizeWarn = totalSize() > MAX_BYTES;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Envoyer un email</h2>
              <p className="text-xs text-slate-500">{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-5 space-y-4">
          {/* Template selector */}
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Utiliser un modèle</label>
              <select
                onChange={e => applyTemplate(e.target.value)}
                defaultValue=""
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
              >
                <option value="">— Choisir un modèle —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* To */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">À</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="destinataire@email.com"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Objet</label>
            <input
              ref={subjectRef}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Objet de l'email..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
            <VariableChips onInsert={k => insertVar(k, subjectRef, setSubject, subject)} />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Message</label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Corps de l'email..."
              rows={8}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 resize-none"
            />
            <VariableChips onInsert={k => insertVar(k, bodyRef, setBody, body)} />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Pièces jointes</label>
            <div
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                sizeWarn ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
              <Paperclip className="w-5 h-5 mx-auto mb-1 text-slate-400" />
              <p className="text-xs text-slate-500">Glissez des fichiers ici ou <span className="text-indigo-600 font-medium">cliquez pour sélectionner</span></p>
              <p className="text-xs text-slate-400 mt-0.5">Max 10 Mo total</p>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-slate-400">{fmt(a.size)}</span>
                    <button onClick={() => removeAttachment(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {sizeWarn && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Taille totale ({fmt(totalSize())}) dépasse la limite de 10 Mo.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSend}
            disabled={sending || sizeWarn}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Envoyer l'email
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-fadein ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'
        }`}>
          <CheckCircle className="w-4 h-4" />
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── WhatsApp modal ───────────────────────────────────────────────────────────

function normalizePhone(raw) {
  let p = (raw || '').replace(/[\s\-\(\)\.]/g, '');
  if (/^0[6-9]\d{8}$/.test(p)) p = '33' + p.slice(1);
  return p.replace(/^\+/, '');
}

// ── Statut WhatsApp badge ─────────────────────────────────────────────────────
function WaStatusBadge({ status }) {
  const cfg = {
    connected:     { dot: 'bg-emerald-500', text: 'Connecté', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    qr:            { dot: 'bg-amber-400 animate-pulse', text: 'Scan QR en attente', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    connecting:    { dot: 'bg-blue-400 animate-pulse', text: 'Connexion…', color: 'text-blue-700 bg-blue-50 border-blue-200' },
    initializing:  { dot: 'bg-blue-400 animate-pulse', text: 'Connexion…', color: 'text-blue-700 bg-blue-50 border-blue-200' },
    disconnected:  { dot: 'bg-slate-400', text: 'Déconnecté', color: 'text-slate-600 bg-slate-50 border-slate-200' },
    auth_failure:  { dot: 'bg-red-500', text: 'Échec auth', color: 'text-red-700 bg-red-50 border-red-200' },
  };
  const c = cfg[status] || cfg.disconnected;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.text}
    </span>
  );
}

function WhatsAppModal({ contact, fields, onClose, onSent }) {
  const [templates, setTemplates] = useState([]);
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [waStatus, setWaStatus] = useState('disconnected');
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const bodyRef = useRef();
  const esRef = useRef(null);

  // Charge statut + ouvre SSE
  useEffect(() => {
    api.getWhatsAppStatus().then(s => { setWaStatus(s.status); setQrDataUrl(s.qr); }).catch(() => {});

    const es = api.whatsAppStatusStream();
    esRef.current = es;
    es.onmessage = e => {
      try {
        const d = JSON.parse(e.data);
        setWaStatus(d.status);
        setQrDataUrl(d.qr || null);
        if (d.status === 'connected') setConnecting(false);
      } catch {}
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    const raw = findPhone(contact, fields);
    setPhone(raw);
    api.getTemplates().then(list => setTemplates(list.filter(t => t.type === 'whatsapp'))).catch(() => {});
  }, [contact, fields]);

  function applyTemplate(tplId) {
    const tpl = templates.find(t => String(t.id) === String(tplId));
    if (tpl) setBody(fillVariables(tpl.body || '', contact));
  }

  function insertVar(key) {
    const el = bodyRef.current;
    if (el) {
      const s = el.selectionStart, e = el.selectionEnd;
      const v = body.slice(0, s) + key + body.slice(e);
      setBody(v);
      setTimeout(() => { el.focus(); el.setSelectionRange(s + key.length, s + key.length); }, 0);
    } else setBody(prev => prev + key);
  }

  async function handleConnect() {
    setConnecting(true);
    await api.connectWhatsApp().catch(() => setConnecting(false));
  }

  async function handleSend() {
    setError(null);
    setSending(true);
    const finalBody = fillVariables(body, contact);
    try {
      await api.sendWhatsApp({ contact_id: contact?.id || null, phone, body: finalBody });
      setSent(true);
      setTimeout(() => { onSent && onSent(); onClose(); }, 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const cd = contact?.custom_data || {};
  const name = cd.nom || cd.name || `Contact #${contact?.id}`;
  const isConnected = waStatus === 'connected';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-[#25D366]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">WhatsApp</h2>
                <WaStatusBadge status={waStatus} />
              </div>
              <p className="text-xs text-slate-500">{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-5 space-y-4">

          {/* ─ QR / Connect section ─ */}
          {!isConnected && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              {waStatus === 'qr' && qrDataUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm font-semibold text-amber-800">Scannez ce QR code avec WhatsApp</p>
                  <img src={qrDataUrl} alt="QR WhatsApp" className="w-52 h-52 rounded-xl border-4 border-white shadow-md" />
                  <p className="text-xs text-amber-700 text-center">Ouvrez WhatsApp sur votre téléphone → Appareils liés → Lier un appareil</p>
                </div>
              ) : (waStatus === 'initializing' || waStatus === 'connecting') ? (
                <div className="flex items-center gap-3 text-blue-700">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Connexion en cours, le QR code arrive…</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-800">WhatsApp non connecté</p>
                    <p className="text-xs text-amber-700 mt-0.5">Connectez votre compte pour envoyer directement depuis le CRM</p>
                  </div>
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white text-sm font-medium rounded-xl hover:bg-[#1fbb57] disabled:opacity-60 transition-colors"
                  >
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                    Connecter
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─ Message form (visible même si non connecté pour préparer) ─ */}
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Modèle</label>
              <select onChange={e => applyTemplate(e.target.value)} defaultValue=""
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 bg-white">
                <option value="">— Choisir un modèle —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Numéro WhatsApp</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+33612345678"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" />
            {phone && <p className="text-xs text-slate-400 mt-1 font-mono">Formaté : +{normalizePhone(phone)}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Message</label>
            <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)}
              placeholder="Votre message…" rows={7}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 resize-none" />
            <VariableChips onInsert={insertVar} />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {sent && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              Message WhatsApp envoyé !
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSend}
            disabled={sending || sent || !phone.trim() || !body.trim() || !isConnected}
            className="flex items-center gap-2 px-5 py-2 bg-[#25D366] text-white text-sm font-medium rounded-xl hover:bg-[#1fbb57] disabled:opacity-40 transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            {isConnected ? 'Envoyer' : 'Connectez WhatsApp d\'abord'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Exported modal switcher ──────────────────────────────────────────────────

export default function SendMessageModal({ contact, fields, type, onClose, onSent }) {
  if (type === 'whatsapp') {
    return <WhatsAppModal contact={contact} fields={fields} onClose={onClose} onSent={onSent} />;
  }
  return <EmailModal contact={contact} fields={fields} onClose={onClose} onSent={onSent} />;
}
