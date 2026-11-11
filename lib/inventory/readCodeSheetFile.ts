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
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, dense: true })
  const sheet = book.Sheets[book.SheetNames[0] ?? '']
  if (!sheet) return []
  // raw: codes such as 0012345 must stay text; header: 1 gives plain rows.
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true })
}
