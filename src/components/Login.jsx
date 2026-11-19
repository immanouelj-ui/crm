import React, { useState } from 'react';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login({ onGoToRegister, onGoToForgot }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      login(data.token, data.user);
    } catch (err) {
      setError('Impossible de vous connecter. Vérifiez vos identifiants ou réessayez.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-workspace">
      <aside className="login-story">
        <div className="flex items-center gap-3"><span className="brand-monogram">H<span/></span><span className="text-2xl font-semibold tracking-tight text-white">Hakol.</span></div>
        <div className="login-story-content"><p className="mb-5 text-xs font-medium uppercase tracking-[.18em] text-slate-400">Votre espace professionnel</p><h1>Vos clients.<br/>Votre activité.<br/><span>Une vue claire.</span></h1><p className="mt-7 max-w-sm text-base leading-relaxed text-slate-400">Du premier contact à la dernière intervention, gardez le fil de votre activité.</p></div>
        <div className="login-capabilities"><p>Contacts & rendez-vous</p><p>Devis & facturation</p><p>Comptabilité connectée</p></div>
      </aside>
      <main className="login-form-panel">
        <div className="login-form-content">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><span className="brand-monogram">H<span/></span><span className="text-2xl font-semibold tracking-tight">Hakol.</span></div>
          <p className="page-eyebrow mb-3">Bienvenue</p><h2 className="page-title">Connectez-vous<br/>à votre espace.</h2><p className="page-subtitle mb-8">Retrouvez vos clients et votre activité.</p>
          {error&&<div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div><label htmlFor="login-email" className="mb-2 block text-sm font-medium text-slate-700">Adresse e-mail</label><input id="login-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@entreprise.fr" required className="login-input"/></div>
            <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="login-password" className="text-sm font-medium text-slate-700">Mot de passe</label>{onGoToForgot&&<button type="button" onClick={onGoToForgot} className="text-xs font-medium text-slate-500 hover:text-slate-900">Mot de passe oublié ?</button>}</div><div className="relative"><input id="login-password" autoComplete="current-password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Votre mot de passe" required className="login-input pr-12"/><button type="button" aria-label={showPassword?'Masquer le mot de passe':'Afficher le mot de passe'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)} className="absolute right-2 top-1.5 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></div>
            <button type="submit" disabled={loading} className="primary-action mt-2 min-h-12 w-full disabled:opacity-60">{loading?<><Loader2 size={17} className="animate-spin"/>Connexion en cours…</>:'Se connecter'}</button>
          </form>
          {onGoToRegister&&<p className="mt-8 text-center text-sm text-slate-400">Pas encore de compte ? <button type="button" onClick={onGoToRegister} className="font-medium text-slate-900 hover:underline">Créer un compte</button></p>}
        </div>
        <p className="login-bottom">Hakol · Votre espace de travail</p>
      </main>
    </div>
  );
}
