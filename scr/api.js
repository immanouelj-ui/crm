const BASE = import.meta.env.VITE_API_URL ?? 'https://crm-pro-backend.fly.dev/api';

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
  if (res.status === 401) {
    localStorage.removeItem('crm_token');
    window.location.href = '/';
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
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
  exportCSV: () => {
    const url = `${BASE}/contacts/export/csv`;
    fetch(url, { headers: headers() })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.setAttribute('download', 'contacts.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      });
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
  getSentMessages: () => request('GET', '/messaging/sent'),

  // Attachments
  getAttachments: (contactId) => request('GET', `/attachments/${contactId}`),
  uploadAttachments: (contactId, files) => {
    const token = localStorage.getItem('crm_token');
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    return fetch(`${BASE}/attachments/${contactId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(r => r.json());
  },
  deleteAttachment: (id) => request('DELETE', `/attachments/${id}`),
  getAttachmentUrl: (filename) => {
    const token = localStorage.getItem('crm_token');
    return `${BASE}/attachments/file/${filename}?token=${token}`;
  },

  // WhatsApp direct (whatsapp-web.js)
  getWhatsAppStatus: () => request('GET', '/messaging/whatsapp/status'),
  connectWhatsApp: () => request('POST', '/messaging/whatsapp/connect'),
  disconnectWhatsApp: () => request('POST', '/messaging/whatsapp/disconnect'),
  // SSE stream — retourne un EventSource (pas un fetch)
  whatsAppStatusStream: () => {
    const token = localStorage.getItem('crm_token');
    return new EventSource(`${BASE}/messaging/whatsapp/status/stream?token=${token}`);
  },
};
