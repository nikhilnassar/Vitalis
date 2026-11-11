import { KEYS, readJson, writeJson } from './storage';

/**
 * Privacy-safe error reporting.
 * - Errors are always kept in a small log on the phone (visible in You > Settings).
 * - If the user opts in AND a Sentry DSN is configured, anonymous crash reports are also sent.
 * - Reports never include health data, names, emails or IP-derived location.
 */
export interface LoggedError {
  t: number;
  where: string;
  message: string;
  stack?: string;
}

const MAX = 30;
let sentry: any = null;

export function initErrorReporting(optedIn: boolean) {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!optedIn || !dsn || sentry) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const S = require('@sentry/react-native');
    S.init({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      attachScreenshot: false,
      attachViewHierarchy: false,
      maxBreadcrumbs: 0,
      beforeSend(event: any) {
        delete event.user;
        delete event.request;
        delete event.breadcrumbs;
        delete event.contexts?.device?.name;
        // Messages from our own code can quote values; keep the type and where, drop the text.
        if (event.message) event.message = 'redacted';
        for (const ex of event.exception?.values ?? []) ex.value = (ex.value ?? '').replace(/[0-9]+(\.[0-9]+)?/g, '#').slice(0, 120);
        return event;
      },
    });
    sentry = S;
  } catch {
    /* reporting must never crash the app */
  }
}

export function reportError(e: unknown, where: string) {
  const err = e instanceof Error ? e : new Error(String(e));
  const entry: LoggedError = { t: Date.now(), where, message: err.message.slice(0, 300), stack: err.stack?.split('\n').slice(0, 6).join('\n') };
  readJson<LoggedError[]>(KEYS.errors, []).then((all) => writeJson(KEYS.errors, [...all, entry].slice(-MAX)));
  try {
    sentry?.withScope((scope: any) => {
      scope.setTag('where', where);
      sentry.captureException(err);
    });
  } catch {
    /* ignore */
  }
}

export const readErrorLog = () => readJson<LoggedError[]>(KEYS.errors, []);
export const clearErrorLog = () => writeJson(KEYS.errors, []);

/** Catch errors nobody handled. Safe to call more than once. */
export function installGlobalHandler() {
  const EU = (globalThis as any).ErrorUtils;
  if (!EU || (EU as any).__vitalis) return;
  const prev = EU.getGlobalHandler?.();
  EU.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    reportError(error, isFatal ? 'fatal' : 'uncaught');
    prev?.(error, isFatal);
  });
  (EU as any).__vitalis = true;
}
