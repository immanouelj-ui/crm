import template from '../assets/pv-reception-travaux.svg';
import { api } from '../api.js';

const printMarkup = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Procès-verbal de réception des travaux</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f5f9; font: 16px system-ui, sans-serif; }
  header { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; padding: 12px; }
  button { border: 0; border-radius: 8px; background: #4338ca; color: white; cursor: pointer; padding: 12px 20px; font: inherit; }
  button:disabled { opacity: .6; cursor: wait; }
  #status { text-align: center; margin: 0 12px 12px; }
  #page { position: relative; width: min(100%, 794px); aspect-ratio: 210 / 297; overflow: hidden; background: white; margin: 0 auto 16px; }
  #artwork { position: absolute; inset: 0 auto auto 0; width: 1000px; height: 1414.286px; transform: scale(var(--zoom, .7937)); transform-origin: top left; }
  #template { position: absolute; inset: 0 auto auto 0; width: 1000px; height: 1414.286px; }
  .value { position: absolute; color: #171717; white-space: nowrap; overflow: hidden; font: 600 16px Arial, sans-serif; line-height: 18px; }
  @page { size: A4 portrait; margin: 0; }
  @media print {
    html, body { margin: 0; padding: 0; background: white; }
    header, #status { display: none; }
    #page { width: 210mm; height: 297mm; margin: 0; break-inside: avoid; }
    #artwork { transform: scale(.7937007874); }
  }
</style>
</head>
<body>
<header>
  <button type="button" disabled>Imprimer le procès-verbal</button>
</header>
<p id="status" role="status">Préparation du document…</p>
<main id="page" aria-label="Aperçu du procès-verbal" hidden>
  <div id="artwork">
    <img id="template" alt="Modèle de procès-verbal de réception des travaux">
    <span class="value" id="client" style="left:233px;top:203px;width:287px"></span>
    <span class="value" id="installer" style="left:539px;top:240px;width:386px"></span>
    <span class="value" id="order-date" style="left:395px;top:276px;width:135px"></span>
    <span class="value" id="signature-city" style="left:181px;top:931px;width:205px"></span>
  </div>
</main>
</body>
</html>`;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getReceptionFields(data) {
  const lastName = text(data.nom || data.last_name || data.name);
  const firstName = text(data.prenom || data.first_name);
  const parts = lastName.toLocaleLowerCase('fr').split(/\s+/);
  const client = firstName && !parts.join(' ').includes(firstName.toLocaleLowerCase('fr'))
    ? [firstName, lastName].filter(Boolean).join(' ')
    : lastName;
  const rawDate = text(data.date_commande || data.order_date);
  const orderDate = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  return {
    client,
    'order-date': orderDate ? `${orderDate[3]}/${orderDate[2]}/${orderDate[1]}` : rawDate,
    'signature-city': text(data.ville_signature || data.lieu_signature),
  };
}

export function openReceptionPrint(data) {
  const preview = window.open('', '_blank');
  if (!preview) return false;
  preview.opener = null;

  const doc = preview.document;
  doc.open();
  doc.write(printMarkup);
  doc.close();

  const page = doc.querySelector('#page');
  const image = doc.querySelector('#template');
  const status = doc.querySelector('#status');
  const printButton = doc.querySelector('button');
  const fitPage = () => page.style.setProperty('--zoom', page.clientWidth / 1000);
  fitPage();
  preview.addEventListener('resize', fitPage);
  printButton.onclick = () => preview.print();

  const imageReady = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = new URL(template, window.location.href).href;
  });
  const installer = api.getReceptionCompanyName().catch(() => '');

  Promise.all([imageReady, installer]).then(([, companyName]) => {
    if (preview.closed) return;
    page.hidden = false;
    fitPage();
    const values = { ...getReceptionFields(data), installer: text(companyName) };
    for (const [id, value] of Object.entries(values)) {
      const field = doc.getElementById(id);
      field.textContent = value;
      for (let size = 16; size > 8 && field.scrollWidth > field.clientWidth; size -= 1) {
        field.style.fontSize = `${size - 1}px`;
      }
    }
    status.hidden = true;
    printButton.disabled = false;
  }).catch(() => {
    status.textContent = 'Impossible de charger le modèle. Réessaie depuis la fiche client.';
  });
  return true;
}
