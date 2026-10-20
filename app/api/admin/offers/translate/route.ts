import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminDb } from '@/lib/firebase/admin'
import { parseOfferTranslations } from '@/lib/offers/offerText'
import { activeTranslator } from '@/lib/translate/cloudTranslate'
import { buildOfferTranslations, manualOverridesOf } from '@/lib/translate/offerTranslations'
import { normalizeRedemptionTerms } from '@/lib/payments/voucherTerms'
import { normalizeRedemptionInstructions } from '@/lib/offers/redemption'

export const maxDuration = 60

// "Translate missing" on /admin/offers: fills in translations for offers saved
// before translation existed, or whose earlier translation failed. Offers
// already up to date cost nothing (buildOfferTranslations only calls the API
// for missing or stale fields); manual translations are kept. Works in
// slices so one request stays inside the function time limit: the page calls
// again while `remaining` > 0.
const TIME_BUDGET_MS = 40_000

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const translator = activeTranslator()
  if (!translator) return NextResponse.json({ error: 'Automatic translation is switched off (LANDLY_TRANSLATION_ENABLED).' }, { status: 503 })

  const startedAt = Date.now()
  const snap = await getAdminDb().collection('offers').get()
  let updated = 0
  let checked = 0
  let failed = 0
  for (const doc of snap.docs) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break
    checked += 1
    const data = doc.data()
    const existing = parseOfferTranslations(data.translations)
    const result = await buildOfferTranslations(
      {
        title: typeof data.title === 'string' ? data.title : '',
        description: typeof data.description === 'string' ? data.description : '',
        redemptionTerms: normalizeRedemptionTerms(data.redemptionTerms),
        redemptionInstructions: normalizeRedemptionInstructions(data.redemptionInstructions),
      },
      existing,
      manualOverridesOf(existing),
      translator
    )
    if (result.warning) failed += 1
    if (result.translatedCount > 0 || !existing) {
      await doc.ref.update({ translations: result.translations })
      updated += 1
    }
  }
  return NextResponse.json({ checked, updated, failed, remaining: snap.size - checked })
}
