import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  RotateCcw,
  Sparkles,
  UploadCloud,
  Users,
  Settings,
  ShieldCheck,
  Receipt,
  X
} from 'lucide-react';
import { useConcilia } from '../context/ConciliaContext';

interface NavbarProps {
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onLogout }) => {
  const {
    company,
    activeTab,
    setActiveTab,
    bankMovements,
    officialReceipts,
    resetToDemo
  } = useConcilia();

  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const pendingReviewCount = bankMovements.filter(
    m => m.estado_conciliacion === 'sugerido' || m.estado_conciliacion === 'sin_identificar' || m.estado_conciliacion === 'auto'
  ).length;

  const autoCount = bankMovements.filter(m => m.estado_conciliacion === 'auto').length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Carga de Archivos', icon: UploadCloud },
    { id: 'clients', label: 'Clientes', icon: Users },
    {
      id: 'reconciliation',
      label: 'Conciliación',
      icon: CheckCircle2,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
      badgeColor: autoCount > 0 ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
    },
    { id: 'statements', label: 'Estado de Cuenta', icon: Users },
    {
      id: 'accounting',
      label: 'Asientos y Recibos',
      icon: Receipt,
      badge: officialReceipts.length > 0 ? officialReceipts.length : undefined,
      badgeColor: 'bg-indigo-600 text-white'
    },
    { id: 'aliases', label: 'Alias Aprendidos', icon: Sparkles },
    { id: 'audit', label: 'Auditoría', icon: History },
    { id: 'settings', label: '', icon: Settings },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top utility bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Company info */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">Concilia<span className="text-blue-600">YA</span></span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                  MVP Cuentas por Cobrar
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                <Building2 className="h-3 w-3 text-slate-400" />
                <span>{company.name}</span>
                <span className="text-slate-300">•</span>
                <span>RUT {company.rut}</span>
                {company.usdExchangeRate && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-indigo-600 font-semibold">TC USD: ${company.usdExchangeRate}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick status & Actions */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowResetConfirm(true)}
              title="Restablecer datos demo"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              Reset Demo
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
              Nueva Carga
            </button>

            <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Cerrar sesión"
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg transition-colors cursor-pointer border border-transparent"
              >
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                Salir
              </button>
            )}

            <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="font-medium text-slate-700">Operador Activo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation tabs */}
      <div className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none" aria-label="Tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={item.label || 'Configuración'}
                  className={`
                    group inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                    ${isActive
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/90 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }
                  `}
                >
                  <Icon
                    className={`h-4 w-4 mr-2 ${
                      isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                        item.badgeColor || 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* In-app Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">¿Restablecer datos demo?</h3>
                  <p className="text-xs text-slate-500">Se restaurarán los movimientos y facturas iniciales.</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 my-4 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              Esta acción volverá a cargar los casos de importadora uruguaya (matches exactos, pagos parciales, sobrepagos y retenciones).
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  resetToDemo();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs cursor-pointer"
              >
                Restablecer Ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
