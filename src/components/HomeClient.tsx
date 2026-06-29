"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, deriveInitials } from "@/lib/utils";

type InitialUser = {
  id: string;
  email: string;
  metadata: Record<string, unknown> | undefined;
} | null;

export type HomeClientProps = {
  initialUser: InitialUser;
};

export default function HomeClient({ initialUser }: HomeClientProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const signedIn = initialUser !== null;
  const initials = signedIn ? deriveInitials(initialUser.metadata, initialUser.email) : "";

  const stripped = code.replace("-", "");
  const codeReady = stripped.length >= 6;

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
    if (val.length > 3) val = val.slice(0, 3) + "-" + val.slice(3);
    setCode(val);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!codeReady) {
      const el = inputRef.current;
      if (!el) return;
      el.style.borderColor = "#ff4040";
      el.style.animation = "";
      void el.offsetWidth;
      el.style.animation = "shake 0.4s ease-out";
      setTimeout(() => {
        el.style.borderColor = "";
        el.style.animation = "";
      }, 500);
      return;
    }
    router.push(`/runs/${code}/join`);
  }

  return (
    <div className="app-shell px-5">

      {/* WORDMARK */}
      <div className="pt-14 flex flex-col gap-[2px] animate-fade-up">
        <div className="flex items-start justify-between">
          <h1 className="font-display text-[52px] font-black tracking-[-0.01em] uppercase text-text-primary leading-none">
            Ball
            <br />
            Runs
          </h1>
          {signedIn && (
            <Link
              href="/dashboard"
              className="mt-1 w-[38px] h-[38px] flex-shrink-0 rounded-full bg-bg-hover border border-border-accent flex items-center justify-center font-display text-[13px] font-extrabold tracking-[0.04em] text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/50 transition-colors hover:bg-bg-surface"
            >
              {initials}
            </Link>
          )}
        </div>
        <div className="w-12 h-0.5 bg-accent rounded-sm mt-2.5" />
        <p className="font-display text-[14px] font-bold tracking-[0.1em] uppercase text-text-muted mt-2.5">
          Run your game
        </p>
      </div>

      {/* ACTIONS */}
      <div className="flex-1 flex flex-col justify-end pb-12">
        <div className="flex flex-col gap-5">

          <div
            className="flex flex-col gap-1.5 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted pl-[2px]">
              Have a code?
            </span>
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                ref={inputRef}
                value={code}
                onChange={handleCodeChange}
                placeholder="ABC-123"
                maxLength={7}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className={cn(
                  "flex-1 min-w-0 h-13 bg-bg-surface border border-border rounded-md",
                  "px-3.5",
                  "font-display text-[20px] font-black tracking-[0.18em] text-text-primary uppercase",
                  "outline-none transition-colors duration-150",
                  "placeholder:text-text-muted placeholder:tracking-[0.12em] placeholder:font-bold placeholder:normal-case",
                  "focus:border-border-accent focus:bg-bg-hover",
                  "[caret-color:theme(colors.accent)]"
                )}
              />
              <button
                type="submit"
                className={cn(
                  "h-13 px-5 rounded-md border flex-shrink-0",
                  "font-display text-[14px] font-extrabold tracking-[0.1em] uppercase",
                  "flex items-center transition-all duration-150",
                  codeReady
                    ? "bg-accent border-accent text-bg hover:-translate-y-px"
                    : "bg-bg-surface border-border text-text-secondary hover:border-text-muted hover:text-text-primary"
                )}
              >
                Join
              </button>
            </form>
          </div>

          {!signedIn && (
            <div
              className="flex items-center justify-center gap-1.5 animate-fade-up"
              style={{ animationDelay: "0.24s" }}
            >
              <span className="font-body text-[13px] text-text-muted">
                Already have an account?
              </span>
              <Link
                href="/login"
                className="font-body text-[13px] font-semibold text-text-secondary underline underline-offset-2 decoration-border transition-colors hover:text-text-primary"
              >
                Sign in
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
