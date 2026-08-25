import { BankMovement, Client, Company, Invoice, LearnedAlias, SuggestedMatch } from '../types';

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

  let cleaned = norm;
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix + ' ')) {
      cleaned = cleaned.substring(prefix.length).trim();
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
 * e.g. "FAC-1042", "F1042", "1042", "F-0001042", "EXP-450"
 */
export function extractInvoiceTokens(text: string): string[] {
  const norm = normalizeText(text);
  const matches = norm.match(/\b(?:FAC|F|FACTURA|INV|NC|EXP)?[- ]?(\d{3,8})\b/gi) || [];
  const results = new Set<string>();
  
  for (const m of matches) {
    const cleanNum = m.replace(/[^0-9]/g, '');
    if (cleanNum && cleanNum.length >= 3) {
      results.add(cleanNum);
      results.add(m.trim());
    }
  }
  return Array.from(results);
}

/**
 * Subset-sum helper to find combinations of open invoices that sum up exactly to the movement amount
 */
export function findInvoiceCombination(invoices: Invoice[], targetAmount: number): Invoice[] | null {
  const sorted = [...invoices].filter(i => i.saldo_pendiente > 0).sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);
  if (sorted.length === 0) return null;

  // Single invoice exact
  const single = sorted.find(i => Math.abs(i.saldo_pendiente - targetAmount) < 0.01);
  if (single) return [single];

  // Try 2 to 4 invoices combinations
  const n = Math.min(sorted.length, 8);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(sorted[i].saldo_pendiente + sorted[j].saldo_pendiente - targetAmount) < 0.01) {
        return [sorted[i], sorted[j]];
      }
      for (let k = j + 1; k < n; k++) {
        if (Math.abs(sorted[i].saldo_pendiente + sorted[j].saldo_pendiente + sorted[k].saldo_pendiente - targetAmount) < 0.01) {
          return [sorted[i], sorted[j], sorted[k]];
        }
      }
    }
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
  usdExchangeRate: number = 40.50
): SuggestedMatch | null {
  const rawDesc = movement.descripcion_cruda;
  const cleanDesc = stripBankNoise(rawDesc);
  const normDesc = normalizeText(rawDesc);
  const amount = movement.monto;
  const movCurrency = movement.moneda || 'UYU';

  const openInvoices = pendingInvoices.filter(i => i.saldo_pendiente > 0 && i.estado !== 'pagada' && i.estado !== 'anulada');

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
        return tokenNum === invNum || inv.numero.toUpperCase().includes(token.toUpperCase());
      });

      if (hasToken) {
        const invCurrency = inv.moneda || 'UYU';
        
        // Multi-currency calculation
        let effectiveInvSaldo = inv.saldo_pendiente;
        let isBimonetary = false;
        if (movCurrency === 'UYU' && invCurrency === 'USD') {
          effectiveInvSaldo = inv.saldo_pendiente * usdExchangeRate;
          isBimonetary = true;
        } else if (movCurrency === 'USD' && invCurrency === 'UYU') {
          effectiveInvSaldo = inv.saldo_pendiente / usdExchangeRate;
          isBimonetary = true;
        }

        const isExactAmount = Math.abs(effectiveInvSaldo - amount) < 1;
        const diff = effectiveInvSaldo - amount;
        
        // Check for tax withholding (1%, 2%, 3% standard tax retention)
        const isWithholding1pct = Math.abs(diff - (effectiveInvSaldo * 0.01)) < 5;
        const isWithholding2pct = Math.abs(diff - (effectiveInvSaldo * 0.02)) < 5;
        const isWithholding3pct = Math.abs(diff - (effectiveInvSaldo * 0.03)) < 5;
        const hasWithholding = (isWithholding1pct || isWithholding2pct || isWithholding3pct || (diff > 0 && diff <= 1000 && normDesc.includes('RET')));

        if (isExactAmount) {
          return {
            cliente_id: inv.cliente_id,
            cliente_nombre: inv.cliente_nombre,
            confianza: isBimonetary ? 95 : 100,
            motivo: isBimonetary
              ? `Pago bimonetario exacto por N° Factura (${inv.numero} USD $${inv.saldo_pendiente.toLocaleString()} × TC $${usdExchangeRate} = $${amount.toLocaleString()} UYU)`
              : `Match exacto por N° Factura (${inv.numero}) e importe idéntico`,
            tipo: isBimonetary ? 'bimonetario' : 'exacto_factura',
            facturas: [{
              factura_id: inv.id,
              factura_numero: inv.numero,
              importe: inv.importe,
              saldo_pendiente: inv.saldo_pendiente,
              monto_a_aplicar: inv.saldo_pendiente,
              moneda: inv.moneda
            }]
          };
        } else if (hasWithholding) {
          const retAmount = diff;
          return {
            cliente_id: inv.cliente_id,
            cliente_nombre: inv.cliente_nombre,
            confianza: 92,
            motivo: `Factura ${inv.numero} (${inv.saldo_pendiente.toLocaleString()}) con retención fiscal estimada de $${Math.round(retAmount).toLocaleString()}`,
            tipo: 'retencion_o_gasto',
            facturas: [{
              factura_id: inv.id,
              factura_numero: inv.numero,
              importe: inv.importe,
              saldo_pendiente: inv.saldo_pendiente,
              monto_a_aplicar: inv.saldo_pendiente,
              moneda: inv.moneda
            }],
            retencion_estimada: Math.round(retAmount)
          };
        } else if (amount < effectiveInvSaldo) {
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
              saldo_pendiente: inv.saldo_pendiente,
              monto_a_aplicar: isBimonetary ? (amount / usdExchangeRate) : amount,
              moneda: inv.moneda
            }]
          };
        } else if (amount > effectiveInvSaldo) {
          const excess = amount - effectiveInvSaldo;
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
              saldo_pendiente: inv.saldo_pendiente,
              monto_a_aplicar: inv.saldo_pendiente,
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
    
    // Check exact invoice
    for (const inv of clientInvoices) {
      let invAmount = inv.saldo_pendiente;
      if (movCurrency === 'UYU' && inv.moneda === 'USD') invAmount = inv.saldo_pendiente * usdExchangeRate;
      
      if (Math.abs(invAmount - amount) < 1) {
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
            saldo_pendiente: inv.saldo_pendiente,
            monto_a_aplicar: inv.saldo_pendiente,
            moneda: inv.moneda
          }]
        };
      }

      // Check withholding with alias
      const diff = invAmount - amount;
      if (diff > 0 && diff <= (invAmount * 0.05)) {
        return {
          cliente_id: candidateClient.id,
          cliente_nombre: candidateClient.name,
          confianza: 91,
          motivo: `Alias confirmado (${matchedAlias?.texto_referencia}) para Factura ${inv.numero} con retención/comisión de $${Math.round(diff).toLocaleString()}`,
          tipo: 'retencion_o_gasto',
          facturas: [{
            factura_id: inv.id,
            factura_numero: inv.numero,
            importe: inv.importe,
            saldo_pendiente: inv.saldo_pendiente,
            monto_a_aplicar: inv.saldo_pendiente,
            moneda: inv.moneda
          }],
          retencion_estimada: Math.round(diff)
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

    // Name similarity
    if (maxScore < 0.98) {
      const nameScore = stringSimilarity(cleanDesc, client.name);
      if (nameScore > maxScore) {
        maxScore = nameScore;
        reason = `Similitud de nombre (${Math.round(nameScore * 100)}%) con "${client.name}"`;
      }

      // Check client known aliases
      if (client.alias_conocidos && client.alias_conocidos.length > 0) {
        for (const alias of client.alias_conocidos) {
          const aliasSim = stringSimilarity(cleanDesc, alias);
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

  if (scoredClients.length > 0) {
    const best = scoredClients[0];
    const clientInvoices = openInvoices.filter(i => i.cliente_id === best.client.id);

    // Exact invoice match for this fuzzy client
    for (const exactInvoice of clientInvoices) {
      let invAmount = exactInvoice.saldo_pendiente;
      let isBimonetary = false;
      if (movCurrency === 'UYU' && exactInvoice.moneda === 'USD') {
        invAmount = exactInvoice.saldo_pendiente * usdExchangeRate;
        isBimonetary = true;
      }

      if (Math.abs(invAmount - amount) < 1) {
        const confidence = Math.min(96, Math.round(best.score * 100));
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
            saldo_pendiente: exactInvoice.saldo_pendiente,
            monto_a_aplicar: exactInvoice.saldo_pendiente,
            moneda: exactInvoice.moneda
          }]
        };
      }

      // Check withholding
      const diff = invAmount - amount;
      if (diff > 0 && (diff <= invAmount * 0.05 || normDesc.includes('RET'))) {
        return {
          cliente_id: best.client.id,
          cliente_nombre: best.client.name,
          confianza: Math.min(92, Math.round(best.score * 94)),
          motivo: `${best.matchReason}. Factura ${exactInvoice.numero} con retención estimada de $${Math.round(diff).toLocaleString()}`,
          tipo: 'retencion_o_gasto',
          facturas: [{
            factura_id: exactInvoice.id,
            factura_numero: exactInvoice.numero,
            importe: exactInvoice.importe,
            saldo_pendiente: exactInvoice.saldo_pendiente,
            monto_a_aplicar: exactInvoice.saldo_pendiente,
            moneda: exactInvoice.moneda
          }],
          retencion_estimada: Math.round(diff)
        };
      }
    }

    // Multi-invoice combination for this fuzzy client
    const combo = findInvoiceCombination(clientInvoices, amount);
    if (combo && combo.length > 1) {
      const confidence = Math.min(92, Math.round(best.score * 95));
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
          saldo_pendiente: c.saldo_pendiente,
          monto_a_aplicar: c.saldo_pendiente,
          moneda: c.moneda
        }))
      };
    }

    // Oldest invoice partial payment or general suggestion
    if (clientInvoices.length > 0) {
      const sortedInvoices = [...clientInvoices].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      const oldest = sortedInvoices[0];

      if (amount < oldest.saldo_pendiente) {
        return {
          cliente_id: best.client.id,
          cliente_nombre: best.client.name,
          confianza: Math.min(85, Math.round(best.score * 90)),
          motivo: `${best.matchReason}. Sugerido aplicar como pago parcial a Factura más antigua ${oldest.numero} (Saldo: $${oldest.saldo_pendiente.toLocaleString()})`,
          tipo: 'pago_parcial',
          facturas: [{
            factura_id: oldest.id,
            factura_numero: oldest.numero,
            importe: oldest.importe,
            saldo_pendiente: oldest.saldo_pendiente,
            monto_a_aplicar: amount,
            moneda: oldest.moneda
          }]
        };
      } else {
        let remaining = amount;
        const allocated: SuggestedMatch['facturas'] = [];

        for (const inv of sortedInvoices) {
          if (remaining <= 0) break;
          const apply = Math.min(inv.saldo_pendiente, remaining);
          allocated.push({
            factura_id: inv.id,
            factura_numero: inv.numero,
            importe: inv.importe,
            saldo_pendiente: inv.saldo_pendiente,
            monto_a_aplicar: apply,
            moneda: inv.moneda
          });
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
  const invoicesWithExactAmount = openInvoices.filter(i => Math.abs(i.saldo_pendiente - amount) < 0.01);
  if (invoicesWithExactAmount.length === 1) {
    const singleMatch = invoicesWithExactAmount[0];

    return {
      cliente_id: singleMatch.cliente_id,
      cliente_nombre: singleMatch.cliente_nombre,
      confianza: 82,
      motivo: `Importe unívoco en cartera ($${amount.toLocaleString()}): Coincide exactamente con la única factura pendiente por este importe (${singleMatch.numero} de ${singleMatch.cliente_nombre})`,
      tipo: 'exacto_factura',
      facturas: [{
        factura_id: singleMatch.id,
        factura_numero: singleMatch.numero,
        importe: singleMatch.importe,
        saldo_pendiente: singleMatch.saldo_pendiente,
        monto_a_aplicar: amount,
        moneda: singleMatch.moneda
      }]
    };
  }

  return null;
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
