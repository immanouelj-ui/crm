import React, { useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function ForgotPassword({ onGoToLogin }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold text-slate-900">Hakol</span>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Email envoye !</h2>
            <p className="text-sm text-slate-500">Si un compte existe avec cet email, vous recevrez un lien de reinitialisation dans quelques minutes.</p>
            <button onClick={onGoToLogin} className="text-indigo-600 text-sm hover:underline font-medium">
              Retour a la connexion
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Mot de passe oublie</h2>
              <p className="text-slate-500 text-sm">Entrez votre email pour recevoir un lien de reinitialisation.</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr" required
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Envoi...</>) : 'Envoyer le lien'}
              </button>
            </form>

            <button onClick={onGoToLogin} className="mt-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Retour a la connexion
            </button>
          </>
        )}
      </div>
    </div>
  );
}
