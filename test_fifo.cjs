/**
 * Test FIFO v6 — with improved Cardinal sub-pool (excludes Cordero SA minority group)
 */
const XLSX = require('xlsx');
function normalizeText(t) { if (!t) return ''; return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function stringSimilarity(s1, s2) {
  s1 = normalizeText(s1); s2 = normalizeText(s2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) { const mn = Math.min(s1.length, s2.length), mx = Math.max(s1.length, s2.length); return Math.max(0.85, mn / mx); }
  const t1 = new Set(s1.split(' ').filter(t => t.length > 2)), t2 = new Set(s2.split(' ').filter(t => t.length > 2));
  if (t1.size > 0 && t2.size > 0) { let ix = 0; for (const t of t1) { if (t2.has(t)) ix++; } const u = new Set([...t1, ...t2]).size; const ts = u > 0 ? ix / u : 0; if (ts >= 0.5) return 0.75 + (ts * 0.25); }
  const a = s1, b = s2; const mx = Array.from({length: b.length+1}, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) mx[0][j] = j;
  for (let i = 1; i <= b.length; i++) { for (let j = 1; j <= a.length; j++) { mx[i][j] = b.charAt(i-1) === a.charAt(j-1) ? mx[i-1][j-1] : Math.min(mx[i-1][j-1]+1, mx[i][j-1]+1, mx[i-1][j]+1); } }
  return Math.max(0, 1 - mx[b.length][a.length] / Math.max(s1.length, s2.length));
}

// Parse invoices
const wbInv = XLSX.readFile('C:\\Users\\noiss\\Downloads\\facutas\\Facturas_Emitidas_Anonimizado (1).xlsx');
const wsInv = wbInv.Sheets[wbInv.SheetNames[0]];
const invData = XLSX.utils.sheet_to_json(wsInv, { header: 1, defval: '', raw: true });
const rawRows = [];
invData.slice(1).forEach(row => {
  const num = String(row[2] || '').trim();
  if (!num || num === 'TOTAL' || num.includes('otal')) return;
  const monto = Number(row[10]) || 0;
  if (monto <= 0) return;
  rawRows.push({ num, empresa: String(row[3] || '').trim(), razonSocial: String(row[4] || '').trim(), clienteProyecto: String(row[5] || '').trim(), monto });
});

const invoiceMap = new Map();
for (const r of rawRows) {
  const existing = invoiceMap.get(r.num);
  if (existing) { existing.importe += r.monto; existing.saldo_pendiente += r.monto; }
  else {
    const altNames = [];
    if (r.razonSocial && r.razonSocial !== r.empresa) altNames.push(r.razonSocial.toUpperCase());
    if (r.clienteProyecto && r.clienteProyecto !== r.empresa) altNames.push(r.clienteProyecto.toUpperCase());
    invoiceMap.set(r.num, { id: `inv_${r.num}`, numero: r.num, cliente_nombre: r.empresa, altNames, importe: r.monto, saldo_pendiente: r.monto, moneda: 'USD', fecha: '' });
  }
}
const invoices = Array.from(invoiceMap.values());

// Parse bank movements
const wbBank = XLSX.readFile('C:\\Users\\noiss\\Downloads\\facutas\\Cashflow_Anonimizado(1).xlsx');
const wsBank = wbBank.Sheets[wbBank.SheetNames[0]];
const bankData = XLSX.utils.sheet_to_json(wsBank, { header: 1, defval: '', raw: true });
const movements = [];
bankData.slice(1).forEach((row, idx) => {
  const concepto = String(row[1] || '').trim();
  const tipo = String(row[3] || '').trim();
  const monto = Number(row[5]) || 0;
  if (!concepto || concepto === 'TOTAL' || concepto.includes('otal')) return;
  movements.push({ id: `mov_${idx}`, concepto, monto, es_credito: tipo.toUpperCase().includes('CR') });
});

// Create clients
const clientMap = {};
invoices.forEach(inv => {
  const name = inv.cliente_nombre;
  if (!clientMap[name]) clientMap[name] = { id: `client_${name.replace(/[^A-Z0-9]/gi, '_')}`, name, alias_conocidos: [] };
  for (const alt of inv.altNames) { if (!clientMap[name].alias_conocidos.includes(alt)) clientMap[name].alias_conocidos.push(alt); }
});
const clients = Object.values(clientMap);

function extractClientNameFromBankDesc(desc) {
  let text = normalizeText(desc);
  const txPrefixes = ['PAGO', 'INVEST', 'INVERSIONES', 'DEP', 'DEPOSITO', 'ABONO', 'TRANSFERENCIA', 'TRANSF'];
  for (const pfx of txPrefixes) { if (text.startsWith(pfx + ' ')) { text = text.substring(pfx.length).trim(); break; } }
  const txSuffixes = ['SALE', 'PAYS', 'ALQUILER', 'ALQUILERES'];
  for (const suf of txSuffixes) { const r = new RegExp('\\s+' + suf + '\\s*$', 'i'); if (r.test(text)) { text = text.replace(r, '').trim(); break; } }
  const suffixPattern = /\b(SAS?|S\s*A|S\s*R\s*L|S\s*A\s*S|L\s*T\s*D\s*A|E\s*I\s*R\s*L)\b\.?\s+.+$/i;
  const m = text.match(suffixPattern);
  if (m) text = (text.substring(0, text.indexOf(m[0])) + ' ' + m[1]).replace(/\s+/g, ' ').trim();
  const slashMatch = desc.match(/^(.+?)\s*\/\d[\d\s]*$/i);
  if (slashMatch && slashMatch[1]) { let c = normalizeText(slashMatch[1]).trim(); for (const pfx of txPrefixes) { if (c.startsWith(pfx + ' ')) { c = c.substring(pfx.length).trim(); break; } } if (c && c.length >= 2) text = c; }
  text = text.replace(/\s+\d{2,10}$/, '').trim().replace(/\s+/g, ' ').trim();
  return text;
}
function stripBankNoise(text) {
  const norm = normalizeText(text);
  const prefixes = ['TRANSFERENCIA RECIBIDA DE','TRANSFERENCIA RECIBIDA','TRANSFERENCIA BANCARIA DE','TRANSFERENCIA BANCARIA','TRANSFERENCIA DE','TRANSFERENCIA','TRANSF ENTRE CTAS','TRANSF.ENTRE CTAS','TRF REC','TRF TERCEROS','TRF SPI','TRF BANCARIA','TRF','PAGO DE CLIENTE','PAGO PROVEEDOR','PAGO FAC','PAGO FACTURA','PAGO RECIBIDO','PAGO','DEP.CON CHQS.AL COBRO','DEPOSITO CAJA EFECTIVO','DEPOSITO CAJA','DEPOSITO EN EFECTIVO','DEPOSITO','CREDITO BANCARIO','CREDITO POR TRANSFERENCIA','CREDITO','ABONO EN CUENTA','ABONO','ITAU','BROU','SANTANDER','BBVA','SCOTIABANK','HSBC','BANCO'];
  const suffixes = ['PAYS','SALE','ALQUILER','ALQUILERES'];
  let cleaned = norm; let changed = true;
  while (changed) { changed = false; for (const prefix of prefixes) { if (cleaned.startsWith(prefix + ' ')) { cleaned = cleaned.substring(prefix.length).trim(); changed = true; break; } } }
  for (const suf of suffixes) { if (cleaned.endsWith(' ' + suf)) cleaned = cleaned.substring(0, cleaned.length - suf.length).trim(); }
  return cleaned;
}
const KNOWN_MISMATCHES = { 'TRANSCOM': 'LARRAÑAGA' };

function getSubPool(allClientInvoices, extractedName, client) {
  const extractedNorm = normalizeText(extractedName);
  const matchingAltInvoices = allClientInvoices.filter(i => {
    const alts = (i.altNames || []).map(a => normalizeText(a));
    return alts.some(a => a.length >= 3 && stringSimilarity(extractedName, a) > 0.7);
  });
  if (matchingAltInvoices.length > 0 && matchingAltInvoices.length < allClientInvoices.length) {
    return matchingAltInvoices;
  }
  if (matchingAltInvoices.length === 0) {
    const normClient = normalizeText(client.name);
    const paymentMatchesParent = extractedNorm === normClient ||
      stringSimilarity(extractedNorm, normClient) > 0.7 ||
      extractedNorm.includes(normClient) || normClient.includes(extractedNorm);
    if (paymentMatchesParent) {
      const coreGroups = new Map();
      for (const i of allClientInvoices) {
        const alts = (i.altNames || []).map(a => normalizeText(a));
        if (alts.length > 0) {
          const core = alts[0].replace(/\s*\(.*?\)\s*/g, '').replace(/\b(SAS?|S\s*A|S\s*R\s*L|S\s*A\s*S|L\s*T\s*D\s*A|E\s*I\s*R\s*L)\b\.?\s*/gi, '').trim();
          if (core.length >= 3) coreGroups.set(core, (coreGroups.get(core) || 0) + 1);
        }
      }
      if (coreGroups.size > 1) {
        const sorted = [...coreGroups.entries()].sort((a, b) => b[1] - a[1]);
        const dominantCore = sorted[0][0];
        const dominantCount = sorted[0][1];
        const totalCount = [...coreGroups.values()].reduce((a, b) => a + b, 0);
        if (dominantCount > totalCount * 0.5) {
          const domTokens = dominantCore.split(' ').filter(t => t.length > 3);
          const extTokens = extractedNorm.split(' ').filter(t => t.length > 3);
          const sharesToken = domTokens.some(dt => extTokens.some(et => dt === et || dt.includes(et) || et.includes(dt)));
          if (sharesToken) {
            const filtered = allClientInvoices.filter(i => {
              const alts = (i.altNames || []).map(a => normalizeText(a));
              if (alts.length === 0) return true;
              const core = alts[0].replace(/\s*\(.*?\)\s*/g, '').replace(/\b(SAS?|S\s*A|S\s*R\s*L|S\s*A\s*S|L\s*T\s*D\s*A|E\s*I\s*R\s*L)\b\.?\s*/gi, '').trim();
              if (core.length < 3) return true;
              return stringSimilarity(core, dominantCore) > 0.5 || core.includes(dominantCore) || dominantCore.includes(core);
            });
            if (filtered.length > 0) return filtered;
          }
        }
      }
    }
  }
  return allClientInvoices;
}

// FIFO
const creditMovs = movements.filter(m => m.es_credito && m.monto > 0);
const clientMovements = new Map();
const unmatchedMovements = [];
for (const mov of creditMovs) {
  let extractedName = extractClientNameFromBankDesc(mov.concepto);
  for (const [bankKey, clientKey] of Object.entries(KNOWN_MISMATCHES)) {
    if (normalizeText(mov.concepto).includes(normalizeText(bankKey))) { extractedName = normalizeText(clientKey); break; }
  }
  let bestClient = null, bestScore = 0;
  for (const client of clients) {
    let score = 0;
    const ns = stringSimilarity(extractedName, client.name); if (ns > score) score = ns;
    const ds = stringSimilarity(stripBankNoise(mov.concepto), client.name); if (ds > score) score = ds;
    const nc = normalizeText(client.name);
    if (nc.length >= 3 && extractedName.includes(nc)) if (0.95 > score) score = 0.95;
    if (extractedName.length >= 3 && nc.includes(extractedName)) if (0.93 > score) score = 0.93;
    if (client.alias_conocidos) { for (const a of client.alias_conocidos) { const as = stringSimilarity(extractedName, a); if (as > score) score = as; } }
    if (score > bestScore && score >= 0.55) { bestScore = score; bestClient = client; }
  }
  if (bestClient) {
    if (!clientMovements.has(bestClient.id)) clientMovements.set(bestClient.id, []);
    clientMovements.get(bestClient.id).push({ mov, extractedName });
  } else { unmatchedMovements.push(mov); }
}

const results = new Map();
for (const [clientId, movEntries] of clientMovements) {
  const client = clients.find(c => c.id === clientId);
  if (!client) continue;
  movEntries.sort((a, b) => (a.mov.fecha ? new Date(a.mov.fecha).getTime() : 0) - (b.mov.fecha ? new Date(b.mov.fecha).getTime() : 0));
  const clientNorm = normalizeText(client.name);
  const allClientInvoices = invoices
    .filter(i => { if (i.saldo_pendiente <= 0.01) return false; if (normalizeText(i.cliente_nombre) === clientNorm) return true; if (i.altNames && i.altNames.some(a => normalizeText(a) === clientNorm)) return true; if (stringSimilarity(i.cliente_nombre, clientNorm) > 0.85) return true; return false; })
    .sort((a, b) => (a.fecha ? new Date(a.fecha).getTime() : 0) - (b.fecha ? new Date(b.fecha).getTime() : 0));
  const invoiceRemaining = new Map();
  for (const inv of allClientInvoices) invoiceRemaining.set(inv.numero, inv.saldo_pendiente);
  for (const { mov, extractedName } of movEntries) {
    const poolInvoices = getSubPool(allClientInvoices, extractedName, client);
    let remaining = mov.monto;
    const allocated = [];
    for (const inv of poolInvoices) {
      if (remaining <= 0.01) break;
      const ir = invoiceRemaining.get(inv.numero) || 0;
      if (ir <= 0.01) continue;
      const apply = Math.min(ir, remaining);
      allocated.push({ numero: inv.numero, amount: apply });
      invoiceRemaining.set(inv.numero, ir - apply);
      remaining -= apply;
    }
    results.set(mov.id, { client: client.name, allocated, overpay: remaining, type: remaining > 0.01 ? 'overpay' : (allocated.length === 1 ? 'exact' : 'fifo') });
  }
}
for (const mov of unmatchedMovements) results.set(mov.id, { client: null, type: 'unmatched', allocated: [], overpay: 0 });

console.log('\n=== FIFO ALLOCATION RESULTS ===');
let matchedCount = 0, unmatchedCount = 0;
for (const mov of creditMovs) {
  const r = results.get(mov.id);
  if (!r || r.type === 'unmatched') { unmatchedCount++; console.log(`  UNMATCHED: "${mov.concepto}" $${mov.monto}`); }
  else { matchedCount++; const allocStr = r.allocated.map(a => `${a.numero}($${a.amount.toFixed(2)})`).join(' + '); console.log(`  ${r.type.toUpperCase()}: "${mov.concepto}" $${mov.monto} → ${r.client} [${allocStr}]${r.overpay > 0.01 ? ` OVER=$${r.overpay.toFixed(2)}` : ''}`); }
}
console.log(`\nMatched: ${matchedCount}, Unmatched: ${unmatchedCount}`);

// Compare with Claude
const wbClaude = XLSX.readFile('C:\\Users\\noiss\\Downloads\\facutas\\Conciliacion_Bancaria_Facturas.xlsx');
const wsC = wbClaude.Sheets['Conciliación por Factura'];
const dataC = XLSX.utils.sheet_to_json(wsC, { header: 1, defval: '', raw: true });
const claudeRows = dataC.slice(3).filter(r => r[0] && r[1] && r[0] !== 'TOTAL');
const claudeByInv = {};
claudeRows.forEach(r => { claudeByInv[String(r[1])] = { montoCobrado: Number(r[8]), estado: r[10] }; });
const invoiceCobrado = {};
for (const inv of invoices) invoiceCobrado[inv.numero] = 0;
for (const [, r] of results) { if (r.allocated) { for (const a of r.allocated) { invoiceCobrado[a.numero] = (invoiceCobrado[a.numero] || 0) + a.amount; } } }

console.log('\n\n=== INVOICE-BY-INVOICE COMPARISON ===');
let exact = 0, close = 0, diff = 0;
const differences = [];
for (const inv of invoices) {
  const claude = claudeByInv[inv.numero];
  const ours = invoiceCobrado[inv.numero] || 0;
  if (claude) { const d = Math.abs(ours - claude.montoCobrado); if (d < 1) exact++; else if (d < 10) close++; else { diff++; differences.push({ i: inv.numero, c: inv.cliente_nombre, o: ours.toFixed(2), cl: claude.montoCobrado.toFixed(2), d: d.toFixed(2), e: claude.estado }); } }
  else if (ours > 0.01) { diff++; differences.push({ i: inv.numero, c: inv.cliente_nombre, o: ours.toFixed(2), cl: 'N/A', d: '-', e: 'NOT_IN_CLAUDE' }); }
}
console.log(`Exact: ${exact} | Close: ${close} | Diff: ${diff} | Total: ${exact+close}/${invoices.length} (${((exact+close)/invoices.length*100).toFixed(1)}%)`);
if (differences.length > 0) { console.log('\nDIFFERENCES:'); differences.forEach(d => console.log(`  ${d.i} (${d.c}): Ours=$${d.o} Claude=$${d.cl} Δ=$${d.d} [${d.e}]`)); }
console.log(`\nSUMMARY: ${matchedCount}/${creditMovs.length} matched | ${exact+close}/${invoices.length} invoices correct`);
