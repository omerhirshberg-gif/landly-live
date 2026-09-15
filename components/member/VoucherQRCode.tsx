'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// Rendered client-side via the browser <canvas> API (qrcode's toDataURL runs
// isomorphically) so nothing is precomputed or stored — one fewer field to
// keep in sync with the voucher doc, and no image blob in Firestore.
export default function VoucherQRCode({ voucherId }: { voucherId: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(`https://golandly.com/redeem/${voucherId}`, { margin: 1, width: 160 })
      .then((url) => { if (!cancelled) setDataUrl(url) })
      .catch(() => { if (!cancelled) setDataUrl(null) })
    return () => { cancelled = true }
  }, [voucherId])

  if (!dataUrl) {
    return <div className="w-[160px] h-[160px] rounded-lg bg-slate-100 animate-pulse" />
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="" width={160} height={160} className="rounded-lg" />
}
