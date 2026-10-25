import BackButton from './BackButton'

// Deliberately NOT router.back()/browser history -- that leaks whatever tab
// the user happened to be on before jumping to this section via the
// sidebar. Each caller passes its own section's fixed parent route instead,
// so "Back" always stays within the current section regardless of how the
// user actually arrived here. (The browser's own back and edge swipe still
// step through history as usual.)
export default function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <BackButton href={href} className="-ms-3 mb-2">
      {children}
    </BackButton>
  )
}
