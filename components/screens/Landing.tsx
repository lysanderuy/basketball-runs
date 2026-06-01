"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRun, RunActions } from "@/contexts/RunContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Landing() {
  const { dispatch } = useRun();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  function handleCodeInput(value: string) {
    // Strip non-alphanumeric, uppercase, cap at 6
    let val = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);

    // Auto-insert dash after 3 chars
    if (val.length > 3) {
      val = val.slice(0, 3) + "-" + val.slice(3);
    }

    setCode(val);
    setError(false);
  }

  function handleJoin() {
    const cleanCode = code.replace("-", "");
    if (cleanCode.length < 5) return;

    // Simulate valid code check
    if (cleanCode.toUpperCase() === "RKR74") {
      dispatch(RunActions.joinRun(code));
      router.push("/lobby");
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  }

  const isReady = code.replace("-", "").length >= 5;

  return (
    <div className="app-shell px-5">
      {/* Wordmark */}
      <div className="pt-14 flex flex-col gap-[2px] animate-fade-up">
        <h1 className="font-display text-[52px] font-black tracking-[-0.01em] uppercase text-text-primary leading-none">
          Open
          <br />
          Run
        </h1>
        <div className="w-12 h-0.75 bg-accent rounded-sm mt-2.5" />
        <p className="font-display text-[14px] font-bold tracking-[0.1em] uppercase text-text-muted mt-2.5">
          Run your game
        </p>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-end pb-12">
        <div className="flex flex-col gap-2.5">
          {/* Join block */}
          <div className="flex flex-col gap-1.5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <label className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted pl-[2px]">
              Have a code?
            </label>
            <div className="flex gap-2">
              <input
                className={cn(
                  "flex-1 h-13 bg-bg-surface border border-border rounded-md",
                  "px-3.5",
                  "font-display text-[20px] font-black tracking-[0.18em] uppercase text-text-primary",
                  "outline-none transition-all duration-150",
                  "caret-accent",
                  "placeholder:text-text-muted placeholder:font-bold placeholder:tracking-[0.12em]",
                  "focus:border-border-accent focus:bg-bg-hover",
                  error && "border-[#ff4040] animate-shake"
                )}
                value={code}
                onChange={(e) => handleCodeInput(e.target.value)}
                placeholder="ABC-12"
                maxLength={7}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <Button
                variant="secondary"
                size="lg"
                className={cn(
                  "h-13 px-5",
                  isReady &&
                    "bg-accent border-accent text-bg hover:bg-[#d4f545] hover:border-[#d4f545] hover:-translate-y-px"
                )}
                onClick={handleJoin}
                disabled={!isReady}
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
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Join
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div
            className="flex items-center gap-2.5 animate-fade-up"
            style={{ animationDelay: "0.16s" }}
          >
            <div className="flex-1 h-px bg-border" />
            <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
              or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Create button */}
          <Button
            variant="primary"
            size="lg"
            className="w-full h-14 animate-fade-up"
            style={{ animationDelay: "0.2s" }}
            onClick={() => router.push("/create-run")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Start a Run
          </Button>

          {/* Sign in */}
          <div
            className="flex items-center justify-center gap-1.5 pt-1 animate-fade-up"
            style={{ animationDelay: "0.26s" }}
          >
            <span className="font-body text-[13px] text-text-muted">
              Already have an account?
            </span>
            <button
              className="font-body text-[13px] font-semibold text-text-secondary underline underline-offset-2 decoration-border transition-colors hover:text-text-primary"
              onClick={() => alert("Sign in - coming soon")}
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
