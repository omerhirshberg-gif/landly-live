// The ready-to-use campaigns offered at the top of the newsletter composer:
// each fills the subject, headline, message and button for the chosen
// language, ready to edit. Plain data with no server imports, so the admin
// page and the tests share it. {firstName} is the recipient's first name
// (left out cleanly when unknown). Links are fixed to golandly.com.

import type { NewsletterLang } from './unsubscribeCopy'

export const TEMPLATE_IDS = ['perks', 'community', 'welcome', 'blank'] as const
export type TemplateId = (typeof TEMPLATE_IDS)[number]

export interface TemplateContent {
  subject: string
  headline: string
  body: string
  ctaLabel: string
  ctaUrl: string
}

const SITE = 'https://golandly.com'
const BLANK: TemplateContent = { subject: '', headline: '', body: '', ctaLabel: '', ctaUrl: '' }

const PERKS: Record<NewsletterLang, TemplateContent> = {
  en: {
    subject: 'New perks in your area this week',
    headline: 'New perks this week',
    body: 'Hi {firstName},\n\nWe added fresh local deals this week, from cafes and restaurants to services you use every day. Your GoLandly pass already works for all of them.\n\nTake a minute to see what is new and save on your next outing.',
    ctaLabel: 'See the new perks',
    ctaUrl: `${SITE}/categories`,
  },
  he: {
    subject: 'הטבות חדשות השבוע, במיוחד בשבילכם',
    headline: 'הטבות חדשות השבוע',
    body: 'היי {firstName},\n\nהוספנו השבוע הטבות מקומיות חדשות, מבתי קפה ומסעדות ועד שירותים שאתם משתמשים בהם כל יום. כרטיס GoLandly שלכם כבר פועל בכולן.\n\nהקדישו דקה לראות מה חדש ולחסוך ביציאה הבאה.',
    ctaLabel: 'לצפייה בהטבות החדשות',
    ctaUrl: `${SITE}/categories`,
  },
  ru: {
    subject: 'Новые предложения этой недели',
    headline: 'Новые предложения недели',
    body: 'Здравствуйте, {firstName}!\n\nНа этой неделе мы добавили новые местные предложения: от кафе и ресторанов до услуг, которыми вы пользуетесь каждый день. Ваш пропуск GoLandly уже работает во всех из них.\n\nЗагляните, что нового, и сэкономьте в следующий раз.',
    ctaLabel: 'Смотреть новые предложения',
    ctaUrl: `${SITE}/categories`,
  },
  fr: {
    subject: 'Les nouveaux avantages de la semaine',
    headline: 'Nouveaux avantages cette semaine',
    body: 'Bonjour {firstName},\n\nCette semaine, nous avons ajouté de nouvelles offres locales, des cafés et restaurants aux services que vous utilisez chaque jour. Votre pass GoLandly fonctionne déjà pour toutes.\n\nPrenez une minute pour découvrir les nouveautés et économiser lors de votre prochaine sortie.',
    ctaLabel: 'Voir les nouveaux avantages',
    ctaUrl: `${SITE}/categories`,
  },
  es: {
    subject: 'Nuevos beneficios esta semana',
    headline: 'Nuevos beneficios esta semana',
    body: 'Hola {firstName},\n\nEsta semana añadimos nuevas ofertas locales, desde cafés y restaurantes hasta servicios que usas cada día. Tu pase de GoLandly ya funciona en todas.\n\nDedica un minuto a ver las novedades y ahorra en tu próxima salida.',
    ctaLabel: 'Ver los nuevos beneficios',
    ctaUrl: `${SITE}/categories`,
  },
}

const COMMUNITY: Record<NewsletterLang, TemplateContent> = {
  en: {
    subject: 'A GoLandly community update',
    headline: 'Thank you for being part of GoLandly',
    body: 'Hi {firstName},\n\nGoLandly is growing, and it is thanks to people like you. Every week more local businesses join, more members save, and the community gets stronger.\n\nHere is what is next: more partner perks across Israel, new ways to use your pass, and more updates from us. We would love to hear what you want to see, just reply to this email.\n\nCome and take a look at what is new.',
    ctaLabel: 'Explore GoLandly',
    ctaUrl: SITE,
  },
  he: {
    subject: 'עדכון מקהילת GoLandly',
    headline: 'תודה שאתם חלק מ-GoLandly',
    body: 'היי {firstName},\n\nGoLandly גדלה, וזה בזכות אנשים כמוכם. בכל שבוע מצטרפים עוד עסקים מקומיים, עוד חברים חוסכים והקהילה מתחזקת.\n\nמה בהמשך: עוד הטבות של עסקים שותפים ברחבי ישראל, דרכים חדשות להשתמש בכרטיס שלכם ועוד עדכונים מאיתנו. נשמח לשמוע מה הייתם רוצים לראות, פשוט השיבו למייל הזה.\n\nבואו להציץ במה שחדש.',
    ctaLabel: 'לגלות את GoLandly',
    ctaUrl: SITE,
  },
  ru: {
    subject: 'Новости сообщества GoLandly',
    headline: 'Спасибо, что вы с GoLandly',
    body: 'Здравствуйте, {firstName}!\n\nGoLandly растёт, и это благодаря таким людям, как вы. Каждую неделю к нам присоединяются новые местные компании, всё больше участников экономят, а сообщество становится сильнее.\n\nЧто дальше: больше предложений от партнёров по всему Израилю, новые способы использовать ваш пропуск и новости от нас. Нам важно знать, что вы хотите видеть: просто ответьте на это письмо.\n\nЗагляните, что нового.',
    ctaLabel: 'Открыть GoLandly',
    ctaUrl: SITE,
  },
  fr: {
    subject: 'Des nouvelles de la communauté GoLandly',
    headline: 'Merci de faire partie de GoLandly',
    body: "Bonjour {firstName},\n\nGoLandly grandit, et c'est grâce à des personnes comme vous. Chaque semaine, de nouveaux commerces locaux nous rejoignent, plus de membres économisent et la communauté se renforce.\n\nLa suite : davantage d'avantages chez nos partenaires partout en Israël, de nouvelles façons d'utiliser votre pass et d'autres nouvelles de notre part. Dites-nous ce que vous aimeriez voir, il suffit de répondre à cet e-mail.\n\nVenez découvrir les nouveautés.",
    ctaLabel: 'Découvrir GoLandly',
    ctaUrl: SITE,
  },
  es: {
    subject: 'Novedades de la comunidad GoLandly',
    headline: 'Gracias por ser parte de GoLandly',
    body: 'Hola {firstName},\n\nGoLandly crece, y es gracias a personas como tú. Cada semana se suman más negocios locales, más miembros ahorran y la comunidad se hace más fuerte.\n\nLo que viene: más beneficios de negocios aliados en todo Israel, nuevas formas de usar tu pase y más novedades de nuestra parte. Nos encantaría saber qué quieres ver, solo responde a este correo.\n\nPasa a ver las novedades.',
    ctaLabel: 'Explorar GoLandly',
    ctaUrl: SITE,
  },
}

const WELCOME: Record<NewsletterLang, TemplateContent> = {
  en: {
    subject: 'Getting started on GoLandly',
    headline: 'Make the most of GoLandly',
    body: 'Hi {firstName},\n\nHere is how to get the most out of your membership:\n\n1. Browse the perks and pick a deal you like.\n2. Claim the voucher in a couple of taps.\n3. Add your pass to Apple Wallet or Google Wallet, and show it at the counter.\n\nThat is it. Your first saving is a few taps away.',
    ctaLabel: 'Browse the perks',
    ctaUrl: `${SITE}/offers`,
  },
  he: {
    subject: 'איך מתחילים עם GoLandly',
    headline: 'להפיק את המקסימום מ-GoLandly',
    body: 'היי {firstName},\n\nכך תפיקו את המירב מהחברות שלכם:\n\n1. עיינו בהטבות ובחרו הטבה שמתאימה לכם.\n2. קבלו את השובר בכמה הקשות.\n3. הוסיפו את הכרטיס ל-Apple Wallet או ל-Google Wallet והציגו אותו בקופה.\n\nזהו. החיסכון הראשון שלכם במרחק כמה הקשות.',
    ctaLabel: 'לעיון בהטבות',
    ctaUrl: `${SITE}/offers`,
  },
  ru: {
    subject: 'Как начать пользоваться GoLandly',
    headline: 'Получите максимум от GoLandly',
    body: 'Здравствуйте, {firstName}!\n\nКак получить максимум от вашего членства:\n\n1. Просмотрите предложения и выберите понравившееся.\n2. Получите ваучер в пару касаний.\n3. Добавьте пропуск в Apple Wallet или Google Wallet и покажите его на кассе.\n\nВот и всё. Первая экономия уже в нескольких касаниях от вас.',
    ctaLabel: 'Смотреть предложения',
    ctaUrl: `${SITE}/offers`,
  },
  fr: {
    subject: 'Bien démarrer avec GoLandly',
    headline: 'Profitez au maximum de GoLandly',
    body: "Bonjour {firstName},\n\nVoici comment profiter au maximum de votre adhésion :\n\n1. Parcourez les avantages et choisissez une offre qui vous plaît.\n2. Récupérez le bon en quelques appuis.\n3. Ajoutez votre pass à Apple Wallet ou Google Wallet et présentez-le en caisse.\n\nC'est tout. Votre première économie est à quelques appuis.",
    ctaLabel: 'Parcourir les avantages',
    ctaUrl: `${SITE}/offers`,
  },
  es: {
    subject: 'Cómo empezar con GoLandly',
    headline: 'Aprovecha GoLandly al máximo',
    body: 'Hola {firstName},\n\nAsí puedes aprovechar al máximo tu membresía:\n\n1. Explora los beneficios y elige una oferta que te guste.\n2. Obtén el cupón con un par de toques.\n3. Añade tu pase a Apple Wallet o Google Wallet y muéstralo en caja.\n\nEso es todo. Tu primer ahorro está a unos toques.',
    ctaLabel: 'Explorar beneficios',
    ctaUrl: `${SITE}/offers`,
  },
}

const BY_ID: Record<Exclude<TemplateId, 'blank'>, Record<NewsletterLang, TemplateContent>> = { perks: PERKS, community: COMMUNITY, welcome: WELCOME }

/** One template's text in `lang`; the blank one is empty in every language. */
export function templateContent(id: TemplateId, lang: NewsletterLang): TemplateContent {
  return id === 'blank' ? { ...BLANK } : { ...BY_ID[id][lang] }
}

/** The language a template is written in: the audience's language filter, else the admin's own. */
export function templateLang(audienceLang: 'all' | NewsletterLang, adminLocale: 'en' | 'he'): NewsletterLang {
  return audienceLang === 'all' ? adminLocale : audienceLang
}
