import { SUPPORT_EMAIL, SUPPORT_PHONE_TEL, SUPPORT_WHATSAPP_DISPLAY } from '@/lib/config'

// The privacy policy as plain data, for the app's native Privacy Policy
// screen (landly-mobile/src/app/settings/privacy.tsx). The website renders
// the same text from components/legal/PrivacyPolicy.tsx (a server component
// whose JSX is what Google's OAuth reviewers read), and
// tests/unit/privacyPolicyContent.test.ts fails if any block here stops
// matching what the website shows, so the two can't drift apart: change the
// policy in both places, then that test. English only, like the website;
// the "Changes" section says the English version governs.

/** A run of text: plain, bold, inline code, a link (an http URL, or "#id" for another section), or the support email. */
export type PolicyInline = string | { bold: string } | { code: string } | { link: string; href: string } | { email: true }

export type PolicyBlock =
  | { kind: 'p'; text: PolicyInline[] }
  | { kind: 'h3'; text: string }
  | { kind: 'ul'; items: PolicyInline[][] }
  | { kind: 'ol'; items: PolicyInline[][] }
  /** The Limited Use statement, set apart in a tinted box. */
  | { kind: 'callout'; text: PolicyInline[] }
  /** The contact card: one line per entry. */
  | { kind: 'address'; lines: PolicyInline[][] }

export interface PolicySection {
  id: string
  title: string
  blocks: PolicyBlock[]
}

const p = (...text: PolicyInline[]): PolicyBlock => ({ kind: 'p', text })
const h3 = (text: string): PolicyBlock => ({ kind: 'h3', text })
const ul = (...items: PolicyInline[][]): PolicyBlock => ({ kind: 'ul', items })
const ol = (...items: PolicyInline[][]): PolicyBlock => ({ kind: 'ol', items })
const b = (bold: string): PolicyInline => ({ bold })
const a = (link: string, href: string): PolicyInline => ({ link, href })
const code = (text: string): PolicyInline => ({ code: text })
const EMAIL: PolicyInline = { email: true }
const SITE = a('www.golandly.com', 'https://www.golandly.com')
const PHONE = a(SUPPORT_WHATSAPP_DISPLAY, SUPPORT_PHONE_TEL)
const GOOGLE_PERMISSIONS = a('myaccount.google.com/permissions', 'https://myaccount.google.com/permissions')

export const PRIVACY_POLICY_TITLE = 'Privacy Policy'
export const PRIVACY_POLICY_UPDATED_LABEL = 'October 18, 2026'

export const PRIVACY_POLICY_INTRO: PolicyInline[] = [
  'Landly is a lifestyle and growth perks club for people living in, moving to or visiting Israel. This Privacy Policy explains what personal information we collect when you use Landly, why we collect it, who we share it with, how long we keep it, and the choices and rights you have. We collect only what we need to run the service, we do not sell your personal information, and we do not use advertising or analytics trackers.',
]

export const PRIVACY_POLICY_SECTIONS: PolicySection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    blocks: [
      p('The Landly website at ', SITE, ' and the Landly mobile apps are operated by ', b('Landly'), ', Tel Aviv-Yafo, Israel ("we", "us"). Landly is the controller (database owner) responsible for the personal information described in this policy.'),
      p('For any privacy question or request, contact us at ', EMAIL, ' or by phone or WhatsApp at ', PHONE, '.'),
    ],
  },
  {
    id: 'scope',
    title: 'Scope of this policy',
    blocks: [
      p('This policy applies to the Landly website, the Landly apps for iOS and Android, and the emails and customer support we provide in connection with them (together, the "Service"). It covers members who sign up for perks and vouchers, and visitors who browse the Service without an account.'),
      p('Partner businesses that offer perks through Landly are independent. When you visit or buy from a business directly, its own privacy practices apply.'),
    ],
  },
  {
    id: 'information-we-collect',
    title: 'Information we collect',
    blocks: [
      h3('Account information'),
      ul(
        ['Your first and last name, and the display name formed from them.'],
        ['Your email address and whether it has been verified.'],
        ['If you sign up with an email and password: your password, which is handled by Firebase Authentication and stored only as a salted, one-way hash. Landly staff can never see it.'],
        ['If you sign in with Google: the information described in ', a('Google user data', '#google-user-data'), ', including your profile picture.'],
        ['The date your account was created and whether you have completed onboarding.'],
      ),
      h3('Membership and profile details'),
      ul(
        ['Your member type, which you choose so we can show relevant perks and community offers: Student, New Immigrant (Oleh Chadash), Lone Soldier, Taglit, Long-term program (such as Masa), Traveler, or Other. If you choose Other, the short description you type.'],
        ['Your member type is your own statement and you can change it at any time. We do not ask for proof of it, and we ', b('do not request or collect'), ' military service records, ID documents or any official or classified military information.'],
        ['Your country of origin, which you choose during onboarding.'],
        ['Where in Israel you live, if you choose to tell us: one of North, Haifa & Krayot, Center, Tel Aviv & Gush Dan, Jerusalem or South, or that you are not in Israel yet.'],
        ['Your preferred language for the Service and our emails.'],
        ['The offers you save to your wishlist.'],
      ),
      h3('Contact and notification details'),
      ul(
        ['Your phone / WhatsApp number, including country code, if you provide it.'],
        ['Your notification preference: whether you agreed to receive notifications. The app records only this yes/no choice; we do not currently store device push-notification tokens.'],
      ),
      h3('Orders, vouchers and redemptions'),
      ul(
        ['The perks you claim or buy: the offer, the partner business, the price and currency, the order status and the payment date.'],
        ['Your vouchers: the unique redemption code (displayed as a QR code in your digital pass), whether the voucher is active or redeemed, and when it was claimed and redeemed.'],
      ),
      h3('Payment information'),
      p("Paid offers are processed by our payment provider, Tranzila. You enter your card details on Tranzila's secure payment page. Landly never receives or stores your full card number or security code; we receive only the outcome of the payment and a transaction reference."),
      h3('Messages you send us'),
      p('When you contact us through the support form, by email or on WhatsApp, we receive your name, contact details and the content of your message.'),
      h3('Aliyah mentor requests'),
      p('If you ask to be matched with a personal Aliyah mentor on our Making Aliyah page (available to signed-in members), we receive the name you enter, your account email address and account reference, your preferred mentor language, your planned Aliyah date, any notes you add and the language you use the Service in. The request is sent to the Landly team, who use it only to match you with a mentor. We share these details ', b('exclusively'), ' with the verified community mentor matched to you, solely for matching and guiding you, and never with partner businesses or for marketing.'),
      h3('Technical information'),
      p('Like any website, our servers and hosting provider receive technical data with each request, such as your IP address, browser or device type and the pages requested. We use it to deliver the Service, keep it secure and limit abuse (for example, rate-limiting repeated sign-in, password-reset and verification email requests). We do not use it to build advertising profiles.'),
    ],
  },
  {
    id: 'google-user-data',
    title: 'Google user data',
    blocks: [
      p('You can create a Landly account or sign in with your Google account ("Sign in with Google"). This section explains how we handle the information Google shares with us.'),
      h3('What we receive from Google'),
      p('We request only the basic sign-in scopes ', code('openid'), ', ', code('email'), ' and ', code('profile'), '. With your permission, Google shares:'),
      ul(
        ['your name;'],
        ['your email address and whether Google has verified it;'],
        ['your profile picture (as a link to the image hosted by Google); and'],
        ['a unique Google account identifier used to recognise you when you sign in again.'],
      ),
      p('We do not request access to your Gmail, contacts, calendar, Drive files or any other Google data, and we never receive your Google password.'),
      h3('How we use Google user data'),
      p('We use the information above only to:'),
      ul(
        ['authenticate you and create and secure your Landly account;'],
        ['fill in your member profile and deliver personalised perks and vouchers;'],
        ['prevent fraud and abuse of the Service; and'],
        ['send you account communications, such as security and service messages.'],
      ),
      h3('Limited Use'),
      {
        kind: 'callout',
        text: [
          "Landly's use and transfer of information received from Google APIs to any other app will adhere to the ",
          a('Google API Services User Data Policy', 'https://developers.google.com/terms/api-services-user-data-policy'),
          ', including the Limited Use requirements.',
        ],
      },
      p('In particular:'),
      ul(
        ['We ', b('never sell, rent or trade'), ' Google user data, and we never share it with third parties for marketing or advertising, or with data brokers or information resellers.'],
        ['We never use Google user data to serve advertisements, including personalised or retargeted ads.'],
        ['We transfer Google user data to others only as necessary to provide the Service (to the service providers listed in ', a('Service providers', '#service-providers'), ', who act on our instructions), to comply with applicable law, or as part of a merger or acquisition with notice to you.'],
        ['We do not use Google user data to develop, improve or train generalised AI or machine-learning models.'],
        ['No person at Landly reads your Google user data unless you ask us to (for example, in a support request), it is needed for security or fraud investigations, or the law requires it.'],
      ),
      p("You can remove Landly's access at any time from your Google Account at ", GOOGLE_PERMISSIONS, '. To delete the Google user data we already hold, see ', a('Deleting your account and data', '#deletion'), '.'),
    ],
  },
  {
    id: 'how-we-use-information',
    title: 'How we use information',
    blocks: [
      p('We use personal information for the following purposes, each on the legal basis shown:'),
      ul(
        [b('Providing the Service'), ': creating and managing your account, showing perks that match your member type, issuing vouchers and digital passes, processing orders and refunds (performance of our contract with you).'],
        [b('Account communications'), ': email verification, password resets, voucher and order confirmations and important service notices (performance of contract and our legitimate interest in operating the Service).'],
        [b('Notifications about perks'), ': only if you opted in, which you can change at any time (consent).'],
        [b('Security and fraud prevention'), ': verifying accounts, rate-limiting abuse and protecting members and partner businesses (legitimate interests).'],
        [b('Customer support'), ': answering your questions and requests (performance of contract and legitimate interests).'],
        [b('Aliyah mentor matching'), ': only when you ask for a mentor, matching you with one and passing your request to that mentor (performance of our contract with you, at your request).'],
        [b('Legal compliance'), ': keeping transaction records required by tax and accounting law and responding to lawful requests (legal obligation).'],
      ),
      p('We do not use your information for automated decision-making that has legal or similarly significant effects on you, and we do not sell it or use it for third-party advertising.'),
    ],
  },
  {
    id: 'partner-businesses',
    title: 'What partner businesses see',
    blocks: [
      p("When you redeem a voucher, the partner business sees only what it needs to honour it: the voucher's reference, the offer and the dates it was claimed and redeemed. We do ", b('not'), ' give partner businesses your name, email address, phone number or member type.'),
    ],
  },
  {
    id: 'service-providers',
    title: 'Service providers',
    blocks: [
      p('We use the following trusted providers to run the Service. They process personal information only on our instructions and under contractual confidentiality and security obligations:'),
      ul(
        [b('Google Firebase and Google Cloud'), ' (Firebase Authentication, Cloud Firestore): account sign-in and secure storage of account, profile, order and voucher data.'],
        [b('Vercel'), ': hosting of the website and our server functions, including request logs.'],
        [b('Resend'), ': delivery of transactional emails such as email verification, password resets and order confirmations, and of the messages you send through our support, business and mentor request forms to our team.'],
        [b('Tranzila'), ': secure payment processing for paid offers.'],
        [b('Google Fonts and Cloudflare (cdnjs)'), ': delivery of fonts and icons used by the website. Your browser contacts these services directly, which reveals your IP address to them.'],
        [b('Apple App Store and Google Play'), ": distribution of the mobile apps. If you allow notifications, your device's operating system delivers them."],
      ),
    ],
  },
  {
    id: 'other-disclosures',
    title: 'Other disclosures',
    blocks: [
      p('We do not sell or rent personal information. We may disclose it only:'),
      ul(
        ['when required by law, court order or a lawful request from a public authority;'],
        ['to protect the rights, safety and property of Landly, our members, partner businesses or the public, including to prevent fraud;'],
        ['as part of a merger, acquisition or sale of all or part of our business, in which case the recipient must honour this policy and we will notify you; or'],
        ['with your consent or at your direction.'],
      ),
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    blocks: [
      p("We do not use advertising cookies, analytics tools or cross-site tracking. The Service uses your browser's or device's local storage only for essential functions: keeping you signed in (Firebase Authentication), remembering your language, saving an onboarding form you have not finished yet, and remembering which notices and introductions you have already seen. You can clear this storage at any time in your browser or device settings; you will then need to sign in again."),
    ],
  },
  {
    id: 'security',
    title: 'How we protect your data',
    blocks: [
      ul(
        ['All data travels over encrypted connections (HTTPS / TLS).'],
        ['Data is stored on Google Cloud infrastructure (Firebase Authentication and Cloud Firestore), which encrypts data at rest.'],
        ['Passwords are never stored in readable form; Firebase Authentication keeps only a salted hash.'],
        ['Database security rules ensure that each member can read only their own profile, orders and vouchers. Orders and vouchers can be created or changed only by our servers.'],
        ['Administrative access is restricted to authorised Landly staff and protected by a password, short-lived sessions and rate limiting.'],
        ['Sign-in, password-reset and email requests are rate-limited to slow down automated attacks.'],
      ),
      p('No method of transmission or storage is completely secure, but we work to protect your information and will notify you and the relevant authorities of a data breach where the law requires it.'),
    ],
  },
  {
    id: 'retention',
    title: 'Data retention',
    blocks: [
      ul(
        [b('Account and profile data'), ' (including Google user data, member type, country of origin, region, phone number, preferences and wishlist) is kept for as long as your account exists and is deleted when you ask us to delete your account.'],
        [b('Order, transaction and voucher records'), ' are kept for up to 7 years, as required by Israeli tax and bookkeeping law, and then deleted. During that period they are used only for legal, accounting and dispute purposes.'],
        [b('Support messages'), ' are kept as long as needed to resolve your request and handle any follow-up.'],
        [b('Mentor requests'), ' are kept as long as needed to match you with a mentor and handle any follow-up.'],
        [b('Server logs'), ' are kept for a short period by our hosting provider for security and troubleshooting.'],
      ),
    ],
  },
  {
    id: 'deletion',
    title: 'Deleting your account and data',
    blocks: [
      p('You can ask us to delete your Landly account and personal data at any time. You can submit an account deletion request directly through your app settings under Settings → Delete Account (or via the website settings), or by contacting our team at ', EMAIL, '.'),
      ol(
        ['In the app or on the website, confirm the request while signed in. You can tell us why you are leaving, but you do not have to. The request, with any reason you give, is sent to our team.'],
        ['By email, write from the address registered to your Landly account, with the subject "Delete my account". We may ask you to confirm the request from that address, so that nobody else can delete your account.'],
        ['We will delete your account, your sign-in record (including any Google user data) and your profile data, and confirm by email, ', b('within 30 days'), ' of your request.'],
      ),
      p('Order, transaction and voucher records that we must keep by law are retained as described in ', a('Data retention', '#retention'), ' and are no longer linked to an active account. Unredeemed vouchers are cancelled when the account is deleted.'),
      p("If you signed in with Google, you can also remove Landly's access from your Google Account at ", GOOGLE_PERMISSIONS, '; this stops future access but does not by itself delete the data we hold, so please also send us a deletion request.'),
    ],
  },
  {
    id: 'your-rights',
    title: 'Your privacy rights',
    blocks: [
      p("Depending on where you live, including under Israel's Protection of Privacy Law, 5741-1981 and its regulations, and the EU and UK General Data Protection Regulation (GDPR), you have the right to:"),
      ul(
        [b('Access'), ': ask for a copy of the personal information we hold about you;'],
        [b('Correction'), ': correct inaccurate or incomplete information (you can also edit most details on your Profile page);'],
        [b('Deletion'), ': ask us to delete your information, as described above;'],
        [b('Restriction and objection'), ': ask us to limit or stop certain processing;'],
        [b('Portability'), ': receive the information you gave us in a common, machine-readable format;'],
        [b('Withdraw consent'), ': for example, turn off notifications, at any time and without affecting earlier processing; and'],
        [b('Complain'), ': lodge a complaint with the Israeli Privacy Protection Authority or, in the EU/UK, with your local data protection authority.'],
      ),
      p('To exercise any of these rights, email ', EMAIL, '. We will respond within 30 days and will not discriminate against you for exercising them.'),
    ],
  },
  {
    id: 'international-transfers',
    title: 'International data transfers',
    blocks: [
      p('Landly is based in Israel. Our service providers, including Google Cloud and Vercel, may store and process data in other countries, including the European Union and the United States. When personal information is transferred outside Israel or the EU, we rely on the safeguards required by law, such as adequacy decisions and Standard Contractual Clauses offered by our providers.'),
    ],
  },
  {
    id: 'children',
    title: 'Children',
    blocks: [
      p('Landly is intended for people aged ', b('16 and over'), '. We do not knowingly collect personal information from anyone under 16. If you believe a child under 16 has given us personal information, contact us at ', EMAIL, ' and we will delete it.'),
    ],
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    blocks: [
      p('We may update this policy as the Service changes. We will update the "Last updated" date above and, for material changes, notify members by email or in the Service before the changes take effect. The English version of this policy is the governing version; any translation is provided for convenience.'),
    ],
  },
  {
    id: 'contact',
    title: 'Contact us',
    blocks: [
      {
        kind: 'address',
        lines: [[b('Landly')], ['Tel Aviv-Yafo, Israel'], ['Privacy and support: ', EMAIL], ['Phone / WhatsApp: ', PHONE], ['Website: ', SITE]],
      },
    ],
  },
]

/** A run's visible text. */
export function inlineText(part: PolicyInline): string {
  if (typeof part === 'string') return part
  if ('bold' in part) return part.bold
  if ('code' in part) return part.code
  if ('link' in part) return part.link
  return SUPPORT_EMAIL
}

/** A block's visible text, one string per paragraph, heading, list item or address line. */
export function blockTexts(block: PolicyBlock): string[] {
  const join = (parts: PolicyInline[]) => parts.map(inlineText).join('')
  switch (block.kind) {
    case 'h3':
      return [block.text]
    case 'p':
    case 'callout':
      return [join(block.text)]
    case 'ul':
    case 'ol':
      return block.items.map(join)
    case 'address':
      return block.lines.map(join)
  }
}
