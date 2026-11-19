import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../App.jsx';
import Softphone from './Softphone.jsx';
import LeadNotifications from './LeadNotifications.jsx';
import { LayoutDashboard, Users, BarChart3, Key, LogOut, Menu, X, Send, Receipt, UserCog, CalendarDays, Zap, Settings, PhoneCall, TrendingUp, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const NAV_ITEMS = [
  { id:'dashboard', label:'Vue d’ensemble', icon:LayoutDashboard, perm:'dashboard', group:'workspace' },
  { id:'contacts', label:'Contacts', icon:Users, perm:'contacts', group:'workspace' },
  { id:'planning', label:'Planning', icon:CalendarDays, perm:'appointments_level', moduleKey:'planning', permCheck:v=>v && v!=='none', group:'workspace' },
  { id:'billing', label:'Devis & factures', icon:Receipt, perm:'billing', moduleKey:'billing', group:'workspace' },
  { id:'accounting', label:'Comptabilité', icon:TrendingUp, perm:'billing', moduleKey:'billing', group:'workspace' },
  { id:'messaging', label:'Messagerie', icon:Send, perm:'messaging', moduleKey:'messaging', group:'activity' },
  { id:'campaigns', label:'Campagnes d’appels', icon:PhoneCall, group:'activity' },
  { id:'reports', label:'Rapports', icon:BarChart3, moduleKey:'reports', group:'activity' },
  { id:'team', label:'Équipe', icon:UserCog, adminOnly:true, group:'admin' },
  { id:'automations', label:'Automatisations', icon:Zap, adminOnly:true, moduleKey:'automations', group:'admin' },
  { id:'api', label:'API & intégrations', icon:Key, moduleKey:'api', group:'admin' },
  { id:'settings', label:'Réglages', icon:Settings, adminOnly:true, group:'admin' },
];
const GROUPS = { workspace:'Espace de travail', activity:'Activité', admin:'Gestion' };
export default function Layout({ children, currentPage, onNavigate, isAdmin, permissions, enabledModules = {} }) {
  const { user, logout } = useAuth();
  const [mobile, setMobile] = useState(() => window.innerWidth < 1024);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef=useRef(null);
  const menuRef=useRef(null);
  useEffect(() => {
    const media=window.matchMedia('(max-width: 1023px)');
    const update=()=>{setMobile(media.matches);setMobileOpen(false);};
    media.addEventListener('change',update);
    return()=>media.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    if(!mobileOpen)return;
    sidebarRef.current?.querySelector('button')?.focus();
    const close=event=>{
      if(event.key==='Escape')setMobileOpen(false);
      if(event.key==='Tab'){
        const controls=[...sidebarRef.current.querySelectorAll('button,a[href]')];
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    window.addEventListener('keydown',close);
    return()=>{window.removeEventListener('keydown',close);menuRef.current?.focus();};
  },[mobileOpen]);
  const visible=item=>{
    if(item.adminOnly&&!isAdmin)return false;
    if(item.moduleKey&&enabledModules[item.moduleKey]===false)return false;
    if(isAdmin||!item.perm)return true;
    return item.permCheck?item.permCheck(permissions?.[item.perm]):!!permissions?.[item.perm];
  };
  const items=NAV_ITEMS.filter(visible);
  const active=items.find(item=>item.id===currentPage);
  const expanded=mobile||!collapsed;
  const navigate=id=>{onNavigate(id);setMobileOpen(false);};
  const initials=(user?.name||user?.email||'?').split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase();
  return <div className="workspace-shell">
    <a href="#workspace-content" className="skip-link">Aller au contenu</a>
    {mobile&&mobileOpen&&<button aria-label="Fermer la navigation" className="nav-overlay" onClick={()=>setMobileOpen(false)} />}
    <aside ref={sidebarRef} id="workspace-navigation" aria-label="Navigation principale" inert={mobile&&!mobileOpen?'':undefined} className={`workspace-sidebar ${expanded?'':'is-collapsed'} ${mobileOpen?'is-open':''}`}>
      <div className="workspace-brand">
        <span className="brand-monogram">H<span /></span>
        {expanded&&<div><p>Hakol<span className="brand-dot">.</span></p><span className="brand-caption">Votre espace professionnel</span></div>}
        {mobile&&<button className="icon-control ml-auto" aria-label="Fermer le menu" onClick={()=>setMobileOpen(false)}><X size={18}/></button>}
      </div>
      <nav className="workspace-nav">
        {Object.entries(GROUPS).map(([group,label])=>{
          const entries=items.filter(item=>item.group===group);
          if(!entries.length)return null;
          return <div className="nav-group" key={group}>
            {expanded&&<p className="nav-group-label">{label}</p>}
            {entries.map(({id,label,icon:Icon})=><button key={id} title={label} aria-label={label} aria-current={id===currentPage?'page':undefined} onClick={()=>navigate(id)} className={`nav-item ${id===currentPage?'is-active':''}`}><Icon size={19} strokeWidth={1.7}/>{expanded&&<span>{label}</span>}</button>)}
          </div>;
        })}
      </nav>
      <div className="sidebar-footer">
        {expanded&&<div className="workspace-account"><span className="user-avatar">{initials}</span><div><strong>{user?.name||'Mon compte'}</strong><span>{isAdmin?'Administrateur':'Membre de l’équipe'}</span></div></div>}
        <button className="nav-item logout-control" onClick={logout} title="Déconnexion"><LogOut size={18}/>{expanded&&<span>Déconnexion</span>}</button>
      </div>
    </aside>
    <div className="workspace-body" inert={mobile&&mobileOpen?'':undefined}>
      <header className="workspace-topbar">
        <div className="flex min-w-0 items-center gap-3">
          <button ref={menuRef} className="icon-control" onClick={()=>mobile?setMobileOpen(!mobileOpen):setCollapsed(!collapsed)} aria-controls="workspace-navigation" aria-expanded={mobile?mobileOpen:!collapsed} aria-label={mobile?'Ouvrir le menu':collapsed?'Développer la navigation':'Réduire la navigation'}>{mobile?<Menu size={20}/>:collapsed?<PanelLeftOpen size={19}/>:<PanelLeftClose size={19}/>}</button>
          <span className="topbar-divider"/>
          <span className="topbar-crumb">Espace de travail</span><span className="text-slate-300 hidden sm:inline">/</span>
          <span className="truncate text-sm font-medium text-slate-900">{active?.label||'Vue d’ensemble'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {(isAdmin||permissions?.contacts||permissions?.billing)&&<LeadNotifications/>}
          <span className="topbar-divider"/>
          <span className="user-avatar" title={user?.name||user?.email}>{initials}</span>
        </div>
      </header>
      <main id="workspace-content" className="workspace-content scrollbar-thin" tabIndex={-1}>{children}</main>
    </div>
    <Softphone/>
  </div>;
}
