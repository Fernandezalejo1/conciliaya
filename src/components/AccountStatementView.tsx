import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  CreditCard,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Mail,
  Phone,
  Printer,
  Search,
  Sparkles,
  Send,
  Copy,
  History,
  AlertCircle,
  ExternalLink,
  Users
} from 'lucide-react';
import { useConcilia } from '../context/ConciliaContext';
import { Invoice } from '../types';

export const AccountStatementView: React.FC = () => {
  const {
    company,
    clients,
    invoices,
    paymentApplications,
    clientCredits,
    emailReminderLogs,
    logEmailReminder,
    applyCreditToInvoice
  } = useConcilia();

  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [clientSearchTerm, setClientSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'ledger' | 'pending_invoices' | 'paid_invoices' | 'email_logs'>('ledger');

  // Email modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];

  // Compute debt from invoices (source of truth) instead of client.currentBalance
  const getClientDebt = (clientId: string) =>
    invoices
      .filter(i => i.cliente_id === clientId && i.saldo_pendiente > 0 && i.estado !== 'pagada' && i.estado !== 'anulada')
      .reduce((sum, i) => sum + i.saldo_pendiente, 0);

  const selectedClientDebt = getClientDebt(selectedClientId);

  // Invoices for client
  const clientInvoices = invoices.filter(i => i.cliente_id === selectedClientId);
  const pendingInvoices = clientInvoices.filter(i => i.saldo_pendiente > 0 && i.estado !== 'pagada' && i.estado !== 'anulada');
  const paidInvoices = clientInvoices.filter(i => i.estado === 'pagada');

  // Payments for client
  const clientPayments = paymentApplications.filter(p => p.cliente_id === selectedClientId);

  // Available credits for client
  const clientAvailableCredits = clientCredits.filter(c => c.cliente_id === selectedClientId && c.saldo_disponible > 0);
  const totalAvailableCredit = clientAvailableCredits.reduce((sum, c) => sum + c.saldo_disponible, 0);

  // Email logs for this client
  const clientEmailLogs = emailReminderLogs.filter(log => log.cliente_id === selectedClientId);

  // Aging buckets calculation for this client
  const now = new Date().getTime();
  const aging = {
    al_dia: 0,
    dias_1_30: 0,
    dias_31_60: 0,
    dias_61_90: 0,
    mas_90_dias: 0
  };

  pendingInvoices.forEach(inv => {
    const dueTime = new Date(inv.vencimiento).getTime();
    const diffDays = Math.floor((now - dueTime) / (1000 * 60 * 60 * 24));
    const amount = inv.saldo_pendiente;

    if (diffDays <= 0) aging.al_dia += amount;
    else if (diffDays <= 30) aging.dias_1_30 += amount;
    else if (diffDays <= 60) aging.dias_31_60 += amount;
    else if (diffDays <= 90) aging.dias_61_90 += amount;
    else aging.mas_90_dias += amount;
  });

  // Build unified ledger (Cuenta Corriente)
  interface LedgerEntry {
    id: string;
    fecha: string;
    concepto: string;
    tipo: 'factura' | 'pago' | 'credito';
    documento: string;
    debito: number; // + aumenta deuda
    credito: number; // - reduce deuda
    saldoAcumulado: number;
  }

  const buildLedger = (): LedgerEntry[] => {
    const rawEntries: Array<{
      id: string;
      fecha: string;
      concepto: string;
      tipo: 'factura' | 'pago' | 'credito';
      documento: string;
      debito: number;
      credito: number;
    }> = [];

    // Add Invoices (Débito)
    clientInvoices.forEach(inv => {
      rawEntries.push({
        id: inv.id,
        fecha: inv.fecha,
        concepto: `Emisión de Factura ${inv.numero} (${inv.moneda || 'UYU'})`,
        tipo: 'factura',
        documento: inv.numero,
        debito: inv.importe,
        credito: 0
      });
    });

    // Add Payments (Crédito)
    clientPayments.forEach(pay => {
      rawEntries.push({
        id: pay.id,
        fecha: pay.fecha,
        concepto: `Cobranza Bancaria (Abono Fac: ${pay.factura_numero})`,
        tipo: 'pago',
        documento: pay.factura_numero,
        debito: 0,
        credito: pay.monto_aplicado
      });
    });

    // Sort chronologically
    rawEntries.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    // Calculate progressive running balance
    let running = 0;
    return rawEntries.map(entry => {
      running += (entry.debito - entry.credito);
      return {
        ...entry,
        saldoAcumulado: running
      };
    });
  };

  const ledger = buildLedger();

  const handleExportCSV = () => {
    if (!selectedClient) return;
    let csv = `Estado de Cuenta - ${selectedClient.name}\nRUT: ${selectedClient.rut_ci}\nFecha Emisión: ${new Date().toLocaleDateString()}\n\n`;
    csv += `Fecha,Concepto,Documento,Débito,Crédito,Saldo Acumulado\n`;

    ledger.forEach(row => {
      csv += `${row.fecha},"${row.concepto}",${row.documento},${row.debito},${row.credito},${row.saldoAcumulado}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `estado_cuenta_${selectedClient.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyCredit = (creditId: string, invoiceId: string, amount: number) => {
    applyCreditToInvoice(creditId, invoiceId, amount);
  };

  // Open Email Generator Modal
  const handleOpenEmailModal = () => {
    if (!selectedClient) return;

    const invoicesListText = pendingInvoices.map(
      i => `  • Factura ${i.numero} — Vto: ${i.vencimiento} — Saldo: ${i.moneda === 'USD' ? 'USD ' : '$'}${i.saldo_pendiente.toLocaleString()}`
    ).join('\n');

    const bankDetails = (company.bankAccounts || []).map(
      b => `  - ${b.bank} (${b.currency}): Cta N° ${b.accountNumber} ${b.cbu_iban ? `[${b.cbu_iban}]` : ''}`
    ).join('\n');

    const defaultSubject = `Estado de Cuenta y Liquidación Pendiente — ${company.name}`;
    const defaultBody = `Estimados ${selectedClient.name},
${selectedClient.contactPerson ? `Atn.: ${selectedClient.contactPerson}\n` : ''}
Por medio de la presente, les compartimos el detalle actualizado de su estado de cuenta corriente con ${company.name} al día de hoy (${new Date().toLocaleDateString('es-UY')}).

RESUMEN DE CUENTA:
--------------------------------------------------
Saldo total pendiente de cobro: ${company.currencySymbol} ${selectedClientDebt.toLocaleString('es-UY')}
${totalAvailableCredit > 0 ? `Crédito / Saldo a favor disponible: ${company.currencySymbol} ${totalAvailableCredit.toLocaleString('es-UY')}\n` : ''}
DETALLE DE FACTURAS PENDIENTES:
${invoicesListText || '  (No registra facturas vencidas a la fecha)'}

CUENTAS BANCARIAS HABILITADAS PARA TRANSFERENCIA:
${bankDetails || `  - Banco República (BROU): Cta Corriente en Pesos 001558231-00002`}

Agradecemos nos envíen el comprobante de transferencia bancaria respondiendo a este correo para imputar la conciliación de inmediato.

Saludos cordiales,
Departamento de Cobranzas y Tesorería
${company.name}
${company.phone ? `Tel: ${company.phone}` : ''} | ${company.email ? `Email: ${company.email}` : ''}`;

    setEmailRecipient(selectedClient.email || 'administracion@empresa.com');
    setEmailSubject(defaultSubject);
    setEmailBody(defaultBody);
    setIsEmailModalOpen(true);
  };

  // Send / Record Email Reminder
  const handleSendEmail = () => {
    if (!selectedClient) return;

    logEmailReminder(
      selectedClient.id,
      selectedClient.name,
      emailRecipient,
      emailSubject,
      selectedClientDebt,
      pendingInvoices.map(i => i.numero)
    );

    // Open mailto link in new window for direct client send
    const mailtoUrl = `mailto:${encodeURIComponent(emailRecipient)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, '_blank');

    setIsEmailModalOpen(false);
    setNotificationMsg(`Correo de estado de cuenta registrado en la auditoría para ${selectedClient.name}.`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(`Para: ${emailRecipient}\nAsunto: ${emailSubject}\n\n${emailBody}`);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notificationMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{notificationMsg}</span>
          </div>
          <button onClick={() => setNotificationMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            ×
          </button>
        </div>
      )}

      {/* Top Header & Client Selector */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Estado de Cuenta / Cuenta Corriente</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Historial contable de débitos, cobranzas, saldos vencidos y emisión de avisos por correo electrónico.
          </p>
        </div>

        {/* Client Picker & Actions */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Users className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              {clients
                .filter(c =>
                  !clientSearchTerm ||
                  c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
                  (c.alias_conocidos || []).some(a => a.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
                  c.rut_ci.includes(clientSearchTerm)
                )
                .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.creditBalance > 0 ? ` — A favor ${company.currencySymbol}${c.creditBalance.toLocaleString('es-UY')}` : getClientDebt(c.id) > 0 ? ` — Debe ${company.currencySymbol}${getClientDebt(c.id).toLocaleString('es-UY')}` : ' — al día'}
              </option>
                ))}
            </select>
            <ChevronDown className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
          </div>

          <div className="relative w-full md:w-56">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Filtrar clientes..."
              value={clientSearchTerm}
              onChange={(e) => setClientSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleOpenEmailModal}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 shrink-0"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Enviar Email</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 shrink-0"
          >
            <Download className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {selectedClient && (
        <>
          {/* Client Financial Summary Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-700">
              <div className="space-y-1">
                <div className="flex items-center space-x-3">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedClient.name}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    RUT/CI: {selectedClient.rut_ci}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                  {selectedClient.contactPerson && (
                    <span>Contacto: <strong className="text-slate-700 dark:text-slate-300">{selectedClient.contactPerson}</strong></span>
                  )}
                  {selectedClient.email && (
                    <span className="flex items-center space-x-1">
                      <Mail className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      <span className="text-blue-600 font-medium">{selectedClient.email}</span>
                    </span>
                  )}
                  {selectedClient.phone && (
                    <span className="flex items-center space-x-1">
                      <Phone className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      <span>{selectedClient.phone}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action button inside card */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleOpenEmailModal}
                  className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
                >
                  <Mail className="h-4 w-4 mr-1.5" />
                  Redactar Notificación de Deuda
                </button>

                {totalAvailableCredit > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-xs text-purple-900 flex items-center space-x-2">
                    <Coins className="h-4 w-4 text-purple-600 shrink-0" />
                    <div>
                      <span className="font-bold">Crédito a Favor: </span>
                      <span>{company.currencySymbol} {totalAvailableCredit.toLocaleString('es-UY')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4 Financial KPIs for this client */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Facturado Histórico</span>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {company.currencySymbol} {selectedClient.totalInvoiced.toLocaleString('es-UY')}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Cobrado / Pagado</span>
                <div className="text-lg font-bold text-emerald-600 mt-1">
                  {company.currencySymbol} {selectedClient.totalPaid.toLocaleString('es-UY')}
                </div>
              </div>

              <div className="bg-blue-50/60 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200/60 dark:border-blue-800">
                <span className="text-[11px] font-semibold text-blue-700 uppercase">Saldo Deudor Pendiente</span>
                <div className="text-xl font-extrabold text-blue-900 mt-1">
                  {company.currencySymbol} {selectedClientDebt.toLocaleString('es-UY')}
                </div>
              </div>

              <div className="bg-purple-50/60 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200/60 dark:border-purple-800">
                <span className="text-[11px] font-semibold text-purple-700 uppercase">Saldo a Favor Activo</span>
                <div className="text-xl font-extrabold text-purple-900 mt-1">
                  {company.currencySymbol} {totalAvailableCredit.toLocaleString('es-UY')}
                </div>
              </div>
            </div>

            {/* Aging Report Breakdown for this client */}
            {selectedClientDebt > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  Antigüedad de Deuda (Aging Report)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-2xs text-slate-400 dark:text-slate-500 block font-semibold">Al Día (Sin Vencer)</span>
                    <span className="font-bold text-emerald-700 text-sm">{company.currencySymbol}{aging.al_dia.toLocaleString()}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-2xs text-slate-400 dark:text-slate-500 block font-semibold">1 a 30 Días</span>
                    <span className="font-bold text-amber-600 text-sm">{company.currencySymbol}{aging.dias_1_30.toLocaleString()}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-2xs text-slate-400 dark:text-slate-500 block font-semibold">31 a 60 Días</span>
                    <span className="font-bold text-orange-600 text-sm">{company.currencySymbol}{aging.dias_31_60.toLocaleString()}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-2xs text-slate-400 dark:text-slate-500 block font-semibold">61 a 90 Días</span>
                    <span className="font-bold text-red-600 text-sm">{company.currencySymbol}{aging.dias_61_90.toLocaleString()}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-2xs text-slate-400 dark:text-slate-500 block font-semibold">&gt; 90 Días Vencido</span>
                    <span className="font-bold text-red-800 text-sm">{company.currencySymbol}{aging.mas_90_dias.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sub-tabs: Cuenta Corriente (Ledger) vs Facturas Pendientes vs Correos */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
              <button
                onClick={() => setActiveTab('ledger')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                  activeTab === 'ledger'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Libro Mayor de Cuenta Corriente ({ledger.length})
              </button>

              <button
                onClick={() => setActiveTab('pending_invoices')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                  activeTab === 'pending_invoices'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Facturas Pendientes ({pendingInvoices.length})
              </button>

              <button
                onClick={() => setActiveTab('paid_invoices')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                  activeTab === 'paid_invoices'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Facturas Canceladas ({paidInvoices.length})
              </button>

              <button
                onClick={() => setActiveTab('email_logs')}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                  activeTab === 'email_logs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Historial de Correos ({clientEmailLogs.length})
              </button>
            </div>

            {/* TAB 1: LEDGER */}
            {activeTab === 'ledger' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Concepto / Detalle</th>
                        <th className="px-4 py-3">Documento</th>
                        <th className="px-4 py-3 text-right text-slate-900 dark:text-white">Débito (+)</th>
                        <th className="px-4 py-3 text-right text-emerald-700">Crédito (-)</th>
                        <th className="px-4 py-3 text-right text-blue-800">Saldo Acumulado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {ledger.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                            No hay movimientos registrados para este cliente.
                          </td>
                        </tr>
                      ) : (
                        ledger.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">{row.fecha}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{row.concepto}</td>
                            <td className="px-4 py-3 font-mono font-bold text-blue-700">{row.documento}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                              {row.debito > 0 ? `${company.currencySymbol} ${row.debito.toLocaleString('es-UY')}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">
                              {row.credito > 0 ? `${company.currencySymbol} ${row.credito.toLocaleString('es-UY')}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-blue-900 bg-blue-50/30">
                              {company.currencySymbol} {row.saldoAcumulado.toLocaleString('es-UY')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: PENDING INVOICES */}
            {activeTab === 'pending_invoices' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3">Factura N°</th>
                        <th className="px-4 py-3">Fecha Emisión</th>
                        <th className="px-4 py-3">Vencimiento</th>
                        <th className="px-4 py-3">Moneda</th>
                        <th className="px-4 py-3 text-right">Importe Original</th>
                        <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                        <th className="px-4 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {pendingInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                            ¡Sin facturas pendientes! El cliente está al día.
                          </td>
                        </tr>
                      ) : (
                        pendingInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-4 py-3 font-mono font-bold text-blue-700">{inv.numero}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{inv.fecha}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{inv.vencimiento}</td>
                            <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{inv.moneda || 'UYU'}</td>
                            <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                              {inv.moneda === 'USD' ? 'US$' : '$'} {inv.importe.toLocaleString('es-UY')}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-blue-900">
                              {inv.moneda === 'USD' ? 'US$' : '$'} {inv.saldo_pendiente.toLocaleString('es-UY')}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {totalAvailableCredit > 0 && clientAvailableCredits[0] ? (
                                <button
                                  onClick={() => handleApplyCredit(clientAvailableCredits[0].id, inv.id, Math.min(totalAvailableCredit, inv.saldo_pendiente))}
                                  className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold rounded-lg text-[11px] transition-colors"
                                >
                                  Aplicar Crédito
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">Esperando pago</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: PAID INVOICES */}
            {activeTab === 'paid_invoices' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3">Factura N°</th>
                        <th className="px-4 py-3">Fecha Emisión</th>
                        <th className="px-4 py-3">Moneda</th>
                        <th className="px-4 py-3 text-right">Importe Total</th>
                        <th className="px-4 py-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {paidInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                            Aún no hay facturas totalmente canceladas en este período.
                          </td>
                        </tr>
                      ) : (
                        paidInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-4 py-3 font-mono font-bold text-blue-700">{inv.numero}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{inv.fecha}</td>
                            <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{inv.moneda || 'UYU'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                              {inv.moneda === 'USD' ? 'US$' : '$'} {inv.importe.toLocaleString('es-UY')}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Totalmente Pagada
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: EMAIL LOGS */}
            {activeTab === 'email_logs' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Historial de Notificaciones por Email</h4>
                  <button
                    onClick={handleOpenEmailModal}
                    className="inline-flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 hover:bg-blue-100 font-semibold rounded-lg text-xs transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    Enviar Nuevo Email
                  </button>
                </div>

                {clientEmailLogs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                    No se han enviado recordatorios por correo a este cliente aún.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clientEmailLogs.map(log => (
                      <div key={log.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-white">{log.asunto}</span>
                          <span className="text-slate-400 dark:text-slate-500 text-2xs">{new Date(log.fecha_envio).toLocaleString('es-UY')}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400">
                          Destinatario: <strong className="text-slate-800 dark:text-slate-200">{log.destinatario_email}</strong> • Saldo informado: <strong className="text-blue-700">${log.saldo_reclamado.toLocaleString()}</strong>
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-2xs">
                          Facturas incluidas: {log.facturas_incluidas.join(', ') || 'Todas'} • Enviado por: {log.enviado_por}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Bottom Client Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase whitespace-nowrap">Ir a Cliente:</span>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{getClientDebt(c.id) > 0 ? ` — Debe ${company.currencySymbol}${getClientDebt(c.id).toLocaleString('es-UY')}` : ' — al día'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {clients.map((c) => {
            const isSelected = c.id === selectedClientId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                className={`
                  px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border
                  ${isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }
                `}
              >
                {c.name}
                {getClientDebt(c.id) > 0 && (
                  <span className={`ml-1 px-1 py-0.5 rounded text-[9px] ${isSelected ? 'bg-blue-800 text-blue-100' : 'bg-red-100 text-red-700'}`}>
                    ${getClientDebt(c.id).toLocaleString('es-UY')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mail className="h-5 w-5" />
                <h3 className="text-base font-bold">Enviar Notificación de Estado de Cuenta</h3>
              </div>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="text-blue-100 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Destinatario (Email):</label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Asunto:</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Cuerpo del Correo (Editable):</label>
                <textarea
                  rows={12}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full p-3 font-mono text-xs border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-800 text-2xs flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <p>
                  El sistema generará el correo y guardará constancia en el historial de auditoría de cuentas por cobrar. Puedes copiar el texto o disparar el envío automático.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <button
                onClick={handleCopyEmail}
                className="inline-flex items-center px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Copy className="h-4 w-4 mr-1.5 text-slate-500 dark:text-slate-400" />
                {emailCopied ? '¡Copiado!' : 'Copiar Texto'}
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 font-semibold hover:text-slate-800 dark:hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendEmail}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Enviar y Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
