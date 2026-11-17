export const money = value => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value / 100);
export const cents = value => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : 0;

export function todayParis(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(now);
}

export function invoiceDay(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return '';
  const date = new Date(match[1] + 'T12:00:00Z');
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[1] ? '' : match[1];
}

export function outstanding(invoice) {
  if (['paid', 'draft', 'cancelled'].includes(invoice.status)) return 0;
  const total = Math.max(0, cents(invoice.total_ttc));
  const balance = cents(invoice.balance_due);
  return balance > 0 ? Math.min(balance, total) : total;
}

export function overdue(invoice, today) {
  const due = invoiceDay(invoice.due_date);
  return outstanding(invoice) > 0 && due && due < today;
}

export function periodStart(period, today) {
  const year = today.slice(0, 4);
  const month = Number(today.slice(5, 7));
  if (period === 'month') return today.slice(0, 7) + '-01';
  if (period === 'quarter') return year + '-' + String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0') + '-01';
  if (period === 'year') return year + '-01-01';
  return '';
}

export function inPeriod(invoice, period, today) {
  if (period === 'all') return true;
  const date = invoiceDay(invoice.issue_date) || invoiceDay(invoice.created_at);
  return date >= periodStart(period, today) && date <= today;
}

export function invoiceStatus(invoice, today) {
  if (invoice.status === 'draft') return { label: 'Brouillon', color: 'bg-slate-100 text-slate-600' };
  if (invoice.status === 'cancelled') return { label: 'Annulée', color: 'bg-slate-100 text-slate-500' };
  if (invoice.status === 'paid') return { label: 'Réglée', color: 'bg-emerald-50 text-emerald-700' };
  if (overdue(invoice, today)) return { label: 'En retard', color: 'bg-rose-50 text-rose-700' };
  return { label: 'À recevoir', color: 'bg-amber-50 text-amber-700' };
}

export function accountingSummary(invoices, period, today) {
  const issued = invoices.filter(invoice => !['draft', 'cancelled'].includes(invoice.status));
  const selected = issued.filter(invoice => inPeriod(invoice, period, today));
  return {
    billed: selected.reduce((sum, invoice) => sum + cents(invoice.total_ttc), 0),
    ht: selected.reduce((sum, invoice) => sum + cents(invoice.total_ht), 0),
    vat: selected.reduce((sum, invoice) => sum + cents(invoice.total_tva), 0),
    settled: selected.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + cents(invoice.total_ttc), 0),
    outstanding: issued.reduce((sum, invoice) => sum + outstanding(invoice), 0),
    overdue: issued.filter(invoice => overdue(invoice, today)).reduce((sum, invoice) => sum + outstanding(invoice), 0),
    overdueCount: issued.filter(invoice => overdue(invoice, today)).length,
  };
}

export function monthlyBilling(invoices, today) {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 6 + index, 1));
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      label: new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date),
      amount: invoices.filter(invoice => !['draft', 'cancelled'].includes(invoice.status)
        && (invoiceDay(invoice.issue_date) || invoiceDay(invoice.created_at)).startsWith(key))
        .reduce((sum, invoice) => sum + cents(invoice.total_ttc), 0),
    };
  });
}
