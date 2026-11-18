import { useEffect, useState } from 'react';
import { Bell, BellRing, CheckCircle, X } from 'lucide-react';
import { applicationKey, disableLeadNotifications, notificationRequest } from '../lib/leadNotifications.js';

const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

export default function LeadNotifications() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supported || Notification.permission !== 'granted') return;
    let active = true;
    navigator.serviceWorker.getRegistration('/push-sw.js')
      .then(async registration => {
        registration?.update().catch(() => {});
        return registration?.pushManager.getSubscription();
      })
      .then(async subscription => {
        if (!subscription) return;
        const status = await notificationRequest('/check', { endpoint: subscription.endpoint });
        if (active) setEnabled(status.enabled);
      }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open || !supported || (ios && !standalone)) return;
    let active = true;
    setError('');
    notificationRequest('/config').then(result => {
      if (active) setConfig(result);
    }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [open]);

  async function activate() {
    setError(''); setMessage(''); setBusy(true);
    let created = null;
    try {
      // Permission must be requested directly from the user's click on iOS.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Autorise les notifications du CRM dans les réglages de ton appareil.');
      const registration = await navigator.serviceWorker.register('/push-sw.js');
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(config.publicKey) });
        created = subscription;
      }
      await notificationRequest('/subscribe', subscription.toJSON());
      setEnabled(true);
      setMessage('Les alertes de nouveaux leads sont activées sur cet appareil.');
    } catch (failure) {
      if (created) await created.unsubscribe().catch(() => {});
      setError(failure.message || 'Impossible d’activer les alertes.');
    } finally { setBusy(false); }
  }

  async function deactivate() {
    setBusy(true); setError(''); setMessage('');
    try {
      await disableLeadNotifications();
      setEnabled(false);
      setMessage('Alertes désactivées sur cet appareil.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  async function test() {
    setBusy(true); setError(''); setMessage('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw new Error('Réactive les alertes sur cet appareil.');
      await notificationRequest('/test', { endpoint: subscription.endpoint });
      setMessage('Notification de test envoyée. Vérifie les notifications de ton téléphone.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Notifications du CRM" aria-label="Notifications du CRM" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50">
        {enabled ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="lead-notification-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="lead-notification-title" className="text-lg font-semibold text-slate-900">Alertes du CRM</h2>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="Fermer les réglages des notifications" className="p-2 text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-3 text-sm text-slate-600">Reçois une notification pour les nouveaux leads et les devis acceptés. Appuie sur l’alerte pour ouvrir la fiche ou le devis.</p>
            {ios && !standalone ? (
              <ol className="mt-4 list-inside list-decimal space-y-2 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">
                <li>Dans Safari, appuie sur Partager.</li>
                <li>Choisis « Sur l’écran d’accueil ».</li>
                <li>Ouvre le CRM depuis sa nouvelle icône et connecte-toi.</li>
                <li>Appuie sur cette cloche puis active les notifications.</li>
              </ol>
            ) : !supported ? (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Les notifications push ne sont pas disponibles ici. Sur iPhone, utilise iOS 16.4 ou plus récent et ajoute le CRM à l’écran d’accueil depuis Safari.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {enabled ? (
                  <>
                    <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle className="h-4 w-4" /> Alertes activées sur cet appareil</p>
                    <button type="button" disabled={busy} onClick={test} className="min-h-11 w-full rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white disabled:opacity-50">Envoyer une notification de test</button>
                    <button type="button" disabled={busy} onClick={deactivate} className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-600 disabled:opacity-50">Désactiver sur cet appareil</button>
                  </>
                ) : (
                  <button type="button" disabled={busy || !config} onClick={activate} className="min-h-11 w-full rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Activation…' : 'Activer les notifications'}</button>
                )}
              </div>
            )}
            {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            {message && <p role="status" className="mt-3 text-sm text-slate-600">{message}</p>}
          </section>
        </div>
      )}
    </>
  );
}
