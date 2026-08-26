import { BankMovement, CurrencyCode, Invoice } from '../types';

export interface RowValidationIssue {
  rowIndex: number; // 0-indexed in array, displayed as 1-based or 2-based (with header)
  field: string;
  fieldLabel: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  rawValue: any;
}

export interface RowValidationStatus<T> {
  rowIndex: number;
  rowNumber: number; // 1-based line in file (accounting for header)
  status: 'valid' | 'warning' | 'error';
  issues: RowValidationIssue[];
  sanitizedData?: T;
  rawRow: Record<string, any>;
}

export interface ValidationSummary<T> {
  isValid: boolean; // True if 0 critical errors
  hasCriticalErrors: boolean;
  totalRows: number;
  validRowsCount: number;
  warningRowsCount: number;
  errorRowsCount: number;
  missingRequiredHeaders: Array<{ key: string; label: string }>;
  headerErrors: string[];
  issues: RowValidationIssue[];
  rowStatuses: RowValidationStatus<T>[];
  sanitizedRows: T[];
}

/**
 * Robust numeric parser supporting Latin American (1.234,56), US (1,234.56),
 * currency symbols ($ / UYU / USD / EUR), and whitespace.
 */
export function parseRobustNumber(val: any): {
  value: number | null;
  isValid: boolean;
  error?: string;
  rawString: string;
} {
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

  // Check for common non-numeric placeholder texts
  const invalidKeywords = ['n/a', 'na', 'null', 'undefined', 'pendiente', 'none', '-', '--', 's/d', 'sin dato'];
  if (invalidKeywords.includes(str.toLowerCase())) {
    return { value: null, isValid: false, error: `Valor no numérico detectado: "${str}"`, rawString: str };
  }

  // Clean currency symbols, letters, spaces
  let cleaned = str.replace(/[$€£\s\t\r\n]|UYU|USD|US/gi, '').trim();

  // Handle negative enclosed in parentheses e.g. (100.50) -> -100.50
  let isNegative = false;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1).trim();
  } else if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.substring(1).trim();
  }

  // Detect comma vs dot decimal separators
  // Case 1: Has both dot and comma (e.g. 1.234,56 or 1,234.56)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Latin format: 1.234,56 -> 1234.56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56 -> 1234.56
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Only comma: could be 1234,56 (decimal) or 1,000 (thousands)
    const commaParts = cleaned.split(',');
    if (commaParts.length === 2 && commaParts[1].length <= 2) {
      // Decimal: 45,50 -> 45.50
      cleaned = cleaned.replace(',', '.');
    } else if (commaParts.length > 2) {
      // Multiple commas as thousands: 1,000,000 -> 1000000
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Default to decimal
      cleaned = cleaned.replace(',', '.');
    }
  } else if (cleaned.includes('.')) {
    // Only dot: could be 1234.56 (decimal) or 1.000.000 (thousands)
    const dotParts = cleaned.split('.');
    if (dotParts.length > 2) {
      // Multiple dots -> thousands separator (1.234.567)
      cleaned = cleaned.replace(/\./g, '');
    }
    // Single dot with 3 digits after: leave as-is (treat as decimal, not thousands)
    // e.g. "45.000" stays 45.000 (US decimal), user can override if needed
  }

  // Remove any remaining invalid characters except dot and digits
  const finalStr = (isNegative ? '-' : '') + cleaned.replace(/[^0-9.-]/g, '');
  const num = parseFloat(finalStr);

  if (isNaN(num) || !isFinite(num)) {
    return { value: null, isValid: false, error: `Formato numérico no reconocible: "${str}"`, rawString: str };
  }

  return { value: num, isValid: true, rawString: str };
}

/**
 * Robust date parser supporting YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY,
 * and Excel serial numbers (e.g. 45423).
 */
export function parseRobustDate(val: any): {
  isoDate: string | null;
  isValid: boolean;
  error?: string;
  rawString: string;
} {
  if (val === undefined || val === null || val === '') {
    return { isoDate: null, isValid: false, error: 'Fecha vacía o no especificada', rawString: '' };
  }

  // Handle Excel Serial Number (e.g. 45500 for Aug 2024)
  if (typeof val === 'number' || (!isNaN(Number(val)) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    if (num > 30000 && num < 70000) {
      // Excel epoch starts 1899-12-30 (due to 1900 leap year bug)
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

  // Standard ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:T.*)?$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return validateCalendarDate(year, month, day, str);
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const latMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (latMatch) {
    let day = parseInt(latMatch[1], 10);
    let month = parseInt(latMatch[2], 10);
    let year = parseInt(latMatch[3], 10);

    if (year < 100) {
      year = year >= 70 ? 1900 + year : 2000 + year;
    }

    // In Latin America, DD/MM/YYYY is default. If day > 12 and month <= 12 -> clearly DD/MM.
    // If month > 12 and day <= 12 -> user might have MM/DD/YYYY, swap them.
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }

    return validateCalendarDate(year, month, day, str);
  }

  // Try native Date parsing as fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    return validateCalendarDate(y, m, d, str);
  }

  return { isoDate: null, isValid: false, error: `Formato de fecha no reconocido: "${str}"`, rawString: str };
}

function validateCalendarDate(year: number, month: number, day: number, rawString: string): {
  isoDate: string | null;
  isValid: boolean;
  error?: string;
  rawString: string;
} {
  if (month < 1 || month > 12) {
    return { isoDate: null, isValid: false, error: `Mes inválido (${month}) en fecha: "${rawString}"`, rawString };
  }

  // Check days in month
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return {
      isoDate: null,
      isValid: false,
      error: `Día inválido (${day}) para el mes ${month} (máximo ${daysInMonth} días) en: "${rawString}"`,
      rawString
    };
  }

  // Check year range
  if (year < 1990 || year > 2050) {
    return {
      isoDate: null,
      isValid: false,
      error: `Año fuera de rango razonable (${year}) en fecha: "${rawString}"`,
      rawString
    };
  }

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { isoDate: iso, isValid: true, rawString };
}

/**
 * Validates an invoice file batch before ingestion.
 */
export function validateInvoicesBatch(
  rows: any[],
  columnMap: {
    numero: string;
    cliente: string;
    rut_ci: string;
    fecha: string;
    vencimiento: string;
    importe: string;
    moneda?: string;
    iva_monto?: string;
    monto_pagado?: string;
  },
  existingInvoices: Invoice[] = []
): ValidationSummary<Invoice> {
  const missingHeaders: Array<{ key: string; label: string }> = [];
  const headerErrors: string[] = [];

  // 1. Check required headers
  if (!columnMap.numero || !columnMap.numero.trim()) {
    missingHeaders.push({ key: 'numero', label: 'N° Factura / Comprobante' });
    headerErrors.push('Falta mapear la columna obligatoria "N° Factura"');
  }
  if (!columnMap.cliente || !columnMap.cliente.trim()) {
    missingHeaders.push({ key: 'cliente', label: 'Cliente / Razón Social' });
    headerErrors.push('Falta mapear la columna obligatoria "Cliente / Razón Social"');
  }
  if (!columnMap.fecha || !columnMap.fecha.trim()) {
    missingHeaders.push({ key: 'fecha', label: 'Fecha de Emisión' });
    headerErrors.push('Falta mapear la columna obligatoria "Fecha de Emisión"');
  }
  if (!columnMap.importe || !columnMap.importe.trim()) {
    missingHeaders.push({ key: 'importe', label: 'Importe / Monto Total' });
    headerErrors.push('Falta mapear la columna obligatoria "Importe / Monto Total"');
  }

  const allIssues: RowValidationIssue[] = [];
  const rowStatuses: RowValidationStatus<Invoice>[] = [];
  const sanitizedRows: Invoice[] = [];

  const seenNumbersInBatch = new Set<string>();
  const existingNumbers = new Set(existingInvoices.map(i => i.numero.toUpperCase().trim()));

  rows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2; // Line in file with 1 header
    const rowIssues: RowValidationIssue[] = [];

    // Extract values based on column map
    const rawNumero = columnMap.numero ? rawRow[columnMap.numero] : undefined;
    const rawCliente = columnMap.cliente ? rawRow[columnMap.cliente] : undefined;
    const rawRut = columnMap.rut_ci ? rawRow[columnMap.rut_ci] : undefined;
    const rawFecha = columnMap.fecha ? rawRow[columnMap.fecha] : undefined;
    const rawVencimiento = columnMap.vencimiento ? rawRow[columnMap.vencimiento] : undefined;
    const rawImporte = columnMap.importe ? rawRow[columnMap.importe] : undefined;
    const rawMoneda = columnMap.moneda ? rawRow[columnMap.moneda] : undefined;
    const rawIva = columnMap.iva_monto ? rawRow[columnMap.iva_monto] : undefined;
    const rawPagado = columnMap.monto_pagado ? rawRow[columnMap.monto_pagado] : undefined;

    // Capture alternate client name columns for matching aliases
    const clienteAltNames: string[] = [];
    for (const h of Object.keys(rawRow)) {
      const hNorm = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (hNorm.includes('razon social cliente') || hNorm.includes('razon social') ||
          (hNorm.includes('cliente') && hNorm.includes('proyecto')) ||
          (hNorm.includes('cliente') && !hNorm.includes('nombre'))) {
        const val = String(rawRow[h] || '').trim();
        if (val && val !== String(rawCliente || '').trim()) {
          clienteAltNames.push(val);
        }
      }
    }

    // Check if entire row is empty
    const isRowEmpty = Object.values(rawRow).every(v => v === undefined || v === null || String(v).trim() === '');
    if (isRowEmpty) {
      // Skip silently or flag warning
      rowStatuses.push({
        rowIndex: idx,
        rowNumber,
        status: 'error',
        issues: [{
          rowIndex: idx,
          field: 'general',
          fieldLabel: 'Fila Completa',
          severity: 'error',
          message: 'Fila completamente vacía o en blanco en el archivo',
          rawValue: rawRow
        }],
        rawRow
      });
      return;
    }

    // Skip TOTAL / summary rows — scan all fields for summary keywords
    const allValuesStr = Object.values(rawRow).map(v => String(v || '')).join(' ').toLowerCase();
    const summaryKeywords = ['totales', 'total neto', 'total general', 'subtotal', 'sumas', 'grand total', 'totaux'];
    if (summaryKeywords.some(kw => allValuesStr.includes(kw))) {
      const keyFieldEmpty = !String(rawNumero || '').trim();
      const dateFieldEmpty = !String(rawFecha || '').trim();
      const clienteFieldEmpty = !String(rawCliente || '').trim();
      if (keyFieldEmpty || dateFieldEmpty || clienteFieldEmpty) {
        return;
      }
    }

    // A. Validate Invoice Number
    let numStr = String(rawNumero || '').trim();
    if (!numStr) {
      rowIssues.push({
        rowIndex: idx,
        field: 'numero',
        fieldLabel: 'N° Factura',
        severity: 'error',
        message: 'El número de factura es obligatorio y está vacío en esta fila.',
        rawValue: rawNumero
      });
      numStr = `FAC-AUTO-${idx + 1000}`;
    } else {
      const upperNum = numStr.toUpperCase();
      if (seenNumbersInBatch.has(upperNum)) {
        rowIssues.push({
          rowIndex: idx,
          field: 'numero',
          fieldLabel: 'N° Factura',
          severity: 'info',
          message: `Línea adicional de factura ${numStr} (se sumará al total).`,
          rawValue: rawNumero
        });
      } else {
        seenNumbersInBatch.add(upperNum);
      }

      if (existingNumbers.has(upperNum)) {
        rowIssues.push({
          rowIndex: idx,
          field: 'numero',
          fieldLabel: 'N° Factura',
          severity: 'warning',
          message: `La factura "${numStr}" ya existe registrada en el sistema.`,
          rawValue: rawNumero
        });
      }
    }

    // B. Validate Client Name
    const clienteStr = String(rawCliente || '').trim();
    if (!clienteStr) {
      rowIssues.push({
        rowIndex: idx,
        field: 'cliente',
        fieldLabel: 'Cliente',
        severity: 'error',
        message: 'La razón social o nombre del cliente es obligatoria.',
        rawValue: rawCliente
      });
    }

    // C. Validate Numeric Amount (Importe)
    const parsedAmount = parseRobustNumber(rawImporte);
    if (!parsedAmount.isValid || parsedAmount.value === null) {
      rowIssues.push({
        rowIndex: idx,
        field: 'importe',
        fieldLabel: 'Importe',
        severity: 'error',
        message: parsedAmount.error || `Monto inválido "${rawImporte}"`,
        rawValue: rawImporte
      });
    } else if (parsedAmount.value <= 0) {
      rowIssues.push({
        rowIndex: idx,
        field: 'importe',
        fieldLabel: 'Importe',
        severity: 'warning',
        message: `Importe de factura es $${parsedAmount.value} (cero o negativo). Verifica si es nota de crédito.`,
        rawValue: rawImporte
      });
    }

    // D. Validate Issue Date (Fecha)
    const parsedFecha = parseRobustDate(rawFecha);
    if (!parsedFecha.isValid || !parsedFecha.isoDate) {
      rowIssues.push({
        rowIndex: idx,
        field: 'fecha',
        fieldLabel: 'Fecha Emisión',
        severity: 'error',
        message: parsedFecha.error || `Fecha de emisión inválida "${rawFecha}"`,
        rawValue: rawFecha
      });
    }

    // E. Validate Due Date (Vencimiento) & Date Inconsistency
    let vencimientoIso = parsedFecha.isoDate || new Date().toISOString().split('T')[0];
    if (rawVencimiento && String(rawVencimiento).trim()) {
      const parsedVenc = parseRobustDate(rawVencimiento);
      if (!parsedVenc.isValid || !parsedVenc.isoDate) {
        rowIssues.push({
          rowIndex: idx,
          field: 'vencimiento',
          fieldLabel: 'Vencimiento',
          severity: 'warning',
          message: `Fecha de vencimiento inválida "${rawVencimiento}". Se asignará igual a la de emisión.`,
          rawValue: rawVencimiento
        });
      } else {
        vencimientoIso = parsedVenc.isoDate;
        // Inconsistency check: Vencimiento before Issue Date
        if (parsedFecha.isoDate && vencimientoIso < parsedFecha.isoDate) {
          rowIssues.push({
            rowIndex: idx,
            field: 'vencimiento',
            fieldLabel: 'Vencimiento',
            severity: 'warning',
            message: `Inconsistencia de fechas: Vencimiento (${vencimientoIso}) es anterior a Emisión (${parsedFecha.isoDate}).`,
            rawValue: rawVencimiento
          });
        }
      }
    }

    // F. Determine Currency
    let currency: CurrencyCode = 'UYU';
    if (rawMoneda) {
      const monStr = String(rawMoneda).toUpperCase().trim();
      if (monStr.includes('USD') || monStr.includes('DOL') || monStr.includes('U$S') || monStr.includes('US$')) {
        currency = 'USD';
      }
    } else if (columnMap.importe) {
      const importeHeader = String(columnMap.importe).toUpperCase();
      if (importeHeader.includes('USD') || importeHeader.includes('DOL') || importeHeader.includes('U$S') || importeHeader.includes('US$')) {
        currency = 'USD';
      }
    }

    // Row status summary
    const hasRowError = rowIssues.some(i => i.severity === 'error');
    const hasRowWarning = rowIssues.some(i => i.severity === 'warning');
    const status: 'valid' | 'warning' | 'error' = hasRowError ? 'error' : hasRowWarning ? 'warning' : 'valid';

    allIssues.push(...rowIssues);

    let sanitizedInvoice: Invoice | undefined;
    if (!hasRowError) {
      const validAmount = parsedAmount.value || 0;

      // IVA computation: determine if importe already includes IVA
      const parsedIva = parseRobustNumber(rawIva);
      const ivaAmount = parsedIva.isValid ? (parsedIva.value || 0) : 0;
      const importeColLower = (columnMap.importe || '').toLowerCase();
      const importeAlreadyHasIva = importeColLower.includes('con iva');

      let montoSinIva: number;
      let montoConIva: number;
      let ivaMonto: number;

      if (importeAlreadyHasIva) {
        // Importe column already has IVA (e.g. "Monto (con IVA)")
        montoConIva = validAmount;
        ivaMonto = ivaAmount > 0 ? ivaAmount : Math.round((validAmount - validAmount / 1.22) * 100) / 100;
        montoSinIva = Math.round((validAmount - ivaMonto) * 100) / 100;
      } else if (ivaAmount > 0) {
        // IVA column mapped and has value → add to importe
        montoSinIva = validAmount;
        ivaMonto = ivaAmount;
        montoConIva = validAmount + ivaAmount;
      } else {
        // No IVA column or empty → apply default 22%
        montoSinIva = validAmount;
        ivaMonto = Math.round(validAmount * 0.22 * 100) / 100;
        montoConIva = Math.round((validAmount + ivaMonto) * 100) / 100;
      }

      // Compute saldo_pendiente from monto_pagado
      // $1 tolerance for overpayment rounding noise: if pagado exceeds conIva by < $1,
      // treat as rounding and keep saldo at zero (no allocation needed)
      const parsedPagado = parseRobustNumber(rawPagado);
      const montoPagado = parsedPagado.isValid ? (parsedPagado.value || 0) : 0;
      const rawSaldo = montoConIva - montoPagado;
      const saldoPendiente = rawSaldo > 0
        ? Math.round(rawSaldo * 100) / 100
        : 0; // overpaid (even by cents) → zero pending

      // Determine estado based on payment
      let estadoFactura: 'pendiente' | 'parcial' | 'pagada' = 'pendiente';
      if (saldoPendiente <= 0.01) {
        estadoFactura = 'pagada';
      } else if (montoPagado > 0) {
        estadoFactura = 'parcial';
      }

      sanitizedInvoice = {
        id: `inv_imp_${Date.now()}_${idx}`,
        cliente_id: 'cli_imp_' + (clienteStr || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '_'),
        cliente_nombre: clienteStr || 'Cliente Sin Nombre',
        cliente_rut: rawRut ? String(rawRut).trim() : undefined,
        cliente_nombre_alt: clienteAltNames.length > 0 ? clienteAltNames : undefined,
        numero: numStr,
        fecha: parsedFecha.isoDate || new Date().toISOString().split('T')[0],
        vencimiento: vencimientoIso,
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

    rowStatuses.push({
      rowIndex: idx,
      rowNumber,
      status,
      issues: rowIssues,
      sanitizedData: sanitizedInvoice,
      rawRow
    });
  });

  const criticalErrorsCount = rowStatuses.filter(r => r.status === 'error').length;
  const warningCount = rowStatuses.filter(r => r.status === 'warning').length;
  const validCount = rowStatuses.filter(r => r.status === 'valid').length;

  const hasCriticalErrors = missingHeaders.length > 0 || criticalErrorsCount > 0;

  return {
    isValid: !hasCriticalErrors,
    hasCriticalErrors,
    totalRows: rows.length,
    validRowsCount: validCount,
    warningRowsCount: warningCount,
    errorRowsCount: criticalErrorsCount,
    missingRequiredHeaders: missingHeaders,
    headerErrors,
    issues: allIssues,
    rowStatuses,
    sanitizedRows
  };
}

/**
 * Validates a bank statement file batch before ingestion.
 */
export function validateBankMovementsBatch(
  rows: any[],
  columnMap: {
    fecha: string;
    monto: string;
    descripcion: string;
    referencia: string;
    banco: string;
    moneda?: string;
  },
  existingMovements: BankMovement[] = []
): ValidationSummary<BankMovement> {
  const missingHeaders: Array<{ key: string; label: string }> = [];
  const headerErrors: string[] = [];

  // 1. Check required headers
  if (!columnMap.fecha || !columnMap.fecha.trim()) {
    missingHeaders.push({ key: 'fecha', label: 'Fecha de Operación' });
    headerErrors.push('Falta mapear la columna obligatoria "Fecha de Operación"');
  }
  if (!columnMap.monto || !columnMap.monto.trim()) {
    missingHeaders.push({ key: 'monto', label: 'Monto / Crédito' });
    headerErrors.push('Falta mapear la columna obligatoria "Monto / Crédito"');
  }
  if (!columnMap.descripcion || !columnMap.descripcion.trim()) {
    missingHeaders.push({ key: 'descripcion', label: 'Descripción / Concepto' });
    headerErrors.push('Falta mapear la columna obligatoria "Descripción / Concepto"');
  }

  const allIssues: RowValidationIssue[] = [];
  const rowStatuses: RowValidationStatus<BankMovement>[] = [];
  const sanitizedRows: BankMovement[] = [];

  const existingMovementKeys = new Set(
    existingMovements.map(m => `${m.fecha}_${m.monto}_${(m.referencia || '').trim().toUpperCase()}`)
  );

  rows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2;
    const rowIssues: RowValidationIssue[] = [];

    // Extract values
    const rawFecha = columnMap.fecha ? rawRow[columnMap.fecha] : undefined;
    const rawMonto = columnMap.monto ? rawRow[columnMap.monto] : undefined;
    const rawDesc = columnMap.descripcion ? rawRow[columnMap.descripcion] : undefined;
    const rawRef = columnMap.referencia ? rawRow[columnMap.referencia] : undefined;
    const rawBanco = columnMap.banco ? rawRow[columnMap.banco] : undefined;
    const rawMoneda = columnMap.moneda ? rawRow[columnMap.moneda] : undefined;

    // Check if entire row is empty
    const isRowEmpty = Object.values(rawRow).every(v => v === undefined || v === null || String(v).trim() === '');
    if (isRowEmpty) {
      rowStatuses.push({
        rowIndex: idx,
        rowNumber,
        status: 'error',
        issues: [{
          rowIndex: idx,
          field: 'general',
          fieldLabel: 'Fila Completa',
          severity: 'error',
          message: 'Fila completamente vacía en el extracto bancario',
          rawValue: rawRow
        }],
        rawRow
      });
      return;
    }

    // Skip TOTAL / summary rows — scan all fields for summary keywords
    const allValuesStr = Object.values(rawRow).map(v => String(v || '')).join(' ').toLowerCase();
    const summaryKws = ['totales', 'total neto', 'total general', 'subtotal', 'sumas', 'grand total', 'totaux'];
    if (summaryKws.some(kw => allValuesStr.includes(kw))) {
      const dateEmpty = !String(rawFecha || '').trim();
      const descEmpty = !String(rawDesc || '').trim();
      if (dateEmpty || descEmpty) {
        return;
      }
    }

    // Skip debits (only credits are reconcilable for accounts receivable)
    // Scan all columns for credit/debit indicator — header might be named anything
    let isDebit = false;
    for (const key of Object.keys(rawRow)) {
      const kNorm = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (kNorm.includes('credito/debito') || kNorm.includes('tipo operacion') || kNorm.includes('tipo mov')) {
        const val = String(rawRow[key] || '').trim().toLowerCase();
        if (val === 'debit' || val === 'débito' || val === 'debito' || val === 'd' || val === 'deb') {
          isDebit = true;
        }
        break;
      }
    }
    if (isDebit) {
      rowStatuses.push({
        rowIndex: idx,
        rowNumber,
        status: 'warning',
        issues: [{
          rowIndex: idx,
          field: 'monto',
          fieldLabel: 'Tipo Operación',
          severity: 'warning',
          message: 'Fila omitida: es un débito (egreso). Solo los créditos (ingresos) concilian cobranzas de facturas.',
          rawValue: 'debit'
        }],
        rawRow
      });
      return;
    }

    // A. Validate Date
    const parsedFecha = parseRobustDate(rawFecha);
    if (!parsedFecha.isValid || !parsedFecha.isoDate) {
      rowIssues.push({
        rowIndex: idx,
        field: 'fecha',
        fieldLabel: 'Fecha Operación',
        severity: 'error',
        message: parsedFecha.error || `Fecha de extracto inválida "${rawFecha}"`,
        rawValue: rawFecha
      });
    }

    // B. Validate Numeric Amount (Monto)
    const parsedAmount = parseRobustNumber(rawMonto);
    if (!parsedAmount.isValid || parsedAmount.value === null) {
      rowIssues.push({
        rowIndex: idx,
        field: 'monto',
        fieldLabel: 'Monto',
        severity: 'error',
        message: parsedAmount.error || `Monto inválido "${rawMonto}"`,
        rawValue: rawMonto
      });
    } else if (parsedAmount.value <= 0) {
      rowIssues.push({
        rowIndex: idx,
        field: 'monto',
        fieldLabel: 'Monto',
        severity: 'warning',
        message: `Monto bancario es $${parsedAmount.value} (débito o monto cero). Solo los créditos/depósitos positivos concilian cobranzas.`,
        rawValue: rawMonto
      });
    }

    // C. Validate Description
    const descStr = String(rawDesc || '').trim();
    if (!descStr) {
      rowIssues.push({
        rowIndex: idx,
        field: 'descripcion',
        fieldLabel: 'Descripción',
        severity: 'error',
        message: 'La glosa o concepto bancario está vacío en esta fila.',
        rawValue: rawDesc
      });
    }

    // D. Validate Reference & Duplicate Check
    const refStr = rawRef ? String(rawRef).trim() : `REF-${Date.now()}-${idx}`;
    if (parsedFecha.isoDate && parsedAmount.value) {
      const movKey = `${parsedFecha.isoDate}_${parsedAmount.value}_${refStr.toUpperCase()}`;
      if (existingMovementKeys.has(movKey)) {
        rowIssues.push({
          rowIndex: idx,
          field: 'referencia',
          fieldLabel: 'Referencia',
          severity: 'warning',
          message: `Posible movimiento duplicado: Coincide fecha (${parsedFecha.isoDate}), monto ($${parsedAmount.value}) y referencia (${refStr}) con un registro previo.`,
          rawValue: rawRef
        });
      }
    }

    // E. Determine Currency
    let currency: CurrencyCode = 'UYU';
    if (rawMoneda) {
      const monStr = String(rawMoneda).toUpperCase().trim();
      if (monStr.includes('USD') || monStr.includes('DOL') || monStr.includes('U$S') || monStr.includes('US$')) {
        currency = 'USD';
      }
    } else if (columnMap.monto) {
      // Also detect currency from the amount column header (e.g., "Monto (USD)")
      const montoHeader = String(columnMap.monto).toUpperCase();
      if (montoHeader.includes('USD') || montoHeader.includes('DOL') || montoHeader.includes('U$S') || montoHeader.includes('US$')) {
        currency = 'USD';
      }
    }

    // Determine Status
    const hasRowError = rowIssues.some(i => i.severity === 'error');
    const hasRowWarning = rowIssues.some(i => i.severity === 'warning');
    const status: 'valid' | 'warning' | 'error' = hasRowError ? 'error' : hasRowWarning ? 'warning' : 'valid';

    allIssues.push(...rowIssues);

    let sanitizedMov: BankMovement | undefined;
    if (!hasRowError) {
      const validMonto = parsedAmount.value || 0;
      sanitizedMov = {
        id: `mov_imp_${Date.now()}_${idx}`,
        fecha: parsedFecha.isoDate || new Date().toISOString().split('T')[0],
        monto: validMonto,
        moneda: currency,
        descripcion_cruda: descStr || 'Transferencia recibida',
        referencia: refStr,
        origen_banco: rawBanco ? String(rawBanco).trim() : 'Banco Principal',
        estado_conciliacion: 'sin_identificar',
        confianza: 0
      };
      sanitizedRows.push(sanitizedMov);
    }

    rowStatuses.push({
      rowIndex: idx,
      rowNumber,
      status,
      issues: rowIssues,
      sanitizedData: sanitizedMov,
      rawRow
    });
  });

  const criticalErrorsCount = rowStatuses.filter(r => r.status === 'error').length;
  const warningCount = rowStatuses.filter(r => r.status === 'warning').length;
  const validCount = rowStatuses.filter(r => r.status === 'valid').length;

  const hasCriticalErrors = missingHeaders.length > 0 || criticalErrorsCount > 0;

  return {
    isValid: !hasCriticalErrors,
    hasCriticalErrors,
    totalRows: rows.length,
    validRowsCount: validCount,
    warningRowsCount: warningCount,
    errorRowsCount: criticalErrorsCount,
    missingRequiredHeaders: missingHeaders,
    headerErrors,
    issues: allIssues,
    rowStatuses,
    sanitizedRows
  };
}
