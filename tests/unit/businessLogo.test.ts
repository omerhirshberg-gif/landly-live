import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseLogoUrl } from '@/lib/business/businessLogo'
import { alphaBounds, containedSquare, fitWithin, isLowResolution, LOGO_MAX_EDGE, trimmedSquare } from '@/lib/images/crop'
import { bannerPathFromUrl, isPng, logoPathFromUrl, storageDownloadUrl, uploadImageType } from '@/lib/storage/bannerPath'

const read = (path: string) => readFileSync(path, 'utf8')

describe('parseLogoUrl', () => {
  it('keeps an https link and clears an empty or missing one', () => {
    expect(parseLogoUrl('https://cdn.example/pizza-hut.png')).toEqual({ ok: true, logoUrl: 'https://cdn.example/pizza-hut.png' })
    expect(parseLogoUrl('  ')).toEqual({ ok: true, logoUrl: '' })
    expect(parseLogoUrl(undefined)).toEqual({ ok: true, logoUrl: '' })
    expect(parseLogoUrl(null)).toEqual({ ok: true, logoUrl: '' })
  })

  it('unwraps the usual copy-paste wrappers, as offer images do', () => {
    expect(parseLogoUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view')).toEqual({
      ok: true,
      logoUrl: 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOp',
    })
  })

  it('rejects what can never be an image', () => {
    expect(parseLogoUrl(42).ok).toBe(false)
    expect(parseLogoUrl('not a url').ok).toBe(false)
    expect(parseLogoUrl('https://www.google.com/search?q=pizza+hut+logo').ok).toBe(false)
  })
})

describe('containedSquare', () => {
  it('fits a wide wordmark whole, centred on a 1024px square', () => {
    const box = containedSquare(4000, 1000, LOGO_MAX_EDGE)
    expect(box).toEqual({ size: 1024, dx: 0, dy: 384, dw: 1024, dh: 256 })
  })

  it('fits a tall mark whole and never upscales a small logo', () => {
    expect(containedSquare(600, 1200, LOGO_MAX_EDGE)).toEqual({ size: 1024, dx: 256, dy: 0, dw: 512, dh: 1024 })
    expect(containedSquare(120, 80, LOGO_MAX_EDGE)).toEqual({ size: 120, dx: 0, dy: 20, dw: 120, dh: 80 })
  })

  it('draws a vector at the full size, whatever size it declares', () => {
    expect(containedSquare(120, 80, LOGO_MAX_EDGE, { vector: true })).toEqual({ size: 1024, dx: 0, dy: 170, dw: 1024, dh: 683 })
  })

  it('warns about a logo too small for the badge at @3x', () => {
    expect(isLowResolution('logo', 300, 300)).toBe(true)
    expect(isLowResolution('logo', 800, 200)).toBe(false)
  })
})

describe('trimming a logo’s transparent margins', () => {
  // A 10×4 RGBA image, transparent but for the mark at x 2–7, y 1–2.
  const pixels = (() => {
    const data = new Uint8ClampedArray(10 * 4 * 4)
    for (let y = 1; y <= 2; y++) for (let x = 2; x <= 7; x++) data[(y * 10 + x) * 4 + 3] = 255
    return data
  })()

  it('finds the mark inside its margins, or nothing on a blank image', () => {
    expect(alphaBounds(pixels, 10, 4)).toEqual({ x: 2, y: 1, width: 6, height: 2 })
    expect(alphaBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull()
  })

  it('fills the square with the mark, never past the source’s own pixels', () => {
    // A 2000×2000 upload whose wordmark is 1600×400 in the middle: drawn at 1024, trimmed, squared.
    const drawn = fitWithin(2000, 2000, LOGO_MAX_EDGE)
    expect(drawn).toEqual({ width: 1024, height: 1024, scale: 0.512 })
    const content = { x: 102, y: 410, width: 820, height: 205 }
    const box = trimmedSquare(drawn, content, drawn.scale, LOGO_MAX_EDGE)
    expect(box.size).toBe(1024)
    // The mark spans the square's full width, centred vertically.
    // (to the pixel: the drawing's size and offset are rounded separately)
    expect(Math.abs(content.x * (box.dw / drawn.width) + box.dx)).toBeLessThanOrEqual(1)
    expect(Math.abs((content.x + content.width) * (box.dw / drawn.width) + box.dx - 1024)).toBeLessThanOrEqual(1)
    // A small bitmap stays its own size; a vector is drawn at the full square.
    const small = trimmedSquare({ width: 200, height: 100 }, { x: 0, y: 0, width: 200, height: 100 }, 1, LOGO_MAX_EDGE)
    expect(small.size).toBe(200)
    expect(trimmedSquare({ width: 1024, height: 512 }, { x: 0, y: 0, width: 1024, height: 512 }, 8, LOGO_MAX_EDGE, { vector: true }).size).toBe(1024)
  })
})

describe('logo storage URLs', () => {
  const bucket = 'landly-dev.firebasestorage.app'

  it('round-trips our own logo uploads, kept apart from banners', () => {
    const logo = storageDownloadUrl(bucket, 'logos/9c1e-77.jpg', 'tok')
    expect(logoPathFromUrl(logo, bucket)).toBe('logos/9c1e-77.jpg')
    // An offer's banner cleanup never deletes its business's logo, and the other way round.
    expect(bannerPathFromUrl(logo, bucket)).toBeNull()
    expect(logoPathFromUrl(storageDownloadUrl(bucket, 'banners/9c1e-77.jpg', 'tok'), bucket)).toBeNull()
  })

  it('never claims anything else for deletion', () => {
    expect(logoPathFromUrl('https://cdn.example/logo.png', bucket)).toBeNull()
    expect(logoPathFromUrl(storageDownloadUrl('landly-be752.firebasestorage.app', 'logos/x.jpg', 't'), bucket)).toBeNull()
    expect(logoPathFromUrl(storageDownloadUrl(bucket, 'logos/../avatars/x.jpg', 't'), bucket)).toBeNull()
  })

  it('claims lossless PNG logos too', () => {
    expect(logoPathFromUrl(storageDownloadUrl(bucket, 'logos/9c1e-77.png', 'tok'), bucket)).toBe('logos/9c1e-77.png')
    expect(logoPathFromUrl(storageDownloadUrl(bucket, 'logos/9c1e-77.svg', 'tok'), bucket)).toBeNull()
  })

  it('recognizes PNG and JPEG bytes, and nothing else', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    expect(isPng(png)).toBe(true)
    expect(uploadImageType(png)).toBe('image/png')
    expect(uploadImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(uploadImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
  })

  it('serves logos publicly and takes no client writes', () => {
    expect(read('storage.rules')).toMatch(/match \/logos\/\{fileName\} \{\s*allow read: if true;\s*allow write: if false;\s*\}/)
  })
})

// The edit route against an in-memory Firestore: the logo is saved on the
// business, copied onto every one of its offers, and a replaced upload deleted.
const db = vi.hoisted(() => ({
  business: {} as Record<string, unknown>,
  offers: [] as { id: string }[],
  updates: [] as { path: string; data: Record<string, unknown> }[],
}))
const deleteLogoByUrl = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('@/lib/admin/adminAuth', () => ({ requireAdminAuth: () => null }))
vi.mock('@/lib/admin/revalidateHome', () => ({ revalidateGuestHome: () => {} }))
vi.mock('@/lib/translate/translateBusinessOnSave', () => ({
  businessTranslationsForSave: async () => ({ ok: true, translations: {}, warning: null }),
}))
vi.mock('@/lib/storage/banners', () => ({ deleteBannerByUrl: async () => {}, deleteLogoByUrl }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => ({}),
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        path: `${name}/${id}`,
        get: async () => ({ exists: true, data: () => db.business }),
      }),
      where: () => ({
        get: async () => ({
          size: db.offers.length,
          docs: db.offers.map((offer) => ({ ref: { path: `offers/${offer.id}` }, data: () => offer })),
        }),
      }),
    }),
    batch: () => ({
      update: (ref: { path: string }, data: Record<string, unknown>) => db.updates.push({ path: ref.path, data }),
      commit: async () => {},
    }),
  }),
}))

const { PATCH } = await import('@/app/api/admin/businesses/[uid]/route')

const patch = (business: Record<string, unknown>) =>
  PATCH(
    new Request('https://landly.test/api/admin/businesses/biz1', { method: 'PATCH', body: JSON.stringify({ business }) }),
    { params: Promise.resolve({ uid: 'biz1' }) }
  )
const details = { businessName: 'Pizza Hut', category: 'Restaurants and Cafes', location: 'Tel Aviv' }
const uploaded = (name: string) => storageDownloadUrl('landly-dev.firebasestorage.app', `logos/${name}.jpg`, 't')

describe('PATCH /api/admin/businesses/[uid] with a logo', () => {
  beforeEach(() => {
    db.business = { businessName: 'Pizza Hut', logoUrl: uploaded('old') }
    db.offers = [{ id: 'o1' }, { id: 'o2' }]
    db.updates = []
    deleteLogoByUrl.mockClear()
  })

  it('copies a new logo onto every offer and deletes the replaced upload after saving', async () => {
    const res = await patch({ ...details, logoUrl: uploaded('new') })
    expect(res.status).toBe(200)
    expect((await res.json()).logoUrl).toBe(uploaded('new'))
    expect(db.updates.find((u) => u.path === 'businesses/biz1')?.data.logoUrl).toBe(uploaded('new'))
    const offers = db.updates.filter((u) => u.path.startsWith('offers/'))
    expect(offers.map((u) => u.path)).toEqual(['offers/o1', 'offers/o2'])
    for (const offer of offers) expect(offer.data.businessLogoUrl).toBe(uploaded('new'))
    expect(deleteLogoByUrl).toHaveBeenCalledWith(uploaded('old'))
  })

  it('removes the logo from the business and its offers when cleared', async () => {
    await patch({ ...details, logoUrl: '' })
    expect(db.updates.find((u) => u.path === 'businesses/biz1')?.data.logoUrl).not.toBe('')
    for (const offer of db.updates.filter((u) => u.path.startsWith('offers/'))) expect(offer.data.businessLogoUrl).toBe('')
    expect(deleteLogoByUrl).toHaveBeenCalledWith(uploaded('old'))
  })

  it('keeps the stored logo when an older client sends none, and deletes nothing', async () => {
    await patch(details)
    for (const offer of db.updates.filter((u) => u.path.startsWith('offers/'))) expect(offer.data.businessLogoUrl).toBe(uploaded('old'))
    expect(deleteLogoByUrl).not.toHaveBeenCalled()
  })

  it('refuses a link that can never be an image, writing nothing', async () => {
    const res = await patch({ ...details, logoUrl: 'not a url' })
    expect(res.status).toBe(400)
    expect(db.updates).toEqual([])
  })
})

describe('logo wiring', () => {
  it('sets the logo on a new business and its first offer, and lists it for the edit form', () => {
    const route = read('app/api/admin/businesses/route.ts')
    expect(route).toContain('const logo = parseLogoUrl(business.logoUrl)')
    expect(route).toContain('...(logo.logoUrl ? { logoUrl: logo.logoUrl } : {}),')
    expect(route).toContain('businessLogoUrl: logo.logoUrl,')
    expect(route).toContain("logoUrl: typeof doc.data().logoUrl === 'string' ? doc.data().logoUrl : '',")
  })

  it('copies the business’s logo onto each new offer', () => {
    expect(read('app/api/admin/offers/route.ts')).toContain("businessLogoUrl: typeof business.logoUrl === 'string' ? business.logoUrl : '',")
  })

  it('deletes the logo upload with its business', () => {
    expect(read('app/api/admin/businesses/[uid]/route.ts')).toContain('deleteLogoByUrl(businessSnap.data()?.logoUrl),')
  })

  it('stores logo uploads under logos/', () => {
    const route = read('app/api/admin/uploads/route.ts')
    expect(route).toContain("const logo = form?.get('kind') === 'logo'")
    expect(route).toContain('logo ? await uploadLogo(bytes, type) : await uploadBanner(bytes)')
    // A banner is a photo: only ever JPEG.
    expect(route).toContain("(!logo && type !== 'image/jpeg')")
    const field = read('components/admin/ImageUploadField.tsx')
    expect(field).toContain("if (logo) body.append('kind', 'logo')")
    expect(field).toContain('await compressLogo(file, { maxEdge: LOGO_MAX_EDGE, maxBytes: MAX_UPLOAD_BYTES })')
  })

  it('offers the logo field on the new-business page and in Edit details', () => {
    expect(read('app/admin/businesses/new/page.tsx')).toContain("<BusinessLogoField value={form.logoUrl} onChange={(url) => update('logoUrl', url)} />")
    const edit = read('components/admin/BusinessEditForm.tsx')
    expect(edit).toContain('<BusinessLogoField value={form.logoUrl}')
    expect(edit).toContain('logoUrl: form.logoUrl, phone: form.phone }')
  })

  it('reads the logo with every offer, normalized like its image, on web and in the app', () => {
    expect(read('lib/firebase/offers.ts')).toContain(
      "businessLogoUrl: normalizeImageUrl(typeof data.businessLogoUrl === 'string' ? data.businessLogoUrl : ''),"
    )
  })
})
