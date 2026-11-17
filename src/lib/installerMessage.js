export function installerPhone(value) {
  let phone = String(value || '').replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  if (/^0[1-9]\d{8}$/.test(phone)) phone = '+33' + phone.slice(1);
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : '';
}

export function installationMessage({ data, installerName, date, time, address, clientPhone }) {
  const firstName = String(data.prenom || data.first_name || '').trim();
  const lastName = String(data.nom || data.name || data.last_name || '').trim();
  const name = firstName && !lastName.toLocaleLowerCase('fr').split(/\s+/).includes(firstName.toLocaleLowerCase('fr'))
    ? [firstName, lastName].filter(Boolean).join(' ') : lastName;
  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris',
  }).format(new Date(date + 'T12:00:00+01:00'));
  const maps = new URL('https://www.google.com/maps/search/');
  maps.search = new URLSearchParams({ api: '1', query: address }).toString();
  const project = [
    data.puissance && `Puissance : ${data.puissance}`,
    data.compteur && `Compteur : ${data.compteur}`,
  ].filter(Boolean);
  return [
    `Bonjour ${installerName} 👋`, '',
    '🔧 *Installation à réaliser*', '',
    `📅 *Date* : ${formattedDate}`,
    `🕒 *Heure* : ${time.slice(0, 5)} (heure de Paris)`, '',
    `👤 *Client* : ${name}`,
    `📞 *Téléphone* : ${clientPhone}`, '',
    `📍 *Adresse* : ${address}`,
    `🗺️ *Google Maps* : ${maps.href}`,
    ...(project.length ? ['', ...project] : []), '',
    'Merci de confirmer la bonne réception et ta disponibilité pour ce créneau.',
    'Bonne intervention ! ⚡',
  ].join('\n');
}
