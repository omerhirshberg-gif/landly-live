import 'server-only'
import { RTL_LANGS, translations, type Lang } from '@/lib/i18n/translations'
import { priceDifference } from '@/lib/format'
import { orderReference } from '@/lib/payments/orderNumber'
import { escapeHtml, FONT_STACK, sendBrandedEmail, type BrandedEmailContent } from './brandedEmail'

export interface OrderConfirmationDetails {
  orderId: string
  /** The sequential number ("#1001"); null for an order settled before numbering, which shows its id. */
  displayOrderNumber: string | null
  paidAt: Date
  businessName: string
  offerTitle: string
  /** A direct https image link, or '' to leave the thumbnail out. */
  imageUrl: string
  amount: number
  /** The pre-discount price frozen on the order, or null when there's none. */
  originalPrice: number | null
  voucherLink: string
}

// Whole shekels without decimals ("₪80"), anything else with two ("₪79.90").
function formatEmailPrice(amount: number, lang: Lang): string {
  const digits = Number.isInteger(amount) ? 0 : 2
  return new Intl.NumberFormat(lang, {
    style: 'currency', currency: 'ILS', currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(amount)
}

// Settlement time as Israelis see it, whatever the server's timezone.
function formatPaidAt(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(date)
}

// The summary box (order, date, status) and the perk card, as rows for the
// shared shell's detailsHtml slot: tables and inline styles in the shell's
// palette, mirrored for RTL, every value escaped.
function buildDetailsHtml(lang: Lang, order: OrderConfirmationDetails): string {
  const t = translations[lang]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  const dir = isRtl ? 'rtl' : 'ltr'
  const start = isRtl ? 'right' : 'left'
  const end = isRtl ? 'left' : 'right'
  const text = `font-family:${FONT_STACK};font-size:13px;line-height:20px;`

  const summaryRow = (label: string, value: string, first = false) => `
                <tr>
                  <td valign="top" style="${text}padding:10px 0;color:#64748B;text-align:${start};${first ? '' : 'border-top:1px solid #E2E8F0;'}">${escapeHtml(label)}</td>
                  <td valign="top" style="${text}padding:10px 0;color:#0F172A;font-weight:600;text-align:${end};${first ? '' : 'border-top:1px solid #E2E8F0;'}">${value}</td>
                </tr>`

  const summary = `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}">
                <tr>
                  <td bgcolor="#F8FAFC" style="padding:4px 18px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}">${summaryRow(
                      t.orderEmail_orderLabel,
                      `<span dir="ltr" style="font-family:Menlo,Consolas,monospace;word-break:break-all;">${escapeHtml(orderReference(order.displayOrderNumber, order.orderId))}</span>`,
                      true,
                    )}${summaryRow(t.orderEmail_dateLabel, escapeHtml(formatPaidAt(order.paidAt, lang)))}${summaryRow(t.orderEmail_statusLabel, `<span style="color:#15803D;">${escapeHtml(t.orderEmail_statusPaid)}</span>`)}
                    </table>
                  </td>
                </tr>
              </table>`

  const savings = order.originalPrice !== null && order.originalPrice > order.amount
    ? priceDifference(order.originalPrice, order.amount)
    : 0
  const thumbnail = order.imageUrl
    ? `
                        <td width="88" valign="top" style="width:88px;padding-${end}:16px;">
                          <img src="${escapeHtml(order.imageUrl)}" alt="${escapeHtml(order.businessName)}" width="88" height="88" style="display:block;width:88px;height:88px;object-fit:cover;border:0;border-radius:10px;outline:none;text-decoration:none;background-color:#F1F5F9;">
                        </td>`
    : ''
  const originalLine = savings > 0
    ? `
                          <p style="${text}margin:0;color:#64748B;">${escapeHtml(t.orderEmail_originalPrice)}: <span style="text-decoration:line-through;color:#94A3B8;">${escapeHtml(formatEmailPrice(order.originalPrice!, lang))}</span></p>
                          <p style="margin:10px 0 0 0;"><span style="display:inline-block;background-color:#DCFCE7;color:#15803D;font-family:${FONT_STACK};font-size:13px;line-height:18px;font-weight:700;padding:4px 12px;border-radius:999px;">${escapeHtml(t.orderEmail_savings.replace('{amount}', formatEmailPrice(savings, lang)))}</span></p>`
    : ''

  const perk = `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="margin-top:16px;">
                <tr>
                  <td bgcolor="#FFFFFF" style="padding:16px;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}">
                      <tr>${thumbnail}
                        <td valign="top" style="text-align:${start};">
                          <p style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#64748B;">${escapeHtml(order.businessName)}</p>
                          <p style="margin:0 0 10px 0;font-family:${FONT_STACK};font-size:16px;line-height:22px;font-weight:700;color:#0F172A;">${escapeHtml(order.offerTitle)}</p>
                          <p style="${text}margin:0;color:#475569;">${escapeHtml(t.orderEmail_pricePaid)}: <strong style="font-size:16px;color:#0F172A;">${escapeHtml(formatEmailPrice(order.amount, lang))}</strong></p>${originalLine}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`

  return summary + perk
}

/** The order confirmation's subject and shell content, built without sending. */
export function buildOrderConfirmationEmail(lang: Lang, order: OrderConfirmationDetails): { subject: string } & BrandedEmailContent {
  const t = translations[lang]
  return {
    subject: t.orderEmail_subject,
    heading: t.orderEmail_heading,
    body: t.orderEmail_body,
    buttonLabel: t.orderEmail_button,
    buttonLink: order.voucherLink,
    footnote: t.orderEmail_footnote,
    detailsHtml: buildDetailsHtml(lang, order),
  }
}

export async function sendOrderConfirmationEmail(params: {
  to: string
  lang: Lang
  origin: string
  order: OrderConfirmationDetails
}): Promise<void> {
  const { to, lang, origin, order } = params
  await sendBrandedEmail({ to, lang, origin, ...buildOrderConfirmationEmail(lang, order) })
}
