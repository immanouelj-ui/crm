import { useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../api.js';

export default function QontoContactButton({ contactId }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setMessage('');
    try {
      const result = await api.sendContactToQonto(contactId);
      setSent(true);
      setMessage(result.existing ? 'Ce client est déjà enregistré dans Qonto.' : 'Client créé dans Qonto.');
    } catch (error) {
      setMessage(error.message || 'Impossible d’envoyer ce client vers Qonto.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={busy || sent}
        onClick={send}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {busy ? 'Envoi vers Qonto…' : sent ? 'Client enregistré dans Qonto' : 'Envoyer vers Qonto'}
      </button>
      {message && <p role="status" className="mt-1 max-w-lg text-sm text-slate-700">{message}</p>}
    </div>
  );
}
