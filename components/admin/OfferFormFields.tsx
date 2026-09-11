export interface OfferFormValue {
  title: string
  description: string
  originalPrice: string
  offerPrice: string
  imageUrl: string
  expiryDate: string
  totalQuantity: string
  unlimited: boolean
  isBestseller: boolean
}

interface Props {
  value: OfferFormValue
  onChange: <K extends keyof OfferFormValue>(key: K, value: OfferFormValue[K]) => void
}

export default function OfferFormFields({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="sm:col-span-2">
        <label className="block mb-1.5 text-sm font-bold text-slate-300">Title</label>
        <input required className="inp inp-dark !py-3.5" value={value.title} onChange={(e) => onChange('title', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="block mb-1.5 text-sm font-bold text-slate-300">Description</label>
        <textarea className="inp inp-dark" rows={3} value={value.description} onChange={(e) => onChange('description', e.target.value)} />
      </div>
      <div>
        <label className="block mb-1.5 text-sm font-bold text-slate-300">Original price</label>
        <input
          type="number"
          min={0}
          step="0.01"
          required
          className="inp inp-dark !py-3.5"
          value={value.originalPrice}
          onChange={(e) => onChange('originalPrice', e.target.value)}
        />
      </div>
      <div>
        <label className="block mb-1.5 text-sm font-bold text-slate-300">Offer price</label>
        <input
          type="number"
          min={0}
          step="0.01"
          required
          className="inp inp-dark !py-3.5"
          value={value.offerPrice}
          onChange={(e) => onChange('offerPrice', e.target.value)}
        />
      </div>
      <div>
        <label className="block mb-1.5 text-sm font-bold text-slate-300">Expiry date</label>
        <input type="date" className="inp inp-dark !py-3.5" value={value.expiryDate} onChange={(e) => onChange('expiryDate', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="block mb-1.5 text-sm font-bold text-slate-300">Image URL</label>
        <input
          type="url"
          className="inp inp-dark !py-3.5"
          placeholder="https://... (link to an externally-hosted photo, e.g. Drive or Imgur)"
          value={value.imageUrl}
          onChange={(e) => onChange('imageUrl', e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block mb-1.5 text-sm font-bold text-slate-300">Total quantity</label>
        <input
          type="number"
          min={1}
          className="inp inp-dark !py-3.5 disabled:opacity-50"
          disabled={value.unlimited}
          value={value.totalQuantity}
          onChange={(e) => onChange('totalQuantity', e.target.value)}
        />
        <label className="mt-2.5 flex items-center gap-2 text-sm font-semibold text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={value.unlimited}
            onChange={(e) => onChange('unlimited', e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-brand focus:ring-brand"
          />
          Leave blank for unlimited
        </label>
      </div>
      <div className="sm:col-span-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={value.isBestseller}
            onChange={(e) => onChange('isBestseller', e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-brand focus:ring-brand"
          />
          Bestseller
        </label>
      </div>
    </div>
  )
}
