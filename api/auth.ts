import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  const validPassword = process.env.APP_PASSWORD;

  if (!validPassword) {
    return res.status(500).json({ error: 'APP_PASSWORD not configured' });
  }

  if (password === validPassword) {
    return res.json({ ok: true, token: 'conciliaya_auth_' + Date.now() });
  }

  return res.status(401).json({ ok: false, error: 'Invalid password' });
}
