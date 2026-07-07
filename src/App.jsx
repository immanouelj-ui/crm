import React, { createContext, useContext, useState, useEffect } from 'react';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import ForgotPassword from './components/ForgotPassword.jsx';
import ResetPassword from './components/ResetPassword.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './components/Dashboard.jsx';
import ContactsGrid from './components/ContactsGrid.jsx';
import ContactPage from './components/ContactPage.jsx';
import Pipeline from './components/Pipeline.jsx';
import Reports from './components/Reports.jsx';
import ApiDocs from './components/ApiDocs.jsx';
import Messaging from './components/Messaging.jsx';
import Billing from './components/Billing.jsx';
import Team from './components/Team.jsx';
import Planning from './components/Planning.jsx';
import Automations from './components/Automations.jsx';
import Settings from './components/Settings.jsx';
import Formalites from './components/Formalites.jsx';

export const AuthContext = createContext(null);

function AuthGate() {
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset_token')) return 'reset';
    return 'login';
  });
  const resetToken = new URLSearchParams(window.location.search).get('reset_token');

  if (view === 'register') return <Register onGoToLogin={() => setView('login')} />;
  if (view === 'forgot') return <ForgotPassword onGoToLogin={() => setView('login')} />;
  if (view === 'reset') return <ResetPassword token={resetToken} onGoToLogin={() => setView('login')} />;
  return <Login onGoToRegister={() => setView('register')} onGoToForgot={() => setView('forgot')} />;
}

export function useAuth() {
  return useContext(AuthContext);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [pendingBillingDoc, setPendingBillingDoc] = useState(null);
  const [enabledModules, setEnabledModules] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    const storedUser = localStorage.getItem('crm_user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      fetch('/api/app-settings', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setEnabledModules(d.modules || {}))
        .catch(() => {});
    }
    setLoading(false);
  }, []);

  function isEnabled(key) {
    return enabledModules[key] !== false;
  }

  function login(token, userData) {
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_user', JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setUser(null);
    setCurrentPage('dashboard');
    setSelectedContactId(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const resetToken = new URLSearchParams(window.location.search).get('reset_token');
  if (resetToken) {
    return (
      <AuthContext.Provider value={{ user, login, logout }}>
        <ResetPassword token={resetToken} onGoToLogin={() => { window.history.replaceState({}, '', '/'); logout(); }} />
      </AuthContext.Provider>
    );
  }

  if (!user) {
    return (
      <AuthContext.Provider value={{ user, login, logout }}>
        <AuthGate />
      </AuthContext.Provider>
    );
  }

  // Full-page contact view takes over the whole screen when a contact is selected
  if (selectedContactId) {
    return (
      <AuthContext.Provider value={{ user, login, logout }}>
        <ContactPage
          contactId={selectedContactId}
          onBack={() => setSelectedContactId(null)}
          onNavigate={setCurrentPage}
          onNewBillingDoc={(contact, type) => {
            setPendingBillingDoc({ type, contact });
            setSelectedContactId(null);
            setCurrentPage('billing');
          }}
        />
      </AuthContext.Provider>
    );
  }

  const isAdmin = !user.role || user.role === 'admin';
  const perms = user.permissions || {};

  function can(key) {
    if (isAdmin) return true;
    return !!perms[key];
  }

  const pages = {
    ...(can('dashboard') && { dashboard: <Dashboard onNavigate={setCurrentPage} onSelectContact={setSelectedContactId} /> }),
    ...(can('contacts') && isEnabled('contacts') && { contacts: <ContactsGrid selectedContact={selectedContact} onSelectContact={setSelectedContactId} /> }),
    ...(can('opportunities') && isEnabled('pipeline') && { pipeline: <Pipeline onSelectContact={setSelectedContactId} /> }),
    ...(can('billing') && isEnabled('billing') && { billing: <Billing pendingDoc={pendingBillingDoc} onPendingDocConsumed={() => setPendingBillingDoc(null)} /> }),
    ...(can('messaging') && isEnabled('messaging') && { messaging: <Messaging /> }),
    ...((isAdmin || (perms.appointments_level && perms.appointments_level !== 'none')) && isEnabled('planning') && { planning: <Planning /> }),
    ...(isEnabled('reports') && { reports: <Reports /> }),
    ...(isEnabled('api') && { api: <ApiDocs /> }),
    ...(isAdmin && { team: <Team /> }),
    ...(isAdmin && isEnabled('automations') && { automations: <Automations /> }),
    ...(isAdmin && { settings: <Settings /> }),
    formalites: <Formalites />,
  };

  const defaultPage = can('dashboard') ? 'dashboard' : Object.keys(pages)[0] || 'dashboard';

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage} isAdmin={isAdmin} permissions={perms} enabledModules={enabledModules}>
        {pages[currentPage] || pages[defaultPage]}
      </Layout>
    </AuthContext.Provider>
  );
}
