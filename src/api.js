import Papa from 'papaparse';
import { appointmentsForWeek } from './lib/calendar.js';

const BASE = '/api';

function getToken() {
  return localStorage.getItem('crm_token');
}

function headers(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request(method, path, body) {
  const opts = { method, headers: headers() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 401 && !path.includes('/auth/')) {
    localStorage.removeItem('crm_token');
    window.location.href = '/';
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const CONTACT_EXPORT_COLUMNS = [
  ['Type de client', 'type_client', 'client_type', 'customer_type'],
  ['Nom de l’entreprise', 'entreprise', 'company', 'company_name', 'raison_sociale', 'societe'],
  ['Prénom', 'first_name', 'firstname'],
  ['Nom', 'nom_de_famille', 'last_name', 'lastname', 'name'],
  ['Adresse e-mail', 'email', 'e_mail', 'adresse_email', 'courriel'],
  ['Adresse de facturation', 'adresse_facturation', 'billing_address', 'adresse', 'address', 'adresse_postale'],
  ['Code postal de facturation', 'cp_facturation', 'code_postal_facturation', 'billing_postal_code', 'billing_zip', 'cp', 'code_postal', 'codepostal', 'postal_code', 'zip'],
  ['Ville de facturation', 'ville_facturation', 'billing_city', 'ville', 'city', 'commune'],
  ['Province de facturation', 'province_facturation', 'region_facturation', 'billing_province', 'billing_state', 'province', 'region'],
  ['Pays de facturation', 'pays_facturation', 'billing_country', 'pays', 'country'],
  ['Adresse de livraison', 'adresse_livraison', 'shipping_address', 'delivery_address'],
  ['Code postal de livraison', 'cp_livraison', 'code_postal_livraison', 'shipping_postal_code', 'shipping_zip', 'delivery_postal_code'],
  ['Ville de livraison', 'ville_livraison', 'shipping_city', 'delivery_city'],
  ['Province de livraison', 'province_livraison', 'region_livraison', 'shipping_province', 'shipping_state', 'delivery_province'],
  ['Pays de livraison', 'pays_livraison', 'shipping_country', 'delivery_country'],
  ['SIREN/SIRET', 'siret', 'siren', 'client_siret'],
  ['Numéro de TVA', 'tva_number', 'vat_number', 'vat_id', 'tva_intracommunautaire', 'numero_tva', 'n_tva'],
  ['Langue', 'language', 'lang', 'locale'],
  ['Devise', 'currency', 'currency_code'],
];

function normalizeContactField(name) {
  return String(name ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function contactExportRow(contact, fields) {
  const data = contact.custom_data ?? {};
  const values = new Map();
  for (const [name, value] of Object.entries(data)) {
    if (typeof value === 'number' || (typeof value === 'string' && value.trim())) {
      values.set(normalizeContactField(name), value);
    }
  }
  for (const field of fields) {
    const label = normalizeContactField(field.label);
    const value = values.get(normalizeContactField(field.name));
    if (value !== undefined && !values.has(label)) values.set(label, value);
  }
  return CONTACT_EXPORT_COLUMNS.map(names => {
    for (const name of names) {
      const value = values.get(normalizeContactField(name));
      if (value !== undefined) return value;
    }
    return '';
  });
}

function downloadContactsCSV(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'contacts.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),

  // User
  getMe: () => request('GET', '/users/me'),
  regenerateKey: () => request('POST', '/users/me/regenerate-key'),

  // Fields
  getFields: () => request('GET', '/fields'),
  createField: (data) => request('POST', '/fields', data),
  updateField: (id, data) => request('PUT', `/fields/${id}`, data),
  deleteField: (id) => request('DELETE', `/fields/${id}`),

  // Contacts
  getContacts: () => request('GET', '/contacts'),
  createContact: (data) => request('POST', '/contacts', data),
  updateContact: (id, data) => request('PUT', `/contacts/${id}`, data),
  deleteContact: (id) => request('DELETE', `/contacts/${id}`),
  exportCSV: async () => {
    const response = await fetch(`${BASE}/contacts/export/csv`, { headers: headers() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    downloadContactsCSV(await response.blob());
  },
  exportSelectedCSV: (contacts, fields, selectedIds) => {
    const selected = contacts.filter(contact => selectedIds.has(contact.id));
    if (!selected.length) return;
    const csv = Papa.unparse({
      fields: CONTACT_EXPORT_COLUMNS.map(([label]) => label),
      data: selected.map(contact => contactExportRow(contact, fields)),
    }, { escapeFormulae: true });
    downloadContactsCSV(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  },
  importCSV: (csvText) => {
    return fetch(`${BASE}/contacts/import/csv`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'text/plain' },
      body: csvText,
    }).then(r => r.json());
  },

  // Contact sub-resources
  getContactInteractions: (id) => request('GET', `/contacts/${id}/interactions`),
  createContactInteraction: (id, data) => request('POST', `/contacts/${id}/interactions`, data),
  getContactTasks: (id) => request('GET', `/contacts/${id}/tasks`),
  createContactTask: (id, data) => request('POST', `/contacts/${id}/tasks`, data),

  // Opportunities
  getOpportunities: () => request('GET', '/opportunities'),
  createOpportunity: (data) => request('POST', '/opportunities', data),
  updateOpportunity: (id, data) => request('PUT', `/opportunities/${id}`, data),
  deleteOpportunity: (id) => request('DELETE', `/opportunities/${id}`),

  // Tasks
  getTasks: () => request('GET', '/tasks'),
  createTask: (data) => request('POST', '/tasks', data),
  updateTask: (id, data) => request('PUT', `/tasks/${id}`, data),
  deleteTask: (id) => request('DELETE', `/tasks/${id}`),

  // Interactions
  getInteractions: () => request('GET', '/interactions'),
  createInteraction: (data) => request('POST', '/interactions', data),
  updateInteraction: (id, data) => request('PUT', `/interactions/${id}`, data),
  deleteInteraction: (id) => request('DELETE', `/interactions/${id}`),

  // Dashboard / Reports
  getDashboard: () => request('GET', '/dashboard'),
  getReports: () => request('GET', '/dashboard'),

  // Messaging — Templates
  getTemplates: () => request('GET', '/messaging/templates'),
  createTemplate: (data) => request('POST', '/messaging/templates', data),
  updateTemplate: (id, data) => request('PUT', `/messaging/templates/${id}`, data),
  deleteTemplate: (id) => request('DELETE', `/messaging/templates/${id}`),

  // Messaging — SMTP
  getSmtpConfig: () => request('GET', '/messaging/smtp'),
  saveSmtpConfig: (data) => request('POST', '/messaging/smtp', data),
  testSmtp: () => request('POST', '/messaging/smtp/test'),

  // Messaging — Send
  sendEmail: (data) => request('POST', '/messaging/send/email', data),
  sendWhatsApp: (data) => request('POST', '/messaging/whatsapp/send', data),
  sendSms: (data) => request('POST', '/messaging/sms/send', data),
  getSentMessages: () => request('GET', '/messaging/sent'),

  // Attachments
  getAttachments: (contactId) => request('GET', `/attachments/${contactId}`),
  uploadAttachments: (contactId, files) => {
    const token = localStorage.getItem('crm_token');
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    return fetch(`/api/attachments/${contactId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(r => r.json());
  },
  deleteAttachment: (id) => request('DELETE', `/attachments/${id}`),
  getAttachmentUrl: (filename) => {
    // Pièce jointe déjà hébergée ailleurs (ex: photo Uploadcare d'un lead) : URL directe.
    if (/^https?:\/\//i.test(filename)) return filename;
    const token = localStorage.getItem('crm_token');
    return `/api/attachments/file/${filename}?token=${token}`;
  },

  // Appointments
  getContactAppointments: (contactId) => request('GET', `/appointments/contact/${contactId}`),
  getAppointments: async (weekStart) => appointmentsForWeek(await request('GET', '/appointments'), weekStart),
  createAppointment: (data) => request('POST', '/appointments', data),
  updateAppointment: (id, data) => request('PUT', `/appointments/${id}`, data),
  deleteAppointment: (id) => request('DELETE', `/appointments/${id}`),
  getPendingCount: () => request('GET', '/appointments/pending-count'),
  getAvailability: () => request('GET', '/appointments/availability'),
  createAvailabilitySlot: (data) => request('POST', '/appointments/availability', data),
  deleteAvailabilitySlot: (id) => request('DELETE', `/appointments/availability/${id}`),

  // Team
  getTeam: () => request('GET', '/team'),
  createEmployee: (data) => request('POST', '/team', data),
  updateEmployee: (id, data) => request('PUT', `/team/${id}`, data),
  deleteEmployee: (id) => request('DELETE', `/team/${id}`),

  // Automations
  getAutomations: () => request('GET', '/automations'),
  createAutomation: (data) => request('POST', '/automations', data),
  updateAutomation: (id, data) => request('PUT', `/automations/${id}`, data),
  deleteAutomation: (id) => request('DELETE', `/automations/${id}`),
  simulateAutomation: (id) => request('POST', `/automations/${id}/simulate`),
  runAutomation: (id) => request('POST', `/automations/${id}/run`),

  // B2BRouter
  getB2BrouterStatus: (id) => request('GET', `/invoices/${id}/b2brouter-status`),

  // WhatsApp direct (whatsapp-web.js)
  getWhatsAppStatus: () => request('GET', '/messaging/whatsapp/status'),
  connectWhatsApp: () => request('POST', '/messaging/whatsapp/connect'),
  disconnectWhatsApp: () => request('POST', '/messaging/whatsapp/disconnect'),
  // WhatsApp : choix du fournisseur (QR code ou API Cloud officielle)
  getWhatsAppConfig: () => request('GET', '/messaging/whatsapp/config'),
  saveWhatsAppConfig: (data) => request('POST', '/messaging/whatsapp/config', data),
  testWhatsAppConfig: () => request('POST', '/messaging/whatsapp/config/test'),
  getWhatsAppTemplatesList: () => request('GET', '/messaging/whatsapp/templates-list'),
  sendWhatsAppTemplate: (data) => request('POST', '/messaging/whatsapp/send-template', data),
  // SSE stream — retourne un EventSource (pas un fetch)
  whatsAppStatusStream: () => {
    const token = localStorage.getItem('crm_token');
    return new EventSource(`/api/messaging/whatsapp/status/stream?token=${token}`);
  },

  // Twilio (téléphonie)
  getTwilioStatus: () => request('GET', '/twilio/status'),
  connectTwilio: (data) => request('POST', '/twilio/connect', data),
  disconnectTwilio: () => request('DELETE', '/twilio/disconnect'),

  // Stripe (paiement en ligne)
  getStripeStatus: () => request('GET', '/stripe/status'),
  connectStripe: (secretKey) => request('POST', '/stripe/connect', { secretKey }),
  disconnectStripe: () => request('DELETE', '/stripe/disconnect'),
  sendContactToQonto: async (contactId) => {
    const response = await fetch(`${BASE}/qonto/contacts/${encodeURIComponent(contactId)}`, {
      method: 'POST',
      headers: headers(),
    });
    if (response.status === 404) {
      throw new Error('La connexion Qonto doit encore être déployée sur le backend Fly.io.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Impossible de contacter Qonto.');
    return data;
  },
  getReceptionCompanyName: async () => (await request('GET', '/invoices/settings'))?.name || '',
  getInvoicePaymentLink: (id) => request('POST', `/invoices/${id}/payment-link`),
  chargeInvoiceBalance: (id) => request('POST', `/invoices/${id}/charge-balance`),
  getTwilioToken: () => request('POST', '/twilio/token'),
  saveTwilioGreeting: (greeting) => request('POST', '/twilio/voicemail-greeting', { greeting }),
  uploadTwilioGreetingAudio: (file) => {
    const token = localStorage.getItem('crm_token');
    const formData = new FormData();
    formData.append('audio', file);
    return fetch('/api/twilio/voicemail-audio', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      return data;
    });
  },
  deleteTwilioGreetingAudio: () => request('DELETE', '/twilio/voicemail-audio'),

  // Campagnes d'appels
  getCampaigns: () => request('GET', '/campaigns'),
  createCampaign: (data) => request('POST', '/campaigns', data),
  getCampaign: (id) => request('GET', `/campaigns/${id}`),
  recordCampaignOutcome: (campaignId, campaignContactId, data) =>
    request('POST', `/campaigns/${campaignId}/contacts/${campaignContactId}/outcome`, data),
  deleteCampaign: (id) => request('DELETE', `/campaigns/${id}`),
  startCallRecording: (callSid) => request('POST', `/twilio/calls/${callSid}/record/start`),
  stopCallRecording: (callSid, recordingSid) => request('POST', `/twilio/calls/${callSid}/record/${recordingSid}/stop`),
};
