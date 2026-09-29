import React, {createContext,useContext,useRef,useState,useEffect} from 'react';
import type { Client,Company,Invoice,BankMovement } from '../types';
import {emptyLedger,Ledger,recalculate,confirmPayment,applyCredit,reverseOperation,importInvoices as ingestInvoices,importMovements,learnAlias,audit,uid} from '../utils/ledger';
import {loadLedger,saveLedger,validateLedger,STORAGE_KEY} from '../utils/storage';
import {validateReconciliationInvariant,normalizeText} from '../utils/matchingEngine';

function useController(){
  const [initial]=useState(()=>{try{return {state:loadLedger(localStorage),error:''};}catch(e){return {state:emptyLedger(),error:'No se pudieron abrir los datos. Se conservaron intactos. '+(e as Error).message};}});
  const [state,setState]=useState<Ledger>(initial.state);
  const current=useRef(state);
  const [error,setError]=useState(initial.error);
  const blocked=useRef(Boolean(initial.error));
  const writable=useRef(false);
  useEffect(()=>{
    if(!navigator.locks){setError('Este navegador no permite bloquear la edición entre pestañas. Usá una versión actual de Chrome, Edge o Firefox.');return;}
    let cancelled=false,release=()=>{};
    const wait=(ms:number)=>new Promise<void>(resolve=>{setTimeout(resolve,ms);});
    // StrictMode monta este efecto dos veces: la segunda petición puede llegar
    // mientras la primera todavía retiene el candado y recibir `null`. Por eso
    // se reintenta en vez de declarar el libro bloqueado de forma definitiva.
    const acquire=async(attempt:number):Promise<void>=>{
      let owned=false;
      await navigator.locks.request('conciliaya-ledger-writer',{ifAvailable:true},async lock=>{
        if(cancelled||!lock)return;
        owned=true;writable.current=true;
        await new Promise<void>(resolve=>{release=resolve;});
        // Una instancia vieja nunca debe apagar el candado de una más nueva.
        if(!cancelled)writable.current=false;
      });
      if(cancelled||owned)return;
      if(attempt>0){await wait(50);return acquire(attempt-1);}
      setError('Otra pestaña tiene abierto el libro. Cerrala y recargá esta para editar.');
    };
    acquire(40).catch(()=>{if(!cancelled)setError('No se pudo obtener acceso exclusivo al libro.');});
    return ()=>{cancelled=true;release();};
  },[]);
  const [activeTab,setActiveTab]=useState('dashboard');
  const transact=(fn:(s:Ledger)=>Ledger):boolean=>{
    try{
      if(!writable.current)throw new Error('No hay acceso exclusivo para editar. Cerrá otras pestañas y recargá.');
      if(blocked.current)throw new Error('Recuperá un respaldo válido antes de modificar datos.');
      const before=current.current,next=fn(before);
      if(next===before)return true;
      const saved=saveLedger(localStorage,before,recalculate(next));
      current.current=saved;setState(saved);setError('');return true;
    }catch(e){setError((e as Error).message);return false;}
  };
  const mutate=(fn:(s:Ledger)=>void)=>transact(before=>{const s=structuredClone(before);fn(s);return s;});
  const confirmMatch=(movementId:string,alias?:string,withholding?:number,bankFee?:number)=>transact(s=>confirmPayment(s,{movementId,alias,withholding,bankFee}));
  const confirmAllAutoMatches=()=>{
    let count=0;
    const ok=transact(before=>{
      let next=before;
      const ids=before.bankMovements.filter(m=>m.estado_conciliacion==='auto').map(m=>m.id);
      for(const id of ids){
        const m=next.bankMovements.find(m=>m.id===id);
        if(m?.estado_conciliacion!=='auto')continue;
        next=confirmPayment(next,{movementId:id});count++;
      }return next;
    });
    return ok?count:0;
  };
  const setCompany=(value:React.SetStateAction<Company>)=>mutate(s=>{s.company=typeof value==='function'?value(s.company):value;});
  const addLearnedAlias=(text:string,clientId:string)=>mutate(s=>{learnAlias(s,text,clientId);audit(s,'create_alias','alias',clientId,'Alias confirmado: '+text);});
  const manualMatch=(movementId:string,clientId:string,allocations:Array<{factura_id:string;monto:number}>,_excess:number,alias?:string,withholding?:number,bankFee?:number)=>
    transact(s=>confirmPayment(s,{movementId,clientId,allocations,alias,withholding,bankFee}));
  const restoreBackup=(json:string)=>{
    try{
      if(!writable.current)throw new Error('No hay acceso exclusivo para restaurar.');
      const parsed=JSON.parse(json),backup=validateLedger(parsed.state??parsed);
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw)localStorage.setItem(STORAGE_KEY+'_before_restore',raw);
      let revision=current.current.revision;
      try { const previous=raw?JSON.parse(raw):null; if(Number.isSafeInteger(previous?.revision)) revision=previous.revision; } catch {}
      const restored=recalculate({...backup,revision:revision+1});
      localStorage.setItem(STORAGE_KEY,JSON.stringify(restored));
      current.current=restored;setState(restored);blocked.current=false;setError('');return true;
    }catch(e){setError('No se restauró: '+(e as Error).message);return false;}
  };
  return {...state,activeTab,setActiveTab,error,dismissError:()=>setError(''),setCompany,
    exportBackup:()=>JSON.stringify({exportedAt:new Date().toISOString(),state:current.current},null,2),restoreBackup,
    runMatchingEngine:()=>transact(s=>recalculate(structuredClone(s))),
    confirmMatch,confirmAllAutoMatches,manualMatch,
    discardMovement:(id:string)=>mutate(s=>{const m=s.bankMovements.find(m=>m.id===id);if(!m)return;if(m.estado_conciliacion==='conciliado_manual')throw new Error('Revertí el pago antes de descartarlo.');m.estado_conciliacion='descartado';audit(s,'discard','movimiento',id,'Movimiento descartado.');}),
    revertReconciliation:(id:string)=>transact(s=>reverseOperation(s,id)),
    applyCreditToInvoice:(creditId:string,invoiceId:string,amount:number)=>transact(s=>applyCredit(s,creditId,invoiceId,amount)),
    addLearnedAlias,
    deleteLearnedAlias:(id:string)=>mutate(s=>{s.learnedAliases=s.learnedAliases.filter(a=>a.id!==id);audit(s,'delete_alias','alias',id,'Alias eliminado.');}),
    importInvoices:(rows:Invoice[])=>{
      let added=0;
      const ok=transact(s=>{const next=ingestInvoices(s,rows);added=next.invoices.length-s.invoices.length;return next;});
      return {ok,added};
    },
    importBankMovements:(rows:BankMovement[])=>{
      let added=0;
      const ok=transact(s=>{const next=importMovements(s,rows);added=next.bankMovements.length-s.bankMovements.length;return next;});
      return {ok,added};
    },
    importNameMapping:(rows:Array<{real:string;fictitious:string}>)=>mutate(s=>{for(const row of rows){const c=s.clients.find(c=>normalizeText(c.name)===normalizeText(row.fictitious));if(!c)throw new Error('Cliente no encontrado: '+row.fictitious);learnAlias(s,row.real,c.id);}}),
    addClient:(data:Omit<Client,'id'|'totalInvoiced'|'totalPaid'|'currentBalance'|'creditBalance'>)=>mutate(s=>{
      if(!data.name.trim())throw new Error('El nombre es obligatorio.');
      if(s.clients.some(c=>normalizeText(c.name)===normalizeText(data.name)||(data.rut_ci&&data.rut_ci===c.rut_ci)))throw new Error('El cliente ya existe.');
      const client={...data,id:uid('cli'),totalInvoiced:0,totalPaid:0,currentBalance:0,creditBalance:0};s.clients.push(client);audit(s,'create_client','cliente',client.id,'Cliente creado: '+client.name);
    }),
    updateClient:(id:string,updates:Partial<Client>)=>mutate(s=>{const c=s.clients.find(c=>c.id===id);if(!c)throw new Error('Cliente inexistente.');const {name,rut_ci,email,phone,contactPerson,address,alias_conocidos}=updates;Object.assign(c,Object.fromEntries(Object.entries({name,rut_ci,email,phone,contactPerson,address,alias_conocidos}).filter(([,v])=>v!==undefined)));if(!c.name.trim())throw new Error('Nombre obligatorio.');}),
    deleteClient:(id:string)=>mutate(s=>{if(s.invoices.some(i=>i.cliente_id===id)||s.clientCredits.some(c=>c.cliente_id===id)||s.bankMovements.some(m=>m.cliente_sugerido_id===id&&m.estado_conciliacion==='conciliado_manual'))throw new Error('El cliente tiene registros vinculados y no puede eliminarse.');s.clients=s.clients.filter(c=>c.id!==id);s.learnedAliases=s.learnedAliases.filter(a=>a.cliente_id!==id);audit(s,'delete_client','cliente',id,'Cliente eliminado.');}),
    logEmailReminder:(clientId:string,clientName:string,email:string,subject:string,balance:number,numbers:string[])=>mutate(s=>{s.emailReminderLogs.unshift({id:uid('eml'),cliente_id:clientId,cliente_nombre:clientName,destinatario_email:email,asunto:subject,fecha_envio:new Date().toISOString(),saldo_reclamado:balance,facturas_incluidas:numbers,enviado_por:'Operador (apertura del correo; entrega no verificada)'});audit(s,'prepare_statement_email','cliente',clientId,'Estado de cuenta preparado para '+email+'. Entrega no verificada.');}),
    setUsdExchangeRate:(rate:number)=>mutate(s=>{s.company.usdExchangeRate=rate;}),
    clearAllData:()=>transact(s=>({...emptyLedger(),company:s.company,revision:s.revision,entrySequence:s.entrySequence,receiptSequence:s.receiptSequence})),
    resetToDemo:()=>transact(s=>({...emptyLedger(),revision:s.revision,entrySequence:s.entrySequence,receiptSequence:s.receiptSequence})),
    validateInvariant:()=>validateReconciliationInvariant(current.current.bankMovements,current.current.paymentApplications,current.current.clientCredits,current.current.clients)
  };
}
const Context=createContext<ReturnType<typeof useController>|null>(null);
export function ConciliaProvider({children}:{children:React.ReactNode}){
  const controller=useController();
  return <Context.Provider value={controller}>
    {controller.error&&<div role="alert" className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] max-w-xl bg-red-50 border border-red-500 text-red-900 p-4 rounded-xl shadow-lg">
      {controller.error}<button className="ml-3 underline" onClick={controller.dismissError}>Cerrar</button>
    </div>}
    {children}
  </Context.Provider>;
}
export function useConcilia(){const value=useContext(Context);if(!value)throw new Error('Falta ConciliaProvider');return value;}

