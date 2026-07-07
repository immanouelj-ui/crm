import React, { useState } from 'react';
import { useAuth } from '../App.jsx';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Register({ onGoToLogin }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ name: '', company_name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la creation du compte');
      login(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#0f172a] flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <span className="text-2xl font-bold text-white">Hakol</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Demarrez gratuitement<br />en quelques secondes.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Creez votre espace et commencez a gerer vos contacts, votre pipeline et votre facturation des aujourd'hui.
          </p>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Multi-utilisateurs', desc: "Invitez votre equipe et gerez les acces." },
            { label: 'Facturation integree', desc: 'Creez devis et factures en un clic.' },
            { label: 'Donnees securisees', desc: 'Vos donnees isolees, sauvegardees en cloud.' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-white text-sm font-medium">{item.label}</p>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            <span className="text-2xl font-bold text-slate-900">Hakol</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Creer un compte</h2>
            <p className="text-slate-500 text-sm">Deja inscrit ?{' '}
              <button onClick={onGoToLogin} className="text-indigo-600 hover:underline font-medium">Se connecter</button>
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Votre nom</label>
              <input type="text" value={form.name} onChange={set('name')} placeholder="Jean Dupont" required
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom de l'entreprise <span className="text-slate-400 font-normal">(optionnel)</span></label>
              <input type="text" value={form.company_name} onChange={set('company_name')} placeholder="Mon Entreprise SAS"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="vous@exemple.fr" required
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  placeholder="8 caracteres minimum" required minLength={8}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 mt-6">
              {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Creation...</>) : 'Creer mon compte'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
