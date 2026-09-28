# tools/analysis

Harnesses de análisis que se usaron para validar el motor de matching contra
conciliaciones hechas a mano. **No son tests automatizados y no corren en CI**:
dependen de archivos `.xlsx` reales que no viven en el repo.

Los datos de entrada se pasan por variable de entorno. Si falta alguna, el script
lo dice y sale con código 1 en vez de fallar con un stack trace.

| Script | Qué hace | Variables |
|---|---|---|
| `test_matching.cjs` | Compara el motor de matching contra la conciliación tomada como referencia y reporta los desvíos | `CONCILIAYA_INVOICES_XLSX`, `CONCILIAYA_BANK_XLSX`, `CONCILIAYA_GOLD_XLSX` |
| `test_fifo.cjs` | Prueba la asignación FIFO v6 (con el sub-pool de Cardinal separado del grupo minoritario Cordero) | `CONCILIAYA_INVOICES_XLSX`, `CONCILIAYA_BANK_XLSX`, `CONCILIAYA_GOLD_XLSX` |
| `test_import_bug.cjs` | Reproduce la autodetección de columnas de `src/components/UploadView.tsx` y valida fila por fila el import de facturas | `CONCILIAYA_INVOICES_XLSX` |

## Cómo correrlos

```bash
npm ci

CONCILIAYA_INVOICES_XLSX=./facturas.xlsx \
CONCILIAYA_BANK_XLSX=./movimientos.xlsx \
CONCILIAYA_GOLD_XLSX=./conciliacion.xlsx \
node tools/analysis/test_matching.cjs
```

`test_matching.cjs` y `test_fifo.cjs` necesitan los tres archivos; `test_import_bug.cjs`
solo el de facturas.

> Estos scripts estaban en la raíz del repo con rutas absolutas a una carpeta local.
> Se movieron acá y se parametrizaron para que no expongan la estructura de
> carpetas de nadie y para que puedan correrse en otra máquina.
