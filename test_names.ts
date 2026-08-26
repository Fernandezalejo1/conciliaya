import XLSX from 'xlsx';

const wb1 = XLSX.readFile('C:\\Users\\noiss\\Downloads\\facutas\\Facturas_Emitidas_Anonimizado (1).xlsx');
const raw = XLSX.utils.sheet_to_json(wb1.Sheets['Facturas Emitidas'], {defval: ''});

// Show all unique names across all name columns
const matrizNames = new Set<string>();
const razonNames = new Set<string>();
const clienteNames = new Set<string>();

for (const r of raw) {
  const matriz = String(r['Empresa Matriz (quien paga)'] || '').trim();
  const razon = String(r['Razón Social Cliente'] || '').trim();
  const cliente = String(r['Cliente / Proyecto'] || '').trim();
  if (matriz && String(r['Concepto']).toUpperCase() !== 'TOTALES') matrizNames.add(matriz);
  if (razon && String(r['Concepto']).toUpperCase() !== 'TOTALES') razonNames.add(razon);
  if (cliente && String(r['Concepto']).toUpperCase() !== 'TOTALES') clienteNames.add(cliente);
}

console.log('=== Empresa Matriz ===');
[...matrizNames].sort().forEach(n => console.log(' ', n));
console.log('\n=== Razón Social Cliente ===');
[...razonNames].sort().forEach(n => console.log(' ', n));
console.log('\n=== Cliente / Proyecto ===');
[...clienteNames].sort().forEach(n => console.log(' ', n));

// Check for bank names that don't match matriz
const bankNames = ['TRANSCOM', 'PILARES', 'SOLVENTA', 'BRISOL', 'TERRALUX', 'KASTOR', 'MATERIALES ZENITH', 'ALQUILERES POLARIS', 'DISTRIBUIDORA LUNAR', 'FELIPE SOUZA', 'MARIANO SOUZA', 'JUAN PABLO LEDESMA'];
console.log('\n=== Bank names not in Empresa Matriz ===');
for (const name of bankNames) {
  const inMatriz = [...matrizNames].some(n => n.toUpperCase().includes(name));
  const inRazon = [...razonNames].some(n => n.toUpperCase().includes(name));
  const inCliente = [...clienteNames].some(n => n.toUpperCase().includes(name));
  console.log(`  ${name}: matriz=${inMatriz} razon=${inRazon} cliente=${inCliente}`);
}
