/* Minimal safe logger */
export function safeLog(...args: any[]) {
  try {
    console.log(...args);
  } catch {
    /* ignore */
  }
}

export function safeError(...args: any[]) {
  try {
    console.error(...args);
  } catch {
    /* ignore */
  }
}
