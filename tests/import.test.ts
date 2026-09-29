import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRobustNumber,parseRobustDate,validateInvoicesBatch,validateBankMovementsBatch} from '../src/utils/fileValidation';
for(const [raw,n] of [['1.234,56',1234.56],['1,234.56',1234.56],['USD 10.50',10.5],['(10,50)',-10.5],[0,0]] as const)
  test('número '+raw,()=>assert.equal(parseRobustNumber(raw).value,n));
for(const raw of ['12abc34','1,000','1.000','1.2.3','12-3','',Infinity,NaN])
  test('rechaza importe '+raw,()=>assert.equal(parseRobustNumber(raw).isValid,false));
for(const raw of ['31/02/2026','2026-02-29','2026-13-01','12/31/2026','2026-02-30T00:00:00Z'])
  test('rechaza fecha '+raw,()=>assert.equal(parseRobustDate(raw).isValid,false));
test('fecha bisiesta',()=>assert.equal(parseRobustDate('29/02/2024').isoDate,'2024-02-29'));
const map={numero:'numero',cliente:'cliente',fecha:'fecha',importe:'total',monto_pagado:'pagado',iva_monto:'iva',moneda:'moneda'};
const row={numero:'A101',cliente:'Cliente',fecha:'01/01/2026',total:122,pagado:22,moneda:'UYU'};
test('no inventa IVA y respeta pagos históricos',()=>{
  const i=validateInvoicesBatch([row],map).sanitizedRows[0];assert.equal(i.monto_con_iva,122);assert.equal(i.saldo_pendiente,100);assert.equal(i.iva_monto,0);
});
test('neto con IVA explícito',()=>{
  const i=validateInvoicesBatch([{...row,'Monto sin IVA':100,iva:22,pagado:0}],{...map,importe:'Monto sin IVA'}).sanitizedRows[0];assert.equal(i.monto_con_iva,122);
});
test('neto sin columna de IVA requiere revisión',()=>assert.equal(validateInvoicesBatch([{...row,'Monto sin IVA':100}],{...map,importe:'Monto sin IVA',iva_monto:''}).errorRowsCount,1));
test('moneda desconocida se rechaza',()=>assert.equal(validateInvoicesBatch([{...row,moneda:'EUR'}],map).errorRowsCount,1));
test('pagos históricos mayores que total se rechazan',()=>assert.equal(validateInvoicesBatch([{...row,pagado:123}],map).errorRowsCount,1));
test('referencia bancaria vacía permanece estable',()=>{
  const m={fecha:'fecha',monto:'total',descripcion:'cliente'};
  assert.equal(validateBankMovementsBatch([row],m).sanitizedRows[0].referencia,'');
});
