import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')

// Consumer inputs show the field's name as a grey hint inside the box, with no label above, and focus without a
// scale jump. The business portal keeps .inp, so the consumer style is its own class.
describe('consumer inputs', () => {
  it('keeps .inp for the business portal and adds .inp-consumer with the agreed tokens', () => {
    const css = read('app/globals.css')
    expect(css).toContain('.inp{width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:13px 16px;')
    const consumer = css.match(/\.inp-consumer\{[^}]*\}/)?.[0] ?? ''
    expect(consumer).toContain('height:48px')
    expect(consumer).toContain('border-radius:12px')
    expect(consumer).toContain('font-size:16px')
    expect(css).toContain('.inp-consumer::placeholder{color:#94a3b8;}')
    expect(css).toContain('box-shadow:0 0 0 2px rgba(0,56,184,.15)')
  })

  it('has no focus zoom and puts the field name inside the box, on web and native', () => {
    const web = read('components/auth/entrance/TextField.tsx')
    const native = read('landly-mobile/src/components/TextField.tsx')
    expect(web).not.toMatch(/scale-\[1\.025\]/)
    expect(native).not.toMatch(/FOCUS_SCALE|withSpring/)
    expect(web).toContain('aria-label={label}')
    expect(web).toContain('placeholder={showLabel ? undefined : label}')
    expect(native).toContain('accessibilityLabel={label}')
    expect(native).toContain('placeholder={showLabel ? undefined : label}')
    expect(native).toContain('minHeight: 50')
    expect(native).toContain('borderRadius: 12')
  })

  it('keeps a small label only on password pairs', () => {
    const withLabel = [
      ['components/auth/entrance/AuthScreen.tsx', 2],
      ['app/reset-password/page.tsx', 2],
      ['landly-mobile/src/app/(auth)/login.tsx', 2],
      ['landly-mobile/src/components/ChangePassword.tsx', 2],
    ] as const
    for (const [file, count] of withLabel) expect(read(file).match(/^\s*showLabel$/gm)?.length, file).toBe(count)
    for (const file of ['app/forgot-password/page.tsx', 'components/auth/onboarding/OnboardingWizard.tsx', 'components/auth/onboarding/PersonaStep.tsx', 'landly-mobile/src/components/ChangeEmailForm.tsx']) {
      expect(read(file), file).not.toMatch(/^\s*showLabel$/m)
    }
  })

  it('moves consumer forms off .inp and hides the old visible labels', () => {
    for (const file of ['components/profile/ProfileSection.tsx', 'components/profile/ChangeEmailForm.tsx', 'components/settings/SecuritySection.tsx', 'components/settings/DeleteAccountForm.tsx', 'app/support/page.tsx']) {
      const source = read(file)
      expect(source, file).not.toMatch(/className="inp[ "]/)
      expect(source, file).not.toMatch(/block mb-1\.5 text-sm font-(bold|semibold)/)
    }
    const lead = read('components/prelaunch/LeadForm.tsx')
    expect(lead).not.toContain('mb-1.5 block text-sm font-semibold text-ink')
    expect(lead).toContain('placeholder={copy[label]}')
  })

  it('does not touch the business portal or admin styles', () => {
    expect(read('app/business/login/page.tsx')).toContain('inp')
    expect(read('components/admin/formStyles.ts')).not.toContain('inp-consumer')
  })
})
