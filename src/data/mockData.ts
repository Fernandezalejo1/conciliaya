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
  return `Año,Mes,Número Factura,Empresa Matriz (quien paga),Razón Social Cliente,Cliente / Proyecto,Tipo,Concepto,Moneda,Monto (sin IVA),Monto (con IVA),Fecha emisión,Plazo de pago (días),Vencimiento factura,Monto pagado,IVA Ventas,Fecha cobrada
2026,8,FAC-001,Constructora Delta,PILARES SA,Constructora Delta,Venta,50 chapones plásticos,USD,10000,12200,01/08/2026,30,31/08/2026,,,, 
2026,8,FAC-002,Insumos Boreal,SOLVENTA SA,Insumos Boreal,Venta,Material de oficina,USD,5000,6100,05/08/2026,30,04/09/2026,,,,
2026,8,FAC-003,Ibarra,Ibarra Martín,Ibarra,Venta,Chapones,USD,2400,2928,10/08/2026,30,09/09/2026,,,,`;
}

export function generateSampleBankCSV(): string {
  return `Mes,Concepto,N° de Factura,Crédito/Débito,Fecha,Monto (USD)
Agosto,PILARES SA VAZQUEZ LEDESMA 295,,Credit,13/08/2026,10000
Agosto,SOLVENTA SA /4096546,,Credit,15/08/2026,5000
Agosto,IBARRA SALE,,Credit,18/08/2026,2400`;
}

export function generateSampleInvoicesWithErrorsCSV(): string {
  return `Año,Mes,Número Factura,Empresa Matriz (quien paga),Razón Social Cliente,Cliente / Proyecto,Tipo,Concepto,Moneda,Monto (sin IVA),Monto (con IVA),Fecha emisión,Plazo de pago (días),Vencimiento factura,Monto pagado,IVA Ventas,Fecha cobrada
2026,8,,Cliente Sin Numero,,Prueba Venta,Sin numero de factura,USD,,PENDIENTE,01/08/2026,30,31/08/2026,,,,
2026,8,FAC-ERR,Delta Constructora,PILARES SA,Delta,Venta,Prueba,USD,1000,1220,32/13/2026,30,31/08/2026,,,,
,,,,,,,TOTALES,,,,,190601.20,,,,`;
}

export function generateSampleBankWithErrorsCSV(): string {
  return `Mes,Concepto,N° de Factura,Crédito/Débito,Fecha,Monto (USD)
Agosto,TRANSF.ENTRE CTAS.,,Credit,19/08/2026,0.01
Agosto,,Credit,20/08/2026,NO_DISPONIBLE
Agosto,TOTAL NETO,,,15321.65`;
}
