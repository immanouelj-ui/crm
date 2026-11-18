self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let message = {};
  try { message = event.data?.json() || {}; } catch { /* A generic alert remains available. */ }
  const contactId = Number(message.contactId);
  const invoiceId = Number(message.invoiceId);
  event.waitUntil(self.registration.showNotification(message.title || 'Nouveau lead reçu', {
    body: message.body || 'Ouvre le CRM pour consulter la fiche.',
    tag: message.tag || 'nouveau-lead',
    renotify: false,
    icon: '/push-icon-192.png',
    badge: '/push-icon-192.png',
    data: { contactId: Number.isSafeInteger(contactId) && contactId > 0 ? contactId : null, invoiceId: Number.isSafeInteger(invoiceId) && invoiceId > 0 ? invoiceId : null },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const id = Number(event.notification.data?.contactId);
  const invoiceId = Number(event.notification.data?.invoiceId);
  const target = new URL('/', self.location.origin);
  if (Number.isSafeInteger(invoiceId) && invoiceId > 0) target.searchParams.set('document', String(invoiceId));
  else if (Number.isSafeInteger(id) && id > 0) target.searchParams.set('contact', String(id));
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find(window => new URL(window.url).origin === target.origin);
    if (client) {
      await client.navigate(target.href);
      return client.focus();
    }
    return self.clients.openWindow(target.href);
  })());
});
