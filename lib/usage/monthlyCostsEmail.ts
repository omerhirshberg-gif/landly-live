import { escapeHtmlText } from './htmlText'
import { formatCount, formatIls, formatIlsRate, SKUS, vatIls, VAT_RATE, withVatIls, type Money } from './pricing'
import { reportLines, type FixedLine, type Outlay, type UsageLine, type UsageReport } from './usageReport'

// The monthly "Usage & Costs" email for accounting: an HTML summary (English
// or Hebrew), a plain-text twin and a UTF-8 BOM CSV. Pure (no I/O), so the
// arithmetic, the escaping and the layout are unit-tested. Figures are
// estimates from our own counters at the live USD/ILS rate in `report.fx`;
// VAT is a flat 18% on every metered line.

export type ReportLang = 'en' | 'he'

export interface MonthlyCostsEmail {
  subject: string
  html: string
  text: string
  csv: string
  csvFilename: string
}

export interface CostRow {
  vendor: string
  service: string
  unit: UsageLine['unit']
  used: number
  freeAllowance: number | null
  billable: number
  /** Price of one unit in the currency it is billed in; null when the service is free. */
  unitPrice: Money | null
  netIls: number
  vatIls: number
  grossIls: number
}

export interface CostTotals {
  netIls: number
  vatIls: number
  grossIls: number
}

const COPY = {
  en: {
    dir: 'ltr',
    title: 'Usage & Costs report',
    subject: 'GoLandly usage & costs {month}',
    month: 'Billing month',
    net: 'Total net',
    vat: 'VAT 18%',
    gross: 'Grand total',
    rate: 'USD/ILS rate',
    asOf: 'as of',
    service: 'Service',
    unit: 'Unit',
    used: 'Used',
    billable: 'Billable',
    unitRate: 'Unit rate',
    netCol: 'Net',
    vatCol: 'VAT 18%',
    grossCol: 'Total',
    free: 'Free',
    units: { characters: 'characters', requests: 'requests', messages: 'messages' },
    vendorNote: 'Firebase',
    vendorNoteBody: 'free tier, not metered here',
    fixedTitle: 'Fixed subscriptions and platform tiers',
    meteredTitle: 'Metered APIs',
    summaryTitle: 'Monthly outlay',
    summaryMetered: 'Metered APIs',
    summaryFixed: 'Fixed subscriptions',
    summaryTotal: 'Total monthly outlay',
    planFee: 'Plan fee only, overages not metered here',
    perMonth: 'per month',
    inactive: 'Inactive',
    freeTier: 'Free tier',
    freeTierOver: 'Over the free tier, billed in the metered APIs above',
    emailsUsed: '{used} / {free} emails',
    notConfigured: 'Not configured yet, infrastructure ready',
    tranzilaActive: 'Connected',
    tranzilaUnavailable: 'Orders could not be read, fee shown as zero',
    transactionsUsed: '{n} payments, volume {volume}',
    stale: 'The live rate source was unavailable; the last stored rate is used.',
    fallback: 'No live rate was available; the built-in default rate is used.',
    footer: 'An estimate from GoLandly\'s own server counters (UTC month, project {project}), not a vendor invoice. VAT is 18% on every line. The attached CSV opens directly in Excel.',
    csvHint: 'Attachment',
  },
  he: {
    dir: 'rtl',
    title: 'דוח שימוש ועלויות',
    subject: 'GoLandly שימוש ועלויות {month}',
    month: 'חודש חיוב',
    net: 'סה״כ נטו',
    vat: 'מע״מ 18%',
    gross: 'סה״כ לתשלום',
    rate: 'שער דולר-שקל',
    asOf: 'נכון ל',
    service: 'שירות',
    unit: 'יחידה',
    used: 'שימוש',
    billable: 'לחיוב',
    unitRate: 'מחיר ליחידה',
    netCol: 'נטו',
    vatCol: 'מע״מ 18%',
    grossCol: 'סה״כ',
    free: 'חינם',
    units: { characters: 'תווים', requests: 'בקשות', messages: 'הודעות' },
    vendorNote: 'Firebase',
    vendorNoteBody: 'חבילה חינמית, לא נמדד כאן',
    fixedTitle: 'מנויים קבועים ושכבות פלטפורמה',
    meteredTitle: 'שירותי API לפי שימוש',
    summaryTitle: 'סיכום עלות חודשית',
    summaryMetered: 'שירותי API לפי שימוש',
    summaryFixed: 'מנויים קבועים',
    summaryTotal: 'סה״כ עלות חודשית',
    planFee: 'דמי מנוי בלבד, חריגות לא נמדדות כאן',
    perMonth: 'לחודש',
    inactive: 'לא פעיל',
    freeTier: 'חבילה חינמית',
    freeTierOver: 'מעבר לחבילה החינמית, מחויב בשירותי ה-API למעלה',
    emailsUsed: '{used} / {free} מיילים',
    notConfigured: 'עוד לא הוגדר, התשתית מוכנה',
    tranzilaActive: 'מחובר',
    tranzilaUnavailable: 'לא ניתן היה לקרוא הזמנות, העמלה מוצגת כאפס',
    transactionsUsed: '{n} תשלומים, היקף {volume}',
    stale: 'מקור השער החי לא היה זמין; נעשה שימוש בשער האחרון ששמור.',
    fallback: 'לא היה שער חי זמין; נעשה שימוש בשער ברירת המחדל.',
    footer: 'הערכה לפי מוני השרת של GoLandly (חודש UTC, פרויקט {project}), לא חשבונית ספק. מע״מ 18% על כל שורה. קובץ ה-CSV המצורף נפתח ישירות באקסל.',
    csvHint: 'קובץ מצורף',
  },
} as const

const vendorLabel = (report: UsageReport, vendor: UsageLine['vendor']) => report.groups.find((group) => group.vendor === vendor)?.label ?? vendor

export function costRows(report: UsageReport): CostRow[] {
  return reportLines(report).map((line) => {
    const sku = SKUS.find((candidate) => candidate.id === line.skuId)
    return {
      vendor: vendorLabel(report, line.vendor),
      service: line.service,
      unit: line.unit,
      used: line.used,
      freeAllowance: line.freeAllowance,
      billable: line.billable,
      unitPrice: sku?.tiers[0]?.unitPrice ?? null,
      netIls: line.netIls,
      vatIls: vatIls(line.netIls),
      grossIls: withVatIls(line.netIls),
    }
  })
}

export function costTotals(rows: readonly CostRow[]): CostTotals {
  const netIls = rows.reduce((total, row) => total + row.netIls, 0)
  return { netIls, vatIls: netIls * VAT_RATE, grossIls: netIls * (1 + VAT_RATE) }
}

/** '$0.00002' for dollars (trailing zeros trimmed, up to 6 decimals), '₪0.075' for shekels. */
export function formatUnitPrice(price: Money): string {
  if (price.currency === 'ILS') return formatIlsRate(price.amount)
  const [whole, fraction] = price.amount.toFixed(6).split('.')
  return `$${whole}.${fraction.replace(/0+$/, '').padEnd(2, '0')}`
}

const rateText = (rate: number) => String(Number(rate.toFixed(4)))
const dateText = (iso: string | null) => (iso ? iso.slice(0, 10) : '-')

// ---- Fixed rows ----

export interface FixedRow {
  kind: FixedLine['kind']
  id: string
  vendor: string
  service: string
  unit: 'month' | 'emails' | 'payments'
  used: number | null
  freeAllowance: number | null
  /** The monthly plan price (subscriptions only). */
  price: Money | null
  status: FixedLine['status']
  unavailable: boolean
  volumeIls: number | null
  netIls: number
  vatIls: number
  grossIls: number
}

const FIXED_VENDOR: Record<string, string> = { vercelPro: 'Vercel', resend: 'Resend Email', tranzila: 'Tranzila' }

export function fixedRows(report: UsageReport): FixedRow[] {
  return report.fixed.lines.map((line) => ({
    kind: line.kind,
    id: line.id,
    vendor: FIXED_VENDOR[line.id] ?? line.label,
    service: line.label,
    unit: line.kind === 'subscription' ? 'month' : line.kind === 'resend' ? 'emails' : 'payments',
    used: line.kind === 'resend' ? line.used : line.kind === 'tranzila' ? line.transactions : null,
    freeAllowance: line.freeAllowance,
    price: line.price,
    status: line.status,
    unavailable: line.unavailable,
    volumeIls: line.volumeIls,
    netIls: line.netIls,
    vatIls: vatIls(line.netIls),
    grossIls: withVatIls(line.netIls),
  }))
}

// ---- CSV ----

/** A leading = + - @ tab or CR would make Excel run the cell as a formula. */
function csvCell(value: string | number): string {
  let text = typeof value === 'number' ? String(value) : value
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const money = (value: number) => value.toFixed(2)

const CSV_STATUS: Record<FixedLine['status'], string> = {
  billed: 'billed',
  inactive: 'inactive',
  free: 'free tier',
  over: 'over free tier (billed in metered)',
  notConfigured: 'not configured',
  active: 'active',
}

export function buildCostsCsv(report: UsageReport): string {
  const rows = costRows(report)
  const fixed = fixedRows(report)
  const rate = report.fx.usdToIls
  const header = ['Month', 'Kind', 'Vendor', 'Service', 'Unit', 'Used', 'Free allowance', 'Billable units', 'Unit rate', 'Rate currency', 'USD/ILS rate', 'Net ILS', 'VAT 18% ILS', 'Gross ILS', 'Status']
  const lines: (string | number)[][] = rows.map((row) => [
    report.month,
    'metered',
    row.vendor,
    row.service,
    row.unit,
    row.used,
    row.freeAllowance ?? '',
    row.billable,
    row.unitPrice ? String(row.unitPrice.amount) : '',
    row.unitPrice?.currency ?? '',
    row.unitPrice?.currency === 'USD' ? rateText(rate) : '',
    money(row.netIls),
    money(row.vatIls),
    money(row.grossIls),
    row.freeAllowance === null && !row.unitPrice ? 'free' : row.billable > 0 ? 'billed' : 'free tier',
  ])
  for (const row of fixed) {
    lines.push([
      report.month,
      'fixed',
      row.vendor,
      row.service,
      row.unit,
      row.used ?? '',
      row.freeAllowance ?? '',
      '',
      row.price ? String(row.price.amount) : '',
      row.price?.currency ?? '',
      row.price?.currency === 'USD' ? rateText(rate) : '',
      money(row.netIls),
      money(row.vatIls),
      money(row.grossIls),
      CSV_STATUS[row.status],
    ])
  }
  const total = (label: string, o: Outlay) => [report.month, 'total', '', label, '', '', '', '', '', '', rateText(rate), money(o.netIls), money(o.vatIls), money(o.grossIls), '']
  lines.push(total('SUBTOTAL METERED', report.outlay.metered), total('SUBTOTAL FIXED', report.outlay.fixed), total('TOTAL', report.outlay.total))
  // UTF-8 BOM so Excel reads Hebrew and the shekel sign; CRLF per RFC 4180.
  return `\uFEFF${[header, ...lines].map((line) => line.map(csvCell).join(',')).join('\r\n')}\r\n`
}

// ---- HTML ----

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const esc = escapeHtmlText
/** Numbers, rates and dates stay left-to-right inside Hebrew text. */
const ltr = (value: string) => `<bdi dir="ltr" style="unicode-bidi:isolate;font-variant-numeric:tabular-nums;">${esc(value)}</bdi>`
/** The template's own words escaped, each number isolated left-to-right on its own so Hebrew words around it keep their order. */
const fillHtml = (template: string, vars: Record<string, string>) => esc(template).replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? ltr(vars[key]) : whole))

export function buildMonthlyCostsEmail(report: UsageReport, lang: ReportLang = 'en'): MonthlyCostsEmail {
  const c = COPY[lang]
  const rows = costRows(report)
  const fixed = fixedRows(report)
  const totals = report.outlay.total
  const rate = report.fx.usdToIls
  const start = lang === 'he' ? 'right' : 'left'
  const end = lang === 'he' ? 'left' : 'right'
  const subject = c.subject.replace('{month}', report.month)
  const csvFilename = `golandly-costs-${report.month}.csv`

  const th = (label: string, align: string) => `<th align="${align}" style="padding:8px 10px;font-size:11px;line-height:16px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #E2E8F0;text-align:${align};white-space:nowrap;">${esc(label)}</th>`
  const td = (html: string, align: string, extra = '') => `<td align="${align}" style="padding:9px 10px;font-size:13px;line-height:18px;color:#0F172A;border-bottom:1px solid #F1F5F9;text-align:${align};${extra}">${html}</td>`
  const money3 = (o: Outlay, extra = '') => `${td(ltr(formatIls(o.netIls)), end, `white-space:nowrap;${extra}`)}${td(ltr(formatIls(o.vatIls)), end, `white-space:nowrap;${extra}`)}${td(ltr(formatIls(o.grossIls)), end, `white-space:nowrap;font-weight:700;${extra}`)}`
  const wrap = (inner: string) => `<tr><td style="padding:8px 14px 8px 14px;"><div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">${inner}</div></td></tr>`
  const title = (label: string) => `<tr><td style="padding:12px 24px 0 24px;text-align:${start};font-size:14px;line-height:20px;font-weight:800;color:#0F172A;">${esc(label)}</td></tr>`

  const body = rows.map((row) => {
    const rateCell = row.unitPrice ? `${ltr(formatUnitPrice(row.unitPrice))}${row.unitPrice.currency === 'USD' ? ` <span style="color:#94A3B8;">@ ${ltr(rateText(rate))}</span>` : ''}` : `<span style="color:#64748B;">${esc(c.free)}</span>`
    return `<tr>
${td(`<div style="font-weight:600;"><bdi dir="ltr" style="unicode-bidi:isolate;">${esc(row.service)}</bdi></div><div style="font-size:11px;color:#94A3B8;">${esc(row.vendor)} · ${esc(c.units[row.unit])}</div>`, start)}
${td(ltr(formatCount(row.used)), end)}
${td(ltr(formatCount(row.billable)), end)}
${td(rateCell, end, 'white-space:nowrap;')}
${money3({ netIls: row.netIls, vatIls: row.vatIls, grossIls: row.grossIls })}
</tr>`
  }).join('\n')

  const fixedDetail = (row: FixedRow): { detail: string; rate: string } => {
    if (row.kind === 'subscription') {
      const price = row.price ? `${ltr(formatUnitPrice(row.price))} ${esc(c.perMonth)}${row.price.currency === 'USD' ? ` <span style="color:#94A3B8;">@ ${ltr(rateText(rate))}</span>` : ''}` : ''
      return { detail: row.status === 'inactive' ? esc(c.inactive) : esc(c.planFee), rate: price }
    }
    if (row.kind === 'resend') {
      return { detail: esc(row.status === 'over' ? c.freeTierOver : c.freeTier), rate: fillHtml(c.emailsUsed, { used: formatCount(row.used ?? 0), free: formatCount(row.freeAllowance ?? 0) }) }
    }
    if (row.status === 'notConfigured') return { detail: esc(c.notConfigured), rate: '-' }
    return { detail: esc(row.unavailable ? c.tranzilaUnavailable : c.tranzilaActive), rate: fillHtml(c.transactionsUsed, { n: formatCount(row.used ?? 0), volume: formatIls(row.volumeIls ?? 0) }) }
  }
  const fixedBody = fixed.map((row) => {
    const { detail, rate: rateCell } = fixedDetail(row)
    return `<tr>
${td(`<div style="font-weight:600;"><bdi dir="ltr" style="unicode-bidi:isolate;">${esc(row.service)}</bdi></div><div style="font-size:11px;color:#94A3B8;">${detail}</div>`, start)}
${td(rateCell, end, 'white-space:nowrap;')}
${money3({ netIls: row.netIls, vatIls: row.vatIls, grossIls: row.grossIls })}
</tr>`
  }).join('\n')

  const summaryRow = (label: string, o: Outlay, strong = false) => `<tr>${td(strong ? `<strong>${esc(label)}</strong>` : esc(label), start, strong ? 'background:#F8FAFC;border-bottom:0;' : '')}${money3(o, strong ? 'background:#F8FAFC;border-bottom:0;' : '')}</tr>`

  const kpi = (label: string, value: string) => `<td valign="top" style="padding:12px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;">
<div style="font-size:11px;line-height:16px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.04em;">${esc(label)}</div>
<div style="margin-top:4px;font-size:20px;line-height:26px;font-weight:800;color:#0F172A;">${value}</div></td>`

  const warning = report.fx.source === 'default' ? c.fallback : report.fx.stale ? c.stale : ''
  const table = (head: string, inner: string, minWidth: number) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;min-width:${minWidth}px;" dir="${c.dir}"><thead><tr>${head}</tr></thead><tbody>${inner}</tbody></table>`

  const meteredTable = table(
    `${th(c.service, start)}${th(c.used, end)}${th(c.billable, end)}${th(c.unitRate, end)}${th(c.netCol, end)}${th(c.vatCol, end)}${th(c.grossCol, end)}`,
    `${body}\n<tr>${td(`<div style="font-weight:600;">${esc(c.vendorNote)}</div><div style="font-size:11px;color:#94A3B8;">${esc(c.vendorNoteBody)}</div>`, start)}${td('-', end)}${td('-', end)}${td('-', end)}${money3(outlayZero)}</tr>`,
    560
  )
  const fixedTable = table(`${th(c.service, start)}${th(c.unitRate, end)}${th(c.netCol, end)}${th(c.vatCol, end)}${th(c.grossCol, end)}`, fixedBody, 480)
  const summaryTable = table(`${th(c.summaryTitle, start)}${th(c.netCol, end)}${th(c.vatCol, end)}${th(c.grossCol, end)}`, `${summaryRow(c.summaryMetered, report.outlay.metered)}${summaryRow(c.summaryFixed, report.outlay.fixed)}${summaryRow(c.summaryTotal, report.outlay.total, true)}`, 420)

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${c.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:16px 8px;background:#F8FAFC;font-family:${FONT};color:#0F172A;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:720px;table-layout:fixed;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;" dir="${c.dir}">
<tr><td style="padding:24px 24px 8px 24px;text-align:${start};">
<div style="font-size:13px;font-weight:800;color:#2563EB;letter-spacing:.02em;">GoLandly</div>
<h1 style="margin:4px 0 0 0;font-size:22px;line-height:28px;font-weight:800;color:#0F172A;">${esc(c.title)} ${ltr(report.month)}</h1>
</td></tr>
<tr><td style="padding:12px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:8px;margin:-8px;">
<tr>${kpi(c.month, ltr(report.month))}${kpi(c.net, ltr(formatIls(totals.netIls)))}</tr>
<tr>${kpi(c.vat, ltr(formatIls(totals.vatIls)))}${kpi(c.gross, ltr(formatIls(totals.grossIls)))}</tr>
<tr><td colspan="2" style="padding:12px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;font-size:13px;line-height:20px;text-align:${start};"><strong>${esc(c.rate)}</strong> ${ltr(`1 USD = ${rateText(rate)} ILS`)} · ${esc(c.asOf)} ${ltr(dateText(report.fx.updatedAt))}${warning ? `<div style="color:#B45309;">${esc(warning)}</div>` : ''}</td></tr>
</table></td></tr>
${wrap(summaryTable)}
${title(c.meteredTitle)}
${wrap(meteredTable)}
${title(c.fixedTitle)}
${wrap(fixedTable)}
<tr><td style="padding:12px 24px 24px 24px;font-size:12px;line-height:18px;color:#64748B;text-align:${start};">
<p style="margin:0 0 8px 0;">${esc(c.footer.replace('{project}', report.projectId))}</p>
<p style="margin:0;">${esc(c.csvHint)}: ${ltr(csvFilename)}</p>
</td></tr></table>
</body></html>`

  const o = report.outlay
  const text = [
    `${c.title} ${report.month}`,
    `${c.net}: ${formatIls(totals.netIls)}`,
    `${c.vat}: ${formatIls(totals.vatIls)}`,
    `${c.gross}: ${formatIls(totals.grossIls)}`,
    `${c.rate}: 1 USD = ${rateText(rate)} ILS (${dateText(report.fx.updatedAt)})`,
    '',
    c.meteredTitle,
    ...rows.map((row) => `${row.service}: ${formatCount(row.used)} ${c.units[row.unit]}, ${formatCount(row.billable)} ${c.billable} -> ${formatIls(row.netIls)} + ${formatIls(row.vatIls)} = ${formatIls(row.grossIls)}`),
    `${c.vendorNote}: ${c.vendorNoteBody}`,
    '',
    c.fixedTitle,
    ...fixed.map((row) => `${row.service}: ${formatIls(row.netIls)} + ${formatIls(row.vatIls)} = ${formatIls(row.grossIls)} (${CSV_STATUS[row.status]})`),
    '',
    `${c.summaryMetered}: ${formatIls(o.metered.netIls)} / ${formatIls(o.metered.vatIls)} / ${formatIls(o.metered.grossIls)}`,
    `${c.summaryFixed}: ${formatIls(o.fixed.netIls)} / ${formatIls(o.fixed.vatIls)} / ${formatIls(o.fixed.grossIls)}`,
    `${c.summaryTotal}: ${formatIls(o.total.netIls)} / ${formatIls(o.total.vatIls)} / ${formatIls(o.total.grossIls)}`,
    '',
    c.footer.replace('{project}', report.projectId),
  ].join('\n')

  return { subject, html, text, csv: buildCostsCsv(report), csvFilename }
}

const outlayZero: Outlay = { netIls: 0, vatIls: 0, grossIls: 0 }
