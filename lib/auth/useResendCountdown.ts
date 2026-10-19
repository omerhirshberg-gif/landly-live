'use client'

import { useCallback, useEffect, useState } from 'react'

// The OTP dialog's "Resend code in 42s" (web OtpDialog, app OtpSheet).
// Counts from a deadline rather than ticking a counter, so a backgrounded tab
// or app shows the right time again as soon as it's back.
export function useResendCountdown(initialSeconds: number) {
  const [deadline, setDeadline] = useState(() => Date.now() + initialSeconds * 1000)
  const [now, setNow] = useState(() => Date.now())
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000))
  const running = secondsLeft > 0

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])

  const restart = useCallback((seconds: number) => {
    const at = Date.now()
    setNow(at)
    setDeadline(at + seconds * 1000)
  }, [])

  return { secondsLeft, restart }
}
