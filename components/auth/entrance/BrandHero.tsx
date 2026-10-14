import { ArrowLayer, BaseLayer, BaseOutlineLayer, ShineLayer, StaticEmblem } from './Emblem'
import styles from './entrance.module.css'

/**
 * 'pending' — before the client knows whether to play the intro (hidden; the
 *             intro's first frame is blank anyway, so nothing visibly jumps)
 * 'intro'   — the staged four-stage assembly, once per browser session
 * 'settled' — the finished mark, as the mobile login header shows it
 */
export type EntranceMode = 'pending' | 'intro' | 'settled'

// Web counterpart of landly-mobile/src/components/BrandHero.tsx: the vector
// emblem over a soft blue radial glow, the "Landly" wordmark and the slogan
// as live text, at the same sizes. The staged timings come from
// lib/brand/entranceTimeline.ts via entranceVars.ts.
export default function BrandHero({ mode }: { mode: EntranceMode }) {
  const intro = mode === 'intro'
  return (
    <div
      role="img"
      aria-label="Landly — Lifestyle & Growth"
      className={[styles.hero, intro && styles.intro, mode === 'pending' && styles.pending].filter(Boolean).join(' ')}
    >
      <div className={styles.glow} />

      <div className={styles.emblem}>
        {intro ? (
          <>
            <div className={`${styles.layer} ${styles.base}`}>
              {/* Two wrappers so the outline can fade in, hold, then fade out. */}
              <div className={`${styles.layer} ${styles.outlineIn}`}>
                <div className={`${styles.layer} ${styles.outlineOut}`}>
                  <BaseOutlineLayer />
                </div>
              </div>
              <div className={`${styles.layer} ${styles.fill}`}>
                <BaseLayer />
              </div>
            </div>
            {/* Grows out of its tail (bottom-left) so it reads as bursting out of the arch. */}
            <div className={`${styles.layer} ${styles.arrow}`}>
              <ArrowLayer />
            </div>
            <div className={styles.layer}>
              <ShineLayer />
            </div>
          </>
        ) : (
          <div className={styles.layer}>
            <StaticEmblem />
          </div>
        )}
      </div>

      {/* Intrinsic size for layout; displayed at 104x29.5 like mobile. */}
      <img src="/logo-wordmark.png" alt="" width={169} height={48} className={styles.wordmark} />
      <span className={styles.slogan}>LIFESTYLE &amp; GROWTH</span>
    </div>
  )
}
