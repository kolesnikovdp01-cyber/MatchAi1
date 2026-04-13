import { useListAiPredictions } from "@workspace/api-client-react";
import { PredictionCard } from "@/components/prediction-card";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit, ShieldAlert, Clock } from "lucide-react";
import aiBanner from "@/assets/ai-banner.png";

function NoStableMatches() {
  const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kiev" });
  return (
    <div className="space-y-3">
      {/* Notification card */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(10,10,10,0.85)", border: "1px solid rgba(52,211,153,0.25)", boxShadow: "0 0 30px rgba(52,211,153,0.06)" }}>

        {/* Green top bar */}
        <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.8) 0%, rgba(52,211,153,0.2) 100%)" }} />

        {/* Header row */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
            <ShieldAlert className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-400/70 mb-0.5">
              Системное оповещение
            </div>
            <div className="font-mono font-bold text-sm text-white leading-tight">
              Стабильных матчей не найдено
            </div>
          </div>
          {/* Pulse dot */}
          <div className="relative shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4" style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          <p className="font-mono text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
            Нейросеть не нашла подходящих матчей с уверенностью выше порога. Выдавать слабый прогноз — значит рисковать вашим банком.
          </p>
          <p className="font-mono text-xs font-semibold" style={{ color: "rgba(52,211,153,0.75)" }}>
            Рекомендация: воздержитесь от ставок сегодня.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 pb-4">
          <Clock className="h-3 w-3" style={{ color: "rgba(255,255,255,0.2)" }} />
          <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            ИИ в режиме ожидания · Прогноз выйдет при первой возможности
          </span>
        </div>
      </div>

      {/* Subtle tip */}
      <p className="text-center font-mono text-[10px] tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.18)" }}>
        Лучшая ставка — та, которую не сделал
      </p>
    </div>
  );
}

export default function AiPredictions() {
  const { data: predictions, isLoading } = useListAiPredictions({ limit: 30 });

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* Hero Banner */}
      <div className="relative w-full overflow-hidden rounded-sm" style={{ height: "180px" }}>
        <img src={aiBanner} alt="AI Predictions" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-emerald-950/20" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.75) 0%, rgba(5,46,22,0.2) 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-6">
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit className="h-3 w-3 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Neural Analysis</span>
          </div>
          <h1 className="font-black font-mono text-2xl text-white tracking-tight leading-none">
            AI <span className="text-primary">прогнозы</span>
          </h1>
          <p className="font-mono text-[11px] text-white/50 mt-1.5 uppercase tracking-wider">
            Нейросеть · Анализ данных · Точность
          </p>
        </div>
      </div>

      {isLoading || !predictions ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-md" />)}</div>
      ) : predictions.length === 0 ? (
        <NoStableMatches />
      ) : (
        <div className="grid gap-4">
          {predictions.map((prediction: any) => (
            <PredictionCard key={prediction.id} prediction={prediction} type="ai" />
          ))}
        </div>
      )}
    </div>
  );
}
