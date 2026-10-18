import Navbar from '@/components/layout/Navbar'
import { NotFoundContent } from '@/components/errors/ErrorScreen'

// Unmatched URLs and notFound() calls. Next adds the 404 status and a
// noindex robots tag on its own.
export default function NotFound() {
  return (
    <>
      <Navbar />
      <NotFoundContent />
    </>
  )
}
