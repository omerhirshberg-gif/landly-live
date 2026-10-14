import Link from 'next/link'
import Notice from './entrance/Notice'

// Shown by the auth screen when the account that just signed in is a
// business login (see signOutIfBusinessAccount in lib/firebase/businesses.ts).
// Same layout as the mobile app: the notice, then a centered link below it.
export default function BusinessAccountNotice({ message, linkLabel }: { message: string; linkLabel: string }) {
  return (
    <div className="mb-4">
      <Notice>{message}</Notice>
      <p className="-mt-1 text-center">
        <Link href="/business/login" className="text-sm font-bold text-brand hover:underline">
          {linkLabel}
        </Link>
      </p>
    </div>
  )
}
