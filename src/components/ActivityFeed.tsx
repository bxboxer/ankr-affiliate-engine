"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  RiCheckLine,
  RiAlertLine,
  RiErrorWarningLine,
  RiArrowDownLine,
} from "react-icons/ri";

interface ActivityEvent {
  id: string;
  run_id: string;
  agent: string;
  level: "info" | "warn" | "error" | "header" | "section";
  message: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EventRow({ event }: { event: ActivityEvent }) {
  const time = formatTime(event.created_at);

  if (event.level === "header") {
    return (
      <div className="border-b border-base-300 pb-1 pt-2">
        <span className="font-mono text-xs text-base-content/40">{time}</span>
        <span className="ml-3 font-bold text-primary">{event.message}</span>
      </div>
    );
  }

  if (event.level === "section") {
    return (
      <div className="pt-1.5">
        <span className="font-mono text-xs text-base-content/40">{time}</span>
        <span className="ml-3 font-semibold text-base-content/80">
          {event.message}
        </span>
      </div>
    );
  }

  const levelStyles: Record<string, { icon: React.ReactNode; cls: string }> = {
    info: {
      icon: <RiCheckLine className="h-3 w-3" />,
      cls: "text-base-content/70",
    },
    warn: {
      icon: <RiAlertLine className="h-3 w-3" />,
      cls: "text-warning",
    },
    error: {
      icon: <RiErrorWarningLine className="h-3 w-3" />,
      cls: "text-error",
    },
  };

  const style = levelStyles[event.level] ?? levelStyles.info;

  return (
    <div
      className={`flex items-start gap-2 py-0.5 text-sm ${
        event.level === "error" ? "rounded bg-error/10 px-2 py-1" : ""
      }`}
    >
      <span className="font-mono text-xs text-base-content/40 shrink-0">
        {time}
      </span>
      <span className={`shrink-0 mt-0.5 ${style.cls}`}>{style.icon}</span>
      <span className={style.cls}>{event.message}</span>
    </div>
  );
}

export function ActivityFeed({
  agent,
  limit = 30,
}: {
  agent?: string;
  limit?: number;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const initialFetchDone = useRef(false);

  const fetchEvents = useCallback(async () => {
    const params = new URLSearchParams();
    if (agent) params.set("agent", agent);
    params.set("limit", String(limit));

    if (initialFetchDone.current && lastTimestampRef.current) {
      params.set("since", lastTimestampRef.current);
    }

    try {
      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) return;

      const newEvents: ActivityEvent[] = await res.json();
      if (newEvents.length === 0) {
        // No new events — check if feed was live recently
        if (isLive) {
          const lastEvent = events[events.length - 1];
          if (lastEvent) {
            const age = Date.now() - new Date(lastEvent.created_at).getTime();
            if (age > 60_000) setIsLive(false);
          }
        }
        return;
      }

      // Events come DESC from API — reverse for chronological display
      const chronological = [...newEvents].reverse();

      if (!initialFetchDone.current) {
        setEvents(chronological);
        initialFetchDone.current = true;
      } else {
        setEvents((prev) => [...prev, ...chronological].slice(-200));
      }

      // Track the most recent timestamp (first item from DESC query)
      lastTimestampRef.current = newEvents[0].created_at;
      setIsLive(true);
    } catch {
      // Silently ignore fetch errors
    }
  }, [agent, limit, events, isLive]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [agent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  function handleScroll() {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  }

  if (events.length === 0) {
    return (
      <div className="card bg-base-100">
        <div className="card-body p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-base-content/60">
              Activity Feed
            </h3>
            <span className="flex items-center gap-1.5 text-xs text-base-content/40">
              <span className="h-1.5 w-1.5 rounded-full bg-base-content/20" />
              Waiting
            </span>
          </div>
          <p className="text-xs text-base-content/40 mt-1">
            No recent activity. Trigger an orchestrator run to see live
            progress.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100">
      <div className="card-body p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-base-content/60">
            Activity Feed
          </h3>
          <span className="flex items-center gap-1.5 text-xs text-base-content/40">
            {isLive ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                Live
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-base-content/30" />
                Idle
              </>
            )}
          </span>
        </div>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="max-h-[400px] overflow-y-auto space-y-0.5"
        >
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>

        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (containerRef.current) {
                containerRef.current.scrollTop =
                  containerRef.current.scrollHeight;
              }
            }}
            className="btn btn-ghost btn-xs gap-1 mt-1 self-center"
          >
            <RiArrowDownLine className="h-3 w-3" />
            Scroll to latest
          </button>
        )}
      </div>
    </div>
  );
}
