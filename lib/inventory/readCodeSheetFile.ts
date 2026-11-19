// Browser only: opens a supplier's .xlsx or .csv and hands its first sheet to
// parseCodeSheet as rows of cells. SheetJS is loaded on demand so the admin
// bundle doesn't carry it until someone uploads a file.

export const MAX_SHEET_BYTES = 5 * 1024 * 1024
export const SHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const

export function isSheetFile(file: File) {
  const name = file.name.toLowerCase()
  return SHEET_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export async function readCodeSheetFile(file: File): Promise<unknown[][]> {
  if (!isSheetFile(file)) throw new Error('unsupported')
  if (file.size > MAX_SHEET_BYTES) throw new Error('too_large')
  const XLSX = await import('xlsx')
  const bytes = await file.arrayBuffer()
  // SheetJS reads a CSV with no byte-order mark as Windows-1252, which garbles Hebrew headings:
  // decode it here, as UTF-8 when it is valid UTF-8 and as Windows-1255 (Excel's Hebrew CSV) when not.
  const book = file.name.toLowerCase().endsWith('.csv')
    ? XLSX.read(decodeCsv(bytes), { type: 'string', cellDates: true, dense: true })
    : XLSX.read(bytes, { type: 'array', cellDates: true, dense: true })
  const sheet = book.Sheets[book.SheetNames[0] ?? '']
  if (!sheet) return []
  // raw: codes such as 0012345 must stay text; header: 1 gives plain rows.
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true })
}

function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1255').decode(bytes)
  }
}
