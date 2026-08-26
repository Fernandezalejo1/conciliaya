import { BankMovement, Client, ClientCredit, Company, Invoice, LearnedAlias, PaymentApplication, SuggestedMatch } from '../types';

/**
 * Extracts clean client name from bank description by removing all noise:
 * prefixes (PAGO, INVEST), suffixes (SALE, ALQUILER, PAYS), legal entity
 * types + addresses, slash references, trailing digits.
 *
 * This is the KEY function that makes reconciliation work with messy data.
 */
export function extractClientNameFromBankDesc(desc: string): string {
  let text = normalizeText(desc);

  // 1. Strip common transaction prefixes (PAGO, INVEST, etc.)
  const txPrefixes = ['PAGO', 'INVEST', 'INVERSIONES', 'DEP', 'DEPOSITO', 'ABONO', 'TRANSFERENCIA', 'TRANSF'];
  for (const pfx of txPrefixes) {
    if (text.startsWith(pfx + ' ')) {
      text = text.substring(pfx.length).trim();
      break;
    }
  }

  // 2. Strip common transaction suffixes (SALE, ALQUILER, PAYS, etc.)
  const txSuffixes = ['SALE', 'PAYS', 'ALQUILER', 'ALQUILERES'];
  for (const suf of txSuffixes) {
    const regex = new RegExp('\\s+' + suf + '\\s*$', 'i');
    if (regex.test(text)) {
      text = text.replace(regex, '').trim();
      break;
    }
  }

  // 3. After legal entity suffix: strip everything after (addresses, refs)
  // "PILARES SA VAZQUEZ LEDESMA 295" → "PILARES SA"
  // "EOLIA CONSTRUCCIONES S.A. /35" → "EOLIA CONSTRUCCIONES S.A."
  const suffixPattern = /\b(SAS?|S\s*A|S\s*R\s*L|S\s*A\s*S|L\s*T\s*D\s*A|E\s*I\s*R\s*L)\b\.?\s+.+$/i;
  const m = text.match(suffixPattern);
  if (m) {
    text = (text.substring(0, text.indexOf(m[0])) + ' ' + m[1]).replace(/\s+/g, ' ').trim();
  }

  // 4. Slash + reference number: "SOLVENTA SA /4096546" → "SOLVENTA SA"
  // Use text (prefix-stripped) via normalized desc to avoid restoring stripped prefixes
  const slashMatch = desc.match(/^(.+?)\s*\/\d[\d\s]*$/i);
  if (slashMatch && slashMatch[1]) {
    let cleaned = normalizeText(slashMatch[1]).trim();
    // Also strip transaction prefixes from slash result (in case desc has PAGO etc.)
    for (const pfx of txPrefixes) {
      if (cleaned.startsWith(pfx + ' ')) {
        cleaned = cleaned.substring(pfx.length).trim();
        break;
      }
    }
    if (cleaned && cleaned.length >= 2) text = cleaned;
  }

  // 5. Trailing digits (addresses, refs): "BRISOL SA 123" → "BRISOL SA"
  text = text.replace(/\s+\d{2,10}$/, '').trim();

  // 6. Remove double spaces
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Normalized string cleaner: removes accents, symbols, non-alphanumeric noise,
 * and common banking stop words.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remove standard business suffixes (SA, SRL, LTDA, SAS, etc.) and bank noise
 */
export function cleanBusinessName(name: string): string {
  const norm = normalizeText(name);
  const suffixes = [
    'S A',
    'S R L',
    'S A S',
    'L T D A',
    'LTDA',
    'SRL',
    'SA',
    'SAS',
    'E I R L',
    'EIRL',
    'S C A',
    'S EN C',
    'CIA',
    'COMPANIA',
    'SUCURSAL',
    'SUC'
  ];

  let cleaned = norm;
  for (const suf of suffixes) {
    const reg = new RegExp(`\\b${suf}\\b`, 'g');
    cleaned = cleaned.replace(reg, ' ');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function stripBankNoise(text: string): string {
  const norm = normalizeText(text);
  const prefixes = [
    'TRANSFERENCIA RECIBIDA DE',
    'TRANSFERENCIA RECIBIDA',
    'TRANSFERENCIA BANCARIA DE',
    'TRANSFERENCIA BANCARIA',
    'TRANSFERENCIA DE',
    'TRANSFERENCIA',
    'TRANSF ENTRE CTAS',
    'TRANSF.ENTRE CTAS',
    'TRF REC',
    'TRF TERCEROS',
    'TRF SPI',
    'TRF BANCARIA',
    'TRF',
    'PAGO DE CLIENTE',
    'PAGO PROVEEDOR',
    'PAGO FAC',
    'PAGO FACTURA',
    'PAGO RECIBIDO',
    'PAGO',
    'DEP.CON CHQS.AL COBRO',
    'DEPOSITO CAJA EFECTIVO',
    'DEPOSITO CAJA',
    'DEPOSITO EN EFECTIVO',
    'DEPOSITO',
    'CREDITO BANCARIO',
    'CREDITO POR TRANSFERENCIA',
    'CREDITO',
    'ABONO EN CUENTA',
    'ABONO',
    'ITAU',
    'BROU',
    'SANTANDER',
    'BBVA',
    'SCOTIABANK',
    'HSBC',
    'BANCO'
  ];

  const suffixes = [
    'PAYS',
    'SALE',
    'ALQUILER',
    'ALQUILERES'
  ];

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

/**
 * Calculates Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Computes string similarity score between 0.0 and 1.0
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  // Substring bonus
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return Math.max(0.85, minLen / maxLen);
  }

  // Token overlap (Jaccard on words)
  const tokens1 = new Set(s1.split(' ').filter(t => t.length > 2));
  const tokens2 = new Set(s2.split(' ').filter(t => t.length > 2));
  
  if (tokens1.size > 0 && tokens2.size > 0) {
    let intersection = 0;
    for (const t of tokens1) {
      if (tokens2.has(t)) intersection++;
    }
    const union = new Set([...tokens1, ...tokens2]).size;
    const tokenScore = union > 0 ? intersection / union : 0;
    if (tokenScore >= 0.5) {
      return 0.75 + (tokenScore * 0.25);
    }
  }

  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Extracts possible invoice numbers from raw text
 * e.g. "FAC-1042", "F1042", "1042", "A6", "A10", "EXP-450", "/4096546"
 */
export function extractInvoiceTokens(text: string): string[] {
  const norm = normalizeText(text);
  const results = new Set<string>();

  // Pattern 1: Standard invoice prefixes (FAC, F, FACTURA, INV, NC, EXP) + number
  const stdMatches = norm.match(/\b(?:FAC|F|FACTURA|INV|NC|EXP)?[- ]?(\d{3,8})\b/gi) || [];
  for (const m of stdMatches) {
    const cleanNum = m.replace(/[^0-9]/g, '');
    if (cleanNum && cleanNum.length >= 3) {
      results.add(cleanNum);
      results.add(m.trim());
    }
  }

  // Pattern 2: Letter-prefix invoice numbers (A6, A10, B12, etc.) — common in Uruguayan SMEs
  const letterMatches = norm.match(/\b([A-Z]{1,3})[- ]?(\d{1,6})\b/g) || [];
  for (const m of letterMatches) {
    const parts = m.match(/^([A-Z]{1,3})[- ]?(\d{1,6})$/);
    if (parts) {
      const prefix = parts[1];
      const num = parts[2];
      // Only add if prefix looks like an invoice series (single/double letter)
      if (prefix.length <= 2 && num.length >= 1) {
        results.add(`${prefix}${num}`);
        results.add(`${prefix}-${num}`);
        results.add(num);
      }
    }
  }

  // Pattern 3: REMOVED — slash-references like "/35", "/4096546" are bank client codes,
  // NOT invoice numbers. They cause cross-client false matches (e.g., "/35" → A135).

  return Array.from(results);
}

/**
 * Subset-sum helper to find combinations of open invoices that sum up exactly to the movement amount
 */
export function findInvoiceCombination(invoices: Invoice[], targetAmount: number): Invoice[] | null {
  const sorted = [...invoices].filter(i => i.saldo_pendiente > 0).sort((a, b) => {
    const bTotal = Math.min(b.monto_con_iva || b.importe, b.saldo_pendiente);
    const aTotal = Math.min(a.monto_con_iva || a.importe, a.saldo_pendiente);
    return bTotal - aTotal;
  });
  if (sorted.length === 0) return null;

  // Single invoice exact — compare against min(monto_con_iva, saldo_pendiente)
  const single = sorted.find(i => {
    const effective = Math.min(i.monto_con_iva || i.importe, i.saldo_pendiente);
    return Math.abs(effective - targetAmount) < 0.01;
  });
  if (single) return [single];

  // Try 2 to 5 invoices combinations (DFS for efficiency)
  const n = Math.min(sorted.length, 10);
  for (let size = 2; size <= Math.min(5, n); size++) {
    const found = combineDFS(sorted, n, size, 0, 0, targetAmount, []);
    if (found) return found;
  }

  return null;
}

function combineDFS(sorted: Invoice[], n: number, size: number, start: number, currentSum: number, target: number, current: Invoice[]): Invoice[] | null {
  if (current.length === size) {
    return Math.abs(currentSum - target) < 0.01 ? current : null;
  }
  const remaining = size - current.length;
  for (let i = start; i <= n - remaining; i++) {
    const effective = Math.min(sorted[i].monto_con_iva || sorted[i].importe, sorted[i].saldo_pendiente);
    const newSum = currentSum + effective;
    // Prune: if adding the smallest remaining still exceeds target + tolerance, skip
    if (newSum > target + 0.01 && current.length < size - 1) continue;
    const result = combineDFS(sorted, n, size, i + 1, newSum, target, [...current, sorted[i]]);
    if (result) return result;
  }
  return null;
}

/**
 * Core Matching Algorithm with Multi-Currency, Retentions and Fuzzy Search
 */
export function matchBankMovement(
  movement: BankMovement,
  pendingInvoices: Invoice[],
  clients: Client[],
  learnedAliases: LearnedAlias[],
  autoThreshold: number = 0.90,
  usdExchangeRate: number = 40.50,
  invoiceRemaining?: Map<string, number>
): SuggestedMatch | null {
  const rawDesc = movement.descripcion_cruda;
  const cleanDesc = stripBankNoise(rawDesc);
  const normDesc = normalizeText(rawDesc);
  const amount = movement.monto;
  const movCurrency = movement.moneda || 'UYU';

  // Helper: get effective remaining balance for an invoice (uses shared tracking map when available)
  const getRemaining = (inv: Invoice): number => {
    if (invoiceRemaining && invoiceRemaining.has(inv.id)) {
      return invoiceRemaining.get(inv.id)!;
    }
    return inv.saldo_pendiente;
  };

  // Helper: after allocating to an invoice, update the shared tracking map
  const consumeRemaining = (invId: string, amountApplied: number) => {
    if (invoiceRemaining) {
      const prev = invoiceRemaining.get(invId) ?? 0;
      invoiceRemaining.set(invId, Math.max(0, prev - amountApplied));
    }
  };

  // PRE-PASS: Check if this movement exactly matches an already-paid invoice.
  // If so, mark as "ya_conciliado" — don't create new payments.
  for (const inv of pendingInvoices) {
    const invTotal = (inv.monto_con_iva || inv.importe);
    if (Math.abs(amount - invTotal) < 0.01 && (inv.estado === 'pagada' || getRemaining(inv) <= 0.01)) {
      // Find the client for this invoice
      const client = clients.find(c => c.id === inv.cliente_id) || null;
      return {
        cliente_id: inv.cliente_id,
        cliente_nombre: client?.name || inv.cliente_nombre,
        confianza: 100,
        motivo: `Pago exacto a Factura ${inv.numero} (ya conciliada en origen)`,
        tipo: 'ya_conciliado',
        facturas: [],
      };
    }
  }

  const openInvoices = pendingInvoices.filter(i => getRemaining(i) > 0 && i.estado !== 'pagada' && i.estado !== 'anulada');

  // =========================================================================
  // PASO 1 — Alias Aprendidos
  // =========================================================================
  let matchedAlias: LearnedAlias | null = null;
  let aliasScore = 0;

  for (const alias of learnedAliases) {
    const normAlias = normalizeText(alias.texto_referencia);
    if (!normAlias) continue;

    if (normDesc.includes(normAlias) || cleanDesc.includes(normAlias)) {
      matchedAlias = alias;
      aliasScore = 1.0;
      break;
    }

    const sim = stringSimilarity(cleanDesc, normAlias);
    if (sim > 0.85 && sim > aliasScore) {
      matchedAlias = alias;
      aliasScore = sim;
    }
  }

  let candidateClient: Client | null = null;
  if (matchedAlias) {
    candidateClient = clients.find(c => c.id === matchedAlias!.cliente_id) || null;
  }

  // =========================================================================
  // PASO 2 — Match Exacto (Por Número de Factura o Monto + Alias)
  // =========================================================================
  const extractedTokens = extractInvoiceTokens(rawDesc);
  
  // 2.A: ¿El texto bancario contiene explícitamente el número de alguna factura pendiente?
  if (extractedTokens.length > 0) {
    for (const inv of openInvoices) {
      const invNum = inv.numero.replace(/[^0-9]/g, '');
      const hasToken = extractedTokens.some(token => {
        const tokenNum = token.replace(/[^0-9]/g, '');
        // Only exact numeric match — never substring (.includes()) across clients.
        // "/35" extracting "35" must NOT match invoice "A135" (different client).
        return tokenNum === invNum;
      });

      if (hasToken) {
        const invCurrency = inv.moneda || 'UYU';
        
        // Use remaining balance (tracks cross-movement allocations) instead of full monto_con_iva
        const remaining = getRemaining(inv);
        let effectiveInvSaldo = remaining;
        let isBimonetary = false;
        if (movCurrency === 'UYU' && invCurrency === 'USD') {
          effectiveInvSaldo = remaining * usdExchangeRate;
          isBimonetary = true;
        } else if (movCurrency === 'USD' && invCurrency === 'UYU') {
          effectiveInvSaldo = remaining / usdExchangeRate;
          isBimonetary = true;
        }

        const isExactAmount = Math.abs(effectiveInvSaldo - amount) < 1;

        if (isExactAmount) {
          consumeRemaining(inv.id, remaining);
          return {
            cliente_id: inv.cliente_id,
            cliente_nombre: inv.cliente_nombre,
            confianza: isBimonetary ? 95 : 100,
            motivo: isBimonetary
              ? `Pago bimonetario exacto por N° Factura (${inv.numero} USD $${remaining.toLocaleString()} × TC $${usdExchangeRate} = $${amount.toLocaleString()} UYU)`
              : `Match exacto por N° Factura (${inv.numero}) e importe idéntico`,
            tipo: isBimonetary ? 'bimonetario' : 'exacto_factura',
            facturas: [{
              factura_id: inv.id,
              factura_numero: inv.numero,
              importe: inv.importe,
              saldo_pendiente: remaining,
              monto_a_aplicar: remaining,
              moneda: inv.moneda
            }]
          };
        } else if (amount < effectiveInvSaldo) {
          consumeRemaining(inv.id, amount);
          return {
            cliente_id: inv.cliente_id,
            cliente_nombre: inv.cliente_nombre,
            confianza: 95,
            motivo: `N° Factura coincidente (${inv.numero}). Pago parcial por $${amount.toLocaleString()} (Saldo resta: $${(effectiveInvSaldo - amount).toLocaleString()})`,
            tipo: 'pago_parcial',
            facturas: [{
              factura_id: inv.id,
              factura_numero: inv.numero,
              importe: inv.importe,
              saldo_pendiente: remaining,
              monto_a_aplicar: isBimonetary ? (amount / usdExchangeRate) : amount,
              moneda: inv.moneda
            }]
          };
        } else if (amount > effectiveInvSaldo) {
          const excess = amount - effectiveInvSaldo;
          consumeRemaining(inv.id, remaining);
          return {
            cliente_id: inv.cliente_id,
            cliente_nombre: inv.cliente_nombre,
            confianza: 95,
            motivo: `N° Factura coincidente (${inv.numero}). Sobrepago con excedente de $${excess.toLocaleString()} a saldo a favor`,
            tipo: 'sobrepago',
            facturas: [{
              factura_id: inv.id,
              factura_numero: inv.numero,
              importe: inv.importe,
              saldo_pendiente: remaining,
              monto_a_aplicar: remaining,
              moneda: inv.moneda
            }],
            saldo_a_favor_estimado: excess
          };
        }
      }
    }
  }

  // 2.B: Si tenemos cliente por Alias y coincide exactamente el monto de una factura de ese cliente
  if (candidateClient) {
    const clientInvoices = openInvoices.filter(i => i.cliente_id === candidateClient!.id);
    
    // Check exact invoice — compare against monto_con_iva (consumidor final)
    for (const inv of clientInvoices) {
      const remaining = getRemaining(inv);
      let invAmount = remaining;
      if (movCurrency === 'UYU' && inv.moneda === 'USD') invAmount = remaining * usdExchangeRate;
      
      if (Math.abs(invAmount - amount) < 1) {
        consumeRemaining(inv.id, remaining);
        return {
          cliente_id: candidateClient.id,
          cliente_nombre: candidateClient.name,
          confianza: Math.round(aliasScore * 100),
          motivo: `Alias confirmado (${matchedAlias?.texto_referencia}) con importe idéntico a Factura ${inv.numero}`,
          tipo: 'exacto_monto_alias',
          facturas: [{
            factura_id: inv.id,
            factura_numero: inv.numero,
            importe: inv.importe,
            saldo_pendiente: remaining,
            monto_a_aplicar: remaining,
            moneda: inv.moneda
          }]
        };
      }
    }

    // Probar combinación de facturas del cliente
    const combo = findInvoiceCombination(clientInvoices, amount);
    if (combo && combo.length > 1) {
      return {
        cliente_id: candidateClient.id,
        cliente_nombre: candidateClient.name,
        confianza: 94,
        motivo: `Alias confirmado (${matchedAlias?.texto_referencia}). Suma exacta de ${combo.length} facturas: ${combo.map(c => c.numero).join(', ')}`,
        tipo: 'multi_factura',
        facturas: combo.map(c => ({
          factura_id: c.id,
          factura_numero: c.numero,
          importe: c.importe,
          saldo_pendiente: c.saldo_pendiente,
          monto_a_aplicar: c.saldo_pendiente,
          moneda: c.moneda
        }))
      };
    }
  }

  // =========================================================================
  // PASO 3 — Similitud de Texto (Levenshtein + RUT/CI + Alias conocidos)
  // =========================================================================
  const scoredClients: Array<{ client: Client; score: number; matchReason: string }> = [];

  // Extract clean client name from bank description (strip addresses, refs, etc.)
  const extractedName = extractClientNameFromBankDesc(rawDesc);

  // Apply known business name mismatches
  const KNOWN_MISMATCHES: Record<string, string> = { 'TRANSCOM': 'LARRAÑAGA' };
  let effectiveExtractedName = extractedName;
  for (const [bankKey, clientKey] of Object.entries(KNOWN_MISMATCHES)) {
    if (normalizeText(rawDesc).includes(normalizeText(bankKey))) {
      effectiveExtractedName = normalizeText(clientKey);
      break;
    }
  }

  for (const client of clients) {
    let maxScore = 0;
    let reason = '';

    // RUT / CI exact check
    if (client.rut_ci && client.rut_ci.length >= 6) {
      const cleanRut = client.rut_ci.replace(/[^0-9]/g, '');
      if (normDesc.includes(cleanRut)) {
        maxScore = 0.98;
        reason = `RUT/CI coincidente (${client.rut_ci})`;
      }
    }

    if (maxScore < 0.98) {
      // 1. Compare extracted clean name vs client name (best for bank descriptions with addresses)
      const extractedSim = stringSimilarity(effectiveExtractedName, client.name);
      if (extractedSim > maxScore) {
        maxScore = extractedSim;
        reason = `Nombre extraído del extracto ("${effectiveExtractedName}") coincide con "${client.name}" (${Math.round(extractedSim * 100)}%)`;
      }

      // 2. Direct name similarity (full description vs client name)
      const nameScore = stringSimilarity(cleanDesc, client.name);
      if (nameScore > maxScore) {
        maxScore = nameScore;
        reason = `Similitud de nombre (${Math.round(nameScore * 100)}%) con "${client.name}"`;
      }

      // 3. Check if extracted name exactly contains client name or vice versa
      const normClientName = normalizeText(client.name);
      if (normClientName.length >= 3 && effectiveExtractedName.includes(normClientName)) {
        const containScore = 0.95;
        if (containScore > maxScore) {
          maxScore = containScore;
          reason = `Nombre del extracto contiene "${client.name}" exactamente`;
        }
      }
      if (effectiveExtractedName.length >= 3 && normClientName.includes(effectiveExtractedName)) {
        const containScore = 0.93;
        if (containScore > maxScore) {
          maxScore = containScore;
          reason = `"${client.name}" contiene el nombre extraído "${effectiveExtractedName}"`;
        }
      }

      // 4. Check client known aliases
      if (client.alias_conocidos && client.alias_conocidos.length > 0) {
        for (const alias of client.alias_conocidos) {
          const aliasSim = stringSimilarity(effectiveExtractedName, alias);
          if (aliasSim > maxScore) {
            maxScore = aliasSim;
            reason = `Similitud con alias registrado "${alias}" (${Math.round(aliasSim * 100)}%)`;
          }
        }
      }
    }

    if (maxScore >= 0.55) {
      scoredClients.push({ client, score: maxScore, matchReason: reason });
    }
  }

  scoredClients.sort((a, b) => b.score - a.score);

  // Try top 3 clients (within 10% of best score) to find amount matches
  const topClients = scoredClients.filter((c, i) => i < 3 || c.score >= scoredClients[0].score - 0.10);

  for (const best of topClients) {
    const clientInvoices = openInvoices.filter(i => i.cliente_id === best.client.id);

    // Exact invoice match for this fuzzy client — compare against monto_con_iva
    for (const exactInvoice of clientInvoices) {
      const remaining = getRemaining(exactInvoice);
      let invAmount = remaining;
      let isBimonetary = false;
      if (movCurrency === 'UYU' && exactInvoice.moneda === 'USD') {
        invAmount = remaining * usdExchangeRate;
        isBimonetary = true;
      } else if (movCurrency === 'USD' && exactInvoice.moneda === 'UYU') {
        invAmount = remaining / usdExchangeRate;
        isBimonetary = true;
      }

      if (Math.abs(invAmount - amount) < 1) {
        const confidence = Math.min(96, Math.round(best.score * 100));
        consumeRemaining(exactInvoice.id, remaining);
        return {
          cliente_id: best.client.id,
          cliente_nombre: best.client.name,
          confianza: confidence,
          motivo: `${best.matchReason}. Coincide con Factura ${exactInvoice.numero} por $${amount.toLocaleString()} ${movCurrency}`,
          tipo: isBimonetary ? 'bimonetario' : 'similitud_cliente',
          facturas: [{
            factura_id: exactInvoice.id,
            factura_numero: exactInvoice.numero,
            importe: exactInvoice.importe,
            saldo_pendiente: remaining,
            monto_a_aplicar: remaining,
            moneda: exactInvoice.moneda
          }]
        };
      }
    }

    // Multi-invoice combination for this fuzzy client
    const combo = findInvoiceCombination(clientInvoices, amount);
    if (combo && combo.length > 1) {
      const confidence = Math.min(92, Math.round(best.score * 95));
      for (const c of combo) consumeRemaining(c.id, getRemaining(c));
      return {
        cliente_id: best.client.id,
        cliente_nombre: best.client.name,
        confianza: confidence,
        motivo: `${best.matchReason}. Suma exacta de ${combo.length} facturas (${combo.map(c => c.numero).join(', ')})`,
        tipo: 'multi_factura',
        facturas: combo.map(c => ({
          factura_id: c.id,
          factura_numero: c.numero,
          importe: c.importe,
          saldo_pendiente: getRemaining(c),
          monto_a_aplicar: getRemaining(c),
          moneda: c.moneda
        }))
      };
    }

    // Oldest invoice partial payment or general suggestion
    if (clientInvoices.length > 0) {
      const sortedInvoices = [...clientInvoices].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      const oldest = sortedInvoices[0];
      const oldestRemaining = getRemaining(oldest);

      if (amount < oldestRemaining) {
        consumeRemaining(oldest.id, amount);
        return {
          cliente_id: best.client.id,
          cliente_nombre: best.client.name,
          confianza: Math.min(85, Math.round(best.score * 90)),
          motivo: `${best.matchReason}. Sugerido aplicar como pago parcial a Factura más antigua ${oldest.numero} (Saldo: $${oldestRemaining.toLocaleString()})`,
          tipo: 'pago_parcial',
          facturas: [{
            factura_id: oldest.id,
            factura_numero: oldest.numero,
            importe: oldest.importe,
            saldo_pendiente: oldestRemaining,
            monto_a_aplicar: amount,
            moneda: oldest.moneda
          }]
        };
      } else {
        let remaining = amount;
        const allocated: SuggestedMatch['facturas'] = [];

        for (const inv of sortedInvoices) {
          if (remaining <= 0) break;
          const invRemain = getRemaining(inv);
          if (invRemain <= 0) continue;
          const apply = Math.min(invRemain, remaining);
          allocated.push({
            factura_id: inv.id,
            factura_numero: inv.numero,
            importe: inv.importe,
            saldo_pendiente: invRemain,
            monto_a_aplicar: apply,
            moneda: inv.moneda
          });
          consumeRemaining(inv.id, apply);
          remaining -= apply;
        }

        return {
          cliente_id: best.client.id,
          cliente_nombre: best.client.name,
          confianza: Math.min(85, Math.round(best.score * 90)),
          motivo: `${best.matchReason}. Se propone distribuir en ${allocated.length} factura(s) por orden de vencimiento${remaining > 0 ? ` + Saldo a favor de $${remaining.toLocaleString()}` : ''}`,
          tipo: remaining > 0 ? 'sobrepago' : 'multi_factura',
          facturas: allocated,
          saldo_a_favor_estimado: remaining > 0 ? remaining : undefined
        };
      }
    }
  }

  // =========================================================================
  // PASO 4 — Búsqueda por Coincidencia Unívoca de Importe en Cartera
  // =========================================================================
  const invoicesWithExactAmount = openInvoices.filter(i => {
    const invTotal = i.monto_con_iva || i.importe;
    let effectiveSaldo = invTotal;
    if (movCurrency === 'UYU' && i.moneda === 'USD') {
      effectiveSaldo = invTotal * usdExchangeRate;
    } else if (movCurrency === 'USD' && i.moneda === 'UYU') {
      effectiveSaldo = invTotal / usdExchangeRate;
    } else if (movCurrency !== (i.moneda || 'UYU')) {
      return false;
    }
    return Math.abs(effectiveSaldo - amount) < 0.01;
  });
  if (invoicesWithExactAmount.length === 1) {
    const singleMatch = invoicesWithExactAmount[0];
    const isBimonetary4 = movCurrency !== (singleMatch.moneda || 'UYU');
    const singleRemaining = getRemaining(singleMatch);
    consumeRemaining(singleMatch.id, amount);

    return {
      cliente_id: singleMatch.cliente_id,
      cliente_nombre: singleMatch.cliente_nombre,
      confianza: 82,
      motivo: isBimonetary4
        ? `Importe unívoco en cartera ($${amount.toLocaleString()} ${movCurrency}): Coincide bimonetario con Factura ${singleMatch.numero} (${singleRemaining.toLocaleString()} ${singleMatch.moneda || 'UYU'}) de ${singleMatch.cliente_nombre}`
        : `Importe unívoco en cartera ($${amount.toLocaleString()}): Coincide exactamente con la única factura pendiente por este importe (${singleMatch.numero} de ${singleMatch.cliente_nombre})`,
      tipo: isBimonetary4 ? 'bimonetario' : 'exacto_factura',
      facturas: [{
        factura_id: singleMatch.id,
        factura_numero: singleMatch.numero,
        importe: singleMatch.importe,
        saldo_pendiente: singleRemaining,
        monto_a_aplicar: amount,
        moneda: singleMatch.moneda
      }]
    };
  }

  return null;
}

/**
 * FIFO Client-Level Allocation
 * 
 * Instead of matching each movement independently, this function:
 * 1. Groups credit movements by client (using extractClientNameFromBankDesc)
 * 2. Sorts movements chronologically within each client
 * 3. Allocates each payment to the oldest open invoices (FIFO)
 * 4. Returns a map of movement suggestions
 *
 * This reproduces the accounting standard: oldest cobro applies to oldest factura.
 */
export function runFIFOAllocation(
  movements: BankMovement[],
  invoices: Invoice[],
  clients: Client[],
  learnedAliases: LearnedAlias[],
  autoThreshold: number = 0.90,
  usdExchangeRate: number = 40.50
): Map<string, SuggestedMatch | null> {
  const results = new Map<string, SuggestedMatch | null>();

  // Only process credit movements
  const creditMovs = movements.filter(m => m.es_credito && m.monto > 0);

  // Group movements by client, also tracking the extracted name for sub-pool matching
  const clientMovements = new Map<string, { mov: BankMovement; extractedName: string }[]>();
  const unmatchedMovements: BankMovement[] = [];

  for (const mov of creditMovs) {
    const extractedName = extractClientNameFromBankDesc(mov.descripcion_cruda);
    const cleanDesc = stripBankNoise(mov.descripcion_cruda);

    // Known business name mismatches (bank desc → client name)
    const KNOWN_MISMATCHES: Record<string, string> = {
      'TRANSCOM': 'LARRAÑAGA',
    };

    let effectiveExtractedName = extractedName;
    for (const [bankKey, clientKey] of Object.entries(KNOWN_MISMATCHES)) {
      if (normalizeText(mov.descripcion_cruda).includes(normalizeText(bankKey))) {
        effectiveExtractedName = normalizeText(clientKey);
        break;
      }
    }

    // Find best matching client
    let bestClient: Client | null = null;
    let bestScore = 0;

    for (const client of clients) {
      let score = 0;

      // Check extracted name vs client name
      const nameSim = stringSimilarity(effectiveExtractedName, client.name);
      if (nameSim > score) score = nameSim;

      // Direct name similarity
      const directSim = stringSimilarity(cleanDesc, client.name);
      if (directSim > score) score = directSim;

      // Contains check
      const normClient = normalizeText(client.name);
      if (normClient.length >= 3 && effectiveExtractedName.includes(normClient)) {
        if (0.95 > score) score = 0.95;
      }
      if (effectiveExtractedName.length >= 3 && normClient.includes(effectiveExtractedName)) {
        if (0.93 > score) score = 0.93;
      }

      // Alias check
      if (client.alias_conocidos) {
        for (const alias of client.alias_conocidos) {
          const aliasSim = stringSimilarity(effectiveExtractedName, alias);
          if (aliasSim > score) score = aliasSim;
        }
      }

      // Learned aliases
      for (const la of learnedAliases) {
        if (la.cliente_id === client.id) {
          const normAlias = normalizeText(la.texto_referencia);
          if (normalizeText(mov.descripcion_cruda).includes(normAlias) || cleanDesc.includes(normAlias)) {
            if (1.0 > score) score = 1.0;
          }
        }
      }

      if (score > bestScore && score >= 0.55) {
        bestScore = score;
        bestClient = client;
      }
    }

    if (bestClient) {
      const key = bestClient.id;
      if (!clientMovements.has(key)) clientMovements.set(key, []);
      clientMovements.get(key)!.push({ mov, extractedName: effectiveExtractedName });
    } else {
      unmatchedMovements.push(mov);
    }
  }

  // Mark unmatched movements
  for (const mov of unmatchedMovements) {
    results.set(mov.id, null);
  }

  // Mark non-credit movements as not applicable
  for (const mov of movements) {
    if (!mov.es_credito || mov.monto <= 0) {
      results.set(mov.id, null);
    }
  }

  // For each client, run FIFO allocation
  for (const [clientId, movEntries] of clientMovements) {
    const client = clients.find(c => c.id === clientId);
    if (!client) continue;

    // Sort movements chronologically
    movEntries.sort((a, b) => {
      const da = a.mov.fecha ? new Date(a.mov.fecha).getTime() : 0;
      const db = b.mov.fecha ? new Date(b.mov.fecha).getTime() : 0;
      return da - db;
    });

    // PRE-PASS: Check for exact amount matches against ALL invoices (including paid ones).
    // If a bank movement exactly matches an already-paid invoice, mark it as "ya_conciliado"
    // (already reconciled) without generating new payments. This prevents the FIFO engine
    // from redirecting payments meant for paid invoices to wrong open invoices.
    const allClientInvoicesAll = invoices.filter(i => {
      if (i.cliente_id === clientId) return true;
      const invNames = [i.cliente_nombre, ...(i.cliente_nombre_alt || [])].filter(Boolean).map(n => normalizeText(n));
      const clientNorm = normalizeText(client.name);
      return invNames.some(n => n === clientNorm || stringSimilarity(n, clientNorm) > 0.85);
    });

    const alreadyReconciledMovs = new Set<string>();
    for (const { mov } of movEntries) {
      for (const inv of allClientInvoicesAll) {
        const invTotal = (inv.monto_con_iva || inv.importe);
        if (Math.abs(mov.monto - invTotal) < 0.01) {
          // Exact amount match — check if invoice is already paid
          if (inv.estado === 'pagada' || inv.saldo_pendiente <= 0.01) {
            results.set(mov.id, {
              cliente_id: client.id,
              cliente_nombre: client.name,
              confianza: 100,
              motivo: `Pago exacto a Factura ${inv.numero} (ya conciliada en origen)`,
              tipo: 'ya_conciliado',
              facturas: [],
            });
            alreadyReconciledMovs.add(mov.id);
            break;
          }
        }
      }
    }

    // Filter out already-reconciled movements from FIFO processing
    const fifoMovEntries = movEntries.filter(e => !alreadyReconciledMovs.has(e.mov.id));

    // Get open invoices for this client, sorted by date (FIFO)
    const allClientInvoices = invoices
      .filter(i => {
        if (i.saldo_pendiente <= 0.01 || i.estado === 'pagada' || i.estado === 'anulada') return false;
        if (i.cliente_id === clientId) return true;
        const invNames = [i.cliente_nombre, ...(i.cliente_nombre_alt || [])].filter(Boolean).map(n => normalizeText(n));
        const clientNorm = normalizeText(client.name);
        return invNames.some(n => n === clientNorm || stringSimilarity(n, clientNorm) > 0.85);
      })
      .sort((a, b) => {
        const da = a.fecha ? new Date(a.fecha).getTime() : 0;
        const db = b.fecha ? new Date(b.fecha).getTime() : 0;
        return da - db;
      });

    // Track remaining balance per invoice (across all movements for this client)
    const invoiceRemaining = new Map<string, number>();
    for (const inv of allClientInvoices) {
      invoiceRemaining.set(inv.id, inv.saldo_pendiente);
    }

    // Exclusivity: once an invoice is fully matched, it's removed from the pool
    const matchedInvoiceIds = new Set<string>();

    // Process each movement in chronological order (only those not already reconciled)
    for (const { mov, extractedName } of fifoMovEntries) {
      // Sub-pool matching: when a client has invoices with different razonSocial values
      // (e.g., Cardinal has "Cordero SA" and "CARDINAL CONSTRUCCIONES SAS"),
      // if the movement name matches a specific razonSocial, only allocate to those invoices.
      // If the movement matches the parent empresa, exclude invoices with a clearly
      // different razonSocial (different company name, not just a subsidiary variant).
      let poolInvoices = allClientInvoices;

      // Check if extracted name matches any specific alt name (razonSocial)
      const matchingAltInvoices = allClientInvoices.filter(i => {
        const alts = (i.cliente_nombre_alt || []).map(a => normalizeText(a));
        return alts.some(a => a.length >= 3 && stringSimilarity(extractedName, a) > 0.7);
      });

      if (matchingAltInvoices.length > 0 && matchingAltInvoices.length < allClientInvoices.length) {
        // Some invoices match the specific alt name, some don't — use the matched subset
        poolInvoices = matchingAltInvoices;
      } else if (matchingAltInvoices.length === 0) {
        // No specific alt match — check if there are distinct razonSocial groups
        // and the payment matches the parent empresa. If so, exclude minority groups
        // whose core name doesn't share a significant token with the payment.
        const extractedNorm = normalizeText(extractedName);
        const normClient = normalizeText(client.name);
        const paymentMatchesParent = extractedNorm === normClient ||
          stringSimilarity(extractedNorm, normClient) > 0.7 ||
          extractedNorm.includes(normClient) || normClient.includes(extractedNorm);

        if (paymentMatchesParent) {
          // Extract core names from razonSocial (first alt name) per invoice
          const coreGroups = new Map<string, number>(); // core → count
          for (const i of allClientInvoices) {
            const alts = (i.cliente_nombre_alt || []).map(a => normalizeText(a));
            if (alts.length > 0) {
              const core = alts[0].replace(/\s*\(.*?\)\s*/g, '').replace(/\b(SAS?|S\s*A|S\s*R\s*L|S\s*A\s*S|L\s*T\s*D\s*A|E\s*I\s*R\s*L)\b\.?\s*/gi, '').trim();
              if (core.length >= 3) coreGroups.set(core, (coreGroups.get(core) || 0) + 1);
            }
          }

          if (coreGroups.size > 1) {
            // Find the dominant core (most invoices)
            const sorted = [...coreGroups.entries()].sort((a, b) => b[1] - a[1]);
            const dominantCore = sorted[0][0];
            const dominantCount = sorted[0][1];
            const totalCount = [...coreGroups.values()].reduce((a, b) => a + b, 0);

            // Check if dominant group is >50% of invoices (clear majority)
            if (dominantCount > totalCount * 0.5) {
              // Check if dominant core shares a significant token (>3 chars) with extracted name
              const domTokens = dominantCore.split(' ').filter(t => t.length > 3);
              const extTokens = extractedNorm.split(' ').filter(t => t.length > 3);
              const sharesToken = domTokens.some(dt => extTokens.some(et => dt === et || dt.includes(et) || et.includes(dt)));

              if (sharesToken) {
                // Filter to invoices whose razonSocial core matches the dominant core
                const filtered = allClientInvoices.filter(i => {
                  const alts = (i.cliente_nombre_alt || []).map(a => normalizeText(a));
                  if (alts.length === 0) return true; // No razonSocial → include (e.g., A13 with empty razon)
                  const core = alts[0].replace(/\s*\(.*?\)\s*/g, '').replace(/\b(SAS?|S\s*A|S\s*R\s*L|S\s*A\s*S|L\s*T\s*D\s*A|E\s*I\s*R\s*L)\b\.?\s*/gi, '').trim();
                  if (core.length < 3) return true;
                  return stringSimilarity(core, dominantCore) > 0.5 ||
                    core.includes(dominantCore) || dominantCore.includes(core);
                });
                if (filtered.length > 0) poolInvoices = filtered;
              }
            }
          }
        }
      }

      // Exclusivity: remove already-matched invoices from the pool
      const availablePool = poolInvoices.filter(i => !matchedInvoiceIds.has(i.id));

      // PRIORITY 1: Exact match — single invoice monto_con_iva == mov.monto
      const exactMatch = availablePool.find(i => {
        const effective = Math.min(i.monto_con_iva || i.importe, invoiceRemaining.get(i.id) || 0);
        return effective > 0.01 && Math.abs(effective - mov.monto) < 1;
      });

      if (exactMatch) {
        const apply = mov.monto;
        const invRemain = invoiceRemaining.get(exactMatch.id) || 0;
        const allocated: SuggestedMatch['facturas'] = [{
          factura_id: exactMatch.id,
          factura_numero: exactMatch.numero,
          importe: exactMatch.importe,
          saldo_pendiente: invRemain,
          monto_a_aplicar: Math.min(apply, invRemain),
          moneda: exactMatch.moneda
        }];
        invoiceRemaining.set(exactMatch.id, invRemain - Math.min(apply, invRemain));
        matchedInvoiceIds.add(exactMatch.id);

        const confianza = Math.min(96, Math.round(bestScoreForMov(mov, client, clients, learnedAliases) * 100));
        results.set(mov.id, {
          cliente_id: client.id,
          cliente_nombre: client.name,
          confianza,
          motivo: `Match exacto 1:1 — Factura ${exactMatch.numero} ($${effectiveForMatch(exactMatch).toLocaleString()}) = $${mov.monto.toLocaleString()}`,
          tipo: 'exacto_factura',
          facturas: allocated,
        });
        continue;
      }

      // PRIORITY 2: Sum match — combination of invoices == mov.monto
      const sumMatch = findInvoiceCombination(availablePool, mov.monto);
      if (sumMatch && sumMatch.length > 1) {
        const allocated: SuggestedMatch['facturas'] = [];
        for (const inv of sumMatch) {
          const invRemain = invoiceRemaining.get(inv.id) || 0;
          const effective = Math.min(inv.monto_con_iva || inv.importe, invRemain);
          const apply = Math.min(effective, invRemain);
          allocated.push({
            factura_id: inv.id,
            factura_numero: inv.numero,
            importe: inv.importe,
            saldo_pendiente: invRemain,
            monto_a_aplicar: apply,
            moneda: inv.moneda
          });
          invoiceRemaining.set(inv.id, invRemain - apply);
          matchedInvoiceIds.add(inv.id);
        }

        const confianza = Math.min(94, Math.round(bestScoreForMov(mov, client, clients, learnedAliases) * 100));
        results.set(mov.id, {
          cliente_id: client.id,
          cliente_nombre: client.name,
          confianza,
          motivo: `Suma exacta de ${sumMatch.length} facturas = $${mov.monto.toLocaleString()} (${sumMatch.map(i => i.numero).join(', ')})`,
          tipo: 'multi_factura',
          facturas: allocated,
        });
        continue;
      }

      // PRIORITY 3: FIFO distribution (only if no exact or sum match found)
      let remaining = mov.monto;
      const allocated: SuggestedMatch['facturas'] = [];

      for (const inv of availablePool) {
        if (remaining <= 0.01) break;
        const invRemain = invoiceRemaining.get(inv.id) || 0;
        if (invRemain <= 0.01) continue;

        const apply = Math.min(invRemain, remaining);
        allocated.push({
          factura_id: inv.id,
          factura_numero: inv.numero,
          importe: inv.importe,
          saldo_pendiente: invRemain,
          monto_a_aplicar: apply,
          moneda: inv.moneda
        });
        invoiceRemaining.set(inv.id, invRemain - apply);
        if (invRemain - apply <= 0.01) matchedInvoiceIds.add(inv.id);
        remaining -= apply;
      }

      if (allocated.length > 0) {
        const confianza = Math.min(96, Math.round(bestScoreForMov(mov, client, clients, learnedAliases) * 100));
        const exactInvoice = allocated.length === 1 && Math.abs(allocated[0].monto_a_aplicar - allocated[0].saldo_pendiente) < 0.01;
        const overpay = remaining;

        results.set(mov.id, {
          cliente_id: client.id,
          cliente_nombre: client.name,
          confianza,
          motivo: exactInvoice
            ? `FIFO: Pago exacto a Factura ${allocated[0].factura_numero}`
            : `FIFO: Distribución en ${allocated.length} factura(s) por orden cronológico${overpay > 0.01 ? ` + Saldo a favor $${overpay.toFixed(2)}` : ''}`,
          tipo: overpay > 0.01 ? 'sobrepago' : (allocated.length === 1 ? 'exacto_factura' : 'multi_factura'),
          facturas: allocated,
          saldo_a_favor_estimado: overpay > 0.01 ? overpay : undefined
        });
      } else {
        results.set(mov.id, null);
      }
    }
  }

  return results;
}

function effectiveForMatch(inv: Invoice): number {
  return Math.min(inv.monto_con_iva || inv.importe, inv.saldo_pendiente);
}

function bestScoreForMov(mov: BankMovement, client: Client, clients: Client[], aliases: LearnedAlias[]): number {
  const extractedName = extractClientNameFromBankDesc(mov.descripcion_cruda);
  const cleanDesc = stripBankNoise(mov.descripcion_cruda);

  // Apply same known business name mismatches
  const KNOWN_MISMATCHES: Record<string, string> = { 'TRANSCOM': 'LARRAÑAGA' };
  let effectiveName = extractedName;
  for (const [bankKey, clientKey] of Object.entries(KNOWN_MISMATCHES)) {
    if (normalizeText(mov.descripcion_cruda).includes(normalizeText(bankKey))) {
      effectiveName = normalizeText(clientKey);
      break;
    }
  }

  let best = 0;

  const nameSim = stringSimilarity(effectiveName, client.name);
  if (nameSim > best) best = nameSim;
  const directSim = stringSimilarity(cleanDesc, client.name);
  if (directSim > best) best = directSim;
  const normClient = normalizeText(client.name);
  if (normClient.length >= 3 && effectiveName.includes(normClient)) if (0.95 > best) best = 0.95;
  if (effectiveName.length >= 3 && normClient.includes(effectiveName)) if (0.93 > best) best = 0.93;
  if (client.alias_conocidos) {
    for (const alias of client.alias_conocidos) {
      const s = stringSimilarity(effectiveName, alias);
      if (s > best) best = s;
    }
  }
  return best;
}

/**
 * Calculates aging buckets for accounts receivable
 */
export function calculateAging(invoices: Invoice[]): {
  al_dia: number;
  dias_1_30: number;
  dias_31_60: number;
  dias_61_90: number;
  mas_90_dias: number;
  total: number;
} {
  const now = new Date().getTime();
  const summary = {
    al_dia: 0,
    dias_1_30: 0,
    dias_31_60: 0,
    dias_61_90: 0,
    mas_90_dias: 0,
    total: 0
  };

  invoices.filter(i => i.saldo_pendiente > 0).forEach(inv => {
    const dueTime = new Date(inv.vencimiento).getTime();
    const diffDays = Math.floor((now - dueTime) / (1000 * 60 * 60 * 24));
    const amount = inv.saldo_pendiente;

    summary.total += amount;

    if (diffDays <= 0) {
      summary.al_dia += amount;
    } else if (diffDays <= 30) {
      summary.dias_1_30 += amount;
    } else if (diffDays <= 60) {
      summary.dias_31_60 += amount;
    } else if (diffDays <= 90) {
      summary.dias_61_90 += amount;
    } else {
      summary.mas_90_dias += amount;
    }
  });

  return summary;
}

/**
 * Regression invariant: for each client, verify that:
 *   sum(bank credits received from confirmed movements)
 *   == sum(applied payments to invoices) + credit_balance
 *
 * Returns an array of violations (empty = all good).
 */
export function validateReconciliationInvariant(
  bankMovements: BankMovement[],
  paymentApplications: PaymentApplication[],
  clientCredits: ClientCredit[],
  clients: Client[]
): Array<{ clientName: string; bankCredits: number; appliedPayments: number; creditBalance: number; diff: number }> {
  const violations: Array<{ clientName: string; bankCredits: number; appliedPayments: number; creditBalance: number; diff: number }> = [];

  // Group confirmed bank credits by client
  const bankCreditsByClient = new Map<string, number>();
  for (const mov of bankMovements) {
    if (mov.estado_conciliacion === 'conciliado_manual' && mov.es_credito && mov.monto > 0 && mov.cliente_sugerido_id) {
      const cur = bankCreditsByClient.get(mov.cliente_sugerido_id) || 0;
      bankCreditsByClient.set(mov.cliente_sugerido_id, cur + mov.monto);
    }
  }

  // Group applied payments by client
  const paymentsByClient = new Map<string, number>();
  for (const pa of paymentApplications) {
    const cur = paymentsByClient.get(pa.cliente_id) || 0;
    paymentsByClient.set(pa.cliente_id, cur + pa.monto_aplicado);
  }

  // Group credits by client
  const creditsByClient = new Map<string, number>();
  for (const cr of clientCredits) {
    if (cr.estado === 'disponible' || cr.estado === 'parcial') {
      const cur = creditsByClient.get(cr.cliente_id) || 0;
      creditsByClient.set(cr.cliente_id, cur + cr.saldo_disponible);
    }
  }

  for (const client of clients) {
    const bankCredits = bankCreditsByClient.get(client.id) || 0;
    if (bankCredits === 0) continue; // Skip clients with no confirmed bank credits

    const appliedPayments = paymentsByClient.get(client.id) || 0;
    const creditBalance = creditsByClient.get(client.id) || 0;
    const diff = Math.abs(bankCredits - (appliedPayments + creditBalance));

    if (diff > 0.01) {
      violations.push({
        clientName: client.name,
        bankCredits,
        appliedPayments,
        creditBalance,
        diff: bankCredits - (appliedPayments + creditBalance)
      });
    }
  }

  return violations;
}
