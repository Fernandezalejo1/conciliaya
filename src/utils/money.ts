import type { CurrencyCode } from '../types';

export function cents(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error('Importe fuera de rango.');
  return Math.round((value + Math.sign(value) * Number.EPSILON) * 100);
}
export const roundMoney = (value: number) => cents(value) / 100;
export function validRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1e6) throw new Error('Tipo de cambio inválido.');
  return rate;
}
export function convertMoney(amount: number, from: CurrencyCode, to: CurrencyCode, rate: number): number {
  if (!['UYU', 'USD'].includes(from) || !['UYU', 'USD'].includes(to)) throw new Error('Moneda no soportada.');
  if (from === to) return roundMoney(amount);
  validRate(rate);
  return roundMoney(from === 'USD' ? amount * rate : amount / rate);
}
/** Largest representable invoice amount whose rounded bank value fits the budget. */
export function affordableAmount(budget: number, balance: number, bankCurrency: CurrencyCode, invoiceCurrency: CurrencyCode, rate: number): number {
  let low = 0, high = Math.min(cents(balance), cents(convertMoney(budget, bankCurrency, invoiceCurrency, rate)));
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (cents(convertMoney(mid / 100, invoiceCurrency, bankCurrency, rate)) <= cents(budget)) low = mid;
    else high = mid - 1;
  }
  // Do not extinguish debt whose bank equivalent rounds to zero.
  return convertMoney(low / 100, invoiceCurrency, bankCurrency, rate) > 0 ? low / 100 : 0;
}
export function invoiceTotal(invoice: { importe: number; monto_con_iva?: number }): number {
  return roundMoney(invoice.monto_con_iva ?? invoice.importe);
}
