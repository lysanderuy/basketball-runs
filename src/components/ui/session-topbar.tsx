"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Share2, X, Check, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface SessionTopbarProps {
  run: { name: string; location: string | null; sessionCode: string } | null;
  loading: boolean;
  badge?: React.ReactNode;
}

export function SessionTopbar({ run, loading, badge }: SessionTopbarProps) {
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const joinUrl = origin ? `${origin}/runs/${run?.sessionCode}/join` : "";

  async function handleCopy() {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="topbar">
        <div className="flex flex-col gap-0.5">
          {loading ? (
            <>
              <div className="h-[11px] w-20 bg-bg-hover rounded-sm animate-pulse" />
              <div className="h-5 w-36 bg-bg-hover rounded-sm mt-0.5 animate-pulse" />
            </>
          ) : (
            <>
              <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted">
                {run?.location ?? "Basketball Run"}
              </span>
              <span className="font-display text-[20px] font-black tracking-[0.02em] uppercase text-text-primary leading-none">
                {run?.name ?? "—"}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowShare(true)}
            className="w-9 h-9 flex items-center justify-center rounded-sm border border-border bg-bg-surface text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <Link
            href="/history"
            className="w-9 h-9 flex items-center justify-center rounded-sm border border-border bg-bg-surface text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </Link>
          {badge}
        </div>
      </div>

      {showShare && run && (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
            onClick={() => setShowShare(false)}
          />
          <div className="fixed inset-0 z-[111] flex items-center justify-center px-5">
            <div className="w-full max-w-[340px] bg-bg-raised border border-border rounded-xl p-6 flex flex-col items-center gap-5 animate-slide-in">

              <div className="w-full flex items-center justify-between">
                <span className="font-display text-[14px] font-black tracking-[0.08em] uppercase text-text-primary">
                  Join this Run
                </span>
                <button
                  type="button"
                  onClick={() => setShowShare(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-sm border border-border bg-bg-surface text-text-muted transition-colors hover:border-text-muted hover:text-text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3 bg-bg-surface border border-border rounded-lg">
                <QRCodeSVG
                  value={joinUrl}
                  size={180}
                  bgColor="#1e2019"
                  fgColor="#f0f0e8"
                />
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="font-display text-[10px] font-bold tracking-[0.16em] uppercase text-text-muted">
                  Session Code
                </span>
                <span className="font-display text-[32px] font-black tracking-[0.12em] uppercase text-accent leading-none">
                  {run.sessionCode}
                </span>
              </div>

              <span className="w-full font-display text-[10px] font-bold tracking-[0.16em] uppercase text-text-muted">
                Share this run
              </span>
              <div className="w-full flex items-center gap-2 bg-bg-surface border border-border rounded-md px-3 py-2.5">
                <span className="font-body text-[12px] text-text-muted flex-1 truncate">
                  {joinUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 font-display text-[11px] font-bold tracking-[0.08em] uppercase flex-shrink-0 transition-colors ${
                    copied ? "text-accent" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

            </div>
          </div>
        </>
      )}
    </>
  );
}
