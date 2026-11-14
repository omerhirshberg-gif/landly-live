/**
 * The admin brand title: "GoLandly Admin" as flat type, never in a pill. It is
 * always the English brand string, in both admin languages, and `dir="ltr"`
 * keeps the words in order inside the Hebrew (RTL) layout.
 */
export function AdminBrand({ className = 'text-lg' }: { className?: string }) {
  return (
    <bdi dir="ltr" className={`inline-flex items-baseline gap-1.5 leading-none ${className}`}>
      <span className="font-extrabold tracking-tight text-adm-text">GoLandly</span>
      <span className="font-medium text-adm-text-2">Admin</span>
    </bdi>
  )
}
