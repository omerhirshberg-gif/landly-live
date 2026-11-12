import { useEffect, useState } from 'react'
import { greetingPeriod, type GreetingPeriod } from '@/lib/auth/greeting'

// The member's local time-of-day period (lib/auth/greeting.ts), or null until
// the first effect: the server has no idea of the member's time zone, so it
// never renders a period (the greeting is hidden until the profile has loaded
// anyway). Re-read every minute, so a page left open rolls over at the hour.
export function useGreetingPeriod(): GreetingPeriod | null {
  const [period, setPeriod] = useState<GreetingPeriod | null>(null)
  useEffect(() => {
    const read = () => setPeriod(greetingPeriod(new Date().getHours()))
    read()
    const timer = setInterval(read, 60_000)
    return () => clearInterval(timer)
  }, [])
  return period
}
