type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  service: string;
  timestamp: string;
  [key: string]: unknown;
}

const SERVICE_NAME = process.env.SERVICE_NAME || "korner-media-service";
const IS_PRODUCTION = process.env.ACTIVE_ENV === "prod";

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  if (!IS_PRODUCTION) {
    const prefix = `[${level.toUpperCase()}]`;
    if (meta && Object.keys(meta).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(meta)}`;
    }
    return `${prefix} ${message}`;
  }

  const entry: LogEntry = {
    level,
    message,
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (IS_PRODUCTION) return;
    console.debug(formatLog("debug", message, meta));
  },

  info(message: string, meta?: Record<string, unknown>) {
    console.log(formatLog("info", message, meta));
  },

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(formatLog("warn", message, meta));
  },

  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    const errorMeta: Record<string, unknown> = { ...meta };
    if (error instanceof Error) {
      errorMeta.error = error.message;
      errorMeta.stack = error.stack;
    } else if (error !== undefined) {
      errorMeta.error = String(error);
    }
    console.error(formatLog("error", message, errorMeta));
  },
};
