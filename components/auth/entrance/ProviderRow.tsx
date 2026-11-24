// The auth screen's sign-in providers as one stack of full-width buttons
// (ProviderTile), 12px apart. Children come in the order to show them
// (providerOrder in lib/auth/appleDevice.ts); the buttons' logos sit on the
// start edge, so an RTL page mirrors them with no extra work.
export default function ProviderRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 w-full">{children}</div>
}
