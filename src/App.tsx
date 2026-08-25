import React from 'react';
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
      {activeTab === 'audit' && <AuditView />}
      {activeTab === 'settings' && <SettingsView />}
    </main>
  );
};

export default function App() {
  return (
    <ConciliaProvider>
      <div className="min-h-screen bg-slate-50/60 text-slate-900 font-sans antialiased selection:bg-blue-500 selection:text-white flex flex-col">
        <Navbar />
        <div className="flex-1">
          <MainContent />
        </div>

        {/* Minimal professional footer */}
        <footer className="border-t border-slate-200/80 bg-white py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">ConciliaYA</span>
              <span>— Plataforma de Conciliación de Cuentas por Cobrar</span>
            </div>
            <div className="flex items-center space-x-3 text-slate-400">
              <span>Modo Operador B2B</span>
              <span>•</span>
              <span>Auditoría Determinística 100% Humano-en-el-Bucle</span>
            </div>
          </div>
        </footer>
      </div>
    </ConciliaProvider>
  );
}
