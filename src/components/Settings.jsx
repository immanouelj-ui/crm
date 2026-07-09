import React, { useEffect, useState } from 'react';
import { Save, Zap, Receipt, Send, Kanban, CalendarDays, BarChart3, Key, Users, Lock, Phone, Loader2, CheckCircle, Upload, Trash2, CreditCard } from 'lucide-react';
import { api } from '../api.js';

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

const MODULES = [
  { key: 'contacts',    label: 'Contacts',           desc: 'Gestion de la base de contacts clients',         icon: Users,       required: true },
  { key: 'pipeline',    label: 'Pipeline',            desc: 'Suivi des opportunités commerciales',             icon: Kanban },
  { key: 'billing',     label: 'Facturation',         desc: 'Devis, factures, catalogue produits',             icon: Receipt },
  { key: 'messaging',   label: 'Messagerie',          desc: 'Envoi email & WhatsApp, modèles de messages',     icon: Send },
  { key: 'planning',    label: 'Planning',            desc: 'Calendrier des rendez-vous hebdomadaire',         icon: CalendarDays },
  { key: 'reports',     label: 'Rapports',            desc: 'Statistiques et indicateurs de performance',      icon: BarChart3 },
  { key: 'api',         label: 'API & Intégrations',  desc: 'Accès API externe, clé API, documentation',      icon: Key },
  { key: 'automations', label: 'Automatisations',     desc: 'Règles de relance automatique par statut/délai',  icon: Zap },
];

const INTEGRATIONS = [
  {
    key: 'b2brouter',
    label: 'B2BRouter',
    desc: 'Facturation électronique B2B — envoi et suivi des factures',
    logo: '🧾',
    fields: [
      { key: 'b2brouter_api_key', label: 'Clé API B2BRouter', type: 'password', placeholder: 'Votre clé API...' },
    ],
  },
];

function Toggle({ enabled, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function Settings() {
  const [modules, setModules] = useState({});
  const [integrations, setIntegrations] = useState({ b2brouter_api_key: '', chorus_client_id: '', chorus_env: 'sandbox' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState({ text: '', ok: false });
  const [stripeStatus, setStripeStatus] = useState({ connected: false });
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeError, setStripeError] = useState('');

  useEffect(() => {
    api.getStripeStatus().then(setStripeStatus).catch(() => {});
  }, []);

  async function handleConnectStripe() {
    setStripeConnecting(true);
    setStripeError('');
    try {
      const res = await api.connectStripe(stripeSecretKey);
      setStripeStatus(res);
      setStripeSecretKey('');
    } catch (e) {
      setStripeError(e.message);
    } finally {
      setStripeConnecting(false);
    }
  }

  async function handleDisconnectStripe() {
    await api.disconnectStripe();
    setStripeStatus({ connected: false });
  }

  const [twilioStatus, setTwilioStatus] = useState({ connected: false, phoneNumber: null });
  const [twilioForm, setTwilioForm] = useState({ accountSid: '', authToken: '', phoneNumber: '' });
  const [twilioConnecting, setTwilioConnecting] = useState(false);
  const [twilioError, setTwilioError] = useState('');
  const [greeting, setGreeting] = useState('');
  const [greetingSaving, setGreetingSaving] = useState(false);
  const [greetingSaved, setGreetingSaved] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioError, setAudioError] = useState('');

  useEffect(() => {
    api.getTwilioStatus().then(s => {
      setTwilioStatus(s);
      setGreeting(s.voicemailGreeting || '');
      setAudioUrl(s.voicemailAudioUrl || null);
    }).catch(() => {});
  }, []);

  async function handleSaveGreeting() {
    setGreetingSaving(true);
    try {
      await api.saveTwilioGreeting(greeting);
      setGreetingSaved(true);
      setTimeout(() => setGreetingSaved(false), 2000);
    } finally {
      setGreetingSaving(false);
    }
  }

  async function handleUploadAudio(file) {
    if (!file) return;
    setAudioUploading(true);
    setAudioError('');
    try {
      const res = await api.uploadTwilioGreetingAudio(file);
      setAudioUrl(res.voicemailAudioUrl);
    } catch (e) {
      setAudioError(e.message);
    } finally {
      setAudioUploading(false);
    }
  }

  async function handleRemoveAudio() {
    await api.deleteTwilioGreetingAudio();
    setAudioUrl(null);
  }

  async function handleConnectTwilio() {
    setTwilioConnecting(true);
    setTwilioError('');
    try {
      const res = await api.connectTwilio(twilioForm);
      setTwilioStatus(res);
      setTwilioForm({ accountSid: '', authToken: '', phoneNumber: '' });
    } catch (e) {
      setTwilioError(e.message);
    } finally {
      setTwilioConnecting(false);
    }
  }

  async function handleDisconnectTwilio() {
    await api.disconnectTwilio();
    setTwilioStatus({ connected: false, phoneNumber: null });
  }

  useEffect(() => {
    apiFetch('GET', '/app-settings').then(data => {
      setModules(data.modules || {});
      setIntegrations({
        b2brouter_api_key: data.b2brouter_api_key || '',
        chorus_client_id: data.chorus_client_id || '',
        chorus_env: data.chorus_env || 'sandbox',
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await apiFetch('POST', '/app-settings', { modules, ...integrations });
      setSaved(true);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (pwdForm.next !== pwdForm.confirm) return setPwdMsg({ text: 'Les mots de passe ne correspondent pas', ok: false });
    if (pwdForm.next.length < 8) return setPwdMsg({ text: '8 caractères minimum', ok: false });
    try {
      await apiFetch('POST', '/users/change-password', { current: pwdForm.current, next: pwdForm.next });
      setPwdMsg({ text: 'Mot de passe modifié avec succès', ok: true });
      setPwdForm({ current: '', next: '', confirm: '' });
    } catch (e) {
      setPwdMsg({ text: e.message, ok: false });
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Réglages</h1>
          <p className="text-slate-500 text-sm mt-1">Activez ou désactivez les fonctionnalités de votre CRM</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : saved ? '✓ Enregistré' : 'Enregistrer'}
        </button>
      </div>

      {/* Modules */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-indigo-500 rounded-full inline-block" />
          Modules
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
          {MODULES.map(({ key, label, desc, icon: Icon, required }) => (
            <div key={key} className="flex items-center gap-4 px-5 py-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${modules[key] !== false ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  {required && <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">requis</span>}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
              <Toggle
                enabled={required ? true : (modules[key] !== false)}
                onChange={val => setModules(m => ({ ...m, [key]: val }))}
                disabled={required}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Intégrations */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block" />
          Intégrations
        </h2>
        <div className="space-y-3">
          {INTEGRATIONS.map(intg => (
            <div key={intg.key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-lg flex-shrink-0">{intg.logo}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{intg.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{intg.desc}</p>
                </div>
                <Toggle
                  enabled={!!(modules[intg.key])}
                  onChange={val => setModules(m => ({ ...m, [intg.key]: val }))}
                />
              </div>
              {modules[intg.key] && (
                <div className="px-5 py-4 bg-slate-50 space-y-3">
                  {intg.fields.map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input
                        type={f.type || 'text'}
                        value={integrations[f.key] || ''}
                        onChange={e => setIntegrations(i => ({ ...i, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Chorus Pro */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-lg flex-shrink-0">🏛️</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Chorus Pro</p>
                <p className="text-xs text-slate-500 mt-0.5">Dépôt de factures sur la plateforme gouvernementale (marchés publics)</p>
              </div>
              <Toggle
                enabled={!!(modules['chorus'])}
                onChange={val => setModules(m => ({ ...m, chorus: val }))}
              />
            </div>
            {modules['chorus'] && (
              <div className="px-5 py-4 bg-slate-50 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Client ID PISTE</label>
                  <input
                    type="text"
                    value={integrations.chorus_client_id || ''}
                    onChange={e => setIntegrations(i => ({ ...i, chorus_client_id: e.target.value }))}
                    placeholder="Votre client_id PISTE..."
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Environnement</label>
                  <select
                    value={integrations.chorus_env || 'sandbox'}
                    onChange={e => setIntegrations(i => ({ ...i, chorus_env: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="sandbox">Sandbox (test)</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Twilio */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Twilio (téléphonie)</p>
                <p className="text-xs text-slate-500 mt-0.5">Appels sortants depuis le CRM avec votre propre compte Twilio</p>
              </div>
              {twilioStatus.connected && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border text-emerald-700 bg-emerald-50 border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Connecté
                </span>
              )}
            </div>
            <div className="px-5 py-4 bg-slate-50 space-y-3">
              {twilioStatus.connected ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-700">Numéro Twilio : <span className="font-medium">{twilioStatus.phoneNumber}</span></p>
                      <p className="text-xs text-slate-500 mt-0.5">Compte : {twilioStatus.accountSid}</p>
                    </div>
                    <button
                      onClick={handleDisconnectTwilio}
                      className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Déconnecter
                    </button>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Message d'accueil de la messagerie vocale (appels entrants)</label>
                    <textarea
                      value={greeting}
                      onChange={e => setGreeting(e.target.value)}
                      rows={2}
                      placeholder="Bonjour, vous êtes bien sur la messagerie. Merci de laisser votre message après le bip."
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <button
                      onClick={handleSaveGreeting}
                      disabled={greetingSaving}
                      className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {greetingSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : greetingSaved ? <CheckCircle className="w-4 h-4" /> : null}
                      {greetingSaved ? 'Enregistré' : 'Enregistrer le message'}
                    </button>
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Ou utiliser un fichier audio (remplace le message texte)
                    </label>
                    {audioUrl ? (
                      <div className="flex items-center gap-3">
                        <audio controls src={audioUrl} className="h-9 flex-1" />
                        <button
                          onClick={handleRemoveAudio}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="Supprimer le fichier audio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-dashed border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors w-fit">
                        {audioUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {audioUploading ? 'Envoi…' : 'Choisir un fichier MP3/WAV'}
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          disabled={audioUploading}
                          onChange={e => handleUploadAudio(e.target.files?.[0])}
                        />
                      </label>
                    )}
                    {audioError && <p className="text-xs text-red-600 mt-1">{audioError}</p>}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Account SID</label>
                    <input
                      type="text"
                      value={twilioForm.accountSid}
                      onChange={e => setTwilioForm(f => ({ ...f, accountSid: e.target.value }))}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Auth Token</label>
                    <input
                      type="password"
                      value={twilioForm.authToken}
                      onChange={e => setTwilioForm(f => ({ ...f, authToken: e.target.value }))}
                      placeholder="Votre Auth Token Twilio..."
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Numéro Twilio</label>
                    <input
                      type="text"
                      value={twilioForm.phoneNumber}
                      onChange={e => setTwilioForm(f => ({ ...f, phoneNumber: e.target.value }))}
                      placeholder="+33612345678"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  {twilioError && <p className="text-xs text-red-600">{twilioError}</p>}
                  <button
                    onClick={handleConnectTwilio}
                    disabled={twilioConnecting || !twilioForm.accountSid || !twilioForm.authToken || !twilioForm.phoneNumber}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {twilioConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                    Connecter Twilio
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stripe */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-violet-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Stripe (paiement en ligne)</p>
                <p className="text-xs text-slate-500 mt-0.5">Ajoute un lien de paiement par carte sur les factures envoyées par email</p>
              </div>
              {stripeStatus.connected && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border text-emerald-700 bg-emerald-50 border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Connecté
                </span>
              )}
            </div>
            <div className="px-5 py-4 bg-slate-50 space-y-3">
              {stripeStatus.connected ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-700">Stripe est connecté. Les factures envoyées incluront un bouton "Payer en ligne".</p>
                  <button
                    onClick={handleDisconnectStripe}
                    className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                  >
                    Déconnecter
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Clé secrète Stripe</label>
                    <input
                      type="password"
                      value={stripeSecretKey}
                      onChange={e => setStripeSecretKey(e.target.value)}
                      placeholder="sk_live_... ou sk_test_..."
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <p className="text-xs text-slate-400 mt-1">Disponible dans Stripe → Développeurs → Clés API.</p>
                  </div>
                  {stripeError && <p className="text-xs text-red-600">{stripeError}</p>}
                  <button
                    onClick={handleConnectStripe}
                    disabled={stripeConnecting || !stripeSecretKey}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {stripeConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    Connecter Stripe
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Mot de passe */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-rose-500 rounded-full inline-block" />
          Changer le mot de passe
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          {[
            { key: 'current', label: 'Mot de passe actuel' },
            { key: 'next', label: 'Nouveau mot de passe' },
            { key: 'confirm', label: 'Confirmer le nouveau mot de passe' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
              <input
                type="password"
                value={pwdForm[f.key]}
                onChange={e => setPwdForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder="••••••••"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}
          {pwdMsg.text && (
            <p className={`text-sm ${pwdMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{pwdMsg.text}</p>
          )}
          <button
            onClick={changePassword}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Lock className="w-4 h-4" />
            Mettre à jour le mot de passe
          </button>
        </div>
      </section>

      <div className="flex justify-end pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : saved ? '✓ Enregistré !' : 'Enregistrer les réglages'}
        </button>
      </div>
    </div>
  );
}
