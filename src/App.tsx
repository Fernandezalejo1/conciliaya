import React, { useState, useEffect } from 'react';
import { ConciliaProvider, useConcilia } from './context/ConciliaContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { UploadView } from './components/UploadView';
import { ReconciliationView } from './components/ReconciliationView';
import { AccountStatementView } from './components/AccountStatementView';
import { AccountingView } from './components/AccountingView';
import { LearnedAliasesView } from './components/LearnedAliasesView';
import { AuditView } from './components/AuditView';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { ClientsView } from './components/ClientsView';

const SESSION_KEY = 'conciliaya_session';

const MainContent: React.FC = () => {
  const { activeTab } = useConcilia();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {activeTab === 'dashboard' && <DashboardView />}
      {activeTab === 'upload' && <UploadView />}
      {activeTab === 'reconciliation' && <ReconciliationView />}
      {activeTab === 'statements' && <AccountStatementView />}
      {activeTab === 'accounting' && <AccountingView />}
      {activeTab === 'aliases' && <LearnedAliasesView />}
      {activeTab === 'clients' && <ClientsView />}
      {activeTab === 'audit' && <AuditView />}
      {activeTab === 'settings' && <SettingsView />}
    </main>
  );
};

function AppContent() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    localStorage.removeItem(SESSION_KEY);
    fetch('/api/auth').then(r=>setAuthenticated(r.ok)).catch(()=>setAuthenticated(false)).finally(()=>setChecking(false));
    const timer=setInterval(()=>fetch('/api/auth').then(r=>{if(!r.ok)setAuthenticated(false);}).catch(()=>setAuthenticated(false)),60000);
    return ()=>clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth',{method:'DELETE'}).catch(()=>{});
    localStorage.removeItem(SESSION_KEY);
    setAuthenticated(false);
  };

  if (checking) return <p className="p-8">Verificando acceso…</p>;
  if (!authenticated) {
    return <LoginView onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <ConciliaProvider><div className="min-h-screen bg-slate-50/60 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-blue-500 selection:text-white flex flex-col">
      <Navbar onLogout={handleLogout} />
      <div className="flex-1"><MainContent /></div>

      <footer className="border-t border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">ConciliaYA</span>
            <span>— Plataforma de Conciliación de Cuentas por Cobrar</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-400 dark:text-slate-500">
            <span>Modo Operador B2B</span>
            <span>•</span>
            <span>Reglas y alias locales · Confirmación humana</span>
          </div>
        </div>
      </footer>
    </div></ConciliaProvider>
  );
}

export default function App() {
  return <AppContent />;
}
