// Los tipos de Vercel se declaran acá en vez de importarlos de @vercel/node.
// Esa paquete era devDependency únicamente por este import, y arrastraba tres
// vulnerabilidades altas (undici, path-to-regexp, ajv) más una moderada (ajv)
// que no llegan a producción: Vercel compila api/ con su propio builder.
type VercelRequest = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};
type VercelResponse = {
  status(code: number): VercelResponse;
  json(payload: unknown): void;
};

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(410).json({error:'Análisis externo eliminado. Usá el motor local de reglas y alias.'});
}
