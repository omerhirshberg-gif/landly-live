import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { isJpeg, MAX_BANNER_BYTES } from '@/lib/storage/bannerPath'
import { uploadBanner } from '@/lib/storage/banners'

// Offer banner uploads from the admin (components/admin/ImageUploadField.tsx).
// The browser has already cropped it to 16:9 and re-encoded it as a ≤1600px
// JPEG, so this only checks that it is one, and small, before storing it at
// banners/{uuid}.jpg. The returned URL goes into the offer's imageUrl on save;
// the offer routes delete it again when it's replaced or the offer goes.
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Missing file.' }, { status: 400 })
  if (file.size > MAX_BANNER_BYTES) return NextResponse.json({ error: 'The image is over 2MB after compression.' }, { status: 413 })

  const bytes = Buffer.from(await file.arrayBuffer())
  if (!isJpeg(bytes)) return NextResponse.json({ error: 'Only JPEG images are accepted.' }, { status: 415 })

  try {
    return NextResponse.json({ url: await uploadBanner(bytes) })
  } catch (error) {
    console.error('Banner upload failed', error)
    return NextResponse.json({ error: 'The upload failed. Try again.' }, { status: 502 })
  }
}
