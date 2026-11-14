import { describe, expect, it } from 'vitest'
import {
  isPhoneNudgeSnoozed,
  needsPhoneVerification,
  PHONE_NUDGE_SNOOZE_MS,
  phoneNudgeCardVisible,
  phoneNudgeSnoozeKey,
} from '@/lib/profile/phoneNudge'
import { translations, type Lang } from '@/lib/i18n/translations'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 14)
const member = { phone: '+972521234567', customerType: 'olim', onboardingCompleted: true, phoneVerified: false }

describe('who owes a phone verification', () => {
  it('flags a customer who finished onboarding with an unverified phone', () => {
    expect(needsPhoneVerification(member)).toBe(true)
  })

  it('flags a member with no phone saved yet', () => {
    expect(needsPhoneVerification({ ...member, phone: '' })).toBe(true)
  })

  it('stops once the phone is verified', () => {
    expect(needsPhoneVerification({ ...member, phoneVerified: true })).toBe(false)
  })

  it('never flags a session without a customer document (business and staff accounts)', () => {
    expect(needsPhoneVerification(null)).toBe(false)
  })

  it('waits for onboarding to finish', () => {
    expect(needsPhoneVerification({ phone: '', customerType: '', onboardingCompleted: false, phoneVerified: false })).toBe(false)
  })
})

describe('the 7-day snooze', () => {
  it('hides for 7 days from the dismissal, then returns', () => {
    expect(isPhoneNudgeSnoozed(String(NOW - 6 * DAY), NOW)).toBe(true)
    expect(isPhoneNudgeSnoozed(String(NOW - 7 * DAY + 1), NOW)).toBe(true)
    expect(isPhoneNudgeSnoozed(String(NOW - PHONE_NUDGE_SNOOZE_MS), NOW)).toBe(false)
    expect(isPhoneNudgeSnoozed(String(NOW - 8 * DAY), NOW)).toBe(false)
  })

  it('treats nothing, junk and zero as not snoozed', () => {
    for (const value of [null, '', 'abc', '0', '-5']) expect(isPhoneNudgeSnoozed(value, NOW)).toBe(false)
  })

  it('is kept per member', () => {
    expect(phoneNudgeSnoozeKey('a')).not.toBe(phoneNudgeSnoozeKey('b'))
    expect(phoneNudgeSnoozeKey('a')).toContain('a')
  })

  it('hides the card but not the badge: the badge ignores the snooze', () => {
    const snoozed = String(NOW - DAY)
    expect(phoneNudgeCardVisible(member, snoozed, NOW)).toBe(false)
    expect(needsPhoneVerification(member)).toBe(true)
    expect(phoneNudgeCardVisible(member, null, NOW)).toBe(true)
  })

  it('hides the card for a verified member however the snooze stands', () => {
    expect(phoneNudgeCardVisible({ ...member, phoneVerified: true }, null, NOW)).toBe(false)
  })
})

describe('copy', () => {
  const keys = ['phone_nudge_title', 'phone_nudge_body', 'phone_nudge_cta', 'phone_nudge_dismiss', 'phone_nudge_badge_label'] as const
  it.each(Object.keys(translations) as Lang[])('has every phone-nudge string in %s', (lang) => {
    for (const key of keys) expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
  })
})
