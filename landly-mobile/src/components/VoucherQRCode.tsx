import { useMemo } from 'react'
import QRCode from 'qrcode'
import Svg, { Path, Rect } from 'react-native-svg'
import { voucherRedeemUrl } from '@shared/firebase/vouchers'

// Native counterpart of components/member/VoucherQRCode.tsx: same encoded
// URL, drawn as SVG (there's no <canvas> here). qrcode's matrix builder is
// pure JS, so the code is computed on-device and nothing is stored.
const MARGIN = 1

export default function VoucherQRCode({ voucherId, size = 180 }: { voucherId: string; size?: number }) {
  const { path, dimension } = useMemo(() => {
    const { modules } = QRCode.create(voucherRedeemUrl(voucherId), {})
    let d = ''
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) d += `M${col + MARGIN} ${row + MARGIN}h1v1h-1z`
      }
    }
    return { path: d, dimension: modules.size + MARGIN * 2 }
  }, [voucherId])

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${dimension} ${dimension}`} accessibilityLabel="QR code">
      <Rect width={dimension} height={dimension} fill="#ffffff" />
      <Path d={path} fill="#000000" />
    </Svg>
  )
}
