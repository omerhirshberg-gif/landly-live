// Every word of the /join launch page, in the site's five languages, English
// first. It lives apart from lib/i18n/translations.ts because the native app
// bundles that file and has no use for campaign copy, and because each page must
// render in its own language on the server, without LangProvider.
//
// The consent sentence is proof of what a lead agreed to, so the API stores it
// word for word with its version (lib/prelaunch/leads.server.ts). Any change to
// `consent` must bump PRELAUNCH_CONSENT_VERSION.
export const PRELAUNCH_LANGS = ['en', 'he', 'ru', 'fr', 'es'] as const
export type PrelaunchLang = (typeof PRELAUNCH_LANGS)[number]

/** /join is English; the others have their own static pages. */
export const LOCALIZED_LANGS = ['he', 'ru', 'fr', 'es'] as const satisfies readonly PrelaunchLang[]

export const PRELAUNCH_CONSENT_VERSION = '2026-11-launch'

export function isPrelaunchLang(value: unknown): value is PrelaunchLang {
  return typeof value === 'string' && (PRELAUNCH_LANGS as readonly string[]).includes(value)
}

export const PRELAUNCH_PATHS: Record<PrelaunchLang, string> = {
  en: '/join',
  he: '/join/he',
  ru: '/join/ru',
  fr: '/join/fr',
  es: '/join/es',
}

/** The form's optional "which describes you" answer, as stored on a lead. */
export const PERSONAS = ['new_oleh', 'veteran_oleh', 'lone_soldier', 'student', 'local', 'other'] as const
export type Persona = (typeof PERSONAS)[number]

/** Leads stored before the Oleh split hold `new_immigrant`; it reads as `new_oleh`. No data migration. */
const LEGACY_PERSONAS: Readonly<Record<string, Persona>> = { new_immigrant: 'new_oleh' }

/** A stored or submitted persona as a current key, or null when it is not one we know. */
export function normalizePersona(value: unknown): Persona | null {
  if (typeof value !== 'string') return null
  const key = LEGACY_PERSONAS[value] ?? value
  return (PERSONAS as readonly string[]).includes(key) ? (key as Persona) : null
}

/** The form's optional "where did you hear about us" answer, as stored on a lead. Not the `?ref=` share code. */
export const REFERRAL_SOURCES = ['instagram', 'facebook', 'friend', 'tiktok', 'google', 'whatsapp', 'other'] as const
export type ReferralSource = (typeof REFERRAL_SOURCES)[number]

export const PILLARS = ['deals', 'free', 'newcomers'] as const
export type Pillar = (typeof PILLARS)[number]

export const PHOTOS = ['restaurants', 'beach', 'sport', 'attractions', 'pampering', 'fashion', 'cars', 'kids'] as const
export type Photo = (typeof PHOTOS)[number]

interface Card {
  title: string
  body: string
}

interface Question {
  q: string
  a: string
}

export interface PrelaunchCopy {
  metaTitle: string
  metaDescription: string
  /** The share card's two lines: its renderer can't wrap Hebrew, so they're broken here. */
  cardLines: [string, string]
  languageLabel: string
  heroTitle: string
  heroSub: string
  heroCta: string
  dealsBadge: string
  /** The launch date in words: what a screen reader gets in place of the ticking digits. */
  launchDate: string
  countdownLabel: string
  units: { days: string; hours: string; minutes: string; seconds: string }
  photoAlts: Record<Photo, string>
  pillarsTitle: string
  pillars: Record<Pillar, Card>
  stepsTitle: string
  steps: [Card, Card, Card]
  signupTitle: string
  signupSub: string
  firstName: string
  lastName: string
  phone: string
  email: string
  emailPlaceholder: string
  countrySelect: string
  personaLabel: string
  personaPlaceholder: string
  personas: Record<Persona, string>
  personaOtherLabel: string
  personaOtherPlaceholder: string
  preferredLanguageLabel: string
  referralLabel: string
  referralPlaceholder: string
  referralSources: Record<ReferralSource, string>
  consent: string
  legal: string
  terms: string
  privacy: string
  submit: string
  submitting: string
  errName: string
  errLastName: string
  errPhone: string
  errEmail: string
  errConsent: string
  errRateLimited: string
  errGeneric: string
  storyTitle: string
  storyBody: string
  foundingTitle: string
  foundingNumber: string
  foundingBody: string
  followTitle: string
  followSub: string
  followLabels: { instagram: string; facebook: string; whatsapp: string }
  newTab: string
  faqTitle: string
  faq: [Question, Question, Question, Question, Question]
  rights: string
  contactLabel: string
  successTitle: string
  successSub: string
  communityTitle: string
  communityBody: string
  communityCta: string
  shareTitle: string
  shareWhatsApp: string
  shareMore: string
  copyLink: string
  copied: string
  linkLabel: string
  notYou: string
  shareText: string
}

export const PRELAUNCH_COPY: Record<PrelaunchLang, PrelaunchCopy> = {
  en: {
    metaTitle: 'GoLandly | Local deals for people new to Israel',
    metaDescription: 'Local deals and vouchers for people new to Israel. Free to join. Launching January 1, 2027. Save your spot.',
    cardLines: ['Local deals and vouchers', 'for people new to Israel'],
    languageLabel: 'Language',
    heroTitle: 'Local deals and vouchers for people new to Israel',
    heroSub: 'Free to join. Launching January 1, 2027',
    heroCta: 'Save my spot',
    dealsBadge: 'Real local deals',
    launchDate: 'Launching January 1, 2027',
    countdownLabel: 'Time until launch',
    units: { days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' },
    photoAlts: {
      restaurants: 'A warmly lit restaurant dining room',
      beach: 'A sandy beach at sunset',
      sport: 'A modern gym with rows of dumbbells',
      attractions: 'A colorful fairground swing ride',
      pampering: 'A relaxing massage at a spa',
      fashion: 'A neatly arranged clothing boutique',
      cars: 'A driver at the wheel of a car at dusk',
      kids: 'A toddler playing with toys on a white rug',
    },
    pillarsTitle: 'What is GoLandly?',
    pillars: {
      deals: { title: 'Deals and vouchers', body: 'Discounts and vouchers at restaurants, gyms, shops and other local businesses.' },
      free: { title: 'Free to join', body: 'Signing up costs nothing. Just save your spot and we’ll take it from there.' },
      newcomers: { title: 'Built for newcomers', body: 'Made for new Olim, lone soldiers and students who are finding their feet in Israel.' },
    },
    stepsTitle: 'How it works',
    steps: [
      { title: 'Leave your details', body: 'Your name, WhatsApp number and email. It takes less than a minute.' },
      { title: 'Get the launch message', body: 'We’ll let you know on WhatsApp and by email as soon as GoLandly is live.' },
      { title: 'Start using deals', body: 'Pick a deal, show it at the business and enjoy.' },
    ],
    signupTitle: 'Save your spot',
    signupSub: 'Leave your details and you’ll be among the first to hear when GoLandly launches on January 1, 2027.',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'WhatsApp number',
    email: 'Email',
    emailPlaceholder: 'name@email.com',
    countrySelect: 'Choose a country code',
    personaLabel: 'Which describes you? (optional)',
    personaPlaceholder: 'Select one',
    personas: { new_oleh: 'New Oleh (0–5 years in Israel)', veteran_oleh: 'Veteran Oleh (5+ years in Israel)', lone_soldier: 'Lone soldier', student: 'Student', local: 'Local', other: 'Other' },
    personaOtherLabel: 'Tell us more (optional)',
    personaOtherPlaceholder: 'Tell us what brings you to Israel...',
    preferredLanguageLabel: 'Preferred language for updates',
    referralLabel: 'Where did you hear about us? (optional)',
    referralPlaceholder: 'Select one',
    referralSources: { instagram: '📸 Instagram', facebook: '📘 Facebook', friend: '👥 Friend / Word of mouth', tiktok: '🎵 TikTok', google: '🔍 Google Search', whatsapp: '💬 WhatsApp community / group', other: '🌐 Other' },
    consent: 'I agree to receive promotional messages from GoLandly by WhatsApp and email: the launch announcement, new deals and related news. I can opt out at any time.',
    legal: 'By signing up you accept the {terms} and {privacy}.',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    submit: 'Reserve my spot',
    submitting: 'Sending…',
    errName: 'Enter your first name.',
    errLastName: 'Enter your last name.',
    errPhone: 'Enter a valid WhatsApp number.',
    errEmail: 'Enter a valid email address.',
    errConsent: 'To sign up, please agree to receive updates.',
    errRateLimited: 'Too many attempts. Try again in a few minutes.',
    errGeneric: 'Something went wrong. Your details are still here, so please try again.',
    followTitle: 'Follow GoLandly',
    followSub: 'See new deals and launch news wherever you already are.',
    followLabels: { instagram: 'Follow on Instagram', facebook: 'Follow on Facebook', whatsapp: 'Join on WhatsApp' },
    newTab: 'opens in a new tab',
    storyTitle: 'Our story',
    storyBody: 'GoLandly was started by two Israeli reservists who want to help newcomers find their feet and discover great local businesses.',
    foundingTitle: 'Founding Members',
    foundingNumber: '1,000',
    foundingBody: 'The first 1,000 members get Founding Member status and first access to every new deal.',
    faqTitle: 'Questions',
    faq: [
      { q: 'Is GoLandly free to join?', a: 'Yes. Joining GoLandly is free.' },
      { q: 'When does GoLandly launch?', a: 'GoLandly launches on January 1, 2027. Everyone who saves a spot gets a message on launch day.' },
      { q: 'Who is GoLandly for?', a: 'People new to Israel: new Olim, lone soldiers and students. Locals are welcome too.' },
      { q: 'How do the deals work?', a: 'Local businesses offer deals and vouchers on GoLandly. You pick one and redeem it at the business.' },
      { q: 'What happens to my details? Can I opt out?', a: 'We use your details to send you launch news and deals, as described in our Privacy Policy. You can opt out at any time by writing to contact@golandly.com.' },
    ],
    rights: 'All rights reserved.',
    contactLabel: 'Email us',
    successTitle: 'You’re in, {name}!',
    successSub: 'Your spot is saved. We’ll message you when GoLandly launches on January 1, 2027.',
    communityTitle: 'Join the GoLandly WhatsApp Community',
    communityBody: 'Get direct launch announcements, meet other newcomers, and get instant updates.',
    communityCta: 'Join the community',
    shareTitle: 'Know someone who’d want this? Share with friends',
    shareWhatsApp: 'Share on WhatsApp',
    shareMore: 'Share another way',
    copyLink: 'Copy link',
    copied: 'Link copied',
    linkLabel: 'Your link',
    notYou: 'Sign up someone else on this device',
    shareText: 'GoLandly is launching on January 1, 2027 with local deals for people new to Israel. Save your spot:',
  },
  he: {
    metaTitle: 'GoLandly | הטבות מקומיות למי שחדש בישראל',
    metaDescription: 'הטבות ושוברים מקומיים למי שחדש בישראל. ההצטרפות חינם. השקה רשמית: 1 בינואר 2027. שמרו לעצמכם מקום.',
    cardLines: ['הטבות ושוברים מקומיים', 'למי שחדש בישראל'],
    languageLabel: 'שפה',
    heroTitle: 'הטבות ושוברים מקומיים למי שחדש בישראל',
    heroSub: 'ההצטרפות חינם. השקה רשמית: 1 בינואר 2027',
    heroCta: 'שמרו לי מקום',
    dealsBadge: 'הטבות מקומיות בלעדיות',
    launchDate: 'השקה רשמית: 1 בינואר 2027',
    countdownLabel: 'הזמן שנותר עד ההשקה',
    units: { days: 'ימים', hours: 'שעות', minutes: 'דקות', seconds: 'שניות' },
    photoAlts: {
      restaurants: 'חלל ישיבה במסעדה באור חמים',
      beach: 'חוף חולי בשקיעה',
      sport: 'חדר כושר מודרני עם שורות של משקולות',
      attractions: 'קרוסלת נדנדות צבעונית בלונה פארק',
      pampering: 'עיסוי מרגיע בספא',
      fashion: 'בוטיק בגדים מסודר',
      cars: 'נהג מאחורי ההגה בשעת בין ערביים',
      kids: 'פעוט משחק בצעצועים על שטיח לבן',
    },
    pillarsTitle: 'מה זה GoLandly?',
    pillars: {
      deals: { title: 'הטבות ושוברים', body: 'הנחות ושוברים במסעדות, בחדרי כושר, בחנויות ובעסקים מקומיים נוספים.' },
      free: { title: 'הצטרפות חינם', body: 'ההרשמה לא עולה כלום. שמרו לעצמכם מקום, ואת השאר נעשה אנחנו.' },
      newcomers: { title: 'נבנה בשביל מי שחדש כאן', body: 'בשביל עולים חדשים, חיילים בודדים וסטודנטים שמוצאים את מקומם בישראל.' },
    },
    stepsTitle: 'איך זה עובד',
    steps: [
      { title: 'משאירים פרטים', body: 'שם, מספר וואטסאפ ואימייל. זה לוקח פחות מדקה.' },
      { title: 'מקבלים הודעה בהשקה', body: 'נעדכן אתכם בוואטסאפ ובאימייל מיד עם ההשקה.' },
      { title: 'מתחילים ליהנות מההטבות', body: 'בוחרים הטבה, מציגים אותה בעסק ונהנים.' },
    ],
    signupTitle: 'שמרו לעצמכם מקום',
    signupSub: 'השאירו פרטים ותהיו מהראשונים לדעת על השקת GoLandly ב-1 בינואר 2027.',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    phone: 'מספר וואטסאפ',
    email: 'אימייל',
    emailPlaceholder: 'name@email.com',
    countrySelect: 'בחירת קידומת מדינה',
    personaLabel: 'מה מתאר אתכם? (לא חובה)',
    personaPlaceholder: 'בחרו אפשרות',
    personas: { // The ranges sit in LTR isolates (U+2066–U+2069) so "0–5" and "5+" keep their order inside the RTL label.
    new_oleh: 'עולה חדש/ה (⁦0–5⁩ שנים בארץ)', veteran_oleh: 'עולה ותיק/ה (⁦5+⁩ שנים בארץ)', lone_soldier: 'חייל/ת בודד/ה', student: 'סטודנט/ית', local: 'תושב/ת הארץ', other: 'אחר' },
    personaOtherLabel: 'ספרו לנו עוד (לא חובה)',
    personaOtherPlaceholder: 'ספרו לנו מה מביא אתכם לישראל...',
    preferredLanguageLabel: 'שפה מועדפת לעדכונים',
    referralLabel: 'איך שמעת עלינו? (לא חובה)',
    referralPlaceholder: 'בחרו אפשרות',
    referralSources: { instagram: '📸 Instagram', facebook: '📘 Facebook', friend: '👥 חבר / המלצה', tiktok: '🎵 TikTok', google: '🔍 חיפוש בגוגל', whatsapp: '💬 קהילה / קבוצת וואטסאפ', other: '🌐 אחר' },
    consent: 'אני מסכים/ה לקבל מ-GoLandly דיוור פרסומי בוואטסאפ ובאימייל: הודעה על ההשקה, הטבות חדשות וחדשות קשורות. אפשר להסיר את עצמי בכל עת.',
    legal: 'בהרשמה אתם מאשרים את {terms} ואת {privacy}.',
    terms: 'תנאי השימוש',
    privacy: 'מדיניות הפרטיות',
    submit: 'שריינו לי מקום',
    submitting: 'שולחים…',
    errName: 'נא להזין שם פרטי.',
    errLastName: 'נא להזין שם משפחה.',
    errPhone: 'נא להזין מספר וואטסאפ תקין.',
    errEmail: 'נא להזין כתובת אימייל תקינה.',
    errConsent: 'כדי להירשם צריך לאשר קבלת עדכונים.',
    errRateLimited: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
    errGeneric: 'משהו השתבש. הפרטים שלכם נשמרו בטופס, נסו שוב.',
    followTitle: 'עקבו אחרי GoLandly',
    followSub: 'הטבות חדשות ועדכוני השקה, איפה שנוח לכם.',
    followLabels: { instagram: 'עקבו באינסטגרם', facebook: 'עקבו בפייסבוק', whatsapp: 'הצטרפו בוואטסאפ' },
    newTab: 'נפתח בכרטיסייה חדשה',
    storyTitle: 'הסיפור שלנו',
    storyBody: 'את GoLandly הקימו שני מילואימניקים ישראלים שרוצים לעזור למי שחדש כאן למצוא את מקומו ולגלות עסקים מקומיים מעולים.',
    foundingTitle: 'חברים מייסדים',
    foundingNumber: '1,000',
    foundingBody: '1,000 החברים הראשונים יקבלו מעמד של חברים מייסדים וגישה ראשונה לכל הטבה חדשה.',
    faqTitle: 'שאלות',
    faq: [
      { q: 'ההצטרפות ל-GoLandly באמת בחינם?', a: 'כן. ההצטרפות ל-GoLandly בחינם.' },
      { q: 'מתי GoLandly עולה לאוויר?', a: 'ההשקה הרשמית היא ב-1 בינואר 2027. כל מי ששמר מקום יקבל הודעה ביום ההשקה.' },
      { q: 'למי GoLandly מיועדת?', a: 'למי שחדש בישראל: עולים חדשים, חיילים בודדים וסטודנטים. גם תושבי הארץ מוזמנים.' },
      { q: 'איך ההטבות עובדות?', a: 'עסקים מקומיים מציעים ב-GoLandly הטבות ושוברים. בוחרים אחד ומממשים אותו בעסק.' },
      { q: 'מה קורה עם הפרטים שלי? אפשר להסיר אותם?', a: 'אנחנו משתמשים בפרטים כדי לשלוח לכם עדכוני השקה והטבות, כמתואר במדיניות הפרטיות. אפשר להסיר את עצמכם בכל עת בכתיבה אל contact@golandly.com.' },
    ],
    rights: 'כל הזכויות שמורות.',
    contactLabel: 'כתבו לנו באימייל',
    successTitle: 'נרשמתם, {name}!',
    successSub: 'המקום שלכם שמור. נשלח לכם הודעה ביום ההשקה, 1 בינואר 2027.',
    communityTitle: 'הצטרפו לקהילת הוואטסאפ של GoLandly',
    communityBody: 'קבלו הודעות ישירות על ההשקה, הכירו חדשים אחרים וקבלו עדכונים מיידיים.',
    communityCta: 'הצטרפות לקהילה',
    shareTitle: 'מכירים מישהו שזה יעניין? שתפו עם חברים',
    shareWhatsApp: 'שיתוף בוואטסאפ',
    shareMore: 'שיתוף בדרך אחרת',
    copyLink: 'העתקת הקישור',
    copied: 'הקישור הועתק',
    linkLabel: 'הקישור שלכם',
    notYou: 'לרשום אדם נוסף מהמכשיר הזה',
    shareText: 'GoLandly עולה לאוויר ב-1 בינואר 2027 עם הטבות מקומיות למי שחדש בישראל. שמרו לעצמכם מקום:',
  },
  ru: {
    metaTitle: 'GoLandly | Местные скидки для новичков в Израиле',
    metaDescription: 'Местные скидки и ваучеры для тех, кто недавно в Израиле. Присоединиться бесплатно. Запуск 1 января 2027 года. Забронируйте место.',
    cardLines: ['Местные скидки и ваучеры', 'для новичков в Израиле'],
    languageLabel: 'Язык',
    heroTitle: 'Местные скидки и ваучеры для тех, кто недавно в Израиле',
    heroSub: 'Присоединиться бесплатно. Запуск 1 января 2027 года',
    heroCta: 'Забронировать место',
    dealsBadge: 'Настоящие местные скидки',
    launchDate: 'Запуск 1 января 2027 года',
    countdownLabel: 'До запуска осталось',
    units: { days: 'Дней', hours: 'Часов', minutes: 'Минут', seconds: 'Секунд' },
    photoAlts: {
      restaurants: 'Уютный зал ресторана в тёплом свете',
      beach: 'Песчаный пляж на закате',
      sport: 'Современный спортзал с рядами гантелей',
      attractions: 'Разноцветная карусель в парке аттракционов',
      pampering: 'Расслабляющий массаж в спа',
      fashion: 'Аккуратный бутик одежды',
      cars: 'Водитель за рулём в сумерках',
      kids: 'Малыш играет с игрушками на белом ковре',
    },
    pillarsTitle: 'Что такое GoLandly?',
    pillars: {
      deals: { title: 'Скидки и ваучеры', body: 'Скидки и ваучеры в ресторанах, спортзалах, магазинах и других местных заведениях.' },
      free: { title: 'Бесплатное участие', body: 'Регистрация ничего не стоит. Забронируйте место, а дальше мы всё сделаем сами.' },
      newcomers: { title: 'Создано для новичков', body: 'Для репатриантов, одиноких солдат и студентов, которые обживаются в Израиле.' },
    },
    stepsTitle: 'Как это работает',
    steps: [
      { title: 'Оставьте данные', body: 'Имя, номер WhatsApp и email. Это займёт меньше минуты.' },
      { title: 'Получите сообщение о запуске', body: 'Мы напишем в WhatsApp и на email, как только GoLandly заработает.' },
      { title: 'Пользуйтесь скидками', body: 'Выберите предложение, покажите его в заведении и наслаждайтесь.' },
    ],
    signupTitle: 'Забронируйте место',
    signupSub: 'Оставьте данные и узнайте одними из первых, когда GoLandly запустится 1 января 2027 года.',
    firstName: 'Имя',
    lastName: 'Фамилия',
    phone: 'Номер WhatsApp',
    email: 'Email',
    emailPlaceholder: 'name@email.com',
    countrySelect: 'Выберите код страны',
    personaLabel: 'Что вам подходит? (необязательно)',
    personaPlaceholder: 'Выберите вариант',
    personas: { new_oleh: 'Новый репатриант (0–5 лет)', veteran_oleh: 'Опытный репатриант (5+ лет)', lone_soldier: 'Одинокий солдат', student: 'Студент', local: 'Местный житель', other: 'Другое' },
    personaOtherLabel: 'Расскажите подробнее (необязательно)',
    personaOtherPlaceholder: 'Что привело вас в Израиль...',
    preferredLanguageLabel: 'Предпочитаемый язык общения',
    referralLabel: 'Откуда вы о нас узнали? (необязательно)',
    referralPlaceholder: 'Выберите вариант',
    referralSources: { instagram: '📸 Instagram', facebook: '📘 Facebook', friend: '👥 Друг / рекомендация', tiktok: '🎵 TikTok', google: '🔍 Поиск Google', whatsapp: '💬 Сообщество / группа WhatsApp', other: '🌐 Другое' },
    consent: 'Я согласен(на) получать от GoLandly рекламные сообщения в WhatsApp и по email: объявление о запуске, новые предложения и связанные новости. Я могу отказаться в любой момент.',
    legal: 'Регистрируясь, вы принимаете {terms} и {privacy}.',
    terms: 'Условия использования',
    privacy: 'Политику конфиденциальности',
    submit: 'Забронировать моё место',
    submitting: 'Отправляем…',
    errName: 'Введите имя.',
    errLastName: 'Введите фамилию.',
    errPhone: 'Введите действительный номер WhatsApp.',
    errEmail: 'Введите действительный email.',
    errConsent: 'Чтобы зарегистрироваться, подтвердите согласие на получение новостей.',
    errRateLimited: 'Слишком много попыток. Повторите через несколько минут.',
    errGeneric: 'Что-то пошло не так. Ваши данные сохранились в форме, попробуйте ещё раз.',
    followTitle: 'Следите за GoLandly',
    followSub: 'Новые предложения и новости о запуске там, где вам удобно.',
    followLabels: { instagram: 'Подписаться в Instagram', facebook: 'Подписаться в Facebook', whatsapp: 'Вступить в WhatsApp' },
    newTab: 'откроется в новой вкладке',
    storyTitle: 'Наша история',
    storyBody: 'GoLandly основали двое израильских резервистов, которые хотят помочь новичкам обжиться и открыть для себя отличные местные заведения.',
    foundingTitle: 'Участники-основатели',
    foundingNumber: '1 000',
    foundingBody: 'Первые 1 000 участников получат статус участника-основателя и первыми получат доступ к каждому новому предложению.',
    faqTitle: 'Вопросы',
    faq: [
      { q: 'Присоединиться к GoLandly бесплатно?', a: 'Да. Присоединиться к GoLandly можно бесплатно.' },
      { q: 'Когда запускается GoLandly?', a: 'GoLandly запустится 1 января 2027 года. Все, кто забронировал место, получат сообщение в день запуска.' },
      { q: 'Для кого GoLandly?', a: 'Для тех, кто недавно в Израиле: репатриантов, одиноких солдат и студентов. Местным жителям мы тоже рады.' },
      { q: 'Как работают скидки?', a: 'Местные заведения размещают в GoLandly скидки и ваучеры. Вы выбираете предложение и используете его в заведении.' },
      { q: 'Что будет с моими данными? Можно ли отказаться?', a: 'Мы используем ваши данные, чтобы присылать новости о запуске и предложения, как описано в Политике конфиденциальности. Отказаться можно в любой момент, написав на contact@golandly.com.' },
    ],
    rights: 'Все права защищены.',
    contactLabel: 'Написать нам',
    successTitle: 'Готово, {name}!',
    successSub: 'Ваше место забронировано. Мы напишем вам, когда GoLandly запустится 1 января 2027 года.',
    communityTitle: 'Вступайте в сообщество GoLandly в WhatsApp',
    communityBody: 'Получайте объявления о запуске напрямую, знакомьтесь с другими новичками и узнавайте новости первыми.',
    communityCta: 'Вступить в сообщество',
    shareTitle: 'Знаете, кому это пригодится? Поделитесь с друзьями',
    shareWhatsApp: 'Поделиться в WhatsApp',
    shareMore: 'Поделиться иначе',
    copyLink: 'Скопировать ссылку',
    copied: 'Ссылка скопирована',
    linkLabel: 'Ваша ссылка',
    notYou: 'Зарегистрировать другого человека на этом устройстве',
    shareText: 'GoLandly запускается 1 января 2027 года: местные скидки для тех, кто недавно в Израиле. Забронируйте место:',
  },
  fr: {
    metaTitle: 'GoLandly | Bons plans locaux pour les nouveaux en Israël',
    metaDescription: 'Des bons plans et des bons d’achat locaux pour les nouveaux arrivants en Israël. Inscription gratuite. Lancement le 1er janvier 2027. Réservez votre place.',
    cardLines: ['Bons plans et bons d’achat', 'pour les nouveaux en Israël'],
    languageLabel: 'Langue',
    heroTitle: 'Des bons plans et bons d’achat locaux pour les nouveaux arrivants en Israël',
    heroSub: 'Inscription gratuite. Lancement le 1er janvier 2027',
    heroCta: 'Réserver ma place',
    dealsBadge: 'De vrais bons plans locaux',
    launchDate: 'Lancement le 1er janvier 2027',
    countdownLabel: 'Temps restant avant le lancement',
    units: { days: 'Jours', hours: 'Heures', minutes: 'Minutes', seconds: 'Secondes' },
    photoAlts: {
      restaurants: 'Une salle de restaurant à la lumière chaleureuse',
      beach: 'Une plage de sable au coucher du soleil',
      sport: 'Une salle de sport moderne avec des rangées d’haltères',
      attractions: 'Un manège coloré de fête foraine',
      pampering: 'Un massage relaxant dans un spa',
      fashion: 'Une boutique de vêtements bien rangée',
      cars: 'Un conducteur au volant au crépuscule',
      kids: 'Un tout-petit qui joue sur un tapis blanc',
    },
    pillarsTitle: 'Qu’est-ce que GoLandly ?',
    pillars: {
      deals: { title: 'Bons plans et bons d’achat', body: 'Des réductions et des bons dans les restaurants, salles de sport, boutiques et autres commerces locaux.' },
      free: { title: 'Inscription gratuite', body: 'L’inscription ne coûte rien. Réservez votre place, nous nous occupons du reste.' },
      newcomers: { title: 'Pensé pour les nouveaux', body: 'Pour les nouveaux Olim, les soldats isolés et les étudiants qui prennent leurs marques en Israël.' },
    },
    stepsTitle: 'Comment ça marche',
    steps: [
      { title: 'Laissez vos coordonnées', body: 'Votre prénom, votre numéro WhatsApp et votre e-mail. Moins d’une minute suffit.' },
      { title: 'Recevez le message du lancement', body: 'Nous vous préviendrons sur WhatsApp et par e-mail dès que GoLandly sera en ligne.' },
      { title: 'Profitez des bons plans', body: 'Choisissez une offre, présentez-la au commerce et profitez-en.' },
    ],
    signupTitle: 'Réservez votre place',
    signupSub: 'Laissez vos coordonnées et soyez parmi les premiers informés du lancement de GoLandly, le 1er janvier 2027.',
    firstName: 'Prénom',
    lastName: 'Nom',
    phone: 'Numéro WhatsApp',
    email: 'E-mail',
    emailPlaceholder: 'nom@email.com',
    countrySelect: 'Choisir un indicatif pays',
    personaLabel: 'Qui êtes-vous ? (facultatif)',
    personaPlaceholder: 'Choisissez',
    personas: { new_oleh: 'Nouvel Oleh (0–5 ans)', veteran_oleh: 'Oleh de longue date (5+ ans)', lone_soldier: 'Soldat isolé', student: 'Étudiant', local: 'Habitant', other: 'Autre' },
    personaOtherLabel: 'Dites-nous en plus (facultatif)',
    personaOtherPlaceholder: 'Ce qui vous amène en Israël...',
    preferredLanguageLabel: 'Langue préférée pour nos messages',
    referralLabel: 'Comment nous avez-vous connus ? (facultatif)',
    referralPlaceholder: 'Choisissez',
    referralSources: { instagram: '📸 Instagram', facebook: '📘 Facebook', friend: '👥 Ami / bouche-à-oreille', tiktok: '🎵 TikTok', google: '🔍 Recherche Google', whatsapp: '💬 Communauté / groupe WhatsApp', other: '🌐 Autre' },
    consent: 'J’accepte de recevoir de GoLandly des messages promotionnels par WhatsApp et par e-mail : l’annonce du lancement, les nouvelles offres et les actualités associées. Je peux me désinscrire à tout moment.',
    legal: 'En vous inscrivant, vous acceptez les {terms} et la {privacy}.',
    terms: 'Conditions d’utilisation',
    privacy: 'Politique de confidentialité',
    submit: 'Réserver ma place',
    submitting: 'Envoi…',
    errName: 'Saisissez votre prénom.',
    errLastName: 'Saisissez votre nom.',
    errPhone: 'Saisissez un numéro WhatsApp valide.',
    errEmail: 'Saisissez une adresse e-mail valide.',
    errConsent: 'Pour vous inscrire, veuillez accepter de recevoir nos actualités.',
    errRateLimited: 'Trop de tentatives. Réessayez dans quelques minutes.',
    errGeneric: 'Une erreur s’est produite. Vos informations sont toujours là, réessayez.',
    followTitle: 'Suivez GoLandly',
    followSub: 'Les nouvelles offres et les actualités du lancement, là où vous êtes déjà.',
    followLabels: { instagram: 'Suivre sur Instagram', facebook: 'Suivre sur Facebook', whatsapp: 'Rejoindre sur WhatsApp' },
    newTab: 's’ouvre dans un nouvel onglet',
    storyTitle: 'Notre histoire',
    storyBody: 'GoLandly a été créé par deux réservistes israéliens qui veulent aider les nouveaux arrivants à prendre leurs marques et à découvrir d’excellents commerces locaux.',
    foundingTitle: 'Membres fondateurs',
    foundingNumber: '1 000',
    foundingBody: 'Les 1 000 premiers membres obtiennent le statut de membre fondateur et un accès en avant-première à chaque nouvelle offre.',
    faqTitle: 'Questions',
    faq: [
      { q: 'L’inscription à GoLandly est-elle gratuite ?', a: 'Oui. L’inscription à GoLandly est gratuite.' },
      { q: 'Quand GoLandly sera-t-il lancé ?', a: 'GoLandly sera lancé le 1er janvier 2027. Toutes les personnes qui ont réservé une place recevront un message le jour du lancement.' },
      { q: 'À qui s’adresse GoLandly ?', a: 'Aux nouveaux arrivants en Israël : nouveaux Olim, soldats isolés et étudiants. Les habitants sont aussi les bienvenus.' },
      { q: 'Comment fonctionnent les offres ?', a: 'Des commerces locaux proposent des bons plans et des bons d’achat sur GoLandly. Vous en choisissez un et vous l’utilisez sur place.' },
      { q: 'Que deviennent mes données ? Puis-je me désinscrire ?', a: 'Nous utilisons vos données pour vous envoyer les nouvelles du lancement et les offres, comme le décrit notre Politique de confidentialité. Vous pouvez vous désinscrire à tout moment en écrivant à contact@golandly.com.' },
    ],
    rights: 'Tous droits réservés.',
    contactLabel: 'Nous écrire',
    successTitle: 'C’est fait, {name} !',
    successSub: 'Votre place est réservée. Nous vous écrirons au lancement de GoLandly, le 1er janvier 2027.',
    communityTitle: 'Rejoignez la communauté WhatsApp de GoLandly',
    communityBody: 'Recevez directement les annonces du lancement, rencontrez d’autres nouveaux arrivants et suivez les nouveautés en temps réel.',
    communityCta: 'Rejoindre la communauté',
    shareTitle: 'Vous connaissez quelqu’un que ça intéresserait ? Partagez avec vos amis',
    shareWhatsApp: 'Partager sur WhatsApp',
    shareMore: 'Partager autrement',
    copyLink: 'Copier le lien',
    copied: 'Lien copié',
    linkLabel: 'Votre lien',
    notYou: 'Inscrire une autre personne sur cet appareil',
    shareText: 'GoLandly sera lancé le 1er janvier 2027, avec des bons plans locaux pour les nouveaux arrivants en Israël. Réservez votre place :',
  },
  es: {
    metaTitle: 'GoLandly | Ofertas locales para recién llegados a Israel',
    metaDescription: 'Ofertas y cupones locales para recién llegados a Israel. Unirse es gratis. Lanzamiento el 1 de enero de 2027. Reserva tu lugar.',
    cardLines: ['Ofertas y cupones locales', 'para recién llegados a Israel'],
    languageLabel: 'Idioma',
    heroTitle: 'Ofertas y cupones locales para recién llegados a Israel',
    heroSub: 'Unirse es gratis. Lanzamiento el 1 de enero de 2027',
    heroCta: 'Guardar mi lugar',
    dealsBadge: 'Ofertas locales reales',
    launchDate: 'Lanzamiento el 1 de enero de 2027',
    countdownLabel: 'Tiempo hasta el lanzamiento',
    units: { days: 'Días', hours: 'Horas', minutes: 'Minutos', seconds: 'Segundos' },
    photoAlts: {
      restaurants: 'Un comedor de restaurante con luz cálida',
      beach: 'Una playa de arena al atardecer',
      sport: 'Un gimnasio moderno con filas de mancuernas',
      attractions: 'Un colorido carrusel de feria',
      pampering: 'Un masaje relajante en un spa',
      fashion: 'Una boutique de ropa ordenada',
      cars: 'Un conductor al volante al anochecer',
      kids: 'Un niño pequeño jugando sobre una alfombra blanca',
    },
    pillarsTitle: '¿Qué es GoLandly?',
    pillars: {
      deals: { title: 'Ofertas y cupones', body: 'Descuentos y cupones en restaurantes, gimnasios, tiendas y otros comercios locales.' },
      free: { title: 'Unirse es gratis', body: 'Registrarte no cuesta nada. Guarda tu lugar y nosotros nos encargamos del resto.' },
      newcomers: { title: 'Hecho para recién llegados', body: 'Para nuevos Olim, soldados solitarios y estudiantes que están haciendo su vida en Israel.' },
    },
    stepsTitle: 'Cómo funciona',
    steps: [
      { title: 'Deja tus datos', body: 'Tu nombre, número de WhatsApp y correo. Te llevará menos de un minuto.' },
      { title: 'Recibe el mensaje del lanzamiento', body: 'Te avisaremos por WhatsApp y por correo en cuanto GoLandly esté disponible.' },
      { title: 'Empieza a usar las ofertas', body: 'Elige una oferta, muéstrala en el comercio y disfruta.' },
    ],
    signupTitle: 'Guarda tu lugar',
    signupSub: 'Deja tus datos y sé de los primeros en enterarte cuando GoLandly se lance el 1 de enero de 2027.',
    firstName: 'Nombre',
    lastName: 'Apellido',
    phone: 'Número de WhatsApp',
    email: 'Correo electrónico',
    emailPlaceholder: 'nombre@email.com',
    countrySelect: 'Elige un código de país',
    personaLabel: '¿Qué te describe? (opcional)',
    personaPlaceholder: 'Elige una opción',
    personas: { new_oleh: 'Nuevo Olé (0–5 años)', veteran_oleh: 'Olé veterano (5+ años)', lone_soldier: 'Soldado solitario', student: 'Estudiante', local: 'Residente', other: 'Otro' },
    personaOtherLabel: 'Cuéntanos más (opcional)',
    personaOtherPlaceholder: 'Cuéntanos qué te trae a Israel...',
    preferredLanguageLabel: 'Idioma preferido para las novedades',
    referralLabel: '¿Cómo nos conociste? (opcional)',
    referralPlaceholder: 'Elige una opción',
    referralSources: { instagram: '📸 Instagram', facebook: '📘 Facebook', friend: '👥 Amigo / recomendación', tiktok: '🎵 TikTok', google: '🔍 Búsqueda en Google', whatsapp: '💬 Comunidad / grupo de WhatsApp', other: '🌐 Otro' },
    consent: 'Acepto recibir de GoLandly mensajes promocionales por WhatsApp y correo electrónico: el anuncio del lanzamiento, nuevas ofertas y noticias relacionadas. Puedo darme de baja en cualquier momento.',
    legal: 'Al registrarte aceptas los {terms} y la {privacy}.',
    terms: 'Términos de uso',
    privacy: 'Política de privacidad',
    submit: 'Reservar mi lugar',
    submitting: 'Enviando…',
    errName: 'Escribe tu nombre.',
    errLastName: 'Escribe tu apellido.',
    errPhone: 'Escribe un número de WhatsApp válido.',
    errEmail: 'Escribe un correo electrónico válido.',
    errConsent: 'Para registrarte, acepta recibir novedades.',
    errRateLimited: 'Demasiados intentos. Vuelve a intentarlo en unos minutos.',
    errGeneric: 'Algo salió mal. Tus datos siguen aquí, inténtalo de nuevo.',
    followTitle: 'Sigue a GoLandly',
    followSub: 'Nuevas ofertas y noticias del lanzamiento donde ya estás.',
    followLabels: { instagram: 'Seguir en Instagram', facebook: 'Seguir en Facebook', whatsapp: 'Unirse en WhatsApp' },
    newTab: 'se abre en una pestaña nueva',
    storyTitle: 'Nuestra historia',
    storyBody: 'GoLandly fue creado por dos reservistas israelíes que quieren ayudar a los recién llegados a encontrar su lugar y a descubrir grandes comercios locales.',
    foundingTitle: 'Miembros fundadores',
    foundingNumber: '1.000',
    foundingBody: 'Los primeros 1.000 miembros obtienen el estatus de Miembro Fundador y el primer acceso a cada nueva oferta.',
    faqTitle: 'Preguntas',
    faq: [
      { q: '¿Unirse a GoLandly es gratis?', a: 'Sí. Unirse a GoLandly es gratis.' },
      { q: '¿Cuándo se lanza GoLandly?', a: 'GoLandly se lanza el 1 de enero de 2027. Todos los que hayan guardado su lugar recibirán un mensaje el día del lanzamiento.' },
      { q: '¿Para quién es GoLandly?', a: 'Para quienes acaban de llegar a Israel: nuevos Olim, soldados solitarios y estudiantes. Los residentes también son bienvenidos.' },
      { q: '¿Cómo funcionan las ofertas?', a: 'Los comercios locales publican ofertas y cupones en GoLandly. Eliges uno y lo canjeas en el comercio.' },
      { q: '¿Qué pasa con mis datos? ¿Puedo darme de baja?', a: 'Usamos tus datos para enviarte noticias del lanzamiento y ofertas, como se describe en nuestra Política de privacidad. Puedes darte de baja en cualquier momento escribiendo a contact@golandly.com.' },
    ],
    rights: 'Todos los derechos reservados.',
    contactLabel: 'Escríbenos',
    successTitle: '¡Listo, {name}!',
    successSub: 'Tu lugar está guardado. Te escribiremos cuando GoLandly se lance el 1 de enero de 2027.',
    communityTitle: 'Únete a la comunidad de WhatsApp de GoLandly',
    communityBody: 'Recibe los anuncios del lanzamiento directamente, conoce a otros recién llegados y entérate de las novedades al instante.',
    communityCta: 'Unirme a la comunidad',
    shareTitle: '¿Conoces a alguien a quien le interese? Compártelo con tus amigos',
    shareWhatsApp: 'Compartir en WhatsApp',
    shareMore: 'Compartir de otra forma',
    copyLink: 'Copiar enlace',
    copied: 'Enlace copiado',
    linkLabel: 'Tu enlace',
    notYou: 'Registrar a otra persona en este dispositivo',
    shareText: 'GoLandly se lanza el 1 de enero de 2027 con ofertas locales para recién llegados a Israel. Guarda tu lugar:',
  },
}
