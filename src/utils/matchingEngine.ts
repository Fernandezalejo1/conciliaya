import type { BankMovement, Client, ClientCredit, Invoice, LearnedAlias, PaymentApplication, SuggestedMatch } from '../types';
import { affordableAmount, cents, convertMoney, roundMoney, validRate } from './money';

export function normalizeText(text: string): string {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function cleanBusinessName(name: string): string {
  return normalizeText(name).replace(/\b(S A S|S R L|S A|SA|SAS|SRL|LTDA)\b/g, '').replace(/\s+/g,' ').trim();
}
export function stripBankNoise(text: string): string {
  return normalizeText(text).replace(/^(?:(?:TRANSFERENCIA|RECIBIDA|TRANSF|TRF|SPI|PAGO|DEPOSITO|DEP|ABONO|DE|DEL|BANCO)\s+)+/, '').trim();
}
export function extractClientNameFromBankDesc(text: string): string {
  return stripBankNoise(text).replace(/\s+\d+$/, '').trim();
}
export function levenshteinDistance(a: string,b: string): number {
  let prev = Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=row;}
  return prev[b.length];
}
export function stringSimilarity(a: string,b: string): number {
  a=normalizeText(a);b=normalizeText(b);
  if(!a||!b)return 0;
  return 1-levenshteinDistance(a,b)/Math.max(a.length,b.length);
}
/** Bare bank codes are never interpreted as invoice numbers. */
export function extractInvoiceTokens(text: string): string[] {
  return [...String(text).toUpperCase().matchAll(/\b(?:FACTURA|FAC|INV)\s*[-:#]?\s*([A-Z]{0,3}[- ]?\d+)\b|\b([A-Z]{1,2}[-]?\d+)\b/g)]
    .map(m=>(m[1]||m[2]).replace(/[^A-Z0-9]/g,''));
}
function invoiceKey(number: string): string {
  return number.toUpperCase().replace(/^(FACTURA|FAC|INV)[\s-]*/,'').replace(/[^A-Z0-9]/g,'');
}
export function findInvoiceCombination(invoices: Invoice[], target: number): Invoice[] | null {
  const pool=invoices.filter(i=>cents(i.saldo_pendiente)>0 && cents(i.saldo_pendiente)<=cents(target)).slice(0,18);
  const targetCents=cents(target); let visits=0;
  function search(start:number,sum:number,items:Invoice[]):Invoice[]|null {
    if(sum===targetCents && items.length)return items;
    if(items.length===5 || ++visits>20000)return null;
    for(let i=start;i<pool.length;i++){
      const next=sum+cents(pool[i].saldo_pendiente);
      if(next>targetCents)continue;
      const found=search(i+1,next,[...items,pool[i]]);if(found)return found;
    }return null;
  }return search(0,0,[]);
}
function identify(m:BankMovement,clients:Client[],aliases:LearnedAlias[], invoices:Invoice[]) {
  const desc=normalizeText(m.descripcion_cruda);
  const clean=stripBankNoise(m.descripcion_cruda);
  const tokens=extractInvoiceTokens(m.descripcion_cruda+' '+(m.referencia||''));
  const referenced=invoices.filter(i=>tokens.includes(invoiceKey(i.numero)));
  const referenceClients=new Set(referenced.map(i=>i.cliente_id));
  const ranked=clients.map(c=>{
    const names=[c.name,...(c.alias_conocidos||[]),...aliases.filter(a=>a.cliente_id===c.id).map(a=>a.texto_referencia)];
    let score=0;
    for(const name of names){
      const n=normalizeText(name);if(n.length<3)continue;
      const exact=(' '+desc+' ').includes(' '+n+' ');
      score=Math.max(score,exact?0.98:Math.min(.84,stringSimilarity(clean,n)));
    }
    const rut=String(c.rut_ci||'').replace(/\D/g,'');
    if(rut.length>=7 && desc.replace(/\s/g,'').includes(rut))score=1;
    return {client:c,score};
  }).sort((a,b)=>b.score-a.score);
  // An explicit invoice reference identifies a client only if unique and not contradicted.
  if(referenceClients.size===1){
    const id=[...referenceClients][0];
    const client=clients.find(c=>c.id===id);
    if(client && !(ranked[0]?.score>=.95 && ranked[0].client.id!==id))return {client,score:1,referenced,explicit:true};
    return null;
  }
  const best=ranked[0],second=ranked[1];
  if(!best || best.score<.72 || (second && best.score-second.score<.12))return null;
  // Same invoice number in another client's series requires a matching owner.
  return {...best,referenced:referenced.filter(i=>i.cliente_id===best.client.id),explicit:referenced.some(i=>i.cliente_id===best.client.id)};
}
export function matchBankMovement(
  movement:BankMovement,invoices:Invoice[],clients:Client[],aliases:LearnedAlias[],
  autoThreshold=.9,exchangeRate=40.5,remaining?:Map<string,number>
):SuggestedMatch|null {
  if(!movement.es_credito || !Number.isFinite(movement.monto) || movement.monto<=0 ||
    ['conciliado_manual','descartado'].includes(movement.estado_conciliacion))return null;
  const rate=validRate(movement.tipo_cambio??exchangeRate);
  const open=invoices.filter(i=>i.estado!=='anulada' && i.estado!=='pagada' && (remaining?.get(i.id)??i.saldo_pendiente)>0)
    .map(i=>({...i,saldo_pendiente:remaining?.get(i.id)??i.saldo_pendiente}));
  const identity=identify(movement,clients,aliases,open);
  if(!identity)return null;
  let pool=open.filter(i=>i.cliente_id===identity.client.id).sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.numero.localeCompare(b.numero));
  if(identity.explicit)pool=pool.filter(i=>identity.referenced.some(r=>r.id===i.id));
  // Prefer the referenced invoices; otherwise exact amount / subset, then FIFO.
  if(!identity.explicit){
    const valued=pool.map(i=>({...i,saldo_pendiente:convertMoney(i.saldo_pendiente,i.moneda,movement.moneda,rate)}));
    const combination=findInvoiceCombination(valued,movement.monto);
    if(combination)pool=combination.map(i=>pool.find(p=>p.id===i.id)!);
  }
  let available=roundMoney(movement.monto);
  const facturas:SuggestedMatch['facturas']=[];
  for(const inv of pool){
    if(available<=0)break;
    const apply=affordableAmount(available,inv.saldo_pendiente,movement.moneda,inv.moneda,rate);
    if(apply<=0)continue;
    facturas.push({factura_id:inv.id,factura_numero:inv.numero,importe:inv.importe,saldo_pendiente:inv.saldo_pendiente,monto_a_aplicar:apply,moneda:inv.moneda});
    available=roundMoney(available-convertMoney(apply,inv.moneda,movement.moneda,rate));
    remaining?.set(inv.id,roundMoney(inv.saldo_pendiente-apply));
  }
  // Known payer without open debt is an advance requiring explicit operator approval.
  if(!facturas.length && identity.score<.95)return null;
  const cross=facturas.some(f=>f.moneda!==movement.moneda);
  const partial=facturas.some(f=>cents(f.monto_a_aplicar)<cents(f.saldo_pendiente));
  const confidence=!facturas.length?Math.min(85,identity.score*100):Math.round(identity.score*100);
  return {
    cliente_id:identity.client.id,cliente_nombre:identity.client.name,confianza:confidence,
    motivo:identity.explicit?'Referencia de factura y cliente compatibles.':facturas.length?'Cliente identificado; distribución por saldo disponible.':'Cliente identificado sin deuda abierta: revisar anticipo.',
    tipo:available>0?'sobrepago':cross?'bimonetario':partial?'pago_parcial':facturas.length>1?'multi_factura':'exacto_factura',
    facturas,saldo_a_favor_estimado:available||undefined
  };
}
export function runFIFOAllocation(movements:BankMovement[],invoices:Invoice[],clients:Client[],aliases:LearnedAlias[],threshold=.9,rate=40.5):Map<string,SuggestedMatch|null> {
  const remaining=new Map(invoices.map(i=>[i.id,i.saldo_pendiente]));
  const results=new Map<string,SuggestedMatch|null>();
  for(const m of [...movements].sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.id.localeCompare(b.id)))
    results.set(m.id,matchBankMovement(m,invoices,clients,aliases,threshold,rate,remaining));
  return results;
}
export function calculateAging(invoices:Invoice[],currency:'UYU'|'USD'='UYU',rate=40.5,today=new Date().toISOString().slice(0,10)){
  const result={al_dia:0,dias_1_30:0,dias_31_60:0,dias_61_90:0,mas_90_dias:0,total:0};
  for(const i of invoices.filter(i=>i.estado!=='anulada'&&i.saldo_pendiente>0)){
    const days=Math.floor((Date.parse(today)-Date.parse(i.vencimiento))/86400000);
    if(!Number.isFinite(days))throw new Error('Vencimiento inválido en '+i.numero);
    const value=convertMoney(i.saldo_pendiente,i.moneda,currency,rate);
    const key=days<=0?'al_dia':days<=30?'dias_1_30':days<=60?'dias_31_60':days<=90?'dias_61_90':'mas_90_dias';
    result[key]=roundMoney(result[key]+value);result.total=roundMoney(result.total+value);
  }return result;
}
export function validateReconciliationInvariant(movements:BankMovement[],payments:PaymentApplication[],credits:ClientCredit[],clients:Client[]) {
  const violations:Array<{clientName:string;bankCredits:number;appliedPayments:number;creditBalance:number;diff:number}>=[];
  for(const m of movements.filter(m=>m.estado_conciliacion==='conciliado_manual'&&m.es_credito)){
    const p=payments.filter(p=>p.movimiento_id===m.id && !p.credito_id);
    if(m.sugerencia?.tipo==='ya_conciliado'&&!p.length)continue; // Legacy imported records.
    const applied=p.reduce((sum,p)=>sum+(p.monto_movimiento??convertMoney(p.monto_aplicado,p.moneda,m.moneda,m.tipo_cambio??40.5)),0);
    // Original credit remains a funding destination even after use on an invoice.
    const credit=credits.filter(c=>c.origen_movimiento_id===m.id).reduce((s,c)=>s+c.monto_original,0);
    const funds=roundMoney(m.monto+(m.retencion_monto||0)+(m.gasto_bancario_monto||0));
    const diff=roundMoney(funds-applied-credit);
    if(diff)violations.push({clientName:clients.find(c=>c.id===m.cliente_sugerido_id)?.name||m.id,bankCredits:funds,appliedPayments:applied,creditBalance:credit,diff});
  }return violations;
}

