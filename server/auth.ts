import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';

const TTL=8*60*60;
function secret(){return process.env.SESSION_SECRET||process.env.APP_PASSWORD||'';}
function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function createSession(now=Date.now()){
  if(!secret())throw new Error('Falta configurar APP_PASSWORD.');
  const data=Buffer.from(JSON.stringify({exp:Math.floor(now/1000)+TTL,nonce:randomBytes(24).toString('hex')})).toString('base64url');
  return data+'.'+createHmac('sha256',secret()).update(data).digest('base64url');
}
export function validSession(token:string,now=Date.now()){
  try{
    if(!secret()||token.length>2048)return false;
    const [data,sig,...extra]=token.split('.');
    if(extra.length||!data||!sig||!equal(sig,createHmac('sha256',secret()).update(data).digest('base64url')))return false;
    const parsed=JSON.parse(Buffer.from(data,'base64url').toString());
    return Number.isInteger(parsed.exp)&&parsed.exp>now/1000&&parsed.exp<=now/1000+TTL+1;
  }catch{return false;}
}
function session(req:IncomingMessage){
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('conciliaya_session='))?.slice('conciliaya_session='.length)||'';
  return validSession(token);
}
function send(res:ServerResponse,status:number,data:unknown){
  res.statusCode=status;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));
}
function cookie(req:IncomingMessage,value:string,maxAge:number){
  const secure=process.env.NODE_ENV==='production'&&(req.headers['x-forwarded-proto']==='https'||Boolean(process.env.VERCEL));
  return 'conciliaya_session='+value+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+maxAge+(secure?'; Secure':'');
}
const attempts=new Map<string,{count:number;until:number}>();
export function authHandler(req:IncomingMessage & {body?:any},res:ServerResponse){
  if(req.method==='GET')return send(res,session(req)?200:401,{ok:session(req),configured:Boolean(process.env.APP_PASSWORD)});
  if(!['POST','DELETE'].includes(req.method||''))return send(res,405,{error:'Método no permitido.'});
  const origin=req.headers.origin;
  if(origin){try{if(new URL(origin).host!==req.headers.host)return send(res,403,{error:'Origen no permitido.'});}catch{return send(res,403,{error:'Origen no permitido.'});}}
  if(req.method==='DELETE'){res.setHeader('Set-Cookie',cookie(req,'',0));return send(res,200,{ok:true});}
  if(!process.env.APP_PASSWORD)return send(res,503,{error:'Configurá APP_PASSWORD en .env.local para habilitar el acceso.'});
  const key=req.socket?.remoteAddress||'unknown',now=Date.now();
  for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
  const attempt=attempts.get(key);
  if(attempt&&attempt.count>=10)return send(res,429,{error:'Demasiados intentos. Esperá 15 minutos.'});
  if(typeof req.body?.password!=='string'||req.body.password.length>512)return send(res,400,{error:'Contraseña inválida.'});
  if(!equal(req.body.password,process.env.APP_PASSWORD)){
    attempts.set(key,{count:(attempt?.count||0)+1,until:attempt?.until||now+15*60*1000});
    return send(res,401,{error:'Contraseña incorrecta.'});
  }
  attempts.delete(key);res.setHeader('Set-Cookie',cookie(req,createSession(),TTL));return send(res,200,{ok:true});
}
