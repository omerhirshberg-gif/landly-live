import { useEffect, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'

const COLORS = ['#0038b8', '#002a8a', '#10b981', '#f59e0b', '#ec4899', '#facc15']
const DURATION_MS = 3200
const COUNT = 48
// Pixels per second squared: what pulls the pieces back down.
const GRAVITY = 1100

interface Piece {
  x: number
  vx: number
  vy: number
  spin: number
  width: number
  height: number
  color: string
}

function makePieces(width: number): Piece[] {
  return Array.from({ length: COUNT }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4
    const speed = 650 + Math.random() * 650
    return {
      x: width / 2 + (Math.random() - 0.5) * width * 0.3,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: (Math.random() - 0.5) * 1440,
      width: 6 + Math.random() * 6,
      height: 4 + Math.random() * 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }
  })
}

// One celebratory burst for the order confirmation (app/order-success): paper
// pieces fly up from the lower middle of the screen, fall under gravity, spin
// and fade, then the layer removes itself after 3.2s. One shared clock drives
// every piece on the UI thread; the layer ignores touches. Skipped under the
// system's Reduce Motion. The website's counterpart is
// components/checkout/Confetti.tsx.
export default function Confetti() {
  const reduced = useReducedMotion()
  const { width, height } = useWindowDimensions()
  const [pieces] = useState(() => makePieces(width))
  const [done, setDone] = useState(false)
  const clock = useSharedValue(0)

  useEffect(() => {
    if (reduced) return
    clock.set(withTiming(1, { duration: DURATION_MS, easing: Easing.linear }))
    const timer = setTimeout(() => setDone(true), DURATION_MS)
    return () => clearTimeout(timer)
  }, [reduced, clock])

  if (reduced || done) return null
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} originY={height * 0.7} clock={clock} />
      ))}
    </View>
  )
}

function ConfettiPiece({ piece, originY, clock }: { piece: Piece; originY: number; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const progress = clock.get()
    const t = (progress * DURATION_MS) / 1000
    return {
      opacity: progress < 0.75 ? 1 : (1 - progress) / 0.25,
      transform: [
        { translateX: piece.x + piece.vx * t },
        { translateY: originY + piece.vy * t + 0.5 * GRAVITY * t * t },
        { rotate: `${piece.spin * t}deg` },
      ],
    }
  })
  return <Animated.View style={[styles.piece, { width: piece.width, height: piece.height, backgroundColor: piece.color }, style]} />
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, left: 0, borderRadius: 1 },
})
