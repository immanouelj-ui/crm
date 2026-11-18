import { useEffect, useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';

const embedKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY?.trim();

function addressPart(data, keys) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value).trim();
    if (text && text !== '—' && text !== '-') return text;
  }
  return '';
}

export function getBuildingAddress(data) {
  const street = addressPart(data, ['adresse', 'address', 'adresse_postale', 'rue']);
  const postalCode = addressPart(data, ['cp', 'code_postal', 'codepostal', 'postal_code', 'zip']);
  const city = addressPart(data, ['ville', 'city', 'commune', 'localite']);
  const country = addressPart(data, ['pays', 'country']);
  if (!street) return '';
  const locality = [postalCode, city]
    .filter(part => part && !street.toLowerCase().includes(part.toLowerCase()))
    .join(' ');
  return [street, locality, country].filter(Boolean).join(', ');
}

export function GoogleMapsLink({ address, className, children }) {
  const mapsUrl = new URL('https://www.google.com/maps/search/');
  mapsUrl.search = new URLSearchParams({ api: '1', query: address }).toString();

  return (
    <a
      href={mapsUrl.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${className}`}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </a>
  );
}

export default function ContactMap({ address }) {
  return <BuildingMap key={address} address={address} />;
}

function BuildingMap({ address }) {
  const [mode, setMode] = useState(null);
  const [position, setPosition] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (mode !== 'streetview' || position) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let active = true;
    setError('');
    const url = new URL('https://data.geopf.fr/geocodage/search');
    url.search = new URLSearchParams({ q: address, limit: '1', index: 'address' }).toString();
    fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then(async response => {
        if (!response.ok) throw new Error('Recherche de l’adresse indisponible. Réessaie dans un instant.');
        const result = await response.json();
        const feature = result.features?.[0];
        const [lng, lat] = feature?.geometry?.coordinates || [];
        if (feature?.geometry?.type !== 'Point' || !Number.isFinite(lat) || !Number.isFinite(lng)
          || Math.abs(lat) > 90 || Math.abs(lng) > 180 || Number(feature?.properties?.score || 0) < 0.65
          || !['housenumber', 'street'].includes(feature?.properties?.type)) {
          throw new Error('Adresse trop imprécise. Vérifie la rue, le code postal et la ville dans la fiche.');
        }
        if (active) setPosition({ lat, lng, label: feature.properties.label, approximate: feature.properties.type !== 'housenumber' });
      })
      .catch(failure => {
        if (active) setError(failure.name === 'AbortError' ? 'La recherche de l’adresse a pris trop de temps. Réessaie.' : failure.message);
      })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [address, mode, position, retry]);

  const embedUrl = new URL('https://www.google.com/maps/embed/v1/' + (mode === 'streetview' ? 'streetview' : 'place'));
  if (embedKey) {
    embedUrl.search = new URLSearchParams(mode === 'streetview' && position ? {
      key: embedKey, location: `${position.lat},${position.lng}`, radius: '50', source: 'outdoor', language: 'fr',
    } : { key: embedKey, q: address, maptype: 'satellite', zoom: '19', language: 'fr' }).toString();
  }
  const streetUrl = new URL('https://www.google.com/maps/@');
  if (position) streetUrl.search = new URLSearchParams({ api: '1', map_action: 'pano', viewpoint: `${position.lat},${position.lng}` }).toString();

  return (
    <section className="mb-6 border-b border-slate-100 pb-6">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />Localisation
      </h2>
      <p className="mt-2 break-words text-sm text-slate-700">{address}</p>
      {embedKey && <>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Vue du bâtiment">
          {[['streetview', 'Street View'], ['satellite', 'Satellite']].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}
              className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${mode === value ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-indigo-600 hover:bg-indigo-50'}`}>
              {label}
            </button>
          ))}
          {mode && <button type="button" onClick={() => setMode(null)} className="min-h-11 px-2 text-sm text-slate-500">Masquer</button>}
        </div>
        {mode === 'streetview' && !position && !error && <p role="status" className="mt-3 text-sm text-slate-500">Recherche de l’adresse pour Street View…</p>}
        {mode === 'streetview' && error && <div role="alert" className="mt-3 text-sm text-amber-700">
          <p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 min-h-11 font-medium underline">Réessayer</button>
        </div>}
        {mode && (mode !== 'streetview' || position) && <>
          {mode === 'streetview' && position.label && <p className="mt-3 text-xs text-slate-500">{position.approximate ? 'Rue localisée (position approximative)' : 'Adresse localisée'} : {position.label}</p>}
          <iframe key={embedUrl.href} title={mode === 'streetview' ? 'Street View — vue depuis la rue' : 'Vue satellite du bâtiment'}
            src={embedUrl.href} className="mt-3 h-80 w-full min-w-[200px] rounded-lg border border-slate-200"
            referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          {mode === 'streetview' && <>
            <p className="mt-2 text-xs text-slate-500">Fais pivoter la vue pour regarder la façade. Si Google ne dispose pas d’images dans cette rue, utilise la vue satellite.</p>
            <a href={streetUrl.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm text-indigo-600"><ExternalLink className="h-3.5 w-3.5" />Ouvrir Street View dans Maps</a>
          </>}
        </>}
      </>}
      <GoogleMapsLink address={address} className="mt-3 text-indigo-600 hover:text-indigo-800">Voir le bâtiment dans Google Maps</GoogleMapsLink>
    </section>
  );
}
