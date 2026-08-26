import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  FileType,
  Filter,
  HelpCircle,
  Info,
  Layers,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table,
  UploadCloud,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { useConcilia } from '../context/ConciliaContext';
import { BankMovement, Invoice } from '../types';
import {
  generateSampleBankCSV,
  generateSampleBankWithErrorsCSV,
  generateSampleInvoicesCSV,
  generateSampleInvoicesWithErrorsCSV
} from '../data/mockData';
import {
  validateBankMovementsBatch,
  validateInvoicesBatch,
  ValidationSummary
} from '../utils/fileValidation';

export const UploadView: React.FC = () => {
  const { invoices, bankMovements, importInvoices, importBankMovements, setActiveTab, company } = useConcilia();

  const [activeUploadType, setActiveUploadType] = useState<'invoices' | 'movements'>('invoices');
  const [ingestMode, setIngestMode] = useState<'file' | 'clipboard'>('file');
  const [clipboardText, setClipboardText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter state for validation preview
  const [validationFilter, setValidationFilter] = useState<'all' | 'errors' | 'warnings' | 'valid'>('all');
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);

  // Column mapping states
  const [invoiceColMap, setInvoiceColMap] = useState<{
    numero: string;
    cliente: string;
    rut_ci: string;
    fecha: string;
    vencimiento: string;
    importe: string;
    moneda: string;
  }>({
    numero: '',
    cliente: '',
    rut_ci: '',
    fecha: '',
    vencimiento: '',
    importe: '',
    moneda: ''
  });

  const [bankColMap, setBankColMap] = useState<{
    fecha: string;
    monto: string;
    descripcion: string;
    referencia: string;
    banco: string;
    moneda: string;
  }>({
    fecha: '',
    monto: '',
    descripcion: '',
    referencia: '',
    banco: '',
    moneda: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: auto-detect column headers based on common names — works with ANY format
  const autoDetectColumns = (headers: string[], type: 'invoices' | 'movements') => {
    const norm = headers.map(h => h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

    // Generic finder: tries patterns in priority order, returns original header name
    const findBest = (patterns: string[]): string => {
      for (const p of patterns) {
        const idx = norm.findIndex(h => h.includes(p));
        if (idx !== -1) return headers[idx];
      }
      return '';
    };

    // Detect Crédito/Débito column if present (used to filter debits)
    const foundCreditoDebito = findBest(['credito/debito', 'credito debito', 'tipo operacion', 'tipo', 'movemento', 'operacion']);

    if (type === 'invoices') {
      setInvoiceColMap({
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
        moneda: findBest(['moneda', 'curr', 'currency', 'mon', 'divisa'])
      });
    } else {
      setBankColMap({
        fecha: findBest([
          'fecha operacion', 'fecha de operacion', 'fecha operación',
          'fecha', 'date', 'fec', 'dia', 'day', 'fecha movimiento'
        ]) || headers[0] || '',
        monto: findBest([
          'monto (usd)', 'monto (uyu)', 'monto total', 'monto usd',
          'credito', 'abono', 'deposito', 'importe', 'monto',
          'valor', 'amount', 'monto mov', 'saldo', 'balance'
        ]) || '',
        descripcion: findBest([
          'concepto', 'descripcion', 'descripción', 'detalle',
          'glosa', 'movimiento', 'memo', 'obs', 'observaciones',
          'detail', 'description', 'concept'
        ]) || '',
        referencia: findBest([
          'referencia', 'ref', 'n de referencia', 'n° referencia',
          'comprobante', 'id', 'operacion', 'transaccion',
          'factura', 'n de factura', 'n° de factura', 'n° factura',
          'reference', 'ticket', 'voucher'
        ]),
        banco: findBest(['banco', 'origen', 'cuenta', 'bank', 'entidad', 'sucursal']),
        moneda: findBest(['moneda', 'curr', 'currency', 'mon', 'divisa'])
      });

      // Store detected Crédito/Débito column for filtering debits
      if (foundCreditoDebito) {
        setBankColMap(prev => ({ ...prev, moneda: prev.moneda })); // keep existing
        // We'll use it in validation via rawRow access
      }
    }
  };

  // Run validation engine on parsed rows and active column map
  const validationSummary = useMemo(() => {
    if (parsedRows.length === 0) return null;

    if (activeUploadType === 'invoices') {
      return validateInvoicesBatch(parsedRows, invoiceColMap, invoices);
    } else {
      return validateBankMovementsBatch(parsedRows, bankColMap, bankMovements);
    }
  }, [parsedRows, activeUploadType, invoiceColMap, bankColMap, invoices, bankMovements]);

  // Filtered rows for the preview table
  const filteredRowStatuses = useMemo(() => {
    if (!validationSummary) return [];
    if (validationFilter === 'all') return validationSummary.rowStatuses;
    if (validationFilter === 'errors') return validationSummary.rowStatuses.filter(r => r.status === 'error');
    if (validationFilter === 'warnings') return validationSummary.rowStatuses.filter(r => r.status === 'warning');
    if (validationFilter === 'valid') return validationSummary.rowStatuses.filter(r => r.status === 'valid');
    return validationSummary.rowStatuses;
  }, [validationSummary, validationFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setFileName(file.name);
    setValidationFilter('all');
    setExpandedRowIndex(null);

    const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv';

    if (isCSV) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const headers = results.meta.fields || Object.keys(results.data[0] as object);
            setDetectedHeaders(headers);
            setParsedRows(results.data);
            autoDetectColumns(headers, activeUploadType);
          } else {
            setErrorMsg('El archivo CSV parece estar vacío o no contiene filas válidas.');
          }
        },
        error: (err) => {
          setErrorMsg('Error al parsear el archivo CSV: ' + err.message);
        }
      });
    } else {
      // Excel (.xlsx, .xls)
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (json && json.length > 0) {
            const headers = Object.keys(json[0] as object);
            setDetectedHeaders(headers);
            setParsedRows(json);
            autoDetectColumns(headers, activeUploadType);
          } else {
            setErrorMsg('La hoja de cálculo está vacía o sin encabezados legibles.');
          }
        } catch (err: any) {
          setErrorMsg('Error al leer el archivo Excel: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDownloadSample = (type: 'invoices' | 'movements') => {
    const csvContent = type === 'invoices' ? generateSampleInvoicesCSV() : generateSampleBankCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', type === 'invoices' ? 'plantilla_facturas_ejemplo.csv' : 'plantilla_extracto_banco_ejemplo.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadSampleData = (type: 'invoices' | 'movements', withErrors: boolean = false) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setValidationFilter('all');
    setExpandedRowIndex(null);

    let csv: string;
    let name: string;

    if (type === 'invoices') {
      csv = withErrors ? generateSampleInvoicesWithErrorsCSV() : generateSampleInvoicesCSV();
      name = withErrors ? 'demo_facturas_con_inconsistencias.csv' : 'demo_facturas_distribuidora.csv';
    } else {
      csv = withErrors ? generateSampleBankWithErrorsCSV() : generateSampleBankCSV();
      name = withErrors ? 'demo_extracto_con_inconsistencias.csv' : 'demo_extracto_bancario_agosto.csv';
    }

    Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || Object.keys(results.data[0] as object);
        setDetectedHeaders(headers);
        setParsedRows(results.data);
        setFileName(name);
        setActiveUploadType(type);
        autoDetectColumns(headers, type);
      }
    });
  };

  const handleParseClipboard = () => {
    if (!clipboardText.trim()) {
      setErrorMsg('Por favor pega el contenido copiado desde tu Excel antes de continuar.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setFileName('Datos_pegados_desde_Excel');
    setValidationFilter('all');
    setExpandedRowIndex(null);

    Papa.parse(clipboardText.trim(), {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const headers = results.meta.fields || Object.keys(results.data[0] as object);
          setDetectedHeaders(headers);
          setParsedRows(results.data);
          autoDetectColumns(headers, activeUploadType);
        } else {
          setErrorMsg('No se detectaron filas o columnas válidas en el texto pegado. Asegúrate de incluir los encabezados al copiar.');
        }
      },
      error: (err) => {
        setErrorMsg('Error al interpretar datos de Excel: ' + err.message);
      }
    });
  };

  const handleConfirmImport = (onlyValidRows: boolean = false) => {
    if (!validationSummary || validationSummary.sanitizedRows.length === 0) {
      setErrorMsg('No hay filas válidas listas para importar. Revisa los errores críticos en la validación.');
      return;
    }

    if (validationSummary.missingRequiredHeaders.length > 0) {
      setErrorMsg(`Falta mapear encabezados obligatorios: ${validationSummary.missingRequiredHeaders.map(h => h.label).join(', ')}.`);
      return;
    }

    if (activeUploadType === 'invoices') {
      const sanitizedInvoices = validationSummary.sanitizedRows as Invoice[];
      importInvoices(sanitizedInvoices);

      const skippedCount = validationSummary.totalRows - sanitizedInvoices.length;
      if (skippedCount > 0) {
        setSuccessMsg(`¡Se importaron exitosamente ${sanitizedInvoices.length} facturas validadas! (${skippedCount} filas con errores fueron omitidas).`);
      } else {
        setSuccessMsg(`¡Se importaron exitosamente ${sanitizedInvoices.length} facturas 100% validadas!`);
      }
    } else {
      const sanitizedMovements = validationSummary.sanitizedRows as BankMovement[];
      importBankMovements(sanitizedMovements);

      const skippedCount = validationSummary.totalRows - sanitizedMovements.length;
      if (skippedCount > 0) {
        setSuccessMsg(`¡Se importaron exitosamente ${sanitizedMovements.length} movimientos validados (${skippedCount} omitidos)! Ejecutando motor de matching...`);
      } else {
        setSuccessMsg(`¡Se importaron exitosamente ${sanitizedMovements.length} movimientos bancarios validados! Ejecutando motor de matching...`);
      }

      setTimeout(() => {
        setSuccessMsg(prev => prev ? prev.replace(' Ejecutando motor de matching...', '') : prev);
      }, 400);
    }

    setParsedRows([]);
    setFileName('');
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Carga de Archivos & Ingesta</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                Capa de Validación Activa
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Sube tus facturas pendientes de cobro y extractos bancarios. La capa de validación audita encabezados, formatos numéricos y coherencia de fechas antes de alimentar el motor de matching.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleLoadSampleData('invoices', false)}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors flex items-center space-x-1"
              title="Carga archivo de ejemplo limpio"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Facturas Demo</span>
            </button>
            <button
              onClick={() => handleLoadSampleData('movements', false)}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center space-x-1"
              title="Carga extracto limpio"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Extracto Demo</span>
            </button>
            <button
              onClick={() => handleLoadSampleData('invoices', true)}
              className="px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 rounded-lg transition-colors flex items-center space-x-1 border border-amber-300/80"
              title="Probar detección de errores numéricos, fechas inconsistentes y duplicados"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
              <span>Probar Errores e Inconsistencias</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIngestMode('file')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center space-x-2 ${
              ingestMode === 'file'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            <span>Subir Archivo (.xlsx / .csv)</span>
          </button>

          <button
            onClick={() => setIngestMode('clipboard')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center space-x-2 ${
              ingestMode === 'clipboard'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            <ClipboardPaste className="h-4 w-4" />
            <span>Pegar directo de Excel (Ctrl+C / Ctrl+V)</span>
          </button>
        </div>

        <span className="hidden sm:inline-block text-xs text-slate-500 dark:text-slate-400">
          {ingestMode === 'clipboard'
            ? 'Copia celdas en tu Excel y pégalas aquí sin guardar archivo'
            : 'Soporta archivos Excel nativos o CSV de cualquier banco y ERP'}
        </span>
      </div>

      {ingestMode === 'clipboard' ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ClipboardPaste className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span>Pegar Celdas Copiadas desde Excel</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Selecciona las celdas en tu hoja de cálculo (incluyendo la fila de títulos), presiona <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[11px] font-mono text-slate-700 dark:text-slate-300">Ctrl+C</kbd> y pégalas abajo con <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[11px] font-mono text-slate-700 dark:text-slate-300">Ctrl+V</kbd>.
              </p>
            </div>

            {/* Invoices vs Movements Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
              <button
                onClick={() => setActiveUploadType('invoices')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeUploadType === 'invoices'
                    ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                1. Son Facturas
              </button>
              <button
                onClick={() => setActiveUploadType('movements')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeUploadType === 'movements'
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                2. Es Extracto Bancario
              </button>
            </div>
          </div>

          <textarea
            value={clipboardText}
            onChange={(e) => setClipboardText(e.target.value)}
            rows={7}
            placeholder={
              activeUploadType === 'invoices'
                ? "N° Factura\tCliente\tRUT\tFecha\tVencimiento\tImporte\nFAC-1042\tSupermercado El Sol\t219876540012\t2026-08-01\t2026-08-15\t45000\nFAC-1043\tFarmacia San Roque\t218765430018\t2026-08-05\t2026-08-20\t28500"
                : "Fecha\tMonto\tDescripción\tReferencia\tBanco\n2026-08-12\t45000\tTRF SPI EL SOL S.A.\tTRF-889102\tBanco Itaú\n2026-08-14\t28500\tPAGO FARM ROQUE\t9920112\tBROU"
            }
            className="w-full font-mono text-xs p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 dark:text-slate-200 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setClipboardText('')}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Limpiar texto
            </button>

            <button
              onClick={handleParseClipboard}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Validar & Procesar Datos Pegados</span>
            </button>
          </div>
        </div>
      ) : (
        /* Dual Cards Selector */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Facturas */}
          <div
            onClick={() => {
              setActiveUploadType('invoices');
              if (fileInputRef.current) fileInputRef.current.click();
            }}
            className={`
              cursor-pointer bg-white dark:bg-slate-800 rounded-2xl p-6 border-2 transition-all relative overflow-hidden group
              ${activeUploadType === 'invoices' && parsedRows.length > 0
                ? 'border-blue-500 bg-blue-50/20 shadow-md ring-2 ring-blue-500/20'
                : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50/60'
              }
            `}
          >
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full border border-blue-200/60 dark:border-blue-800">
                Paso 1
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                1. Subir Facturas Pendientes
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Exportado de tu ERP (Memory, Conty, Odoo, GNS, Excel). Incluye N° de factura, cliente, RUT, fecha e importe.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center">
                <UploadCloud className="h-4 w-4 mr-1.5" />
                Arrastrar o Seleccionar (.xlsx, .csv)
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadSample('invoices');
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center font-medium hover:underline"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Plantilla CSV
              </button>
            </div>
          </div>

          {/* Card 2: Extracto Bancario */}
          <div
            onClick={() => {
              setActiveUploadType('movements');
              if (fileInputRef.current) fileInputRef.current.click();
            }}
            className={`
              cursor-pointer bg-white dark:bg-slate-800 rounded-2xl p-6 border-2 transition-all relative overflow-hidden group
              ${activeUploadType === 'movements' && parsedRows.length > 0
                ? 'border-indigo-500 bg-indigo-50/20 shadow-md ring-2 ring-indigo-500/20'
                : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:bg-slate-50/60'
              }
            `}
          >
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileType className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200/60">
                Paso 2
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                2. Subir Movimientos Bancarios
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Extracto de tu banco (Itaú, BROU, Santander, BBVA, Scotiabank). El sistema tolerará descripciones desordenadas y referencias crudas.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
              <span className="text-xs font-semibold text-indigo-600 flex items-center">
                <UploadCloud className="h-4 w-4 mr-1.5" />
                Arrastrar o Seleccionar (.xlsx, .csv)
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadSample('movements');
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center font-medium hover:underline"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Plantilla CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        className="hidden"
      />

      {/* Alert Notifications */}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 dark:text-red-500 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 px-4 py-3.5 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className="px-3.5 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-1 shadow-xs"
          >
            <span>Ir a Conciliación</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Preview & Validation Layer Section */}
      {parsedRows.length > 0 && validationSummary && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6 animate-in fade-in duration-300">
          {/* Top Ingestion Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 dark:text-white text-lg">
                  Previsualización & Control de Calidad: {activeUploadType === 'invoices' ? 'Facturas' : 'Extracto Bancario'}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full">
                  {parsedRows.length} filas leídas
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Archivo origen: <span className="font-medium text-slate-700 dark:text-slate-300">{fileName}</span></p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setParsedRows([]);
                  setFileName('');
                  setErrorMsg(null);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
              >
                Cancelar
              </button>

              {/* Action buttons depending on validation state */}
              {validationSummary.isValid ? (
                <button
                  onClick={() => handleConfirmImport(false)}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>Confirmar Ingesta ({validationSummary.sanitizedRows.length} Validadas)</span>
                </button>
              ) : validationSummary.sanitizedRows.length > 0 ? (
                <button
                  onClick={() => handleConfirmImport(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                  title={`Importar solo las ${validationSummary.sanitizedRows.length} filas sin errores críticos`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>Importar {validationSummary.sanitizedRows.length} Válidas (Omitir {validationSummary.errorRowsCount} con error)</span>
                </button>
              ) : (
                <button
                  disabled
                  className="px-4 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 rounded-xl cursor-not-allowed flex items-center space-x-1.5"
                >
                  <ShieldAlert className="h-4 w-4 text-red-400" />
                  <span>Bloqueado por Errores Críticos</span>
                </button>
              )}
            </div>
          </div>

          {/* Validation Status Cards (Quality Inspection Dashboard) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Global Status */}
            <div className={`p-4 rounded-xl border flex items-center space-x-3 ${
              validationSummary.isValid
                ? 'bg-emerald-50/70 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-900'
                : validationSummary.errorRowsCount > 0
                ? 'bg-red-50/70 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900'
                : 'bg-amber-50/70 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-900'
            }`}>
              <div className={`p-2.5 rounded-lg shrink-0 ${
                validationSummary.isValid
                  ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-400'
                  : validationSummary.errorRowsCount > 0
                  ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-400'
                  : 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-400'
              }`}>
                {validationSummary.isValid ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Estado Validación</p>
                <p className="text-sm font-bold">
                  {validationSummary.isValid
                    ? '100% Válido'
                    : validationSummary.errorRowsCount > 0
                    ? `${validationSummary.errorRowsCount} Error(es) Crítico(s)`
                    : 'Válido con Advertencias'}
                </p>
              </div>
            </div>

            {/* 2. Valid Rows Metric */}
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filas Listas</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{validationSummary.validRowsCount}</p>
              </div>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">de {validationSummary.totalRows} filas</span>
            </div>

            {/* 3. Warnings Metric */}
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Advertencias</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{validationSummary.warningRowsCount}</p>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">Autocorregibles</span>
            </div>

            {/* 4. Critical Errors Metric */}
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Errores Críticos</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{validationSummary.errorRowsCount}</p>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">No importables</span>
            </div>
          </div>

          {/* Header Validation Alert if missing headers */}
          {validationSummary.missingRequiredHeaders.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 p-4 rounded-xl space-y-2">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                <span className="font-bold text-sm">Faltan Encabezados Obligatorios en el Archivo</span>
              </div>
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                El archivo no contiene o no se han podido vincular automáticamente las siguientes columnas obligatorias:{' '}
                <strong>{validationSummary.missingRequiredHeaders.map(h => h.label).join(', ')}</strong>.
                Por favor selecciónalas en el panel de <em>Mapeo de Columnas</em> a continuación.
              </p>
            </div>
          )}

          {/* Smart Column Mapping Controls */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Mapeo de Columnas Detectadas</span>
              </h4>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Los campos con <span className="text-red-500 font-bold">*</span> son obligatorios
              </span>
            </div>

            {activeUploadType === 'invoices' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    N° Factura <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={invoiceColMap.numero}
                    onChange={(e) => setInvoiceColMap({ ...invoiceColMap, numero: e.target.value })}
                    className={`w-full text-xs rounded-lg p-2 font-medium border ${
                      !invoiceColMap.numero
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    } focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">-- Seleccionar --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cliente / Razón <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={invoiceColMap.cliente}
                    onChange={(e) => setInvoiceColMap({ ...invoiceColMap, cliente: e.target.value })}
                    className={`w-full text-xs rounded-lg p-2 font-medium border ${
                      !invoiceColMap.cliente
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    } focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">-- Seleccionar --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha Emisión <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={invoiceColMap.fecha}
                    onChange={(e) => setInvoiceColMap({ ...invoiceColMap, fecha: e.target.value })}
                    className={`w-full text-xs rounded-lg p-2 font-medium border ${
                      !invoiceColMap.fecha
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    } focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">-- Seleccionar --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Importe / Monto <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={invoiceColMap.importe}
                    onChange={(e) => setInvoiceColMap({ ...invoiceColMap, importe: e.target.value })}
                    className={`w-full text-xs rounded-lg p-2 font-medium border ${
                      !invoiceColMap.importe
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    } focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">-- Seleccionar --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">RUT / CI</label>
                  <select
                    value={invoiceColMap.rut_ci}
                    onChange={(e) => setInvoiceColMap({ ...invoiceColMap, rut_ci: e.target.value })}
                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Opcional --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Vencimiento</label>
                  <select
                    value={invoiceColMap.vencimiento}
                    onChange={(e) => setInvoiceColMap({ ...invoiceColMap, vencimiento: e.target.value })}
                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Igual a Emisión --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Moneda</label>
                  <select
                    value={invoiceColMap.moneda}
                    onChange={(e) => setInvoiceColMap({ ...invoiceColMap, moneda: e.target.value })}
                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Por defecto ({company.currency}) --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha Operación <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bankColMap.fecha}
                    onChange={(e) => setBankColMap({ ...bankColMap, fecha: e.target.value })}
                    className={`w-full text-xs rounded-lg p-2 font-medium border ${
                      !bankColMap.fecha
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    } focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">-- Seleccionar --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Monto / Crédito <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bankColMap.monto}
                    onChange={(e) => setBankColMap({ ...bankColMap, monto: e.target.value })}
                    className={`w-full text-xs rounded-lg p-2 font-medium border ${
                      !bankColMap.monto
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    } focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">-- Seleccionar --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Descripción <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bankColMap.descripcion}
                    onChange={(e) => setBankColMap({ ...bankColMap, descripcion: e.target.value })}
                    className={`w-full text-xs rounded-lg p-2 font-medium border ${
                      !bankColMap.descripcion
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    } focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">-- Seleccionar --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">N° Referencia</label>
                  <select
                    value={bankColMap.referencia}
                    onChange={(e) => setBankColMap({ ...bankColMap, referencia: e.target.value })}
                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Autogenerar --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Banco / Cuenta</label>
                  <select
                    value={bankColMap.banco}
                    onChange={(e) => setBankColMap({ ...bankColMap, banco: e.target.value })}
                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Banco Principal --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Moneda</label>
                  <select
                    value={bankColMap.moneda}
                    onChange={(e) => setBankColMap({ ...bankColMap, moneda: e.target.value })}
                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Por defecto ({company.currency}) --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Validation Issues Log / Filter Bar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Filtrar filas inspeccionadas:</span>
                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                  <button
                    onClick={() => setValidationFilter('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      validationFilter === 'all'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Todas ({validationSummary.totalRows})
                  </button>
                  <button
                    onClick={() => setValidationFilter('errors')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      validationFilter === 'errors'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    }`}
                  >
                    Con Errores ({validationSummary.errorRowsCount})
                  </button>
                  <button
                    onClick={() => setValidationFilter('warnings')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      validationFilter === 'warnings'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                    }`}
                  >
                    Advertencias ({validationSummary.warningRowsCount})
                  </button>
                  <button
                    onClick={() => setValidationFilter('valid')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      validationFilter === 'valid'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    }`}
                  >
                    100% Válidas ({validationSummary.validRowsCount})
                  </button>
                </div>
              </div>

              {validationSummary.issues.length > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {validationSummary.issues.length} inconsistencia(s) detectada(s) por el validador
                </span>
              )}
            </div>

            {/* List of critical issues if any */}
            {validationSummary.issues.filter(i => i.severity === 'error').length > 0 && (
              <div className="bg-red-50/70 dark:bg-red-900/20 border border-red-200/90 dark:border-red-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-red-900">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>Detalle de Errores Críticos que Bloquean la Ingesta:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {validationSummary.issues.filter(i => i.severity === 'error').map((issue, idx) => (
                    <div key={idx} className="text-[11px] bg-white dark:bg-slate-800 p-2 rounded-lg border border-red-100 dark:border-red-800 text-red-800 dark:text-red-400 flex items-start space-x-1.5 shadow-2xs">
                      <span className="font-bold shrink-0 bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-400 px-1.5 py-0.5 rounded text-[10px]">
                        Fila {issue.rowIndex + 2}
                      </span>
                      <div>
                        <span className="font-semibold text-red-900">{issue.fieldLabel}:</span>{' '}
                        <span>{issue.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Row-by-Row Table Preview with Highlighting */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Table className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>Auditoría de Filas ({filteredRowStatuses.length} mostradas)</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                Haz clic en una fila para ver el desglose de saneamiento de datos
              </span>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-600 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-12">#</th>
                    <th className="px-3 py-2.5 w-28">Auditoría</th>
                    {detectedHeaders.map((h) => (
                      <th key={h} className="px-3 py-2.5 whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-3 py-2.5 text-right w-24">Valor Limpio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredRowStatuses.length === 0 ? (
                    <tr>
                      <td colSpan={detectedHeaders.length + 3} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                        No hay filas que coincidan con el filtro seleccionado.
                      </td>
                    </tr>
                  ) : (
                    filteredRowStatuses.map((rowStatus) => {
                      const isExpanded = expandedRowIndex === rowStatus.rowIndex;
                      const hasErrors = rowStatus.status === 'error';
                      const hasWarnings = rowStatus.status === 'warning';

                      return (
                        <React.Fragment key={rowStatus.rowIndex}>
                          <tr
                            onClick={() => setExpandedRowIndex(isExpanded ? null : rowStatus.rowIndex)}
                            className={`cursor-pointer transition-colors ${
                              hasErrors
                                ? 'bg-red-50/50 dark:bg-red-900/20 hover:bg-red-50 dark:hover:bg-red-900/30'
                                : hasWarnings
                                ? 'bg-amber-50/40 dark:bg-amber-900/20 hover:bg-amber-50/70 dark:hover:bg-amber-900/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                            }`}
                          >
                            {/* Row Number */}
                            <td className="px-3 py-2 text-center text-[11px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
                              {rowStatus.rowNumber}
                            </td>

                            {/* Status Badge */}
                            <td className="px-3 py-2 whitespace-nowrap">
                              {hasErrors ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800">
                                  <AlertCircle className="h-3 w-3 mr-1 text-red-600 dark:text-red-400" />
                                  Error
                                </span>
                              ) : hasWarnings ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                  <AlertTriangle className="h-3 w-3 mr-1 text-amber-600 dark:text-amber-400" />
                                  Advertencia
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                                  Válida
                                </span>
                              )}
                            </td>

                            {/* Data Cells with Smart Error Highlighting */}
                            {detectedHeaders.map((header) => {
                              const cellValue = String(rowStatus.rawRow[header] || '');
                              const cellIssue = rowStatus.issues.find(
                                i => i.field === header ||
                                (activeUploadType === 'invoices' && (
                                  (header === invoiceColMap.numero && i.field === 'numero') ||
                                  (header === invoiceColMap.cliente && i.field === 'cliente') ||
                                  (header === invoiceColMap.fecha && i.field === 'fecha') ||
                                  (header === invoiceColMap.vencimiento && i.field === 'vencimiento') ||
                                  (header === invoiceColMap.importe && i.field === 'importe')
                                )) ||
                                (activeUploadType === 'movements' && (
                                  (header === bankColMap.fecha && i.field === 'fecha') ||
                                  (header === bankColMap.monto && i.field === 'monto') ||
                                  (header === bankColMap.descripcion && i.field === 'descripcion') ||
                                  (header === bankColMap.referencia && i.field === 'referencia')
                                ))
                              );

                              return (
                                <td
                                  key={header}
                                   className={`px-3 py-2 whitespace-nowrap text-xs ${
                                     cellIssue
                                       ? cellIssue.severity === 'error'
                                         ? 'bg-red-100/80 dark:bg-red-900/30 text-red-900 font-bold underline decoration-red-500 decoration-wavy'
                                         : 'bg-amber-100/80 dark:bg-amber-900/30 text-amber-900 font-semibold'
                                       : 'text-slate-700 dark:text-slate-300'
                                   }`}
                                  title={cellIssue?.message || cellValue}
                                >
                                  {cellValue || <span className="text-slate-300 dark:text-slate-600 italic font-normal">(vacío)</span>}
                                </td>
                              );
                            })}

                            {/* Clean/Sanitized preview indicator */}
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {rowStatus.sanitizedData ? (
                                <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  {activeUploadType === 'invoices'
                                    ? `$ ${(rowStatus.sanitizedData as Invoice).importe.toLocaleString()}`
                                    : `$ ${(rowStatus.sanitizedData as BankMovement).monto.toLocaleString()}`}
                                </span>
                              ) : (
                                <span className="text-[10px] text-red-500 dark:text-red-400 font-semibold">Omitida</span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Row Issue Details */}
                          {isExpanded && rowStatus.issues.length > 0 && (
                            <tr className="bg-slate-50/90 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700">
                              <td colSpan={detectedHeaders.length + 3} className="px-6 py-3">
                                <div className="space-y-1.5">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Auditoría detallada de la Fila {rowStatus.rowNumber}:
                                  </p>
                                  <div className="space-y-1">
                                    {rowStatus.issues.map((issue, issueIdx) => (
                                      <div
                                        key={issueIdx}
                                        className={`text-xs px-3 py-1.5 rounded-lg flex items-center space-x-2 ${
                                          issue.severity === 'error'
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-400 font-medium'
                                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-400 font-medium'
                                        }`}
                                      >
                                        {issue.severity === 'error' ? (
                                          <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                                        ) : (
                                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                        )}
                                        <span>
                                          <strong>{issue.fieldLabel}:</strong> {issue.message}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Guide Note */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 flex items-start space-x-3 text-xs text-slate-600 dark:text-slate-400">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            ¿Cómo garantiza la capa de validación la integridad antes del matching?
          </p>
          <p className="leading-relaxed">
            1. <strong>Encabezados</strong>: Comprueba que todas las columnas requeridas (N° Factura, Razón Social, Fecha, Monto) estén asignadas.<br />
            2. <strong>Números e Importes</strong>: Decodifica automáticamente formatos con coma o punto decimal (ej: <code>45.000,00</code> o <code>$45,000.00</code>) e identifica errores como <code>PENDIENTE</code> o valores menores o iguales a cero.<br />
            3. <strong>Consistencia de Fechas</strong>: Convierte formatos <code>DD/MM/AAAA</code>, <code>AAAA-MM-DD</code> y seriales de Excel, advirtiendo si la fecha de vencimiento es anterior a la fecha de emisión.
          </p>
        </div>
      </div>
    </div>
  );
};
