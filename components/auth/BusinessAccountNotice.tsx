import Link from 'next/link'

// Shown by /login and /signup when the account that just signed in is a
// business login (see signOutIfBusinessAccount in lib/firebase/businesses.ts).
export default function BusinessAccountNotice({ message, linkLabel }: { message: string; linkLabel: string }) {
  return (
    <div className="mb-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
      {message}{' '}
      <Link href="/business/login" className="text-brand font-bold hover:underline">{linkLabel}</Link>
    </div>
  )
}
