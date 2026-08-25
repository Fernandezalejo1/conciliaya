import { BankMovement, Client, Company, Invoice, LearnedAlias, OfficialReceipt, AccountingEntry } from '../types';

export const initialCompany: Company = {
  id: 'comp_01',
  name: 'Distribuidora & Importadora Del Plata S.A.',
  rut: '21.489.123.0019',
  address: 'Rbla. Baltasar Brum 3420, Montevideo, Uruguay',
  phone: '+598 2924 5500',
  email: 'cobranzas@delplata.com.uy',
  currency: 'UYU',
  currencySymbol: '$',
  usdExchangeRate: 40.50,
  autoMatchThreshold: 0.90,
  bankAccounts: [
    {
      bank: 'Banco Itaú Uruguay',
      accountType: 'Cuenta Corriente Pesos',
      accountNumber: '1249821-001',
      currency: 'UYU',
      cbu_iban: 'ITAUUYMM-1249821-001'
    },
    {
      bank: 'Banco República (BROU)',
      accountType: 'Cuenta Corriente Pesos',
      accountNumber: '001558231-00002',
      currency: 'UYU',
      cbu_iban: 'BROUUYMM-001558231-00002'
    },
    {
      bank: 'Banco Santander',
      accountType: 'Cuenta Corriente Dólares',
      accountNumber: '5501928-USD',
      currency: 'USD',
      cbu_iban: 'SANTEUYMM-5501928-USD'
    }
  ],
  accountingAccounts: {
    bankAccountCode: '1.1.1.02', // Banco Itaú / BROU
    debtorsAccountCode: '1.1.3.01', // Deudores por Ventas
    taxWithholdingCode: '1.1.4.01', // Retenciones DGI / IVA / IRAE a favor
    bankFeeCode: '5.1.2.05', // Comisiones y Gastos Bancarios
    exchangeDiffGainCode: '4.2.1.01', // Ganancia por Dif. de Cambio
    exchangeDiffLossCode: '5.2.1.01' // Pérdida por Dif. de Cambio
  },
  createdAt: '2026-01-15'
};

export const initialClients: Client[] = [
  {
    id: 'cli_01',
    name: 'Supermercados El Dorado S.A.',
    rut_ci: '21.847.291.0014',
    email: 'pagos@eldorado.com.uy',
    phone: '+598 2901 4455',
    contactPerson: 'Lic. Mariana Gómez (Tesorería)',
    address: 'Av. 18 de Julio 1420, Montevideo',
    alias_conocidos: ['SUPER EL DORADO', 'ELDORADO SA', 'SUPERMERCADOS EL DORADO'],
    totalInvoiced: 485000,
    totalPaid: 320000,
    currentBalance: 165000,
    creditBalance: 0
  },
  {
    id: 'cli_02',
    name: 'Ferretería & Bazar Central S.R.L.',
    rut_ci: '21.392.812.0018',
    email: 'administracion@ferreteriacentral.uy',
    phone: '+598 2400 8821',
    contactPerson: 'Carlos Méndez (Gerente)',
    address: 'Agraciada 2810, Montevideo',
    alias_conocidos: ['FERRETERIA CENTRAL', 'BAZAR CENTRAL SRL', 'CARLOS MENDEZ BAZAR'],
    totalInvoiced: 240000,
    totalPaid: 155000,
    currentBalance: 85000,
    creditBalance: 0
  },
  {
    id: 'cli_03',
    name: 'Farmacia & Perfumería La Paz',
    rut_ci: '21.654.981.0012',
    email: 'cuentas@farmacialapaz.com.uy',
    phone: '+598 2309 1199',
    contactPerson: 'Dra. Valentina Rossi',
    address: 'César Mayo Gutiérrez 210, La Paz, Canelones',
    alias_conocidos: ['FARMACIA LA PAZ', 'VALENTINA ROSSI LA PAZ', 'DROGUERIA LA PAZ'],
    totalInvoiced: 310000,
    totalPaid: 211600,
    currentBalance: 98400,
    creditBalance: 0
  },
  {
    id: 'cli_04',
    name: 'Construcciones del Este S.A.',
    rut_ci: '21.902.115.0010',
    email: 'finanzas@construccioneseste.com',
    phone: '+598 4244 3300',
    contactPerson: 'Ing. Rodrigo Silva',
    address: 'Av. Roosevelt y Pda. 8, Punta del Este, Maldonado',
    alias_conocidos: ['CONSTR DEL ESTE', 'OBRAS DEL ESTE', 'RODRIGO SILVA CONSTR'],
    totalInvoiced: 620000,
    totalPaid: 588000,
    currentBalance: 32000,
    creditBalance: 0
  },
  {
    id: 'cli_05',
    name: 'Gastronomía Costera (Restaurante El Faro)',
    rut_ci: '12.482.901.0015',
    email: 'compras@elfarocostera.uy',
    phone: '+598 4442 7711',
    contactPerson: 'Esteban Larrosa',
    address: 'Rbla. Costanera km 22.500, Ciudad de la Costa',
    alias_conocidos: ['GASTRONOMIA COSTERA', 'REST EL FARO', 'ESTEBAN LARROSA COSTERA'],
    totalInvoiced: 175000,
    totalPaid: 110000,
    currentBalance: 65000,
    creditBalance: 2500
  },
  {
    id: 'cli_06',
    name: 'Juan Pérez (Taller Mecánico El Águila)',
    rut_ci: '3.491.823-4',
    email: 'juanperez.taller@gmail.com',
    phone: '+598 99 123 456',
    contactPerson: 'Juan Pérez',
    address: 'Camino Carrasco 4120, Montevideo',
    alias_conocidos: ['JUAN PEREZ', 'TALLER EL AGUILA', 'PAGO JUAN PEREZ'],
    totalInvoiced: 84000,
    totalPaid: 65500,
    currentBalance: 18500,
    creditBalance: 0
  },
  {
    id: 'cli_07',
    name: 'Minimercado y Panadería San José',
    rut_ci: '21.774.221.0016',
    email: 'contacto@panaderiasanjose.uy',
    phone: '+598 2200 4511',
    contactPerson: 'Gonzalo Fernández',
    address: 'Manuel D. Rodríguez 640, San José',
    alias_conocidos: ['PANADERIA SAN JOSE', 'MINIMERCADO SAN JOSE'],
    totalInvoiced: 130000,
    totalPaid: 88000,
    currentBalance: 42000,
    creditBalance: 0
  },
  {
    id: 'cli_08',
    name: 'Logística & Comercio Exterior Austral S.A.',
    rut_ci: '21.990.114.0017',
    email: 'aduanas@australtrade.uy',
    phone: '+598 2916 8800',
    contactPerson: 'Lic. Fernando Bañales',
    address: 'Zabala 1320 Piso 4, Montevideo',
    alias_conocidos: ['AUSTRAL TRADE', 'LOGISTICA AUSTRAL', 'AUSTRAL SA'],
    totalInvoiced: 180000,
    totalPaid: 99000,
    currentBalance: 81000,
    creditBalance: 0
  }
];

export const initialLearnedAliases: LearnedAlias[] = [
  {
    id: 'alias_01',
    texto_referencia: 'SUPER EL DORADO',
    cliente_id: 'cli_01',
    cliente_nombre: 'Supermercados El Dorado S.A.',
    veces_confirmado: 14,
    fecha_creacion: '2026-02-01',
    ultima_vez: '2026-08-10'
  },
  {
    id: 'alias_02',
    texto_referencia: 'CARLOS MENDEZ BAZAR',
    cliente_id: 'cli_02',
    cliente_nombre: 'Ferretería & Bazar Central S.R.L.',
    veces_confirmado: 8,
    fecha_creacion: '2026-02-15',
    ultima_vez: '2026-08-04'
  },
  {
    id: 'alias_03',
    texto_referencia: 'FARMACIA LA PAZ',
    cliente_id: 'cli_03',
    cliente_nombre: 'Farmacia & Perfumería La Paz',
    veces_confirmado: 11,
    fecha_creacion: '2026-01-20',
    ultima_vez: '2026-08-18'
  },
  {
    id: 'alias_04',
    texto_referencia: 'RODRIGO SILVA CONSTR',
    cliente_id: 'cli_04',
    cliente_nombre: 'Construcciones del Este S.A.',
    veces_confirmado: 5,
    fecha_creacion: '2026-03-10',
    ultima_vez: '2026-08-01'
  }
];

export const initialInvoices: Invoice[] = [
  // Supermercados El Dorado
  {
    id: 'inv_1040',
    cliente_id: 'cli_01',
    cliente_nombre: 'Supermercados El Dorado S.A.',
    cliente_rut: '21.847.291.0014',
    numero: 'FAC-A-0001040',
    fecha: '2026-08-02',
    vencimiento: '2026-08-22',
    importe: 145200,
    saldo_pendiente: 145200,
    moneda: 'UYU',
    estado: 'pendiente'
  },
  {
    id: 'inv_1041',
    cliente_id: 'cli_01',
    cliente_nombre: 'Supermercados El Dorado S.A.',
    cliente_rut: '21.847.291.0014',
    numero: 'FAC-A-0001041',
    fecha: '2026-08-15',
    vencimiento: '2026-09-04',
    importe: 19800,
    saldo_pendiente: 19800,
    moneda: 'UYU',
    estado: 'pendiente'
  },

  // Ferretería Central
  {
    id: 'inv_1042',
    cliente_id: 'cli_02',
    cliente_nombre: 'Ferretería & Bazar Central S.R.L.',
    cliente_rut: '21.392.812.0018',
    numero: 'FAC-A-0001042',
    fecha: '2026-08-05',
    vencimiento: '2026-08-25',
    importe: 85000,
    saldo_pendiente: 85000,
    moneda: 'UYU',
    estado: 'pendiente'
  },

  // Farmacia La Paz (Caso 4: Multiple invoices)
  {
    id: 'inv_1050',
    cliente_id: 'cli_03',
    cliente_nombre: 'Farmacia & Perfumería La Paz',
    cliente_rut: '21.654.981.0012',
    numero: 'FAC-A-0001050',
    fecha: '2026-07-28',
    vencimiento: '2026-08-17',
    importe: 48400,
    saldo_pendiente: 48400,
    moneda: 'UYU',
    estado: 'pendiente'
  },
  {
    id: 'inv_1051',
    cliente_id: 'cli_03',
    cliente_nombre: 'Farmacia & Perfumería La Paz',
    cliente_rut: '21.654.981.0012',
    numero: 'FAC-A-0001051',
    fecha: '2026-08-10',
    vencimiento: '2026-08-30',
    importe: 50000,
    saldo_pendiente: 50000,
    moneda: 'UYU',
    estado: 'pendiente'
  },

  // Construcciones del Este (Caso 3: Overpayment)
  {
    id: 'inv_1060',
    cliente_id: 'cli_04',
    cliente_nombre: 'Construcciones del Este S.A.',
    cliente_rut: '21.902.115.0010',
    numero: 'FAC-A-0001060',
    fecha: '2026-08-01',
    vencimiento: '2026-08-21',
    importe: 32000,
    saldo_pendiente: 32000,
    moneda: 'UYU',
    estado: 'pendiente'
  },

  // Gastronomía Costera (Caso con Retención Fiscal del 1% DGI)
  {
    id: 'inv_1070',
    cliente_id: 'cli_05',
    cliente_nombre: 'Gastronomía Costera (Restaurante El Faro)',
    cliente_rut: '12.482.901.0015',
    numero: 'FAC-B-0002100',
    fecha: '2026-08-08',
    vencimiento: '2026-08-28',
    importe: 65000,
    saldo_pendiente: 65000,
    moneda: 'UYU',
    estado: 'pendiente'
  },

  // Juan Pérez
  {
    id: 'inv_1080',
    cliente_id: 'cli_06',
    cliente_nombre: 'Juan Pérez (Taller Mecánico El Águila)',
    cliente_rut: '3.491.823-4',
    numero: 'FAC-B-0002150',
    fecha: '2026-08-12',
    vencimiento: '2026-09-01',
    importe: 18500,
    saldo_pendiente: 18500,
    moneda: 'UYU',
    estado: 'pendiente'
  },

  // Panadería San José
  {
    id: 'inv_1090',
    cliente_id: 'cli_07',
    cliente_nombre: 'Minimercado y Panadería San José',
    cliente_rut: '21.774.221.0016',
    numero: 'FAC-A-0001090',
    fecha: '2026-08-14',
    vencimiento: '2026-09-03',
    importe: 42000,
    saldo_pendiente: 42000,
    moneda: 'UYU',
    estado: 'pendiente'
  },

  // Austral Trade (Factura en DÓLARES USD)
  {
    id: 'inv_1100',
    cliente_id: 'cli_08',
    cliente_nombre: 'Logística & Comercio Exterior Austral S.A.',
    cliente_rut: '21.990.114.0017',
    numero: 'FAC-E-0000450',
    fecha: '2026-08-04',
    vencimiento: '2026-08-24',
    importe: 2000, // USD $2,000
    saldo_pendiente: 2000,
    moneda: 'USD',
    tipo_cambio: 40.50,
    estado: 'pendiente'
  }
];

export const initialBankMovements: BankMovement[] = [
  // CASO 1: Match Exacto por N° Factura + Monto (100% Automático)
  {
    id: 'mov_01',
    fecha: '2026-08-20',
    monto: 65000,
    moneda: 'UYU',
    descripcion_cruda: 'TRF REC SPI PAGO FAC 2100 REST EL FARO GASTRO',
    referencia: 'SPI-998231',
    origen_banco: 'Banco Itaú',
    estado_conciliacion: 'auto',
    confianza: 100,
    motivo_sugerencia: 'Match exacto por N° Factura (FAC-B-0002100) e importe idéntico ($65.000)',
    cliente_sugerido_id: 'cli_05',
    cliente_sugerido_name: 'Gastronomía Costera (Restaurante El Faro)'
  },

  // CASO 1.B: Match Exacto por Alias Aprendido + Monto Factura (100% Automático)
  {
    id: 'mov_02',
    fecha: '2026-08-21',
    monto: 145200,
    moneda: 'UYU',
    descripcion_cruda: 'TRANSFERENCIA RECIBIDA SUPER EL DORADO SUC CENTRO',
    referencia: 'BROU-TRF-44102',
    origen_banco: 'Banco República (BROU)',
    estado_conciliacion: 'auto',
    confianza: 100,
    motivo_sugerencia: 'Alias aprendido confirmado ("SUPER EL DORADO") con monto exacto a Factura FAC-A-0001040',
    cliente_sugerido_id: 'cli_01',
    cliente_sugerido_name: 'Supermercados El Dorado S.A.'
  },

  // CASO 2: Pago Parcial (El cliente debe $85.000 y transfiere $50.000) -> Sugerido
  {
    id: 'mov_03',
    fecha: '2026-08-22',
    monto: 50000,
    moneda: 'UYU',
    descripcion_cruda: 'TRF REC CARLOS MENDEZ BAZAR ENTREGA A CUENTA',
    referencia: 'SANT-88129',
    origen_banco: 'Banco Santander',
    estado_conciliacion: 'sugerido',
    confianza: 92,
    motivo_sugerencia: 'Alias coincidente con Ferretería & Bazar Central S.R.L. Pago parcial por $50.000 para Factura FAC-A-0001042 (Resta: $35.000)',
    cliente_sugerido_id: 'cli_02',
    cliente_sugerido_name: 'Ferretería & Bazar Central S.R.L.'
  },

  // CASO 3: Sobrepago / Excedente (El cliente debe $32.000 y transfiere $35.000) -> Sugerido
  {
    id: 'mov_04',
    fecha: '2026-08-22',
    monto: 35000,
    moneda: 'UYU',
    descripcion_cruda: 'TRANSFERENCIA RODRIGO SILVA CONSTR PAGO OBRA',
    referencia: 'BBVA-10924',
    origen_banco: 'BBVA',
    estado_conciliacion: 'sugerido',
    confianza: 94,
    motivo_sugerencia: 'Cancela Factura FAC-A-0001060 ($32.000) con excedente de $3.000 como saldo a favor',
    cliente_sugerido_id: 'cli_04',
    cliente_sugerido_name: 'Construcciones del Este S.A.'
  },

  // CASO 4: Un solo pago cancela varias facturas ($48.400 + $50.000 = $98.400) -> Sugerido
  {
    id: 'mov_05',
    fecha: '2026-08-23',
    monto: 98400,
    moneda: 'UYU',
    descripcion_cruda: 'TRF TERCEROS FARMACIA LA PAZ LIQUIDACION AGOSTO',
    referencia: 'ITAU-55610',
    origen_banco: 'Banco Itaú',
    estado_conciliacion: 'sugerido',
    confianza: 96,
    motivo_sugerencia: 'Suma exacta de 2 facturas pendientes: FAC-A-0001050 ($48.400) + FAC-A-0001051 ($50.000)',
    cliente_sugerido_id: 'cli_03',
    cliente_sugerido_name: 'Farmacia & Perfumería La Paz'
  },

  // CASO 5: Referencia bancaria con CI o nombre de persona ("PAGO CI 3491823") -> Sugerido
  {
    id: 'mov_06',
    fecha: '2026-08-23',
    monto: 18500,
    moneda: 'UYU',
    descripcion_cruda: 'DEPOSITO CAJA EFECTIVO CI 3491823 PAGO',
    referencia: 'BROU-DEP-994',
    origen_banco: 'Banco República (BROU)',
    estado_conciliacion: 'sugerido',
    confianza: 95,
    motivo_sugerencia: 'Coincidencia exacta por C.I. 3.491.823-4 (Juan Pérez). Cancela Factura FAC-B-0002150 ($18.500)',
    cliente_sugerido_id: 'cli_06',
    cliente_sugerido_name: 'Juan Pérez (Taller Mecánico El Águila)'
  },

  // CASO 6: Pago con Retención de Impuestos (Factura $42.000, transfiere $41.580 por 1% Retención)
  {
    id: 'mov_07',
    fecha: '2026-08-24',
    monto: 41580,
    moneda: 'UYU',
    descripcion_cruda: 'TRF SPI SAN JOSE PANAD PAGO FAC 1090 MENOS RET DGI',
    referencia: 'BROU-RET-1092',
    origen_banco: 'Banco República (BROU)',
    estado_conciliacion: 'sugerido',
    confianza: 90,
    motivo_sugerencia: 'Coincide con Factura FAC-A-0001090 ($42.000) descontando $420 (1% Retención Fiscal DGI)',
    cliente_sugerido_id: 'cli_07',
    cliente_sugerido_name: 'Minimercado y Panadería San José'
  },

  // CASO 7: Pago Bimonetario (Factura USD 2,000 abonada en Pesos UYU $81.000 a TC 40.50)
  {
    id: 'mov_08',
    fecha: '2026-08-24',
    monto: 81000,
    moneda: 'UYU',
    descripcion_cruda: 'TRANSFERENCIA RECIBIDA AUSTRAL TRADE PAGO EXP 450 USD',
    referencia: 'ITAU-BIM-881',
    origen_banco: 'Banco Itaú',
    estado_conciliacion: 'sugerido',
    confianza: 93,
    motivo_sugerencia: 'Pago en UYU equivalente a Factura FAC-E-0000450 (USD $2.000 × TC $40.50 = $81.000 UYU)',
    cliente_sugerido_id: 'cli_08',
    cliente_sugerido_name: 'Logística & Comercio Exterior Austral S.A.'
  },

  // CASO 8: Movimiento Críptico Bancario para Asignación Manual
  {
    id: 'mov_09',
    fecha: '2026-08-25',
    monto: 19800,
    moneda: 'UYU',
    descripcion_cruda: 'DEP ELEC ABN-091823 XF-9 LACTEOS SUC-4',
    referencia: 'SCOTIA-99881',
    origen_banco: 'Scotiabank',
    estado_conciliacion: 'sin_identificar',
    confianza: 0,
    motivo_sugerencia: 'Referencia abreviada de sucursal. Requiere asignación de cliente y facturas.',
    cliente_sugerido_id: undefined,
    cliente_sugerido_name: undefined
  }
];

export function generateSampleInvoicesCSV(): string {
  return `Numero,Cliente,RUT_CI,Fecha,Vencimiento,Importe,Moneda,Observaciones
FAC-A-0001040,Supermercados El Dorado S.A.,21.847.291.0014,2026-08-02,2026-08-22,145200,UYU,Mercadería sucursal centro
FAC-A-0001041,Supermercados El Dorado S.A.,21.847.291.0014,2026-08-15,2026-09-04,19800,UYU,Reposición lácteos
FAC-A-0001042,Ferretería & Bazar Central S.R.L.,21.392.812.0018,2026-08-05,2026-08-25,85000,UYU,Herramientas importadas
FAC-A-0001050,Farmacia & Perfumería La Paz,21.654.981.0012,2026-07-28,2026-08-17,48400,UYU,Lote perfumería
FAC-A-0001051,Farmacia & Perfumería La Paz,21.654.981.0012,2026-08-10,2026-08-30,50000,UYU,Lote farmacia
FAC-A-0001060,Construcciones del Este S.A.,21.902.115.0010,2026-08-01,2026-08-21,32000,UYU,Materiales obra Maldonado
FAC-B-0002100,Gastronomía Costera (Restaurante El Faro),12.482.901.0015,2026-08-08,2026-08-28,65000,UYU,Insumos gastronómicos
FAC-B-0002150,Juan Pérez (Taller Mecánico El Águila),3.491.823-4,2026-08-12,2026-09-01,18500,UYU,Repuestos automotor
FAC-A-0001090,Minimercado y Panadería San José,21.774.221.0016,2026-08-14,2026-09-03,42000,UYU,Harinas y levaduras
FAC-E-0000450,Logística & Comercio Exterior Austral S.A.,21.990.114.0017,2026-08-04,2026-08-24,2000,USD,Servicios de exportación e insumos`;
}

export function generateSampleBankCSV(): string {
  return `Fecha,Monto,Moneda,Descripcion,Referencia,Banco
2026-08-20,65000,UYU,TRF REC SPI PAGO FAC 2100 REST EL FARO GASTRO,SPI-998231,Banco Itaú
2026-08-21,145200,UYU,TRANSFERENCIA RECIBIDA SUPER EL DORADO SUC CENTRO,BROU-TRF-44102,Banco República (BROU)
2026-08-22,50000,UYU,TRF REC CARLOS MENDEZ BAZAR ENTREGA A CUENTA,SANT-88129,Banco Santander
2026-08-22,35000,UYU,TRANSFERENCIA RODRIGO SILVA CONSTR PAGO OBRA,BBVA-10924,BBVA
2026-08-23,98400,UYU,TRF TERCEROS FARMACIA LA PAZ LIQUIDACION AGOSTO,ITAU-55610,Banco Itaú
2026-08-23,18500,UYU,DEPOSITO CAJA EFECTIVO CI 3491823 PAGO,BROU-DEP-994,Banco República (BROU)
2026-08-24,41580,UYU,TRF SPI SAN JOSE PANAD PAGO FAC 1090 MENOS RET DGI,BROU-RET-1092,Banco República (BROU)
2026-08-24,81000,UYU,TRANSFERENCIA RECIBIDA AUSTRAL TRADE PAGO EXP 450 USD,ITAU-BIM-881,Banco Itaú
2026-08-25,19800,UYU,DEP ELEC ABN-091823 XF-9 LACTEOS SUC-4,SCOTIA-99881,Scotiabank`;
}

export function generateSampleInvoicesWithErrorsCSV(): string {
  return `Numero,Cliente,RUT_CI,Fecha,Vencimiento,Importe,Moneda,Observaciones
FAC-A-0001040,Supermercados El Dorado S.A.,21.847.291.0014,2026-08-02,2026-08-22,145.200,00,UYU,Formato con puntos y comas válido
FAC-A-0001041,Supermercados El Dorado S.A.,21.847.291.0014,2026-08-25,2026-08-05,19800,UYU,Advertencia: Vencimiento anterior a emisión
FAC-ERR-001,Ferretería Central S.R.L.,21.392.812.0018,2026-08-10,2026-08-30,PENDIENTE_PAGO,UYU,Error Crítico: Importe no numérico
FAC-ERR-002,Farmacia La Paz,21.654.981.0012,31/02/2026,2026-08-20,48400,UYU,Error Crítico: Fecha calendario inválida 31/02
FAC-A-0001040,Supermercados El Dorado S.A.,21.847.291.0014,2026-08-02,2026-08-22,145200,UYU,Advertencia: N° Factura duplicada en el archivo
,Cliente Desconocido Sin Factura,21.902.115.0010,2026-08-01,2026-08-21,32000,UYU,Error Crítico: Número de factura vacío
FAC-A-0002100,,12.482.901.0015,2026-08-08,2026-08-28,65000,UYU,Error Crítico: Nombre de cliente ausente
FAC-B-0002150,Juan Pérez (Taller Mecánico),3.491.823-4,12/08/2026,01/09/2026,$ 18.500,UYU,Formato Latinoamericano con símbolo pesos`;
}

export function generateSampleBankWithErrorsCSV(): string {
  return `Fecha,Monto,Moneda,Descripcion,Referencia,Banco
2026-08-20,65000,UYU,TRF REC SPI PAGO FAC 2100 REST EL FARO GASTRO,SPI-998231,Banco Itaú
2026-08-32,145200,UYU,TRANSFERENCIA RECIBIDA SUPER EL DORADO,BROU-TRF-44102,Banco República (BROU)
2026-08-22,-50000,UYU,COMISION DEBITADA MANTENIMIENTO,SANT-88129,Banco Santander
2026-08-22,35.000,00,UYU,TRANSFERENCIA RODRIGO SILVA CONSTR,BBVA-10924,BBVA
2026-08-23,NO_DISPONIBLE,UYU,TRF TERCEROS FARMACIA LA PAZ,ITAU-55610,Banco Itaú
2026-08-23,18500,UYU,,BROU-DEP-994,Banco República (BROU)`;
}

