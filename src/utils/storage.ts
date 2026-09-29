import { emptyLedger, Ledger, recalculate } from './ledger';
import { cents, invoiceTotal, validRate } from './money';

export const STORAGE_KEY='conciliaya_state_v4';
type Store=Pick<Storage,'getItem'|'setItem'>;
const collections=['clients','invoices','bankMovements','learnedAliases','paymentApplications','clientCredits','auditLogs','officialReceipts','accountingEntries','emailReminderLogs'] as const;
export function validateLedger(value:unknown):Ledger {
  if(!value||typeof value!=='object')throw new Error('Respaldo inválido.');
  const s=value as Ledger;
  if(s.version!==4 || !Number.isSafeInteger(s.revision)||s.revision<0)throw new Error('Versión de respaldo no soportada.');
  if(!s.company||!['UYU','USD'].includes(s.company.currency))throw new Error('Configuración inválida.');
  validRate(s.company.usdExchangeRate);
  if(!Number.isFinite(s.company.autoMatchThreshold)||s.company.autoMatchThreshold<.5||s.company.autoMatchThreshold>1)throw new Error('Umbral inválido.');
  for(const key of collections){
    if(!Array.isArray(s[key]))throw new Error('Falta la colección '+key+'.');
    const ids=new Set<string>();
    for(const row of s[key]){
      if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id))throw new Error('Identificadores inválidos en '+key+'.');
      ids.add(row.id);
    }
  }
  const clients=new Set(s.clients.map(c=>c.id)),invoices=new Set(s.invoices.map(i=>i.id));
  for(const i of s.invoices){
    if(!clients.has(i.cliente_id)||!['UYU','USD'].includes(i.moneda)||typeof i.numero!=='string'||!Number.isFinite(Date.parse(i.fecha))||!Number.isFinite(Date.parse(i.vencimiento)))throw new Error('Factura inválida.');
    if(cents(i.saldo_pendiente)<0||cents(i.saldo_pendiente)>cents(invoiceTotal(i)))throw new Error('Saldo inválido en '+i.numero);
  }
  for(const c of s.clients)if(typeof c.name!=='string'||!Array.isArray(c.alias_conocidos))throw new Error('Cliente inválido.');
  for(const m of s.bankMovements){
    if(!['UYU','USD'].includes(m.moneda)||!Number.isFinite(Date.parse(m.fecha))||typeof m.descripcion_cruda!=='string')throw new Error('Movimiento inválido.');
    cents(m.monto);
  }
  for(const a of s.learnedAliases)if(!clients.has(a.cliente_id)||typeof a.texto_referencia!=='string')throw new Error('Alias inválido.');
  for(const p of s.paymentApplications)if(!invoices.has(p.factura_id)||!clients.has(p.cliente_id)||cents(p.monto_aplicado)<=0)throw new Error('Aplicación de pago inválida.');
  for(const c of s.clientCredits)if(!clients.has(c.cliente_id)||cents(c.saldo_disponible)<0||cents(c.saldo_disponible)>cents(c.monto_original))throw new Error('Crédito inválido.');
  for(const e of s.accountingEntries){
    if(!Array.isArray(e.lineas)||cents(e.total_debito)!==cents(e.total_credito)||
      cents(e.lineas.reduce((n,l)=>n+l.debito,0))!==cents(e.total_debito)||cents(e.lineas.reduce((n,l)=>n+l.credito,0))!==cents(e.total_credito))throw new Error('Asiento desbalanceado.');
  }
  for(const field of ['entrySequence','receiptSequence'] as const)if(!Number.isSafeInteger(s[field])||s[field]<0)throw new Error('Numeración inválida.');
  return s;
}
function maxSequence(items:Array<{[key:string]:unknown}>,key:string) {
  return Math.max(0,...items.map(i=>Number(String(i[key]||'').split('-').at(-1))||0));
}
export function loadLedger(store:Store):Ledger {
  const saved=store.getItem(STORAGE_KEY);
  if(saved)return recalculate(validateLedger(JSON.parse(saved)));
  const s=emptyLedger();
  const legacy:Record<string,string>={company:'company',clients:'clients',invoices:'invoices',bankMovements:'movements',learnedAliases:'aliases',paymentApplications:'payments',clientCredits:'credits',auditLogs:'audit',officialReceipts:'receipts',accountingEntries:'accounting',emailReminderLogs:'email_logs'};
  for(const [key,suffix] of Object.entries(legacy)){
    const raw=store.getItem('conciliaya_state_v3_'+suffix);
    if(raw)(s as any)[key]=JSON.parse(raw);
  }
  s.entrySequence=maxSequence(s.accountingEntries as any,'asiento_numero');
  s.receiptSequence=maxSequence(s.officialReceipts as any,'numero_recibo');
  return recalculate(validateLedger(s));
}
/** One snapshot replaces the ledger only after all validation succeeds. */
export function saveLedger(store:Store,before:Ledger,after:Ledger):Ledger {
  const raw=store.getItem(STORAGE_KEY);
  if(raw && JSON.parse(raw).revision!==before.revision)throw new Error('Los datos cambiaron en otra pestaña. Recargá antes de continuar.');
  const next=validateLedger({...after,revision:before.revision+1});
  // If quota or storage permissions fail, the caller retains the previous state.
  if(raw)store.setItem(STORAGE_KEY+'_previous',raw);
  store.setItem(STORAGE_KEY,JSON.stringify(next));
  return next;
}
