import 'server-only'
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { PRODUCTION_API_ORIGIN } from '@/lib/apiOrigin'
import { SUPPORT_EMAIL } from '@/lib/config'
import { EMAIL_LOGO_URL, FONT_STACK, emailConfigProblem, escapeHtml, getResend } from '@/lib/email/brandedEmail'
import { RTL_LANGS, translations, type Lang } from '@/lib/i18n/translations'
import { FACEBOOK_URL, INSTAGRAM_URL, LINKEDIN_URL } from '@/lib/prelaunch/links'
import { LEADS_COLLECTION } from '@/lib/prelaunch/leads.server'

// The one confirmation a new /join lead gets, in the language they signed up in.
// It has its own renderer because renderBrandedEmail's shell has no social row.
// Runs after the response, so it can neither slow nor fail a sign-up.
// email-templates/waitlist-welcome.html is the English output, kept in step by
// tests/unit/waitlistWelcomeEmail.test.ts.

interface WelcomeCopy {
  subject: string
  preheader: string
  tagline: string
  headline: string
  greeting: string
  intro: string
  perksTitle: string
  perks: [{ title: string; body: string }, { title: string; body: string }, { title: string; body: string }]
  /** {date} becomes launchDate, in bold. */
  launch: string
  launchDate: string
  whatsappIntro: string
  cta: string
  socialTitle: string
  /** {network} becomes the network's name, as the icon's tooltip. */
  socialTooltip: string
  signoff: string
  team: string
  reason: string
  help: string
  optOut: string
}

export const WAITLIST_WELCOME_COPY: Record<Lang, WelcomeCopy> = {
  en: {
    subject: 'Welcome to the Landly Waitlist',
    preheader: 'Your spot is saved. Landly opens on January 1, 2027.',
    tagline: 'Local Lifestyle & Exclusive Perks',
    headline: "You're on the list! 🎉",
    greeting: 'Hi {name},',
    intro: 'Thank you for joining the Landly waitlist! We built Landly to connect our community with the very best local businesses across Israel, with genuine everyday savings and curated lifestyle experiences.',
    perksTitle: 'What you can look forward to at launch:',
    perks: [
      { title: 'Early Priority Access', body: 'Be the first to explore and claim new partner deals as soon as we open.' },
      { title: 'Curated Local Perks', body: 'Verified member discounts and special offers at premier spots nationwide.' },
      { title: 'Community-Driven', body: 'Suggest and vote on the local neighborhood spots you want to see included.' },
    ],
    launch: 'We are working continuously to connect new local partners ahead of our official opening on {date}.',
    launchDate: 'January 1, 2027',
    whatsappIntro: 'Want early updates, behind-the-scenes previews and community announcements? Join our official, quiet WhatsApp group:',
    cta: 'Join Our WhatsApp Community',
    socialTitle: 'Follow Landly',
    socialTooltip: 'Landly on {network}',
    signoff: 'Best regards,',
    team: 'The Landly Team',
    reason: 'You are receiving this one-time confirmation because you joined the waitlist at golandly.com.',
    help: 'Questions? Reply to this email or reach us at',
    optOut: 'To be removed from the waitlist, reply with "unsubscribe" or write to us at',
  },
  he: {
    subject: 'ברוכים הבאים לרשימת ההמתנה של Landly',
    preheader: 'המקום שלכם שמור. Landly נפתחת ב-1 בינואר 2027.',
    tagline: 'לייפסטייל מקומי והטבות בלעדיות',
    headline: 'אתם ברשימה! 🎉',
    greeting: 'היי {name},',
    intro: 'תודה שהצטרפתם לרשימת ההמתנה של Landly! בנינו את Landly כדי לחבר את הקהילה שלנו לעסקים המקומיים הטובים בישראל, עם חיסכון אמיתי ביומיום וחוויות לייפסטייל שנבחרו בקפידה.',
    perksTitle: 'למה אפשר לצפות בהשקה:',
    perks: [
      { title: 'גישה מוקדמת', body: 'תהיו הראשונים לגלות ולממש הטבות חדשות מהשותפים שלנו ברגע שנפתח.' },
      { title: 'הטבות מקומיות נבחרות', body: 'הנחות מאומתות לחברים והצעות מיוחדות במקומות מובילים בכל הארץ.' },
      { title: 'מונעים על ידי הקהילה', body: 'הציעו והצביעו על המקומות בשכונה שהייתם רוצים לראות אצלנו.' },
    ],
    launch: 'אנחנו ממשיכים לצרף שותפים מקומיים חדשים לקראת הפתיחה הרשמית ב-{date}.',
    launchDate: '1 בינואר 2027',
    whatsappIntro: 'רוצים עדכונים מוקדמים, הצצה מאחורי הקלעים והודעות לקהילה? הצטרפו לקבוצת הוואטסאפ הרשמית והשקטה שלנו:',
    cta: 'הצטרפו לקהילת הוואטסאפ',
    socialTitle: 'עקבו אחרי Landly',
    socialTooltip: 'Landly ב-{network}',
    signoff: 'בברכה,',
    team: 'צוות Landly',
    reason: 'קיבלתם את האישור החד-פעמי הזה כי הצטרפתם לרשימת ההמתנה באתר golandly.com.',
    help: 'יש שאלות? השיבו למייל הזה או כתבו לנו אל',
    optOut: 'להסרה מרשימת ההמתנה, השיבו למייל הזה עם המילה "unsubscribe" או כתבו לנו אל',
  },
  ru: {
    subject: 'Добро пожаловать в лист ожидания Landly',
    preheader: 'Ваше место закреплено. Landly открывается 1 января 2027 года.',
    tagline: 'Местная жизнь и эксклюзивные привилегии',
    headline: 'Вы в списке! 🎉',
    greeting: 'Здравствуйте, {name}!',
    intro: 'Спасибо, что присоединились к листу ожидания Landly! Мы создали Landly, чтобы связать наше сообщество с лучшими местными бизнесами Израиля: реальная экономия каждый день и тщательно отобранные впечатления.',
    perksTitle: 'Что ждёт вас на старте:',
    perks: [
      { title: 'Ранний приоритетный доступ', body: 'Первыми открывайте и получайте новые предложения партнёров сразу после открытия.' },
      { title: 'Отобранные местные привилегии', body: 'Проверенные скидки для участников и специальные предложения в лучших местах по всей стране.' },
      { title: 'Решает сообщество', body: 'Предлагайте местные заведения, которые хотите видеть у нас, и голосуйте за них.' },
    ],
    launch: 'Мы продолжаем подключать новых местных партнёров в преддверии официального открытия {date}.',
    launchDate: '1 января 2027 года',
    whatsappIntro: 'Хотите получать ранние новости, закулисные превью и объявления сообщества? Присоединяйтесь к нашей официальной тихой группе в WhatsApp:',
    cta: 'Вступить в сообщество WhatsApp',
    socialTitle: 'Следите за Landly',
    socialTooltip: 'Landly в {network}',
    signoff: 'С наилучшими пожеланиями,',
    team: 'Команда Landly',
    reason: 'Вы получили это разовое подтверждение, потому что присоединились к листу ожидания на golandly.com.',
    help: 'Есть вопросы? Ответьте на это письмо или напишите нам на',
    optOut: 'Чтобы вас удалили из листа ожидания, ответьте на письмо словом «unsubscribe» или напишите нам на',
  },
  fr: {
    subject: "Bienvenue sur la liste d'attente Landly",
    preheader: 'Votre place est réservée. Landly ouvre le 1er janvier 2027.',
    tagline: 'Art de vivre local et avantages exclusifs',
    headline: 'Vous êtes sur la liste ! 🎉',
    greeting: 'Bonjour {name},',
    intro: "Merci d'avoir rejoint la liste d'attente Landly ! Nous avons créé Landly pour relier notre communauté aux meilleurs commerces locaux d'Israël, avec de vraies économies au quotidien et des expériences soigneusement sélectionnées.",
    perksTitle: 'Ce qui vous attend au lancement :',
    perks: [
      { title: 'Accès prioritaire', body: "Soyez les premiers à découvrir et à profiter des offres de nos partenaires dès l'ouverture." },
      { title: 'Avantages locaux sélectionnés', body: 'Des réductions vérifiées pour les membres et des offres spéciales dans les meilleures adresses du pays.' },
      { title: 'Guidé par la communauté', body: 'Proposez les adresses de votre quartier que vous aimeriez voir chez nous et votez pour elles.' },
    ],
    launch: "Nous continuons à accueillir de nouveaux partenaires locaux avant notre ouverture officielle le {date}.",
    launchDate: '1er janvier 2027',
    whatsappIntro: 'Envie de nouvelles en avant-première, de coulisses et des annonces de la communauté ? Rejoignez notre groupe WhatsApp officiel et discret :',
    cta: 'Rejoindre la communauté WhatsApp',
    socialTitle: 'Suivez Landly',
    socialTooltip: 'Landly sur {network}',
    signoff: 'Cordialement,',
    team: "L'équipe Landly",
    reason: "Vous recevez cette confirmation unique car vous avez rejoint la liste d'attente sur golandly.com.",
    help: 'Des questions ? Répondez à cet e-mail ou écrivez-nous à',
    optOut: "Pour être retiré de la liste d'attente, répondez « unsubscribe » ou écrivez-nous à",
  },
  es: {
    subject: 'Te damos la bienvenida a la lista de espera de Landly',
    preheader: 'Tu lugar está reservado. Landly abre el 1 de enero de 2027.',
    tagline: 'Estilo de vida local y ventajas exclusivas',
    headline: '¡Ya estás en la lista! 🎉',
    greeting: 'Hola, {name}:',
    intro: '¡Gracias por unirte a la lista de espera de Landly! Creamos Landly para conectar a nuestra comunidad con los mejores negocios locales de Israel, con ahorros reales en el día a día y experiencias cuidadosamente seleccionadas.',
    perksTitle: 'Lo que te espera en el lanzamiento:',
    perks: [
      { title: 'Acceso prioritario', body: 'Sé de los primeros en descubrir y aprovechar las ofertas de nuestros socios en cuanto abramos.' },
      { title: 'Ventajas locales seleccionadas', body: 'Descuentos verificados para miembros y ofertas especiales en los mejores lugares del país.' },
      { title: 'Impulsado por la comunidad', body: 'Propón y vota los lugares de tu barrio que te gustaría ver incluidos.' },
    ],
    launch: 'Seguimos sumando nuevos socios locales de cara a nuestra apertura oficial el {date}.',
    launchDate: '1 de enero de 2027',
    whatsappIntro: '¿Quieres novedades anticipadas, avances exclusivos y anuncios de la comunidad? Únete a nuestro grupo oficial y tranquilo de WhatsApp:',
    cta: 'Unirme a la comunidad de WhatsApp',
    socialTitle: 'Sigue a Landly',
    socialTooltip: 'Landly en {network}',
    signoff: 'Un saludo,',
    team: 'El equipo de Landly',
    reason: 'Recibes esta confirmación única porque te uniste a la lista de espera en golandly.com.',
    help: '¿Tienes preguntas? Responde a este correo o escríbenos a',
    optOut: 'Para salir de la lista de espera, responde con la palabra "unsubscribe" o escríbenos a',
  },
}

// Always the production address, as with the logo: mail proxies can't reach localhost.
const WHATSAPP_REDIRECT_URL = `${PRODUCTION_API_ORIGIN}/whatsapp`
const SOCIALS = [
  { name: 'Instagram', href: INSTAGRAM_URL, icon: 'instagram' },
  { name: 'LinkedIn', href: LINKEDIN_URL, icon: 'linkedin' },
  { name: 'WhatsApp', href: WHATSAPP_REDIRECT_URL, icon: 'whatsapp' },
  { name: 'Facebook', href: FACEBOOK_URL, icon: 'facebook' },
] as const

// Tables and inline styles only. The name sits in a span rather than <bdi>,
// which mail clients don't all honour, so a Latin name in a Hebrew sentence (or
// the reverse) keeps its own direction. The icons carry an empty alt because
// the label under each one already names it, with images on or off.
export function renderWaitlistWelcomeEmail(lang: Lang, firstName: string): string {
  const c = WAITLIST_WELCOME_COPY[lang]
  const t = translations[lang]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  const dir = isRtl ? 'rtl' : 'ltr'
  const align = isRtl ? 'right' : 'left'
  const startBorder = isRtl ? 'border-right' : 'border-left'
  const whatsapp = escapeHtml(WHATSAPP_REDIRECT_URL)
  const name = `<span dir="auto" style="unicode-bidi:isolate;">${escapeHtml(firstName)}</span>`
  const greeting = escapeHtml(c.greeting).replace('{name}', () => name)
  const launch = escapeHtml(c.launch).replace('{date}', () => `<strong style="color:#0F172A;">${escapeHtml(c.launchDate)}</strong>`)
  const support = `<a href="${escapeHtml(`mailto:${SUPPORT_EMAIL}`)}" dir="ltr" style="color:#334155;text-decoration:underline;unicode-bidi:isolate;">${escapeHtml(SUPPORT_EMAIL)}</a>`

  const perks = c.perks
    .map(({ title, body }) => `<p style="margin:8px 0 0 0;font-family:${FONT_STACK};font-size:14px;line-height:21px;color:#475569;"><strong style="color:#0F172A;">${escapeHtml(title)}:</strong> ${escapeHtml(body)}</p>`)
    .join('\n                    ')

  const socials = SOCIALS.map(({ name: network, href, icon }) => `<td width="25%" align="center" valign="top" style="width:25%;padding:0 2px;">
                    <a href="${escapeHtml(href)}" title="${escapeHtml(c.socialTooltip.replace('{network}', network))}" target="_blank" rel="noopener noreferrer" style="display:block;font-family:${FONT_STACK};font-size:12px;line-height:16px;font-weight:600;color:#475569;text-decoration:none;">
                      <img src="${PRODUCTION_API_ORIGIN}/email/${icon}.png" alt="" width="24" height="24" style="display:block;width:24px;height:24px;margin:0 auto 6px auto;border:0;outline:none;text-decoration:none;">
                      ${network}
                    </a>
                  </td>`).join('\n                  ')

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(c.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background-color:#F8FAFC;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#F8FAFC;">${escapeHtml(c.preheader)}&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8FAFC" style="background-color:#F8FAFC;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <!--[if mso]><table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" bgcolor="#FFFFFF" style="max-width:580px;width:100%;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;border-collapse:separate;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.04);">
          <tr>
            <td height="4" bgcolor="#0038B8" style="height:4px;line-height:4px;font-size:4px;background-color:#0038B8;border-radius:16px 16px 0 0;">&nbsp;</td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" dir="${dir}" align="${align}" style="padding:32px 28px 0 28px;background-color:#FFFFFF;text-align:${align};font-family:${FONT_STACK};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="${dir}" align="${align}">
                <tr>
                  <td valign="middle" style="padding-${isRtl ? 'left' : 'right'}:10px;"><img src="${escapeHtml(EMAIL_LOGO_URL)}" alt="" width="36" height="34" style="display:block;width:36px;height:34px;border:0;outline:none;text-decoration:none;"></td>
                  <td valign="middle" style="font-family:${FONT_STACK};font-size:24px;line-height:28px;font-weight:800;color:#0038B8;letter-spacing:-0.5px;">Landly</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" dir="${dir}" style="padding:8px 28px 0 28px;background-color:#FFFFFF;text-align:${align};font-family:${FONT_STACK};">
              <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:18px;font-weight:600;color:#64748B;">${escapeHtml(c.tagline)}</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" dir="${dir}" style="padding:24px 28px 0 28px;background-color:#FFFFFF;text-align:${align};font-family:${FONT_STACK};">
              <h1 style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:26px;line-height:34px;font-weight:800;color:#0F172A;letter-spacing:-0.3px;">${escapeHtml(c.headline)}</h1>
              <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:16px;line-height:24px;font-weight:700;color:#0F172A;">${greeting}</p>
              <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:24px;color:#334155;">${escapeHtml(c.intro)}</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" style="padding:20px 28px 0 28px;background-color:#FFFFFF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}">
                <tr>
                  <td bgcolor="#F8FAFC" style="padding:16px 18px;background-color:#F8FAFC;${startBorder}:4px solid #0038B8;border-radius:8px;text-align:${align};font-family:${FONT_STACK};">
                    <p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:21px;font-weight:700;color:#0F172A;">${escapeHtml(c.perksTitle)}</p>
                    ${perks}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" dir="${dir}" style="padding:20px 28px 0 28px;background-color:#FFFFFF;text-align:${align};font-family:${FONT_STACK};">
              <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;line-height:24px;color:#334155;">${launch}</p>
              <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:24px;color:#334155;">${escapeHtml(c.whatsappIntro)}</p>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#FFFFFF" style="padding:20px 28px 0 28px;background-color:#FFFFFF;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${whatsapp}" style="height:50px;v-text-anchor:middle;width:340px;" arcsize="24%" stroke="f" fillcolor="#25D366">
                <w:anchorlock/>
                <center style="color:#0B1B3D;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${escapeHtml(c.cta)}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${whatsapp}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#25D366;color:#0B1B3D;font-family:${FONT_STACK};font-size:16px;line-height:20px;font-weight:700;text-decoration:none;padding:15px 28px;border-radius:12px;mso-hide:all;">${escapeHtml(c.cta)}</a>
              <!--<![endif]-->
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" dir="${dir}" style="padding:24px 28px 0 28px;background-color:#FFFFFF;text-align:${align};font-family:${FONT_STACK};">
              <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:24px;color:#334155;">${escapeHtml(c.signoff)}<br><strong style="color:#0F172A;">${escapeHtml(c.team)}</strong></p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" style="padding:24px 28px 0 28px;background-color:#FFFFFF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E2E8F0;">
                <tr>
                  <td align="center" style="padding:20px 0 12px 0;font-family:${FONT_STACK};font-size:13px;line-height:18px;font-weight:700;color:#64748B;">${escapeHtml(c.socialTitle)}</td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="width:100%;table-layout:fixed;">
                <tr>
                  ${socials}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#FFFFFF" dir="${dir}" style="padding:24px 28px 28px 28px;background-color:#FFFFFF;border-radius:0 0 16px 16px;font-family:${FONT_STACK};">
              <p style="margin:0 0 8px 0;font-size:12px;line-height:18px;color:#64748B;">${escapeHtml(c.reason)}</p>
              <p style="margin:0 0 8px 0;font-size:12px;line-height:18px;color:#64748B;">${escapeHtml(c.help)} ${support}.</p>
              <p style="margin:0 0 12px 0;font-size:12px;line-height:18px;color:#64748B;">${escapeHtml(c.optOut)} ${support}.</p>
              <p style="margin:0;font-size:12px;line-height:18px;color:#94A3B8;"><span dir="ltr" style="unicode-bidi:isolate;">&copy; ${new Date().getFullYear()} Landly.</span> ${escapeHtml(t.footer_copyright_notice)}<br>${escapeHtml(t.footer_location)}</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`
}

function leadLang(value: unknown): Lang {
  return typeof value === 'string' && Object.hasOwn(WAITLIST_WELCOME_COPY, value) ? (value as Lang) : 'en'
}

export type WaitlistWelcomeResult = 'sent' | 'already-sent' | 'skipped' | 'failed'

/**
 * Sends a lead's welcome email at most once. A transaction claims the lead first,
 * so two runs can't both send; a failed send gives the claim back. Never throws,
 * and logs only the lead id, language, subject and failure code: no name or address.
 */
export async function sendWaitlistWelcomeEmail(db: Firestore, leadId: string): Promise<WaitlistWelcomeResult> {
  const ref = db.collection(LEADS_COLLECTION).doc(leadId)
  let claimed = false
  try {
    const problem = emailConfigProblem()
    if (problem) {
      const lang = leadLang((await ref.get()).data()?.lang)
      console.warn('[waitlist-welcome] not sent', { leadId, lang, subject: WAITLIST_WELCOME_COPY[lang].subject, reason: problem })
      return 'skipped'
    }

    const lead = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref)
      const data = snapshot.data()
      if (!data || data.welcomeEmailSent === true || typeof data.email !== 'string') return null
      tx.update(ref, { welcomeEmailSent: true, welcomeEmailSentAt: FieldValue.serverTimestamp() })
      return { email: data.email, firstName: typeof data.firstName === 'string' ? data.firstName : '', lang: leadLang(data.lang) }
    })
    if (!lead) return 'already-sent'
    claimed = true

    const { error } = await getResend().emails.send(
      {
        from: process.env.EMAIL_FROM!,
        to: lead.email,
        replyTo: SUPPORT_EMAIL,
        subject: WAITLIST_WELCOME_COPY[lead.lang].subject,
        html: renderWaitlistWelcomeEmail(lead.lang, lead.firstName),
      },
      { idempotencyKey: `waitlist-welcome/${leadId}` }
    )
    // The name only: Resend's message can repeat the recipient's address.
    if (error) throw Object.assign(new Error('Resend refused the send'), { name: error.name })
    return 'sent'
  } catch (err) {
    console.error('[waitlist-welcome] send failed', { leadId, code: err instanceof Error ? err.name : 'unknown' })
    if (claimed) {
      try {
        await ref.update({ welcomeEmailSent: FieldValue.delete(), welcomeEmailSentAt: FieldValue.delete() })
      } catch {
        console.error('[waitlist-welcome] could not release the claim', { leadId })
      }
    }
    return 'failed'
  }
}
