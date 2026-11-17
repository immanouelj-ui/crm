import { useState } from 'react';
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
  const [showMap, setShowMap] = useState(false);

  const embedUrl = new URL('https://www.google.com/maps/embed/v1/place');
  if (embedKey) {
    embedUrl.search = new URLSearchParams({
      key: embedKey, q: address, maptype: 'satellite', zoom: '19', language: 'fr',
    }).toString();
  }

  return (
    <section className="mb-6 border-b border-slate-100 pb-6">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        Localisation
      </h2>
      <p className="mt-2 break-words text-sm text-slate-700">{address}</p>
      {embedKey && (
        <>
          <button
            type="button"
            aria-expanded={showMap}
            onClick={() => setShowMap(!showMap)}
            className="mt-3 block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            {showMap ? 'Masquer la vue satellite' : 'Afficher la vue satellite'}
          </button>
          {showMap && (
            <iframe
              title="Vue satellite du bâtiment"
              src={embedUrl.href}
              className="mt-3 h-60 w-full rounded-lg border border-slate-200"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          )}
        </>
      )}
      <GoogleMapsLink address={address} className="mt-3 text-indigo-600 hover:text-indigo-800">
        Voir le bâtiment dans Google Maps
      </GoogleMapsLink>
    </section>
  );
}
