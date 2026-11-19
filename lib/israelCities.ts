// Israeli cities with a position and a region, for the Near me radius and the "Choose area" picker (region, then city).
// Positions are city centres, good to a couple of kilometres: enough for a 5 / 15 / 25 km radius, not for street routing.
// Names per language come from the place-name dictionary (lib/inventory/raayonitPlaceNames.ts). Pure; shared with the Expo app.
import type { Lang } from './i18n/translations'
import { cityName } from './inventory/raayonitPlaceNames'

export type RegionId = 'tlv' | 'sharon' | 'jer' | 'north' | 'south' | 'eilat'
export interface Region { id: RegionId; names: Record<Lang, string> }

export const ISRAEL_REGIONS: readonly Region[] = [
  { id: 'tlv', names: { he: 'תל אביב וגוש דן', en: 'Tel Aviv & Gush Dan', ru: 'Тель-Авив и Гуш-Дан', fr: 'Tel Aviv et Gush Dan', es: 'Tel Aviv y Gush Dan' } },
  { id: 'sharon', names: { he: 'השרון', en: 'The Sharon', ru: 'Шарон', fr: 'Le Sharon', es: 'El Sharón' } },
  { id: 'jer', names: { he: 'ירושלים והסביבה', en: 'Jerusalem & surroundings', ru: 'Иерусалим и окрестности', fr: 'Jérusalem et environs', es: 'Jerusalén y alrededores' } },
  { id: 'north', names: { he: 'חיפה והצפון', en: 'Haifa & the North', ru: 'Хайфа и север', fr: 'Haïfa et le Nord', es: 'Haifa y el Norte' } },
  { id: 'south', names: { he: 'השפלה והדרום', en: 'Shfela & the South', ru: 'Шфела и юг', fr: 'Shéphélah et le Sud', es: 'Shfela y el Sur' } },
  { id: 'eilat', names: { he: 'אילת וים המלח', en: 'Eilat & the Dead Sea', ru: 'Эйлат и Мёртвое море', fr: 'Eilat et mer Morte', es: 'Eilat y el Mar Muerto' } },
]

export interface IsraelCity { lat: number; lng: number; region: RegionId }
export const ISRAEL_CITY_COORDS: Readonly<Record<string, IsraelCity>> = {
  'תל אביב': { lat: 32.0853, lng: 34.7818, region: 'tlv' },
  'רמת גן': { lat: 32.0684, lng: 34.8248, region: 'tlv' },
  'גבעתיים': { lat: 32.0722, lng: 34.8120, region: 'tlv' },
  'בני ברק': { lat: 32.0807, lng: 34.8338, region: 'tlv' },
  'חולון': { lat: 32.0158, lng: 34.7874, region: 'tlv' },
  'בת ים': { lat: 32.0170, lng: 34.7515, region: 'tlv' },
  'יפו': { lat: 32.0500, lng: 34.7500, region: 'tlv' },
  'פתח תקווה': { lat: 32.0840, lng: 34.8878, region: 'tlv' },
  'ראש העין': { lat: 32.0956, lng: 34.9566, region: 'tlv' },
  'קריית אונו': { lat: 32.0636, lng: 34.8553, region: 'tlv' },
  'קרית אונו': { lat: 32.0636, lng: 34.8553, region: 'tlv' },
  'אור יהודה': { lat: 32.0300, lng: 34.8570, region: 'tlv' },
  'גבעת שמואל': { lat: 32.0780, lng: 34.8530, region: 'tlv' },
  'קריית שדה התעופה': { lat: 31.9980, lng: 34.8860, region: 'tlv' },
  'אלעד': { lat: 32.0520, lng: 34.9510, region: 'tlv' },
  'לוד': { lat: 31.9515, lng: 34.8950, region: 'tlv' },
  'הרצליה': { lat: 32.1663, lng: 34.8436, region: 'sharon' },
  'רמת השרון': { lat: 32.1465, lng: 34.8394, region: 'sharon' },
  'רעננה': { lat: 32.1848, lng: 34.8713, region: 'sharon' },
  'כפר סבא': { lat: 32.1750, lng: 34.9066, region: 'sharon' },
  'נתניה': { lat: 32.3215, lng: 34.8532, region: 'sharon' },
  'חדרה': { lat: 32.4340, lng: 34.9196, region: 'sharon' },
  'קיסריה': { lat: 32.5000, lng: 34.8900, region: 'sharon' },
  'נמל קיסריה': { lat: 32.5000, lng: 34.8900, region: 'sharon' },
  'אור עקיבא': { lat: 32.5060, lng: 34.9190, region: 'sharon' },
  'פרדס חנה': { lat: 32.4720, lng: 34.9770, region: 'sharon' },
  'חריש': { lat: 32.4600, lng: 35.0450, region: 'sharon' },
  'זכרון יעקב': { lat: 32.5733, lng: 34.9540, region: 'sharon' },
  'קיבוץ עברון': { lat: 32.9740, lng: 35.1130, region: 'north' },
  'ירושלים': { lat: 31.7683, lng: 35.2137, region: 'jer' },
  'מעלה אדומים': { lat: 31.7770, lng: 35.2980, region: 'jer' },
  'רמת רחל': { lat: 31.7450, lng: 35.2200, region: 'jer' },
  'קיבוץ צובה': { lat: 31.7960, lng: 35.1090, region: 'jer' },
  'מודיעין': { lat: 31.8969, lng: 35.0104, region: 'south' },
  'מודיעין עילית': { lat: 31.9330, lng: 35.0430, region: 'jer' },
  'רעות': { lat: 31.9100, lng: 35.0100, region: 'south' },
  'חיפה': { lat: 32.7940, lng: 34.9896, region: 'north' },
  'קריית ביאליק': { lat: 32.8275, lng: 35.0850, region: 'north' },
  'קרית ביאליק': { lat: 32.8275, lng: 35.0850, region: 'north' },
  'קריית מוצקין': { lat: 32.8350, lng: 35.0770, region: 'north' },
  'קריית אתא': { lat: 32.8090, lng: 35.1050, region: 'north' },
  'קריית ים': { lat: 32.8500, lng: 35.0700, region: 'north' },
  'טירת כרמל': { lat: 32.7600, lng: 34.9700, region: 'north' },
  'עתלית': { lat: 32.6860, lng: 34.9420, region: 'north' },
  'עכו': { lat: 32.9281, lng: 35.0818, region: 'north' },
  'נהריה': { lat: 33.0089, lng: 35.0981, region: 'north' },
  'כרמיאל': { lat: 32.9170, lng: 35.2950, region: 'north' },
  'מעלות': { lat: 33.0167, lng: 35.2733, region: 'north' },
  'ירכא': { lat: 32.9519, lng: 35.2142, region: 'north' },
  'כפר יאסיף': { lat: 32.9530, lng: 35.1650, region: 'north' },
  'טמרה': { lat: 32.8530, lng: 35.1980, region: 'north' },
  'יקנעם': { lat: 32.6596, lng: 35.1088, region: 'north' },
  'מגדל העמק': { lat: 32.6784, lng: 35.2400, region: 'north' },
  'נצרת': { lat: 32.6996, lng: 35.3035, region: 'north' },
  'נוף הגליל': { lat: 32.7000, lng: 35.3200, region: 'north' },
  'כפר כנא': { lat: 32.7470, lng: 35.3420, region: 'north' },
  'עפולה': { lat: 32.6078, lng: 35.2897, region: 'north' },
  'מעלה גלבוע': { lat: 32.4700, lng: 35.4200, region: 'north' },
  'טבריה': { lat: 32.7959, lng: 35.5310, region: 'north' },
  'ראש פינה': { lat: 32.9692, lng: 35.5436, region: 'north' },
  'קצרין': { lat: 32.9900, lng: 35.6900, region: 'north' },
  'קריית שמונה': { lat: 33.2078, lng: 35.5720, region: 'north' },
  'קרית שמונה': { lat: 33.2078, lng: 35.5720, region: 'north' },
  'נס עמים': { lat: 32.9890, lng: 35.1830, region: 'north' },
  'כפר קרע': { lat: 32.5100, lng: 35.0500, region: 'north' },
  'באר שבע': { lat: 31.2530, lng: 34.7915, region: 'south' },
  'ראשון לציון': { lat: 31.9730, lng: 34.7925, region: 'south' },
  'רחובות': { lat: 31.8928, lng: 34.8113, region: 'south' },
  'נס ציונה': { lat: 31.9300, lng: 34.7980, region: 'south' },
  'יבנה': { lat: 31.8780, lng: 34.7390, region: 'south' },
  'גדרה': { lat: 31.8100, lng: 34.7770, region: 'south' },
  'רמלה': { lat: 31.9275, lng: 34.8625, region: 'south' },
  'באר יעקב': { lat: 31.9420, lng: 34.8350, region: 'south' },
  'קריית עקרון': { lat: 31.8590, lng: 34.8230, region: 'south' },
  'אשדוד': { lat: 31.8044, lng: 34.6553, region: 'south' },
  'אשקלון': { lat: 31.6688, lng: 34.5743, region: 'south' },
  'קריית מלאכי': { lat: 31.7300, lng: 34.7450, region: 'south' },
  'נתיבות': { lat: 31.4230, lng: 34.5890, region: 'south' },
  'שדרות': { lat: 31.5250, lng: 34.5960, region: 'south' },
  'אופקים': { lat: 31.3140, lng: 34.6200, region: 'south' },
  'רהט': { lat: 31.3930, lng: 34.7540, region: 'south' },
  'דימונה': { lat: 31.0700, lng: 35.0300, region: 'south' },
  'ערד': { lat: 31.2589, lng: 35.2128, region: 'south' },
  'אילת': { lat: 29.5577, lng: 34.9519, region: 'eilat' },
  'ים המלח': { lat: 31.2000, lng: 35.3600, region: 'eilat' },
}

/** The city's name in the reader's language (Hebrew as written). */
export const cityLabel = (he: string, lang: Lang): string => cityName(he, lang)

/** Cities that carry a canonical spelling, one per place (the duplicates are alternate Hebrew spellings), for a picker list. */
export function citiesOfRegion(region: RegionId | null, lang: Lang): { he: string; label: string }[] {
  const seen = new Set<string>()
  const out: { he: string; label: string }[] = []
  for (const [he, c] of Object.entries(ISRAEL_CITY_COORDS)) {
    if (region && c.region !== region) continue
    const label = cityLabel(he, lang)
    if (seen.has(label)) continue
    seen.add(label)
    out.push({ he, label })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, lang))
}
