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
