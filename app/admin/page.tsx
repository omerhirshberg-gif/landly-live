import type { Metadata } from 'next'
import AdminDashboard from '@/components/admin/AdminDashboard'

// A template only applies to child segments, never to the page beside the
// layout that defines it -- so this title is spelled out in full.
export const metadata: Metadata = { title: { absolute: 'Dashboard | Landly Admin' } }

export default function AdminIndexPage() {
  return <AdminDashboard />
}
