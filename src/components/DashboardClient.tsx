"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn, deriveInitials } from "@/lib/utils";
import JoinByCodeForm from "@/components/ui/JoinByCodeForm";
import { useRuns, useCloseRunMutation, type RunSummary } from "@/hooks/use-run";
import { useHostStatus, useRequestHostMutation } from "@/hooks/use-host-request";
import { signOut } from "@/app/(auth)/actions";
import {
  Plus,
  ChevronRight,
  ArrowRight,
  LogOut,
  User,
  Clock,
  Sparkles,
  History,
  Zap,
} from "lucide-react";

type InitialUser = {
  id: string;
  email: string;
  metadata: Record<string, unknown> | undefined;
};

export type DashboardClientProps = {
  initialUser: InitialUser;
};

type DashboardRun = Pick<
  RunSummary,
  "id" | "name" | "location" | "status" | "sessionCode" | "gameCount" | "isHost"
>;

function mapRuns(runs: RunSummary[]): DashboardRun[] {
  return runs.map((r) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    status: r.status,
    sessionCode: r.sessionCode,
    gameCount: r.gameCount,
    isHost: r.isHost,
  }));
}

function firstNameFrom(metadata: Record<string, unknown> | undefined): string {
  const name =
    (metadata?.displayName as string | undefined) ||
    (metadata?.display_name as string | undefined) ||
    (metadata?.full_name as string | undefined) ||
    "";
  const trimmed = name.trim();
  return trimmed ? trimmed.split(/\s+/)[0] : "";
}

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// BallRuns logo mark — accent chip with a basketball glyph (source: /public/logo.svg).
function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid place-items-center rounded-[7px] bg-accent", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="" aria-hidden="true" className="h-[67%] w-[67%]" />
    </span>
  );
}

// Live run — the primary "you're in something right now" card.
function ActiveRunCard({ run, onEnter }: { run: DashboardRun; onEnter: () => void }) {
  return (
    <button
      onClick={onEnter}
      className={cn(
        "group relative w-full overflow-hidden text-left",
        "rounded-lg border border-border-accent border-l-[3px] border-l-accent",
        "bg-gradient-to-br from-accent/[0.08] via-accent/[0.03] to-transparent",
        "p-5 transition-all duration-150 hover:border-accent/60 lg:p-7",
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-accent/[0.08] blur-[70px]" />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-[7px] w-[7px] flex-shrink-0 animate-live-pulse rounded-full bg-success" />
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-accent-dim">
            {run.isHost ? "Live · You're hosting" : "Live · You're in"}
          </span>
        </div>
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">
          {run.gameCount} {run.gameCount === 1 ? "Game" : "Games"}
        </span>
      </div>

      <div className="relative mt-4 flex flex-col gap-1.5">
        <span className="font-display text-[30px] font-extrabold uppercase leading-[0.95] tracking-[0.01em] text-text-primary lg:text-[42px]">
          {run.name}
        </span>
        {run.location && (
          <span className="font-body text-[13px] font-medium uppercase tracking-[0.04em] text-text-muted">
            {run.location}
          </span>
        )}
      </div>

      <div className="relative mt-6 flex items-center gap-2 font-display text-[13px] font-extrabold uppercase tracking-[0.1em] text-accent">
        Enter Run
        <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
      </div>
    </button>
  );
}

// Start a Run — the host's primary call to action. Lime by design; kept compact
// so it reads as one action, not a billboard.
function StartRunCard({ onStart }: { onStart: () => void }) {
  return (
    <button
      onClick={onStart}
      className={cn(
        "group flex w-full items-center justify-between gap-4 rounded-lg bg-accent p-5 text-left text-bg",
        "transition-all duration-150 hover:-translate-y-px hover:shadow-[0_0_32px_-10px_rgba(200,241,53,0.6)] active:scale-[0.99]",
      )}
    >
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-md bg-bg/10 transition-transform duration-150 group-hover:-translate-y-0.5">
          <Plus className="h-5 w-5" strokeWidth={2.75} />
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-display text-[22px] font-extrabold uppercase leading-none tracking-[0.02em]">
            Start a Run
          </span>
          <span className="font-body text-[13px] font-medium leading-[1.4] text-bg/70">
            Set the format and tip off.
          </span>
        </div>
      </div>
      <ArrowRight className="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:translate-x-1" />
    </button>
  );
}

// Join-by-code panel. `hero` gives it more presence when it's the primary action (players).
function JoinPanel({ hero = false }: { hero?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-bg-surface",
        hero ? "p-5 lg:p-7" : "p-5 lg:p-6",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-0.5 rounded-sm bg-accent" />
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">
          Join a run
        </span>
      </div>
      {hero && (
        <span className="font-display text-[24px] font-extrabold uppercase leading-[0.95] tracking-[0.01em] text-text-primary lg:text-[30px]">
          Got a code? Jump in.
        </span>
      )}
      <JoinByCodeForm />
      <span className="font-body text-[12.5px] leading-[1.5] text-text-muted">
        Enter the run code your host shared — no wait, straight to the court.
      </span>
    </div>
  );
}

function HistoryCard({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-bg-surface p-5 text-left transition-colors hover:bg-bg-hover"
    >
      <div className="flex items-center gap-3.5">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-md border border-border bg-bg-raised text-text-secondary transition-colors group-hover:border-border-accent group-hover:text-accent">
          <History className="h-[18px] w-[18px]" />
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-display text-[17px] font-extrabold uppercase leading-none tracking-[0.02em] text-text-secondary">
            Runs You&apos;ve Played
          </span>
          <span className="font-display text-[12px] font-semibold uppercase tracking-[0.1em] text-text-muted">
            {count} completed
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

// Grid placeholder shown until host status + runs resolve, so the layout never
// flashes the wrong role (e.g. a host briefly seeing the player view).
function DashboardSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-4 lg:mt-12 lg:grid-cols-3 lg:gap-5">
      <div className="flex flex-col gap-4 lg:col-span-2 lg:gap-5">
        <div className="h-40 animate-pulse rounded-lg border border-border bg-bg-surface/60" />
      </div>
      <div className="flex flex-col gap-4 lg:col-span-1 lg:gap-5">
        <div className="h-[76px] animate-pulse rounded-lg border border-border bg-bg-surface/60" />
        <div className="h-40 animate-pulse rounded-lg border border-border bg-bg-surface/60" />
      </div>
    </div>
  );
}

export default function DashboardClient({ initialUser }: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent") === "host";

  const [showConflictModal, setShowConflictModal] = useState(false);
  const [hostPromptDismissed, setHostPromptDismissed] = useState(false);

  const { data: runs = [], isLoading: runsLoading } = useRuns(true);
  const { data: hostStatus, isLoading: statusLoading } = useHostStatus();
  const requestHost = useRequestHostMutation();

  const loading = runsLoading || statusLoading;

  const isApproved = hostStatus === "approved";
  const isPending = hostStatus === "pending";
  const isDenied = hostStatus === "denied";
  const isUnapproved = hostStatus === "none" || hostStatus === "denied";

  const dismissKey = `ballruns:host-prompt-dismissed:${initialUser.id}`;

  useEffect(() => {
    if (intent) {
      try {
        localStorage.removeItem(dismissKey);
      } catch {
        // localStorage may be unavailable — fall back to the in-memory default.
      }
      setHostPromptDismissed(false);
      return;
    }
    try {
      setHostPromptDismissed(localStorage.getItem(dismissKey) === "true");
    } catch {
      // localStorage may be unavailable — keep the prompt visible.
    }
  }, [intent, dismissKey]);

  function handleDismissHostPrompt() {
    setHostPromptDismissed(true);
    try {
      localStorage.setItem(dismissKey, "true");
    } catch {
      // Persisting is best-effort; the prompt stays dismissed for this session regardless.
    }
  }

  const initials = deriveInitials(initialUser.metadata, initialUser.email);
  const email = initialUser.email;
  const firstName = firstNameFrom(initialUser.metadata);
  const visibleRuns: DashboardRun[] = mapRuns(runs);

  const activeRun =
    visibleRuns.find((r) => r.status === "active" || r.status === "lobby") ?? null;

  const completedCount = visibleRuns.filter((r) => r.status === "completed").length;

  const subtitle = activeRun
    ? "You've got a run live right now."
    : isApproved
      ? "Start a new run, or jump into one with a code."
      : isPending
        ? "Your host request is under review."
        : "Join a run with a code — or request to host your own.";

  const closeRun = useCloseRunMutation(activeRun?.sessionCode ?? "");

  function handleStartRun() {
    if (activeRun) {
      setShowConflictModal(true);
    } else {
      router.push("/create-run");
    }
  }

  async function handleCloseAndStart() {
    if (!activeRun) return;
    try {
      await closeRun.mutateAsync();
      setShowConflictModal(false);
      router.push("/create-run");
    } catch {
      // Keep the modal open so the host can retry.
    }
  }

  return (
    <div className="relative z-[1] min-h-[100dvh] w-full">
      {/* ───────── HEADER ───────── */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-10">
          <Link href="/dashboard" aria-label="BallRuns dashboard" className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9" />
            <span className="hidden font-display text-[20px] font-black uppercase leading-none tracking-[0.02em] text-text-primary sm:block">
              BallRuns
            </span>
          </Link>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex h-[38px] items-center gap-2.5 rounded-full border border-border-accent bg-bg-hover p-1 outline-none transition-colors hover:bg-bg-surface focus-visible:ring-2 focus-visible:ring-accent/50 sm:pl-3.5 sm:pr-1">
                <span className="hidden font-display text-[12px] font-bold uppercase tracking-[0.1em] text-text-secondary sm:inline">
                  Account
                </span>
                <span className="grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-full bg-accent font-display text-[12px] font-extrabold tracking-[0.03em] text-bg">
                  {initials}
                </span>
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 min-w-[220px] rounded-md border border-border bg-bg-surface shadow-lg outline-none animate-fade-up"
              >
                <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
                  <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-bg-hover border border-border-accent font-display text-[11px] font-extrabold tracking-[0.04em] text-accent">
                    {initials}
                  </div>
                  <span className="truncate font-body text-[12px] font-medium text-text-muted">
                    {email}
                  </span>
                </div>

                {isUnapproved && (
                  <DropdownMenu.Item asChild>
                    <button
                      onClick={() => requestHost.mutate()}
                      className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 font-display text-[13px] font-bold uppercase tracking-[0.06em] text-text-secondary outline-none transition-colors hover:bg-bg-hover hover:text-text-primary"
                    >
                      <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                      Become a Host
                    </button>
                  </DropdownMenu.Item>
                )}

                <DropdownMenu.Item asChild>
                  <Link
                    href="/account"
                    className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 font-display text-[13px] font-bold uppercase tracking-[0.06em] text-text-secondary outline-none transition-colors hover:bg-bg-hover hover:text-text-primary"
                  >
                    <User className="h-3.5 w-3.5 flex-shrink-0" />
                    Account
                  </Link>
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="mx-1 h-px bg-border" />

                <DropdownMenu.Item asChild>
                  <button
                    onClick={() => signOut()}
                    className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 font-display text-[13px] font-bold uppercase tracking-[0.06em] text-[#ff4040] outline-none transition-colors hover:bg-[#ff4040]/10"
                  >
                    <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
                    Sign Out
                  </button>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* ───────── BODY ───────── */}
      <main className="mx-auto max-w-6xl px-5 pb-16 lg:px-10 lg:pb-24">
        {/* Greeting */}
        <div className="animate-fade-up pt-10 lg:pt-14">
          <div className="flex items-center gap-2.5">
            <span className="h-0.5 w-6 rounded-sm bg-accent" />
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">
              Dashboard
            </span>
          </div>
          <h1 className="mt-3 font-display text-[38px] font-black uppercase leading-[0.92] tracking-[-0.01em] text-text-primary lg:text-[52px]">
            {firstName ? (
              <>
                {greetingFor(new Date())},{" "}
                <span className="text-accent">{firstName}</span>
              </>
            ) : (
              "Welcome back"
            )}
          </h1>
          {loading ? (
            <div className="mt-3.5 h-4 w-72 max-w-full animate-pulse rounded bg-bg-surface" />
          ) : (
            <p className="mt-3 max-w-[34rem] font-body text-[14px] leading-[1.5] text-text-secondary lg:text-[15px]">
              {subtitle}
            </p>
          )}
        </div>

        {/* Action grid */}
        {loading ? (
          <DashboardSkeleton />
        ) : (
        <div
          className="animate-fade-up mt-8 grid grid-cols-1 gap-4 lg:mt-12 lg:grid-cols-3 lg:gap-5"
          style={{ animationDelay: "0.08s" }}
        >
          {/* Primary column — your live run and your run history */}
          <div className="flex flex-col gap-4 lg:col-span-2 lg:gap-5">
            {activeRun && (
              <ActiveRunCard
                run={activeRun}
                onEnter={() => router.push(`/runs/${activeRun.sessionCode}/lobby`)}
              />
            )}

            {completedCount > 0 && (
              <HistoryCard count={completedCount} onOpen={() => router.push("/history")} />
            )}

            {/* New host, nothing to show yet — keep the column from reading empty. */}
            {isApproved && !activeRun && completedCount === 0 && (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-bg-surface/40 p-6 lg:p-10">
                <span className="grid h-11 w-11 place-items-center rounded-md border border-border bg-bg-raised text-text-muted">
                  <Zap className="h-[18px] w-[18px]" />
                </span>
                <div className="flex flex-col gap-1.5">
                  <span className="font-display text-[20px] font-extrabold uppercase leading-none tracking-[0.02em] text-text-secondary">
                    No runs yet
                  </span>
                  <span className="max-w-[26rem] font-body text-[13.5px] leading-[1.5] text-text-muted">
                    Start a run and it&apos;ll show up here live. Your finished runs land here too.
                  </span>
                </div>
              </div>
            )}

            {/* Players (no host powers) lead with joining a run */}
            {!isApproved && <JoinPanel hero />}
          </div>

          {/* Side column — status + actions */}
          <div className="flex flex-col gap-4 lg:col-span-1 lg:gap-5">
            {isApproved && <StartRunCard onStart={handleStartRun} />}

            {isApproved && <JoinPanel />}

            {isPending && (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-surface p-5 lg:p-6">
                <span className="grid h-10 w-10 place-items-center rounded-md border border-border bg-bg-raised text-text-muted">
                  <Clock className="h-[18px] w-[18px]" />
                </span>
                <div className="flex flex-col gap-1.5">
                  <span className="font-display text-[20px] font-extrabold uppercase leading-none tracking-[0.02em] text-text-secondary">
                    Host Request Pending
                  </span>
                  <span className="font-body text-[13px] leading-[1.5] text-text-muted">
                    We&apos;re reviewing your request — you&apos;ll be able to start runs once it&apos;s approved.
                  </span>
                </div>
              </div>
            )}

            {/* Become a host — full nudge card */}
            {isUnapproved && !hostPromptDismissed && (
              <div className="flex flex-col gap-4 rounded-lg border border-border-accent border-l-[3px] border-l-accent bg-accent/[0.04] p-5 lg:p-6">
                <div className="flex flex-col gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-md border border-border-accent bg-accent-glow text-accent">
                    <Sparkles className="h-[18px] w-[18px]" />
                  </span>
                  <span className="mt-1 font-display text-[20px] font-extrabold uppercase leading-none tracking-[0.02em] text-text-primary">
                    Run Your Own Court
                  </span>
                  <span className="font-body text-[13px] leading-[1.5] text-text-secondary">
                    {isDenied
                      ? "Your last request wasn't approved. Add some detail and try again."
                      : "Hosting is approval-gated. Send a quick request and we'll get you set up."}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => requestHost.mutate()}
                    disabled={requestHost.isPending}
                    className="flex h-12 w-full items-center justify-center rounded-md bg-accent font-display text-[15px] font-extrabold uppercase tracking-[0.1em] text-bg transition-all duration-150 hover:-translate-y-px hover:bg-[#d4f545] active:scale-[0.98] disabled:opacity-50"
                  >
                    {requestHost.isPending
                      ? "Sending…"
                      : isDenied
                        ? "Request Again"
                        : "Request to Host"}
                  </button>
                  <button
                    onClick={handleDismissHostPrompt}
                    className="flex h-11 w-full items-center justify-center rounded-md border border-border bg-bg-surface font-display text-[13px] font-bold uppercase tracking-[0.08em] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Dismissed host nudge — quiet footer link */}
        {!loading && isUnapproved && hostPromptDismissed && (
          <button
            onClick={() => requestHost.mutate()}
            disabled={requestHost.isPending}
            className="mt-10 w-full text-center font-body text-[13px] text-text-muted transition-colors hover:text-text-secondary disabled:opacity-50"
          >
            Want to run your own court?{" "}
            <span className="font-semibold text-text-secondary underline decoration-border underline-offset-2">
              Request to host
            </span>
          </button>
        )}
      </main>

      {/* ───────── CONFLICT MODAL ───────── */}
      {showConflictModal && activeRun && (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
            onClick={() => setShowConflictModal(false)}
          />
          <div className="fixed inset-0 z-[111] flex items-center justify-center px-5">
            <div className="flex w-full max-w-[360px] flex-col gap-5 rounded-xl border border-border bg-bg-raised p-6 animate-slide-up">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="font-display text-[16px] font-black uppercase tracking-[0.06em] text-text-primary">
                    Run in Progress
                  </span>
                  <span className="font-body text-[13px] leading-[1.5] text-text-secondary">
                    You already have an active run. Continue it, or close it to start a new one.
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setShowConflictModal(false)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text-primary"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => router.push(`/runs/${activeRun.sessionCode}/lobby`)}
                  className="flex h-11 w-full items-center justify-center rounded-md bg-accent font-display text-[13px] font-black uppercase tracking-[0.08em] text-bg transition-opacity hover:opacity-90"
                >
                  Continue Run
                </button>
                <button
                  type="button"
                  onClick={handleCloseAndStart}
                  disabled={closeRun.isPending}
                  className="flex h-11 w-full items-center justify-center rounded-md border border-danger/40 bg-danger/[0.06] font-display text-[13px] font-black uppercase tracking-[0.08em] text-[#ff6060] transition-all hover:bg-danger/[0.12] disabled:opacity-50"
                >
                  {closeRun.isPending ? "Closing..." : "Close & Start New"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
