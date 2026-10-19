import { EMBLEM_AXIS_X, EMBLEM_VIEWBOX } from '@/lib/brand/emblemPaths'
import { WORDMARK_COLOR, WORDMARK_PATH, WORDMARK_VIEWBOX } from '@/lib/brand/wordmarkPath'
import { ArrowLayer, BaseLayer, BaseOutlineLayer, ShineLayer, StaticEmblem } from './Emblem'
import styles from './entrance.module.css'

/**
 * 'pending' — before the client knows whether to play the intro (hidden; the
 *             intro's first frame is blank anyway, so nothing visibly jumps)
 * 'intro'   — the staged four-stage assembly, each time the screen opens
 * 'settled' — the finished mark, as the mobile login header shows it
 */
export type EntranceMode = 'pending' | 'intro' | 'settled'

// Web counterpart of landly-mobile/src/components/BrandHero.tsx: the vector
// emblem, the vector "Landly" wordmark and the slogan as live text, at the
// same sizes. The staged timings come from
// lib/brand/entranceTimeline.ts via entranceVars.ts.

const EMBLEM_WIDTH = 112 // .emblem in entrance.module.css
// The emblem box is offset so the star's axis, not the box (whose right side
// holds the arrow's reach), sits over the centre of the text, as in the master
// logo. Rounded to a whole pixel.
const EMBLEM_SHIFT = Math.round(((EMBLEM_VIEWBOX.width / 2 - EMBLEM_AXIS_X) * EMBLEM_WIDTH) / EMBLEM_VIEWBOX.width)
const WORDMARK_VB = `${WORDMARK_VIEWBOX.x} ${WORDMARK_VIEWBOX.y} ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`
export default function BrandHero({ mode }: { mode: EntranceMode }) {
  const intro = mode === 'intro'
  return (
    <div
      role="img"
      aria-label="Landly — Lifestyle & Growth"
      className={[styles.hero, intro && styles.intro, mode === 'pending' && styles.pending].filter(Boolean).join(' ')}
    >
      <div className={styles.emblem} style={{ left: EMBLEM_SHIFT }}>
        {/* A soft brand glow behind the mark: it swells in with the intro,
            peaks as the shine passes and settles faint (.glow). */}
        <span aria-hidden="true" className={styles.glow} />
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

      <svg viewBox={WORDMARK_VB} className={styles.wordmark} shapeRendering="geometricPrecision" aria-hidden="true" focusable="false">
        <path d={WORDMARK_PATH} fill={WORDMARK_COLOR} />
      </svg>
      <span className={styles.slogan}>LIFESTYLE &amp; GROWTH</span>
    </div>
  )
}
