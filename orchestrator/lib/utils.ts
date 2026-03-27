export interface Logger {
  header(msg: string): void;
  section(msg: string): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export const log: Logger = {
  header: (msg: string) => console.log(`\n${"═".repeat(60)}\n  ${msg}\n${"═".repeat(60)}`),
  section: (msg: string) => console.log(`\n── ${msg} ${"─".repeat(Math.max(0, 55 - msg.length))}`),
  info: (msg: string) => console.log(`  [INFO] ${msg}`),
  warn: (msg: string) => console.log(`  [WARN] ${msg}`),
  error: (msg: string) => console.error(`  [ERROR] ${msg}`),
};
