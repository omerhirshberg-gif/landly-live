import type { Photo } from './copy'

// The /join photos, from the site's own category set, all 960×600. Alt text is
// translated in copy.ts. public/categories/tourism.webp stays out: it shows
// the Greek islands, not Israel.
export const photoSrc = (photo: Photo) => `/categories/${photo}.webp`

export const PHOTO_WIDTH = 960
export const PHOTO_HEIGHT = 600

export const COLLAGE_PHOTOS = ['restaurants', 'beach', 'sport'] as const satisfies readonly Photo[]
export const GALLERY_PHOTOS = ['attractions', 'pampering', 'fashion', 'cars', 'kids'] as const satisfies readonly Photo[]
