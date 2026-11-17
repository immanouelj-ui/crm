const GENERATED_LEAD_NOTE = /^🌐 Lead irvohm\.fr\r?\nLogement : [^\r\n]*\r?\n(?:Véhicule|Projet pro) : [^\r\n]*\r?\nPuissance : [^\r\n]*\r?\nCompteur : [^\r\n]*\r?\nDélai : [^\r\n]*\r?\nPhotos(?: : aucune| \(\d+\) : https?:\/\/[^\s|]+(?: \| https?:\/\/[^\s|]+)*)(?=\r?\n|$)/;

export function splitLeadNotes(value) {
  const summary = typeof value === 'string' ? value.match(GENERATED_LEAD_NOTE)?.[0] : undefined;
  return {
    summary,
    notes: summary ? value.slice(summary.length).replace(/^(?:\r?\n)+/, '') : value,
  };
}

export function updateLeadNotes(summary, notes) {
  if (!summary) return notes;
  return notes ? `${summary}\n\n${notes}` : summary;
}
