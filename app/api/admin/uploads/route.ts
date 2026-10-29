import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { MAX_UPLOAD_BYTES, uploadImageType } from '@/lib/storage/bannerPath'
import { uploadBanner, uploadLogo } from '@/lib/storage/banners'

// Offer banner and business logo uploads from the admin
// (components/admin/ImageUploadField.tsx). The browser has already cropped
// a banner to 16:9 (≤2400px) and re-encoded it as JPEG, or fitted a logo
// whole into a ≤1024px square as a lossless PNG (a JPEG for a photo-like
// one over the cap; an SVG is drawn into it, never sent), so this only
// checks the bytes are one of those, and small, before storing them at
// banners/{uuid}.jpg or (kind=logo) logos/{uuid}.png|jpg. The returned URL
// goes into the offer's imageUrl or the business's logoUrl on save; the
// routes delete it again when it's replaced or its offer or business goes.
// The same in both projects: the bucket comes from the environment.
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Missing file.' }, { status: 400 })
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'The image is over 4MB after compression.' }, { status: 413 })

  const logo = form?.get('kind') === 'logo'
  const bytes = Buffer.from(await file.arrayBuffer())
  const type = uploadImageType(bytes)
  if (!type || (!logo && type !== 'image/jpeg')) {
    return NextResponse.json({ error: logo ? 'Only PNG or JPEG logos are accepted.' : 'Only JPEG images are accepted.' }, { status: 415 })
  }

  try {
    const url = logo ? await uploadLogo(bytes, type) : await uploadBanner(bytes)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Image upload failed', error)
    return NextResponse.json({ error: 'The upload failed. Try again.' }, { status: 502 })
  }
}
