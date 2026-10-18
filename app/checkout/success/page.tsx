import { redirect } from 'next/navigation'

// The order confirmation moved to /order-success. This route stays as the
// return URL payment providers and older links already point at; it keeps
// the orderId and nothing else, since the page trusts only Firestore.
export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ orderId?: string | string[] }> }) {
  const { orderId } = await searchParams
  const id = Array.isArray(orderId) ? orderId[0] : orderId
  redirect(id ? `/order-success?orderId=${encodeURIComponent(id)}` : '/order-success')
}
