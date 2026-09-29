import type { BankMovement, CurrencyCode, Invoice } from '../types';
import {roundMoney} from './money';
export interface RowValidationIssue {rowIndex:number;field:string;fieldLabel:string;severity:'error'|'warning'|'info';message:string;rawValue:any;}
export interface RowValidationStatus<T>{rowIndex:number;rowNumber:number;status:'valid'|'warning'|'error';issues:RowValidationIssue[];sanitizedData?:T;rawRow:Record<string,any>;}
export interface ValidationSummary<T>{isValid:boolean;hasCriticalErrors:boolean;totalRows:number;validRowsCount:number;warningRowsCount:number;errorRowsCount:number;missingRequiredHeaders:Array<{key:string;label:string}>;headerErrors:string[];issues:RowValidationIssue[];rowStatuses:RowValidationStatus<T>[];sanitizedRows:T[];}
export function parseRobustNumber(value:any):{value:number|null;isValid:boolean;error?:string;rawString:string}{
  const rawString=String(value??'').trim();
  const bad=(error='Importe inválido o ambiguo.')=>({value:null,isValid:false,error,rawString});
  if(typeof value==='number')return Number.isFinite(value)&&Math.abs(value)<=1e12?{value:roundMoney(value),isValid:true,rawString}:bad();
  if(!rawString)return bad('Falta el importe.');
  let text=rawString.replace(/^(?:UYU|USD|U\$S|US\$|\$)\s*/i,'').replace(/\s*(?:UYU|USD)$/i,'').trim();
  let sign=1;
  if(/^\(.*\)$/.test(text)){sign=-1;text=text.slice(1,-1);}
  else if(text.startsWith('-')){sign=-1;text=text.slice(1);}
  if(!/^\d[\d.,]*$/.test(text))return bad();
  if(text.includes('.')&&text.includes(',')){
    const latin=text.lastIndexOf(',')>text.lastIndexOf('.');
    const re=latin?/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/:/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/;
    if(!re.test(text))return bad();
    text=latin?text.replace(/\./g,'').replace(',','.'):text.replace(/,/g,'');
  }else if(/[.,]/.test(text)){
    const parts=text.split(/[.,]/);
    // Three trailing digits have two interpretations: never guess monetary magnitude.
    if(parts.length===2&&parts[1].length>=1&&parts[1].length<=2)text=parts[0]+'.'+parts[1];
    else if(parts.length>2&&/^\d{1,3}([.,])\d{3}(?:\1\d{3})+$/.test(text))text=parts.join('');
    else return bad('Separador ambiguo. Usá 1234,56 o 1234.56; para miles sin decimales, 1234.');
  }
  const n=Number(text)*sign;
  return Number.isFinite(n)&&Math.abs(n)<=1e12?{value:roundMoney(n),isValid:true,rawString}:bad();
}
export function parseRobustDate(value:any):{isoDate:string|null;isValid:boolean;error?:string;rawString:string}{
  const rawString=String(value??'').trim();
  const bad=()=>({isoDate:null,isValid:false,error:'Fecha inválida. Usá DD/MM/AAAA o AAAA-MM-DD.',rawString});
  if(typeof value==='number'&&Number.isFinite(value)&&value>=32874&&value<=73050){
    const date=new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000);
    return {isoDate:date.toISOString().slice(0,10),isValid:true,rawString};
  }
  const iso=rawString.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/),local=rawString.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if(!iso&&!local)return bad();
  const [year,month,day]=iso?[+iso[1],+iso[2],+iso[3]]:[+local![3],+local![2],+local![1]];
  const date=new Date(Date.UTC(year,month-1,day));
  if(year<1990||year>2100||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return bad();
  return {isoDate:date.toISOString().slice(0,10),isValid:true,rawString};
}
type Mapping=Record<string,string|undefined>;
function currency(value:any,header:string):CurrencyCode {
  const t=String(value||(/USD|U\$S|US\$/i.test(header)?'USD':'UYU')).trim().toUpperCase();
  if(['USD','U$S','US$','DOLARES','DÓLARES'].includes(t))return 'USD';
  if(['UYU','$','PESOS','PESOS URUGUAYOS'].includes(t))return 'UYU';
  throw new Error('Moneda no soportada: '+t);
}
function batch<T>(rows:any[],map:Mapping,required:string[],parse:(row:any,index:number,warn:(message:string)=>void)=>T):ValidationSummary<T>{
  const missingRequiredHeaders=required.filter(k=>!map[k]||!rows.some(r=>Object.hasOwn(r,map[k]!))).map(key=>({key,label:key}));
  const rowStatuses:RowValidationStatus<T>[]=[],sanitizedRows:T[]=[],issues:RowValidationIssue[]=[];
  rows.forEach((row,index)=>{
    if(Object.values(row).every(v=>v===null||v===undefined||String(v).trim()===''))return;
    const own:RowValidationIssue[]=[];
    let sanitizedData:T|undefined;
    try{
      if(missingRequiredHeaders.length)throw new Error('Faltan columnas obligatorias.');
      sanitizedData=parse(row,index,message=>own.push({rowIndex:index,field:'general',fieldLabel:'Fila',severity:'warning',message,rawValue:''}));
      sanitizedRows.push(sanitizedData);
    }catch(e){own.push({rowIndex:index,field:'general',fieldLabel:'Fila',severity:'error',message:(e as Error).message,rawValue:''});}
    issues.push(...own);rowStatuses.push({rowIndex:index,rowNumber:index+2,status:own.some(i=>i.severity==='error')?'error':own.length?'warning':'valid',issues:own,sanitizedData,rawRow:row});
  });
  const errorRowsCount=rowStatuses.filter(r=>r.status==='error').length;
  const hasCriticalErrors=missingRequiredHeaders.length>0||errorRowsCount>0;
  return {isValid:!hasCriticalErrors,hasCriticalErrors,totalRows:rowStatuses.length,validRowsCount:rowStatuses.filter(r=>r.status==='valid').length,warningRowsCount:rowStatuses.filter(r=>r.status==='warning').length,errorRowsCount,missingRequiredHeaders,headerErrors:missingRequiredHeaders.map(h=>'Falta '+h.label),issues,rowStatuses,sanitizedRows};
}
function amount(value:any,optional=false){
  if(optional&&(value===undefined||value===null||String(value).trim()===''))return 0;
  const p=parseRobustNumber(value);if(!p.isValid||p.value===null)throw new Error(p.error);
  if(p.value<0)throw new Error('No se admiten importes negativos en este flujo.');return p.value;
}
function date(value:any){const p=parseRobustDate(value);if(!p.isoDate)throw new Error(p.error);return p.isoDate;}
export function validateInvoicesBatch(rows:any[],map:Mapping,existing:Invoice[]=[]):ValidationSummary<Invoice>{
  return batch(rows,map,['numero','cliente','fecha','importe'],(row,index,warn)=>{
    const get=(key:string)=>map[key]?row[map[key]!]:undefined;
    const number=String(get('numero')??'').trim(),name=String(get('cliente')??'').trim();
    if(!number||!name)throw new Error('Falta número de factura o cliente.');
    const value=amount(get('importe'));if(value<=0)throw new Error('La factura debe tener importe positivo.');
    const tax=amount(get('iva_monto'),true),paid=amount(get('monto_pagado'),true);
    const header=(map.importe||'').toLowerCase();
    const net=header.includes('sin iva');
    if(net&&!map.iva_monto)throw new Error('Mapeá el total con IVA o una columna de IVA explícita; no se calcula una tasa por defecto.');
    const total=roundMoney(net?value+tax:value);
    if(!net && tax>total)throw new Error('IVA mayor al total.');
    if(paid>total)throw new Error('El monto histórico pagado supera el total.');
    const issued=date(get('fecha')),due=get('vencimiento')?date(get('vencimiento')):issued;
    if(due<issued)throw new Error('Vencimiento anterior a la emisión.');
    if(!get('vencimiento'))warn('Sin vencimiento: se usa la fecha de emisión.');
    const moneda=currency(get('moneda'),map.importe||'');
    if(existing.some(i=>i.numero.toUpperCase()===number.toUpperCase()&&i.cliente_nombre.toUpperCase()===name.toUpperCase()&&i.moneda===moneda))warn('Factura existente: se omitirá si es idéntica; los cambios requieren revisión.');
    const saldo=roundMoney(total-paid);
    const alternate=Object.keys(row).filter(h=>/raz[oó]n social|cliente.*proyecto/i.test(h)).map(h=>String(row[h]||'').trim()).filter(n=>n&&n!==name);
    return {id:'preview_inv_'+index,cliente_id:'preview_'+name,cliente_nombre:name,cliente_rut:String(get('rut_ci')||''),cliente_nombre_alt:alternate,numero:number,fecha:issued,vencimiento:due,importe:total,monto_sin_iva:roundMoney(total-tax),monto_con_iva:total,iva_monto:tax,monto_pagado:paid,saldo_pendiente:saldo,moneda,estado:saldo===0?'pagada':paid?'parcial':'pendiente'};
  });
}
export function validateBankMovementsBatch(rows:any[],map:Mapping,existing:BankMovement[]=[]):ValidationSummary<BankMovement>{
  return batch(rows,map,['fecha','monto','descripcion'],(row,index,warn)=>{
    const get=(key:string)=>map[key]?row[map[key]!]:undefined;
    const parsed=parseRobustNumber(get('monto'));if(!parsed.isValid||parsed.value===null)throw new Error(parsed.error);
    const tipo=Object.keys(row).find(k=>/cr[eé]dito.*d[eé]bito|tipo.*operaci[oó]n|tipo.*mov/i.test(k));
    if(parsed.value<=0 || (tipo&&/^(d[eé]bito|debit|d|deb)$/i.test(String(row[tipo]).trim())))throw new Error('Egreso o importe cero: no se importa como cobranza.');
    const description=String(get('descripcion')||'').trim();if(!description)throw new Error('Falta descripción.');
    const reference=String(get('referencia')||'').trim();
    if(!reference)warn('Sin referencia bancaria: se detectan duplicados por banco, fecha, moneda, monto y descripción.');
    const m:BankMovement={id:'preview_mov_'+index,fecha:date(get('fecha')),monto:parsed.value,moneda:currency(get('moneda'),map.monto||''),descripcion_cruda:description,referencia:reference,origen_banco:String(get('banco')||'Sin especificar'),es_credito:true,estado_conciliacion:'sin_identificar',confianza:0};
    if(existing.some(e=>e.fecha===m.fecha&&e.moneda===m.moneda&&e.monto===m.monto&&e.referencia===m.referencia&&e.descripcion_cruda===m.descripcion_cruda&&e.origen_banco===m.origen_banco))warn('Movimiento existente: se omitirá el duplicado.');
    return m;
  });
}

