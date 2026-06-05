"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signIn } from "@/app/auth/actions";

interface Props {
  runCode: string;
  runName: string;
  currentUser: { id: string; displayName: string | null } | null;
}

type Step = "select" | "nickname";

const inputClass = cn(
  "w-full h-13 bg-bg-surface border border-border rounded-md",
  "px-3.5",
  "font-body text-[15px] text-text-primary",
  "outline-none transition-all duration-150",
  "placeholder:text-text-muted",
  "focus:border-border-accent focus:bg-bg-hover"
);

export default function JoinForm({ runCode, runName, currentUser }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signInState, signInAction, isSigningIn] = useActionState(signIn, null);

  async function handleGuestSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) {
      setNicknameError("Nickname is required");
      return;
    }
    setNicknameError("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/runs/${runCode}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json();
        const msg =
          body.error?.formErrors?.[0] ??
          (typeof body.error === "string" ? body.error : "Failed to join. Try again.");
        setNicknameError(msg);
        return;
      }

      localStorage.setItem(`ballruns_guest_${runCode}`, trimmed);
      router.push(`/runs/${runCode}/lobby`);
    } catch {
      setNicknameError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Nickname step ────────────────────────────────────────────────────────────
  if (step === "nickname") {
    return (
      <div className="app-shell px-5">
        <div className="pt-14 flex flex-col gap-[2px] animate-fade-up">
          <button
            onClick={() => setStep("select")}
            className="mb-5 flex items-center gap-1.5 w-fit font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>

          <h1 className="font-display text-[52px] font-black tracking-[-0.01em] uppercase text-text-primary leading-none">
            Your
            <br />
            Name
          </h1>
          <div className="w-12 h-0.5 bg-accent rounded-sm mt-2.5" />
          <p className="font-display text-[14px] font-bold tracking-[0.1em] uppercase text-text-muted mt-2.5">
            How should we call you?
          </p>
        </div>

        <div className="flex-1 flex flex-col justify-end pb-12">
          <form onSubmit={handleGuestSubmit} className="flex flex-col gap-3">
            <div
              className="flex flex-col gap-1.5 animate-fade-up"
              style={{ animationDelay: "0.1s" }}
            >
              <label className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted pl-[2px]">
                Nickname
              </label>
              <input
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setNicknameError("");
                }}
                autoFocus
                maxLength={50}
                className={inputClass}
                placeholder="e.g. Kobe"
              />
            </div>

            {nicknameError && (
              <p className="font-body text-[13px] text-danger animate-slide-in">
                {nicknameError}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full animate-fade-up"
              style={{ animationDelay: "0.16s" }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Joining…" : "Join Run"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── Select step ──────────────────────────────────────────────────────────────
  return (
    <div className="app-shell px-5">
      <div className="pt-14 flex flex-col gap-[2px] animate-fade-up">
        <p className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-accent mb-1">
          {runName}
        </p>
        <h1 className="font-display text-[52px] font-black tracking-[-0.01em] uppercase text-text-primary leading-none">
          Join
          <br />
          Run
        </h1>
        <div className="w-12 h-0.5 bg-accent rounded-sm mt-2.5" />
        <p className="font-display text-[14px] font-bold tracking-[0.1em] uppercase text-text-muted mt-2.5">
          {currentUser
            ? `Signed in as ${currentUser.displayName ?? "you"}`
            : "Sign in or continue as guest"}
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-end pb-12">
        {currentUser ? (
          // Already signed in
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full animate-fade-up"
              onClick={() => router.push(`/runs/${runCode}/lobby`)}
            >
              Continue as {currentUser.displayName ?? "me"}
            </Button>

            <p
              className="text-center font-body text-[13px] text-text-muted animate-fade-up"
              style={{ animationDelay: "0.1s" }}
            >
              Not you?{" "}
              <Link
                href={`/auth/login?next=/runs/${runCode}/join`}
                className="font-semibold text-text-secondary underline underline-offset-2 decoration-border hover:text-text-primary transition-colors"
              >
                Sign in as someone else
              </Link>
            </p>
          </div>
        ) : (
          // Not signed in — show sign-in form + guest option
          <div className="flex flex-col gap-3">
            <form action={signInAction} className="flex flex-col gap-3">
              <input
                type="hidden"
                name="next"
                value={`/runs/${runCode}/lobby`}
              />

              <div
                className="flex flex-col gap-1.5 animate-fade-up"
                style={{ animationDelay: "0.1s" }}
              >
                <label className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted pl-[2px]">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>

              <div
                className="flex flex-col gap-1.5 animate-fade-up"
                style={{ animationDelay: "0.16s" }}
              >
                <label className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted pl-[2px]">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>

              {signInState?.error && (
                <p className="font-body text-[13px] text-danger animate-slide-in">
                  {signInState.error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full animate-fade-up"
                style={{ animationDelay: "0.22s" }}
                disabled={isSigningIn}
              >
                {isSigningIn ? "Signing in…" : "Sign In"}
              </Button>
            </form>

            <div
              className="flex items-center gap-3 animate-fade-up"
              style={{ animationDelay: "0.28s" }}
            >
              <div className="flex-1 h-px bg-border" />
              <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
                or
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              variant="secondary"
              size="lg"
              className="w-full animate-fade-up"
              style={{ animationDelay: "0.34s" }}
              onClick={() => setStep("nickname")}
            >
              Continue as Guest
            </Button>

            <div
              className="flex items-center justify-center gap-1.5 animate-fade-up"
              style={{ animationDelay: "0.4s" }}
            >
              <span className="font-body text-[13px] text-text-muted">
                Don&apos;t have an account?
              </span>
              <Link
                href={`/auth/signup?next=/runs/${runCode}/lobby`}
                className="font-body text-[13px] font-semibold text-text-secondary underline underline-offset-2 decoration-border hover:text-text-primary transition-colors"
              >
                Sign up
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
