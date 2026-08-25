import { BankMovement, Client, Company, Invoice, LearnedAlias } from '../types';

export const initialCompany: Company = {
  id: '',
  name: '',
  rut: '',
  address: '',
  phone: '',
  email: '',
  currency: 'UYU',
  currencySymbol: '$',
  usdExchangeRate: 40.50,
  autoMatchThreshold: 0.90,
  bankAccounts: [],
  accountingAccounts: {
    bankAccountCode: '1.1.1.02',
    debtorsAccountCode: '1.1.3.01',
    taxWithholdingCode: '1.1.4.01',
    bankFeeCode: '5.1.2.05',
    exchangeDiffGainCode: '4.2.1.01',
    exchangeDiffLossCode: '5.2.1.01'
  },
  createdAt: new Date().toISOString().split('T')[0]
};

export const initialClients: Client[] = [];

export const initialLearnedAliases: LearnedAlias[] = [];

export const initialInvoices: Invoice[] = [];

export const initialBankMovements: BankMovement[] = [];

export function generateSampleInvoicesCSV(): string {
  return `Numero,Cliente,RUT_CI,Fecha,Vencimiento,Importe,Moneda,Observaciones
FAC-001,Nombre Cliente,21.000.000.0001,2026-08-01,2026-08-21,100000,UYU,Ejemplo`;
}

export function generateSampleBankCSV(): string {
  return `Fecha,Monto,Moneda,Descripcion,Referencia,Banco
2026-08-20,100000,UYU,TRANSFERENCIA RECIBIDA CLIENTE EJEMPLO,REF-001,Banco Itaú`;
}

export function generateSampleInvoicesWithErrorsCSV(): string {
  return `Numero,Cliente,RUT_CI,Fecha,Vencimiento,Importe,Moneda,Observaciones
,Cliente Sin Numero,21.000.000.0001,2026-08-01,2026-08-21,100000,UYU,Ejemplo sin numero de factura`;
}

export function generateSampleBankWithErrorsCSV(): string {
  return `Fecha,Monto,Moneda,Descripcion,Referencia,Banco
2026-08-20,NO_DISPONIBLE,UYU,DESCRIPCION VACIA,,Banco Itaú`;
}
