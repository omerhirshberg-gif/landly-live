// Lists what Meta has for the phone-change code's WhatsApp template, to
// explain a 132001 ("Template name does not exist in the translation"):
// which WhatsApp Business Account (WABA) owns WHATSAPP_PHONE_NUMBER_ID,
// whether WHATSAPP_OTP_TEMPLATE exists there, in which languages and with
// which status, and the language each member language would end up sent in
// (the fallback chain in lib/auth/phoneVerification.ts, otpLanguages()).
//
// Read-only: GET requests to the Graph API, nothing is sent or changed. The
// access token is never printed.
//
// The settings come from the environment, so point it at one project's
// variables at a time (production's from `vercel env pull`):
//
//   node --env-file=.env.local scripts/whatsapp-diagnose-templates.mjs                       # landly-dev
//   node --env-file=.env.production.local scripts/whatsapp-diagnose-templates.mjs            # landly-be752
//
// WHATSAPP_BUSINESS_ACCOUNT_ID (or --waba=<id>) names the WABA; without it the
// script looks through the WABAs the token may manage for the one that owns
// the number. Exits 1 when a member language would have no approved copy.

import { flagValue } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
const token = process.env.WHATSAPP_ACCESS_TOKEN
const numberId = process.env.WHATSAPP_PHONE_NUMBER_ID
const templateName = process.env.WHATSAPP_OTP_TEMPLATE || 'landly_otp_code'
const fallback = process.env.WHATSAPP_OTP_FALLBACK_LANGUAGE?.trim()
const configuredVersion = process.env.WHATSAPP_GRAPH_VERSION?.trim()
const version = configuredVersion && /^v\d+\.\d+$/.test(configuredVersion) ? configuredVersion : 'v21.0'

// Keep in step with lib/auth/phoneVerification.ts.
const WHATSAPP_LANGUAGE = { en: 'en_US', he: 'he', ru: 'ru', fr: 'fr', es: 'es' }
const otpLanguages = (lang) => [...new Set([WHATSAPP_LANGUAGE[lang], fallback, 'en_US', 'en'].filter(Boolean))].slice(0, 3)

if (!token || !numberId) {
  console.error('WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set (node --env-file=<file> …).')
  process.exit(1)
}

async function graph(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${version}/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${path.split('?')[0]}: (#${body?.error?.code ?? res.status}) ${body?.error?.message ?? `HTTP ${res.status}`}`)
  return body
}

async function ownsNumber(wabaId) {
  const numbers = await graph(`${wabaId}/phone_numbers`, { fields: 'id,display_phone_number,verified_name', limit: '100' })
  return numbers.data?.find((n) => n.id === numberId) ?? null
}

// A token limited to some WABAs names them in its granular scopes; a system
// user may also have WABAs assigned. A business-wide token has neither, and
// needs WHATSAPP_BUSINESS_ACCOUNT_ID.
async function candidateWabas() {
  const explicit = flagValue(args, '--waba') || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  if (explicit) return [explicit]
  const debug = await graph('debug_token', { input_token: token })
  const scoped = (debug.data?.granular_scopes ?? []).filter((s) => s.scope?.startsWith('whatsapp_business')).flatMap((s) => s.target_ids ?? [])
  const assigned = await graph('me/assigned_whatsapp_business_accounts', { fields: 'id', limit: '100' }).then((r) => r.data?.map((w) => w.id) ?? [], () => [])
  return [...new Set([...scoped, ...assigned])]
}

try {
  const number = await graph(numberId, { fields: 'display_phone_number,verified_name,quality_rating' })
  console.log(`Number ID ${numberId}: ${number.display_phone_number} (${number.verified_name ?? 'no display name'}, quality ${number.quality_rating ?? '?'})`)

  let waba = null
  for (const id of await candidateWabas()) {
    if (await ownsNumber(id).catch(() => null)) {
      waba = id
      break
    }
  }
  const explicit = flagValue(args, '--waba') || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  if (!waba && explicit) {
    console.error(`WABA ${explicit} does not own number ID ${numberId} (or this token cannot read it): the number is in another WhatsApp Business Account.`)
    process.exit(1)
  }
  if (!waba) {
    console.error(
      'Could not tell which WABA owns that number ID from this token. Set WHATSAPP_BUSINESS_ACCOUNT_ID (or pass --waba=<id>): ' +
        'Meta Business Suite → Settings → Accounts → WhatsApp accounts, or the "WhatsApp Business Account ID" in the app\'s WhatsApp → API Setup.'
    )
    process.exit(1)
  }
  console.log(`WABA ${waba} owns the number.`)

  const templates = await graph(`${waba}/message_templates`, { name: templateName, fields: 'name,language,status,category,components', limit: '100' })
  // The name filter matches on substrings; only the exact name counts.
  const copies = (templates.data ?? []).filter((tpl) => tpl.name === templateName)
  console.log(`\nTemplate "${templateName}" (Graph ${version}):`)
  if (!copies.length) console.log('  not found in this WABA: every send fails with 132001 whatever the language.')
  for (const tpl of copies.sort((a, b) => a.language.localeCompare(b.language))) {
    const copyCode = tpl.components?.some((c) => c.type === 'BUTTONS' && c.buttons?.some((b) => b.otp_type === 'COPY_CODE' || b.type === 'OTP' || b.type === 'URL'))
    console.log(`  ${tpl.language.padEnd(6)} ${tpl.status.padEnd(9)} ${tpl.category}${copyCode ? '' : '  (no code button: Meta refuses the button parameter)'}`)
  }

  const approved = new Set(copies.filter((tpl) => tpl.status === 'APPROVED').map((tpl) => tpl.language))
  console.log(`\nWhat each member language is sent in (fallback ${fallback || 'unset'}):`)
  let missing = 0
  for (const lang of Object.keys(WHATSAPP_LANGUAGE)) {
    const chain = otpLanguages(lang)
    const used = chain.find((code) => approved.has(code))
    if (!used) missing++
    console.log(`  ${lang}  tries ${chain.join(' → ').padEnd(22)} ${used ? `sent in ${used}` : 'FAILS (no approved copy in the chain)'}`)
  }
  if (missing) {
    console.error(`\n${missing} member language(s) cannot get a code. Create "${templateName}" in en_US (and ideally he, ru, fr, es) as an Authentication template with a Copy code button, in WABA ${waba}.`)
    process.exit(1)
  }
} catch (err) {
  console.error(err?.message ?? err)
  process.exit(1)
}
