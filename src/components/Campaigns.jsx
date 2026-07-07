import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import {
  Phone, PhoneOff, Trash2, Loader2, ChevronLeft, CheckCircle,
  XCircle, Voicemail, Clock, PlayCircle, Users, X, MessageSquare, Smartphone,
} from 'lucide-react';

export function CreateCampaignModal({ contactIds, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [smsTemplateId, setSmsTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getTemplates().then(list => setTemplates(list.filter(t => t.type === 'sms'))).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const campaign = await api.createCampaign({
        name: name.trim(),
        contact_ids: contactIds,
        sms_template_id: smsTemplateId || null,
      });
      onCreated(campaign);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Nouvelle campagne d'appels</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom de la campagne</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Relance leads juillet"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-xs text-slate-500">{contactIds.length} contact{contactIds.length > 1 ? 's' : ''} sélectionné{contactIds.length > 1 ? 's' : ''}</p>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-orange-500" />
              Modèle SMS à envoyer pendant la campagne (optionnel)
            </label>
            {templates.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucun modèle SMS créé — vas dans Messagerie → Modèles pour en créer un.</p>
            ) : (
              <select
                value={smsTemplateId}
                onChange={e => setSmsTemplateId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">— Aucun —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              Créer la campagne
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const OUTCOMES = [
  { id: 'answered', label: 'Répondu', icon: CheckCircle, color: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50' },
  { id: 'no_answer', label: 'Pas de réponse', icon: XCircle, color: 'text-slate-500 border-slate-200 hover:bg-slate-50' },
  { id: 'voicemail', label: 'Répondeur', icon: Voicemail, color: 'text-amber-600 border-amber-200 hover:bg-amber-50' },
  { id: 'busy', label: 'Occupé', icon: PhoneOff, color: 'text-red-500 border-red-200 hover:bg-red-50' },
  { id: 'callback', label: 'Rappeler plus tard', icon: Clock, color: 'text-indigo-600 border-indigo-200 hover:bg-indigo-50' },
];

function findPhone(customData, fields) {
  const phoneField = fields.find(f => f.type === 'phone' || f.type === 'tel');
  if (phoneField && customData[phoneField.name]) return customData[phoneField.name];
  return customData.phone || customData.telephone || customData.tel || '';
}

function fillVariables(text, cd) {
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return (text || '')
    .replace(/\{\{name\}\}/g, cd.nom || cd.name || '')
    .replace(/\{\{company\}\}/g, cd.company || cd.entreprise || '')
    .replace(/\{\{email\}\}/g, cd.email || '')
    .replace(/\{\{phone\}\}/g, cd.phone || cd.telephone || '')
    .replace(/\{\{date\}\}/g, today);
}

function CampaignDialer({ campaignId, onExit }) {
  const [campaign, setCampaign] = useState(null);
  const [fields, setFields] = useState([]);
  const [smsTemplate, setSmsTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsError, setSmsError] = useState('');

  const load = useCallback(async () => {
    const [c, f, templates] = await Promise.all([api.getCampaign(campaignId), api.getFields(), api.getTemplates()]);
    setCampaign(c);
    setFields(f);
    setSmsTemplate(c.sms_template_id ? templates.find(t => String(t.id) === String(c.sms_template_id)) : null);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;
  }

  const current = campaign.items.find(i => i.status === 'pending');
  const doneCount = campaign.items.filter(i => i.status === 'done').length;
  const total = campaign.items.length;

  async function handleOutcome(outcome) {
    setSaving(true);
    try {
      await api.recordCampaignOutcome(campaignId, current.id, { outcome, notes });
      setNotes('');
      setSmsSent(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function handleCall() {
    const phone = findPhone(current.custom_data, fields);
    if (phone) window.dispatchEvent(new CustomEvent('crm:call-number', { detail: { number: phone, contactId: current.contact_id } }));
  }

  async function handleSendSms() {
    const phone = findPhone(current.custom_data, fields);
    if (!phone || !smsTemplate) return;
    setSmsSending(true);
    setSmsError('');
    try {
      await api.sendSms({ contact_id: current.contact_id, phone, body: fillVariables(smsTemplate.body, current.custom_data) });
      setSmsSent(true);
    } catch (e) {
      setSmsError(e.message);
    } finally {
      setSmsSending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Campagnes
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-900">{campaign.name}</span>
        <div className="flex-1" />
        <span className="text-sm text-slate-500">{doneCount} / {total} appelés</span>
      </div>

      <div className="flex-1 overflow-y-auto flex items-center justify-center p-8">
        {!current ? (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-slate-900">Campagne terminée !</p>
            <p className="text-sm text-slate-500 mt-1">Tous les contacts ont été appelés.</p>
            <button onClick={onExit} className="mt-4 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors">
              Retour aux campagnes
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-semibold mx-auto mb-3">
                {(current.custom_data.nom || current.custom_data.name || '?').slice(0, 2).toUpperCase()}
              </div>
              <p className="text-lg font-semibold text-slate-900">{current.custom_data.nom || current.custom_data.name || `Contact #${current.contact_id}`}</p>
              <p className="text-sm text-slate-500">{current.custom_data.company || ''}</p>
              <p className="text-sm text-indigo-600 font-mono mt-1">{findPhone(current.custom_data, fields) || 'Aucun numéro'}</p>
              {current.attempts > 0 && (
                <p className="text-xs text-amber-600 mt-1">Tentative {current.attempts + 1} (rappel)</p>
              )}
            </div>

            <button
              onClick={handleCall}
              disabled={!findPhone(current.custom_data, fields)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 disabled:opacity-40 transition-colors mb-2"
            >
              <Phone className="w-4 h-4" />
              Appeler
            </button>

            {smsTemplate && (
              <button
                onClick={handleSendSms}
                disabled={smsSending || smsSent || !findPhone(current.custom_data, fields)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-50 text-orange-700 border border-orange-200 text-sm font-medium rounded-xl hover:bg-orange-100 disabled:opacity-50 transition-colors mb-4"
              >
                {smsSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                {smsSent ? 'SMS envoyé' : `Envoyer SMS "${smsTemplate.name}"`}
              </button>
            )}
            {smsError && <p className="text-xs text-red-600 mb-3">{smsError}</p>}

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes sur l'appel (optionnel)…"
              rows={2}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-4 resize-none outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />

            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map(o => (
                <button
                  key={o.id}
                  disabled={saving}
                  onClick={() => handleOutcome(o.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-xl transition-colors disabled:opacity-40 ${o.color}`}
                >
                  <o.icon className="w-4 h-4" />
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCampaignId, setActiveCampaignId] = useState(null);

  const load = useCallback(async () => {
    const list = await api.getCampaigns();
    setCampaigns(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Supprimer cette campagne ?')) return;
    await api.deleteCampaign(id);
    load();
  }

  if (activeCampaignId) {
    return <CampaignDialer campaignId={activeCampaignId} onExit={() => { setActiveCampaignId(null); load(); }} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold text-slate-900 mb-1">Campagnes d'appels</h1>
      <p className="text-sm text-slate-500 mb-5">Crée une campagne depuis la liste des contacts (sélectionne des contacts → "Créer une campagne d'appels")</p>

      {loading ? (
        <div className="flex justify-center pt-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : campaigns.length === 0 ? (
        <div className="text-center pt-12 text-slate-400 text-sm">
          <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          Aucune campagne pour l'instant
        </div>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {campaigns.map(c => {
            const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
            const finished = c.done >= c.total && c.total > 0;
            return (
              <div
                key={c.id}
                onClick={() => setActiveCampaignId(c.id)}
                className="bg-white rounded-xl border border-slate-200 hover:border-indigo-200 px-4 py-3 flex items-center gap-4 cursor-pointer transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <PlayCircle className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{c.name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-xs">
                      <div className={`h-full rounded-full ${finished ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{c.done} / {c.total}</span>
                  </div>
                </div>
                <button onClick={(e) => handleDelete(c.id, e)} className="p-2 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
