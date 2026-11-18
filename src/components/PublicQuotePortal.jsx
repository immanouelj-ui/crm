import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Download, FileText, RefreshCw } from 'lucide-react';

const money = value => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(value || 0));
const date = value => { const parsed = new Date(String(value).length===10?value+'T12:00:00+01:00':value); return value && Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'Europe/Paris'}).format(parsed) : '—'; };

export default function PublicQuotePortal({ token }) {
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [name,setName]=useState('');
  const [agreed,setAgreed]=useState(false);
  const [busy,setBusy]=useState(false);
  const endpoint='/api/public/quotes/'+encodeURIComponent(token);
  useEffect(()=>{
    let active=true;
    fetch(endpoint,{credentials:'omit',cache:'no-store'})
      .then(async response=>{
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body.error || 'Impossible de consulter ce devis.');
        if(!body.document || !Array.isArray(body.document.lines))throw new Error('Ce devis est indisponible.');
        if(active)setData(body);
      }).catch(failure=>{if(active)setError(failure.message);});
    return()=>{active=false;};
  },[endpoint]);

  async function accept(){
    setBusy(true);setError('');
    try {
      const response=await fetch(endpoint+'/accept',{
        method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name,agreed}),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error || 'L’acceptation n’a pas pu être enregistrée.');
      setData(body);
    } catch(failure){setError(failure.message);}
    finally{setBusy(false);}
  }
  if(!data)return <main className="mx-auto max-w-xl p-6 pt-20">{error?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>:<p role="status" className="flex items-center gap-2 text-slate-600"><RefreshCw className="h-4 w-4 animate-spin" />Chargement du devis…</p>}</main>;
  const doc=data.document;
  const company=data.company || {};
  const accent=/^#[a-f0-9]{6}$/i.test(company.accent_color || '')?company.accent_color:'#4f46e5';
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-7 md:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xl font-semibold text-slate-900">{company.name || 'Votre entreprise'}</p><p className="mt-1 text-sm text-slate-500">{[company.address,company.zip,company.city].filter(Boolean).join(' ')}</p>{company.email && <p className="mt-1 text-sm text-slate-500">{company.email}</p>}</div>
          <a href={endpoint+'/pdf'} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700"><Download className="h-4 w-4" />Télécharger le devis PDF</a>
        </header>
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-5 text-white md:p-7" style={{backgroundColor:accent}}>
              <p className="flex items-center gap-2 text-sm opacity-90"><FileText className="h-4 w-4" />Votre devis</p>
              <h1 className="mt-2 text-2xl font-semibold">{doc.number}</h1>
              <p className="mt-2 text-sm opacity-90">Émis le {date(doc.issue_date)}{doc.valid_until?' · Valable jusqu’au '+date(doc.valid_until):''}</p>
            </div>
            <div className="p-5 md:p-7">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Client</h2>
              <p className="mt-2 font-medium text-slate-900">{doc.client_name}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{[doc.client_address,[doc.client_zip,doc.client_city].filter(Boolean).join(' ')].filter(Boolean).join('\n')}</p>
              {doc.client_siret && <p className="mt-1 text-xs text-slate-500">SIRET {doc.client_siret}</p>}
              <div className="mt-6 divide-y divide-slate-100 border-y border-slate-100">
                {doc.lines.map((line,index)=><article key={index} className="py-4">
                  <p className="whitespace-pre-wrap text-sm font-medium text-slate-800">{line.description}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{line.qty} {line.unit || 'unité'} × {money(line.unit_price)} HT · TVA {line.tva_rate || 0} %</span>
                    <span className="font-medium text-slate-800">{money(Number(line.qty)*Number(line.unit_price))} HT</span>
                  </div>
                </article>)}
              </div>
              <dl className="ml-auto mt-5 max-w-xs space-y-2 text-sm">
                <div className="flex justify-between gap-4 text-slate-500"><dt>Total HT</dt><dd>{money(doc.total_ht)}</dd></div>
                <div className="flex justify-between gap-4 text-slate-500"><dt>TVA</dt><dd>{money(doc.total_tva)}</dd></div>
                <div className="flex justify-between gap-4 border-t border-slate-100 pt-3 text-lg font-semibold text-slate-900"><dt>Total TTC</dt><dd>{money(doc.total_ttc)}</dd></div>
              </dl>
              {doc.notes && <div className="mt-7"><h2 className="mb-2 text-sm font-semibold text-slate-900">Conditions et précisions</h2><p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{doc.notes}</p></div>}
              {(doc.footer || company.invoice_footer) && <p className="mt-6 whitespace-pre-wrap border-t border-slate-100 pt-4 text-xs text-slate-500">{doc.footer || company.invoice_footer}</p>}
              <p className="mt-6 text-xs text-slate-400">{[company.legal_form,company.siret?'SIRET '+company.siret:'',company.tva_number?'TVA '+company.tva_number:''].filter(Boolean).join(' · ')}</p>
            </div>
          </section>
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            {data.accepted_at?<div role="status">
              <CheckCircle className="h-7 w-7 text-emerald-600" />
              <h2 className="mt-3 text-lg font-semibold text-slate-900">Devis accepté</h2>
              <p className="mt-2 text-sm text-slate-600">Accepté par {data.accepted_by} le {date(data.accepted_at)} à {new Date(data.accepted_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})}.</p>
              <p className="mt-3 text-sm text-slate-500">Votre acceptation a bien été enregistrée.</p>
            </div>:data.expired?<div><AlertCircle className="h-6 w-6 text-amber-600" /><h2 className="mt-3 font-semibold text-slate-900">Validité dépassée</h2><p className="mt-2 text-sm text-slate-600">Contactez l’entreprise pour obtenir un devis à jour.</p></div>:<>
              <h2 className="font-semibold text-slate-900">Accepter ce devis</h2>
              <p className="mt-2 text-sm text-slate-500">Montant TTC : <strong className="text-slate-900">{money(doc.total_ttc)}</strong></p>
              <label className="mt-5 block text-sm text-slate-700">Votre nom et prénom<input value={name} onChange={event=>setName(event.target.value)} autoComplete="name" maxLength={160} className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-base" /></label>
              <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-slate-600"><input type="checkbox" checked={agreed} onChange={event=>setAgreed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />J’ai pris connaissance du devis, de ses prestations, de ses conditions et de son montant TTC. Je l’accepte.</label>
              <button onClick={accept} disabled={busy || !agreed || name.trim().length<2} className="mt-5 min-h-12 w-full rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50" style={{backgroundColor:accent}}>{busy?'Enregistrement…':'Accepter le devis'}</button>
            </>}
            {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
