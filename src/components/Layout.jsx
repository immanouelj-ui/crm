import React, { useState } from 'react';
import { useAuth } from '../App.jsx';
import Softphone from './Softphone.jsx';
import {
  LayoutDashboard, Users, Kanban, BarChart3, Key, LogOut, Menu, X, Send, Receipt, UserCog, CalendarDays, Zap, Settings, FileSignature,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Tableau de bord',  icon: LayoutDashboard, perm: 'dashboard' },
  { id: 'contacts',    label: 'Contacts',          icon: Users,           perm: 'contacts' },
  { id: 'pipeline',    label: 'Pipeline',          icon: Kanban,          perm: 'opportunities',      moduleKey: 'pipeline' },
  { id: 'billing',     label: 'Facturation',       icon: Receipt,         perm: 'billing',            moduleKey: 'billing' },
  { id: 'messaging',   label: 'Messagerie',        icon: Send,            perm: 'messaging',          moduleKey: 'messaging' },
  { id: 'planning',    label: 'Planning',          icon: CalendarDays,    perm: 'appointments_level', moduleKey: 'planning', permCheck: v => v && v !== 'none' },
  { id: 'reports',     label: 'Rapports',          icon: BarChart3,       perm: null,                 moduleKey: 'reports' },
  { id: 'api',         label: 'API & Integrations',icon: Key,             perm: null,                 moduleKey: 'api' },
  { id: 'team',        label: 'Mon equipe',        icon: UserCog,         perm: null, adminOnly: true },
  { id: 'formalites',  label: 'Formalités',         icon: FileSignature,   perm: null },
  { id: 'automations', label: 'Automatisations',   icon: Zap,             perm: null, adminOnly: true, moduleKey: 'automations' },
  { id: 'settings',   label: 'Reglages',           icon: Settings,        perm: null, adminOnly: true },
];

function UserAvatar({ name, email, size = 'sm' }) {
  const initials = (name || email || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function Layout({ children, currentPage, onNavigate, isAdmin, permissions, enabledModules = {} }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  function canSee(item) {
    if (item.adminOnly && !isAdmin) return false;
    if (item.moduleKey && enabledModules[item.moduleKey] === false) return false;
    if (isAdmin) return true;
    if (!item.perm) return true;
    const val = permissions?.[item.perm];
    if (item.permCheck) return item.permCheck(val);
    return !!val;
  }

  const navItems = NAV_ITEMS.filter(canSee);
  const currentNav = navItems.find(n => n.id === currentPage);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 flex flex-col transition-all duration-200`}
        style={{ backgroundColor: '#0f172a' }}
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700/50">
          <span className="text-indigo-400 text-xl font-bold flex-shrink-0">H</span>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">Hakol</p>
              <p className="text-slate-400 text-xs truncate">{user?.email}</p>
              {!isAdmin && (
                <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">Employe</span>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                currentPage === id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-700/50 p-2">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm">Deconnexion</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 shadow-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <h1 className="flex-1 text-sm font-semibold text-slate-900">
            {currentNav?.label || 'Tableau de bord'}
          </h1>
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-slate-900">{user?.name || user?.email}</p>
            </div>
            <UserAvatar name={user?.name} email={user?.email} />
          </div>
        </header>

        <main className="flex-1 overflow-auto scrollbar-thin">
          {children}
        </main>
      </div>
      <Softphone />
    </div>
  );
}
