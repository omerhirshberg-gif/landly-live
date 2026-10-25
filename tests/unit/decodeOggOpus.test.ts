import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { encodeWav, MAX_DECODE_SECONDS } from '@/components/admin/support/media/decodeOggOpus'

const ascii = (view: DataView, offset: number, length: number) => String.fromCharCode(...new Uint8Array(view.buffer, offset, length))

describe('voice notes decoded in the page', () => {
  it('writes 16-bit PCM WAV that every browser plays', () => {
    const left = new Float32Array([0, 1, -1, 0.5])
    const view = new DataView(encodeWav([left], 48000))
    expect(view.byteLength).toBe(44 + 4 * 2)
    expect(ascii(view, 0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(36 + 8)
    expect(ascii(view, 8, 8)).toBe('WAVEfmt ')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(48000)
    expect(view.getUint32(28, true)).toBe(96000) // bytes per second
    expect(view.getUint16(34, true)).toBe(16)
    expect(ascii(view, 36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(8)
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 16383])
  })

  it('interleaves stereo, clips out-of-range samples, and stops at the decoded length', () => {
    const view = new DataView(encodeWav([new Float32Array([2, 0, 9]), new Float32Array([-2, 0, 9])], 48000, 2))
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(40, true)).toBe(2 * 2 * 2)
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([32767, -32768, 0, 0])
  })

  it('loads the decoder only on demand, and only in the browser that needs it', () => {
    expect(MAX_DECODE_SECONDS).toBe(5 * 60)
    const decoder = readFileSync('components/admin/support/media/decodeOggOpus.ts', 'utf8')
    expect(decoder).not.toMatch(/^import .*ogg-opus-decoder/m)
    expect(decoder).toContain("await import('ogg-opus-decoder')")
    const player = readFileSync('components/admin/support/media/AudioMessage.tsx', 'utf8')
    expect(player).toContain("await import('./decodeOggOpus')")
    expect(player).not.toMatch(/^import .*decodeOggOpus/m)
  })
})
