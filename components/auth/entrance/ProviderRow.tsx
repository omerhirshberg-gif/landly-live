// The auth screen's sign-in providers in one centred row of equal tiles
// (ProviderTile). Children come in the order to show them (providerOrder in
// lib/auth/appleDevice.ts); a row in an RTL page runs right to left, so
// Hebrew mirrors it with no extra work.
export default function ProviderRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-row gap-3 justify-center items-center">{children}</div>
}
