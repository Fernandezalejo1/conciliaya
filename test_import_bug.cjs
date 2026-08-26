const XLSX = require('xlsx');
const path = require('path');

// ─── 1. READ XLSX ───────────────────────────────────────────────────────────
const filePath = 'C:\\Users\\noiss\\Downloads\\prueba\\Facturas_Prueba.xlsx';
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

console.log(`=== FILE: ${wb.SheetNames[0]} ===`);
console.log(`Rows parsed: ${rows.length}`);
console.log(`Headers detected: ${Object.keys(rows[0]).join(' | ')}\n`);

// ─── 2. AUTO-DETECT COLUMNS (exact copy from UploadView.tsx) ────────────────
function autoDetectInvoiceColumns(headers) {
  const norm = headers.map(h =>
    h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  const findBest = (patterns) => {
    for (const p of patterns) {
      const idx = norm.findIndex(h => h.includes(p));
      if (idx !== -1) return headers[idx];
    }
    return '';
  };

  return {
    numero: findBest([
      'numero factura', 'nro factura', 'n de factura', 'n° factura', 'num factura',
      'numero', 'nro', 'num', 'n°', 'comprobante', 'factura', 'doc',
      'invoice', 'bill', 'recibo'
    ]) || headers[0] || '',
    cliente: findBest([
      'empresa matriz', 'quien paga', 'razon social cliente', 'razon social',
      'cliente / proyecto', 'cliente', 'nombre cliente', 'empresa',
      'titular', 'deudor', 'social', 'proyecto', 'razon', 'nombre'
    ]) || headers[1] || '',
    rut_ci: findBest(['rut', 'ci ', ' c.i', 'c.i.', 'ruc', 'cuit', 'cedula', 'documento', 'nit']),
    fecha: findBest([
      'fecha emision', 'fecha de emision', 'fecha emisión',
      'emision', 'emisión', 'fecha', 'date', 'fec', 'dia', 'day'
    ]) || '',
    vencimiento: findBest(['vencimiento', 'vto', 'vence', 'due', 'fecha vencimiento', 'fecha venc']),
    importe: findBest([
      'monto (con iva)', 'monto con iva', 'monto total', 'total con iva',
      'importe', 'monto', 'total', 'saldo', 'valor', 'amount', 'price',
      'monto (sin iva)', 'precio', 'importe total'
    ]) || '',
    moneda: findBest(['moneda', 'curr', 'currency', 'mon', 'divisa']),
    iva_monto: findBest(['iva ventas', 'iva', 'impuesto', 'tax', 'imp iv a', 'imp. iva']),
    monto_pagado: findBest(['monto pagado', 'pagado', 'paid', 'amount paid', 'abonado', 'pagado total'])
  };
}

const headers = Object.keys(rows[0]);
const colMap = autoDetectInvoiceColumns(headers);

console.log('=== COLUMN AUTO-DETECTION ===');
Object.entries(colMap).forEach(([k, v]) => {
  console.log(`  ${k.padEnd(15)} => "${v || '(empty)'}"`);
});
console.log();

// ─── 3. PARSE ROBUST NUMBER (exact copy from fileValidation.ts) ─────────────
function parseRobustNumber(val) {
  if (val === undefined || val === null || val === '') {
    return { value: null, isValid: false, error: 'Valor numérico vacío o ausente', rawString: '' };
  }
  if (typeof val === 'number') {
    if (isNaN(val)) {
      return { value: null, isValid: false, error: 'Número inválido (NaN)', rawString: String(val) };
    }
    return { value: val, isValid: true, rawString: String(val) };
  }

  const str = String(val).trim();
  if (!str) {
    return { value: null, isValid: false, error: 'Texto numérico vacío', rawString: str };
  }

  const invalidKeywords = ['n/a', 'na', 'null', 'undefined', 'pendiente', 'none', '-', '--', 's/d', 'sin dato'];
  if (invalidKeywords.includes(str.toLowerCase())) {
    return { value: null, isValid: false, error: `Valor no numérico detectado: "${str}"`, rawString: str };
  }

  let cleaned = str.replace(/[$€£\s\t\r\n]|UYU|USD|US/gi, '').trim();

  let isNegative = false;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1).trim();
  } else if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.substring(1).trim();
  }

  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    const commaParts = cleaned.split(',');
    if (commaParts.length === 2 && commaParts[1].length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else if (commaParts.length > 2) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  } else if (cleaned.includes('.')) {
    const dotParts = cleaned.split('.');
    if (dotParts.length > 2) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const finalStr = (isNegative ? '-' : '') + cleaned.replace(/[^0-9.-]/g, '');
  const num = parseFloat(finalStr);

  if (isNaN(num) || !isFinite(num)) {
    return { value: null, isValid: false, error: `Formato numérico no reconocible: "${str}"`, rawString: str };
  }

  return { value: num, isValid: true, rawString: str };
}

// ─── 4. PARSE ROBUST DATE (exact copy from fileValidation.ts) ───────────────
function parseRobustDate(val) {
  if (val === undefined || val === null || val === '') {
    return { isoDate: null, isValid: false, error: 'Fecha vacía o no especificada', rawString: '' };
  }

  if (typeof val === 'number' || (!isNaN(Number(val)) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    if (num > 30000 && num < 70000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const targetDate = new Date(excelEpoch.getTime() + num * 86400000);
      if (!isNaN(targetDate.getTime())) {
        const y = targetDate.getUTCFullYear();
        const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getUTCDate()).padStart(2, '0');
        return { isoDate: `${y}-${m}-${d}`, isValid: true, rawString: String(val) };
      }
    }
  }

  const str = String(val).trim();
  if (!str) {
    return { isoDate: null, isValid: false, error: 'Fecha vacía', rawString: str };
  }

  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:T.*)?$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return validateCalendarDate(year, month, day, str);
  }

  const latMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (latMatch) {
    let day = parseInt(latMatch[1], 10);
    let month = parseInt(latMatch[2], 10);
    let year = parseInt(latMatch[3], 10);
    if (year < 100) {
      year = year >= 70 ? 1900 + year : 2000 + year;
    }
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }
    return validateCalendarDate(year, month, day, str);
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    return validateCalendarDate(y, m, d, str);
  }

  return { isoDate: null, isValid: false, error: `Formato de fecha no reconocido: "${str}"`, rawString: str };
}

function validateCalendarDate(year, month, day, rawString) {
  if (month < 1 || month > 12) {
    return { isoDate: null, isValid: false, error: `Mes inválido (${month}) en fecha: "${rawString}"`, rawString };
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return { isoDate: null, isValid: false, error: `Día inválido (${day})`, rawString };
  }
  if (year < 1990 || year > 2050) {
    return { isoDate: null, isValid: false, error: `Año fuera de rango (${year})`, rawString };
  }
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { isoDate: iso, isValid: true, rawString };
}

// ─── 5. VALIDATE INVOICES BATCH (exact copy from fileValidation.ts) ─────────
function validateInvoicesBatch(rows, columnMap) {
  const sanitizedRows = [];
  const seenNumbersInBatch = new Set();
  const allIssues = [];

  rows.forEach((rawRow, idx) => {
    const rowIssues = [];

    const rawNumero = columnMap.numero ? rawRow[columnMap.numero] : undefined;
    const rawCliente = columnMap.cliente ? rawRow[columnMap.cliente] : undefined;
    const rawFecha = columnMap.fecha ? rawRow[columnMap.fecha] : undefined;
    const rawVencimiento = columnMap.vencimiento ? rawRow[columnMap.vencimiento] : undefined;
    const rawImporte = columnMap.importe ? rawRow[columnMap.importe] : undefined;
    const rawMoneda = columnMap.moneda ? rawRow[columnMap.moneda] : undefined;
    const rawIva = columnMap.iva_monto ? rawRow[columnMap.iva_monto] : undefined;
    const rawPagado = columnMap.monto_pagado ? rawRow[columnMap.monto_pagado] : undefined;

    // Skip empty rows
    const isRowEmpty = Object.values(rawRow).every(v => v === undefined || v === null || String(v).trim() === '');
    if (isRowEmpty) { return; }

    // Skip summary rows
    const allValuesStr = Object.values(rawRow).map(v => String(v || '')).join(' ').toLowerCase();
    const summaryKeywords = ['totales', 'total neto', 'total general', 'subtotal', 'sumas', 'grand total'];
    if (summaryKeywords.some(kw => allValuesStr.includes(kw))) {
      const keyFieldEmpty = !String(rawNumero || '').trim();
      const dateFieldEmpty = !String(rawFecha || '').trim();
      if (keyFieldEmpty || dateFieldEmpty) { return; }
    }

    // A. Validate Invoice Number
    let numStr = String(rawNumero || '').trim();
    if (!numStr) {
      rowIssues.push({ field: 'numero', severity: 'error', message: 'Número vacío' });
      numStr = `FAC-AUTO-${idx + 1000}`;
    } else {
      const upperNum = numStr.toUpperCase();
      if (seenNumbersInBatch.has(upperNum)) {
        rowIssues.push({ field: 'numero', severity: 'info', message: `Duplicate in batch: ${numStr}` });
      } else {
        seenNumbersInBatch.add(upperNum);
      }
    }

    // B. Validate Client Name
    const clienteStr = String(rawCliente || '').trim();
    if (!clienteStr) {
      rowIssues.push({ field: 'cliente', severity: 'error', message: 'Cliente vacío' });
    }

    // C. Validate Numeric Amount (Importe)
    const parsedAmount = parseRobustNumber(rawImporte);
    if (!parsedAmount.isValid || parsedAmount.value === null) {
      rowIssues.push({ field: 'importe', severity: 'error', message: parsedAmount.error || 'Monto inválido' });
    }

    // D. Validate Issue Date (Fecha)
    const parsedFecha = parseRobustDate(rawFecha);
    if (!parsedFecha.isValid || !parsedFecha.isoDate) {
      rowIssues.push({ field: 'fecha', severity: 'error', message: parsedFecha.error || 'Fecha inválida' });
    }

    // E. Determine Currency
    let currency = 'UYU';
    if (rawMoneda) {
      const monStr = String(rawMoneda).toUpperCase().trim();
      if (monStr.includes('USD') || monStr.includes('DOL') || monStr.includes('U$S') || monStr.includes('US$')) {
        currency = 'USD';
      }
    }

    const hasRowError = rowIssues.some(i => i.severity === 'error');
    allIssues.push(...rowIssues);

    let sanitizedInvoice;
    if (!hasRowError) {
      const validAmount = parsedAmount.value || 0;

      // IVA computation
      const parsedIva = parseRobustNumber(rawIva);
      const ivaAmount = parsedIva.isValid ? (parsedIva.value || 0) : 0;
      const importeColLower = (columnMap.importe || '').toLowerCase();
      const importeAlreadyHasIva = importeColLower.includes('con iva');

      let montoSinIva, montoConIva, ivaMonto;

      if (importeAlreadyHasIva) {
        montoConIva = validAmount;
        ivaMonto = ivaAmount > 0 ? ivaAmount : Math.round((validAmount - validAmount / 1.22) * 100) / 100;
        montoSinIva = Math.round((validAmount - ivaMonto) * 100) / 100;
      } else if (ivaAmount > 0) {
        montoSinIva = validAmount;
        ivaMonto = ivaAmount;
        montoConIva = validAmount + ivaAmount;
      } else {
        montoSinIva = validAmount;
        ivaMonto = Math.round(validAmount * 0.22 * 100) / 100;
        montoConIva = Math.round((validAmount + ivaMonto) * 100) / 100;
      }

      // Compute saldo_pendiente from monto_pagado
      const parsedPagado = parseRobustNumber(rawPagado);
      const montoPagado = parsedPagado.isValid ? (parsedPagado.value || 0) : 0;
      const saldoPendiente = Math.max(0, Math.round((montoConIva - montoPagado) * 100) / 100);

      // Determine estado
      let estadoFactura = 'pendiente';
      if (saldoPendiente <= 0.01) {
        estadoFactura = 'pagada';
      } else if (montoPagado > 0) {
        estadoFactura = 'parcial';
      }

      sanitizedInvoice = {
        id: `inv_imp_${Date.now()}_${idx}`,
        cliente_id: 'cli_imp_' + (clienteStr || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '_'),
        cliente_nombre: clienteStr || 'Cliente Sin Nombre',
        numero: numStr,
        fecha: parsedFecha.isoDate,
        vencimiento: parsedFecha.isoDate,
        importe: montoConIva,
        saldo_pendiente: saldoPendiente,
        monto_sin_iva: montoSinIva,
        monto_con_iva: montoConIva,
        iva_monto: ivaMonto,
        monto_pagado: montoPagado,
        moneda: currency,
        estado: estadoFactura
      };
      sanitizedRows.push(sanitizedInvoice);
    }
  });

  return { sanitizedRows, issues: allIssues };
}

// ─── 6. RUN VALIDATION ──────────────────────────────────────────────────────
console.log('=== VALIDATION (per-row detail) ===');
const validation = validateInvoicesBatch(rows, colMap);
const sanitized = validation.sanitizedRows;

console.log(`Sanitized rows: ${sanitized.length}\n`);

// Print each row
sanitized.forEach(inv => {
  console.log(
    `  ${inv.numero.padEnd(5)} | ` +
    `importe=${String(inv.importe).padStart(8)} | ` +
    `pagado=${String(inv.monto_pagado).padStart(8)} | ` +
    `conIVA=${String(inv.monto_con_iva).padStart(8)} | ` +
    `saldo=${String(inv.saldo_pendiente).padStart(8)} | ` +
    `estado=${inv.estado.padEnd(8)} | ` +
    `cliente=${inv.cliente_nombre}`
  );
});

// ─── 7. IMPORT MERGE (exact copy from ConciliaContext.tsx importInvoices) ────
console.log('\n=== IMPORT MERGE (importInvoices logic) ===');
const merged = new Map();
for (const inv of sanitized) {
  const existing = merged.get(inv.numero);
  if (existing) {
    merged.set(inv.numero, {
      ...existing,
      importe: existing.importe + inv.importe,
      monto_con_iva: (existing.monto_con_iva || existing.importe) + (inv.monto_con_iva || inv.importe),
      saldo_pendiente: existing.saldo_pendiente + inv.saldo_pendiente
      // NOTE: estado is NOT recalculated during merge!
    });
  } else {
    merged.set(inv.numero, { ...inv });
  }
}

const deduplicated = Array.from(merged.values());
console.log(`Unique invoices after merge: ${deduplicated.length}\n`);

// Print merged invoices
console.log(`${'N°'.padEnd(6)} | ${'importe'.padStart(10)} | ${'pagado'.padStart(10)} | ${'conIVA'.padStart(10)} | ${'saldo'.padStart(10)} | ${'estado'.padEnd(8)} | cliente`);
console.log('-'.repeat(100));
deduplicated.forEach(inv => {
  console.log(
    `${inv.numero.padEnd(6)} | ` +
    `${String(inv.importe).padStart(10)} | ` +
    `${String(inv.monto_pagado).padStart(10)} | ` +
    `${String(inv.monto_con_iva).padStart(10)} | ` +
    `${String(inv.saldo_pendiente).padStart(10)} | ` +
    `${inv.estado.padEnd(8)} | ` +
    `${inv.cliente_nombre}`
  );
});

// ─── 8. SUMMARY ─────────────────────────────────────────────────────────────
const pendingInvoices = deduplicated.filter(inv => inv.estado !== 'pagada');
const totalPendingSum = pendingInvoices.reduce((s, inv) => s + inv.saldo_pendiente, 0);

console.log(`\n=== SUMMARY ===`);
console.log(`Total unique invoices: ${deduplicated.length}`);
console.log(`Paid invoices: ${deduplicated.filter(i => i.estado === 'pagada').length}`);
console.log(`Open invoices: ${pendingInvoices.length}`);
console.log(`Total pending (sum saldo_pendiente): $${totalPendingSum.toFixed(2)}`);

// Per-client breakdown (open only)
const clientMap = {};
for (const inv of pendingInvoices) {
  const name = inv.cliente_nombre;
  if (!clientMap[name]) clientMap[name] = { count: 0, sum: 0 };
  clientMap[name].count++;
  clientMap[name].sum += inv.saldo_pendiente;
}

console.log(`\n=== PER-CLIENT BREAKDOWN (open invoices only) ===`);
Object.entries(clientMap)
  .sort((a, b) => b[1].sum - a[1].sum)
  .forEach(([name, data]) => {
    console.log(`  ${name.padEnd(30)} | ${data.count} open | $${data.sum.toFixed(2)}`);
  });

// ─── 9. COMPARE WITH EXPECTED ───────────────────────────────────────────────
console.log(`\n=== COMPARISON WITH EXPECTED ===`);
const expected = {
  totalOpen: 10,
  totalPendingSum: 27907.50,
  clients: {
    'Ferretería Sur': { count: 2, sum: 6832 },
    'Metalúrgica Rioplatense': { count: 1, sum: 54.90 }
  }
};

console.log(`Open invoices: got ${pendingInvoices.length}, expected ${expected.totalOpen} ${pendingInvoices.length === expected.totalOpen ? '✓' : '✗ MISMATCH'}`);
console.log(`Total pending: got $${totalPendingSum.toFixed(2)}, expected $${expected.totalPendingSum.toFixed(2)} ${Math.abs(totalPendingSum - expected.totalPendingSum) < 0.01 ? '✓' : '✗ MISMATCH'}`);

for (const [clientName, exp] of Object.entries(expected.clients)) {
  const got = clientMap[clientName] || { count: 0, sum: 0 };
  const countOk = got.count === exp.count;
  const sumOk = Math.abs(got.sum - exp.sum) < 0.01;
  console.log(`${clientName}: ${got.count} open ($${got.sum.toFixed(2)}) vs expected ${exp.count} open ($${exp.sum.toFixed(2)}) ${countOk && sumOk ? '✓' : '✗ MISMATCH'}`);
}

// ─── 10. DEEP DIVE: CHECK KEY COLUMNS FOR EACH ROW ──────────────────────────
console.log(`\n=== RAW DATA INSPECTION (key columns per row) ===`);
console.log(`${'#'.padStart(3)} | ${'N° Fact'.padEnd(5)} | ${'Col "Monto (con IVA)"'.padEnd(20)} | ${'Col "Monto pagado"'.padEnd(20)} | ${'Col "IVA Ventas"'.padEnd(15)} | ${'Cliente'.padEnd(30)}`);
console.log('-'.repeat(110));
rows.forEach((row, i) => {
  const num = row[colMap.numero];
  const mci = row[colMap.importe];
  const pag = row[colMap.monto_pagado];
  const iva = row[colMap.iva_monto];
  const cli = row[colMap.cliente];
  console.log(
    `${String(i + 1).padStart(3)} | ` +
    `${String(num).padEnd(5)} | ` +
    `${String(mci).padEnd(20)} | ` +
    `${String(pag).padEnd(20)} | ` +
    `${String(iva).padEnd(15)} | ` +
    `${String(cli).padEnd(30)}`
  );
});
