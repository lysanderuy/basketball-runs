"use client";

import { useActionState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signUp } from "@/app/auth/actions";

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signUp, null);

  return (
    <div className="app-shell px-5">
      <div className="pt-14 flex flex-col gap-[2px] animate-fade-up">
        <h1 className="font-display text-[52px] font-black tracking-[-0.01em] uppercase text-text-primary leading-none">
          Create
          <br />
          Account
        </h1>
        <div className="w-12 h-0.5 bg-accent rounded-sm mt-2.5" />
        <p className="font-display text-[14px] font-bold tracking-[0.1em] uppercase text-text-muted mt-2.5">
          Join the run
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-end pb-12">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <label className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted pl-[2px]">
              Display Name
            </label>
            <input
              name="displayName"
              type="text"
              autoComplete="nickname"
              required
              maxLength={32}
              className={cn(
                "w-full h-13 bg-bg-surface border border-border rounded-md",
                "px-3.5",
                "font-display text-[18px] font-bold tracking-[0.06em] uppercase text-text-primary",
                "outline-none transition-all duration-150",
                "placeholder:text-text-muted placeholder:font-bold",
                "focus:border-border-accent focus:bg-bg-hover"
              )}
              placeholder="YOUR NAME"
            />
          </div>

          <div className="flex flex-col gap-1.5 animate-fade-up" style={{ animationDelay: "0.16s" }}>
            <label className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted pl-[2px]">
              Email
            </label>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className={cn(
                "w-full h-13 bg-bg-surface border border-border rounded-md",
                "px-3.5",
                "font-body text-[15px] text-text-primary",
                "outline-none transition-all duration-150",
                "placeholder:text-text-muted",
                "focus:border-border-accent focus:bg-bg-hover"
              )}
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5 animate-fade-up" style={{ animationDelay: "0.22s" }}>
            <label className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted pl-[2px]">
              Password
            </label>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={cn(
                "w-full h-13 bg-bg-surface border border-border rounded-md",
                "px-3.5",
                "font-body text-[15px] text-text-primary",
                "outline-none transition-all duration-150",
                "placeholder:text-text-muted",
                "focus:border-border-accent focus:bg-bg-hover"
              )}
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p className="font-body text-[13px] text-danger animate-slide-in">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full h-14 animate-fade-up"
            style={{ animationDelay: "0.28s" }}
            disabled={isPending}
          >
            {isPending ? "Creating account…" : "Create Account"}
          </Button>

          <div
            className="flex items-center justify-center gap-1.5 pt-1 animate-fade-up"
            style={{ animationDelay: "0.34s" }}
          >
            <span className="font-body text-[13px] text-text-muted">
              Already have an account?
            </span>
            <Link
              href="/auth/login"
              className="font-body text-[13px] font-semibold text-text-secondary underline underline-offset-2 decoration-border transition-colors hover:text-text-primary"
            >
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
