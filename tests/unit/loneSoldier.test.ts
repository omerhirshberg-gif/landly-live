import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

const state: { profile: Record<string, unknown> | null } = { profile: null }
const firestore = vi.hoisted(() => ({ updateDoc: vi.fn(), doc: vi.fn((_db: unknown, ...path: string[]) => path.join('/')) }))

vi.mock('firebase/firestore', async (importOriginal) => ({ ...(await importOriginal<object>()), updateDoc: firestore.updateDoc, doc: firestore.doc }))
vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }))
vi.mock('next/navigation', () => ({ usePathname: () => '/settings/member-type', useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }))
vi.mock('@/components/settings/useSettingsMember', () => ({ useSettingsMember: () => ({ uid: 'u1' }) }))
vi.mock('@/lib/firebase/useMemberProfile', () => ({
  useMemberProfile: () => ({ loaded: true, profile: state.profile, firstName: null, initials: '', photoURL: null }),
  invalidateMemberProfile: vi.fn(),
}))
vi.mock('@/components/layout/Navbar', () => ({ default: () => 'NAVBAR' }))

import { CUSTOMER_TYPES, customerTypeLabel, isCustomerType, personaNote } from '@/lib/customerTypes'
import { updateUserCustomerType } from '@/lib/firebase/users'
const { default: PersonaStep } = await import('@/components/auth/onboarding/PersonaStep')
const { default: SegmentBadge } = await import('@/components/member/SegmentBadge')
const { default: MemberTypePage } = await import('@/app/settings/member-type/page')

const read = (path: string) => readFileSync(path, 'utf8')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

beforeEach(() => {
  firestore.updateDoc.mockReset()
  state.profile = null
})

describe('Lone Soldier member type', () => {
  it('is offered right after New Immigrant, with a label in every language', () => {
    const values = CUSTOMER_TYPES.map((o) => o.value)
    expect(values.indexOf('lone_soldier')).toBe(values.indexOf('new_immigrant') + 1)
    for (const lang of Object.keys(translations) as Lang[]) expect(translations[lang].signup_customerType_loneSoldier).toBeTruthy()
    expect(translations.en.signup_customerType_loneSoldier).toBe('Lone Soldier')
    expect(translations.he.signup_customerType_loneSoldier).toBe('חייל/ת בודד/ה')
  })

  it('is a known type, with its own label and badge colour', () => {
    expect(isCustomerType('lone_soldier')).toBe(true)
    expect(isCustomerType('soldier')).toBe(false)
    expect(isCustomerType(undefined)).toBe(false)
    expect(customerTypeLabel('lone_soldier', '', (k) => translations.he[k])).toBe('חייל/ת בודד/ה')
    const colors = CUSTOMER_TYPES.map((o) => o.color)
    expect(new Set(colors).size).toBe(colors.length)
    const html = withLang('he', createElement(SegmentBadge, { customerType: 'lone_soldier' }))
    expect(html).toContain('background:#4d7c0f')
    expect(html).toContain('חייל/ת בודד/ה')
  })

  it('saves the type and clears a leftover Other note', async () => {
    await updateUserCustomerType('u1', 'lone_soldier', 'Volunteer in Haifa')
    expect(firestore.updateDoc).toHaveBeenCalledWith('users/u1', { customerType: 'lone_soldier', customerTypeOther: '' })
    await updateUserCustomerType('u1', 'other', '  Volunteer   in Haifa ')
    expect(firestore.updateDoc).toHaveBeenLastCalledWith('users/u1', { customerType: 'other', customerTypeOther: 'Volunteer in Haifa' })
    expect(personaNote('lone_soldier', 'x')).toBe('')
  })
})

describe('customer type chips', () => {
  it.each(['en', 'he'] as const)('show every type, with the odd last chip ("Other") across both columns (%s)', (lang) => {
    const html = withLang(lang, createElement(PersonaStep, { labelledBy: 'x', value: 'lone_soldier', onChange: () => {}, note: '', onNoteChange: () => {} }))
    const chips = html.match(/<button [^>]*role="radio"[^>]*>[^<]*<\/button>/g) ?? []
    expect(chips).toHaveLength(CUSTOMER_TYPES.length)
    expect(chips.find((c) => c.includes(translations[lang].signup_customerType_loneSoldier))).toContain('aria-checked="true"')
    expect(CUSTOMER_TYPES.length % 2).toBe(1)
    expect(chips.at(-1)).toContain(translations[lang].signup_customerType_other)
    expect(chips.at(-1)).toContain('col-span-2')
    expect(chips.slice(0, -1).some((c) => c.includes('col-span-2'))).toBe(false)
  })

  it('in the app, let the odd last chip grow across the row', () => {
    expect(read('landly-mobile/src/auth/onboarding/PersonaStep.tsx')).toContain("cell: { flexBasis: '40%', flexGrow: 1")
  })
})

describe('Member type settings page (web)', () => {
  it.each(['en', 'he'] as const)('shows the chips with the stored type chosen and Save off until something changes (%s)', (lang) => {
    state.profile = { customerType: 'lone_soldier', customerTypeOther: '' }
    const html = withLang(lang, createElement(MemberTypePage))
    const t = translations[lang]
    expect(html).toContain(`>${t.onb_persona_title}</p>`)
    expect(html).toMatch(new RegExp(`aria-checked="true"[^>]*>${t.signup_customerType_loneSoldier}</button>`))
    expect(html).toMatch(new RegExp(`<button type="submit" disabled=""[^>]*>${t.profile_save_btn}</button>`))
  })

  it('is opened from the profile, and back returns there', () => {
    expect(read('components/profile/ProfileSection.tsx')).toMatch(/label=\{t\('signup_customerTypeLabel'\)\}[\s\S]*?href="\/settings\/member-type"/)
    expect(read('lib/navigation/settingsBack.ts')).toContain("SETTINGS_EDIT_OPENERS: readonly string[] = ['/profile']")
  })
})

describe('Customer type screen (app)', () => {
  const screen = read('landly-mobile/src/app/settings/member-type.tsx')

  it('uses the onboarding chips and saves through the shared helper', () => {
    expect(screen).toContain("import PersonaStep from '../../auth/onboarding/PersonaStep'")
    expect(screen).toContain('await updateUserCustomerType(user.uid, value, noteValue)')
    expect(screen).toContain('invalidateMemberProfile(user.uid)')
    expect(screen).toContain("<Button label={t('profile_save_btn')} onPress={save} busy={saving} disabled={!canSave} />")
  })

  it('is in the settings stack and opened from the Profile tab', () => {
    expect(read('landly-mobile/src/app/settings/_layout.tsx')).toContain('<Stack.Screen name="member-type" />')
    expect(read('landly-mobile/src/app/(tabs)/profile.tsx')).toMatch(/<EditRow\s+label=\{t\('signup_customerTypeLabel'\)\}[\s\S]*?router\.push\('\/settings\/member-type'\)/)
  })
})
