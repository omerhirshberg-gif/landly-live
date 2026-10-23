'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { voucherRedeemUrl } from '@/lib/firebase/vouchers'

// Rendered client-side via the browser <canvas> API (qrcode's toDataURL runs
// isomorphically) so nothing is precomputed or stored — one fewer field to
// keep in sync with the voucher doc, and no image blob in Firestore. Drawn at
// twice its size, black on white, so it stays sharp for a cashier's scanner.
export default function VoucherQRCode({ redeemKey, size = 160 }: { redeemKey: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(voucherRedeemUrl(redeemKey), { margin: 1, width: size * 2, color: { dark: '#000000', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setDataUrl(url) })
      .catch(() => { if (!cancelled) setDataUrl(null) })
    return () => { cancelled = true }
  }, [redeemKey, size])

  if (!dataUrl) {
    return <div style={{ width: size, height: size }} className="rounded-lg bg-slate-100 animate-pulse" />
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="" width={size} height={size} className="rounded-lg" />
}
