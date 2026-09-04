// Shared marketing side-panel for the split-screen auth pages (signup/login).
// Deliberately headline + supporting copy only — no stats row, since we have
// no real numbers to back a rating/user-count/business-count claim.
export default function AuthMarketingPanel({
  headline,
  sub,
}: {
  headline: string
  sub: string
}) {
  return (
    <div className="hidden lg:flex flex-1 bg-brand items-center justify-center px-12 xl:px-20 py-12">
      <div className="max-w-md">
        <h2 className="text-3xl xl:text-4xl font-black text-white leading-tight mb-5">
          {headline}
        </h2>
        <p className="text-base text-white/80 leading-relaxed">
          {sub}
        </p>
      </div>
    </div>
  )
}
