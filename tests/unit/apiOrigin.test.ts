import { describe, expect, it } from 'vitest'
import { devApiOrigin } from '@/lib/apiOrigin'

describe('devApiOrigin', () => {
  it('points at port 3000 on the LAN address running Metro', () => {
    expect(devApiOrigin('192.168.7.57:8081')).toBe('http://192.168.7.57:3000')
    expect(devApiOrigin('exp://10.0.0.4:8081/--/')).toBe('http://10.0.0.4:3000')
  })

  it('accepts localhost (simulators, Expo web)', () => {
    expect(devApiOrigin('localhost:8081')).toBe('http://localhost:3000')
  })

  it('returns null for tunnels, missing or malformed hosts', () => {
    expect(devApiOrigin('abc-anonymous-8081.exp.direct')).toBeNull()
    expect(devApiOrigin('999.1.1.1:8081')).toBeNull()
    expect(devApiOrigin('')).toBeNull()
    expect(devApiOrigin(undefined)).toBeNull()
    expect(devApiOrigin(null)).toBeNull()
  })
})
