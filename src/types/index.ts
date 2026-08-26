export type InvoiceStatus = 'pendiente' | 'parcial' | 'pagada' | 'anulada';
export type MovementStatus = 'auto' | 'sugerido' | 'sin_identificar' | 'conciliado_manual' | 'descartado';
export type CreditStatus = 'disponible' | 'usado' | 'parcial';
export type CurrencyCode = 'UYU' | 'USD';

export interface Company {
  id: string;
  name: string;
  rut: string;
  address?: string;
  phone?: string;
  email?: string;
  currency: CurrencyCode;
  currencySymbol: string;
  usdExchangeRate: number; // e.g. 40.50
  autoMatchThreshold: number; // e.g., 0.85
  bankAccounts: Array<{
    bank: string;
    accountType: string;
    accountNumber: string;
    currency: CurrencyCode;
    cbu_iban?: string;
  }>;
  accountingAccounts: {
    bankAccountCode: string;
    debtorsAccountCode: string;
    taxWithholdingCode: string;
    bankFeeCode: string;
    exchangeDiffGainCode: string;
    exchangeDiffLossCode: string;
  };
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  rut_ci: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  address?: string;
  alias_conocidos: string[];
  totalInvoiced: number;
  totalPaid: number;
  currentBalance: number; // pending debt
  creditBalance: number; // saldo a favor
}

export interface Invoice {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_rut?: string;
  cliente_nombre_alt?: string[]; // Razón Social Cliente, Cliente / Proyecto as aliases
  numero: string;
  fecha: string;
  vencimiento: string;
  importe: number;
  saldo_pendiente: number;
  monto_sin_iva?: number;
  monto_con_iva?: number;
  iva_monto?: number;
  moneda: CurrencyCode;
  tipo_cambio?: number;
  estado: InvoiceStatus;
  observaciones?: string;
}

export interface SuggestedMatch {
  cliente_id: string;
  cliente_nombre: string;
  confianza: number; // 0 to 100
  motivo: string;
  tipo: 'exacto_factura' | 'exacto_monto_alias' | 'similitud_cliente' | 'multi_factura' | 'pago_parcial' | 'sobrepago' | 'retencion_o_gasto' | 'bimonetario';
  facturas: Array<{
    factura_id: string;
    factura_numero: string;
    importe: number;
    saldo_pendiente: number;
    monto_a_aplicar: number;
    moneda?: CurrencyCode;
  }>;
  saldo_a_favor_estimado?: number;
  retencion_estimada?: number;
  gasto_bancario_estimado?: number;
  diferencia_cambio?: number;
}

export interface BankMovement {
  id: string;
  fecha: string;
  monto: number;
  moneda: CurrencyCode;
  tipo_cambio?: number;
  descripcion_cruda: string;
  referencia?: string;
  origen_banco: string;
  estado_conciliacion: MovementStatus;
  cliente_sugerido_id?: string;
  cliente_sugerido_name?: string;
  confianza: number; // 0 - 100
  motivo_sugerencia?: string;
  sugerencia?: SuggestedMatch;
  fecha_conciliacion?: string;
  conciliado_por?: string;
  aplicaciones?: PaymentApplication[];
  saldo_a_favor_generado?: number;
  retencion_monto?: number;
  retencion_tipo?: string;
  gasto_bancario_monto?: number;
  diferencia_cambio?: number;
  recibo_id?: string;
  asiento_id?: string;
  aiAnalysis?: {
    matchedClientId?: string;
    matchedClientName?: string;
    confidence: number;
    explanation: string;
    suggestedInvoices?: string[];
    suggestedWithholding?: number;
    suggestedBankFee?: number;
    isAiPowered: boolean;
  };
}

export interface PaymentApplication {
  id: string;
  movimiento_id: string;
  factura_id: string;
  factura_numero: string;
  cliente_id: string;
  cliente_nombre: string;
  monto_aplicado: number;
  moneda: CurrencyCode;
  fecha: string;
  confirmado_por: string;
}

export interface ClientCredit {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  monto_original: number;
  saldo_disponible: number;
  moneda: CurrencyCode;
  origen_movimiento_id?: string;
  fecha: string;
  estado: CreditStatus;
  motivo?: string;
}

export interface LearnedAlias {
  id: string;
  texto_referencia: string;
  cliente_id: string;
  cliente_nombre: string;
  veces_confirmado: number;
  fecha_creacion: string;
  ultima_vez: string;
}

export interface OfficialReceipt {
  id: string;
  numero_recibo: string; // e.g. REC-2026-000101
  fecha: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_rut?: string;
  movimiento_id: string;
  banco: string;
  referencia_bancaria?: string;
  monto_total_cobrado: number;
  moneda: CurrencyCode;
  facturas_canceladas: Array<{
    factura_id: string;
    factura_numero: string;
    monto_aplicado: number;
    saldo_restante: number;
  }>;
  retencion_fiscal: number;
  retencion_concepto?: string;
  gasto_bancario: number;
  saldo_a_favor_generado: number;
  observaciones?: string;
  emitido_por: string;
}

export interface JournalEntryLine {
  cuenta_codigo: string;
  cuenta_nombre: string;
  debito: number;
  credito: number;
  referencia?: string;
}

export interface AccountingEntry {
  id: string;
  asiento_numero: string; // e.g. AST-2026-0042
  fecha: string;
  concepto: string;
  movimiento_id?: string;
  recibo_id?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  moneda: CurrencyCode;
  lineas: JournalEntryLine[];
  total_debito: number;
  total_credito: number;
  creado_por: string;
}

export interface EmailReminderLog {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  destinatario_email: string;
  asunto: string;
  fecha_envio: string;
  saldo_reclamado: number;
  facturas_incluidas: string[];
  enviado_por: string;
}

export interface AgingBucket {
  al_dia: number;
  dias_1_30: number;
  dias_31_60: number;
  dias_61_90: number;
  mas_90_dias: number;
  total: number;
}

export interface AuditLog {
  id: string;
  fecha: string;
  usuario: string;
  accion: 'auto_match' | 'confirm_suggested' | 'manual_match' | 'apply_credit' | 'discard' | 'revert' | 'reversion' | 'send_statement_email' | 'export_accounting' | string;
  entidad: 'movimiento' | 'factura' | 'credito' | 'alias' | 'recibo' | 'asiento' | 'auditoria' | string;
  entidad_id: string;
  descripcion: string;
  detalles?: {
    movimiento_id?: string;
    cliente_id?: string;
    cliente_nombre?: string;
    monto?: number;
    facturas_afectadas?: Array<{ factura_id: string; numero: string; monto_aplicado: number }>;
    saldo_a_favor?: number;
    retencion?: number;
    gasto_bancario?: number;
    nuevo_alias?: string;
    recibo_id?: string;
    asiento_id?: string;
  };
  revertible: boolean;
  reverted?: boolean;
}

export interface ColumnMapping {
  fecha: string;
  monto: string;
  descripcion?: string;
  referencia?: string;
  numero_factura?: string;
  cliente?: string;
  rut_ci?: string;
  vencimiento?: string;
  moneda?: string;
}
