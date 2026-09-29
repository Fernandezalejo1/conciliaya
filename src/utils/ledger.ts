import type { Company, Client, Invoice, BankMovement, LearnedAlias, PaymentApplication, ClientCredit, AuditLog, OfficialReceipt, AccountingEntry, EmailReminderLog } from '../types';
import { initialCompany } from '../data/mockData';
import { cents, convertMoney, invoiceTotal, roundMoney, validRate } from './money';
import { normalizeText, runFIFOAllocation } from './matchingEngine';

export interface Ledger {
  version: 4; revision: number; entrySequence: number; receiptSequence: number;
  company: Company; clients: Client[]; invoices: Invoice[]; bankMovements: BankMovement[];
  learnedAliases: LearnedAlias[]; paymentApplications: PaymentApplication[]; clientCredits: ClientCredit[];
  auditLogs: AuditLog[]; officialReceipts: OfficialReceipt[]; accountingEntries: AccountingEntry[]; emailReminderLogs: EmailReminderLog[];
}
export const uid = (prefix:string) => prefix+'_'+crypto.randomUUID();
export function emptyLedger():Ledger {
  return {version:4,revision:0,entrySequence:0,receiptSequence:0,company:structuredClone(initialCompany),
    clients:[],invoices:[],bankMovements:[],learnedAliases:[],paymentApplications:[],clientCredits:[],
    auditLogs:[],officialReceipts:[],accountingEntries:[],emailReminderLogs:[]};
}
export function audit(s:Ledger,action:string,entity:string,id:string,description:string,details?:AuditLog['detalles'],revertible=false) {
  s.auditLogs.unshift({id:uid('aud'),fecha:new Date().toISOString(),usuario:'Operador',accion:action,entidad:entity,entidad_id:id,descripcion:description,detalles:details,revertible});
}
export function recalculate(s:Ledger):Ledger {
  const {currency,usdExchangeRate:rate}=s.company;validRate(rate);
  s.clients=s.clients.map(c=>{
    const invoices=s.invoices.filter(i=>i.cliente_id===c.id&&i.estado!=='anulada');
    const totalInvoiced=roundMoney(invoices.reduce((sum,i)=>sum+convertMoney(invoiceTotal(i),i.moneda,currency,rate),0));
    const currentBalance=roundMoney(invoices.reduce((sum,i)=>sum+convertMoney(i.saldo_pendiente,i.moneda,currency,rate),0));
    const creditBalance=roundMoney(s.clientCredits.filter(cr=>cr.cliente_id===c.id).reduce((sum,cr)=>sum+convertMoney(cr.saldo_disponible,cr.moneda,currency,rate),0));
    return {...c,totalInvoiced,currentBalance,totalPaid:roundMoney(totalInvoiced-currentBalance),creditBalance};
  });
  const matches=runFIFOAllocation(s.bankMovements,s.invoices,s.clients,s.learnedAliases,s.company.autoMatchThreshold,rate);
  s.bankMovements=s.bankMovements.map(m=>{
    if(['conciliado_manual','descartado'].includes(m.estado_conciliacion))return m;
    const suggestion=matches.get(m.id);
    return {...m,sugerencia:suggestion||undefined,confianza:suggestion?.confianza||0,
      cliente_sugerido_id:suggestion?.cliente_id,cliente_sugerido_name:suggestion?.cliente_nombre,
      motivo_sugerencia:suggestion?.motivo||'Sin coincidencia inequívoca. Revisar manualmente.',
      estado_conciliacion:!m.es_credito||m.monto<=0?'descartado':!suggestion?'sin_identificar':suggestion.confianza>=s.company.autoMatchThreshold*100?'auto':'sugerido'};
  });
  return s;
}
function positive(value:number,label:string,allowZero=false) {
  const n=cents(value);if(n<0||(!allowZero&&n===0))throw new Error(label+' debe ser '+(allowZero?'no negativo.':'positivo.'));
  return n/100;
}
function sequence(s:Ledger,kind:'entry'|'receipt') {
  const n=kind==='entry'?++s.entrySequence:++s.receiptSequence;
  return (kind==='entry'?'AST':'REC')+'-'+new Date().getFullYear()+'-'+String(n).padStart(6,'0');
}
function invoiceStatus(i:Invoice):Invoice {
  return {...i,estado:i.saldo_pendiente===0?'pagada':cents(i.saldo_pendiente)===cents(invoiceTotal(i))?'pendiente':'parcial'};
}
export function learnAlias(s:Ledger,text:string,clientId:string) {
  text=normalizeText(text);if(text.length<3)throw new Error('El alias debe tener al menos tres caracteres.');
  const client=s.clients.find(c=>c.id===clientId);if(!client)throw new Error('Cliente inexistente.');
  if(s.learnedAliases.some(a=>normalizeText(a.texto_referencia)===text&&a.cliente_id!==clientId))
    throw new Error('Ese alias pertenece a otro cliente. Resolvé el conflicto antes de continuar.');
  const existing=s.learnedAliases.find(a=>normalizeText(a.texto_referencia)===text&&a.cliente_id===clientId);
  if(existing){existing.veces_confirmado++;existing.ultima_vez=new Date().toISOString();}
  else s.learnedAliases.push({id:uid('alias'),texto_referencia:text,cliente_id:clientId,cliente_nombre:client.name,veces_confirmado:1,fecha_creacion:new Date().toISOString(),ultima_vez:new Date().toISOString()});
}
export interface ConfirmInput {
  movementId:string; clientId?:string; allocations?:Array<{factura_id:string;monto:number}>;
  withholding?:number; bankFee?:number; alias?:string;
}
/** Pure transaction: the caller persists and publishes only the successful result. */
export function confirmPayment(before:Ledger,input:ConfirmInput):Ledger {
  const original=before.bankMovements.find(m=>m.id===input.movementId);
  if(!original)throw new Error('Movimiento inexistente.');
  if(original.estado_conciliacion==='conciliado_manual')return before;
  if(original.estado_conciliacion==='descartado'||!original.es_credito)throw new Error('Solo se concilian ingresos pendientes.');
  if(original.sugerencia?.tipo==='ya_conciliado'&&!input.allocations)throw new Error('La sugerencia antigua debe recalcularse.');
  const s=structuredClone(before);
  const m=s.bankMovements.find(m=>m.id===input.movementId)!;
  const client=s.clients.find(c=>c.id===(input.clientId??m.sugerencia?.cliente_id));
  if(!client)throw new Error('Seleccioná un cliente.');
  const rate=validRate(m.tipo_cambio??s.company.usdExchangeRate);
  const cash=positive(m.monto,'El ingreso'), tax=positive(input.withholding??0,'La retención',true),fee=positive(input.bankFee??0,'La comisión',true);
  const allocations=input.allocations??m.sugerencia?.facturas.map(f=>({factura_id:f.factura_id,monto:f.monto_a_aplicar}));
  if(!allocations)throw new Error('No hay sugerencia vigente.');
  const ids=new Set<string>();
  const applications:PaymentApplication[]=[];
  const affected:OfficialReceipt['facturas_canceladas']=[];
  let appliedBank=0;
  for(const a of allocations){
    if(a.monto===0)continue;
    if(ids.has(a.factura_id))throw new Error('Factura repetida en la asignación.');ids.add(a.factura_id);
    const i=s.invoices.find(i=>i.id===a.factura_id);
    if(!i||i.cliente_id!==client.id||i.estado==='anulada')throw new Error('La factura no pertenece al cliente o está anulada.');
    const amount=positive(a.monto,'La aplicación');
    if(cents(amount)>cents(i.saldo_pendiente))throw new Error('La asignación supera el saldo vigente de '+i.numero+'. Recalculá la sugerencia.');
    const bankAmount=convertMoney(amount,i.moneda,m.moneda,rate);
    if(bankAmount<=0)throw new Error('La conversión redondea a cero.');
    appliedBank=roundMoney(appliedBank+bankAmount);
    i.saldo_pendiente=roundMoney(i.saldo_pendiente-amount);Object.assign(i,invoiceStatus(i));
    applications.push({id:uid('pay'),movimiento_id:m.id,factura_id:i.id,factura_numero:i.numero,cliente_id:client.id,cliente_nombre:client.name,monto_aplicado:amount,moneda:i.moneda,monto_movimiento:bankAmount,tipo_cambio:rate,fecha:m.fecha,confirmado_por:'Operador'});
    affected.push({factura_id:i.id,factura_numero:i.numero,monto_aplicado:amount,saldo_restante:i.saldo_pendiente});
  }
  const funds=roundMoney(cash+tax+fee);
  if(cents(appliedBank)>cents(funds))throw new Error('Las asignaciones superan el ingreso más retenciones y comisiones.');
  const excess=roundMoney(funds-appliedBank);
  // Retentions/fees cannot manufacture an advance with no invoice settlement.
  if((tax||fee)&&cents(excess)>cents(cash))throw new Error('Los ajustes deben corresponder a facturas aplicadas.');
  const accounts=s.company.accountingAccounts;
  const lines:AccountingEntry['lineas']=[{cuenta_codigo:accounts.bankAccountCode,cuenta_nombre:'Banco '+m.origen_banco,debito:cash,credito:0}];
  if(tax)lines.push({cuenta_codigo:accounts.taxWithholdingCode,cuenta_nombre:'Retenciones a favor',debito:tax,credito:0});
  if(fee)lines.push({cuenta_codigo:accounts.bankFeeCode,cuenta_nombre:'Comisiones bancarias',debito:fee,credito:0});
  if(appliedBank)lines.push({cuenta_codigo:accounts.debtorsAccountCode,cuenta_nombre:'Deudores — '+client.name,debito:0,credito:appliedBank});
  if(excess)lines.push({cuenta_codigo:'2.1.3.01',cuenta_nombre:'Anticipos — '+client.name,debito:0,credito:excess});
  if(cents(lines.reduce((n,l)=>n+l.debito-l.credito,0))!==0)throw new Error('Asiento desbalanceado.');
  const receipt:OfficialReceipt={id:uid('rec'),numero_recibo:sequence(s,'receipt'),fecha:m.fecha,cliente_id:client.id,cliente_nombre:client.name,cliente_rut:client.rut_ci,movimiento_id:m.id,banco:m.origen_banco||'',referencia_bancaria:m.referencia,monto_total_cobrado:cash,moneda:m.moneda,facturas_canceladas:affected,retencion_fiscal:tax,gasto_bancario:fee,saldo_a_favor_generado:excess,emitido_por:'Operador'};
  const entry:AccountingEntry={id:uid('ast'),asiento_numero:sequence(s,'entry'),fecha:m.fecha,concepto:'Cobranza '+receipt.numero_recibo,movimiento_id:m.id,recibo_id:receipt.id,cliente_id:client.id,cliente_nombre:client.name,moneda:m.moneda,lineas:lines,total_debito:funds,total_credito:funds,creado_por:'Operador'};
  s.paymentApplications.push(...applications);s.officialReceipts.unshift(receipt);s.accountingEntries.unshift(entry);
  if(excess)s.clientCredits.push({id:uid('cred'),cliente_id:client.id,cliente_nombre:client.name,monto_original:excess,saldo_disponible:excess,moneda:m.moneda,origen_movimiento_id:m.id,fecha:m.fecha,estado:'disponible'});
  Object.assign(m,{estado_conciliacion:'conciliado_manual',fecha_conciliacion:new Date().toISOString(),conciliado_por:'Operador',cliente_sugerido_id:client.id,cliente_sugerido_name:client.name,tipo_cambio:rate,aplicaciones:applications,saldo_a_favor_generado:excess,retencion_monto:tax,gasto_bancario_monto:fee,recibo_id:receipt.id,asiento_id:entry.id});
  if(input.alias?.trim())learnAlias(s,input.alias,client.id);
  audit(s,input.allocations?'manual_match':'confirm_suggested','movimiento',m.id,'Cobranza confirmada: '+receipt.numero_recibo,{movimiento_id:m.id,cliente_id:client.id,cliente_nombre:client.name,monto:cash,saldo_a_favor:excess,recibo_id:receipt.id,asiento_id:entry.id,facturas_afectadas:affected.map(f=>({factura_id:f.factura_id,numero:f.factura_numero,monto_aplicado:f.monto_aplicado}))},true);
  return recalculate(s);
}
export function applyCredit(before:Ledger,creditId:string,invoiceId:string,amount:number):Ledger {
  const s=structuredClone(before),cr=s.clientCredits.find(c=>c.id===creditId),i=s.invoices.find(i=>i.id===invoiceId);
  if(!cr||!i||cr.cliente_id!==i.cliente_id||i.estado==='anulada')throw new Error('Crédito y factura deben pertenecer al mismo cliente.');
  if(cr.moneda!==i.moneda)throw new Error('Aplicá el crédito a una factura de la misma moneda.');
  amount=positive(amount,'La aplicación');
  if(cents(amount)>cents(cr.saldo_disponible)||cents(amount)>cents(i.saldo_pendiente))throw new Error('La aplicación supera el crédito o el saldo disponible.');
  cr.saldo_disponible=roundMoney(cr.saldo_disponible-amount);cr.estado=cr.saldo_disponible?'parcial':'usado';
  i.saldo_pendiente=roundMoney(i.saldo_pendiente-amount);Object.assign(i,invoiceStatus(i));
  s.paymentApplications.push({id:uid('pay'),credito_id:cr.id,movimiento_id:cr.origen_movimiento_id||'',factura_id:i.id,factura_numero:i.numero,cliente_id:cr.cliente_id,cliente_nombre:cr.cliente_nombre,monto_aplicado:amount,moneda:i.moneda,fecha:new Date().toISOString().slice(0,10),confirmado_por:'Operador'});
  const entry:AccountingEntry={id:uid('ast'),asiento_numero:sequence(s,'entry'),fecha:new Date().toISOString().slice(0,10),concepto:'Aplicación de crédito a '+i.numero,cliente_id:cr.cliente_id,cliente_nombre:cr.cliente_nombre,moneda:cr.moneda,lineas:[{cuenta_codigo:'2.1.3.01',cuenta_nombre:'Anticipos',debito:amount,credito:0},{cuenta_codigo:s.company.accountingAccounts.debtorsAccountCode,cuenta_nombre:'Deudores',debito:0,credito:amount}],total_debito:amount,total_credito:amount,creado_por:'Operador'};
  s.accountingEntries.unshift(entry);
  audit(s,'apply_credit','credito',cr.id,'Crédito aplicado a '+i.numero,{asiento_id:entry.id,payment_application_id:s.paymentApplications[s.paymentApplications.length-1].id,facturas_afectadas:[{factura_id:i.id,numero:i.numero,monto_aplicado:amount}]},true);
  return recalculate(s);
}
export function reverseOperation(before:Ledger,logId:string):Ledger {
  const original=before.auditLogs.find(l=>l.id===logId);
  if(!original||!original.revertible)throw new Error('Operación no reversible.');
  if(original.reverted)return before;
  const s=structuredClone(before),log=s.auditLogs.find(l=>l.id===logId)!;
  const mid=log.detalles?.movimiento_id;
  if(mid && s.clientCredits.some(c=>c.origen_movimiento_id===mid && cents(c.saldo_disponible)!==cents(c.monto_original)))
    throw new Error('Primero revertí las aplicaciones del crédito generado por este ingreso.');
  const entry=s.accountingEntries.find(e=>e.id===log.detalles?.asiento_id);
  if(!entry)throw new Error('Falta el asiento original. Revisá los datos antes de revertir.');
  for(const f of log.detalles?.facturas_afectadas||[]){
    const i=s.invoices.find(i=>i.id===f.factura_id);if(!i)throw new Error('Falta una factura de la operación.');
    const restored=roundMoney(i.saldo_pendiente+f.monto_aplicado);
    if(cents(restored)>cents(invoiceTotal(i)))throw new Error('La reversión supera el total de la factura.');
    i.saldo_pendiente=restored;Object.assign(i,invoiceStatus(i));
  }
  if(log.accion==='apply_credit'){
    const cr=s.clientCredits.find(c=>c.id===log.entidad_id);if(!cr)throw new Error('Crédito inexistente.');
    const amount=log.detalles!.facturas_afectadas!.reduce((n,f)=>n+f.monto_aplicado,0);
    cr.saldo_disponible=roundMoney(cr.saldo_disponible+amount);cr.estado=cents(cr.saldo_disponible)===cents(cr.monto_original)?'disponible':'parcial';
    // Each application is identified by the matching audit entry below.
    const matching=s.paymentApplications.findIndex(p=>p.id===log.detalles?.payment_application_id);
    if(matching<0)throw new Error('Aplicación de crédito inexistente.');
    s.paymentApplications.splice(matching,1);
  }else{
    const m=s.bankMovements.find(m=>m.id===mid);if(!m)throw new Error('Movimiento inexistente.');
    s.paymentApplications=s.paymentApplications.filter(p=>p.movimiento_id!==mid);
    s.clientCredits=s.clientCredits.filter(c=>c.origen_movimiento_id!==mid);
    const r=s.officialReceipts.find(r=>r.id===log.detalles?.recibo_id);if(r)r.anulado=true;
    Object.assign(m,{estado_conciliacion:'sugerido',aplicaciones:undefined,fecha_conciliacion:undefined,conciliado_por:undefined,recibo_id:undefined,asiento_id:undefined,saldo_a_favor_generado:undefined,retencion_monto:undefined,gasto_bancario_monto:undefined});
  }
  s.accountingEntries.unshift({...entry,id:uid('ast'),asiento_numero:sequence(s,'entry'),fecha:new Date().toISOString().slice(0,10),concepto:'Reversión de '+entry.asiento_numero,reversa_de:entry.id,lineas:entry.lineas.map(l=>({...l,debito:l.credito,credito:l.debito}))});
  log.reverted=true;audit(s,'reversion','auditoria',log.id,'Reversión de '+log.descripcion);
  return recalculate(s);
}
export function importInvoices(before:Ledger,incoming:Invoice[]):Ledger {
  const s=structuredClone(before),seen=new Map<string,Invoice>();
  for(const raw of incoming){
    const inv=structuredClone(raw);
    let client=s.clients.find(c=>(inv.cliente_rut && c.rut_ci===inv.cliente_rut)||c.id===inv.cliente_id||(!inv.cliente_rut&&normalizeText(c.name)===normalizeText(inv.cliente_nombre)));
    if(!client){
      client={id:uid('cli'),name:inv.cliente_nombre,rut_ci:inv.cliente_rut||'',alias_conocidos:[],totalInvoiced:0,totalPaid:0,currentBalance:0,creditBalance:0};s.clients.push(client);
    }
    inv.cliente_id=client.id;inv.cliente_nombre=client.name;
    const total=positive(invoiceTotal(inv),'El total de factura');
    positive(inv.saldo_pendiente,'El saldo',true);
    if(cents(inv.saldo_pendiente)>cents(total))throw new Error('Saldo mayor al total.');
    const key=client.id+'|'+normalizeText(inv.numero)+'|'+inv.moneda;
    const prior=seen.get(key)||s.invoices.find(i=>i.cliente_id===client!.id&&normalizeText(i.numero)===normalizeText(inv.numero)&&i.moneda===inv.moneda);
    if(prior){
      if(cents(invoiceTotal(prior))!==cents(total)||prior.fecha!==inv.fecha)throw new Error('La factura '+inv.numero+' ya existe con datos diferentes. No se sumaron importes.');
      continue;
    }
    inv.id=uid('inv');Object.assign(inv,invoiceStatus(inv));s.invoices.push(inv);seen.set(key,inv);
  }
  audit(s,'import','factura','batch','Importación: '+(s.invoices.length-before.invoices.length)+' facturas nuevas; duplicados omitidos.');
  return recalculate(s);
}
export function movementKey(m:BankMovement):string {
  return [m.origen_banco,m.moneda,m.fecha,cents(m.monto),m.referencia||'',normalizeText(m.descripcion_cruda)].join('|');
}
export function importMovements(before:Ledger,incoming:BankMovement[]):Ledger {
  const s=structuredClone(before),keys=new Set(s.bankMovements.map(movementKey));
  for(const raw of incoming){
    if(!raw.es_credito||raw.monto<=0)continue;
    positive(raw.monto,'El ingreso');const key=movementKey(raw);if(keys.has(key))continue;
    keys.add(key);s.bankMovements.push({...raw,id:uid('mov'),estado_conciliacion:'sin_identificar',sugerencia:undefined});
  }
  audit(s,'import','movimiento','batch','Importación: '+(s.bankMovements.length-before.bankMovements.length)+' ingresos nuevos; duplicados omitidos.');
  return recalculate(s);
}
