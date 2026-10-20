'use client'

import { isHebrewScriptName, type BusinessNameOverrides, type BusinessTextField, type BusinessTranslations } from '@/lib/business/businessText'
import OfferTranslationsEditor from './OfferTranslationsEditor'

const LABELS: Record<BusinessTextField, string> = { businessName: 'Business name' }
const SINGLE_LINE: BusinessTextField[] = ['businessName']

// The business forms' "Name in other languages": the offer translations UI
// for the one field. A Hebrew name is translated by Google on save; a name in
// Latin letters is a brand and stays as written unless the admin writes a
// language's own wording (lib/business/businessText.ts).
export default function BusinessNameTranslations({
  name,
  stored,
  overrides,
  onChange,
}: {
  name: string
  stored: BusinessTranslations | null | undefined
  overrides: BusinessNameOverrides
  onChange: (next: BusinessNameOverrides) => void
}) {
  const hebrew = isHebrewScriptName(name)
  const sourceLang = hebrew ? 'he' : 'en'
  return (
    <OfferTranslationsEditor<BusinessTextField>
      source={{ businessName: name }}
      // Google's wording for a name in another script is dropped on save, so it isn't shown.
      stored={stored?.sourceLang === sourceLang ? stored : null}
      overrides={overrides}
      onChange={onChange}
      labels={LABELS}
      singleLine={SINGLE_LINE}
      legend="Name in other languages"
      sourceLang={sourceLang}
      intro={
        hebrew
          ? 'Translated automatically by Google when you save. Write your own wording for any language to replace Google’s; it stays as written even if you rename the business later.'
          : 'A name in Latin letters is a brand, so it stays as written in every language. Write a language’s own wording only if the business is known by another name there.'
      }
      pendingText={hebrew ? 'Translated when you save.' : 'Shown as written.'}
      emptyText="Fill in the business name above first."
    />
  )
}
