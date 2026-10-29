import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from './formStyles'

/** The business's optional contact phone, for the call and WhatsApp buttons on its page. Checked and stored as E.164 by the server. */
export default function BusinessPhoneField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className={ADMIN_LABEL}>
        Phone <span className="font-normal text-[#94A3B8]">(optional)</span>
      </label>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        dir="ltr"
        autoComplete="off"
        placeholder="03-123-4567"
        className={ADMIN_INPUT}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className={ADMIN_HINT}>An Israeli number, or any number with its +country code. Not shown to members.</p>
    </div>
  )
}
