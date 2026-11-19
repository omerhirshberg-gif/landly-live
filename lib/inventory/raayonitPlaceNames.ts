// Branch names, cities and streets in English, Russian, French and Spanish without sending proper nouns through machine
// translation: known cities and mall/street words come from a dictionary, the brand part of a branch name from the brand
// glossary, and anything left is spelled out phonetically. Pure; shared by the sync and the tests.
import { officialBrandName, type BrandLang } from './raayonitBrandNames'

type Pair = readonly [string, string] // [English, Russian]; French and Spanish use the English spelling

const CITIES: Record<string, Pair> = {
  'תל אביב': ['Tel Aviv', 'Тель-Авив'], 'ירושלים': ['Jerusalem', 'Иерусалим'], 'חיפה': ['Haifa', 'Хайфа'], 'אילת': ['Eilat', 'Эйлат'],
  'באר שבע': ['Beer Sheva', 'Беэр-Шева'], 'ראשון לציון': ['Rishon LeZion', 'Ришон-ле-Цион'], 'טבריה': ['Tiberias', 'Тверия'],
  'נתניה': ['Netanya', 'Нетания'], 'אשדוד': ['Ashdod', 'Ашдод'], 'רמת גן': ['Ramat Gan', 'Рамат-Ган'], 'הרצליה': ['Herzliya', 'Герцлия'],
  'אשקלון': ['Ashkelon', 'Ашкелон'], 'פתח תקווה': ['Petah Tikva', 'Петах-Тиква'], 'קריית ביאליק': ['Kiryat Bialik', 'Кирьят-Бялик'],
  'קרית ביאליק': ['Kiryat Bialik', 'Кирьят-Бялик'], 'חולון': ['Holon', 'Холон'], 'בת ים': ['Bat Yam', 'Бат-Ям'], 'רחובות': ['Rehovot', 'Реховот'],
  'ים המלח': ['Dead Sea', 'Мёртвое море'], 'כפר סבא': ['Kfar Saba', 'Кфар-Саба'], 'ראש פינה': ['Rosh Pina', 'Рош-Пина'], 'עפולה': ['Afula', 'Афула'],
  'עכו': ['Acre', 'Акко'], 'רמלה': ['Ramla', 'Рамла'], 'גבעתיים': ['Givatayim', 'Гиватаим'], 'נצרת': ['Nazareth', 'Назарет'],
  'קריית אונו': ['Kiryat Ono', 'Кирьят-Оно'], 'קרית אונו': ['Kiryat Ono', 'Кирьят-Оно'], 'כרמיאל': ['Karmiel', 'Кармиэль'], 'יקנעם': ['Yokneam', 'Йокнеам'],
  'זכרון יעקב': ['Zikhron Yaakov', 'Зихрон-Яаков'], 'רעננה': ['Raanana', 'Раанана'], 'ראש העין': ['Rosh HaAyin', 'Рош-ха-Аин'], 'בני ברק': ['Bnei Brak', 'Бней-Брак'],
  'נוף הגליל': ['Nof HaGalil', 'Ноф-ха-Галиль'], 'נהריה': ['Nahariya', 'Нагария'], 'ירכא': ['Yarka', 'Ярка'], 'קריית ים': ['Kiryat Yam', 'Кирьят-Ям'],
  'מגדל העמק': ['Migdal HaEmek', 'Мигдаль-ха-Эмек'], 'חדרה': ['Hadera', 'Хадера'], 'גדרה': ['Gedera', 'Гедера'], 'נתיבות': ['Netivot', 'Нетивот'],
  'מודיעין': ['Modiin', 'Модиин'], 'מודיעין עילית': ['Modiin Illit', 'Модиин-Илит'], 'מעלות': ['Maalot', 'Маалот'], 'נמל קיסריה': ['Caesarea Port', 'Порт Кесарии'],
  'קיסריה': ['Caesarea', 'Кесария'], 'מעלה גלבוע': ['Maale Gilboa', 'Маале-Гильбоа'], 'רמת השרון': ['Ramat HaSharon', 'Рамат-ха-Шарон'], 'עתלית': ['Atlit', 'Атлит'],
  'יפו': ['Jaffa', 'Яффо'], 'קריית שדה התעופה': ['Airport City', 'Эйрпорт-Сити'], 'קניון נחמיה': ['Nehemia Mall', 'ТЦ Нехемия'], 'מעיליא': ['Mghar', 'Маалия'],
  'קצרין': ['Katzrin', 'Кацрин'], 'כפר יאסיף': ['Kafr Yasif', 'Кфар-Ясиф'], 'טמרה': ['Tamra', 'Тамра'], 'כפר כנא': ['Kafr Kanna', 'Кфар-Кана'],
  'כפר קרע': ['Kafr Qara', 'Кфар-Кара'], 'גבעת שמואל': ['Givat Shmuel', 'Гиват-Шмуэль'], 'טיילת בת ים': ['Bat Yam Promenade', 'Набережная Бат-Яма'],
  'בקעת הירדן': ['Jordan Valley', 'Иорданская долина'], 'רהט': ['Rahat', 'Рахат'], 'ערד': ['Arad', 'Арад'], 'דימונה': ['Dimona', 'Димона'],
  'קריית מוצקין': ['Kiryat Motzkin', 'Кирьят-Моцкин'], 'קריית אתא': ['Kiryat Ata', 'Кирьят-Ата'], 'טירת כרמל': ['Tirat Carmel', 'Тират-Кармель'],
  'אור עקיבא': ['Or Akiva', 'Ор-Акива'], 'חריש': ['Harish', 'Хариш'], 'פרדס חנה': ['Pardes Hanna', 'Пардес-Хана'], 'אלעד': ['Elad', 'Эльад'],
  'אור יהודה': ['Or Yehuda', 'Ор-Иегуда'], 'לוד': ['Lod', 'Лод'], 'נס ציונה': ['Ness Ziona', 'Нес-Ципа'], 'יבנה': ['Yavne', 'Явне'],
  'מעלה אדומים': ['Maale Adumim', 'Маале-Адумим'], 'באר יעקב': ['Beer Yaakov', 'Беэр-Яаков'], 'קריית מלאכי': ['Kiryat Malakhi', 'Кирьят-Малахи'],
  'שדרות': ['Sderot', 'Сдерот'], 'אופקים': ['Ofakim', 'Офаким'], 'קריית עקרון': ['Kiryat Ekron', 'Кирьят-Экрон'], 'רמת הגולן': ['Golan Heights', 'Голанские высоты'],
  'רעות': ['Reut', 'Реут'], 'רמת רחל': ['Ramat Rachel', 'Рамат-Рахель'], 'עמוקה': ['Amuka', 'Амука'], 'נס עמים': ['Nes Ammim', 'Нес-Амим'], 'חד נס': ['Had Nes', 'Хад-Нес'],
  'קריית שמונה': ['Kiryat Shmona', 'Кирьят-Шмона'], 'קרית שמונה': ['Kiryat Shmona', 'Кирьят-Шмона'], 'חנות אינטרנטית': ['Online store', 'Интернет-магазин'],
  'חנות אונליין': ['Online store', 'Интернет-магазин'], 'בבית הלקוח': ['At the customer’s home', 'У клиента дома'], 'סיור קולינרי - שווקים בארץ': ['Culinary tour - markets across Israel', 'Кулинарный тур по рынкам Израиля'],
  'מפלס תחתון': ['Lower level', 'Нижний уровень'], 'קיבוץ קדרים': ['Kibbutz Kadarim', 'Киббуц Кадарим'], 'קיבוץ כפר מסריק': ['Kibbutz Kfar Masaryk', 'Киббуц Кфар-Масарик'],
  'קיבוץ כפר בלום': ['Kibbutz Kfar Blum', 'Киббуц Кфар-Блюм'], 'קיבוץ יפעת': ['Kibbutz Yifat', 'Киббуц Ифат'], 'קיבוץ צובה': ['Kibbutz Tzuba', 'Киббуц Цова'], 'קיבוץ עברון': ['Kibbutz Evron', 'Киббуц Эврон'],
  'מושב כפר יובל': ['Moshav Kfar Yuval', 'Мошав Кфар-Юваль'], 'מושב שבי ציון': ['Moshav Shavei Zion', 'Мошав Шавей-Цион'], 'מושב רמות נפתלי': ['Moshav Ramot Naftali', 'Мошав Рамот-Нафтали'],
  'מושב בן עמי': ['Moshav Ben Ami', 'Мошав Бен-Ами'], 'מושב שזור': ['Moshav Shezor', 'Мошав Шезор'], 'מושב אבני איתן': ['Moshav Avnei Eitan', 'Мошав Авней-Эйтан'],
}

const PHRASES: Record<string, Pair> = {
  'יהודה הלוי': ['Yehuda HaLevi', 'Иегуда ха-Леви'], 'בן גוריון': ['Ben Gurion', 'Бен-Гурион'], 'המושבה הגרמנית': ['German Colony', 'Немецкая колония'],
  'גרנד קניון': ['Grand Canyon Mall', 'Гранд Каньон'], 'קניון עזריאלי': ['Azrieli Mall', 'ТЦ Азриэли'], 'לב המפרץ': ['Lev HaMifratz', 'Лев ха-Мифрац'],
  'מרכז מסחרי': ['Shopping Center', 'Торговый центр'], 'הרצל': ['Herzl', 'Герцль'], 'בית המילניום': ['Beit HaMillennium', 'Бейт ха-Миллениум'],
}
// Words that recur in addresses and branch names.
const WORDS: Record<string, Pair> = {
  'קניון': ['Mall', 'ТЦ'], 'מתחם': ['Complex', 'Комплекс'], 'מרכז': ['Center', 'Центр'], 'סנטר': ['Center', 'Центр'], 'דרך': ['Derech', 'Дерех'], 'שדרות': ['Blvd', 'бул.'], 'רחוב': ['St', 'ул.'],
  'מלון': ['Hotel', 'Отель'], 'ביג': ['BIG', 'BIG'], 'גרנד': ['Grand', 'Гранд'], 'עזריאלי': ['Azrieli', 'Азриэли'], 'ויצמן': ['Weizmann', 'Вайцман'], 'גוריון': ['Gurion', 'Гурион'], 'בן': ['Ben', 'Бен'],
  'הרצל': ['Herzl', 'Герцль'], 'מסחרי': ['Commercial', 'Торговый'], 'חוצות': ['Houtzot', 'Хуцот'], 'הגולן': ['HaGolan', 'ха-Голан'], 'מול': ['Mol', 'Моль'], 'הרים': ['Harim', 'Харим'],
  'כביש': ['Road', 'Шоссе'], 'ראשי': ['Main', 'Главное'], 'כניסה': ['Entrance', 'Вход'], 'ראשית': ['Main', 'Главный'], 'חוף': ['Beach', 'Пляж'], 'המושבה': ['The Colony', 'Колония'],
  'הגרמנית': ['German', 'Германская'], 'לב': ['Lev', 'Лев'], 'המפרץ': ['HaMifratz', 'ха-Мифрац'], 'הקריון': ['HaKaryon', 'ха-Карьон'], 'בית': ['Beit', 'Бейт'], 'המילניום': ['HaMillennium', 'ха-Миллениум'],
  'סניף': ['Branch', 'Филиал'], 'הים': ['HaYam', 'ха-Ям'], 'עמק': ['Emek', 'Эмек'], 'דותן': ['Dotan', 'Дотан'], 'הזיתים': ['HaZeitim', 'ха-Зейтим'], 'האירוס': ['HaIris', 'ха-Ирис'],
  'הנמל': ['The Port', 'Порт'], 'נמל': ['Port', 'Порт'], 'גן': ['Gan', 'Ган'], 'העיר': ['HaIr', 'ха-Ир'], 'הישנה': ['The Old', 'Старый'], 'שוק': ['Market', 'Рынок'], 'אזור': ['Zone', 'Зона'], 'תעשיה': ['Industrial', 'Промзона'],
  'תעשייה': ['Industrial', 'Промзона'], 'פארק': ['Park', 'Парк'], 'מרינה': ['Marina', 'Марина'], 'טיילת': ['Promenade', 'Набережная'], 'כפר': ['Kfar', 'Кфар'], 'קריית': ['Kiryat', 'Кирьят'], 'קרית': ['Kiryat', 'Кирьят'],
  'רמת': ['Ramat', 'Рамат'], 'אביב': ['Aviv', 'Авив'], 'תל': ['Tel', 'Тель'], 'ים': ['Yam', 'Ям'], 'שבע': ['Sheva', 'Шева'], 'באר': ['Beer', 'Беэр'], 'נוף': ['Nof', 'Ноф'], 'הגליל': ['HaGalil', 'ха-Галиль'],
  'השרון': ['HaSharon', 'ха-Шарон'], 'יהודה': ['Yehuda', 'Иегуда'], 'סבא': ['Saba', 'Саба'], 'פתח': ['Petah', 'Петах'], 'תקווה': ['Tikva', 'Тиква'], 'ראשון': ['Rishon', 'Ришон'], 'לציון': ['LeZion', 'ле-Цион'],
  'מודיעין': ['Modiin', 'Модиин'], 'אינטרנטית': ['Online', 'Онлайн'], 'חנות': ['Store', 'Магазин'], 'ו': ['and', 'и'],
}


// Frequent street, mall and venue words in branch addresses, English spelling only; Russian is derived from it.
const EXTRA: Record<string, string> = {
  'קפה': 'Cafe', 'פיצה': 'Pizza', 'סטורי': 'Story', 'סיטי': 'City', 'סינמה': 'Cinema', 'סינימה': 'Cinema', 'פלאזה': 'Plaza', 'פלזה': 'Plaza', 'ביסקוטי': 'Biscotti', 'הולמס': 'Holmes', 'פלייס': 'Place',
  'ברנר': 'Brenner', 'מקס': 'Max', 'הרודס': 'Herods', 'בוטיק': 'Boutique', 'ספא': 'Spa', 'עקיבא': 'Akiva', 'יעקב': 'Yaakov', 'עגבניה': 'Agvania', 'ביאליק': 'Bialik', 'ראש': 'Rosh', 'אור': 'Or', 'בת': 'Bat',
  'ג\'אפן': 'Japan', 'באשר': 'Basher', 'פרומז\'רי': 'Fromagerie', 'לאונרדו': 'Leonardo', 'מקסיקנה': 'Mexicana', 'פרנג\'ליקו': 'Frangelico', 'מנדרין': 'Mandarin', 'קלאב': 'Club', 'ביץ': 'Beach', 'ביץ\'': 'Beach',
  'מלח': 'Melach', 'המלח': 'HaMelach', 'ים': 'Yam', 'טאוור': 'Tower', 'טאואר': 'Tower', 'טאון': 'Town', 'שופ': 'Shop', 'טיים': 'Time', 'מרקט': 'Market', 'קורל': 'Coral', 'פאשן': 'Fashion', 'רד': 'Red', 'סי': 'Sea',
  'ריזורט': 'Resort', 'רויאל': 'Royal', 'פאלאס': 'Palace', 'פרמייר': 'Premier', 'אולטרה': 'Ultra', 'סטאר': 'Star', 'גו': 'Go', 'נאו': 'Now', 'פיאנו': 'Piano', 'מונד': 'Mond', 'לה': 'La', 'בורסה': 'Bourse',
  'בן': 'Ben', 'דיזינגוף': 'Dizengoff', 'דיזנגוף': 'Dizengoff', 'רוטשילד': 'Rothschild', 'ארלוזרוב': 'Arlozorov', 'אבן': 'Ibn', 'גבירול': 'Gvirol', 'שינקין': 'Shenkin', 'אלנבי': 'Allenby', 'סוקולוב': 'Sokolov',
  'ז\'בוטינסקי': 'Jabotinsky', 'זבוטינסקי': 'Jabotinsky', 'ויצמן': 'Weizmann', 'הרצל': 'Herzl', 'בן־גוריון': 'Ben Gurion', 'העצמאות': 'HaAtzmaut', 'ההסתדרות': 'HaHistadrut', 'הנמל': 'HaNamal', 'הירקון': 'HaYarkon',
  'הנביאים': 'HaNeviim', 'בלפור': 'Balfour', 'סירקין': 'Sirkin', 'קרליבך': 'Carlebach', 'לבונטין': 'Levontin', 'פלורנטין': 'Florentin', 'נורדאו': 'Nordau', 'רבין': 'Rabin', 'בגין': 'Begin', 'מנחם': 'Menachem',
  'חיים': 'Chaim', 'משה': 'Moshe', 'דוד': 'David', 'יצחק': 'Yitzhak', 'יוסף': 'Yosef', 'אליהו': 'Eliyahu', 'שמעון': 'Shimon', 'ישראל': 'Israel', 'שאול': 'Shaul', 'המלך': 'HaMelech', 'רחל': 'Rachel', 'לוי': 'Levi',
  'כהן': 'Cohen', 'הלל': 'Hillel', 'עמק': 'Emek', 'הרכס': 'HaRekes', 'הכרמל': 'HaCarmel', 'כרמל': 'Carmel', 'העמק': 'HaEmek', 'הגלבוע': 'HaGilboa', 'גלבוע': 'Gilboa', 'הים': 'HaYam', 'האורגים': 'HaOrgim',
  'המלאכה': 'HaMelacha', 'החרושת': 'HaCharoshet', 'התמר': 'HaTamar', 'התמרים': 'HaTmarim', 'הזהב': 'HaZahav', 'הדקל': 'HaDekel', 'האלוף': 'HaAluf', 'אלוף': 'Aluf', 'המדע': 'HaMada', 'הגשר': 'HaGesher',
  'ירושלים': 'Jerusalem', 'צים': 'Zim', 'מגדלי': 'Migdalei', 'רמת': 'Ramat', 'רמתיים': 'Ramatayim', 'גילה': 'Gilo', 'שכונת': 'Neighborhood of', 'מצדה': 'Masada', 'חמת': 'Hamat', 'קיסר': 'Keisar',
  'אילון': 'Ayalon', 'האיילון': 'HaAyalon', 'גלילות': 'Glilot', 'מרום': 'Marom', 'שרונה': 'Sarona', 'שרונים': 'Sharonim', 'גולני': 'Golani', 'חטיבת': 'Brigade', 'הגדול': 'HaGadol', 'הקניון': 'HaKanyon',
}
const CYR: [string, string][] = [['shch', 'щ'], ['tz', 'ц'], ['sh', 'ш'], ['ch', 'х'], ['kh', 'х'], ['zh', 'ж'], ['ya', 'я'], ['yu', 'ю'], ['ye', 'е'], ['yo', 'ё'], ['ai', 'ай'], ['ei', 'ей'], ['a', 'а'], ['b', 'б'], ['c', 'к'], ['d', 'д'], ['e', 'е'], ['f', 'ф'], ['g', 'г'], ['h', 'х'], ['i', 'и'], ['j', 'дж'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['q', 'к'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'], ['v', 'в'], ['w', 'в'], ['x', 'кс'], ['y', 'й'], ['z', 'з']]
/** English (Latin) text spelled in Cyrillic, for names that only have an English spelling here. */
export function latinToCyrillic(text: string): string {
  return text.replace(/[A-Za-z]+/g, (word) => {
    let out = ''
    const low = word.toLowerCase()
    for (let i = 0; i < low.length;) {
      const hit = CYR.find(([l]) => low.startsWith(l, i))!
      out += hit[1]; i += hit[0].length
    }
    return word[0] === word[0]!.toUpperCase() && out ? out[0]!.toUpperCase() + out.slice(1) : out
  })
}

const EN_CONS: Record<string, string> = { ב: 'b', ג: 'g', ד: 'd', ה: 'h', ז: 'z', ח: 'ch', ט: 't', כ: 'k', ך: 'ch', ל: 'l', מ: 'm', ם: 'm', נ: 'n', ן: 'n', ס: 's', פ: 'p', ף: 'f', צ: 'tz', ץ: 'tz', ק: 'k', ר: 'r', ש: 'sh', ת: 't' }
const RU_CONS: Record<string, string> = { ב: 'в', ג: 'г', ד: 'д', ה: 'х', ז: 'з', ח: 'х', ט: 'т', כ: 'к', ך: 'х', ל: 'л', מ: 'м', ם: 'м', נ: 'н', ן: 'н', ס: 'с', פ: 'п', ף: 'ф', צ: 'ц', ץ: 'ц', ק: 'к', ר: 'р', ש: 'ш', ת: 'т' }
const HEB = /[א-ת]/

/** Spells a Hebrew word out phonetically: consonants by table, a vowel between two consonants, "o"/"i" for ו/י. */
export function transliterate(word: string, lang: 'en' | 'ru'): string {
  const cons = lang === 'en' ? EN_CONS : RU_CONS
  const e = lang === 'en' ? 'e' : 'е'
  const vowel = (c: string) => (c === 'ו' ? (lang === 'en' ? 'o' : 'о') : c === 'י' ? (lang === 'en' ? 'i' : 'и') : c === 'א' || c === 'ע' ? (lang === 'en' ? 'a' : 'а') : '')
  const letters = [...word.replace(/[׳'’"״]/g, '')]
  let out = ''
  letters.forEach((c, i) => {
    if (cons[c]) {
      out += cons[c]
      const next = letters[i + 1]
      if (next && cons[next] && i !== letters.length - 2 && !(c === 'ה' && i === letters.length - 1)) out += e
    } else if (c === 'ו' || c === 'י' || c === 'א' || c === 'ע') {
      if (i === 0 || (c !== 'א' && c !== 'ע') || letters[i - 1] && !cons[letters[i - 1]!]) out += vowel(c)
      else if (i !== letters.length - 1) out += vowel(c)
    } else out += c
  })
  const cap = out.charAt(0).toUpperCase() + out.slice(1)
  return cap
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

/** A place's text (city, street, mall, branch label) in a language, longest dictionary phrase first. */
export function localizePlace(text: string, lang: BrandLang, brandHe?: string): string {
  let rest = norm(text)
  if (!rest) return ''
  const pick = (pair: Pair) => (lang === 'ru' ? pair[1] : pair[0])
  const out: string[] = []
  // The brand part of a branch name is the brand's commercial name, not a translation.
  if (brandHe && rest.startsWith(norm(brandHe))) {
    const name = officialBrandName(brandHe, lang)
    if (name) { out.push(name, ' '); rest = rest.slice(norm(brandHe).length).trim() }
  } else if (brandHe && !HEB.test(brandHe)) {
    // A Latin-letter brand whose branch is named with its Hebrew spelling: the words before the first place word are the brand.
    const words = rest.split(' ')
    const at = words.findIndex((_, k) => k > 0 && (CITIES[words.slice(k).join(' ')] || WORDS[words[k]!] || PHRASES[words.slice(k).join(' ')]))
    const cut = at > 0 ? at : words.length > 1 && CITIES[words.slice(-1)[0]!] ? words.length - 1 : -1
    if (cut > 0) { out.push(brandHe, ' '); rest = words.slice(cut).join(' ') }
  }
  const tokens = rest.split(/(\s+|,|-|–|\(|\)|\/|\+)/).filter((t) => t !== '')
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (!HEB.test(t)) { out.push(t); continue }
    let matched = false
    for (let n = Math.min(4, tokens.length - i); n >= 1 && !matched; n--) {
      // A phrase of n words with their single spaces.
      const span = tokens.slice(i, i + n * 2 - 1).join('')
      if (n * 2 - 1 > tokens.length - i) continue
      const hit = CITIES[span] ?? PHRASES[span] ?? (n === 1 ? WORDS[span] ?? (EXTRA[span] ? ([EXTRA[span]!, latinToCyrillic(EXTRA[span]!)] as Pair) : undefined) : undefined)
      if (hit) { out.push(pick(hit)); i += n * 2 - 2; matched = true }
    }
    if (!matched) out.push(transliterate(t, lang === 'ru' ? 'ru' : 'en'))
  }
  return norm(out.join('').replace(/\s+,/g, ',').replace(/Mall\s+Mall/g, 'Mall'))
}

export const ruPlaceCities = CITIES

/** A known city's name in a language (Hebrew as written; French and Spanish use the English spelling). */
export function cityName(he: string, lang: BrandLang | 'he'): string {
  const pair = CITIES[he]
  if (!pair || lang === 'he') return he
  return lang === 'ru' ? pair[1] : pair[0]
}
