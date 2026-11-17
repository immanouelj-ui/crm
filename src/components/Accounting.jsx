import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  AlertCircle, ArrowDownLeft, ArrowUpRight, CreditCard,
  Download, FileText, Landmark, RefreshCw, Search, Wallet,
} from 'lucide-react';

const PERIODS = { month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette année' };
const STATUS = {
  draft: 'Brouillon', unpaid: 'Impayée', paid: 'Réglée', canceled: 'Annulé',
  pending_approval: 'En attente', approved: 'Accepté',
};
const TYPES = { card: 'Carte', transfer: 'Virement', income: 'Virement reçu', direct_debit: 'Prélèvement', qonto_fee: 'Frais Qonto', cheque: 'Chèque', account_remuneration: 'Rémunération' };
const formatMoney = (value, currency = 'EUR') => value === null || value === undefined ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value / 100);
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(String(value).length === 10 ? value + 'T12:00:00+01:00' : value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris' }).format(date);
}

export default function Accounting() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('transactions');
  const [account, setAccount] = useState('');
  const [transactionType, setTransactionType] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  const current = useRef(null);

  const refresh = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const response = await fetch('/api/qonto/dashboard?period=' + period, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('crm_token') },
        signal: controller.signal,
      });
      if (response.status === 404) throw new Error('La lecture des comptes Qonto doit encore être installée sur le backend Fly.io.');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Impossible de lire les données Qonto.');
      if (body.source !== 'qonto' || !Array.isArray(body.accounts)) throw new Error('Réponse Qonto inattendue.');
      if (!controller.signal.aborted) setData(body);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [period]);

  useEffect(() => { refresh(); return () => current.current?.abort(); }, [refresh]);
  useEffect(() => { setLimit(100); }, [period, tab, account, transactionType, status, search]);

  const bankRows = useMemo(() => (data?.transactions?.data?.rows || []).filter(row => !account || row.account_id === account), [data, account]);
  const euro = bankRows.filter(row => row.currency === 'EUR' && !row.own_transfer);
  const sum = predicate => euro.filter(predicate).reduce((total, row) => total + row.amount, 0);
  const accounts = (data?.accounts || []).filter(item => item.status === 'active' && item.currency === 'EUR' && (!account || item.id === account));
  const totalBalance = key => accounts.some(item => item[key] === null) ? null : accounts.reduce((total, item) => total + item[key], 0);
  const txReady = data?.transactions?.available;
  const invoiceReady = data?.invoices?.available;
  const quoteReady = data?.quotes?.available;
  const invoices = data?.invoices?.data;
  const quotes = data?.quotes?.data;

  const rows = useMemo(() => {
    let result;
    if (tab === 'transactions') {
      result = bankRows.filter(row => {
        if (transactionType === 'card') return row.type === 'card';
        if (transactionType === 'debit') return row.side === 'debit' && !row.own_transfer;
        if (transactionType === 'credit') return row.side === 'credit' && !row.own_transfer;
        return true;
      });
    } else {
      result = tab === 'invoices'
        ? status === 'unpaid' ? invoices?.unpaid_rows || [] : invoices?.rows || []
        : quotes?.rows || [];
      result = result.filter(row => status === 'all' || row.status === status);
    }
    const query = search.trim().toLocaleLowerCase('fr');
    return result.filter(row => !query || [row.number, row.client, row.label, row.category, row.card].some(value => String(value || '').toLocaleLowerCase('fr').includes(query)));
  }, [bankRows, tab, transactionType, invoices, quotes, status, search]);

  function changeTab(value) {
    setTab(value);
    setStatus('all');
    setSearch('');
  }

  function exportRows() {
    const isBank = tab === 'transactions';
    const csv = Papa.unparse({
      fields: isBank
        ? ['Date', 'Compte', 'Libellé', 'Type', 'Carte', 'Catégorie', 'Sens', 'Montant', 'Devise', 'Mouvement entre comptes identifiés']
        : ['Numéro', 'Client', 'Date', 'Échéance', 'Statut', 'Montant TTC', 'Devise'],
      data: rows.map(row => isBank
        ? [row.date, row.account, row.label, TYPES[row.type] || row.type, row.card, row.category, row.side === 'debit' ? 'Sortie' : 'Entrée', ((row.side === 'debit' ? -1 : 1) * row.amount / 100).toFixed(2), row.currency, row.own_transfer ? 'Oui' : '']
        : [row.number, row.client, row.date, row.due_date, STATUS[row.status] || row.status, (row.amount / 100).toFixed(2), row.currency]),
    }, { delimiter: ';', escapeFormulae: true });
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'qonto-' + tab + '-' + period + '.csv';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const stats = [
    { label: 'Disponible sur les comptes', amount: data ? totalBalance('available') : null, icon: Wallet, note: 'Solde disponible EUR · maintenant' },
    { label: 'Entrées bancaires', amount: txReady ? sum(row => row.side === 'credit') : null, icon: ArrowDownLeft, note: PERIODS[period] + ' · opérations comptabilisées' },
    { label: 'Sorties bancaires', amount: txReady ? sum(row => row.side === 'debit') : null, icon: ArrowUpRight, note: PERIODS[period] + ' · opérations comptabilisées' },
    { label: 'Dépenses par carte', amount: txReady ? sum(row => row.side === 'debit' && row.type === 'card') : null, icon: CreditCard, note: 'Incluses dans les sorties bancaires' },
    { label: 'Total des factures émises TTC', amount: invoiceReady ? invoices.billed : null, icon: FileText, note: PERIODS[period] + ' · factures Qonto validées' },
    { label: 'Factures impayées TTC', amount: invoiceReady ? invoices.unpaid : null, icon: AlertCircle, note: 'Toutes les dates · selon le statut Qonto' },
  ];
  const activeSection = data?.[tab];
  const inputClass = 'min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700';

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 pb-12 md:p-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900"><Landmark className="h-6 w-6 text-indigo-600" /> Comptabilité Qonto</h1>
          <p className="mt-1 text-sm text-slate-500">{data?.organization?.name || 'Comptes, dépenses, factures et devis'}</p>
          {data && <p className="mt-1 text-xs text-slate-400">Données Qonto récupérées le {formatDate(data.fetched_at)} à {new Date(data.fetched_at).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
        <button onClick={refresh} disabled={loading} className={inputClass + ' inline-flex items-center gap-2 disabled:opacity-50'}><RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /> Actualiser</button>
      </header>

      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-slate-500">Période<select className={inputClass + ' ml-2'} value={period} onChange={event => setPeriod(event.target.value)}>{Object.entries(PERIODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs text-slate-500">Compte<select className={inputClass + ' ml-2 max-w-full'} value={account} onChange={event => setAccount(event.target.value)}><option value="">Tous les comptes</option>{(data?.accounts || []).map(item => <option key={item.id} value={item.id}>{item.name} · {item.currency}{item.status === 'closed' ? ' · clos' : ''}</option>)}</select></label>
      </div>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p></div>}
      {data && ['transactions', 'invoices', 'quotes'].filter(key => !data[key]?.available).map(key => <div key={key} role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{key === 'transactions' ? 'Opérations bancaires' : key === 'invoices' ? 'Factures Qonto' : 'Devis Qonto'} : {data[key]?.error || 'Lecture indisponible.'}</div>)}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(({ label, amount, icon: Icon, note }) => <section key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="flex items-center justify-between gap-2 text-sm text-slate-600">{label}<Icon className="h-4 w-4 shrink-0 text-indigo-500" /></h2><p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{formatMoney(amount)}</p><p className="mt-2 text-xs text-slate-500">{note}</p></section>)}
      </div>

      {data && <div className="grid gap-3 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Soldes par compte</h2>
          <div className="space-y-3">{data.accounts.filter(item => item.status === 'active').map(item => <div key={item.id} className="flex items-center justify-between gap-3"><span className="min-w-0 break-words text-sm text-slate-600">{item.name}</span><span className="shrink-0 text-right"><span className="block text-sm font-medium text-slate-900">{formatMoney(item.available, item.currency)}</span><span className="block text-xs text-slate-400">Solde comptable : {formatMoney(item.balance, item.currency)}</span></span></div>)}</div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Factures Qonto</h2>
          <p className="text-sm text-slate-500">Factures réglées émises sur la période</p><p className="mt-1 font-semibold text-emerald-700">{formatMoney(invoiceReady ? invoices.paid : null)}</p>
          <p className="mt-3 text-sm text-slate-500">Factures impayées en retard · toutes les dates</p><p className="mt-1 font-semibold text-rose-700">{formatMoney(invoiceReady ? invoices.overdue : null)}</p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Devis Qonto sur la période</h2>
          <p className="text-sm text-slate-500">Acceptés</p><p className="mt-1 font-semibold text-emerald-700">{formatMoney(quoteReady ? quotes.approved : null)}</p>
          <p className="mt-3 text-sm text-slate-500">En attente</p><p className="mt-1 font-semibold text-slate-900">{formatMoney(quoteReady ? quotes.pending : null)}</p>
        </section>
      </div>}

      {data && <p className="text-xs leading-relaxed text-slate-500">Les totaux sont en euros. Les opérations bancaires sont regroupées par date de comptabilisation et les documents par date d’émission. Les mouvements entre tes comptes repérés grâce aux IBAN sont exclus des totaux d’entrées et de sorties.{txReady && bankRows.some(row => row.currency !== 'EUR') && ' Les opérations en devises restent visibles dans la liste.'}{txReady && ' Remboursements par carte sur la période : ' + formatMoney(sum(row => row.side === 'credit' && row.type === 'card')) + '.'}</p>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap gap-1">{[['transactions', 'Opérations'], ['invoices', 'Factures'], ['quotes', 'Devis']].map(([value, label]) => <button key={value} onClick={() => changeTab(value)} className={'min-h-11 rounded-lg px-3 text-sm font-medium ' + (tab === value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50')}>{label}</button>)}</div>
          <button onClick={exportRows} disabled={!activeSection?.available || !rows.length} className={inputClass + ' inline-flex items-center gap-2 disabled:opacity-40'}><Download className="h-4 w-4" /> Exporter</button>
        </div>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input aria-label="Rechercher dans les données Qonto" value={search} onChange={event => setSearch(event.target.value)} placeholder={tab === 'transactions' ? 'Commerçant, carte, catégorie…' : 'Numéro ou client…'} className={inputClass + ' w-full pl-9'} /></label>
          {tab === 'transactions' ? <select aria-label="Type d’opération" className={inputClass} value={transactionType} onChange={event => setTransactionType(event.target.value)}><option value="all">Toutes les opérations</option><option value="card">Paiements et remboursements carte</option><option value="debit">Sorties</option><option value="credit">Entrées</option></select> : <select aria-label="Statut du document" className={inputClass} value={status} onChange={event => setStatus(event.target.value)}><option value="all">Tous les statuts</option>{(tab === 'invoices' ? ['unpaid', 'paid', 'draft', 'canceled'] : ['approved', 'pending_approval', 'canceled']).map(value => <option key={value} value={value}>{value === 'unpaid' ? 'Impayées · toutes les dates' : STATUS[value]}</option>)}</select>}
        </div>
        {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Lecture des données Qonto…</p> : !activeSection?.available ? <p className="p-8 text-center text-sm text-slate-500">Ces données ne sont pas disponibles actuellement.</p> : rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Aucun résultat pour ces critères.</p> : <div className="divide-y divide-slate-100">
          {rows.slice(0, limit).map(row => <article key={row.id} className="flex items-start justify-between gap-3 p-4 hover:bg-slate-50">
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-sm font-medium text-slate-900">{tab === 'transactions' ? row.label || 'Opération Qonto' : row.number || 'Document Qonto'}</h3>
              <p className="mt-1 break-words text-xs text-slate-500">{formatDate(row.date)} · {tab === 'transactions' ? row.account + ' · ' + (TYPES[row.type] || row.type) + (row.card ? ' · Carte •••• ' + row.card : '') : row.client || 'Client non renseigné'}</p>
              {tab === 'transactions' ? <p className="mt-1 text-xs text-slate-500">{row.own_transfer ? 'Mouvement entre tes comptes' : row.category}{row.has_attachment ? ' · Justificatif associé' : ''}</p> : <p className="mt-1 text-xs text-slate-500">{STATUS[row.status] || row.status}{row.due_date ? ' · Échéance : ' + formatDate(row.due_date) : ''}</p>}
            </div>
            <p className={'shrink-0 text-right text-sm font-semibold ' + (tab === 'transactions' && row.side === 'credit' ? 'text-emerald-700' : 'text-slate-900')}>{tab === 'transactions' ? row.side === 'credit' ? '+ ' : '− ' : ''}{formatMoney(row.amount, row.currency)}</p>
          </article>)}
          {rows.length > limit && <button onClick={() => setLimit(value => value + 100)} className="w-full p-4 text-sm font-medium text-indigo-600">Afficher davantage ({rows.length - limit} restants)</button>}
        </div>}
      </section>
    </div>
  );
}
