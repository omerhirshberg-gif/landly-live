import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { notePopState, previousPath, recordPath, resetPathHistory, willReplace } from '@/lib/navigation/previousPath'
import {
  SWIPE_EDGE_PX,
  isEdgeStart,
  settingsBackAction,
  settingsParent,
  shouldCommitSwipe,
  swipeAxis,
  swipeSign,
} from '@/lib/navigation/settingsBack'

describe('settings hierarchy', () => {
  it('sends each sub-page to its parent', () => {
    expect(settingsParent('/settings/language-region/origin')).toBe('/settings/language-region')
    expect(settingsParent('/settings/language-region')).toBe('/settings')
    expect(settingsParent('/settings/privacy-security')).toBe('/settings')
    expect(settingsParent('/settings/delete-account')).toBe('/settings')
    expect(settingsParent('/settings/delete-account/')).toBe('/settings')
    expect(settingsParent('/settings')).toBeNull()
    expect(settingsParent('/profile')).toBeNull()
  })

  it("uses the browser's back only when the parent is the page below", () => {
    expect(settingsBackAction('/settings', '/settings')).toEqual({ kind: 'back' })
    // Opened from the avatar menu or directly: still lands on the parent.
    expect(settingsBackAction('/settings', '/member')).toEqual({ kind: 'replace', href: '/settings' })
    expect(settingsBackAction('/settings', null)).toEqual({ kind: 'replace', href: '/settings' })
  })

  it("returns to /profile when its Edit opened the page (origin, region)", () => {
    expect(settingsBackAction('/settings/language-region', '/profile')).toEqual({ kind: 'back' })
    expect(settingsBackAction('/settings', '/profile')).toEqual({ kind: 'back' })
    // Through Settings → Language & Region, origin still returns to Language & Region.
    expect(settingsBackAction('/settings/language-region', '/settings/language-region')).toEqual({ kind: 'back' })
  })

  it('takes /settings back to the previous page, or home when opened directly', () => {
    expect(settingsBackAction(null, '/member')).toEqual({ kind: 'back' })
    expect(settingsBackAction(null, null)).toEqual({ kind: 'push', href: '/' })
  })
})

describe('previous path', () => {
  beforeEach(() => resetPathHistory())

  const popstate = notePopState

  it('knows nothing about a page opened directly', () => {
    recordPath('/settings/privacy-security')
    expect(previousPath()).toBeNull()
  })

  it('follows pushes, then pops on the browser back', () => {
    recordPath('/settings')
    recordPath('/settings/language-region')
    recordPath('/settings/language-region/origin')
    expect(previousPath()).toBe('/settings/language-region')
    popstate()
    recordPath('/settings/language-region')
    expect(previousPath()).toBe('/settings')
  })

  it('swaps the top on an announced replace, so back climbs instead of looping', () => {
    recordPath('/profile')
    recordPath('/settings/language-region/origin')
    willReplace()
    recordPath('/settings/language-region')
    expect(previousPath()).toBe('/profile')
    willReplace()
    recordPath('/settings')
    expect(previousPath()).toBe('/profile')
  })

  it('treats a forward (popstate to a new page) as a push', () => {
    recordPath('/settings')
    popstate()
    recordPath('/settings/privacy-security')
    expect(previousPath()).toBe('/settings')
  })
})

describe('swipe to go back', () => {
  it('swipes right in left-to-right languages and left in Hebrew', () => {
    expect(swipeSign(false)).toBe(1)
    expect(swipeSign(true)).toBe(-1)
    expect(swipeAxis(30, 4, false)).toBe('back')
    expect(swipeAxis(-30, 4, false)).toBe('other')
    expect(swipeAxis(-30, 4, true)).toBe('back')
    expect(swipeAxis(30, 4, true)).toBe('other')
  })

  it('leaves vertical scrolling and tiny moves alone', () => {
    expect(swipeAxis(4, 3, false)).toBeNull()
    expect(swipeAxis(12, 40, false)).toBe('other')
    expect(swipeAxis(20, 18, false)).toBe('other')
  })

  it("leaves the edge strips to the browser's and the OS's own back gestures", () => {
    expect(SWIPE_EDGE_PX).toBe(24)
    expect(isEdgeStart(10, 390)).toBe(true)
    expect(isEdgeStart(380, 390)).toBe(true)
    expect(isEdgeStart(24, 390)).toBe(false)
    expect(isEdgeStart(200, 390)).toBe(false)
  })

  it('turns the page past a third of the width or on a flick, otherwise springs back', () => {
    expect(shouldCommitSwipe(140, 390, 0.1)).toBe(true)
    expect(shouldCommitSwipe(120, 390, 0.1)).toBe(false)
    expect(shouldCommitSwipe(60, 390, 0.8)).toBe(true)
    expect(shouldCommitSwipe(20, 390, 2)).toBe(false)
  })

  it('is wired into every settings page, touch only, keeping vertical scroll and zoom native', () => {
    const shell = readFileSync('components/settings/SettingsPageShell.tsx', 'utf8')
    expect(shell).toContain('useSwipeBack<HTMLDivElement>(goBack, isRtl)')
    expect(shell).toContain('ref={pageRef}')
    const hook = readFileSync('components/settings/useSwipeBack.ts', 'utf8')
    expect(hook).toContain("e.pointerType !== 'touch'")
    expect(hook).toContain("el.style.touchAction = 'pan-y pinch-zoom'")
    expect(hook).toContain('isEdgeStart(e.clientX, window.innerWidth)')
    expect(hook).toContain('(prefers-reduced-motion: reduce)')
  })
})

describe('native settings stack', () => {
  it('anchors the Settings menu for deep links; Profile edits its details in place, with one Edit profile button', () => {
    expect(readFileSync('landly-mobile/src/app/settings/_layout.tsx', 'utf8')).toContain("export const unstable_settings = { anchor: 'index' }")
    const profile = readFileSync('landly-mobile/src/app/(tabs)/profile.tsx', 'utf8')
    expect(profile.match(/t\('profile_edit_profile_btn'\)/g)).toHaveLength(1)
    expect(profile).not.toContain("t('profile_edit_btn')")
    expect(profile).toContain('await updateUserProfileDetails(user.uid, next)')
    expect(profile).not.toMatch(/router\.push\('\/settings\/(origin|language-region|member-type)'\)/)
    expect(profile).not.toContain('withAnchor')
  })

  it('keeps the full-screen swipe, mirrored for Hebrew', () => {
    const flip = readFileSync('landly-mobile/src/lib/pageFlip.ts', 'utf8')
    expect(flip).toContain('fullScreenGestureEnabled: true')
    expect(flip).toContain("isRtl ? 'slide_from_left' : 'default'")
    expect(readFileSync('landly-mobile/src/app/_layout.tsx', 'utf8')).toContain('<Stack.Screen name="settings" options={pageFlipOptions(isRtl)} />')
  })
})
