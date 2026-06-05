"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a run code");
      return;
    }
    if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(trimmed)) {
      setError("Format: ABC-123");
      return;
    }
    router.push(`/runs/${trimmed}/join`);
  }

  return (
    <div className="app-shell px-5">
      <div className="pt-14 flex flex-col gap-[2px] animate-fade-up">
        <h1 className="font-display text-[52px] font-black tracking-[-0.01em] uppercase text-text-primary leading-none">
          Ball
          <br />
          Runs
        </h1>
        <div className="w-12 h-0.5 bg-accent rounded-sm mt-2.5" />
        <p className="font-display text-[14px] font-bold tracking-[0.1em] uppercase text-text-muted mt-2.5">
          Enter your run code to join
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-end pb-12">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div
            className="flex flex-col gap-1.5 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            <label className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted pl-[2px]">
              Run Code
            </label>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="ABC-123"
              maxLength={7}
              className={cn(
                "w-full h-13 bg-bg-surface border border-border rounded-md",
                "px-3.5",
                "font-body text-[15px] text-text-primary tracking-widest",
                "outline-none transition-all duration-150",
                "placeholder:text-text-muted placeholder:tracking-normal",
                "focus:border-border-accent focus:bg-bg-hover"
              )}
            />
          </div>

          {error && (
            <p className="font-body text-[13px] text-danger animate-slide-in">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full animate-fade-up"
            style={{ animationDelay: "0.16s" }}
          >
            Join Run
          </Button>

          <div
            className="flex items-center justify-center gap-1.5 animate-fade-up"
            style={{ animationDelay: "0.22s" }}
          >
            <span className="font-body text-[13px] text-text-muted">
              Hosting a run?
            </span>
            <Link
              href="/auth/login?next=/create-run"
              className="font-body text-[13px] font-semibold text-text-secondary underline underline-offset-2 decoration-border hover:text-text-primary transition-colors"
            >
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
