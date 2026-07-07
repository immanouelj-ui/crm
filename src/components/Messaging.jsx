import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api.js';
import {
  Mail, MessageSquare, Plus, Trash2, Save, Eye, EyeOff,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle, Loader2,
  Wifi, WifiOff, RefreshCw, Clock, Search, X, User, Phone,
} from 'lucide-react';

// ── Variable chips ───────────────────────────────────────────────────────────

const VARIABLES = [
  { key: '{{name}}', label: 'Nom' },
  { key: '{{company}}', label: 'Entreprise' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{phone}}', label: 'Téléphone' },
  { key: '{{date}}', label: 'Date' },
  { key: '{{sender}}', label: 'Expéditeur' },
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

// ── Sample preview data ──────────────────────────────────────────────────────

function fillPreview(text) {
  return (text || '')
    .replace(/\{\{name\}\}/g, 'Jean Dupont')
    .replace(/\{\{company\}\}/g, 'Acme Corp')
    .replace(/\{\{email\}\}/g, 'jean.dupont@example.com')
    .replace(/\{\{phone\}\}/g, '06 12 34 56 78')
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('fr-FR'))
    .replace(/\{\{sender\}\}/g, 'Notre équipe');
}

// ── Template Editor ──────────────────────────────────────────────────────────

function TemplateEditor({ template, onSaved, onDeleted }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const subjectRef = React.useRef();
  const bodyRef = React.useRef();

  useEffect(() => {
    if (template) {
      setName(template.name || '');
      setType(template.type || 'email');
      setSubject(template.subject || '');
      setBody(template.body || '');
      setPreview(false);
    } else {
      setName('');
      setType('email');
      setSubject('');
      setBody('');
      setPreview(false);
    }
  }, [template]);

  function insertVar(key, targetRef, setter, currentVal) {
    const el = targetRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newVal = currentVal.slice(0, start) + key + currentVal.slice(end);
      setter(newVal);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + key.length, start + key.length);
      }, 0);
    } else {
      setter(prev => prev + key);
    }
  }

  async function handleSave() {
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const data = { name: name.trim(), type, subject: subject.trim() || null, body: body.trim() };
      let saved;
      if (template?.id) {
        saved = await api.updateTemplate(template.id, data);
      } else {
        saved = await api.createTemplate(data);
      }
      showToast('success', 'Modèle enregistré !');
      onSaved(saved);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!template?.id) return;
    if (!window.confirm('Supprimer ce modèle ?')) return;
    setDeleting(true);
    try {
      await api.deleteTemplate(template.id);
      onDeleted(template.id);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setDeleting(false);
    }
  }

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  if (!template && template !== null) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sélectionnez un modèle ou créez-en un nouveau</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div className="flex-1 overflow-y-auto p-6">
        {/* Name */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nom du modèle</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Relance client"
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-white"
          />
        </div>

        {/* Type toggle */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Type</label>
          <div className="flex gap-2">
            {[
              { id: 'email', label: 'Email', icon: Mail },
              { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  type === id
                    ? id === 'whatsapp'
                      ? 'bg-[#25D366] text-white border-[#25D366]'
                      : 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Subject (email only) */}
        {type === 'email' && (
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Objet</label>
            <input
              ref={subjectRef}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Objet de l'email..."
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-white"
            />
            <VariableChips onInsert={k => insertVar(k, subjectRef, setSubject, subject)} />
          </div>
        )}

        {/* Body */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Corps du message</label>
            <button
              type="button"
              onClick={() => setPreview(p => !p)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
            >
              {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {preview ? 'Modifier' : 'Aperçu'}
            </button>
          </div>

          {preview ? (
            <div className="min-h-[200px] border border-slate-200 rounded-xl p-4 bg-slate-50 text-sm text-slate-800 whitespace-pre-wrap font-mono">
              {fillPreview(body) || <span className="text-slate-300 italic">Corps vide</span>}
            </div>
          ) : (
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Corps du message..."
              rows={12}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-white resize-none font-mono"
            />
          )}
          {!preview && (
            <VariableChips onInsert={k => insertVar(k, bodyRef, setBody, body)} />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-6 py-4 bg-white flex items-center gap-3">
        {template?.id && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 border border-red-200 rounded-xl transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Suppression...' : 'Supprimer'}
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim() || !body.trim()}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-fadein ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── SMTP Settings tab ────────────────────────────────────────────────────────

function SmtpSettings() {
  const [form, setForm] = useState({ host: '', port: 587, secure: false, user: '', password: '', from_name: '', from_email: '' });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState(null);
  const [gmailOpen, setGmailOpen] = useState(false);

  useEffect(() => {
    api.getSmtpConfig().then(cfg => {
      if (cfg && Object.keys(cfg).length > 0) {
        setForm({
          host: cfg.host || '',
          port: cfg.port || 587,
          secure: cfg.secure === 1 || cfg.secure === true,
          user: cfg.user || '',
          password: cfg.password || '',
          from_name: cfg.from_name || '',
          from_email: cfg.from_email || '',
        });
      }
    }).catch(() => {});
  }, []);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.saveSmtpConfig({ ...form, secure: form.secure ? 1 : 0 });
      showToast('success', 'Configuration SMTP enregistrée !');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const result = await api.testSmtp();
      showToast('success', result.message || 'Connexion réussie !');
    } catch (err) {
      showToast('error', `Échec : ${err.message}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-5">Configuration du serveur SMTP</h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Hôte SMTP</label>
            <input
              value={form.host}
              onChange={e => update('host', e.target.value)}
              placeholder="smtp.gmail.com"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Port</label>
            <input
              type="number"
              value={form.port}
              onChange={e => update('port', parseInt(e.target.value) || 587)}
              placeholder="587"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.secure}
              onChange={e => update('secure', e.target.checked)}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-sm text-slate-700">Connexion sécurisée (SSL/TLS — port 465)</span>
          </label>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">Utilisateur (adresse email)</label>
          <input
            type="email"
            value={form.user}
            onChange={e => update('user', e.target.value)}
            placeholder="votre@gmail.com"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">Mot de passe</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={form.password}
              onChange={e => update('password', e.target.value)}
              placeholder="Mot de passe d'application"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nom expéditeur</label>
            <input
              value={form.from_name}
              onChange={e => update('from_name', e.target.value)}
              placeholder="Mon CRM"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email expéditeur</label>
            <input
              type="email"
              value={form.from_email}
              onChange={e => update('from_email', e.target.value)}
              placeholder="noreply@mondomaine.fr"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !form.host}
            className="flex items-center gap-2 px-5 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Tester la connexion
          </button>
        </div>
      </div>

      {/* Gmail help */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setGmailOpen(p => !p)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-blue-800 hover:bg-blue-100/50 transition-colors"
        >
          <span>Comment configurer Gmail ?</span>
          {gmailOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {gmailOpen && (
          <div className="px-5 pb-5 text-sm text-blue-900 space-y-2">
            <p className="font-semibold">Paramètres pour Gmail :</p>
            <ul className="list-disc pl-5 space-y-1 text-blue-800">
              <li>Hôte : <code className="bg-blue-100 px-1 rounded">smtp.gmail.com</code></li>
              <li>Port : <code className="bg-blue-100 px-1 rounded">587</code> (STARTTLS) ou <code className="bg-blue-100 px-1 rounded">465</code> (SSL)</li>
              <li>Utilisateur : votre adresse Gmail complète</li>
              <li>Mot de passe : utilisez un <strong>mot de passe d'application</strong> (pas votre mot de passe Google habituel)</li>
            </ul>
            <p className="font-semibold mt-3">Créer un mot de passe d'application :</p>
            <ol className="list-decimal pl-5 space-y-1 text-blue-800">
              <li>Activez la validation en deux étapes sur votre compte Google</li>
              <li>Cliquez ici →{' '}
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
                  className="underline font-semibold text-blue-700 hover:text-blue-900">
                  myaccount.google.com/apppasswords
                </a>
              </li>
              <li>Choisissez <strong>"Autre (nom personnalisé)"</strong> et nommez-le "CRM"</li>
              <li>Copiez le mot de passe généré (16 caractères sans espaces) et collez-le dans le champ Mot de passe ci-dessus</li>
            </ol>
            <p className="text-xs text-blue-700 mt-2 bg-blue-100 rounded-lg px-3 py-2">
              ⚠️ Ce mot de passe d'application remplace votre vrai mot de passe Google — ne mettez <strong>pas</strong> votre mot de passe habituel.
            </p>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-fadein ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── WhatsApp Connection tab ──────────────────────────────────────────────────

function WhatsAppSettings() {
  const [status, setStatus] = useState('disconnected');
  const [qr, setQr] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    api.getWhatsAppStatus().then(s => { setStatus(s.status); setQr(s.qr || null); }).catch(() => {});

    const es = api.whatsAppStatusStream();
    esRef.current = es;
    es.onmessage = e => {
      try {
        const d = JSON.parse(e.data);
        setStatus(d.status);
        setQr(d.qr || null);
        if (d.status === 'connected' || d.status === 'disconnected') {
          setConnecting(false);
          setDisconnecting(false);
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setQr(null);
    await api.connectWhatsApp().catch(() => setConnecting(false));
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    await api.disconnectWhatsApp().catch(() => setDisconnecting(false));
  }

  const isConnected = status === 'connected';
  const isLoading = status === 'connecting' || connecting;

  const statusCfg = {
    connected:   { dot: 'bg-emerald-500', text: 'Connecté', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    qr:          { dot: 'bg-amber-400 animate-pulse', text: 'En attente du scan QR', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    connecting:  { dot: 'bg-blue-400 animate-pulse', text: 'Connexion en cours…', color: 'text-blue-700 bg-blue-50 border-blue-200' },
    disconnected:{ dot: 'bg-slate-400', text: 'Déconnecté', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  };
  const sc = statusCfg[status] || statusCfg.disconnected;

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-[#25D366]" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Connexion WhatsApp</h2>
          <p className="text-xs text-slate-500">Liez votre compte WhatsApp pour envoyer des messages depuis le CRM</p>
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-6">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${sc.color}`}>
          <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
          {sc.text}
        </span>
      </div>

      {/* QR code panel */}
      {status === 'qr' && qr ? (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 flex flex-col items-center gap-4 mb-6">
          <p className="text-sm font-semibold text-amber-900 text-center">Scannez ce QR code avec WhatsApp</p>
          <img src={qr} alt="QR WhatsApp" className="w-56 h-56 rounded-xl border-4 border-white shadow-lg" />
          <div className="text-xs text-amber-800 text-center space-y-1">
            <p className="font-medium">Comment scanner :</p>
            <p>📱 Ouvrez WhatsApp sur votre téléphone</p>
            <p>⋮ Menu → <strong>Appareils liés</strong> → <strong>Lier un appareil</strong></p>
          </div>
          <p className="text-xs text-amber-600 italic">Le QR code expire après 60 secondes — un nouveau sera généré automatiquement</p>
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 flex items-center gap-3 mb-6">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Connexion en cours…</p>
            <p className="text-xs text-blue-600 mt-0.5">Le QR code apparaîtra dans quelques secondes</p>
          </div>
        </div>
      ) : isConnected ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex items-center gap-3 mb-6">
          <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">WhatsApp connecté !</p>
            <p className="text-xs text-emerald-600 mt-0.5">Vous pouvez envoyer des messages depuis les fiches contacts</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 flex items-center gap-3 mb-6">
          <WifiOff className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-700">Non connecté</p>
            <p className="text-xs text-slate-500 mt-0.5">Cliquez sur "Connecter" pour générer un QR code</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white text-sm font-medium rounded-xl hover:bg-[#1fbb57] disabled:opacity-50 transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            {isLoading ? 'Connexion…' : 'Connecter WhatsApp'}
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <WifiOff className="w-4 h-4" />}
            Déconnecter
          </button>
        )}
        {status === 'qr' && (
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Nouveau QR
          </button>
        )}
      </div>
    </div>
  );
}

// ── Call History ──────────────────────────────────────────────────────────────

function CallHistory() {
  const [calls, setCalls] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([api.getInteractions(), api.getContacts()])
      .then(([ints, cts]) => {
        setCalls((Array.isArray(ints) ? ints : []).filter(i => i.type === 'appel'));
        setContacts(Array.isArray(cts) ? cts : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function contactName(id) {
    const c = contacts.find(c => c.id === id);
    return c?.custom_data?.nom || c?.custom_data?.company || null;
  }

  function fmtDuration(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m${s.toString().padStart(2, '0')}s`;
  }

  function fmtDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  const filtered = calls.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.phone_number || '').toLowerCase().includes(q) || (contactName(c.contact_id) || '').toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un numéro ou contact…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50"
          />
        </div>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} appel{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center pt-12">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center pt-12 text-slate-400 text-sm">Aucun appel enregistré</div>
        ) : filtered.map(call => {
          const name = contactName(call.contact_id);
          const missed = !call.duration_sec;
          return (
            <div key={call.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
              <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${missed ? 'bg-red-100' : 'bg-emerald-100'}`}>
                <Phone className={`w-4 h-4 ${missed ? 'text-red-500' : 'text-emerald-600'}`} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{name || call.phone_number}</p>
                <p className="text-xs text-slate-500">{name && call.phone_number} {name ? `· ${call.phone_number}` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-xs font-medium ${missed ? 'text-red-500' : 'text-slate-700'}`}>
                  {missed ? 'Non abouti' : fmtDuration(call.duration_sec)}
                </p>
                <p className="text-xs text-slate-400">{fmtDate(call.created_at || call.date)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Messaging page ──────────────────────────────────────────────────────

// ── Sent History ─────────────────────────────────────────────────────────────

function SentHistory() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.getSentMessages()
      .then(data => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = messages.filter(m => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (m.contact_name || '').toLowerCase().includes(q) ||
        (m.subject || '').toLowerCase().includes(q) ||
        (m.body || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  function fmtDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'email', label: '📧 Email' },
            { id: 'whatsapp', label: '💬 WhatsApp' },
            { id: 'sms', label: '📱 SMS' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterType === f.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 ml-auto">{filtered.length} message{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center pt-12">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center pt-12 text-slate-400 text-sm">Aucun message envoyé</div>
        ) : filtered.map(msg => {
          const isEmail = msg.type === 'email';
          const isOpen = expanded === msg.id;
          const badge = msg.type === 'email' ? { bg: 'bg-blue-100', icon: '📧' }
            : msg.type === 'sms' ? { bg: 'bg-orange-100', icon: '📱' }
            : { bg: 'bg-emerald-100', icon: '💬' };
          return (
            <div
              key={msg.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-indigo-200 transition-colors"
            >
              {/* Header row */}
              <button
                className="w-full flex items-start gap-3 px-4 py-3 text-left"
                onClick={() => setExpanded(isOpen ? null : msg.id)}
              >
                {/* Type badge */}
                <span className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm ${badge.bg}`}>
                  {badge.icon}
                </span>

                <div className="flex-1 min-w-0">
                  {/* Contact + subject */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {msg.contact_name && (
                      <span className="text-sm font-semibold text-slate-700">{msg.contact_name}</span>
                    )}
                    {isEmail && msg.subject && (
                      <span className="text-sm text-slate-500 truncate">— {msg.subject}</span>
                    )}
                    {!msg.contact_name && (
                      <span className="text-sm text-slate-400 italic">Contact supprimé</span>
                    )}
                  </div>
                  {/* Preview */}
                  <p className="text-xs text-slate-400 truncate mt-0.5">{msg.body}</p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-slate-400 whitespace-nowrap">{fmtDate(msg.sent_at)}</p>
                  <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    msg.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {msg.status === 'sent' ? 'Envoyé' : msg.status}
                  </span>
                </div>

                <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Expanded body */}
              {isOpen && (
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                  {isEmail && msg.subject && (
                    <p className="text-xs font-semibold text-slate-500 mb-2">Objet : {msg.subject}</p>
                  )}
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{msg.body}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Messaging() {
  const [tab, setTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(undefined);
  const [loading, setLoading] = useState(true);

  const loadTemplates = useCallback(async () => {
    try {
      const list = await api.getTemplates();
      setTemplates(list);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  function handleNew() {
    setSelectedTemplate(null); // null = new (empty form), undefined = nothing selected
  }

  function handleSaved(saved) {
    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setSelectedTemplate(saved);
  }

  function handleDeleted(id) {
    setTemplates(prev => prev.filter(t => t.id !== id));
    setSelectedTemplate(undefined);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 shadow-sm">
        {[
          { id: 'templates', label: 'Modèles' },
          { id: 'history', label: 'Historique' },
          { id: 'calls', label: 'Appels' },
          { id: 'whatsapp', label: 'WhatsApp' },
          { id: 'smtp', label: 'Paramètres SMTP' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'smtp' ? (
        <SmtpSettings />
      ) : tab === 'whatsapp' ? (
        <WhatsAppSettings />
      ) : tab === 'history' ? (
        <SentHistory />
      ) : tab === 'calls' ? (
        <CallHistory />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — template list */}
          <div className="w-72 border-r border-slate-200 bg-white flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Modèles</span>
              <button
                onClick={handleNew}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Nouveau
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : templates.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-4 py-3">Aucun modèle. Créez-en un !</p>
              ) : (
                templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                      selectedTemplate?.id === t.id ? 'bg-indigo-50 border-r-2 border-indigo-500' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      t.type === 'whatsapp' ? 'bg-[#25D366]/10' : 'bg-indigo-50'
                    }`}>
                      {t.type === 'whatsapp'
                        ? <MessageSquare className="w-4 h-4 text-[#25D366]" />
                        : <Mail className="w-4 h-4 text-indigo-500" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        t.type === 'whatsapp'
                          ? 'bg-[#25D366]/10 text-[#25D366]'
                          : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        {t.type === 'whatsapp' ? 'WhatsApp' : 'Email'}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel — editor */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {selectedTemplate === undefined ? (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Sélectionnez un modèle ou créez-en un nouveau</p>
                </div>
              </div>
            ) : (
              <TemplateEditor
                key={selectedTemplate?.id ?? 'new'}
                template={selectedTemplate}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
