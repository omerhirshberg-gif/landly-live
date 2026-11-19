export const after = (task) => { Promise.resolve().then(typeof task === 'function' ? task : () => task).catch(() => {}) }
export class NextResponse {}
