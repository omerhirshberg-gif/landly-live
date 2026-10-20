import type { ReactNode } from 'react'
import { SUPPORT_EMAIL, SUPPORT_PHONE_TEL, SUPPORT_WHATSAPP_DISPLAY } from '@/lib/config'

// The privacy policy text. Kept free of hooks and client-only code so the
// /privacy route renders it on the server (reviewers such as Google's OAuth
// team get the full text in the first HTML response, no JavaScript needed)
// and tests can render it with react-dom/server.
//
// Every statement here describes what the code actually does. When data
// handling changes -- a new field on users/orders/vouchers, a new provider,
// analytics, push tokens, in-app deletion -- update the matching section and
// PRIVACY_POLICY_UPDATED.

export const PRIVACY_POLICY_UPDATED = { iso: '2026-10-20', label: 'October 20, 2026' }

const MAIL = `mailto:${SUPPORT_EMAIL}`

const SECTIONS = [
  { id: 'who-we-are', title: 'Who we are' },
  { id: 'scope', title: 'Scope of this policy' },
  { id: 'information-we-collect', title: 'Information we collect' },
  { id: 'google-user-data', title: 'Google user data' },
  { id: 'how-we-use-information', title: 'How we use information' },
  { id: 'partner-businesses', title: 'What partner businesses see' },
  { id: 'service-providers', title: 'Service providers' },
  { id: 'other-disclosures', title: 'Other disclosures' },
  { id: 'cookies', title: 'Cookies and local storage' },
  { id: 'security', title: 'How we protect your data' },
  { id: 'retention', title: 'Data retention' },
  { id: 'deletion', title: 'Deleting your account and data' },
  { id: 'your-rights', title: 'Your privacy rights' },
  { id: 'international-transfers', title: 'International data transfers' },
  { id: 'children', title: 'Children' },
  { id: 'changes', title: 'Changes to this policy' },
  { id: 'contact', title: 'Contact us' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const index = SECTIONS.findIndex((s) => s.id === id)
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-slate-200 pt-8 mt-8 first:border-t-0 first:pt-0 first:mt-0">
      <h2 id={`${id}-title`} className="text-xl sm:text-2xl font-extrabold text-[#0F172A] mb-4 leading-snug">
        {index + 1}. {SECTIONS[index].title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-base sm:text-lg font-bold text-[#0F172A] pt-2">{children}</h3>
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc ps-6 space-y-2 marker:text-slate-400">{children}</ul>
}

function A({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      className="text-[#0038B8] font-semibold underline underline-offset-2 break-words hover:text-[#0066FF]"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

const Email = () => <A href={MAIL}>{SUPPORT_EMAIL}</A>
// The number reads left to right even inside right-to-left text.
const Phone = () => (
  <span dir="ltr">
    <A href={SUPPORT_PHONE_TEL}>{SUPPORT_WHATSAPP_DISPLAY}</A>
  </span>
)

export default function PrivacyPolicy() {
  return (
    <article className="text-[#334155] text-base leading-[1.7] break-words">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0066FF] mb-2">Landly</p>
        <h1 className="text-3xl sm:text-4xl font-black text-[#0F172A] leading-tight mb-3">Privacy Policy</h1>
        <p className="text-sm text-slate-500">
          Last updated: <time dateTime={PRIVACY_POLICY_UPDATED.iso}>{PRIVACY_POLICY_UPDATED.label}</time>
        </p>
        <p className="mt-5">
          Landly is a lifestyle and growth perks club for people living in, moving to or visiting Israel. This
          Privacy Policy explains what personal information we collect when you use Landly, why we collect it, who
          we share it with, how long we keep it, and the choices and rights you have. We collect only what we need
          to run the service, we do not sell your personal information, and we do not use advertising or
          analytics trackers.
        </p>
      </header>

      <nav aria-label="Table of contents" className="mb-10 rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-3">Contents</h2>
        <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 list-decimal ps-5 text-sm marker:text-slate-400">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-[#0038B8] hover:underline underline-offset-2">{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="who-we-are">
        <p>
          The Landly website at <A href="https://www.golandly.com">www.golandly.com</A> and the Landly mobile apps
          are operated by <strong>Landly</strong>, Tel Aviv-Yafo, Israel (&quot;we&quot;, &quot;us&quot;).
          Landly is the controller (database owner) responsible for the personal information
          described in this policy.
        </p>
        <p>
          For any privacy question or request, contact us at <Email /> or by phone or WhatsApp at <Phone />.
        </p>
      </Section>

      <Section id="scope">
        <p>
          This policy applies to the Landly website, the Landly apps for iOS and Android, and the emails and
          customer support we provide in connection with them (together, the &quot;Service&quot;). It covers
          members who sign up for perks and vouchers, and visitors who browse the Service without an account.
        </p>
        <p>
          Partner businesses that offer perks through Landly are independent. When you visit or buy from a business
          directly, its own privacy practices apply.
        </p>
      </Section>

      <Section id="information-we-collect">
        <H3>Account information</H3>
        <List>
          <li>Your first and last name, and the display name formed from them.</li>
          <li>Your email address and whether it has been verified.</li>
          <li>
            If you sign up with an email and password: your password, which is handled by Firebase Authentication
            and stored only as a salted, one-way hash. Landly staff can never see it.
          </li>
          <li>
            If you sign in with Google: the information described in{' '}
            <A href="#google-user-data">Google user data</A>, including your profile picture.
          </li>
          <li>The date your account was created and whether you have completed onboarding.</li>
        </List>

        <H3>Membership and profile details</H3>
        <List>
          <li>
            Your member type, which you choose so we can show relevant perks and community offers: Student, New
            Immigrant (Oleh Chadash), Lone Soldier, Taglit, Long-term program (such as Masa), Traveler, or Other. If
            you choose Other, the short description you type.
          </li>
          <li>
            Your member type is your own statement and you can change it at any time. We do not ask for proof of it,
            and we <strong>do not request or collect</strong> military service records, ID documents or any official
            or classified military information.
          </li>
          <li>Your country of origin, which you choose during onboarding.</li>
          <li>
            Where in Israel you live, if you choose to tell us: one of North, Haifa &amp; Krayot, Center, Tel Aviv &amp;
            Gush Dan, Jerusalem or South, or that you are not in Israel yet.
          </li>
          <li>Your preferred language for the Service and our emails.</li>
          <li>The offers you save to your wishlist.</li>
        </List>

        <H3>Contact and notification details</H3>
        <List>
          <li>Your phone / WhatsApp number, including country code, if you provide it.</li>
          <li>
            Your notification preference: whether you agreed to receive notifications. The app records only this
            yes/no choice; we do not currently store device push-notification tokens.
          </li>
        </List>

        <H3>Orders, vouchers and redemptions</H3>
        <List>
          <li>
            The perks you claim or buy: the offer, the partner business, the price and currency, the order status
            and the payment date.
          </li>
          <li>
            Your vouchers: the unique redemption code (displayed as a QR code in your digital pass), whether the
            voucher is active or redeemed, and when it was claimed and redeemed.
          </li>
        </List>

        <H3>Payment information</H3>
        <p>
          Paid offers are processed by our payment provider, Tranzila. You enter your card details on
          Tranzila&apos;s secure payment page. Landly never receives or stores your full card number or security
          code; we receive only the outcome of the payment and a transaction reference.
        </p>

        <H3>Messages you send us</H3>
        <p>
          When you contact us through the support form, by email or on WhatsApp, we receive your name, contact
          details and the content of your message.
        </p>

        <H3>Aliyah mentor requests</H3>
        <p>
          If you ask to be matched with a personal Aliyah mentor on our Making Aliyah page (available to signed-in
          members), we receive the name you enter, your account email address and account reference, your preferred
          mentor language, your planned Aliyah date, any notes you add and the language you use the Service in. The
          request is sent to the Landly team, who use it only to match you with a mentor. We share these details{' '}
          <strong>exclusively</strong> with the verified community mentor matched to you, solely for matching and
          guiding you, and never with partner businesses or for marketing.
        </p>

        <H3>Technical information</H3>
        <p>
          Like any website, our servers and hosting provider receive technical data with each request, such as your
          IP address, browser or device type and the pages requested. We use it to deliver the Service, keep it
          secure and limit abuse (for example, rate-limiting repeated sign-in, password-reset and verification
          email requests). We do not use it to build advertising profiles.
        </p>
      </Section>

      <Section id="google-user-data">
        <p>
          You can create a Landly account or sign in with your Google account (&quot;Sign in with Google&quot;).
          This section explains how we handle the information Google shares with us.
        </p>
        <H3>What we receive from Google</H3>
        <p>
          We request only the basic sign-in scopes <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em]">openid</code>,{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em]">email</code> and{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em]">profile</code>. With your permission,
          Google shares:
        </p>
        <List>
          <li>your name;</li>
          <li>your email address and whether Google has verified it;</li>
          <li>your profile picture (as a link to the image hosted by Google); and</li>
          <li>a unique Google account identifier used to recognise you when you sign in again.</li>
        </List>
        <p>
          We do not request access to your Gmail, contacts, calendar, Drive files or any other Google data, and we
          never receive your Google password.
        </p>
        <H3>How we use Google user data</H3>
        <p>We use the information above only to:</p>
        <List>
          <li>authenticate you and create and secure your Landly account;</li>
          <li>fill in your member profile and deliver personalised perks and vouchers;</li>
          <li>prevent fraud and abuse of the Service; and</li>
          <li>send you account communications, such as security and service messages.</li>
        </List>
        <H3>Limited Use</H3>
        <p className="rounded-xl border border-[#BFD4FF] bg-[#EFF5FF] p-4 sm:p-5 text-[#0F172A]">
          Landly&apos;s use and transfer of information received from Google APIs to any other app will adhere to
          the{' '}
          <A href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </A>
          , including the Limited Use requirements.
        </p>
        <p>In particular:</p>
        <List>
          <li>
            We <strong>never sell, rent or trade</strong> Google user data, and we never share it with third
            parties for marketing or advertising, or with data brokers or information resellers.
          </li>
          <li>We never use Google user data to serve advertisements, including personalised or retargeted ads.</li>
          <li>
            We transfer Google user data to others only as necessary to provide the Service (to the service
            providers listed in <A href="#service-providers">Service providers</A>, who act on our instructions),
            to comply with applicable law, or as part of a merger or acquisition with notice to you.
          </li>
          <li>We do not use Google user data to develop, improve or train generalised AI or machine-learning models.</li>
          <li>
            No person at Landly reads your Google user data unless you ask us to (for example, in a support
            request), it is needed for security or fraud investigations, or the law requires it.
          </li>
        </List>
        <p>
          You can remove Landly&apos;s access at any time from your Google Account at{' '}
          <A href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</A>. To delete the
          Google user data we already hold, see <A href="#deletion">Deleting your account and data</A>.
        </p>
      </Section>

      <Section id="how-we-use-information">
        <p>We use personal information for the following purposes, each on the legal basis shown:</p>
        <List>
          <li>
            <strong>Providing the Service</strong>: creating and managing your account, showing perks that match your
            member type, issuing vouchers and digital passes, processing orders and refunds (performance of our
            contract with you).
          </li>
          <li>
            <strong>Account communications</strong>: email verification, password resets, voucher and order
            confirmations and important service notices (performance of contract and our legitimate interest in
            operating the Service).
          </li>
          <li>
            <strong>Notifications about perks</strong>: only if you opted in, which you can change at any time
            (consent).
          </li>
          <li>
            <strong>Security and fraud prevention</strong>: verifying accounts, rate-limiting abuse and protecting
            members and partner businesses (legitimate interests).
          </li>
          <li>
            <strong>Customer support</strong>: answering your questions and requests (performance of contract and
            legitimate interests).
          </li>
          <li>
            <strong>Aliyah mentor matching</strong>: only when you ask for a mentor, matching you with one and passing
            your request to that mentor (performance of our contract with you, at your request).
          </li>
          <li>
            <strong>Legal compliance</strong>: keeping transaction records required by tax and accounting law and
            responding to lawful requests (legal obligation).
          </li>
        </List>
        <p>
          We do not use your information for automated decision-making that has legal or similarly significant
          effects on you, and we do not sell it or use it for third-party advertising.
        </p>
      </Section>

      <Section id="partner-businesses">
        <p>
          When you redeem a voucher, the partner business sees only what it needs to honour it: the voucher&apos;s
          reference, the offer and the dates it was claimed and redeemed. We do <strong>not</strong> give partner
          businesses your name, email address, phone number or member type.
        </p>
      </Section>

      <Section id="service-providers">
        <p>
          We use the following trusted providers to run the Service. They process personal information only on our
          instructions and under contractual confidentiality and security obligations:
        </p>
        <List>
          <li>
            <strong>Google Firebase and Google Cloud</strong> (Firebase Authentication, Cloud Firestore, Cloud Storage):
            account sign-in and secure storage of account, profile, order and voucher data and of profile photos. Cloud
            Translation translates the text of partner offers; no member data is sent to it.
          </li>
          <li>
            <strong>Google Maps Platform</strong>: when you use &quot;Near me&quot;, the city name for your approximate
            area. Your browser or device rounds your location to about one kilometre before it reaches our servers, and
            we never store it; sorting perks by distance happens on your device.
          </li>
          <li>
            <strong>Vercel</strong>: hosting of the website and our server functions, including request logs.
          </li>
          <li>
            <strong>Resend</strong>: delivery of transactional emails such as email verification, password resets and
            order confirmations, and of the messages you send through our support, business and mentor request forms
            to our team.
          </li>
          <li><strong>Tranzila</strong>: secure payment processing for paid offers.</li>
          <li>
            <strong>Google Fonts and Cloudflare (cdnjs)</strong>: delivery of fonts and icons used by the website.
            Your browser contacts these services directly, which reveals your IP address to them.
          </li>
          <li>
            <strong>Apple App Store and Google Play</strong>: distribution of the mobile apps. If you allow
            notifications, your device&apos;s operating system delivers them.
          </li>
        </List>
      </Section>

      <Section id="other-disclosures">
        <p>We do not sell or rent personal information. We may disclose it only:</p>
        <List>
          <li>when required by law, court order or a lawful request from a public authority;</li>
          <li>to protect the rights, safety and property of Landly, our members, partner businesses or the public, including to prevent fraud;</li>
          <li>
            as part of a merger, acquisition or sale of all or part of our business, in which case the recipient
            must honour this policy and we will notify you; or
          </li>
          <li>with your consent or at your direction.</li>
        </List>
      </Section>

      <Section id="cookies">
        <p>
          We do not use advertising cookies, analytics tools or cross-site tracking. The Service uses your
          browser&apos;s or device&apos;s local storage only for essential functions: keeping you signed in
          (Firebase Authentication), remembering your language, saving an onboarding form you have not finished yet,
          and remembering which notices and introductions you have already seen. You can clear this storage at any time in your browser or device settings; you
          will then need to sign in again.
        </p>
      </Section>

      <Section id="security">
        <List>
          <li>All data travels over encrypted connections (HTTPS / TLS).</li>
          <li>
            Data is stored on Google Cloud infrastructure (Firebase Authentication and Cloud Firestore), which
            encrypts data at rest.
          </li>
          <li>Passwords are never stored in readable form; Firebase Authentication keeps only a salted hash.</li>
          <li>
            Database security rules ensure that each member can read only their own profile, orders and vouchers.
            Orders and vouchers can be created or changed only by our servers.
          </li>
          <li>Administrative access is restricted to authorised Landly staff and protected by a password, short-lived sessions and rate limiting.</li>
          <li>Sign-in, password-reset and email requests are rate-limited to slow down automated attacks.</li>
        </List>
        <p>
          No method of transmission or storage is completely secure, but we work to protect your information and
          will notify you and the relevant authorities of a data breach where the law requires it.
        </p>
      </Section>

      <Section id="retention">
        <List>
          <li>
            <strong>Account and profile data</strong> (including Google user data, member type, country of origin,
            region, phone number, preferences and wishlist) is kept for as long as your account exists and is deleted when you ask us to
            delete your account.
          </li>
          <li>
            <strong>Order, transaction and voucher records</strong> are kept for up to 7 years, as required by
            Israeli tax and bookkeeping law, and then deleted. During that period they are used only for legal,
            accounting and dispute purposes.
          </li>
          <li>
            <strong>Support messages</strong> are kept as long as needed to resolve your request and handle any
            follow-up.
          </li>
          <li>
            <strong>Mentor requests</strong> are kept as long as needed to match you with a mentor and handle any
            follow-up.
          </li>
          <li><strong>Server logs</strong> are kept for a short period by our hosting provider for security and troubleshooting.</li>
        </List>
      </Section>

      <Section id="deletion">
        <p>
          You can ask us to delete your Landly account and personal data at any time. You can submit an account
          deletion request directly through your app settings under Settings → Delete Account (or via the website
          settings), or by contacting our team at <Email />.
        </p>
        <ol className="list-decimal ps-6 space-y-2 marker:font-semibold marker:text-[#0F172A]">
          <li>
            In the app or on the website, confirm the request while signed in. You can tell us why you are leaving,
            but you do not have to. The request, with any reason you give, is sent to our team.
          </li>
          <li>
            By email, write from the address registered to your Landly account, with the subject &quot;Delete my
            account&quot;. We may ask you to confirm the request from that address, so that nobody else can delete
            your account.
          </li>
          <li>
            We will delete your account, your sign-in record (including any Google user data) and your profile
            data, and confirm by email, <strong>within 30 days</strong> of your request.
          </li>
        </ol>
        <p>
          Order, transaction and voucher records that we must keep by law are retained as described in{' '}
          <A href="#retention">Data retention</A> and are no longer linked to an active account. Unredeemed vouchers
          are cancelled when the account is deleted.
        </p>
        <p>
          If you signed in with Google, you can also remove Landly&apos;s access from your Google Account at{' '}
          <A href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</A>; this stops
          future access but does not by itself delete the data we hold, so please also send us a deletion request.
        </p>
      </Section>

      <Section id="your-rights">
        <p>
          Depending on where you live, including under Israel&apos;s Protection of Privacy Law, 5741-1981 and its
          regulations, and the EU and UK General Data Protection Regulation (GDPR), you have the right to:
        </p>
        <List>
          <li><strong>Access</strong>: ask for a copy of the personal information we hold about you;</li>
          <li><strong>Correction</strong>: correct inaccurate or incomplete information (you can also edit most details on your Profile page);</li>
          <li><strong>Deletion</strong>: ask us to delete your information, as described above;</li>
          <li><strong>Restriction and objection</strong>: ask us to limit or stop certain processing;</li>
          <li><strong>Portability</strong>: receive the information you gave us in a common, machine-readable format;</li>
          <li><strong>Withdraw consent</strong>: for example, turn off notifications, at any time and without affecting earlier processing; and</li>
          <li>
            <strong>Complain</strong>: lodge a complaint with the Israeli Privacy Protection Authority or, in the
            EU/UK, with your local data protection authority.
          </li>
        </List>
        <p>
          To exercise any of these rights, email <Email />. We will respond within 30 days and will not
          discriminate against you for exercising them.
        </p>
      </Section>

      <Section id="international-transfers">
        <p>
          Landly is based in Israel. Our service providers, including Google Cloud and Vercel, may store and
          process data in other countries, including the European Union and the United States. When personal
          information is transferred outside Israel or the EU, we rely on the safeguards required by law, such as
          adequacy decisions and Standard Contractual Clauses offered by our providers.
        </p>
      </Section>

      <Section id="children">
        <p>
          Landly is intended for people aged <strong>16 and over</strong>. We do not knowingly collect personal
          information from anyone under 16. If you believe a child under 16 has given us personal information,
          contact us at <Email /> and we will delete it.
        </p>
      </Section>

      <Section id="changes">
        <p>
          We may update this policy as the Service changes. We will update the &quot;Last updated&quot; date above
          and, for material changes, notify members by email or in the Service before the changes take effect.
          The English version of this policy is the governing version; any translation is provided for convenience.
        </p>
      </Section>

      <Section id="contact">
        <address className="not-italic rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 sm:p-6 space-y-1">
          <p className="font-bold text-[#0F172A]">Landly</p>
          <p>Tel Aviv-Yafo, Israel</p>
          <p>Privacy and support: <Email /></p>
          <p>Phone / WhatsApp: <Phone /></p>
          <p>Website: <A href="https://www.golandly.com">www.golandly.com</A></p>
        </address>
      </Section>
    </article>
  )
}
