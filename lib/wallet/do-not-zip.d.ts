// do-not-zip ships no types; lib/wallet/applePass.ts uses this one call.
declare module 'do-not-zip' {
  export function toBuffer(files: { path: string; data: string | number[] }[]): Buffer
}
