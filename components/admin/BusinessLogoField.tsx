'use client'

import { useId } from 'react'
import ImageUploadField from './ImageUploadField'
import { ImagePreview } from './OfferFormFields'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from './formStyles'

// The business's logo, on the new-business page and its "Edit details":
// uploaded (fitted whole into a ≤1024px square, a lossless PNG stored under
// logos/) or a pasted link. Saved on the business and copied onto all its
// offers, where the perk cards show it in their rounded badge
// (lib/business/businessLogo.ts).
export default function BusinessLogoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const id = useId()
  return (
    <ImageUploadField
      shape="logo"
      value={value}
      onChange={onChange}
      linkInput={
        <>
          <label htmlFor={`${id}-logo-url`} className={ADMIN_LABEL}>Logo URL</label>
          <input
            id={`${id}-logo-url`}
            type="url"
            dir="ltr"
            className={ADMIN_INPUT}
            placeholder="https://…"
            aria-describedby={`${id}-logo-hint`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <p id={`${id}-logo-hint`} className={ADMIN_HINT}>
            A direct link to the logo. A transparent PNG or SVG, 1024px or larger, looks sharpest; it&apos;s shown whole on white, never cropped.
          </p>
          <ImagePreview url={value} shape="logo" />
        </>
      }
    />
  )
}
