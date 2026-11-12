'use client'

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Heart, X } from 'lucide-react'
import AnchoredPanel from './AnchoredPanel'
import { getOffersByIds, type OfferDocument } from '@/lib/firebase/offers'
import { useWishlist } from '@/lib/firebase/useWishlist'
import { localizedBusinessName } from '@/lib/business/businessText'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { formatPrice } from '@/lib/format'
import { useLang } from '@/lib/i18n/useLang'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'

// A bottom sheet below 1024px (the hamburger drawer owns the side), a popover from there.
const SHEET_QUERY = '(max-width: 1023px)'

function useIsSheet(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(SHEET_QUERY)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false
  )
}

/** The badge's text: the count, capped at 99+. */
export function wishlistBadgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count)
}

// The members' heart in the navbar, beside the avatar: the saved perks open
// right there (a popover from 1024px, a bottom sheet below it), so the wishlist
// is a glance away and not a page trip. /wishlist stays as the direct link. The
// count badge shows only when something is saved. The offers are read when it
// is first opened and re-read as the saved ids change; removing one drops the
// row at once.
export default function WishlistPopover() {
  const { t } = useLang()
  const { wishlistIds, wishlistCount } = useWishlist()
  const isSheet = useIsSheet()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const close = useCallback((returnFocus = false) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  useBodyScrollLock(open && isSheet)

  const title = t('wishlist_popover_title')
  const content = <WishlistList ids={wishlistIds} count={wishlistCount} title={title} onNavigate={() => close()} onClose={isSheet ? () => close(true) : undefined} />

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={wishlistCount > 0 ? `${t('nav_wishlist')} (${wishlistCount})` : t('nav_wishlist')}
        onClick={() => setOpen((v) => !v)}
        className="tap-target relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-ink transition-colors [-webkit-tap-highlight-color:transparent] [@media(hover:hover)]:hover:bg-slate-50"
      >
        <Heart aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {wishlistCount > 0 && (
          <span className="absolute -top-1 -end-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold leading-none text-white">
            <bdi dir="ltr" className="tabular-nums">{wishlistBadgeLabel(wishlistCount)}</bdi>
          </span>
        )}
      </button>

      {!isSheet && (
        <AnchoredPanel open={open} onClose={close} anchorRef={triggerRef} width={380} maxHeight={480} dir="ltr" role="dialog" label={title} id={panelId} className="flex flex-col !overflow-hidden">
          {content}
        </AnchoredPanel>
      )}

      {isSheet &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[1001]">
            <div aria-hidden="true" onClick={() => close()} className="perks-scrim absolute inset-0 bg-ink/30" />
            <div
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              onKeyDown={(e) => e.key === 'Escape' && close(true)}
              className="perks-sheet absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl bg-white antialiased pb-[env(safe-area-inset-bottom)]"
            >
              <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 flex-shrink-0 rounded-full bg-slate-300" />
              {content}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

// The panel body, in the page's reading direction: a header (title, count), then the saved perks, or the empty state.
function WishlistList({ ids, count, title, onNavigate, onClose }: { ids: string[]; count: number; title: string; onNavigate: () => void; onClose?: () => void }) {
  const { t, lang, isRtl } = useLang()
  const { toggleWishlist } = useWishlist()
  const [offers, setOffers] = useState<OfferDocument[] | null>(null)
  const key = ids.join(',')

  useEffect(() => {
    let cancelled = false
    if (ids.length === 0) {
      setOffers([])
      return
    }
    getOffersByIds(ids)
      .then((found) => {
        if (!cancelled) setOffers(found)
      })
      .catch(() => {
        if (!cancelled) setOffers([])
      })
    return () => {
      cancelled = true
    }
    // `key` stands for the ids: a new array with the same ids is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // A row removed here leaves at once, before the read catches up.
  const rows = offers?.filter((o) => ids.includes(o.id)) ?? null

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="flex min-h-0 flex-1 flex-col font-sans">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3">
        <h2 className="flex items-baseline gap-2 font-display text-sm font-bold text-ink">
          <span>{title}</span>
          {count > 0 && <bdi dir="ltr" className="text-xs font-semibold tabular-nums text-[#475569]">{count}</bdi>}
        </h2>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={t('cats_filter_show')} className="-me-2 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 [@media(hover:hover)]:hover:bg-slate-100">
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {rows === null ? (
          <ul aria-hidden="true" className="space-y-1 p-2">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl p-2">
                <div className="h-12 w-12 flex-shrink-0 animate-pulse rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                </div>
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF] text-brand">
              <Heart aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="mt-3 text-sm font-bold text-ink">{t('wishlist_empty_title')}</p>
            <p className="mt-1 text-xs text-[#475569]">{t('wishlist_empty_sub')}</p>
            <Link href="/categories" onClick={onNavigate} className="ds-btn ds-btn-primary mt-4 min-h-11 rounded-full px-6 text-sm">
              {t('wishlist_popover_browse')}
            </Link>
          </div>
        ) : (
          <ul className="p-2">
            {rows.map((offer) => (
              <WishlistRow key={offer.id} offer={offer} lang={lang} onNavigate={onNavigate} onRemove={() => toggleWishlist(offer.id)} removeLabel={t('wishlist_popover_remove')} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function WishlistRow({ offer, lang, onNavigate, onRemove, removeLabel }: { offer: OfferDocument; lang: ReturnType<typeof useLang>['lang']; onNavigate: () => void; onRemove: () => void; removeLabel: string }) {
  const title = localizeText(offer.title, offer.translations, lang, 'title').text
  const business = localizedBusinessName(offer, lang).text
  const discounted = offer.originalPrice > offer.offerPrice
  return (
    <li className="group flex items-center gap-1 rounded-xl transition-colors [@media(hover:hover)]:hover:bg-[#F0F7FF]">
      <Link href={`/offers/${offer.id}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-start">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          {offer.imageUrl ? (
            <img src={offer.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <Heart aria-hidden="true" className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-normal text-[#475569]">{business}</span>
          <span className="block truncate text-sm font-semibold leading-snug text-ink">{title}</span>
          <span className="mt-0.5 flex items-baseline gap-2">
            <bdi dir="ltr" className="text-sm font-bold tabular-nums text-brand">{formatPrice(offer.offerPrice)}</bdi>
            {discounted && <bdi dir="ltr" className="text-xs tabular-nums text-slate-400 line-through">{formatPrice(offer.originalPrice)}</bdi>}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${removeLabel}: ${title}`}
        className="me-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-brand transition-colors [@media(hover:hover)]:hover:bg-white"
      >
        <Heart aria-hidden="true" className="h-[18px] w-[18px] fill-current" strokeWidth={1.75} />
      </button>
    </li>
  )
}
