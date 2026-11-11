import { describe, expect, it } from 'vitest'
import {
  MOCK_INSTITUTION_CODE, MOCK_SENDING_CODE, buildDetail, buildHeader, buildMasavFile, buildTrailer, encodeWindows1255,
  formatAccount, masavConfig, masavFileName, sanitizeMasavName, yymmdd, type MasavPayment,
} from '@/lib/finance/masavGenerator'

const mock = masavConfig({})
const slice = (line: string, from: number, to: number) => line.slice(from - 1, to) // 1-based, inclusive
const pay: MasavPayment = { bankCode: '12', branchCode: '600', accountNumber: '123456', taxId: '123456782', name: 'Cafe Example Ltd', amountAgorot: 102345 }

describe('MASAV configuration', () => {
  it('falls back to the fictitious test codes when nothing is configured', () => {
    expect(mock).toEqual({ institutionCode: '99999999', sendingCode: '99999', isMock: true })
    expect(masavConfig({ MASAV_INSTITUTION_CODE: '  ' }).isMock).toBe(true)
    expect(MOCK_INSTITUTION_CODE).toHaveLength(8)
    expect(MOCK_SENDING_CODE).toHaveLength(5)
  })
  it('uses and zero-pads real codes', () => {
    expect(masavConfig({ MASAV_INSTITUTION_CODE: '123456', MASAV_SENDING_INSTITUTION_CODE: '42' })).toEqual({ institutionCode: '00123456', sendingCode: '00042', isMock: false })
  })
  it('still counts the mock value as mock when set explicitly', () => {
    expect(masavConfig({ MASAV_INSTITUTION_CODE: '99999999' }).isMock).toBe(true)
  })
  it('refuses a malformed code', () => {
    expect(() => masavConfig({ MASAV_INSTITUTION_CODE: '12ab' })).toThrow()
    expect(() => masavConfig({ MASAV_INSTITUTION_CODE: '123456789' })).toThrow()
  })
  it('names a mock file with the test watermark and a real one by date', () => {
    expect(masavFileName(mock, '2026-11-30', new Date('2026-11-11T10:20:30Z'))).toBe('MASAV_MOCK_TEST_20261111102030.dat')
    expect(masavFileName(masavConfig({ MASAV_INSTITUTION_CODE: '1' }), '2026-11-30', new Date())).toBe('MASAV_261130.dat')
  })
})

describe('Record K (header)', () => {
  const line = buildHeader({ config: mock, valueDate: '2026-11-30', createdAt: '2026-11-11' })
  it('is 128 characters at the specified columns', () => {
    expect(line).toHaveLength(128)
    expect(slice(line, 1, 1)).toBe('K')
    expect(slice(line, 2, 9)).toBe('99999999')
    expect(slice(line, 10, 11)).toBe('00')
    expect(slice(line, 12, 17)).toBe('261130')
    expect(slice(line, 18, 18)).toBe('0')
    expect(slice(line, 19, 21)).toBe('001')
    expect(slice(line, 22, 22)).toBe('0')
    expect(slice(line, 23, 28)).toBe('261111')
    expect(slice(line, 29, 33)).toBe('99999')
    expect(slice(line, 34, 39)).toBe('000000')
    expect(slice(line, 40, 69)).toBe('LANDLY'.padEnd(30))
    expect(slice(line, 70, 125)).toBe(' '.repeat(56))
    expect(slice(line, 126, 128)).toBe('KOT')
  })
})

describe('Record 1 (detail)', () => {
  const line = buildDetail(mock, pay, '2611')
  it('is 128 characters at the specified columns', () => {
    expect(line).toHaveLength(128)
    expect(slice(line, 1, 1)).toBe('1')
    expect(slice(line, 2, 9)).toBe('99999999')
    expect(slice(line, 10, 11)).toBe('00')
    expect(slice(line, 12, 17)).toBe('000000')
    expect(slice(line, 18, 19)).toBe('12')
    expect(slice(line, 20, 22)).toBe('600')
    expect(slice(line, 23, 26)).toBe('0000')
    expect(slice(line, 27, 35)).toBe('000123456')
    expect(slice(line, 36, 36)).toBe('0')
    expect(slice(line, 37, 45)).toBe('123456782')
    expect(slice(line, 46, 61)).toBe('CAFE EXAMPLE LTD')
    expect(slice(line, 62, 74)).toBe('0000000102345')
    expect(slice(line, 75, 94)).toBe('LANDLY-PAYROLL'.padEnd(20))
    expect(slice(line, 95, 102)).toBe('26110000')
    expect(slice(line, 103, 105)).toBe('000')
    expect(slice(line, 106, 108)).toBe('006')
    expect(slice(line, 109, 126)).toBe('0'.repeat(18))
    expect(slice(line, 127, 128)).toBe('  ')
  })
  it('puts a Bank Leumi (10) account in 8 positions, 28 to 35, with 27 left 0', () => {
    const leumi = buildDetail(mock, { ...pay, bankCode: '10', accountNumber: '4567' }, '2611')
    expect(leumi).toHaveLength(128)
    expect(slice(leumi, 27, 35)).toBe('000004567')
    expect(slice(leumi, 27, 27)).toBe('0')
    expect(formatAccount('10', '12345678')).toBe('012345678')
    expect(() => formatAccount('10', '123456789')).toThrow()
    expect(() => formatAccount('12', '1234567890')).toThrow()
  })
  it('refuses amounts that are not positive whole agorot or do not fit 13 digits', () => {
    expect(() => buildDetail(mock, { ...pay, amountAgorot: 0 }, '2611')).toThrow()
    expect(() => buildDetail(mock, { ...pay, amountAgorot: 10.5 }, '2611')).toThrow()
    expect(() => buildDetail(mock, { ...pay, amountAgorot: 10 ** 13 }, '2611')).toThrow()
  })
})

describe('Record 5 (trailer)', () => {
  const line = buildTrailer(mock, '2026-11-30', 3, 987654321)
  it('is 128 characters at the specified columns', () => {
    expect(line).toHaveLength(128)
    expect(slice(line, 1, 1)).toBe('5')
    expect(slice(line, 2, 9)).toBe('99999999')
    expect(slice(line, 10, 11)).toBe('00')
    expect(slice(line, 12, 17)).toBe('261130')
    expect(slice(line, 18, 18)).toBe('0')
    expect(slice(line, 19, 21)).toBe('001')
    expect(slice(line, 22, 36)).toBe('000000987654321')
    expect(slice(line, 37, 51)).toBe('0'.repeat(15))
    expect(slice(line, 52, 58)).toBe('0000003')
    expect(slice(line, 59, 65)).toBe('0'.repeat(7))
    expect(slice(line, 66, 128)).toBe(' '.repeat(63))
  })
})

describe('whole file', () => {
  const payments = [pay, { ...pay, name: 'Second Shop', amountAgorot: 500, bankCode: '10', accountNumber: '99' }]
  const file = buildMasavFile({ config: mock, valueDate: '2026-11-30', createdAt: '2026-11-11', payments })
  it('is header, one detail per payee, then trailer, each 128 characters with CRLF', () => {
    expect(file.lines).toHaveLength(4)
    expect(file.lines.map((l) => l[0])).toEqual(['K', '1', '1', '5'])
    expect(file.lines.every((l) => l.length === 128)).toBe(true)
    expect(file.text.split('\r\n')).toHaveLength(5)
    expect(file.text.endsWith('\r\n')).toBe(true)
  })
  it('carries the control sum and the detail count in the trailer', () => {
    expect(file.totalAgorot).toBe(102845)
    expect(slice(file.lines[3]!, 22, 36)).toBe('000000000102845')
    expect(slice(file.lines[3]!, 52, 58)).toBe('0000002')
  })
  it('refuses an empty file', () => {
    expect(() => buildMasavFile({ config: mock, valueDate: '2026-11-30', createdAt: '2026-11-11', payments: [] })).toThrow()
  })
})

describe('names and encoding', () => {
  it('strips forbidden punctuation, spaces out other symbols, keeps Hebrew and Latin letters', () => {
    expect(sanitizeMasavName('Cafe (Tel-Aviv) / Ltd_')).toBe('CAFE TELAVIV LTD')
    expect(sanitizeMasavName('Ben & Jerry\'s "Shop"')).toBe('BEN JERRY S SHOP')
    expect(sanitizeMasavName('קפה דוגמה בע"מ')).toBe('קפה דוגמה בע מ')
    expect(sanitizeMasavName('A very long business name indeed')).toHaveLength(16)
  })
  it('writes Hebrew as one byte a letter so every line stays 128 bytes', () => {
    const file = buildMasavFile({ config: mock, valueDate: '2026-11-30', createdAt: '2026-11-11', payments: [{ ...pay, name: 'קפה דוגמה' }] })
    const bytes = encodeWindows1255(file.text)
    expect(bytes.length).toBe(file.text.length)
    expect(file.text.split('\r\n').slice(0, -1).every((l) => encodeWindows1255(l).length === 128)).toBe(true)
    expect(encodeWindows1255('א').equals(Buffer.from([0xe0]))).toBe(true)
    expect(encodeWindows1255('ת').equals(Buffer.from([0xfa]))).toBe(true)
  })
  it('formats dates', () => {
    expect(yymmdd('2026-01-05')).toBe('260105')
    expect(() => yymmdd('5/1/26')).toThrow()
  })
})
