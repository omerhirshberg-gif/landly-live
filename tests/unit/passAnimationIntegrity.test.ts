import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// The landing's Wallet-style pass entrance is fixed. These hashes pin its CSS
// and component exactly: a change here is a change to the motion, so it must
// be asked for, not picked up in passing.
const sha = (text: string) => createHash('sha256').update(text).digest('hex')
const css = readFileSync('app/globals.css', 'utf8')
const component = readFileSync('components/home/PassShowcase.tsx', 'utf8')
const home = readFileSync('components/home/HomePage.tsx', 'utf8')

const passCss = css.slice(css.indexOf('/* The pass mockup\'s Wallet-style entrance'), css.indexOf('/* Dropdown lists that open under a field'))

describe('pass animation integrity', () => {
  it('keeps the animation CSS byte for byte', () => {
    expect(sha(passCss)).toBe('dc119aed9d00fa8ce2437ed5281b28dd7350167ecdc109a5268e1da128e30c40')
    expect(css).toContain('.pass-stage{overflow-x:hidden;overflow-x:clip;}')
  })

  it('keeps the component byte for byte', () => {
    expect(sha(component)).toBe('6126b0074fba2f3ea88f8ef660d9c0b02ea260f6a8006c0d630330f9cef6a701')
  })

  it('keeps every timing', () => {
    expect(passCss).toContain('pass-slide-up .9s cubic-bezier(.16,1,.3,1) both')
    expect(passCss).toContain('pass-wipe .5s cubic-bezier(.65,0,.35,1) .5s both')
    expect(passCss).toContain('pass-shine .6s cubic-bezier(.65,0,.35,1) .95s both')
    expect(passCss).toContain('pass-rise .4s cubic-bezier(.22,1,.36,1) 1s both')
  })

  it('never wraps the phone in a Reveal, whose transform would change its entrance', () => {
    expect(home).toContain('<SectionBoundary name="pass-showcase"><PassShowcase /></SectionBoundary>')
  })
})
