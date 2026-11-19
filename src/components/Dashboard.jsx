import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Users, UserPlus, BadgeCheck, CalendarDays, Clock3, RefreshCw, AlertCircle } from 'lucide-react';

const labelOf = client => client.custom_data?.nom || client.custom_data?.name || `Contact #${client.id}`;
const statusOf = client => client.custom_data?.statut || client.custom_data?.status || 'Non renseigné';
const initials = label => label.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase();
const civil = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const displayDate = value => value ? new Date(value).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';

export default function Dashboard({ onNavigate, onSelectContact }) {
  const { user }=useAuth();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const isAdmin=!user?.role || user.role==='admin';
  const canContacts=isAdmin||!!user?.permissions?.contacts;
  const canPlanning=isAdmin||(user?.permissions?.appointments_level && user.permissions.appointments_level!=='none');
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    const results=await Promise.allSettled([
      api.getDashboard(),canContacts?api.getContacts():Promise.resolve(null),
      canPlanning?api.getAppointments():Promise.resolve(null),
    ]);
    const dashboard=results[0].status==='fulfilled'?results[0].value:null;
    const contacts=results[1].status==='fulfilled'?results[1].value:null;
    const appointments=results[2].status==='fulfilled'?results[2].value:null;
    setData({dashboard,contacts,appointments});
    if(!dashboard&&!contacts)setError('Impossible de charger votre activité. Réessayez dans un instant.');
    setLoading(false);
  },[canContacts,canPlanning]);
  useEffect(()=>{load();},[load]);
  const clients=data?.contacts;
  const dashboard=data?.dashboard;
  const today=civil(new Date());
  const nextWeek=new Date();nextWeek.setDate(nextWeek.getDate()+7);
  const upcoming=(data?.appointments||[]).filter(a=>!['cancelled','refused'].includes(a.status)&&a.date>=today&&a.date<=civil(nextWeek)).sort((a,b)=>a.date.localeCompare(b.date)||a.start_time.localeCompare(b.start_time));
  const recent=[...(clients||dashboard?.recentContacts||[])].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at)).slice(0,7);
  const count=status=>clients?clients.filter(c=>statusOf(c)===status).length:null;
  const stats=[
    {label:'Contacts',value:clients?.length??dashboard?.totalContacts,icon:Users,note:'Votre portefeuille clients',featured:true},
    {label:'Leads à suivre',value:count('Lead'),icon:UserPlus,note:'Contacts au statut Lead'},
    {label:'Clients',value:count('Client'),icon:BadgeCheck,note:'Contacts au statut Client'},
    {label:'Rendez-vous',value:data?.appointments?upcoming.length:null,icon:CalendarDays,note:'Sur les 7 prochains jours'},
  ];
  return <div className="overview-page">
    <div className="overview-heading">
      <div><p className="page-eyebrow mb-3">{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p><h1 className="page-title">Vue d’ensemble</h1><p className="page-subtitle">Vos clients, votre activité. Tout simplement.</p></div>
      {canContacts&&<button className="primary-action" onClick={()=>onNavigate('contacts')}><Users size={16}/>Voir les contacts</button>}
    </div>
    {error&&<div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle size={17}/>{error}<button onClick={load} className="font-semibold underline">Réessayer</button></div>}
    <div className="overview-metrics">{stats.map(({label,value,icon:Icon,note,featured})=><section key={label} className={`overview-metric ${featured?'is-featured':''}`}><h2 className="metric-label">{label}<Icon size={17} strokeWidth={1.6}/></h2><p className="metric-number" aria-busy={loading}>{loading?'—':value??'—'}</p><p className="metric-note">{note}</p></section>)}</div>
    <div className="overview-columns">
      <section className="surface-card">
        <div className="surface-heading"><div><h2>Derniers contacts</h2><p>Les fiches récemment mises à jour</p></div>{canContacts&&<button className="text-action" onClick={()=>onNavigate('contacts')}>Tout voir</button>}</div>
        {loading?<p role="status" className="empty-state">Chargement des contacts…</p>:recent.length?recent.map((client,index)=><button key={client.id} className="recent-client" onClick={()=>onSelectContact?.(client.id)} disabled={!canContacts}><span className={`client-monogram ${index%3===1?'is-warm':index%3===2?'is-green':''}`}>{initials(labelOf(client))}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium text-slate-900">{labelOf(client)}</strong><span className="mt-1 block truncate text-xs text-slate-400">{client.custom_data?.email||client.custom_data?.phone||client.custom_data?.ville||'Fiche client'}</span></span><span className={`client-status ${statusOf(client)==='Client'?'is-client':statusOf(client)==='Prospect'?'is-prospect':''}`}>{statusOf(client)}</span><span className="hidden min-w-12 text-right text-[11px] text-slate-400 xl:block">{displayDate(client.updated_at||client.created_at)}</span></button>):<p className="empty-state">Vos contacts apparaîtront ici dès leur création.</p>}
      </section>
      <div className="flex flex-col gap-6">
        <section className="surface-card">
          <div className="surface-heading"><div><h2>Votre agenda</h2><p>Les 7 prochains jours</p></div>{canPlanning&&<button className="text-action" onClick={()=>onNavigate('planning')}>Planning</button>}</div>
          {loading?<p className="empty-state">Chargement de l’agenda…</p>:!data?.appointments?<p className="empty-state">L’agenda est indisponible actuellement.</p>:upcoming.length?upcoming.slice(0,4).map(appt=><button key={appt.id} onClick={()=>appt.contact_id&&canContacts?onSelectContact?.(appt.contact_id):onNavigate('planning')} className="flex w-full items-center gap-4 border-b border-slate-100 px-6 py-4 text-left last:border-0 hover:bg-slate-50"><span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50"><strong className="text-base font-semibold leading-5">{Number(appt.date.slice(8,10))}</strong><span className="text-[11px] uppercase text-slate-400">{new Date(appt.date+'T12:00:00').toLocaleDateString('fr-FR',{month:'short'})}</span></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium">{appt.title||'Rendez-vous'}</strong><span className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400"><Clock3 size={12}/>{appt.start_time.slice(0,5)} – {appt.end_time.slice(0,5)}{appt.status==='pending'?' · À confirmer':''}</span></span></button>):<div className="empty-state"><CalendarDays className="mx-auto mb-3 text-slate-300" size={28} strokeWidth={1.4}/><p>Aucun rendez-vous prévu.</p>{canPlanning&&<button className="text-action mt-3" onClick={()=>onNavigate('planning')}>Ouvrir le planning</button>}</div>}
        </section>
        <section className="surface-card"><div className="surface-heading"><div><h2>Vos relations clients</h2><p>Répartition par statut</p></div><Users size={17} className="text-slate-400"/></div><div className="space-y-4 p-6">{['Lead','Prospect','Client'].map((label,index)=>{const n=count(label);const width=clients?.length?n/clients.length*100:0;return <div key={label}><div className="mb-2 flex justify-between text-xs"><span className="text-slate-500">{label==='Lead'?'Leads':label==='Client'?'Clients':'Prospects'}</span><strong className="font-medium">{n??'—'}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${index===0?'bg-slate-800':index===1?'bg-[#a8b8d4]':'bg-[#a2c8b0]'}`} style={{width:width+'%'}}/></div></div>;})}</div></section>
      </div>
    </div>
    <div className="mt-6 flex justify-end"><button onClick={load} disabled={loading} className="inline-flex min-h-10 items-center gap-2 text-xs text-slate-400 hover:text-slate-700"><RefreshCw size={13} className={loading?'animate-spin':''}/>Actualiser les données</button></div>
  </div>;
}
