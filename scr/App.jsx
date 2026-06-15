import React, { createContext, useContext, useState, useEffect } from 'react';
import Login from './components/Login.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './components/Dashboard.jsx';
import ContactsGrid from './components/ContactsGrid.jsx';
import ContactPage from './components/ContactPage.jsx';
import Pipeline from './components/Pipeline.jsx';
import Reports from './components/Reports.jsx';
import ApiDocs from './components/ApiDocs.jsx';
import Messaging from './components/Messaging.jsx';
import Billing from './components/Billing.jsx';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [pendingBillingDoc, setPendingBillingDoc] = useState(null); // { type, contact }

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    const storedUser = localStorage.getItem('crm_user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

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

  if (!user) {
    return (
      <AuthContext.Provider value={{ user, login, logout }}>
        <Login />
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

  const pages = {
    dashboard: <Dashboard onNavigate={setCurrentPage} onSelectContact={setSelectedContactId} />,
    contacts: <ContactsGrid selectedContact={selectedContact} onSelectContact={setSelectedContactId} />,
    pipeline: <Pipeline onSelectContact={setSelectedContactId} />,
    billing: <Billing pendingDoc={pendingBillingDoc} onPendingDocConsumed={() => setPendingBillingDoc(null)} />,
    reports: <Reports />,
    api: <ApiDocs />,
    messaging: <Messaging />,
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {pages[currentPage] || <Dashboard onNavigate={setCurrentPage} onSelectContact={setSelectedContactId} />}
      </Layout>
    </AuthContext.Provider>
  );
}
