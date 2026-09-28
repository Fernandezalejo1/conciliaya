/**
 * Tests del handler de login (/api/auth).
 *
 * No usa un framework: corre con tsx y falla con codigo 1. Cubre los casos limite
 * que importan en un endpoint de autenticacion: contrasena correcta, incorrecta,
 * de otro largo (que es la que antes podia reventar por timingSafeEqual), vacia,
 * no-string, sin configurar y metodo equivocado.
 *
 *   npm test
 */
import handler from '../api/auth';

function mockRes(): any {
  // Vercel responde 200 por defecto si el handler no llama a status().
  const res: any = { statusCode: 200, body: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}

async function call(password: unknown) {
  const res = mockRes();
  await handler({ method: 'POST', body: { password } } as any, res);
  return res;
}

let fails = 0;
function check(name: string, cond: boolean) {
  console.log((cond ? 'OK    ' : 'FALLA ') + name);
  if (!cond) fails++;
}

async function main() {
  process.env.APP_PASSWORD = 'contrasena-larga-123';

  const ok = await call('contrasena-larga-123');
  check('password correcta -> 200 (sin tocar status)', ok.statusCode === 200);
  const token = (ok.body as any)?.token;
  check('devuelve un token largo', typeof token === 'string' && token.length >= 32);
  check('el token ya no es predecible', !String(token).startsWith('conciliaya_auth_'));

  const bad = await call('otra-cosa-distinta');
  check('password incorrecta -> 401', bad.statusCode === 401);

  const short = await call('x');
  check('password corta -> 401 sin reventar por largo distinto', short.statusCode === 401);

  const long = await call('contrasena-larga-123-y-mucho-mas-larga-todavia');
  check('password mas larga -> 401', long.statusCode === 401);

  const empty = await call('');
  check('password vacia -> 400', empty.statusCode === 400);

  const missing = await call(undefined);
  check('sin password -> 400', missing.statusCode === 400);

  const num = await call(12345);
  check('password no-string -> 400', num.statusCode === 400);

  const a = await call('contrasena-larga-123');
  const b = await call('contrasena-larga-123');
  check('dos logins dan tokens distintos', (a.body as any).token !== (b.body as any).token);

  const wrong = mockRes();
  await handler({ method: 'GET' } as any, wrong);
  check('GET -> 405', wrong.statusCode === 405);

  const noEnv = process.env.APP_PASSWORD;
  delete process.env.APP_PASSWORD;
  const cfg = await call('lo-que-sea');
  check('sin APP_PASSWORD -> 500', cfg.statusCode === 500);
  process.env.APP_PASSWORD = noEnv;

  console.log(fails ? `\n${fails} FALLOS` : '\ntodos los casos OK');
  process.exit(fails ? 1 : 0);
}

main();
