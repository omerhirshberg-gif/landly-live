import { WhatsAppIcon } from '@/components/ui/SocialIcon'
import { PRELAUNCH_COPY, type PrelaunchLang } from '@/lib/prelaunch/copy'
import { WHATSAPP_COMMUNITY_URL } from '@/lib/prelaunch/links'

// The strongest thing on the success screen. WhatsApp's own green with dark
// text: white on #25D366 doesn't reach readable contrast.
export default function CommunityCard({ lang }: { lang: PrelaunchLang }) {
  const copy = PRELAUNCH_COPY[lang]
  return (
    <section className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-green-100/60 p-5 shadow-[0_8px_30px_rgba(18,140,75,.12)] sm:p-7">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-ink">
        <WhatsAppIcon width={22} height={22} fill="currentColor" />
      </span>
      <h3 className="mt-4 text-2xl font-black leading-tight tracking-tight [text-wrap:balance]">{copy.communityTitle}</h3>
      <p className="mt-2 leading-relaxed text-body">{copy.communityBody}</p>
      <a
        href={WHATSAPP_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] px-6 text-center text-lg font-bold text-ink shadow-[0_8px_24px_rgba(37,211,102,.35)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#20c05c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#128C4B]/40"
      >
        <WhatsAppIcon width={22} height={22} fill="currentColor" />
        {copy.communityCta}
      </a>
    </section>
  )
}
