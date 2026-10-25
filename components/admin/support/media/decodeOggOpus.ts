// A voice note for browsers that can't play Opus in Ogg (Safari on iPhone):
// its bytes from our own origin (app/api/admin/whatsapp/media/route.ts),
// decoded in the page by ogg-opus-decoder (WebAssembly, loaded only here,
// on the first tap) and wrapped as 16-bit PCM WAV, which every browser's
// <audio> plays with its own controls.

/**
 * Longer than this isn't decoded in the page; the download stays. Decoded
 * audio is 48 kHz float (about 11 MB a minute per channel) plus its WAV copy,
 * so this keeps a phone's memory in bounds; voice notes are rarely this long.
 */
export const MAX_DECODE_SECONDS = 5 * 60
/** Opus voice runs well under 64 kbit/s: a larger file is longer than MAX_DECODE_SECONDS, so it isn't fetched into memory whole. */
const MAX_DECODE_BYTES = 4 * 1024 * 1024

/** A WAV file (RIFF, 16-bit PCM, interleaved) of the first `length` samples of each channel. */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number, length = channels[0]?.length ?? 0): ArrayBuffer {
  const count = Math.max(1, Math.min(channels.length, 2))
  const dataBytes = length * count * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const ascii = (offset: number, text: string) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, count, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * count * 2, true)
  view.setUint16(32, count * 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < count; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return buffer
}

/** Fetches and decodes the voice note at `url` into a playable WAV Blob; throws when it can't. */
export async function decodeOggOpusToWav(url: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(url, { credentials: 'same-origin', signal })
  if (!res.ok) throw new Error(`Voice note download failed: HTTP ${res.status}`)
  if (Number(res.headers.get('content-length')) > MAX_DECODE_BYTES) {
    await res.body?.cancel().catch(() => {})
    throw new Error('The voice note is too long to play here')
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  const { OggOpusDecoder } = await import('ogg-opus-decoder')
  const decoder = new OggOpusDecoder()
  try {
    await decoder.ready
    const { channelData, samplesDecoded, sampleRate } = await decoder.decodeFile(bytes)
    if (!samplesDecoded) throw new Error('The voice note has no audio')
    if (samplesDecoded > MAX_DECODE_SECONDS * sampleRate) throw new Error('The voice note is too long to play here')
    return new Blob([encodeWav(channelData, sampleRate, samplesDecoded)], { type: 'audio/wav' })
  } finally {
    decoder.free()
  }
}
