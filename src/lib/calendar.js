// Calendar dates are local civil dates, not instants to convert through UTC.
export function calendarDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function appointmentsForWeek(rows, weekStart) {
  if (!Array.isArray(rows)) throw new Error('Réponse du planning inattendue.');
  const normalized = rows.map(row => ({ ...row, date: String(row.date || '').slice(0, 10) }));
  if (!weekStart) return normalized;
  const end = new Date(weekStart + 'T12:00:00');
  end.setDate(end.getDate() + 7);
  const weekEnd = calendarDate(end);
  return normalized.filter(row => row.date >= weekStart && row.date < weekEnd);
}
