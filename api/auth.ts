import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, timingSafeEqual } from 'crypto';

// Comparacion en tiempo constante. `===` corta en el primer byte distinto, asi que
// el tiempo de respuesta filtra cuantos caracteres del inicio acerto quien prueba.
// Se rellenan ambos buffers al mismo largo para que el costo no dependa del input.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  const len = Math.max(ba.length, bb.length, 1);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  ba.copy(pa);
  bb.copy(pb);
  return timingSafeEqual(pa, pb) && ba.length === bb.length;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body: unknown = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const password = (body as { password?: unknown } | null | undefined)?.password;

  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Password required' });
  }

  const validPassword = process.env.APP_PASSWORD;

  if (!validPassword) {
    return res.status(500).json({ error: 'APP_PASSWORD not configured' });
  }

  if (safeEqual(password, validPassword)) {
    // El token anterior era 'conciliaya_auth_' + Date.now(): predecible y sin
    // entropia. Ahora se genera con el CSPRNG del sistema.
    //
    // OJO: hoy el cliente solo comprueba que la clave de sesion exista en
    // localStorage (ver src/App.tsx), asi que esto sigue siendo una barrera de UI,
    // no una sesion autenticada. Para que sea seguridad real hay que validar el
    // token en el servidor en cada endpoint que devuelva o modifique datos.
    return res.json({
      ok: true,
      token: randomBytes(32).toString('base64url'),
      issuedAt: Date.now(),
    });
  }

  return res.status(401).json({ ok: false, error: 'Invalid password' });
}
