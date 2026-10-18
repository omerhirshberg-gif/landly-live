import AboutPage from '@/components/about/AboutPage'

// /about, public. Its metadata lives in layout.tsx; the page is the client
// AboutPage (it reads the language and whether a member is signed in).
export default function Page() {
  return <AboutPage />
}
