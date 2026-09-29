export function csvCell(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Número inválido para exportar.');
    return String(value);
  }
  let text=String(value??'');
  if (/^[\s]*[=+@-]/.test(text)) text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
export const csvRow=(values:unknown[])=>values.map(csvCell).join(',');
