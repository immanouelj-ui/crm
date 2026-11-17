import { api } from '../api.js';

// Map the four photographed page corners onto a 1000 × 1414.286 A4 canvas.
const TEMPLATE_STORAGE_KEY = 'crm-reception-template-v1';
const pageProjection = 'matrix3d(1.024279,-0.006461,0,-0.0000033473,0.081562,1.048765,0,0.0000774594,0,0,1,0,-142.818568,-17.986212,0,1)';
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
  #template-picker { max-width: 100%; }
  #page { position: relative; width: min(100%, 794px); aspect-ratio: 210 / 297; overflow: hidden; background: white; margin: 0 auto 16px; }
  #artwork { position: absolute; inset: 0 auto auto 0; width: 1000px; height: 1414.286px; transform: scale(var(--zoom, .7937)); transform-origin: top left; }
  #template { position: absolute; inset: 0 auto auto 0; width: 1152px; height: 1536px; transform-origin: top left; transform: ${pageProjection}; }
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
  <label for="template-picker">Modèle du procès-verbal</label>
  <input id="template-picker" type="file" accept="image/jpeg">
  <button type="button" disabled>Imprimer le procès-verbal</button>
</header>
<p id="status" role="status">Sélectionne la photo originale du procès-verbal. Elle reste dans ce navigateur.</p>
<main id="page" aria-label="Aperçu du procès-verbal" hidden>
  <div id="artwork">
    <img id="template" alt="Modèle de procès-verbal de réception des travaux">
    <span class="value" id="client" style="left:233px;top:203px;width:287px"></span>
    <span class="value" id="installer" style="left:539px;top:240px;width:386px"></span>
    <span class="value" id="order-date" style="left:395px;top:276px;width:135px"></span>
    <span class="value" id="signature-city" style="left:205px;top:929px;width:179px"></span>
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

  const picker = doc.querySelector('#template-picker');
  const values = getReceptionFields(data);
  const installer = api.getReceptionCompanyName().catch(() => '');
  let loadVersion = 0;

  function placeValue(id, value) {
    const field = doc.getElementById(id);
    field.textContent = value;
    field.style.fontSize = '16px';
    for (let size = 16; size > 8 && field.scrollWidth > field.clientWidth; size -= 1) {
      field.style.fontSize = `${size - 1}px`;
    }
  }

  function loadTemplate(source, remember = false) {
    const version = ++loadVersion;
    printButton.disabled = true;
    status.hidden = false;
    status.textContent = 'Préparation du document…';
    image.onload = async () => {
      if (image.naturalWidth !== 1152 || image.naturalHeight !== 1536) {
        image.onerror();
        return;
      }
      const companyName = await installer;
      if (preview.closed || version !== loadVersion) return;
      page.hidden = false;
      fitPage();
      for (const [id, value] of Object.entries(values)) placeValue(id, value);
      placeValue('installer', text(companyName));
      if (remember) {
        try {
          window.localStorage.setItem(TEMPLATE_STORAGE_KEY, source);
        } catch {
          status.textContent = 'Le modèle est prêt à imprimer. Ce navigateur ne peut pas le conserver pour la prochaine fois.';
          printButton.disabled = false;
          return;
        }
      }
      status.hidden = true;
      printButton.disabled = false;
    };
    image.onerror = () => {
      page.hidden = true;
      status.textContent = 'Sélectionne la photo originale IMG_0758.jpeg, au format 1152 × 1536.';
    };
    image.src = source;
  }

  picker.onchange = () => {
    const file = picker.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadTemplate(reader.result, true);
    reader.onerror = () => {
      status.hidden = false;
      status.textContent = 'Impossible de lire la photo. Sélectionne le fichier à nouveau.';
    };
    reader.readAsDataURL(file);
  };

  try {
    const savedTemplate = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (savedTemplate?.startsWith('data:image/jpeg;')) loadTemplate(savedTemplate);
  } catch {
    // The file picker is still available when browser storage is unavailable.
  }
  return true;
}
