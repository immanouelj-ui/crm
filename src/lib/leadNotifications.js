export async function notificationRequest(path, body, token = localStorage.getItem('crm_token')) {
  const response = await fetch('/api/notifications' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) throw new Error('Les notifications doivent encore être installées sur le backend Fly.io.');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Impossible de configurer les alertes.');
  return data;
}

export function applicationKey(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized + '='.repeat((4 - normalized.length % 4) % 4)), character => character.charCodeAt(0));
}

export async function disableLeadNotifications() {
  const registration = await navigator.serviceWorker?.getRegistration('/push-sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await notificationRequest('/unsubscribe', { endpoint });
}
