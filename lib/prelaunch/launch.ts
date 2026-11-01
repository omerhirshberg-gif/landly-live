// The launch moment and the countdown to it. Midnight in Israel, written with
// its offset so every visitor counts down to the same instant. Pure, so the
// arithmetic is tested without a clock.
export const LAUNCH_AT = new Date('2027-01-01T00:00:00+02:00')

export interface Countdown {
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** What's left until `target`, or null once it has passed. */
export function countdownTo(nowMs: number, target: number = LAUNCH_AT.getTime()): Countdown | null {
  const left = Math.floor((target - nowMs) / 1000)
  if (left <= 0) return null
  return {
    days: Math.floor(left / 86400),
    hours: Math.floor(left / 3600) % 24,
    minutes: Math.floor(left / 60) % 60,
    seconds: left % 60,
  }
}
