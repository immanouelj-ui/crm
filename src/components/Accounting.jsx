import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Clock, AlertCircle, CreditCard, Wallet,
  BarChart3, RefreshCw, Calendar, Settings, X, ChevronRight, Download,
  DollarSign, CheckCircle, Eye, Landmark
} from 'lucide-react';

const BASE = '/api';
function tok() { return localStorage.getItem('crm_token'); }
async function apiFetch(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

const fmt = n => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmtDate = s => s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── Main Component ────────────────────────────────────────────────────────────

export default function Accounting() {
  const [data, setData] = useState(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [paidInvoices, setPaidInvoices] = useState([]);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [contoConnected, setContoConnected] = useState(false);
  const [contoSetupModal, setContoSetupModal] = useState(false);
  const [contoForm, setContoForm] = useState({ clientId: '', clientSecret: '' });
  const [contoLoading, setContoLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiFetch('GET', `/accounting/dashboard?period=${period}`);
      setData(d);
      setStripeConnected(d.stripe?.connected || false);

      const unpaid = await apiFetch('GET', '/accounting/invoices/unpaid');
      setUnpaidInvoices(unpaid);

      const paid = await apiFetch('GET', `/accounting/invoices/paid?period=${period}`);
      setPaidInvoices(paid);

      const contoStatus = await apiFetch('GET', '/accounting/conto/status');
      setContoConnected(contoStatus.connected);
    } catch (e) {
      setError(e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleContoConnect = async () => {
    setContoLoading(true);
    try {
      await apiFetch('POST', '/accounting/conto/connect', contoForm);
      setContoConnected(true);
      setContoSetupModal(false);
      setContoForm({ clientId: '', clientSecret: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setContoLoading(false);
    }
  };

  const handleContoDisconnect = async () => {
    try {
      await apiFetch('DELETE', '/accounting/conto/disconnect');
      setContoConnected(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSyncStripe = async () => {
    try {
      const result = await apiFetch('POST', '/accounting/sync/stripe', {});
      setError(null);
      alert(`✅ ${result.message}`);
      fetchDashboard();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading && !data) {
    return <div className="p-6 text-center text-slate-500">Chargement du tableau de bord comptable...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-indigo-600" />
          Comptabilité & Trésorerie
        </h1>
        <p className="text-slate-600 mt-2">Vue temps réel de votre activité financière</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          {['today', 'week', 'month', 'quarter', 'year'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                period === p
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-indigo-300'
              }`}
            >
              {p === 'today' ? '📅 Aujourd\'hui' : p === 'week' ? '📆 Cette semaine' : p === 'month' ? '📊 Ce mois' : p === 'quarter' ? '📈 Ce trimestre' : '📉 Cette année'}
            </button>
          ))}
        </div>
        <button
          onClick={fetchDashboard}
          className="ml-auto px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* KPI Cards */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Revenue TTC */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-600 font-medium">CA TTC</span>
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{fmt(data.revenue.ttc)}</p>
              <p className="text-sm text-slate-500 mt-2">Chiffre d'affaires encaissé</p>
            </div>

            {/* Revenue HT */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-600 font-medium">CA HT</span>
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{fmt(data.revenue.ht)}</p>
              <p className="text-sm text-slate-500 mt-2">Avant TVA</p>
            </div>

            {/* VAT */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-600 font-medium">TVA Collectée</span>
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{fmt(data.revenue.vat)}</p>
              <p className="text-sm text-slate-500 mt-2">À déclarer/reverser</p>
            </div>

            {/* Unpaid */}
            <div className={`rounded-xl shadow-sm p-6 border ${data.unpaid.overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`font-medium ${data.unpaid.overdue > 0 ? 'text-red-700' : 'text-slate-600'}`}>Factures Impayées</span>
                <AlertCircle className={`w-5 h-5 ${data.unpaid.overdue > 0 ? 'text-red-600' : 'text-amber-600'}`} />
              </div>
              <p className={`text-3xl font-bold ${data.unpaid.overdue > 0 ? 'text-red-900' : 'text-slate-900'}`}>{fmt(data.unpaid.total)}</p>
              <p className={`text-sm mt-2 ${data.unpaid.overdue > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                {data.unpaid.overdueCount} en retard ({fmt(data.unpaid.overdue)})
              </p>
            </div>
          </div>

          {/* Stripe Section */}
          {stripeConnected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Stripe Balance */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm p-6 border border-purple-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-purple-600" />
                    Solde Stripe
                  </h3>
                  <button
                    onClick={handleSyncStripe}
                    className="px-3 py-1 rounded-lg bg-white text-purple-600 font-medium hover:bg-purple-50 text-sm flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Sync
                  </button>
                </div>
                {data.stripe?.balance ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Disponible</p>
                        <p className="text-2xl font-bold text-emerald-600">{fmt(data.stripe.balance.available)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">En attente</p>
                        <p className="text-2xl font-bold text-amber-600">{fmt(data.stripe.balance.pending)}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-600">Impossible de récupérer le solde</p>
                )}
              </div>

              {/* Recent Stripe Transactions */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  Dernières transactions Stripe
                </h3>
                {data.stripe?.recentTransactions && data.stripe.recentTransactions.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {data.stripe.recentTransactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{tx.description}</p>
                          <p className="text-xs text-slate-500">{fmtDate(tx.created)}</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-600 flex-shrink-0 ml-2">{fmt(tx.amount)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600">Aucune transaction récente</p>
                )}
              </div>
            </div>
          )}

          {/* Revenue Trend */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 mb-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Tendance CA (12 derniers mois)
            </h3>
            <div className="grid grid-cols-12 gap-1 h-48 items-end">
              {data.revenue.monthlyTrend.map((m, i) => {
                const maxRevenue = Math.max(...data.revenue.monthlyTrend.map(x => x.revenue), 1);
                const height = (m.revenue / maxRevenue) * 100;
                return (
                  <div key={i} className="flex flex-col items-center justify-end gap-1">
                    <div
                      className="w-full bg-gradient-to-t from-indigo-500 to-indigo-300 rounded-t-md hover:from-indigo-600 hover:to-indigo-400 transition-all cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`${m.month}: ${fmt(m.revenue)}`}
                    />
                    <span className="text-xs text-slate-500 text-center whitespace-nowrap">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unpaid Invoices */}
          {unpaidInvoices.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                Factures Impayées ({unpaidInvoices.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="text-left py-2 px-3 text-slate-600 font-semibold">Facture</th>
                      <th className="text-left py-2 px-3 text-slate-600 font-semibold">Client</th>
                      <th className="text-right py-2 px-3 text-slate-600 font-semibold">Montant</th>
                      <th className="text-left py-2 px-3 text-slate-600 font-semibold">Échéance</th>
                      <th className="text-left py-2 px-3 text-slate-600 font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidInvoices.map(inv => (
                      <tr key={inv.id} className={`border-b border-slate-100 hover:bg-slate-50 ${inv.isOverdue ? 'bg-red-50' : ''}`}>
                        <td className="py-3 px-3 font-mono text-indigo-600">{inv.number}</td>
                        <td className="py-3 px-3 text-slate-700">{inv.client_name}</td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-900">{fmt(inv.total_ttc)}</td>
                        <td className="py-3 px-3 text-slate-600">{fmtDate(inv.due_date)}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            inv.isOverdue
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {inv.isOverdue ? `⚠️ ${inv.daysOverdue}j en retard` : `📅 À recevoir`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Conto Integration */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-blue-600" />
                  Intégration Conto
                </h3>
                <p className="text-slate-600 mt-1">
                  Synchronisez vos transactions bancaires pour une vue complète de votre trésorerie
                </p>
              </div>
              <div>
                {contoConnected ? (
                  <button
                    onClick={handleContoDisconnect}
                    className="px-4 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 font-medium hover:bg-red-100"
                  >
                    ❌ Déconnecter Conto
                  </button>
                ) : (
                  <button
                    onClick={() => setContoSetupModal(true)}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
                  >
                    🔗 Connecter Conto
                  </button>
                )}
              </div>
            </div>
            {contoConnected && (
              <p className="mt-4 text-sm text-emerald-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Connecté - Vos transactions Conto sont synchronisées
              </p>
            )}
          </div>
        </>
      )}

      {/* Conto Setup Modal */}
      {contoSetupModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-blue-600" />
                Connecter Conto
              </h2>
              <button
                onClick={() => setContoSetupModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Client ID</label>
                <input
                  type="text"
                  value={contoForm.clientId}
                  onChange={e => setContoForm({ ...contoForm, clientId: e.target.value })}
                  placeholder="Votre Client ID Conto"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Client Secret</label>
                <input
                  type="password"
                  value={contoForm.clientSecret}
                  onChange={e => setContoForm({ ...contoForm, clientSecret: e.target.value })}
                  placeholder="Votre Client Secret Conto"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <p className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg">
                💡 Vous trouverez vos identifiants Conto dans votre tableau de bord à l'adresse <a href="https://conto.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">conto.com</a>
              </p>
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-200">
              <button
                onClick={() => setContoSetupModal(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                onClick={handleContoConnect}
                disabled={contoLoading || !contoForm.clientId || !contoForm.clientSecret}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {contoLoading ? 'Connexion...' : 'Connecter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
