import { describe, expect, it } from 'vitest'
import { imageUrlProblem, normalizeImageUrl } from '@/lib/offers/imageUrl'

describe('normalizeImageUrl', () => {
  it('unwraps a Google Images result to the image file (the link that broke the card in landly-dev)', () => {
    const pasted =
      'https://www.google.com/imgres?q=%D7%9E%D7%AA%D7%A0%D7%A1%D7%A7%D7%99&imgurl=https%3A%2F%2Fmedia.easy.co.il%2Fimages%2FUserThumbs%2F10165937_1785920654489_0.jpg&imgrefurl=https%3A%2F%2Feasy.co.il%2Fpage%2F10165937&docid=x&w=250&h=197'
    expect(normalizeImageUrl(pasted)).toBe('https://media.easy.co.il/images/UserThumbs/10165937_1785920654489_0.jpg')
  })

  it('turns Google Drive share links into a direct file link', () => {
    const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'
    expect(normalizeImageUrl(`https://drive.google.com/file/d/${id}/view?usp=sharing`)).toBe(`https://lh3.googleusercontent.com/d/${id}`)
    expect(normalizeImageUrl(`https://drive.google.com/open?id=${id}`)).toBe(`https://lh3.googleusercontent.com/d/${id}`)
    expect(normalizeImageUrl(`https://drive.google.com/uc?export=view&id=${id}`)).toBe(`https://lh3.googleusercontent.com/d/${id}`)
  })

  it('turns an Imgur post into its image file', () => {
    expect(normalizeImageUrl('https://imgur.com/AbC123x')).toBe('https://i.imgur.com/AbC123x.jpg')
    expect(normalizeImageUrl('https://m.imgur.com/AbC123x?ref=share')).toBe('https://i.imgur.com/AbC123x.jpg')
  })

  it('leaves direct links, albums and empty values alone (trimmed)', () => {
    expect(normalizeImageUrl('  https://i.imgur.com/AbC123x.png ')).toBe('https://i.imgur.com/AbC123x.png')
    expect(normalizeImageUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
    expect(normalizeImageUrl('https://imgur.com/a/AbC123x')).toBe('https://imgur.com/a/AbC123x')
    expect(normalizeImageUrl('')).toBe('')
  })

  it('does not unwrap an imgres link that wraps another imgres link', () => {
    const inner = encodeURIComponent('https://www.google.com/imgres?imgurl=https%3A%2F%2Fx.com%2Fa.jpg')
    const nested = `https://www.google.com/imgres?imgurl=${inner}`
    expect(normalizeImageUrl(nested)).toBe(nested)
  })
})

describe('imageUrlProblem', () => {
  it('flags pages that cannot be an image', () => {
    expect(imageUrlProblem('https://www.google.com/search?q=falafel&tbm=isch')).toMatch(/Google search page/)
    expect(imageUrlProblem('https://www.google.com/imgres?q=x')).toMatch(/Google search page/)
    expect(imageUrlProblem('https://drive.google.com/drive/folders/abc')).toMatch(/Google Drive/)
    expect(imageUrlProblem('https://imgur.com/gallery/AbC123x')).toMatch(/Imgur album/)
  })

  it('accepts what normalizeImageUrl produces', () => {
    expect(imageUrlProblem('https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBeNull()
    expect(imageUrlProblem('https://i.imgur.com/AbC123x.jpg')).toBeNull()
    expect(imageUrlProblem('https://media.easy.co.il/images/a.jpg')).toBeNull()
  })
})
