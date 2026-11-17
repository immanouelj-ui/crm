import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  AlertCircle, ArrowUpRight, CheckCircle, Clock, Download,
  ExternalLink, FileText, Landmark, RefreshCw, Search, TrendingUp,
} from 'lucide-react';
import {
  accountingSummary, cents, inPeriod, invoiceDay, invoiceStatus, monthlyBilling,
  money, outstanding, overdue, todayParis,
} from '../lib/accounting.js';

const PERIODS = { month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette année', all: 'Toutes les dates' };
const FILTERS = { all: 'Toutes', unpaid: 'À recevoir', overdue: 'En retard', paid: 'Réglées' };

function formatDate(value) {
  const day = invoiceDay(value);
  return day ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z')) : '—';
}

async function readAPI(path, signal) {
  const response = await fetch('/api' + path, {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('crm_token') }, signal,
  });
  if (response.status === 401) throw new Error('Ta session a expiré. Reconnecte-toi au CRM.');
  if (response.status === 404) throw new Error('Connexion indisponible sur le backend actuel.');
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || 'Impossible de charger les données.');
  return result;
}

export default function Accounting({ onNavigate }) {
  const [invoices, setInvoices] = useState([]);
  const [period, setPeriod] = useState('month');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const [qonto, setQonto] = useState({ state: 'loading', message: '' });
  const [updatedAt, setUpdatedAt] = useState(null);
  const request = useRef(null);
  const today = todayParis();

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    setQonto({ state: 'loading', message: '' });
    const bankRequest = readAPI('/qonto/status', controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setQonto(result?.connected
        ? { state: 'connected', message: '' }
        : { state: 'error', message: 'Connexion Qonto à vérifier.' });
    }).catch(error => {
      if (!controller.signal.aborted) setQonto({ state: 'error', message: error.message });
    });
    const invoiceRequest = readAPI('/invoices', controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(result)) throw new Error('La liste des factures est indisponible.');
      setInvoices(result.filter(invoice => invoice.type === 'invoice'));
      setHasLoaded(true);
      setUpdatedAt(new Date());
    }).catch(error => {
      if (!controller.signal.aborted) setError(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    await Promise.allSettled([invoiceRequest, bankRequest]);
  }, []);

  useEffect(() => {
    refresh();
    return () => request.current?.abort();
  }, [refresh]);

  const summary = useMemo(() => accountingSummary(invoices, period, today), [invoices, period, today]);
  const trend = useMemo(() => monthlyBilling(invoices, today), [invoices, today]);
  const max = Math.max(...trend.map(month => month.amount), 1);
  const filtered = useMemo(() => invoices.filter(invoice => {
    if (!inPeriod(invoice, period, today)) return false;
    if (filter === 'unpaid' && outstanding(invoice) <= 0) return false;
    if (filter === 'overdue' && !overdue(invoice, today)) return false;
    if (filter === 'paid' && invoice.status !== 'paid') return false;
    const query = search.trim().toLocaleLowerCase('fr');
    return !query || [invoice.number, invoice.client_name].some(value => String(value || '').toLocaleLowerCase('fr').includes(query));
  }).sort((a, b) => {
    if (filter === 'unpaid' || filter === 'overdue') {
      return (invoiceDay(a.due_date) || '9999').localeCompare(invoiceDay(b.due_date) || '9999');
    }
    return (invoiceDay(b.issue_date) || invoiceDay(b.created_at)).localeCompare(invoiceDay(a.issue_date) || invoiceDay(a.created_at));
  }), [invoices, period, today, filter, search]);

  function showInvoices(nextFilter, allDates = false) {
    setFilter(nextFilter);
    setSearch('');
    if (allDates) setPeriod('all');
    document.getElementById('accounting-invoices')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exportInvoices() {
    const csv = Papa.unparse({
      fields: ['Facture', 'Client', 'Date de facture', 'Échéance', 'Statut', 'Montant HT', 'TVA facturée', 'Montant TTC', 'Solde à recevoir'],
      data: filtered.map(invoice => [
        invoice.number, invoice.client_name, invoiceDay(invoice.issue_date),
        invoiceDay(invoice.due_date), invoiceStatus(invoice, today).label,
        Number(invoice.total_ht || 0).toFixed(2), Number(invoice.total_tva || 0).toFixed(2),
        Number(invoice.total_ttc || 0).toFixed(2), (outstanding(invoice) / 100).toFixed(2),
      ]),
    }, { delimiter: ';', escapeFormulae: true });
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'suivi-factures-' + today + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const stats = [
    { label: 'Facturé TTC', value: summary.billed, icon: TrendingUp, subtitle: PERIODS[period], action: () => showInvoices('all') },
    { label: 'Factures réglées TTC', value: summary.settled, icon: CheckCircle, subtitle: 'Factures émises sur la période', action: () => showInvoices('paid') },
    { label: 'À recevoir TTC', value: summary.outstanding, icon: Clock, subtitle: 'Toutes les dates · soldes enregistrés', action: () => showInvoices('unpaid', true) },
    { label: 'En retard TTC', value: summary.overdue, icon: AlertCircle, subtitle: summary.overdueCount + ' facture(s) · toutes les dates', action: () => showInvoices('overdue', true) },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 pb-12 md:p-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Comptabilité</h1>
          <p className="mt-1 text-sm text-slate-500">Suivi des factures clients du CRM</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onNavigate && <button onClick={() => onNavigate('billing')} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"><FileText className="h-4 w-4" /> Gérer les factures</button>}
          <button onClick={refresh} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:opacity-50"><RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /> Actualiser</button>
        </div>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}{hasLoaded && ' Les données affichées proviennent du dernier chargement réussi.'}</p></div>}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Période d’émission
          <select value={period} onChange={event => setPeriod(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">
            {Object.entries(PERIODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {updatedAt && <p className="text-xs text-slate-400">Actualisé à {updatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, subtitle, action }) => (
          <button key={label} onClick={action} disabled={!hasLoaded} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-300 disabled:cursor-wait">
            <span className="flex items-center justify-between gap-2 text-sm text-slate-600">{label}<Icon className={'h-4 w-4 ' + (label === 'En retard TTC' && value > 0 ? 'text-rose-500' : 'text-indigo-500')} /></span>
            <span className="mt-3 block break-words text-2xl font-semibold tracking-tight text-slate-900">{hasLoaded ? money(value) : '—'}</span>
            <span className="mt-2 block text-xs text-slate-500">{subtitle}</span>
          </button>
        ))}
      </div>

      {hasLoaded && <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
        <span>Facturé HT <strong className="ml-1 font-medium text-slate-900">{money(summary.ht)}</strong></span>
        <span>TVA des factures émises <strong className="ml-1 font-medium text-slate-900">{money(summary.vat)}</strong></span>
      </div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Facturation des six derniers mois</h2>
          <p className="mt-1 text-xs text-slate-500">Montants TTC par date d’émission</p>
          <div className="mt-5 flex h-44 items-end gap-3" aria-label="Montants facturés par mois">
            {trend.map(month => <div key={month.key} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
              <div className="relative min-h-0 flex-1">
                <div tabIndex={0} title={month.label + ' · ' + money(month.amount)} aria-label={month.label + ' : ' + (hasLoaded ? money(month.amount) : 'chargement')} className="absolute inset-x-0 bottom-0 min-h-px rounded-t-md bg-indigo-500 transition-all focus:outline focus:outline-offset-2 focus:outline-indigo-700" style={{ height: (hasLoaded ? Math.max(0, month.amount) / max * 100 : 0) + '%' }} />
              </div>
              <span className="truncate text-center text-xs text-slate-500">{month.label}</span>
            </div>)}
          </div>
        </section>
        <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Landmark className="h-4 w-4 text-indigo-500" /> Qonto</h2>
            <p className="mt-3 text-sm text-slate-700">{qonto.state === 'loading' ? 'Vérification de la connexion…' : qonto.state === 'connected' ? 'Connexion active pour l’envoi des clients.' : qonto.message}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">Les indicateurs de cet écran sont calculés à partir des factures enregistrées dans le CRM.</p>
          </div>
          <a href="https://app.qonto.com" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-indigo-600">Ouvrir Qonto <ExternalLink className="h-4 w-4" /></a>
        </section>
      </div>

      <section id="accounting-invoices" className="scroll-mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h2 className="font-semibold text-slate-900">Factures <span className="ml-1 text-sm font-normal text-slate-400">{filtered.length}</span></h2>
          <button type="button" onClick={exportInvoices} disabled={!hasLoaded || filtered.length === 0} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 disabled:opacity-40"><Download className="h-4 w-4" /> Exporter ce résultat</button>
        </div>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input aria-label="Rechercher une facture ou un client" value={search} onChange={event => setSearch(event.target.value)} placeholder="Facture ou client…" className="h-10 w-full min-w-40 rounded-lg border border-slate-200 pl-9 pr-3 text-sm" />
          </label>
          <select aria-label="Statut des factures" value={filter} onChange={event => setFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">{Object.entries(FILTERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        {loading && !hasLoaded ? <p role="status" className="p-8 text-center text-sm text-slate-500">Chargement des factures…</p> : !hasLoaded ? <p className="p-8 text-center text-sm text-slate-500">Les factures n’ont pas pu être chargées. Clique sur Actualiser pour réessayer.</p> : filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Aucune facture pour ces critères.</p> : (
          <>
          <div className="divide-y divide-slate-100 md:hidden">
            {filtered.map(invoice => {
              const status = invoiceStatus(invoice, today);
              return (
                <article key={invoice.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-900">{invoice.number || 'Sans numéro'}</h3>
                      <p className="mt-1 break-words text-sm text-slate-500">{invoice.client_name || 'Client non renseigné'}</p>
                    </div>
                    <span className={'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ' + status.color}>{status.label}</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs text-slate-400">Montant TTC</dt><dd className="mt-1 font-semibold text-slate-900">{money(cents(invoice.total_ttc))}</dd></div>
                    <div><dt className="text-xs text-slate-400">À recevoir</dt><dd className="mt-1 font-medium text-slate-700">{money(outstanding(invoice))}</dd></div>
                    <div><dt className="text-xs text-slate-400">Émission</dt><dd className="mt-1 text-slate-600">{formatDate(invoice.issue_date)}</dd></div>
                    <div><dt className="text-xs text-slate-400">Échéance</dt><dd className={'mt-1 ' + (overdue(invoice, today) ? 'font-medium text-rose-600' : 'text-slate-600')}>{formatDate(invoice.due_date)}</dd></div>
                  </dl>
                  <a href={'/api/invoices/' + invoice.id + '/pdf?token=' + encodeURIComponent(localStorage.getItem('crm_token') || '')} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-indigo-600"><FileText className="h-4 w-4" /> Voir le PDF</a>
                </article>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[660px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>{['Facture / client', 'Émission', 'Échéance', 'TTC', 'À recevoir', 'Statut', 'PDF'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(invoice => {
                  const status = invoiceStatus(invoice, today);
                  return <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="max-w-60 px-4 py-3"><p className="font-medium text-slate-900">{invoice.number || 'Sans numéro'}</p><p className="mt-0.5 truncate text-xs text-slate-500">{invoice.client_name || 'Client non renseigné'}</p></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(invoice.issue_date)}</td>
                    <td className={'whitespace-nowrap px-4 py-3 ' + (overdue(invoice, today) ? 'font-medium text-rose-600' : 'text-slate-600')}>{formatDate(invoice.due_date)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{money(cents(invoice.total_ttc))}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{money(outstanding(invoice))}</td>
                    <td className="px-4 py-3"><span className={'inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ' + status.color}>{status.label}</span></td>
                    <td className="px-4 py-3"><a href={'/api/invoices/' + invoice.id + '/pdf?token=' + encodeURIComponent(localStorage.getItem('crm_token') || '')} target="_blank" rel="noopener noreferrer" aria-label={'Ouvrir le PDF de ' + invoice.number} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50"><ArrowUpRight className="h-4 w-4" /></a></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
