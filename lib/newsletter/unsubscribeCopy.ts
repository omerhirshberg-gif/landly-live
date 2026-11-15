// The /unsubscribe page and the newsletter's legal footer, in the five site
// languages. Plain data with no server imports: the page (a server component)
// and the email renderer both read it.

export const NEWSLETTER_LANGS = ['en', 'he', 'ru', 'fr', 'es'] as const
export type NewsletterLang = (typeof NEWSLETTER_LANGS)[number]

export function newsletterLang(value: unknown): NewsletterLang {
  return (NEWSLETTER_LANGS as readonly string[]).includes(value as string) ? (value as NewsletterLang) : 'en'
}

export interface UnsubscribeCopy {
  title: string
  body: string
  confirmButton: string
  workingButton: string
  doneTitle: string
  doneBody: string
  invalidTitle: string
  invalidBody: string
  errorBody: string
  homeLink: string
  /** Newsletter footer. */
  footerReason: string
  footerLink: string
  footerIdentity: string
}

export const UNSUBSCRIBE_COPY: Record<NewsletterLang, UnsubscribeCopy> = {
  en: {
    title: 'Unsubscribe from GoLandly emails',
    body: 'Confirm to stop receiving marketing emails and newsletters at',
    confirmButton: 'Unsubscribe',
    workingButton: 'Unsubscribing…',
    doneTitle: 'You are unsubscribed',
    doneBody: 'We will no longer send marketing emails to',
    invalidTitle: 'This link is not valid',
    invalidBody: 'The unsubscribe link is incomplete or has been altered. Write to us and we will remove you by hand.',
    errorBody: 'Something went wrong. Please try again, or write to us and we will remove you by hand.',
    homeLink: 'Back to GoLandly',
    footerReason: 'You receive this email because you agreed to hear from GoLandly.',
    footerLink: 'Unsubscribe',
    footerIdentity: 'GoLandly · Tel Aviv, Israel',
  },
  he: {
    title: 'הסרה מרשימת הדיוור של GoLandly',
    body: 'אשרו כדי להפסיק לקבל דיוור שיווקי וניוזלטרים לכתובת',
    confirmButton: 'הסירו אותי',
    workingButton: 'מסירים…',
    doneTitle: 'הוסרתם מהרשימה',
    doneBody: 'לא נשלח יותר דיוור שיווקי אל',
    invalidTitle: 'הקישור אינו תקין',
    invalidBody: 'קישור ההסרה חלקי או שונה. כתבו לנו ונסיר אתכם ידנית.',
    errorBody: 'משהו השתבש. נסו שוב, או כתבו לנו ונסיר אתכם ידנית.',
    homeLink: 'חזרה ל-GoLandly',
    footerReason: 'קיבלתם את המייל הזה כי הסכמתם לשמוע מ-GoLandly.',
    footerLink: 'הסרה מהרשימה',
    footerIdentity: 'GoLandly · תל אביב, ישראל',
  },
  ru: {
    title: 'Отписка от рассылки GoLandly',
    body: 'Подтвердите, чтобы больше не получать рекламные письма и новости на адрес',
    confirmButton: 'Отписаться',
    workingButton: 'Отписываем…',
    doneTitle: 'Вы отписались',
    doneBody: 'Мы больше не будем отправлять рекламные письма на адрес',
    invalidTitle: 'Ссылка недействительна',
    invalidBody: 'Ссылка для отписки неполная или была изменена. Напишите нам, и мы удалим вас вручную.',
    errorBody: 'Что-то пошло не так. Попробуйте ещё раз или напишите нам, и мы удалим вас вручную.',
    homeLink: 'Вернуться на GoLandly',
    footerReason: 'Вы получили это письмо, потому что согласились получать сообщения от GoLandly.',
    footerLink: 'Отписаться',
    footerIdentity: 'GoLandly · Тель-Авив, Израиль',
  },
  fr: {
    title: 'Se désabonner des e-mails GoLandly',
    body: 'Confirmez pour ne plus recevoir d’e-mails marketing ni de newsletters à l’adresse',
    confirmButton: 'Me désabonner',
    workingButton: 'Désabonnement…',
    doneTitle: 'Vous êtes désabonné(e)',
    doneBody: 'Nous n’enverrons plus d’e-mails marketing à',
    invalidTitle: 'Ce lien n’est pas valide',
    invalidBody: 'Le lien de désabonnement est incomplet ou a été modifié. Écrivez-nous et nous vous retirerons manuellement.',
    errorBody: 'Une erreur est survenue. Réessayez, ou écrivez-nous et nous vous retirerons manuellement.',
    homeLink: 'Retour à GoLandly',
    footerReason: 'Vous recevez cet e-mail car vous avez accepté d’avoir des nouvelles de GoLandly.',
    footerLink: 'Se désabonner',
    footerIdentity: 'GoLandly · Tel Aviv, Israël',
  },
  es: {
    title: 'Darse de baja de los correos de GoLandly',
    body: 'Confirma para dejar de recibir correos de marketing y boletines en',
    confirmButton: 'Darme de baja',
    workingButton: 'Procesando…',
    doneTitle: 'Te has dado de baja',
    doneBody: 'Ya no enviaremos correos de marketing a',
    invalidTitle: 'Este enlace no es válido',
    invalidBody: 'El enlace de baja está incompleto o fue modificado. Escríbenos y te daremos de baja manualmente.',
    errorBody: 'Algo salió mal. Inténtalo de nuevo, o escríbenos y te daremos de baja manualmente.',
    homeLink: 'Volver a GoLandly',
    footerReason: 'Recibes este correo porque aceptaste recibir noticias de GoLandly.',
    footerLink: 'Darme de baja',
    footerIdentity: 'GoLandly · Tel Aviv, Israel',
  },
}
