import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyLedger,recalculate,confirmPayment,reverseOperation,applyCredit,importInvoices,importMovements} from '../src/utils/ledger';
import {matchBankMovement,runFIFOAllocation,validateReconciliationInvariant,calculateAging} from '../src/utils/matchingEngine';
import {convertMoney} from '../src/utils/money';
import {loadLedger,saveLedger,STORAGE_KEY} from '../src/utils/storage';
import type {Invoice,BankMovement,Client} from '../src/types';
export const client:Client={id:'c1',name:'ACME',rut_ci:'12345678901',alias_conocidos:[],totalInvoiced:0,totalPaid:0,currentBalance:0,creditBalance:0};
export const inv=(id='A101',amount=100,extra:Partial<Invoice>={}):Invoice=>({id,numero:id,cliente_id:'c1',cliente_nombre:'ACME',importe:amount,monto_con_iva:amount,saldo_pendiente:amount,fecha:'2026-01-01',vencimiento:'2026-02-01',moneda:'UYU',estado:'pendiente',...extra});
export const mov=(id='m1',amount=100,extra:Partial<BankMovement>={}):BankMovement=>({id,monto:amount,descripcion_cruda:'ACME',fecha:'2026-03-01',moneda:'UYU',origen_banco:'Banco prueba',es_credito:true,estado_conciliacion:'sin_identificar',confianza:0,...extra});
function state(invoices=[inv()],movements=[mov()]){
  return recalculate({...emptyLedger(),company:{...emptyLedger().company,usdExchangeRate:40},clients:[client],invoices,bankMovements:movements});
}
function balanced(s:ReturnType<typeof state>){
  for(const e of s.accountingEntries)assert.equal(e.total_debito,e.total_credito);
  assert.deepEqual(validateReconciliationInvariant(s.bankMovements,s.paymentApplications,s.clientCredits,s.clients),[]);
}
test('pago exacto reduce saldo y conserva fondos',()=>{
  const s=confirmPayment(state(),{movementId:'m1'});assert.equal(s.invoices[0].saldo_pendiente,0);assert.equal(s.officialReceipts.length,1);balanced(s);
});
test('pago parcial conserva saldo pendiente',()=>{
  const s=confirmPayment(state([inv()],[mov('m1',40)]),{movementId:'m1'});assert.equal(s.invoices[0].saldo_pendiente,60);balanced(s);
});
test('sobrepago genera crédito en moneda bancaria',()=>{
  const s=confirmPayment(state([inv()],[mov('m1',120)]),{movementId:'m1'});assert.equal(s.clientCredits[0].saldo_disponible,20);balanced(s);
});
for(const [currency,bankCurrency,amount,expected] of [['USD','UYU',100,97.5],['UYU','USD',1,60]] as const){
  test('conversión '+bankCurrency+' hacia '+currency,()=>{
    const s=confirmPayment(state([inv('A101',100,{moneda:currency})],[mov('m1',amount,{moneda:bankCurrency})]),{movementId:'m1'});
    assert.equal(s.invoices[0].saldo_pendiente,expected);balanced(s);
  });
}
test('referencia parcial USD a factura UYU',()=>{
  const s=matchBankMovement(mov('m1',10,{moneda:'USD',descripcion_cruda:'FAC A101'}),[inv('A101',1000)],[client],[],.9,40);
  assert.equal(s?.facturas[0].monto_a_aplicar,400);
});
test('factura pagada no absorbe ingreso recurrente',()=>{
  const s=state([inv('A100',100,{estado:'pagada',saldo_pendiente:0}),inv()]);
  assert.equal(s.bankMovements[0].sugerencia?.facturas[0].factura_id,'A101');
});
test('dos movimientos nunca reservan dos veces el mismo saldo',()=>{
  const results=runFIFOAllocation([mov('m1',100),mov('m2',150)],[inv(),inv('A102',50)],[client],[],.9,40);
  assert.equal([...results.values()].flatMap(r=>r?.facturas||[]).filter(f=>f.factura_id==='A101').reduce((s,f)=>s+f.monto_a_aplicar,0),100);
});
test('confirmación repetida es idempotente',()=>{
  const s=confirmPayment(state(),{movementId:'m1'});assert.strictEqual(confirmPayment(s,{movementId:'m1'}),s);
});
test('error contable no muta ninguna entidad',()=>{
  const s=state([inv()],[mov('m1',50)]),snapshot=JSON.stringify(s);
  assert.throws(()=>confirmPayment(s,{movementId:'m1',clientId:'c1',allocations:[{factura_id:'A101',monto:100}]}));
  assert.equal(JSON.stringify(s),snapshot);
});
test('no sobreaplica saldo ni cruza clientes',()=>{
  const s=state();assert.throws(()=>confirmPayment(s,{movementId:'m1',allocations:[{factura_id:'A101',monto:101}]}));
  const bad=state([inv('A101',100,{cliente_id:'otro'})]);assert.throws(()=>confirmPayment(bad,{movementId:'m1',clientId:'c1',allocations:[{factura_id:'A101',monto:100}]}));
});
test('retención y comisión se aplican una sola vez',()=>{
  const s=confirmPayment(state([inv()],[mov('m1',95)]),{movementId:'m1',clientId:'c1',allocations:[{factura_id:'A101',monto:100}],withholding:3,bankFee:2});
  assert.equal(s.clients[0].totalPaid,100);assert.equal(s.clientCredits.length,0);balanced(s);
});
test('reversión restaura IVA y conserva asiento original',()=>{
  const s=confirmPayment(state([inv('A101',122,{importe:100})],[mov('m1',122)]),{movementId:'m1'});
  const reversed=reverseOperation(s,s.auditLogs[0].id);
  assert.equal(reversed.invoices[0].saldo_pendiente,122);assert.equal(reversed.accountingEntries.length,2);assert.equal(reversed.officialReceipts[0].anulado,true);balanced(reversed);
  assert.strictEqual(reverseOperation(reversed,s.auditLogs[0].id),reversed);
});
test('crédito consumido exige revertir aplicación primero',()=>{
  let s=confirmPayment(state([inv()],[mov('m1',150)]),{movementId:'m1'});
  const paymentLog=s.auditLogs[0].id;
  s=importInvoices(s,[inv('A102',50)]);
  s=applyCredit(s,s.clientCredits[0].id,s.invoices.find(i=>i.numero==='A102')!.id,50);
  assert.equal(s.invoices.find(i=>i.numero==='A102')!.saldo_pendiente,0);balanced(s);
  assert.throws(()=>reverseOperation(s,paymentLog));
  s=reverseOperation(s,s.auditLogs[0].id);s=reverseOperation(s,paymentLog);
  assert.equal(s.invoices.find(i=>i.numero==='A101')!.saldo_pendiente,100);
});
test('crédito en distinta moneda requiere decisión explícita',()=>{
  const s=confirmPayment(state([inv()],[mov('m1',150)]),{movementId:'m1'});
  s.invoices.push(inv('A102',50,{moneda:'USD'}));
  assert.throws(()=>applyCredit(s,s.clientCredits[0].id,'A102',50));
});
test('reimportación idéntica no aumenta deuda',()=>{
  const s=importInvoices(state(),[inv()]);assert.equal(s.invoices.length,1);assert.equal(s.invoices[0].saldo_pendiente,100);
});
test('reimportación modificada se rechaza sin sumar',()=>{
  assert.throws(()=>importInvoices(state(),[inv('A101',101)]));
});
test('reimportación bancaria sin referencia estable se deduplica',()=>{
  const s=importMovements(state(),[mov('nuevo-id')]);assert.equal(s.bankMovements.length,1);
});
test('descartados y débitos no generan sugerencias',()=>{
  for(const m of [mov('m1',100,{es_credito:false}),mov('m1',100,{estado_conciliacion:'descartado'})])
    assert.equal(matchBankMovement(m,[inv()],[client],[]),null);
});
test('clientes ambiguos no se resuelven por orden',()=>{
  const other={...client,id:'c2'};assert.equal(matchBankMovement(mov(),[inv()],[client,other],[]),null);
});
test('serie de factura no se pierde',()=>{
  const s=state([inv('A101'),inv('B101')],[mov('m1',100,{descripcion_cruda:'ACME FAC B101'})]);
  assert.equal(s.bankMovements[0].sugerencia?.facturas[0].factura_id,'B101');
});
test('antigüedad usa fecha civil y moneda base',()=>{
  const a=calculateAging([inv('A101',100,{moneda:'USD',vencimiento:'2026-03-01'})],'UYU',40,'2026-03-02');
  assert.equal(a.dias_1_30,4000);assert.equal(a.total,4000);
});
test('rechaza NaN, Infinity, negativos y tipo de cambio inválido',()=>{
  for(const n of [NaN,Infinity,-1])assert.throws(()=>confirmPayment(state(),{movementId:'m1',withholding:n}));
  assert.throws(()=>convertMoney(1,'USD','UYU',0));
});
test('persistencia rechaza cambios obsoletos',()=>{
  const data=new Map<string,string>(),store={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
  const s=state();saveLedger(store,s,s);assert.throws(()=>saveLedger(store,s,s));
  assert.equal(loadLedger(store).revision,1);
});
test('fallo al guardar mantiene snapshot anterior',()=>{
  const original=JSON.stringify(state()),store={getItem:()=>original,setItem:()=>{throw new Error('QuotaExceeded');}};
  assert.throws(()=>saveLedger(store,state(),confirmPayment(state(),{movementId:'m1'})));
  assert.equal(store.getItem(),original);
});
test('respaldo corrupto no se interpreta como libro vacío',()=>{
  assert.throws(()=>loadLedger({getItem:k=>k===STORAGE_KEY?'{broken':null,setItem:()=>{}}));
});
test('100 combinaciones de montos conservan fondos',()=>{
  for(let n=1;n<=100;n++){
    const s=confirmPayment(state([inv('A101',n/2)],[mov('m1',n/3)]),{movementId:'m1'});
    balanced(s);assert.ok(s.invoices[0].saldo_pendiente>=0);
  }
});
