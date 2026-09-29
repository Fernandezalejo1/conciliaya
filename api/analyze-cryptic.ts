import type { VercelRequest, VercelResponse } from '@vercel/node';
export default function handler(_req:VercelRequest,res:VercelResponse){
  res.status(410).json({error:'Análisis externo eliminado. Usá el motor local de reglas y alias.'});
}
