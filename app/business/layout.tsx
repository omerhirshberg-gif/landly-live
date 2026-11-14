import type { Metadata } from 'next'

// Business pages read "<page> | GoLandly Business"; /business itself (a client
// page) gets the default. Absolute, so the root "%s | GoLandly" template isn't
// appended to it.
export const metadata: Metadata = {
  title: { absolute: 'Business Portal | GoLandly Business', template: '%s | GoLandly Business' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
