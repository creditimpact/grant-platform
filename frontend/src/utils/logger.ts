export function safeLog(message: string, data?: unknown) {
  if (process.env.NODE_ENV === 'production') return;
  if (data !== undefined) {
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      console.log(message, str.slice(0, 100));
    } catch {
      console.log(message);
    }
  } else {
    console.log(message);
  }
}

export function safeError(message: string, data?: unknown) {
  if (process.env.NODE_ENV === 'production') return;
  if (data !== undefined) {
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      console.error(message, str.slice(0, 100));
    } catch {
      console.error(message);
    }
  } else {
    console.error(message);
  }
}

export function safeWarn(message: string, data?: unknown) {
  if (process.env.NODE_ENV === 'production') return;
  if (data !== undefined) {
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      console.warn(message, str.slice(0, 100));
    } catch {
      console.warn(message);
    }
  } else {
    console.warn(message);
  }
}
