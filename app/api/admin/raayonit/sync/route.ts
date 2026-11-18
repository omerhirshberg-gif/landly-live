import { NextResponse, after } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { getAdminDb } from '@/lib/firebase/admin'
import { parseBrandsSheet } from '@/lib/inventory/raayonitCatalog'
import { bundledCatalog, scrapeRaayonitCatalog, syncRaayonitCatalog } from '@/lib/inventory/raayonitCatalogSync'
import { runDailySync } from '@/lib/inventory/raayonitDailySync'
import { cloudTranslator, isTranslationEnabled } from '@/lib/translate/cloudTranslate'

export const maxDuration = 300
const MAX_MATRIX_ROWS = 5000

// Builds the Raayonit "תו על" cards (a multi-chain one and one per brand, for each voucher stock) as drafts.
//   source "web":     reads Raayonit's public pages now; falls back to the bundled copy when they can't be read.
//   source "bundled": the copy shipped with the app (scripts/raayonit-snapshot.mts).
//   source "sheet":   the supplier's brands & branches sheet, sent as cells (re-validated here).
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const body = await request.json().catch(() => null)
  // mode "diff": the daily sync's difference only. `apply: false` (the default) is the dry-run preview and writes nothing; `apply: true`
  // writes it (`force: true` also applies a change a safety guard would stop). The panel always previews first, then confirms.
  if (body?.mode === 'diff') {
    const apply = body.apply === true
    const db = getAdminDb()
    const translateBatch = isTranslationEnabled() ? async (texts: string[], lang: string) => cloudTranslator.translate(texts, lang, 'he') : undefined
    const report = await runDailySync(db, { dry: !apply, force: apply && body.force === true }, { origin: new URL(request.url).origin, translateBatch })
    if (apply && report.status === 'ok') {
      revalidateGuestHome()
      await writeAudit(db, request, { action: 'raayonit.sync.diff', targetType: 'batch', targetId: 'raayonit', after: report.counts })
    }
    return NextResponse.json(report)
  }
  const source = body?.source === 'sheet' ? 'sheet' : body?.source === 'bundled' ? 'bundled' : 'web'

  let brands = bundledCatalog()
  let used: 'web' | 'bundled' | 'sheet' = 'bundled'
  let failed: string[] = []
  if (source === 'sheet') {
    const matrix: unknown = body?.matrix
    if (!Array.isArray(matrix) || matrix.length === 0 || matrix.length > MAX_MATRIX_ROWS || matrix.some((r) => !Array.isArray(r))) {
      return NextResponse.json({ error: 'Send the sheet as a list of rows.' }, { status: 400 })
    }
    const parsed = parseBrandsSheet(matrix as unknown[][])
    if (parsed.missingColumns.length > 0 || parsed.brands.length === 0) return NextResponse.json({ error: 'The sheet needs a brand column and at least one brand.', missingColumns: parsed.missingColumns }, { status: 400 })
    brands = parsed.brands
    used = 'sheet'
  } else if (source === 'web') {
    try {
      const live = await scrapeRaayonitCatalog()
      // A mostly-failed read is not a catalogue: keep the bundled copy instead of dropping brands.
      if (live.brands.length >= Math.ceil(bundledCatalog().length / 2)) {
        brands = live.brands
        used = 'web'
        failed = live.failed
      }
    } catch (err) {
      console.error('Raayonit catalogue read failed; using the bundled copy', err)
    }
  }

  const db = getAdminDb()
  const result = await syncRaayonitCatalog(db, { brands, origin: new URL(request.url).origin, after })
  revalidateGuestHome()
  await writeAudit(db, request, { action: 'raayonit.sync', targetType: 'batch', targetId: 'raayonit', after: { ...result, source: used, failed: failed.length } })
  return NextResponse.json({ ...result, source: used, failed })
}
