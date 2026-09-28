import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSession,validSession,authHandler} from '../server/auth';
process.env.APP_PASSWORD='test-only-not-a-deployment-password';
test('sesión firmada válida, falsificada y expirada',()=>{
  const now=Date.now(),token=createSession(now);assert.equal(validSession(token,now),true);
  assert.equal(validSession(token+'x',now),false);assert.equal(validSession('conciliaya_auth_123'),false);
  assert.equal(validSession(token,now+9*60*60*1000),false);
});
test('cambiar contraseña revoca sesiones derivadas',()=>{
  const token=createSession();process.env.APP_PASSWORD+='x';assert.equal(validSession(token),false);
});
test('auth no devuelve token al JavaScript del cliente',()=>{
  const headers:Record<string,string>={};let body='';const res:any={setHeader:(k:string,v:string)=>headers[k]=v,end:(v:string)=>body=v};
  authHandler({method:'POST',headers:{host:'localhost'},body:{password:process.env.APP_PASSWORD},socket:{remoteAddress:'test'}} as any,res);
  assert.equal(res.statusCode,200);assert.equal(JSON.parse(body).token,undefined);assert.match(headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);
});
test('rechaza solicitud de otro origen',()=>{
  const res:any={setHeader:()=>{},end:()=>{}};
  authHandler({method:'POST',headers:{host:'localhost',origin:'https://another.test'},socket:{}} as any,res);
  assert.equal(res.statusCode,403);
});
