import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AccountingEntry,
  AuditLog,
  BankMovement,
  Client,
  ClientCredit,
  Company,
  EmailReminderLog,
  Invoice,
  LearnedAlias,
  OfficialReceipt,
  PaymentApplication
} from '../types';
import {
  initialBankMovements,
  initialClients,
  initialCompany,
  initialInvoices,
  initialLearnedAliases
} from '../data/mockData';
import { matchBankMovement, runFIFOAllocation } from '../utils/matchingEngine';

interface ConciliaContextType {
  company: Company;
  setCompany: React.Dispatch<React.SetStateAction<Company>>;
  clients: Client[];
  invoices: Invoice[];
  bankMovements: BankMovement[];
  learnedAliases: LearnedAlias[];
  paymentApplications: PaymentApplication[];
  clientCredits: ClientCredit[];
  auditLogs: AuditLog[];
  officialReceipts: OfficialReceipt[];
  accountingEntries: AccountingEntry[];
  emailReminderLogs: EmailReminderLog[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  
  // Actions
  runMatchingEngine: () => void;
  confirmMatch: (movementId: string, customAliasText?: string, withholdingAmount?: number, bankFeeAmount?: number) => void;
  confirmAllAutoMatches: () => number;
  manualMatch: (
    movementId: string,
    clientId: string,
    allocations: Array<{ factura_id: string; monto: number }>,
    excessToCredit: number,
    newAliasText?: string,
    withholdingAmount?: number,
    bankFeeAmount?: number
  ) => void;
  discardMovement: (movementId: string) => void;
  revertReconciliation: (auditLogId: string) => void;
  
  // AI Assistant (Gemini)
  analyzeMovementWithAI: (movementId: string) => Promise<any>;
  
  // Credit handling
  applyCreditToInvoice: (creditId: string, invoiceId: string, amountToApply: number) => void;
  
  // Learned Aliases
  addLearnedAlias: (text: string, clientId: string) => void;
  deleteLearnedAlias: (id: string) => void;
  
  // File Ingest
  importInvoices: (newInvoices: Invoice[]) => void;
  importBankMovements: (newMovements: BankMovement[]) => void;
  
  // Client Management
  addClient: (client: Omit<Client, 'id' | 'totalInvoiced' | 'totalPaid' | 'currentBalance' | 'creditBalance'>) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  
  // Email reminders
  logEmailReminder: (clientId: string, clientName: string, recipientEmail: string, subject: string, balance: number, invoiceNumbers: string[]) => void;
  
  // Multi-currency exchange rate
  setUsdExchangeRate: (rate: number) => void;
  
  // Reset & Helpers
  resetToDemo: () => void;
  clearAllData: () => void;
}

const ConciliaContext = createContext<ConciliaContextType | null>(null);

const STORAGE_KEY = 'conciliaya_state_v3';

export const ConciliaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Load state or use initial mock
  const [company, setCompany] = useState<Company>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_company');
    return saved ? JSON.parse(saved) : initialCompany;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_clients');
    return saved ? JSON.parse(saved) : initialClients;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_invoices');
    return saved ? JSON.parse(saved) : initialInvoices;
  });

  const [bankMovements, setBankMovements] = useState<BankMovement[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_movements');
    return saved ? JSON.parse(saved) : initialBankMovements;
  });

  const [learnedAliases, setLearnedAliases] = useState<LearnedAlias[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_aliases');
    return saved ? JSON.parse(saved) : initialLearnedAliases;
  });

  const [paymentApplications, setPaymentApplications] = useState<PaymentApplication[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_payments');
    return saved ? JSON.parse(saved) : [];
  });

  const [clientCredits, setClientCredits] = useState<ClientCredit[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_credits');
    return saved ? JSON.parse(saved) : [];
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_audit');
    return saved ? JSON.parse(saved) : [];
  });

  const [officialReceipts, setOfficialReceipts] = useState<OfficialReceipt[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_receipts');
    return saved ? JSON.parse(saved) : [];
  });

  const [accountingEntries, setAccountingEntries] = useState<AccountingEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_accounting');
    return saved ? JSON.parse(saved) : [];
  });

  const [emailReminderLogs, setEmailReminderLogs] = useState<EmailReminderLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_email_logs');
    return saved ? JSON.parse(saved) : [];
  });

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_company', JSON.stringify(company));
    localStorage.setItem(STORAGE_KEY + '_clients', JSON.stringify(clients));
    localStorage.setItem(STORAGE_KEY + '_invoices', JSON.stringify(invoices));
    localStorage.setItem(STORAGE_KEY + '_movements', JSON.stringify(bankMovements));
    localStorage.setItem(STORAGE_KEY + '_aliases', JSON.stringify(learnedAliases));
    localStorage.setItem(STORAGE_KEY + '_payments', JSON.stringify(paymentApplications));
    localStorage.setItem(STORAGE_KEY + '_credits', JSON.stringify(clientCredits));
    localStorage.setItem(STORAGE_KEY + '_audit', JSON.stringify(auditLogs));
    localStorage.setItem(STORAGE_KEY + '_receipts', JSON.stringify(officialReceipts));
    localStorage.setItem(STORAGE_KEY + '_accounting', JSON.stringify(accountingEntries));
    localStorage.setItem(STORAGE_KEY + '_email_logs', JSON.stringify(emailReminderLogs));
  }, [company, clients, invoices, bankMovements, learnedAliases, paymentApplications, clientCredits, auditLogs, officialReceipts, accountingEntries, emailReminderLogs]);

  // Recalculate suggestions when movements or invoices change
  const runMatchingEngine = (overrideInvoices?: Invoice[], overrideClients?: Client[], overrideAliases?: LearnedAlias[]) => {
    const inv = overrideInvoices || invoices;
    const cli = overrideClients || clients;
    const aliases = overrideAliases || learnedAliases;

    // Use FIFO allocation: group movements by client, allocate chronologically
    const fifoResults = runFIFOAllocation(
      bankMovements,
      inv,
      cli,
      aliases,
      company.autoMatchThreshold,
      company.usdExchangeRate
    );

    setBankMovements(prevMovements => {
      return prevMovements.map(mov => {
        if (mov.estado_conciliacion === 'conciliado_manual') {
          return mov;
        }

        const suggestion = fifoResults.get(mov.id);

        if (!suggestion) {
          // Fall back to per-movement matching for unmatched FIFO results
          const fallbackSuggestion = matchBankMovement(
            mov,
            inv,
            cli,
            aliases,
            company.autoMatchThreshold,
            company.usdExchangeRate
          );

          if (!fallbackSuggestion) {
            return {
              ...mov,
              estado_conciliacion: 'sin_identificar',
              confianza: 0,
              motivo_sugerencia: 'Sin referencia reconocible en extracto bancario. Requiere revisión manual o análisis con IA.',
              sugerencia: undefined,
              cliente_sugerido_id: undefined,
              cliente_sugerido_name: undefined
            };
          }

          const isAuto = fallbackSuggestion.confianza >= (company.autoMatchThreshold * 100);
          return {
            ...mov,
            estado_conciliacion: isAuto ? 'auto' : 'sugerido',
            confianza: fallbackSuggestion.confianza,
            motivo_sugerencia: fallbackSuggestion.motivo,
            cliente_sugerido_id: fallbackSuggestion.cliente_id,
            cliente_sugerido_name: fallbackSuggestion.cliente_nombre,
            sugerencia: fallbackSuggestion
          };
        }

        const isAuto = suggestion.confianza >= (company.autoMatchThreshold * 100);
        return {
          ...mov,
          estado_conciliacion: isAuto ? 'auto' : 'sugerido',
          confianza: suggestion.confianza,
          motivo_sugerencia: suggestion.motivo,
          cliente_sugerido_id: suggestion.cliente_id,
          cliente_sugerido_name: suggestion.cliente_nombre,
          sugerencia: suggestion
        };
      });
    });
  };

  // Helper to record an alias learned
  const recordAlias = (aliasText: string, clientId: string, clientName: string) => {
    if (!aliasText || aliasText.trim().length < 3) return;
    const cleanText = aliasText.trim().toUpperCase();

    setLearnedAliases(prev => {
      const existing = prev.find(a => a.texto_referencia.toUpperCase() === cleanText);
      if (existing) {
        return prev.map(a => a.id === existing.id ? {
          ...a,
          veces_confirmado: a.veces_confirmado + 1,
          ultima_vez: new Date().toISOString().split('T')[0]
        } : a);
      }
      const newAlias: LearnedAlias = {
        id: 'alias_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        texto_referencia: cleanText,
        cliente_id: clientId,
        cliente_nombre: clientName,
        veces_confirmado: 1,
        fecha_creacion: new Date().toISOString().split('T')[0],
        ultima_vez: new Date().toISOString().split('T')[0]
      };
      return [newAlias, ...prev];
    });

    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        if (!c.alias_conocidos.includes(cleanText)) {
          return { ...c, alias_conocidos: [...c.alias_conocidos, cleanText] };
        }
      }
      return c;
    }));
  };

  // Create official receipt and accounting entry generator helper
  const createReceiptAndJournal = (
    mov: BankMovement,
    client: Client,
    affectedInvoices: Array<{ factura_id: string; factura_numero: string; monto_aplicado: number; saldo_restante: number }>,
    withholding: number = 0,
    bankFee: number = 0,
    excessCredit: number = 0
  ): { receipt: OfficialReceipt; entry: AccountingEntry } => {
    const receiptNumber = `REC-${new Date().getFullYear()}-${String(officialReceipts.length + 101).padStart(5, '0')}`;
    const entryNumber = `AST-${new Date().getFullYear()}-${String(accountingEntries.length + 1).padStart(5, '0')}`;

    const receipt: OfficialReceipt = {
      id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      numero_recibo: receiptNumber,
      fecha: mov.fecha || new Date().toISOString().split('T')[0],
      cliente_id: client.id,
      cliente_nombre: client.name,
      cliente_rut: client.rut_ci,
      movimiento_id: mov.id,
      banco: mov.origen_banco,
      referencia_bancaria: mov.referencia,
      monto_total_cobrado: mov.monto,
      moneda: mov.moneda || 'UYU',
      facturas_canceladas: affectedInvoices,
      retencion_fiscal: withholding,
      retencion_concepto: withholding > 0 ? 'Retención Fiscal DGI / Impuestos' : undefined,
      gasto_bancario: bankFee,
      saldo_a_favor_generado: excessCredit,
      observaciones: `Conciliación automática ${mov.descripcion_cruda}`,
      emitido_por: 'Operador Admin'
    };

    // Build balanced double-entry lines
    const lines: AccountingEntry['lineas'] = [];
    const accounts = company.accountingAccounts || {
      bankAccountCode: '1.1.1.02',
      debtorsAccountCode: '1.1.3.01',
      taxWithholdingCode: '1.1.4.01',
      bankFeeCode: '5.1.2.05',
      exchangeDiffGainCode: '4.2.1.01',
      exchangeDiffLossCode: '5.2.1.01'
    };

    // 1. Débito a Banco por el importe ingresado
    lines.push({
      cuenta_codigo: accounts.bankAccountCode,
      cuenta_nombre: `${mov.origen_banco} (${mov.moneda || 'UYU'})`,
      debito: mov.monto,
      credito: 0,
      referencia: mov.referencia || receiptNumber
    });

    // 2. Débito a Retenciones Fiscales (si aplica)
    if (withholding > 0) {
      lines.push({
        cuenta_codigo: accounts.taxWithholdingCode,
        cuenta_nombre: 'Retenciones Impositivas a Favor (DGI)',
        debito: withholding,
        credito: 0,
        referencia: 'Retención 1-3%'
      });
    }

    // 3. Débito a Comisiones y Gastos Bancarios (si aplica)
    if (bankFee > 0) {
      lines.push({
        cuenta_codigo: accounts.bankFeeCode,
        cuenta_nombre: 'Gastos y Comisiones Bancarias',
        debito: bankFee,
        credito: 0,
        referencia: 'Comisión transferencia'
      });
    }

    // 4. Crédito a Deudores por Ventas (Total aplicado a facturas)
    const totalApplied = affectedInvoices.reduce((sum, f) => sum + f.monto_aplicado, 0);
    if (totalApplied > 0) {
      lines.push({
        cuenta_codigo: accounts.debtorsAccountCode,
        cuenta_nombre: `Deudores por Ventas - ${client.name}`,
        debito: 0,
        credito: totalApplied,
        referencia: affectedInvoices.map(f => f.factura_numero).join(', ')
      });
    }

    // 5. Crédito a Anticipos / Saldo a Favor de Clientes (si hubo sobrepago)
    if (excessCredit > 0) {
      lines.push({
        cuenta_codigo: '2.1.3.01',
        cuenta_nombre: `Anticipos y Saldos a Favor - ${client.name}`,
        debito: 0,
        credito: excessCredit,
        referencia: 'Excedente a cuenta'
      });
    }

    const totalDebito = lines.reduce((sum, l) => sum + l.debito, 0);
    const totalCredito = lines.reduce((sum, l) => sum + l.credito, 0);

    const entry: AccountingEntry = {
      id: 'ast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      asiento_numero: entryNumber,
      fecha: mov.fecha || new Date().toISOString().split('T')[0],
      concepto: `Cobranza a ${client.name} s/ ${receiptNumber} (${affectedInvoices.map(f => f.factura_numero).join(', ') || 'Abono en cta'})`,
      movimiento_id: mov.id,
      recibo_id: receipt.id,
      cliente_id: client.id,
      cliente_nombre: client.name,
      moneda: mov.moneda || 'UYU',
      lineas: lines,
      total_debito: totalDebito,
      total_credito: totalCredito,
      creado_por: 'ConciliaYA Engine'
    };

    return { receipt, entry };
  };

  // Confirm a Suggested Match
  const confirmMatch = (
    movementId: string,
    customAliasText?: string,
    withholdingAmount?: number,
    bankFeeAmount?: number
  ) => {
    const mov = bankMovements.find(m => m.id === movementId);
    if (!mov || !mov.sugerencia) return;

    const { sugerencia } = mov;
    const client = clients.find(c => c.id === sugerencia.cliente_id) || {
      id: sugerencia.cliente_id,
      name: sugerencia.cliente_nombre,
      rut_ci: '',
      alias_conocidos: [],
      totalInvoiced: 0,
      totalPaid: 0,
      currentBalance: 0,
      creditBalance: 0
    } as Client;

    const withholding = withholdingAmount !== undefined ? withholdingAmount : (sugerencia.retencion_estimada || 0);
    const bankFee = bankFeeAmount !== undefined ? bankFeeAmount : (sugerencia.gasto_bancario_estimado || 0);

    const newPaymentApps: PaymentApplication[] = [];
    const affectedInvoicesDetails: Array<{ factura_id: string; numero: string; monto_aplicado: number }> = [];
    const receiptInvoicesList: Array<{ factura_id: string; factura_numero: string; monto_aplicado: number; saldo_restante: number }> = [];

    // Apply payments to proposed invoices
    setInvoices(prevInvoices => {
      const updated = [...prevInvoices];
      for (const item of sugerencia.facturas) {
        const invIndex = updated.findIndex(i => i.id === item.factura_id);
        if (invIndex !== -1) {
          const currentInv = updated[invIndex];
          // If there was retention closing the remainder, mark as paid
          const applyAmount = withholding > 0 && Math.abs(currentInv.saldo_pendiente - (item.monto_a_aplicar + withholding)) < 1
            ? currentInv.saldo_pendiente
            : item.monto_a_aplicar;

          const newSaldo = Math.max(0, currentInv.saldo_pendiente - applyAmount);
          const newEstado = newSaldo <= 0.01 ? 'pagada' : 'parcial';

          updated[invIndex] = {
            ...currentInv,
            saldo_pendiente: newSaldo,
            estado: newEstado
          };

          const paymentApp: PaymentApplication = {
            id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            movimiento_id: mov.id,
            factura_id: currentInv.id,
            factura_numero: currentInv.numero,
            cliente_id: sugerencia.cliente_id,
            cliente_nombre: client.name,
            monto_aplicado: item.monto_a_aplicar,
            moneda: currentInv.moneda || 'UYU',
            fecha: new Date().toISOString().split('T')[0],
            confirmado_por: 'Operador Admin'
          };
          newPaymentApps.push(paymentApp);
          affectedInvoicesDetails.push({
            factura_id: currentInv.id,
            numero: currentInv.numero,
            monto_aplicado: item.monto_a_aplicar
          });
          receiptInvoicesList.push({
            factura_id: currentInv.id,
            factura_numero: currentInv.numero,
            monto_aplicado: item.monto_a_aplicar,
            saldo_restante: newSaldo
          });
        }
      }
      return updated;
    });

    // Handle excess credit if present
    const excess = sugerencia.saldo_a_favor_estimado || 0;
    if (excess > 0) {
      const newCredit: ClientCredit = {
        id: 'cred_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        cliente_id: sugerencia.cliente_id,
        cliente_nombre: client.name,
        monto_original: excess,
        saldo_disponible: excess,
        moneda: mov.moneda || 'UYU',
        origen_movimiento_id: mov.id,
        fecha: new Date().toISOString().split('T')[0],
        estado: 'disponible',
        motivo: `Sobrante de transferencia bancaria (${mov.referencia || mov.id})`
      };
      setClientCredits(prev => [newCredit, ...prev]);
    }

    // Generate Official Receipt and Accounting Entry
    const { receipt, entry } = createReceiptAndJournal(
      mov,
      client,
      receiptInvoicesList,
      withholding,
      bankFee,
      excess
    );
    setOfficialReceipts(prev => [receipt, ...prev]);
    setAccountingEntries(prev => [entry, ...prev]);

    // Update Client Balances
    const totalApplied = sugerencia.facturas.reduce((sum, f) => sum + f.monto_a_aplicar, 0) + withholding;
    setClients(prevClients => prevClients.map(c => {
      if (c.id === sugerencia.cliente_id) {
        return {
          ...c,
          totalPaid: c.totalPaid + totalApplied,
          currentBalance: Math.max(0, c.currentBalance - totalApplied),
          creditBalance: c.creditBalance + excess
        };
      }
      return c;
    }));

    // Update movement status
    setBankMovements(prev => prev.map(m => {
      if (m.id === movementId) {
        return {
          ...m,
          estado_conciliacion: 'conciliado_manual',
          fecha_conciliacion: new Date().toISOString(),
          conciliado_por: 'Operador Admin',
          aplicaciones: newPaymentApps,
          saldo_a_favor_generado: excess > 0 ? excess : undefined,
          retencion_monto: withholding > 0 ? withholding : undefined,
          gasto_bancario_monto: bankFee > 0 ? bankFee : undefined,
          recibo_id: receipt.id,
          asiento_id: entry.id
        };
      }
      return m;
    }));

    setPaymentApplications(prev => [...prev, ...newPaymentApps]);

    // Record learned alias
    const aliasToLearn = customAliasText || mov.descripcion_cruda;
    recordAlias(aliasToLearn, sugerencia.cliente_id, client.name);

    // Audit log
    const audit: AuditLog = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      fecha: new Date().toISOString(),
      usuario: 'Operador Admin',
      accion: 'confirm_suggested',
      entidad: 'movimiento',
      entidad_id: mov.id,
      descripcion: `Conciliado pago de $${mov.monto.toLocaleString()} ${mov.moneda || 'UYU'} para ${client.name} (Emitido ${receipt.numero_recibo})`,
      detalles: {
        movimiento_id: mov.id,
        cliente_id: sugerencia.cliente_id,
        cliente_nombre: client.name,
        monto: mov.monto,
        facturas_afectadas: affectedInvoicesDetails,
        saldo_a_favor: excess > 0 ? excess : undefined,
        retencion: withholding > 0 ? withholding : undefined,
        gasto_bancario: bankFee > 0 ? bankFee : undefined,
        nuevo_alias: aliasToLearn,
        recibo_id: receipt.id,
        asiento_id: entry.id
      },
      revertible: true,
      reverted: false
    };
    setAuditLogs(prev => [audit, ...prev]);
  };

  // Bulk confirm all Automatic matches
  const confirmAllAutoMatches = (): number => {
    const autos = bankMovements.filter(m => m.estado_conciliacion === 'auto' && m.sugerencia);
    if (autos.length === 0) return 0;

    autos.forEach(m => {
      confirmMatch(m.id);
    });
    return autos.length;
  };

  // Manual Matching / Custom Split Modal
  const manualMatch = (
    movementId: string,
    clientId: string,
    allocations: Array<{ factura_id: string; monto: number }>,
    excessToCredit: number,
    newAliasText?: string,
    withholdingAmount?: number,
    bankFeeAmount?: number
  ) => {
    const mov = bankMovements.find(m => m.id === movementId);
    const client = clients.find(c => c.id === clientId);
    if (!mov || !client) return;

    const withholding = withholdingAmount || 0;
    const bankFee = bankFeeAmount || 0;

    const newPaymentApps: PaymentApplication[] = [];
    const affectedInvoicesDetails: Array<{ factura_id: string; numero: string; monto_aplicado: number }> = [];
    const receiptInvoicesList: Array<{ factura_id: string; factura_numero: string; monto_aplicado: number; saldo_restante: number }> = [];

    // Apply to selected invoices
    setInvoices(prevInvoices => {
      const updated = [...prevInvoices];
      for (const item of allocations) {
        if (item.monto <= 0) continue;
        const invIndex = updated.findIndex(i => i.id === item.factura_id);
        if (invIndex !== -1) {
          const currentInv = updated[invIndex];
          const applyAmount = item.monto;
          const newSaldo = Math.max(0, currentInv.saldo_pendiente - applyAmount);
          const newEstado = newSaldo <= 0.01 ? 'pagada' : 'parcial';

          updated[invIndex] = {
            ...currentInv,
            saldo_pendiente: newSaldo,
            estado: newEstado
          };

          const paymentApp: PaymentApplication = {
            id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            movimiento_id: mov.id,
            factura_id: currentInv.id,
            factura_numero: currentInv.numero,
            cliente_id: client.id,
            cliente_nombre: client.name,
            monto_aplicado: item.monto,
            moneda: currentInv.moneda || 'UYU',
            fecha: new Date().toISOString().split('T')[0],
            confirmado_por: 'Operador Admin'
          };
          newPaymentApps.push(paymentApp);
          affectedInvoicesDetails.push({
            factura_id: currentInv.id,
            numero: currentInv.numero,
            monto_aplicado: item.monto
          });
          receiptInvoicesList.push({
            factura_id: currentInv.id,
            factura_numero: currentInv.numero,
            monto_aplicado: item.monto,
            saldo_restante: newSaldo
          });
        }
      }
      return updated;
    });

    // Handle excess credit
    if (excessToCredit > 0) {
      const newCredit: ClientCredit = {
        id: 'cred_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        cliente_id: client.id,
        cliente_nombre: client.name,
        monto_original: excessToCredit,
        saldo_disponible: excessToCredit,
        moneda: mov.moneda || 'UYU',
        origen_movimiento_id: mov.id,
        fecha: new Date().toISOString().split('T')[0],
        estado: 'disponible',
        motivo: `Excedente asignado manualmente (${mov.referencia || mov.id})`
      };
      setClientCredits(prev => [newCredit, ...prev]);
    }

    // Generate Official Receipt and Accounting Entry
    const { receipt, entry } = createReceiptAndJournal(
      mov,
      client,
      receiptInvoicesList,
      withholding,
      bankFee,
      excessToCredit
    );
    setOfficialReceipts(prev => [receipt, ...prev]);
    setAccountingEntries(prev => [entry, ...prev]);

    // Update Client Balances
    const totalApplied = allocations.reduce((sum, f) => sum + f.monto, 0) + withholding;
    setClients(prevClients => prevClients.map(c => {
      if (c.id === client.id) {
        return {
          ...c,
          totalPaid: c.totalPaid + totalApplied,
          currentBalance: Math.max(0, c.currentBalance - totalApplied),
          creditBalance: c.creditBalance + excessToCredit
        };
      }
      return c;
    }));

    // Update movement status
    setBankMovements(prev => prev.map(m => {
      if (m.id === movementId) {
        return {
          ...m,
          estado_conciliacion: 'conciliado_manual',
          cliente_sugerido_id: client.id,
          cliente_sugerido_name: client.name,
          confianza: 100,
          motivo_sugerencia: `Conciliado manualmente para ${client.name}`,
          fecha_conciliacion: new Date().toISOString(),
          conciliado_por: 'Operador Admin',
          aplicaciones: newPaymentApps,
          saldo_a_favor_generado: excessToCredit > 0 ? excessToCredit : undefined,
          retencion_monto: withholding > 0 ? withholding : undefined,
          gasto_bancario_monto: bankFee > 0 ? bankFee : undefined,
          recibo_id: receipt.id,
          asiento_id: entry.id
        };
      }
      return m;
    }));

    setPaymentApplications(prev => [...prev, ...newPaymentApps]);

    // Save alias if provided
    if (newAliasText && newAliasText.trim().length >= 3) {
      recordAlias(newAliasText, client.id, client.name);
    }

    // Audit log
    const audit: AuditLog = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      fecha: new Date().toISOString(),
      usuario: 'Operador Admin',
      accion: 'manual_match',
      entidad: 'movimiento',
      entidad_id: mov.id,
      descripcion: `Asignación manual de pago $${mov.monto.toLocaleString()} ${mov.moneda || 'UYU'} a ${client.name} (Recibo ${receipt.numero_recibo})`,
      detalles: {
        movimiento_id: mov.id,
        cliente_id: client.id,
        cliente_nombre: client.name,
        monto: mov.monto,
        facturas_afectadas: affectedInvoicesDetails,
        saldo_a_favor: excessToCredit > 0 ? excessToCredit : undefined,
        retencion: withholding > 0 ? withholding : undefined,
        gasto_bancario: bankFee > 0 ? bankFee : undefined,
        nuevo_alias: newAliasText,
        recibo_id: receipt.id,
        asiento_id: entry.id
      },
      revertible: true,
      reverted: false
    };
    setAuditLogs(prev => [audit, ...prev]);
  };

  // AI Assistant (Gemini)
  const analyzeMovementWithAI = async (movementId: string) => {
    const mov = bankMovements.find(m => m.id === movementId);
    if (!mov) return null;

    try {
      const response = await fetch('/api/analyze-cryptic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movement: mov,
          clients,
          invoices
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json();

      // Update movement with AI analysis
      setBankMovements(prev => prev.map(m => {
        if (m.id === movementId) {
          const matchedClient = clients.find(c => c.id === result.matchedClientId);
          const suggestedInvoicesList = (result.suggestedInvoices || [])
            .map((invId: string) => invoices.find(i => i.id === invId))
            .filter(Boolean)
            .map((inv: any) => ({
              factura_id: inv.id,
              factura_numero: inv.numero,
              importe: inv.importe,
              saldo_pendiente: inv.saldo_pendiente,
              monto_a_aplicar: Math.min(inv.saldo_pendiente, m.monto),
              moneda: inv.moneda
            }));

          const updatedSuggestion = matchedClient ? {
            cliente_id: matchedClient.id,
            cliente_nombre: matchedClient.name,
            confianza: result.confidence || 85,
            motivo: `✨ Asistente IA Gemini: ${result.explanation}`,
            tipo: 'similitud_cliente' as const,
            facturas: suggestedInvoicesList,
            retencion_estimada: result.suggestedWithholding || 0,
            gasto_bancario_estimado: result.suggestedBankFee || 0
          } : undefined;

          return {
            ...m,
            estado_conciliacion: matchedClient ? 'sugerido' : m.estado_conciliacion,
            confianza: result.confidence || m.confianza,
            motivo_sugerencia: result.explanation,
            cliente_sugerido_id: matchedClient?.id,
            cliente_sugerido_name: matchedClient?.name,
            sugerencia: updatedSuggestion || m.sugerencia,
            aiAnalysis: result
          };
        }
        return m;
      }));

      return result;
    } catch (err: any) {
      console.error('Error al analizar con IA:', err);
      // Fallback update
      return null;
    }
  };

  // Discard movement
  const discardMovement = (movementId: string) => {
    const mov = bankMovements.find(m => m.id === movementId);
    if (!mov) return;

    setBankMovements(prev => prev.map(m => m.id === movementId ? { ...m, estado_conciliacion: 'descartado' } : m));

    const audit: AuditLog = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      fecha: new Date().toISOString(),
      usuario: 'Operador Admin',
      accion: 'discard',
      entidad: 'movimiento',
      entidad_id: movementId,
      descripcion: `Movimiento bancario $${mov.monto.toLocaleString()} marcado como no aplicable/descartado`,
      detalles: {
        movimiento_id: movementId,
        monto: mov.monto
      },
      revertible: true,
      reverted: false
    };
    setAuditLogs(prev => [audit, ...prev]);
  };

  // Revert a reconciliation safely
  const revertReconciliation = (auditLogId: string) => {
    const log = auditLogs.find(a => a.id === auditLogId);
    if (!log || !log.revertible || log.reverted) return;

    // Handle discard reversion
    if (log.accion === 'discard') {
      const movId = log.entidad_id || log.detalles?.movimiento_id;
      if (movId) {
        setBankMovements(prev => prev.map(m => m.id === movId ? { ...m, estado_conciliacion: 'sugerido' } : m));
      }
      setAuditLogs(prev => prev.map(a => a.id === auditLogId ? { ...a, reverted: true } : a));
      setTimeout(() => runMatchingEngine(), 50);
      return;
    }

    const { movimiento_id, cliente_id, facturas_afectadas, saldo_a_favor, recibo_id, asiento_id } = log.detalles || {};
    const targetMovId = movimiento_id || log.entidad_id;

    // 1. Restore invoices balances
    if (facturas_afectadas && facturas_afectadas.length > 0) {
      setInvoices(prevInvoices => {
        return prevInvoices.map(inv => {
          const affected = facturas_afectadas.find(f => f.factura_id === inv.id || f.numero === inv.numero);
          if (affected) {
            const restoredSaldo = Math.min(inv.importe, inv.saldo_pendiente + affected.monto_aplicado);
            return {
              ...inv,
              saldo_pendiente: restoredSaldo,
              estado: Math.abs(restoredSaldo - inv.importe) < 0.01 ? 'pendiente' : (restoredSaldo <= 0.01 ? 'pagada' : 'parcial')
            };
          }
          return inv;
        });
      });
    }

    // 2. Remove credits generated by this movement
    if (targetMovId) {
      setClientCredits(prev => prev.filter(c => c.origen_movimiento_id !== targetMovId));
    }

    // 3. Remove receipts and accounting entries generated
    if (recibo_id) {
      setOfficialReceipts(prev => prev.filter(r => r.id !== recibo_id));
    } else if (targetMovId) {
      setOfficialReceipts(prev => prev.filter(r => r.movimiento_id !== targetMovId));
    }

    if (asiento_id) {
      setAccountingEntries(prev => prev.filter(e => e.id !== asiento_id));
    } else if (targetMovId) {
      setAccountingEntries(prev => prev.filter(e => e.id !== asiento_id && e.movimiento_id !== targetMovId));
    }

    // 4. Restore Client Balances
    if (cliente_id) {
      const totalReversed = facturas_afectadas?.reduce((sum, f) => sum + f.monto_aplicado, 0) || 0;
      setClients(prev => prev.map(c => {
        if (c.id === cliente_id) {
          return {
            ...c,
            totalPaid: Math.max(0, c.totalPaid - totalReversed),
            currentBalance: c.currentBalance + totalReversed,
            creditBalance: Math.max(0, c.creditBalance - (saldo_a_favor || 0))
          };
        }
        return c;
      }));
    }

    // 5. Reset movement status
    if (targetMovId) {
      setBankMovements(prev => prev.map(m => {
        if (m.id === targetMovId) {
          return {
            ...m,
            estado_conciliacion: 'sugerido',
            fecha_conciliacion: undefined,
            conciliado_por: undefined,
            aplicaciones: undefined,
            saldo_a_favor_generado: undefined,
            retencion_monto: undefined,
            gasto_bancario_monto: undefined,
            recibo_id: undefined,
            asiento_id: undefined
          };
        }
        return m;
      }));
      setPaymentApplications(prev => prev.filter(p => p.movimiento_id !== targetMovId));
    }

    // 6. Mark original audit log as reverted and log reversal event
    setAuditLogs(prev => {
      const updated = prev.map(a => a.id === auditLogId ? { ...a, reverted: true } : a);
      const revEntry: AuditLog = {
        id: 'aud_rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        fecha: new Date().toISOString(),
        usuario: 'Operador Admin',
        accion: 'reversion',
        entidad: 'auditoria',
        entidad_id: auditLogId,
        descripcion: `Reversión contable: Se anularon los efectos de "${log.descripcion}" y se restauraron los saldos de facturas.`,
        revertible: false,
        reverted: false
      };
      return [revEntry, ...updated];
    });

    // Refresh matching suggestions with restored invoices
    setTimeout(() => {
      runMatchingEngine();
    }, 100);
  };

  // Apply existing client credit to an open invoice
  const applyCreditToInvoice = (creditId: string, invoiceId: string, amountToApply: number) => {
    const credit = clientCredits.find(c => c.id === creditId);
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!credit || !invoice || amountToApply <= 0) return;

    const actualApply = Math.min(amountToApply, credit.saldo_disponible, invoice.saldo_pendiente);

    setInvoices(prev => prev.map(i => {
      if (i.id === invoiceId) {
        const newSaldo = Math.max(0, i.saldo_pendiente - actualApply);
        return {
          ...i,
          saldo_pendiente: newSaldo,
          estado: newSaldo <= 0.01 ? 'pagada' : 'parcial'
        };
      }
      return i;
    }));

    setClientCredits(prev => prev.map(c => {
      if (c.id === creditId) {
        const newSaldoDisp = c.saldo_disponible - actualApply;
        return {
          ...c,
          saldo_disponible: newSaldoDisp,
          estado: newSaldoDisp <= 0.01 ? 'usado' : 'parcial'
        };
      }
      return c;
    }));

    setClients(prev => prev.map(c => {
      if (c.id === credit.cliente_id) {
        return {
          ...c,
          creditBalance: Math.max(0, c.creditBalance - actualApply),
          currentBalance: Math.max(0, c.currentBalance - actualApply),
          totalPaid: c.totalPaid + actualApply
        };
      }
      return c;
    }));

    const audit: AuditLog = {
      id: 'aud_' + Date.now(),
      fecha: new Date().toISOString(),
      usuario: 'Operador Admin',
      accion: 'apply_credit',
      entidad: 'credito',
      entidad_id: creditId,
      descripcion: `Aplicado crédito de $${actualApply.toLocaleString()} a Factura ${invoice.numero} de ${credit.cliente_nombre}`,
      revertible: false
    };
    setAuditLogs(prev => [audit, ...prev]);
  };

  const addLearnedAlias = (text: string, clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    recordAlias(text, clientId, client.name);
  };

  const deleteLearnedAlias = (id: string) => {
    setLearnedAliases(prev => prev.filter(a => a.id !== id));
  };

  const importInvoices = (newInvoices: Invoice[]) => {
    // Merge duplicate invoices: same number = same invoice, sum amounts
    const merged = new Map<string, Invoice>();
    for (const inv of newInvoices) {
      const existing = merged.get(inv.numero);
      if (existing) {
        merged.set(inv.numero, {
          ...existing,
          importe: existing.importe + inv.importe,
          monto_con_iva: (existing.monto_con_iva || existing.importe) + (inv.monto_con_iva || inv.importe),
          saldo_pendiente: existing.saldo_pendiente + inv.saldo_pendiente
        });
      } else {
        merged.set(inv.numero, { ...inv });
      }
    }
    const deduplicated = Array.from(merged.values());

    const updatedInvoices = [...deduplicated, ...invoices];
    setInvoices(updatedInvoices);

    const updatedClients = [...clients];
    for (const inv of deduplicated) {
      const idx = updatedClients.findIndex(c => c.id === inv.cliente_id || c.name.toLowerCase() === inv.cliente_nombre.toLowerCase());
      const altNames = (inv.cliente_nombre_alt || []).map(n => n.toUpperCase());
      if (idx === -1) {
        updatedClients.push({
          id: inv.cliente_id,
          name: inv.cliente_nombre,
          rut_ci: inv.cliente_rut || '',
          alias_conocidos: [inv.cliente_nombre.toUpperCase(), ...altNames],
          totalInvoiced: inv.importe,
          totalPaid: 0,
          currentBalance: inv.saldo_pendiente,
          creditBalance: 0
        });
      } else {
        const existing = updatedClients[idx];
        updatedClients[idx] = {
          ...existing,
          totalInvoiced: existing.totalInvoiced + inv.importe,
          currentBalance: existing.currentBalance + inv.saldo_pendiente,
          alias_conocidos: [...new Set([...existing.alias_conocidos, inv.cliente_nombre.toUpperCase(), ...altNames])]
        };
      }
    }
    setClients(updatedClients);

    setTimeout(() => {
      runMatchingEngine(updatedInvoices, updatedClients, learnedAliases);
    }, 50);
  };

  const importBankMovements = (newMovements: BankMovement[]) => {
    setBankMovements(prev => [...newMovements, ...prev]);
    // Re-run matching with fresh data after state update
    setTimeout(() => {
      runMatchingEngine(invoices, clients, learnedAliases);
    }, 50);
  };

  // Log email reminder sent
  const logEmailReminder = (
    clientId: string,
    clientName: string,
    recipientEmail: string,
    subject: string,
    balance: number,
    invoiceNumbers: string[]
  ) => {
    const newLog: EmailReminderLog = {
      id: 'eml_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      cliente_id: clientId,
      cliente_nombre: clientName,
      destinatario_email: recipientEmail,
      asunto: subject,
      fecha_envio: new Date().toISOString(),
      saldo_reclamado: balance,
      facturas_incluidas: invoiceNumbers,
      enviado_por: 'Operador Admin'
    };

    setEmailReminderLogs(prev => [newLog, ...prev]);

    const audit: AuditLog = {
      id: 'aud_' + Date.now(),
      fecha: new Date().toISOString(),
      usuario: 'Operador Admin',
      accion: 'send_statement_email',
      entidad: 'factura',
      entidad_id: clientId,
      descripcion: `Envío de estado de cuenta por correo a ${recipientEmail} (${clientName}) por saldo de $${balance.toLocaleString()}`,
      revertible: false
    };
    setAuditLogs(prev => [audit, ...prev]);
  };

  const setUsdExchangeRate = (rate: number) => {
    setCompany(prev => ({ ...prev, usdExchangeRate: rate }));
  };

  const addClient = (clientData: Omit<Client, 'id' | 'totalInvoiced' | 'totalPaid' | 'currentBalance' | 'creditBalance'>) => {
    const newClient: Client = {
      ...clientData,
      id: 'cli_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      totalInvoiced: 0,
      totalPaid: 0,
      currentBalance: 0,
      creditBalance: 0
    };
    setClients(prev => [...prev, newClient]);

    const audit: AuditLog = {
      id: 'aud_' + Date.now(),
      fecha: new Date().toISOString(),
      usuario: 'Operador Admin',
      accion: 'create_client',
      entidad: 'cliente',
      entidad_id: newClient.id,
      descripcion: `Nuevo cliente registrado: ${newClient.name} (RUT: ${newClient.rut_ci})`,
      detalles: { cliente_id: newClient.id, cliente_nombre: newClient.name },
      revertible: false
    };
    setAuditLogs(prev => [audit, ...prev]);
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteClient = (id: string) => {
    const client = clients.find(c => c.id === id);
    if (!client) return;
    setClients(prev => prev.filter(c => c.id !== id));

    const audit: AuditLog = {
      id: 'aud_' + Date.now(),
      fecha: new Date().toISOString(),
      usuario: 'Operador Admin',
      accion: 'delete_client',
      entidad: 'cliente',
      entidad_id: id,
      descripcion: `Cliente eliminado: ${client.name}`,
      detalles: { cliente_id: id, cliente_nombre: client.name },
      revertible: false
    };
    setAuditLogs(prev => [audit, ...prev]);
  };

  const resetToDemo = () => {
    localStorage.clear();
    setCompany(initialCompany);
    setClients(initialClients);
    setInvoices(initialInvoices);
    setBankMovements(initialBankMovements);
    setLearnedAliases(initialLearnedAliases);
    setPaymentApplications([]);
    setClientCredits([]);
    setAuditLogs([]);
    setOfficialReceipts([]);
    setAccountingEntries([]);
    setEmailReminderLogs([]);
  };

  const clearAllData = () => {
    localStorage.clear();
    setInvoices([]);
    setBankMovements([]);
    setPaymentApplications([]);
    setClientCredits([]);
    setAuditLogs([]);
    setOfficialReceipts([]);
    setAccountingEntries([]);
    setEmailReminderLogs([]);
  };

  // Re-run matching engine whenever invoices, clients, or aliases change
  useEffect(() => {
    if (invoices.length > 0 && bankMovements.length > 0) {
      runMatchingEngine(invoices, clients, learnedAliases);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, clients, learnedAliases]);

  return (
    <ConciliaContext.Provider
      value={{
        company,
        setCompany,
        clients,
        invoices,
        bankMovements,
        learnedAliases,
        paymentApplications,
        clientCredits,
        auditLogs,
        officialReceipts,
        accountingEntries,
        emailReminderLogs,
        activeTab,
        setActiveTab,
        runMatchingEngine,
        confirmMatch,
        confirmAllAutoMatches,
        manualMatch,
        discardMovement,
        revertReconciliation,
        analyzeMovementWithAI,
        applyCreditToInvoice,
        addLearnedAlias,
        deleteLearnedAlias,
        importInvoices,
        importBankMovements,
        addClient,
        updateClient,
        deleteClient,
        logEmailReminder,
        setUsdExchangeRate,
        resetToDemo,
        clearAllData
      }}
    >
      {children}
    </ConciliaContext.Provider>
  );
};

export const useConcilia = () => {
  const context = useContext(ConciliaContext);
  if (!context) {
    throw new Error('useConcilia must be used within a ConciliaProvider');
  }
  return context;
};
