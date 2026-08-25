import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini AI client lazily
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI | null {
    if (!process.env.GEMINI_API_KEY) return null;
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiClient;
  }

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // AI Cryptic Reference Analysis Endpoint
  app.post('/api/analyze-cryptic', async (req, res) => {
    try {
      const { movement, clients = [], invoices = [] } = req.body;

      if (!movement || !movement.descripcion_cruda) {
        return res.status(400).json({ error: 'Falta la información del movimiento bancario.' });
      }

      const client = getGeminiClient();

      if (!client) {
        // Intelligent server-side fallback if GEMINI_API_KEY is not configured
        const rawDesc = String(movement.descripcion_cruda).toUpperCase();
        const amount = Number(movement.monto);

        // Check if any client has an alias or word in rawDesc
        let candidateClient = clients.find((c: any) => {
          const parts = c.name.toUpperCase().split(' ');
          return parts.some((p: string) => p.length > 3 && rawDesc.includes(p));
        });

        // Or search matching invoice amounts
        let candidateInvoice = invoices.find((i: any) => Math.abs(i.saldo_pendiente - amount) < 1);

        if (!candidateClient && candidateInvoice) {
          candidateClient = clients.find((c: any) => c.id === candidateInvoice.cliente_id);
        }

        return res.json({
          matchedClientId: candidateClient ? candidateClient.id : null,
          matchedClientName: candidateClient ? candidateClient.name : null,
          confidence: candidateClient ? 78 : 45,
          explanation: candidateClient 
            ? `Análisis heurístico avanzado: Se detectaron términos coincidentes con ${candidateClient.name} y patrones de monto en extracto.`
            : `Referencia bancaria compleja ("${movement.descripcion_cruda}"). Se sugiere verificar comprobante o asignar al cliente correspondiente.`,
          suggestedInvoices: candidateInvoice ? [candidateInvoice.id] : [],
          suggestedAmountToInvoices: candidateInvoice ? [{ invoiceId: candidateInvoice.id, amount: Math.min(amount, candidateInvoice.saldo_pendiente) }] : [],
          suggestedWithholding: 0,
          suggestedBankFee: 0,
          isAiPowered: false
        });
      }

      // Format payload for Gemini
      const prompt = `Eres el analista de conciliación bancaria y tesorería de una empresa de distribución e importación.
Tu tarea es analizar un movimiento bancario con descripción cruda o críptica y relacionarlo con el cliente y facturas pendientes más probables.

DATOS DEL MOVIMIENTO BANCARIO:
- Fecha: ${movement.fecha}
- Monto transferido: $${movement.monto} ${movement.moneda || 'UYU'}
- Descripción cruda del banco: "${movement.descripcion_cruda}"
- Referencia bancaria: "${movement.referencia || 'N/A'}"
- Banco de origen: "${movement.origen_banco || 'N/A'}"

PADRÓN DE CLIENTES DISPONIBLES:
${JSON.stringify(clients.map((c: any) => ({
  id: c.id,
  nombre: c.name,
  rut_ci: c.rut_ci,
  alias: c.alias_conocidos,
  saldo_deuda: c.currentBalance
})), null, 2)}

FACTURAS PENDIENTES EN CARTERA:
${JSON.stringify(invoices.filter((i: any) => i.saldo_pendiente > 0).map((i: any) => ({
  id: i.id,
  cliente_id: i.cliente_id,
  cliente_nombre: i.cliente_nombre,
  numero: i.numero,
  fecha: i.fecha,
  vencimiento: i.vencimiento,
  importe_total: i.importe,
  saldo_pendiente: i.saldo_pendiente,
  moneda: i.moneda || 'UYU'
})), null, 2)}

REGLAS DE ANÁLISIS:
1. Descifra abreviaturas bancarias comunes (ej: DEP = Depósito, TRF / TRANSF = Transferencia, SPI = Sistema de Pagos Interbancarios, DGI = Retención, SUC = Sucursal, CI = Cédula de Identidad, RUT = Registro Único Tributario).
2. Identifica si hay retenciones de impuestos (IVA/IRAE 1% a 3%) o comisiones bancarias si el monto transferido es un poco menor al total de la factura.
3. Si el importe coincide con una factura o suma de facturas de un cliente, tenlo muy en cuenta.
4. Devuelve un JSON estrictamente estructurado sin formato markdown adicional.`;

      const response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          systemInstruction: 'Eres un motor experto de conciliación bancaria y contabilidad corporativa. Responde siempre en JSON válido con las claves: matchedClientId (string o null), matchedClientName (string o null), confidence (numero 0-100), explanation (string en español claro), suggestedInvoices (array de ids de facturas), suggestedAmountToInvoices (array de objetos { invoiceId, amount }), suggestedWithholding (numero de retención fiscal estimada), suggestedBankFee (numero de comisión bancaria estimada).'
        }
      });

      const responseText = response.text || '{}';
      const parsed = JSON.parse(responseText);

      return res.json({
        ...parsed,
        isAiPowered: true
      });

    } catch (err: any) {
      console.error('Error en /api/gemini/analyze-cryptic:', err);
      return res.status(500).json({
        error: 'Error al procesar con IA: ' + (err.message || 'Desconocido'),
        fallback: true
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ConciliaYA Server running on http://localhost:${PORT}`);
  });
}

startServer();
