/**
 * Comparison harness: Our Matching Engine vs Claude's Gold Standard
 * 
 * Replicates the core matching logic from matchingEngine.ts in plain JS
 * to test against the real data and compare with Claude's reconciliation.
 */
const XLSX = require('xlsx');

// ============================================================================
// STEP 1: Parse data
// ============================================================================

// Parse invoices
const wbInv = XLSX.readFile('C:\\Users\\noiss\\Downloads\\facutas\\Facturas_Emitidas_Anonimizado (1).xlsx');
const wsInv = wbInv.Sheets[wbInv.SheetNames[0]];
const invData = XLSX.utils.sheet_to_json(wsInv, { header: 1, defval: '', raw: true });

const invoices = [];
invData.slice(1).forEach((row, idx) => {
  const num = String(row[2] || '').trim();
  if (!num || num === 'TOTAL' || num.includes('otal')) return;
  const monto = Number(row[10]) || 0;
  if (monto <= 0) return;
  
  const empresa = String(row[3] || '').trim();
  const razonSocial = String(row[4] || '').trim();
  const clienteProyecto = String(row[5] || '').trim();
  
  // Client name: use razonSocial if present, else empresa
  const clientName = razonSocial || empresa;
  
  // Parse date (Excel serial number)
  const fechaRaw = row[11];
  let fecha = '';
  if (typeof fechaRaw === 'number' && fechaRaw > 40000) {
    const d = new Date((fechaRaw - 25569) * 86400000);
    fecha = d.toISOString().split('T')[0];
  }
  
  invoices.push({
    id: `inv_${idx}_${num}`,
    numero: num,
    cliente_nombre: clientName,
    empresa,
    razonSocial,
    clienteProyecto,
    importe: monto,
    monto_con_iva: monto,
    saldo_pendiente: monto,
    moneda: 'USD',
    fecha,
    estado: 'pendiente',
    estado_conciliacion: 'pendiente',
    monto_cobrado: 0
  });
});

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
  
  // Parse date
  const fechaRaw = row[4];
  let fecha = '';
  if (typeof fechaRaw === 'number' && fechaRaw > 40000) {
    const d = new Date((fechaRaw - 25569) * 86400000);
    fecha = d.toISOString().split('T')[0];
  }
  
  movements.push({
    id: `mov_${idx}`,
    descripcion_cruda: concepto,
    monto,
    fecha,
    moneda: 'USD',
    tipo,
    es_credito: tipo.toUpperCase().includes('CR'),
    estado_conciliacion: 'pendiente'
  });
});

console.log(`Parsed: ${invoices.length} invoices, ${movements.length} movements (${movements.filter(m=>m.es_credito).length} credits)`);

// ============================================================================
// STEP 2: Create clients from invoices
// ============================================================================

// Group invoices by client name (razonSocial || empresa)
const clientMap = {};
invoices.forEach(inv => {
  const name = inv.cliente_nombre;
  if (!clientMap[name]) {
    clientMap[name] = {
      id: `client_${name.replace(/\s+/g, '_')}`,
      name,
      empresa: inv.empresa,
      razonSocial: inv.razonSocial,
      alias_conocidos: [],
      invoices: []
    };
  }
  clientMap[name].invoices.push(inv);
  
  // Add alternate names as aliases
  if (inv.empresa && inv.empresa !== name) {
    clientMap[name].alias_conocidos.push(inv.empresa.toUpperCase());
  }
  if (inv.clienteProyecto && inv.clienteProyecto !== name) {
    clientMap[name].alias_conocidos.push(inv.clienteProyecto.toUpperCase());
  }
  if (inv.razonSocial && inv.razonSocial !== name && inv.razonSocial !== inv.empresa) {
    clientMap[name].alias_conocidos.push(inv.razonSocial.toUpperCase());
  }
});

const clients = Object.values(clientMap);
console.log(`Clients: ${clients.length}`);
clients.forEach(c => {
  console.log(`  ${c.name}: ${c.invoices.length} invoices, aliases: [${c.alias_conocidos.join(', ')}]`);
});

// ============================================================================
// STEP 3: Replicate matching engine functions
// ============================================================================

function normalizeText(text) {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractClientNameFromBankDesc(desc) {
  let text = normalizeText(desc);
  const txPrefixes = ['PAGO', 'INVEST', 'INVERSIONES', 'DEP', 'DEPOSITO', 'ABONO', 'TRANSFERENCIA', 'TRANSF'];
  for (const pfx of txPrefixes) {
    if (text.startsWith(pfx + ' ')) {
      text = text.substring(pfx.length).trim();
      break;
    }
  }
  const txSuffixes = ['SALE', 'PAYS', 'ALQUILER', 'ALQUILERES'];
  for (const suf of txSuffixes) {
    const regex = new RegExp('\\s+' + suf + '\\s*$', 'i');
    if (regex.test(text)) {
      text = text.replace(regex, '').trim();
      break;
    }
  }
  const suffixPattern = /\b(SAS?|S\s*A|S\s*R\s*L|S\s*A\s*S|L\s*T\s*D\s*A|E\s*I\s*R\s*L)\b\.?\s+.+$/i;
  const m = text.match(suffixPattern);
  if (m) {
    text = (text.substring(0, text.indexOf(m[0])) + ' ' + m[1]).replace(/\s+/g, ' ').trim();
  }
  const slashMatch = desc.match(/^(.+?)\s*\/\d[\d\s]*$/i);
  if (slashMatch && slashMatch[1]) {
    let cleaned = normalizeText(slashMatch[1]).trim();
    for (const pfx of txPrefixes) {
      if (cleaned.startsWith(pfx + ' ')) {
        cleaned = cleaned.substring(pfx.length).trim();
        break;
      }
    }
    if (cleaned && cleaned.length >= 2) text = cleaned;
  }
  text = text.replace(/\s+\d{2,10}$/, '').trim();
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function stripBankNoise(text) {
  const norm = normalizeText(text);
  const prefixes = [
    'TRANSFERENCIA RECIBIDA DE', 'TRANSFERENCIA RECIBIDA', 'TRANSFERENCIA BANCARIA DE',
    'TRANSFERENCIA BANCARIA', 'TRANSFERENCIA DE', 'TRANSFERENCIA',
    'TRANSF ENTRE CTAS', 'TRANSF.ENTRE CTAS', 'TRF REC', 'TRF TERCEROS', 'TRF SPI',
    'TRF BANCARIA', 'TRF', 'PAGO DE CLIENTE', 'PAGO PROVEEDOR', 'PAGO FAC',
    'PAGO FACTURA', 'PAGO RECIBIDO', 'PAGO',
    'DEP.CON CHQS.AL COBRO', 'DEPOSITO CAJA EFECTIVO', 'DEPOSITO CAJA',
    'DEPOSITO EN EFECTIVO', 'DEPOSITO', 'CREDITO BANCARIO', 'CREDITO POR TRANSFERENCIA',
    'CREDITO', 'ABONO EN CUENTA', 'ABONO',
    'ITAU', 'BROU', 'SANTANDER', 'BBVA', 'SCOTIABANK', 'HSBC', 'BANCO'
  ];
  const suffixes = ['PAYS', 'SALE', 'ALQUILER', 'ALQUILERES'];
  let cleaned = norm;
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      if (cleaned.startsWith(prefix + ' ')) {
        cleaned = cleaned.substring(prefix.length).trim();
        changed = true;
        break;
      }
    }
  }
  for (const suf of suffixes) {
    if (cleaned.endsWith(' ' + suf)) {
      cleaned = cleaned.substring(0, cleaned.length - suf.length).trim();
    }
  }
  return cleaned;
}

function stringSimilarity(str1, str2) {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return Math.max(0.85, minLen / maxLen);
  }
  const tokens1 = new Set(s1.split(' ').filter(t => t.length > 2));
  const tokens2 = new Set(s2.split(' ').filter(t => t.length > 2));
  if (tokens1.size > 0 && tokens2.size > 0) {
    let intersection = 0;
    for (const t of tokens1) { if (tokens2.has(t)) intersection++; }
    const union = new Set([...tokens1, ...tokens2]).size;
    const tokenScore = union > 0 ? intersection / union : 0;
    if (tokenScore >= 0.5) return 0.75 + (tokenScore * 0.25);
  }
  // Levenshtein
  const a = s1, b = s2;
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  const maxLen = Math.max(s1.length, s2.length);
  return Math.max(0, 1 - matrix[b.length][a.length] / maxLen);
}

// ============================================================================
// STEP 4: Run OUR matching engine (per-movement, independent)
// ============================================================================

function matchBankMovement(mov, openInvoices, clientsList) {
  const rawDesc = mov.descripcion_cruda;
  const cleanDesc = stripBankNoise(rawDesc);
  const normDesc = normalizeText(rawDesc);
  const amount = mov.monto;
  
  // Filter open invoices
  const available = openInvoices.filter(i => i.saldo_pendiente > 0.01);
  if (available.length === 0) return null;
  
  // PASO 3: Client similarity matching
  const extractedName = extractClientNameFromBankDesc(rawDesc);
  const scoredClients = [];
  
  for (const client of clientsList) {
    let maxScore = 0;
    let reason = '';
    
    const extractedSim = stringSimilarity(extractedName, client.name);
    if (extractedSim > maxScore) { maxScore = extractedSim; reason = `extracted "${extractedName}" vs "${client.name}"`; }
    
    const nameScore = stringSimilarity(cleanDesc, client.name);
    if (nameScore > maxScore) { maxScore = nameScore; reason = `direct "${cleanDesc}" vs "${client.name}"`; }
    
    const normClientName = normalizeText(client.name);
    if (normClientName.length >= 3 && extractedName.includes(normClientName)) {
      if (0.95 > maxScore) { maxScore = 0.95; reason = `contains "${client.name}"`; }
    }
    if (extractedName.length >= 3 && normClientName.includes(extractedName)) {
      if (0.93 > maxScore) { maxScore = 0.93; reason = `contained by "${client.name}"`; }
    }
    
    for (const alias of client.alias_conocidos) {
      const aliasSim = stringSimilarity(extractedName, alias);
      if (aliasSim > maxScore) { maxScore = aliasSim; reason = `alias "${alias}"`; }
    }
    
    if (maxScore >= 0.55) {
      scoredClients.push({ client, score: maxScore, reason });
    }
  }
  
  scoredClients.sort((a, b) => b.score - a.score);
  if (scoredClients.length === 0) return null;
  
  const best = scoredClients[0];
  const clientInvoices = available.filter(i => i.cliente_nombre === best.client.name);
  
  if (clientInvoices.length === 0) return null;
  
  // Try exact single invoice match
  for (const inv of clientInvoices) {
    if (Math.abs(inv.saldo_pendiente - amount) < 1) {
      return { client: best.client.name, score: best.score, type: 'exact', invoices: [inv.numero], amounts: [inv.saldo_pendiente] };
    }
  }
  
  // Try multi-invoice combination (sum of invoice balances = movement amount)
  // Sort by saldo desc for combination search
  const sorted = [...clientInvoices].sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);
  // Try combinations up to size 5
  for (let size = 2; size <= Math.min(5, sorted.length); size++) {
    const combo = combineDFS(sorted, size, 0, 0, amount, []);
    if (combo) {
      return { client: best.client.name, score: best.score, type: 'multi_exact', invoices: combo.map(c => c.numero), amounts: combo.map(c => c.saldo_pendiente) };
    }
  }
  
  // FIFO distribution (oldest first)
  const sortedByDate = [...clientInvoices].sort((a, b) => {
    const da = a.fecha ? new Date(a.fecha).getTime() : 0;
    const db = b.fecha ? new Date(b.fecha).getTime() : 0;
    return da - db;
  });
  
  if (amount < sortedByDate[0].saldo_pendiente) {
    // Partial payment on oldest
    return { client: best.client.name, score: best.score, type: 'partial', invoices: [sortedByDate[0].numero], amounts: [amount] };
  } else {
    // FIFO distribution
    let remaining = amount;
    const allocated = [];
    for (const inv of sortedByDate) {
      if (remaining <= 0) break;
      const apply = Math.min(inv.saldo_pendiente, remaining);
      allocated.push({ numero: inv.numero, amount: apply });
      remaining -= apply;
    }
    return {
      client: best.client.name,
      score: best.score,
      type: remaining > 0 ? 'fifo_overpay' : 'fifo',
      invoices: allocated.map(a => a.numero),
      amounts: allocated.map(a => a.amount),
      overpay: remaining
    };
  }
}

function combineDFS(sorted, size, start, currentSum, target, current) {
  if (current.length === size) {
    return Math.abs(currentSum - target) < 1 ? [...current] : null;
  }
  for (let i = start; i < sorted.length; i++) {
    const newSum = currentSum + sorted[i].saldo_pendiente;
    if (newSum > target + 1) continue;
    const result = combineDFS(sorted, size, i + 1, newSum, target, [...current, sorted[i]]);
    if (result) return result;
  }
  return null;
}

// ============================================================================
// STEP 5: Run our engine (per-movement, independent matching)
// ============================================================================

console.log('\n=== RUNNING OUR MATCHING ENGINE (per-movement) ===');

const creditMovements = movements.filter(m => m.es_credito);
const ourResults = [];
let matchCount = 0;
let noMatchCount = 0;

// Track which invoices get matched (simulate saldo reduction)
const invoiceSaldo = {};
invoices.forEach(inv => { invoiceSaldo[inv.numero] = inv.monto_con_iva; });

for (const mov of creditMovements) {
  // Create open invoices snapshot
  const openInvoices = invoices.filter(i => invoiceSaldo[i.numero] > 0.01).map(i => ({
    ...i,
    saldo_pendiente: invoiceSaldo[i.numero]
  }));
  
  const result = matchBankMovement(mov, openInvoices, clients);
  
  if (result) {
    matchCount++;
    // Reduce saldo for matched invoices
    result.invoices.forEach((num, idx) => {
      invoiceSaldo[num] -= result.amounts[idx];
    });
    ourResults.push({ mov: mov.descripcion_cruda, monto: mov.monto, ...result });
  } else {
    noMatchCount++;
    ourResults.push({ mov: mov.descripcion_cruda, monto: mov.monto, client: null, type: 'unmatched' });
  }
}

console.log(`Matched: ${matchCount}, Unmatched: ${noMatchCount}`);
console.log('\n=== OUR RESULTS ===');
ourResults.forEach(r => {
  if (r.type === 'unmatched') {
    console.log(`  UNMATCHED: "${r.mov}" $${r.monto}`);
  } else {
    console.log(`  ${r.type.toUpperCase()}: "${r.mov}" $${r.monto} → ${r.client} [${r.invoices.join('+')}] score=${r.score?.toFixed(2)}`);
  }
});

// ============================================================================
// STEP 6: Load Claude's results for comparison
// ============================================================================

console.log('\n\n=== LOADING CLAUDE RESULTS ===');
const wbClaude = XLSX.readFile('C:\\Users\\noiss\\Downloads\\facutas\\Conciliacion_Bancaria_Facturas.xlsx');
const wsC = wbClaude.Sheets['Conciliación por Factura'];
const dataC = XLSX.utils.sheet_to_json(wsC, { header: 1, defval: '', raw: true });
const claudeRows = dataC.slice(3).filter(r => r[0] && r[1] && r[0] !== 'TOTAL');

const claudeByInv = {};
claudeRows.forEach(r => {
  claudeByInv[String(r[1])] = {
    cliente: r[0],
    montoCobrado: Number(r[8]),
    saldo: Number(r[9]),
    estado: r[10],
    tx: r[12]
  };
});

// Claude's unmatched movements
const wsUnmatched = wbClaude.Sheets['Movimientos sin Factura'];
const unmatchData = XLSX.utils.sheet_to_json(wsUnmatched, { header: 1, defval: '', raw: true });
const claudeUnmatched = unmatchData.slice(4).filter(r => r[0] && r[0] !== 'TOTAL');

// ============================================================================
// STEP 7: Compare invoice-by-invoice
// ============================================================================

console.log('\n\n=== INVOICE-BY-INVOICE COMPARISON ===');

let matchExact = 0;
let matchPartial = 0;
let matchDifferent = 0;
let claudeMatchedWeDidnt = 0;
let weMatchedClaudeDidnt = 0;
const differences = [];

for (const inv of invoices) {
  const claudeResult = claudeByInv[inv.numero];
  const ourSaldo = invoiceSaldo[inv.numero];
  const ourCobrado = inv.monto_con_iva - ourSaldo;
  
  if (claudeResult) {
    const claudeCobrado = claudeResult.montoCobrado;
    const diff = Math.abs(ourCobrado - claudeCobrado);
    
    if (diff < 1) {
      matchExact++;
    } else if (diff < 10) {
      matchPartial++;
    } else {
      matchDifferent++;
      differences.push({
        invoice: inv.numero,
        client: inv.cliente_nombre,
        ourCobrado: ourCobrado.toFixed(2),
        claudeCobrado: claudeCobrado.toFixed(2),
        diff: diff.toFixed(2),
        claudeEstado: claudeResult.estado,
        claudeTx: claudeResult.tx
      });
    }
  }
}

console.log(`\nExact match (diff < $1): ${matchExact}`);
console.log(`Close match (diff < $10): ${matchPartial}`);
console.log(`Different (diff >= $10): ${matchDifferent}`);

if (differences.length > 0) {
  console.log('\n=== DIFFERENCES ===');
  differences.forEach(d => {
    console.log(`\n  ${d.invoice} (${d.client}):`);
    console.log(`    Ours: $${d.ourCobrado} | Claude: $${d.claudeCobrado} | Diff: $${d.diff}`);
    console.log(`    Claude estado: ${d.claudeEstado} | Tx: ${d.claudeTx}`);
  });
}

// ============================================================================
// STEP 8: Summary
// ============================================================================

console.log('\n\n========== SUMMARY ==========');
console.log(`Our engine: ${matchCount} matched, ${noMatchCount} unmatched out of ${creditMovements.length} credit movements`);
console.log(`Invoice comparison: ${matchExact} exact, ${matchPartial} close, ${matchDifferent} different out of ${invoices.length} invoices`);
console.log(`Claude matched 47/56 movements, 72/116 invoices (58 COBRADO + 14 PARCIAL)`);
console.log(`Claude excluded: 6 Invest + 2 bounced checks + 1 overpayment = 9 legitimate unmatched`);
