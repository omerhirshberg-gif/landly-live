// A Raayonit voucher bought through one brand is still a Multi-Chain Super Tav: honoured at that brand and at every
// participating chain. These helpers decide when to say so and how big the network is. Pure; shared by web, Expo,
// the order email and the Wallet pass.

export interface MultiChainSubject {
  fulfillmentType?: string | null
  redemptionKind?: string | null
  perkScope?: string | null
}

/** True for a Raayonit pool voucher or offer (a code honoured across the network), or an already multi-chain pass. */
export function isRaayonitMultiChain(x: MultiChainSubject | null | undefined): boolean {
  if (!x) return false
  return x.fulfillmentType === 'raayonit_pool' || x.redemptionKind === 'code_only' || x.perkScope === 'multi_chain'
}

/** The network size rounded down to tens with a plus ("246" -> "240+"); '' while it is unknown or tiny. */
export function chainCountLabel(count: number | null | undefined): string {
  const n = Math.floor((Number(count) || 0) / 10) * 10
  return n >= 10 ? `${n}+` : ''
}

/** Fills `{count}` with the label, isolated left to right so "230+" never flips in Hebrew. */
export function withChainCount(template: string, count: number | null | undefined): string {
  const label = chainCountLabel(count)
  if (!label) return template.replace(/\s*\{count\}\s*/g, ' ').replace(/\s+/g, ' ').trim()
  return template.replace('{count}', `⁦${label}⁩`)
}
