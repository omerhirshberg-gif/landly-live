import type { TranslationKey } from './translations'

// While Raayonit has not approved (in writing) showing its name, every string that names Raayonit or its product ("Super Tav")
// is read from its neutral twin instead. One table, applied in the language provider of the website and of the app, so no screen,
// email or pass can forget to. When the display flag is on, the original keys are used and Raayonit's attribution shows.
export const NEUTRAL_ALIASES: Partial<Record<TranslationKey, TranslationKey>> = {
  row_super_tav: 'multi_chain_vouchers_title',
  super_showcase_title: 'multi_chain_vouchers_title',
  super_card_title: 'multi_chain_voucher_label',
  super_tav_headline: 'multi_chain_headline',
  loc_empty_sub: 'loc_empty_sub_neutral',
  wallet_pass_issuer_name: 'multi_chain_voucher_label',
  voucher_issued_by: 'multi_chain_voucher_label',
  voucher_multi_chain_credit: 'multi_chain_credit_neutral',
  wallet_pass_multi_chain: 'wallet_pass_multi_chain_neutral',
  brand_lockup_label: 'brand_lockup_label_neutral',
  flagship_eyebrow: 'flagship_eyebrow_neutral',
  redeem_method_advance_booking: 'redeem_method_advance_booking_neutral',
  redeem_step_advance_call: 'redeem_step_advance_call_neutral',
}

/** The key to read: its neutral twin while Raayonit display is off. */
export const keyFor = (key: TranslationKey, raayonitDisplay: boolean): TranslationKey => (raayonitDisplay ? key : NEUTRAL_ALIASES[key] ?? key)
