import type { Metadata } from 'next'

// Business pages read "<page> | Landly Business"; /business itself (a client
// page) gets the default. Absolute, so the root "%s | Landly" template isn't
// appended to it.
export const metadata: Metadata = {
  title: { absolute: 'Business Portal | Landly Business', template: '%s | Landly Business' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
