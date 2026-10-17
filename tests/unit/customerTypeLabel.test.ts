import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { customerTypeLabel } from '@/lib/customerTypes'
import { LangContext } from '@/lib/i18n/LangProvider'
import { translations, type TranslationKey } from '@/lib/i18n/translations'

vi.mock('@/lib/firebase/users', () => ({ getUserDocument: () => new Promise(() => {}), updateUserPhone: vi.fn() }))
vi.mock('@/lib/firebase/useMemberProfile', () => ({ invalidateMemberProfile: vi.fn() }))
vi.mock('@/components/profile/AvatarUploader', () => ({ default: () => 'AVATAR_UPLOADER' }))

const en = (key: TranslationKey) => translations.en[key]
const he = (key: TranslationKey) => translations.he[key]

// Profiles (web /account and /member, Expo Profile tab) show what a member
// typed for "Other" instead of the word "Other".
describe('customerTypeLabel', () => {
  it('shows the typed text for Other', () => {
    expect(customerTypeLabel('other', 'Volunteer in Haifa', en)).toBe('Volunteer in Haifa')
    expect(customerTypeLabel('other', '  Volunteer in Haifa  ', he)).toBe('Volunteer in Haifa')
  })

  it('falls back to "Other" when nothing was typed', () => {
    expect(customerTypeLabel('other', '', en)).toBe(translations.en.signup_customerType_other)
    expect(customerTypeLabel('other', '   ', he)).toBe(translations.he.signup_customerType_other)
  })

  it('ignores a leftover note on any other type', () => {
    expect(customerTypeLabel('student', 'Volunteer in Haifa', en)).toBe(translations.en.signup_customerType_student)
  })

  it('is null when no known type is set', () => {
    expect(customerTypeLabel('', '', en)).toBeNull()
    expect(customerTypeLabel('unknown', 'x', en)).toBeNull()
  })
})

describe('web profile section', async () => {
  const { default: ProfileSection } = await import('@/components/profile/ProfileSection')
  const html = renderToStaticMarkup(
    createElement(
      LangContext.Provider,
      { value: { lang: 'en', setLang: () => {}, t: en, isRtl: false } },
      createElement(ProfileSection, { user: { uid: 'u1', displayName: 'Dana Levi', email: 'dana@example.com' } as never })
    )
  )

  it('shows the name read-only: no name field, no form', () => {
    expect(html).toContain('>Dana Levi<')
    expect(html).not.toContain('autoComplete="name"')
    expect(html).not.toContain('autocomplete="name"')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<select')
    expect(html).not.toContain('<form')
  })

  it('offers exactly one Edit button, on the phone row', () => {
    const edits = [...html.matchAll(/<button [^>]*>Edit<\/button>/g)]
    expect(edits).toHaveLength(1)
    expect(edits[0][0]).toContain(`aria-label="${translations.en.profile_edit_btn} ${translations.en.profile_phone_label}"`)
  })
})
