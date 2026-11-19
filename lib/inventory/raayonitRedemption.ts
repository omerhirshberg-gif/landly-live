// How each Raayonit brand's voucher is really redeemed, and the steps that say so in five languages. Hotels are booked in
// advance through Raayonit's call centre, spas and tours by phone, a phone-only takeaway venue by phone, online shops on
// their site; only ordinary shops, restaurants and cafes are "show the code at the till". Pure, shared by the sync and tests.
import type { RedemptionMethod } from '../offers/redemption'
import type { RaayonitBrand } from './raayonitCatalog'

export const REDEMPTION_LANGS = ['he', 'en', 'ru', 'fr', 'es'] as const
export type RedemptionLang = (typeof REDEMPTION_LANGS)[number]
export type RedemptionKind = 'hotel' | 'spa' | 'tour' | 'phone_order' | 'online' | 'cinema' | 'standard'
export type RedemptionPlan = { kind: RedemptionKind; method: RedemptionMethod; instructions: Record<RedemptionLang, string> }

export const RAAYONIT_CALL_CENTRE = '03-9223392'

const TEXT: Record<Exclude<RedemptionKind, 'standard'>, Record<RedemptionLang, string[]>> = {
  hotel: {
    he: ['יש לתאם הזמנה מראש מול מוקד ההזמנות של רעיונית בטלפון 03-9223392 (שלוחה 4) או מול בית המלון, בהתאם לתנאים.', 'יש למסור את קוד התו בעת ההזמנה.', 'בחלק מהמלונות ניתן לממש עד 50% מערך העסקה.'],
    en: ["Book in advance through Raayonit's booking line on 03-9223392 (ext. 4), or with the hotel, as the terms say.", 'Give your voucher code when you book.', 'At some hotels the voucher covers up to 50% of the deal.'],
    ru: ['Забронируйте заранее через линию бронирования Raayonit 03-9223392 (доб. 4) или в отеле, согласно условиям.', 'Назовите код купона при бронировании.', 'В некоторых отелях купоном можно оплатить до 50% стоимости.'],
    fr: ["Réservez à l'avance via la ligne de réservation Raayonit au 03-9223392 (poste 4) ou auprès de l'hôtel, selon les conditions.", 'Communiquez le code de votre bon lors de la réservation.', "Dans certains hôtels, le bon couvre jusqu'à 50 % de la valeur."],
    es: ['Reserva con antelación a través de la línea de reservas de Raayonit 03-9223392 (ext. 4) o con el hotel, según las condiciones.', 'Indica el código de tu cupón al reservar.', 'En algunos hoteles el cupón cubre hasta el 50% del valor.'],
  },
  spa: {
    he: ['יש לתאם תור וטיפול מראש בטלפון הספא המופיע בפרטי הסניף.', 'יש לציין בעת התיאום ובהגעה כי התשלום מתבצע באמצעות קוד תו על דיגיטלי.'],
    en: ["Book your appointment and treatment in advance on the spa's phone number in the branch details.", 'Say when booking and on arrival that you are paying with a digital voucher code.'],
    ru: ['Запишитесь на процедуру заранее по телефону спа, указанному в данных филиала.', 'При записи и по прибытии сообщите, что платите цифровым кодом купона.'],
    fr: ["Réservez votre soin à l'avance au numéro du spa indiqué dans les détails de l'adresse.", 'Précisez lors de la réservation et à votre arrivée que vous payez avec un code de bon numérique.'],
    es: ['Reserva tu cita y tratamiento con antelación en el teléfono del spa que figura en los datos de la sucursal.', 'Indica al reservar y al llegar que pagas con un código de cupón digital.'],
  },
  tour: {
    he: ['יש לתאם את מועד הסיור או הפעילות מראש בטלפון.', 'מציגים את קוד התו הדיגיטלי בהגעה.'],
    en: ['Arrange the date of the tour or activity in advance by phone.', 'Show your digital voucher code when you arrive.'],
    ru: ['Заранее согласуйте дату экскурсии или активности по телефону.', 'По прибытии покажите цифровой код купона.'],
    fr: ["Convenez à l'avance de la date de la visite ou de l'activité par téléphone.", 'Présentez votre code de bon numérique à votre arrivée.'],
    es: ['Acuerda con antelación por teléfono la fecha de la visita o actividad.', 'Muestra tu código de cupón digital al llegar.'],
  },
  phone_order: {
    he: ['התו תקף להזמנות טלפוניות של טייק-אווי ומשלוחים בלבד, ולא לישיבה במקום.', 'מתקשרים לסניף, מציינים שמשלמים בתו ומקריאים את הקוד.'],
    en: ['The voucher is valid for phone takeaway and delivery orders only, not for dining in.', 'Call the branch, say you are paying with a voucher and read out the code.'],
    ru: ['Купон действует только для заказов еды навынос и доставки по телефону, не для заказов в зале.', 'Позвоните в филиал, сообщите, что платите купоном, и назовите код.'],
    fr: ['Le bon est valable uniquement pour les commandes téléphoniques à emporter et en livraison, pas sur place.', "Appelez l'établissement, précisez que vous payez avec un bon et communiquez le code."],
    es: ['El cupón solo es válido para pedidos telefónicos para llevar y a domicilio, no para consumir en el local.', 'Llama a la sucursal, indica que pagas con cupón y di el código.'],
  },
  online: {
    he: ['המימוש מתבצע דרך אתר העסק או מוקד ההזמנות שלו, כמפורט בתנאי התו.', 'בשלב התשלום מציינים תשלום בתו ומוסרים את הקוד הדיגיטלי.'],
    en: ["Redeem through the merchant's website or order line, as the voucher's terms describe.", 'At payment, choose to pay with a voucher and give the digital code.'],
    ru: ['Погашение — через сайт или линию заказов продавца, как описано в условиях купона.', 'При оплате выберите оплату купоном и укажите цифровой код.'],
    fr: ["Utilisez le bon via le site ou la ligne de commande du commerçant, comme décrit dans les conditions.", 'Au paiement, choisissez de payer avec un bon et indiquez le code numérique.'],
    es: ['Canjea el cupón a través del sitio web o la línea de pedidos del comercio, como indican las condiciones.', 'Al pagar, elige pagar con cupón e indica el código digital.'],
  },
  cinema: {
    he: ['ניתן להזמין מקומות מראש באתר סינמה סיטי: בבחירת אמצעי התשלום בוחרים מבצעים/הטבות/שובר ומזינים את הקוד הדיגיטלי ללא המקף, ללא תוספת דמי כרטוס.', 'ניתן לממש גם בקופות הקולנוע. התו אינו תקף לסרטי 4DX, תלת מימד, V.I.P, קבוצות ואירועים מיוחדים.'],
    en: ["Book seats in advance on Cinema City's website: at payment choose offers / benefits / voucher and enter the digital code without the hyphen, with no ticketing fee.", 'You can also redeem at the box office. Not valid for 4DX, 3D, V.I.P, groups or special screenings.'],
    ru: ['Места можно забронировать на сайте Cinema City: при оплате выберите акции / льготы / купон и введите цифровой код без дефиса, без сбора за билет.', 'Также можно погасить в кассе кинотеатра. Не действует для 4DX, 3D, V.I.P, групп и особых показов.'],
    fr: ["Réservez vos places sur le site de Cinema City : au paiement, choisissez offres / avantages / bon et saisissez le code numérique sans le tiret, sans frais de billetterie.", "Vous pouvez aussi l'utiliser à la caisse du cinéma. Non valable pour les séances 4DX, 3D, V.I.P, les groupes et les événements spéciaux."],
    es: ['Reserva asientos en el sitio web de Cinema City: al pagar elige ofertas / beneficios / cupón e introduce el código digital sin el guion, sin cargo por emisión.', 'También puedes canjearlo en taquilla. No válido para 4DX, 3D, V.I.P, grupos ni eventos especiales.'],
  },
}

const STANDARD: Record<RedemptionLang, { base: string; online: string; phone: string }> = {
  he: { base: 'מגיעים לאחד הסניפים המכבדים את התו ומציגים או מקריאים את קוד התו בקופה.', online: 'ניתן לממש גם באתר הרשת: מזינים את קוד התו בשלב התשלום.', phone: 'ניתן לממש גם בהזמנה טלפונית: מציינים שמשלמים בתו ומקריאים את הקוד.' },
  en: { base: 'Visit a participating branch and show or read out your voucher code at the till.', online: "You can also redeem on the brand's website: enter the code at checkout.", phone: 'You can also redeem by phone: say you are paying with a voucher and read out the code.' },
  ru: { base: 'Приходите в любой участвующий филиал и покажите или назовите код купона на кассе.', online: 'Можно также погасить на сайте бренда: введите код при оплате.', phone: 'Можно также погасить по телефону: сообщите, что платите купоном, и назовите код.' },
  fr: { base: 'Rendez-vous dans une enseigne participante et présentez ou communiquez le code de votre bon en caisse.', online: 'Vous pouvez aussi l’utiliser sur le site de la marque : saisissez le code au paiement.', phone: 'Vous pouvez aussi l’utiliser par téléphone : précisez que vous payez avec un bon et communiquez le code.' },
  es: { base: 'Acude a una sucursal participante y muestra o di el código de tu cupón en caja.', online: 'También puedes canjearlo en el sitio web de la marca: introduce el código al pagar.', phone: 'También puedes canjearlo por teléfono: indica que pagas con cupón y di el código.' },
}

const ONLINE_BRANDS = /אולגר|OLGAR|סחלב|BOOL CACTUS|BUYLI|TALADA|לוטונט|ONE PROJECT/i
const PHONE_ORDER_BRANDS = /JAPAN JAPAN|ג'אפן ג'אפן/i
const CINEMA = /סינמה סיטי|CINEMA CITY/i

/** Raayonit lists a web shop as a branch whose address and city are "חנות אינטרנטית" (online store); "תל אביב + חנות אינטרנטית" is a store and a web shop. */
const ONLINE_BRANCH = /חנות\s*אינטרנטית|חנות\s*אונליין|online\s*store/gi
type BranchLike = { address?: string; city?: string }
const branchText = (b: BranchLike) => `${b.address ?? ''} ${b.city ?? ''}`
const branchIsOnline = (b: BranchLike) => new RegExp(ONLINE_BRANCH.source, 'i').test(branchText(b))
const branchIsPhysical = (b: BranchLike) => branchText(b).replace(ONLINE_BRANCH, ' ').replace(/[+,\-\s]/g, '') !== ''
/** A brand whose every listed branch is a web shop: no storefront at all. */
export const isOnlineOnlyBrand = (brand: Pick<RaayonitBrand, 'branches'>) => brand.branches.length > 0 && !brand.branches.some(branchIsPhysical)
const hasOnlineBranch = (brand: Pick<RaayonitBrand, 'branches'>) => brand.branches.some(branchIsOnline)

/** Online only (a web shop, no storefront), online and in store, or in store: stored on the card as `redemptionModes`. */
export function inferRedemptionModes(brand: Pick<RaayonitBrand, 'nameHe' | 'nameEn' | 'restrictions' | 'methods' | 'branches'>, plan: Pick<RedemptionPlan, 'method'>): ('online' | 'in_store')[] {
  if (isOnlineOnlyBrand(brand)) return ['online']
  const online = plan.method === 'online' || hasOnlineBranch(brand) || brand.methods.includes('online') || ONLINE_BRANDS.test(`${brand.nameHe} ${brand.nameEn}`)
  return online ? ['online', 'in_store'] : ['in_store']
}

export function inferRedemption(brand: Pick<RaayonitBrand, 'nameHe' | 'nameEn' | 'category' | 'restrictions' | 'methods'> & Partial<Pick<RaayonitBrand, 'branches'>>): RedemptionPlan {
  const hay = `${brand.nameHe} ${brand.nameEn}`
  const fine = brand.restrictions.join(' ')
  const pick = (kind: Exclude<RedemptionKind, 'standard'>, method: RedemptionMethod): RedemptionPlan => ({ kind, method, instructions: Object.fromEntries(REDEMPTION_LANGS.map((l) => [l, TEXT[kind][l].join('\n')])) as Record<RedemptionLang, string> })
  if (CINEMA.test(hay)) return pick('cinema', 'in_store')
  if (PHONE_ORDER_BRANDS.test(hay) || /טייק-?אווי ומשלוחים טלפונית בלבד/.test(fine)) return pick('phone_order', 'phone_order')
  if (ONLINE_BRANDS.test(hay) || (brand.branches && isOnlineOnlyBrand({ branches: brand.branches })) || /חנות אינטרנטית|רכישת אונליין|ברכישת אונליין/.test(fine)) return pick('online', 'online')
  if (brand.category === 'Israel and Global Tourism') return pick('hotel', 'advance_booking')
  if (brand.category === 'Pampering Bundles' && /ספא|spa\b|טיליה|MILA|BEN AMI|ניגון הנפש|המרחב|ARMANNI|CLARINS|אלוויט|מנטרה|IZEN|Rain Drop|Touch|Flamingo|לאונרדו|Leo/i.test(hay)) return pick('spa', 'phone_booking')
  if (brand.category === 'Attractions and Tours') return pick('tour', 'phone_booking')
  const instructions = Object.fromEntries(
    REDEMPTION_LANGS.map((l) => [l, [STANDARD[l].base, brand.methods.includes('online') ? STANDARD[l].online : '', brand.methods.includes('phone_booking') ? STANDARD[l].phone : ''].filter(Boolean).join('\n')]),
  ) as Record<RedemptionLang, string>
  return { kind: 'standard', method: 'in_store', instructions }
}

/** True when the buyer must act before paying: book through Raayonit, book a time, or order by phone. Drives the callout above Buy. */
export const needsAdvanceNotice = (method: RedemptionMethod): boolean => method === 'advance_booking' || method === 'phone_booking' || method === 'phone_order'

/** Wraps phone numbers and percentages in left-to-right isolates, so "03-9223392" and "50%" keep their order inside a Hebrew line. */
export function isolateNumbers(text: string): string {
  return text.replace(/\d{2,3}-\d{6,7}|\d+(?:\.\d+)?\s?%/g, (m) => `⁦${m}⁩`)
}
