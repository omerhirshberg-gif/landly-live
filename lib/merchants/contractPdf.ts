import 'server-only'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { paymentTermsDays, type PaymentTerms } from './terms'
import { visualRuns } from './pdfText'
import { hebrewBold, hebrewRegular, latinBold, latinRegular } from './fonts/notoSansHebrew'

export type ContractLang = 'en' | 'he'

export interface ContractInput {
  lang: ContractLang
  contractId: string
  businessName: string
  legalName: string
  legalEntityType: string
  taxIdLast4: string
  signatoryName: string
  signatoryRole: string
  commissionRate: number
  paymentTerms: PaymentTerms
  signedAt: Date
  signerIp: string
  userAgent: string
  signaturePng: Uint8Array
  signaturePngSha256: string
}

// The agreement as sent. The wording is a working draft of the commercial
// terms only; Landly's counsel should review it before merchants rely on it.
// `{…}` marks the values filled in per merchant.
const COPY = {
  en: {
    title: 'Merchant Services Agreement',
    sections: [
      ['Parties', 'This agreement is between Landly (the "Platform") and {legalName} (tax ID ending {taxId}), operating as {businessName} (the "Merchant").'],
      ['Services', 'The Platform lists the Merchant\'s offers to its members and issues vouchers for them. The Merchant honours every valid voucher for the goods or services described in the offer.'],
      ['Commission', 'The Platform keeps a commission of {commission} of the price paid for each voucher the Merchant redeems. The rest is paid to the Merchant.'],
      ['Payment terms', 'Redeemed vouchers are paid out by bank transfer to the account the Merchant provided. Payment timing: {terms}.'],
      ['Bank details', 'The Merchant\'s bank details are stored encrypted and used only to pay the Merchant. The Merchant confirms they are accurate and belong to it.'],
      ['Term', 'This agreement starts on signing and continues until either party ends it in writing. Vouchers already sold remain redeemable.'],
    ],
    terms: ['Immediately after redemption', '{n} days after redemption'],
    sign: 'Signed by', capacity: 'Capacity', date: 'Date', trail: 'Signature record', id: 'Contract', ip: 'IP address', ua: 'Device', hash: 'Signature SHA-256',
    entity: { osek_patur: 'Exempt dealer', osek_murshe: 'Licensed dealer', company: 'Company', nonprofit: 'Non-profit' } as Record<string, string>,
  },
  he: {
    title: 'הסכם שירותים לבית עסק',
    sections: [
      ['הצדדים', 'הסכם זה נערך בין Landly (״הפלטפורמה״) לבין {legalName} (מספר מזהה המסתיים ב-{taxId}), הפועל/ת כ-{businessName} (״בית העסק״).'],
      ['השירותים', 'הפלטפורמה מציגה את ההצעות של בית העסק לחברים שלה ומנפיקה עבורן שוברים. בית העסק מכבד כל שובר תקף עבור המוצרים או השירותים המתוארים בהצעה.'],
      ['עמלה', 'הפלטפורמה גובה עמלה בשיעור {commission} ממחיר השובר ששולם, בגין כל שובר שבית העסק מימש. יתרת הסכום משולמת לבית העסק.'],
      ['תנאי תשלום', 'שוברים שמומשו משולמים בהעברה בנקאית לחשבון שבית העסק מסר. מועד התשלום: {terms}.'],
      ['פרטי בנק', 'פרטי הבנק של בית העסק נשמרים בהצפנה ומשמשים אך ורק לתשלום לבית העסק. בית העסק מאשר שהם נכונים ושייכים לו.'],
      ['תקופה', 'הסכם זה תקף מיום החתימה ועד שאחד הצדדים יסיים אותו בכתב. שוברים שכבר נמכרו יישארו ניתנים למימוש.'],
    ],
    terms: ['מיד לאחר המימוש', '{n} ימים לאחר המימוש'],
    sign: 'נחתם על ידי', capacity: 'תפקיד', date: 'תאריך', trail: 'רישום החתימה', id: 'חוזה', ip: 'כתובת IP', ua: 'מכשיר', hash: 'SHA-256 של החתימה',
    entity: { osek_patur: 'עוסק פטור', osek_murshe: 'עוסק מורשה', company: 'חברה', nonprofit: 'עמותה' } as Record<string, string>,
  },
}

const INK = rgb(0.043, 0.106, 0.239)
const MUTED = rgb(0.39, 0.45, 0.55)
const BRAND = rgb(0, 0.22, 0.72)

interface Fonts { heR: PDFFont; laR: PDFFont; heB: PDFFont; laB: PDFFont }

function runWidth(fonts: Fonts, line: string, rtl: boolean, size: number, bold: boolean) {
  return visualRuns(line, rtl).reduce((sum, run) => sum + (run.kind === 'he' ? (bold ? fonts.heB : fonts.heR) : (bold ? fonts.laB : fonts.laR)).widthOfTextAtSize(run.text, size), 0)
}

// Draws one already-wrapped line; right-aligned from `x` for Hebrew, left-aligned for English.
function drawLine(page: PDFPage, fonts: Fonts, line: string, x: number, y: number, size: number, rtl: boolean, bold = false, color = INK) {
  const width = runWidth(fonts, line, rtl, size, bold)
  let cursor = rtl ? x - width : x
  for (const run of visualRuns(line, rtl)) {
    const font = run.kind === 'he' ? (bold ? fonts.heB : fonts.heR) : (bold ? fonts.laB : fonts.laR)
    page.drawText(run.text, { x: cursor, y, size, font, color })
    cursor += font.widthOfTextAtSize(run.text, size)
  }
}

function wrap(fonts: Fonts, text: string, maxWidth: number, size: number, rtl: boolean): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (current && runWidth(fonts, candidate, rtl, size, false) > maxWidth) {
      lines.push(current)
      current = word
    } else current = candidate
  }
  if (current) lines.push(current)
  return lines
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '')

/** A4 signed agreement with the commercial terms, the signature and its audit trail. */
export async function renderContractPdf(input: ContractInput): Promise<Uint8Array> {
  const copy = COPY[input.lang]
  const rtl = input.lang === 'he'
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const embed = (b64: string) => pdf.embedFont(Buffer.from(b64, 'base64'), { subset: true })
  const fonts: Fonts = { heR: await embed(hebrewRegular), laR: await embed(latinRegular), heB: await embed(hebrewBold), laB: await embed(latinBold) }
  pdf.setTitle(`${copy.title} — ${input.businessName}`)
  pdf.setProducer('Landly')
  pdf.setCreationDate(input.signedAt)

  const W = 595.28, H = 841.89, M = 56
  const page = pdf.addPage([W, H])
  const edge = rtl ? W - M : M
  const maxWidth = W - 2 * M
  let y = H - M

  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: BRAND })
  drawLine(page, fonts, 'LANDLY', edge, y - 8, 11, rtl, true, BRAND)
  y -= 40
  drawLine(page, fonts, copy.title, edge, y, 22, rtl, true)
  y -= 14
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.85, 0.88, 0.92) })
  y -= 28

  const values = {
    legalName: input.legalName, taxId: input.taxIdLast4, businessName: input.businessName,
    commission: `${Number((input.commissionRate * 100).toFixed(2))}%`,
    terms: paymentTermsDays(input.paymentTerms) === 0 ? copy.terms[0]! : fill(copy.terms[1]!, { n: String(paymentTermsDays(input.paymentTerms)) }),
  }
  copy.sections.forEach(([heading, body], index) => {
    drawLine(page, fonts, `${index + 1}. ${heading}`, edge, y, 12, rtl, true)
    y -= 18
    for (const line of wrap(fonts, fill(body!, values), maxWidth, 10.5, rtl)) {
      drawLine(page, fonts, line, edge, y, 10.5, rtl)
      y -= 15.5
    }
    y -= 10
  })

  y -= 6
  const sigW = 150, sigH = 60
  const image = await pdf.embedPng(input.signaturePng)
  const scale = Math.min(sigW / image.width, sigH / image.height)
  page.drawImage(image, { x: rtl ? W - M - image.width * scale : M, y: y - sigH, width: image.width * scale, height: image.height * scale })
  y -= sigH + 6
  page.drawLine({ start: { x: M, y }, end: { x: M + 200, y }, thickness: 0.6, color: MUTED })
  y -= 16
  const date = input.signedAt.toISOString().slice(0, 10)
  for (const line of [`${copy.sign}: ${input.signatoryName}`, `${copy.capacity}: ${input.signatoryRole} · ${copy.entity[input.legalEntityType] ?? ''}`, `${copy.date}: ${date}`]) {
    drawLine(page, fonts, line, edge, y, 10.5, rtl)
    y -= 15
  }

  // The record of who signed, from where and what they signed.
  let ty = M + 58
  drawLine(page, fonts, copy.trail, edge, ty, 8, rtl, true, MUTED)
  for (const line of [
    `${copy.id}: ${input.contractId}`, `${copy.ip}: ${input.signerIp}`, `${copy.ua}: ${input.userAgent.slice(0, 90)}`, `${copy.hash}: ${input.signaturePngSha256}`,
  ]) {
    ty -= 11
    drawLine(page, fonts, line, edge, ty, 7, rtl, false, MUTED)
  }
  return pdf.save()
}
