/**
 * RemoteLogger — Buffers log events and flushes them to the dashboard API.
 * Same interface as the existing `log` utility (header, section, info, warn, error)
 * so it's a drop-in replacement. Console output is preserved.
 */

interface LogEvent {
  run_id: string;
  agent: string;
  level: "info" | "warn" | "error" | "header" | "section";
  message: string;
  meta: Record<string, unknown> | null;
}

interface RemoteLoggerConfig {
  appBaseUrl: string;
  runId: string;
  agent: string;
  flushIntervalMs?: number;
  maxBufferSize?: number;
}

export class RemoteLogger {
  private buffer: LogEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private config: Required<RemoteLoggerConfig>;

  constructor(config: RemoteLoggerConfig) {
    this.config = {
      flushIntervalMs: 5000,
      maxBufferSize: 10,
      ...config,
    };

    this.timer = setInterval(() => this.flush(), this.config.flushIntervalMs);
  }

  /** Create a child logger for a specific agent (shares the same runId and config). */
  child(agent: string): RemoteLogger {
    return new RemoteLogger({
      ...this.config,
      agent,
    });
  }

  header(msg: string) {
    console.log(`\n${"═".repeat(60)}\n  ${msg}\n${"═".repeat(60)}`);
    this.enqueue("header", msg);
  }

  section(msg: string) {
    console.log(`\n── ${msg} ${"─".repeat(Math.max(0, 55 - msg.length))}`);
    this.enqueue("section", msg);
  }

  info(msg: string, meta?: Record<string, unknown>) {
    console.log(`  [INFO] ${msg}`);
    this.enqueue("info", msg, meta);
  }

  warn(msg: string, meta?: Record<string, unknown>) {
    console.log(`  [WARN] ${msg}`);
    this.enqueue("warn", msg, meta);
  }

  error(msg: string, meta?: Record<string, unknown>) {
    console.error(`  [ERROR] ${msg}`);
    this.enqueue("error", msg, meta);
  }

  private enqueue(
    level: LogEvent["level"],
    message: string,
    meta?: Record<string, unknown>
  ) {
    this.buffer.push({
      run_id: this.config.runId,
      agent: this.config.agent,
      level,
      message,
      meta: meta ?? null,
    });

    if (this.buffer.length >= this.config.maxBufferSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      const res = await fetch(
        `${this.config.appBaseUrl}/api/activity/batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events }),
        }
      );

      if (!res.ok) {
        console.warn(
          `[RemoteLogger] Flush failed (${res.status}): ${await res.text().catch(() => "unknown")}`
        );
      }
    } catch (err) {
      console.warn(`[RemoteLogger] Flush error: ${err}`);
      // Don't crash — logging failures should never break the orchestrator
    }
  }

  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}
