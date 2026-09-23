import { vi } from 'vitest'

// The production guard remains in place; tests execute server modules in Node.
vi.mock('server-only', () => ({}))
