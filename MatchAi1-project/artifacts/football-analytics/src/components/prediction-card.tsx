import { AiPrediction, AuthorPrediction, HistoryEntry } from "@workspace/api-client-react";
import { useLanguage } from "@/hooks/use-language";
import { translatePrediction } from "@/i18n/prediction-types";
import { BrainCircuit, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";

function formatKyivDate(date: Date | string): string {
  const d = new Date(date);
  const day = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Kiev" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kiev" });
  return `${day} | ${time}`;
}

function formatKyivTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kiev" });
}

function IconDoubleCheck({ color }: { color: string }) {
  return (
    <svg width="15" height="10" viewBox="0 0 15 10" fill="none">
      <path d="M1 5L4.5 8.5L10 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5L8.5 8.5L14 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
function apiUrl(path: string) { return `${BASE}/api${path}`; }

type PredButton = { id: number; label: string; url: string; sortOrder: number };

function CardButtons({ type, predId }: { type: "ai" | "author"; predId: number }) {
  const [buttons, setButtons] = useState<PredButton[]>([]);

  useEffect(() => {
    fetch(apiUrl(`/buttons?type=${type}&predictionId=${predId}`))
      .then(r => r.json())
      .then(data => Array.isArray(data) && setButtons(data))
      .catch(() => {});
  }, [type, predId]);

  if (buttons.length === 0) return null;

  return (
    <div className="mx-4 mb-4 flex flex-col gap-2">
      {buttons.map(btn => (
        <a
          key={btn.id}
          href={btn.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-mono text-sm font-semibold transition-all hover:brightness-110 active:scale-95"
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          {btn.label}
        </a>
      ))}
    </div>
  );
}

type Status = "pending" | "win" | "lose" | "refund";

interface PredictionCardProps {
  prediction: AiPrediction | AuthorPrediction | HistoryEntry;
  type: "ai" | "author" | "history";
}

function IconAuthor() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function confidenceColor(pct: number) {
  if (pct >= 65) return "#22c55e";
  if (pct >= 45) return "#f97316";
  return "#ef4444";
}

export function PredictionCard({ prediction, type }: PredictionCardProps) {
  const { t, tLeague, tTeam, tMatchTitle, lang } = useLanguage();

  const status = prediction.status as Status;

  const isAi     = type === "ai"     || (type === "history" && (prediction as HistoryEntry).type === "ai");
  const isAuthor = type === "author" || (type === "history" && (prediction as HistoryEntry).type === "author");
  const historyType = type === "history" ? (prediction as HistoryEntry).type : null;

  const aiPred     = prediction as AiPrediction;
  const authorPred = prediction as AuthorPrediction;

  const scorePredict     = isAi ? aiPred.scorePredict     ?? null : null;
  const confidence       = isAi ? aiPred.confidence       ?? null : null;
  const scoreProbability = isAi ? aiPred.scoreProbability ?? null : null;
  const riskLevel        = isAi ? aiPred.riskLevel        ?? null : null;

  const predictionTranslated = translatePrediction(prediction.prediction, lang);

  const homeTeam = "homeTeam" in prediction ? tTeam(prediction.homeTeam) : "";
  const awayTeam = "awayTeam" in prediction ? tTeam(prediction.awayTeam) : "";

  const statusLabels: Record<Status, string> = {
    win: t("card.win"), lose: t("card.lose"), refund: t("card.refund"), pending: t("card.pending")
  };

  const statusColors: Record<Status, string> = {
    win: "#22c55e", lose: "#ef4444", refund: "#71717a", pending: "#22c55e"
  };

  const isRefund = status === "refund";
  const isLive = status === "pending" && new Date() > new Date(prediction.matchDate);
  const baseAccent = isAi ? "#22c55e" : "#f59e0b";
  const accentColor = baseAccent; // always keep type color unchanged
  const confPct = confidence !== null && confidence !== undefined ? Math.round(confidence * 100) : null;
  const scorePct = scoreProbability != null
    ? Math.round(scoreProbability * 100)
    : confPct !== null ? Math.round(Math.max(confPct * 0.11, 5)) : null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: isRefund
          ? "linear-gradient(180deg, #111113 0%, #0d0d0f 100%)"
          : "linear-gradient(180deg, #111115 0%, #0d0d11 100%)",
        border: isRefund ? "1px solid rgba(113,113,122,0.25)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: isRefund ? "0 4px 24px rgba(0,0,0,0.3)" : "0 4px 24px rgba(0,0,0,0.4)",
        opacity: isRefund ? 0.85 : 1
      }}
    >
      {/* ── Header: AI/Author badge ── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2" style={{ color: accentColor }}>
          {isAi ? <BrainCircuit className="w-4 h-4" /> : <IconAuthor />}
          <span className="font-mono font-black text-[11px] uppercase tracking-[0.18em]">
            {isAi ? t("card.aiHeader") || "AI Прогноз" : t("card.authorHeader") || "Авторский прогноз"}
          </span>
        </div>

        {/* Status badge */}
        {isLive ? (
          <span
            className="flex items-center gap-1.5 font-mono font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ color: "#ef4444", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
            ИДЁТ
          </span>
        ) : status === "win" ? (
          <span className="flex items-center justify-center w-7 h-7 rounded-full" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        ) : status === "lose" ? (
          <span className="flex items-center justify-center w-7 h-7 rounded-full" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/></svg>
          </span>
        ) : status === "refund" ? (
          <span className="flex items-center justify-center w-7 h-7 rounded-full" style={{ background: "rgba(113,113,122,0.15)", border: "1px solid rgba(113,113,122,0.35)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
          </span>
        ) : null}
      </div>

      {/* ── League + Date (compact single row) ── */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5 shrink-0" style={{ color: "#f59e0b" }}>
          <IconTrophy />
          <span className="font-mono text-[11px] font-semibold tracking-wide">
            {tLeague(prediction.league)}
          </span>
        </div>
        <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
        <div className="flex items-center gap-1.5 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
          <IconClock />
          <span className="font-mono text-[11px]">
            {formatKyivDate(prediction.matchDate)}
          </span>
        </div>
      </div>

      {/* ── Teams (centered cluster) ── */}
      <div className="px-4 pt-2 pb-3">
        {homeTeam && awayTeam ? (
          <div className="flex items-center justify-center gap-4">
            <div className="text-right max-w-[42%]">
              <div
                className="font-black text-xl leading-tight"
                style={{ color: "#ffffff", letterSpacing: "-0.01em" }}
              >
                {homeTeam}
              </div>
            </div>
            <div
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-mono text-[10px] font-bold"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.35)"
              }}
            >
              VS
            </div>
            <div className="text-left max-w-[42%]">
              <div
                className="font-black text-xl leading-tight"
                style={{ color: "#ffffff", letterSpacing: "-0.01em" }}
              >
                {awayTeam}
              </div>
            </div>
          </div>
        ) : (
          <div className="font-bold text-lg text-white">{tMatchTitle(prediction.matchTitle)}</div>
        )}
      </div>

      {/* ── Stats row: 3 columns ── */}
      <div
        className="mx-4 mb-3 rounded-xl px-4 py-3 grid grid-cols-3"
        style={{
          background: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.07)",
          gap: 0
        }}
      >
        {/* Col 1: Prediction */}
        <div className="pr-3" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            {t("card.predictionLabel") || "Прогноз"}
          </div>
          <div
            className="font-black text-sm leading-tight"
            style={{ color: isAi ? "#22c55e" : "#f59e0b" }}
          >
            {predictionTranslated}
          </div>
        </div>

        {/* Col 2: Odds */}
        <div className="px-3 text-center" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="font-mono text-[9px] uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            {t("card.oddsLabel") || "КФ"}
          </div>
          <div className="font-mono font-black text-2xl leading-none text-white">
            {prediction.odds.toFixed(2)}
          </div>
        </div>

        {/* Col 3: Confidence (AI) or Stake (Author) */}
        <div className="pl-3 text-right">
          <>
            <div className="font-mono text-[9px] uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              {t("card.probabilityLabel") || "Вероятность"}
            </div>
            {isAi ? (
              <div className="font-mono font-black text-2xl leading-none" style={{ color: confPct !== null ? confidenceColor(confPct) : accentColor }}>
                {confPct !== null ? `${confPct}%` : "—"}
              </div>
            ) : (
              "stake" in authorPred && authorPred.stake ? (
                <div className="font-mono font-black text-2xl leading-none" style={{ color: confidenceColor(authorPred.stake) }}>
                  {authorPred.stake}%
                </div>
              ) : (
                <div className="font-mono font-black text-2xl leading-none" style={{ color: "rgba(255,255,255,0.3)" }}>—</div>
              )
            )}
          </>
        </div>
      </div>

      {/* ── Risk Level Badge (AI only) ── */}
      {isAi && riskLevel && (() => {
        const rl = riskLevel.toLowerCase();
        const isLow  = rl.includes("низк");
        const isHigh = rl.includes("высок") || rl.includes("висок");
        const color  = isLow ? "#22c55e" : isHigh ? "#ef4444" : "#f59e0b";
        const bg     = isLow ? "rgba(34,197,94,0.08)"   : isHigh ? "rgba(239,68,68,0.08)"   : "rgba(245,158,11,0.08)";
        const border = isLow ? "rgba(34,197,94,0.2)"    : isHigh ? "rgba(239,68,68,0.2)"    : "rgba(245,158,11,0.2)";
        const icon   = isLow ? "🟢" : isHigh ? "🔴" : "🟡";
        const label  = isLow ? "Низкий риск" : isHigh ? "Высокий риск" : "Средний риск";
        return (
          <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: bg, border: `1px solid ${border}` }}>
            <span className="text-[11px]">{icon}</span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
          </div>
        );
      })()}

      {/* ── Analysis / Reasoning ── */}
      {isAi && "analysis" in aiPred && aiPred.analysis && (
        <div className="px-4 pb-3 pt-0">
          <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            {aiPred.analysis}
          </p>
        </div>
      )}
      {isAuthor && "reasoning" in authorPred && authorPred.reasoning && (
        <div className="px-4 pb-3 pt-0">
          <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            {authorPred.reasoning}
          </p>
        </div>
      )}

      {/* ── Exact score row ── */}
      {isAi && scorePredict && scorePct !== null && (
        <div
          className="mx-4 mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="font-mono text-[9px] uppercase tracking-widest shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
            {t("card.exactScore") || "Точный счёт"}
          </span>
          <span className="font-mono font-black text-base text-white tracking-wider">
            {scorePredict}
          </span>
          <span className="font-mono text-[10px] ml-auto shrink-0">
            <span className="font-black text-base" style={{ color: confidenceColor(scorePct) }}>~{scorePct}%</span>
            <span className="ml-1" style={{ color: "rgba(255,255,255,0.2)" }}>вероятность</span>
          </span>
        </div>
      )}

      {/* ── Action Buttons ── */}
      {(isAi || isAuthor) && (
        <CardButtons
          type={isAi ? "ai" : "author"}
          predId={prediction.id}
        />
      )}

      {/* ── Telegram-style published timestamp ── */}
      {(() => {
        const createdAt = (prediction as any).createdAt as string | undefined;
        if (!createdAt) return null;
        const publishAt = (prediction as any).publishAt as string | null | undefined;
        return (
          <div className="flex items-center justify-end gap-1.5 px-4 pb-3 -mt-1">
            <IconDoubleCheck color={accentColor} />
            <span className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>
              {publishAt ? formatKyivTime(publishAt) : formatKyivTime(createdAt)}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
