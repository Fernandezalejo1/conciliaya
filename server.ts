import 'dotenv/config';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authHandler} from './server/auth';

dotenv.config({path:'.env.local',override:true,quiet:true});
const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'100kb'}));
app.all('/api/auth',authHandler);
app.get('/api/health',(_req,res)=>res.json({status:'ok'}));
app.all('/api/analyze-cryptic',(_req,res)=>res.status(410).json({error:'Análisis externo eliminado. El motor funciona localmente con reglas y alias.'}));
app.use('/api',(_req,res)=>res.status(404).json({error:'Ruta no encontrada.'}));
async function start(){
  if(process.env.NODE_ENV!=='production'){
    const {createServer}=await import('vite');
    const vite=await createServer({server:{middlewareMode:true},appType:'spa'});
    app.use(vite.middlewares);
  }else{
    const directory=path.dirname(fileURLToPath(import.meta.url));
    app.use(express.static(directory,{index:false}));
    app.get('*',(_req,res)=>res.sendFile(path.join(directory,'index.html')));
  }
  const port=Number(process.env.PORT||3000);
  const server=app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log('ConciliaYA disponible en http://localhost:'+port));
  for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>server.close(()=>process.exit(0)));
}
start().catch(err=>{console.error(err.message);process.exitCode=1;});

