// Secret-redacting logger. Snapshots every env value that looks like a
// secret at install time, then monkey-patches console.{log,error,warn,info,
// debug} so any stringified output that contains one of those values is
// rewritten with [REDACTED] before printing.
//
// Wired in apps/api/src/server.ts at startup (after dotenv but before
// migrations / route registration). Bot has its own equivalent — call
// installRedactor() there too if/when adopted.
//
// Why monkey-patch instead of a custom logger object: the existing codebase
// has 20+ console.* call sites. Patching at the boundary catches all of them
// (including third-party libraries that log via console) without refactoring.

const SECRET_KEY_PATTERN = /(_TOKEN|_SECRET|_KEY|_PASSWORD)$/i;
const MIN_SECRET_LENGTH = 12;

let installed = false;
const SECRETS: string[] = [];

export function installRedactor(): void {
  if (installed) return;
  installed = true;

  for (const [key, value] of Object.entries(process.env)) {
    if (!value || value.length < MIN_SECRET_LENGTH) continue;
    if (SECRET_KEY_PATTERN.test(key)) {
      SECRETS.push(value);
    }
    if (key === "DATABASE_URL") {
      // Extract password segment from postgres://user:pass@host/db
      const match = value.match(/^[a-z+]+:\/\/[^:@]+:([^@]+)@/i);
      if (match && match[1].length >= 4) SECRETS.push(match[1]);
    }
  }
  // Longest-first prevents a long secret being missed when a shorter prefix
  // of it (improbable but possible with weak keys) gets redacted first.
  SECRETS.sort((a, b) => b.length - a.length);

  const methods = ["log", "error", "warn", "info", "debug"] as const;
  for (const m of methods) {
    const original = console[m].bind(console);
    console[m] = (...args: unknown[]) => {
      original(...args.map(redact));
    };
  }
}

function redact(value: unknown): unknown {
  if (typeof value === "string") return scrub(value);
  if (value instanceof Error) {
    // Errors don't survive JSON; preserve message + stack with scrubbing.
    const next = new Error(scrub(value.message));
    if (value.stack) next.stack = scrub(value.stack);
    if (value.cause !== undefined) (next as Error & { cause?: unknown }).cause = redact(value.cause);
    return next;
  }
  if (value && typeof value === "object") {
    try {
      return JSON.parse(scrub(JSON.stringify(value)));
    } catch {
      // Circular / non-serializable; fall back to toString redaction.
      return scrub(String(value));
    }
  }
  return value;
}

function scrub(text: string): string {
  if (SECRETS.length === 0) return text;
  let out = text;
  for (const secret of SECRETS) {
    if (out.includes(secret)) {
      out = out.split(secret).join("[REDACTED]");
    }
  }
  return out;
}

/** Test-only — returns the number of registered secrets. Not exported in prod use. */
export function _secretCount(): number {
  return SECRETS.length;
}
