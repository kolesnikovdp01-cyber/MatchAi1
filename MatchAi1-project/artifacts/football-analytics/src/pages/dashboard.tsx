import { useListAiPredictions, useListAuthorPredictions } from "@workspace/api-client-react";
import { PredictionCard } from "@/components/prediction-card";
import { Zap, ShieldAlert, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import heroBanner from "@/assets/hero-banner.png";
import { useLanguage } from "@/hooks/use-language";

export default function Dashboard() {
  const { t } = useLanguage();
  const { data: aiPredictions, isLoading: isLoadingAi } = useListAiPredictions({ todayOnly: true, limit: 20, status: "pending" });
  const { data: authorPredictions, isLoading: isLoadingAuthor } = useListAuthorPredictions({ todayOnly: true, limit: 20, status: "pending" });

  const isLoading = isLoadingAi || isLoadingAuthor;
  const hasAi = !!aiPredictions && aiPredictions.length > 0;
  const hasAuthor = !!authorPredictions && authorPredictions.length > 0;
  const hasAny = hasAi || hasAuthor;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">

      {/* Hero Banner */}
      <div className="relative w-full overflow-hidden rounded-sm" style={{ height: "180px" }}>
        <img src={heroBanner} alt="Football Analytics" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-6">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-3 w-3 text-primary" />
            <span className="font-mono text-[10px] text-primary uppercase tracking-[0.2em]">{t("hero.tagline")}</span>
          </div>
          <h1 className="font-black font-mono text-2xl text-white tracking-tight leading-none">
            Match<span className="text-primary">Ai</span>1
          </h1>
          <p className="font-mono text-[11px] text-white/50 mt-1.5 uppercase tracking-wider">
            {t("hero.subtitle")}
          </p>
        </div>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      )}

      {/* No predictions at all */}
      {!isLoading && !hasAny && (
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(10,10,10,0.85)", border: "1px solid rgba(52,211,153,0.25)", boxShadow: "0 0 30px rgba(52,211,153,0.06)" }}>
            <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.8) 0%, rgba(52,211,153,0.2) 100%)" }} />
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
                <ShieldAlert className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-400/70 mb-0.5">Системное оповещение</div>
                <div className="font-mono font-bold text-sm text-white leading-tight">Стабильных матчей не найдено</div>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            </div>
            <div className="mx-4" style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />
            <div className="px-4 py-4 space-y-2">
              <p className="font-mono text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Нейросеть проанализировала сегодняшние матчи и не нашла ни одного с уверенностью выше порога.
              </p>
              <p className="font-mono text-xs font-semibold" style={{ color: "rgba(52,211,153,0.75)" }}>
                Рекомендация: воздержитесь от ставок сегодня.
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 pb-4">
              <Clock className="h-3 w-3" style={{ color: "rgba(255,255,255,0.2)" }} />
              <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                ИИ в режиме ожидания · Прогноз выйдет при первой возможности
              </span>
            </div>
          </div>
          <p className="text-center font-mono text-[10px] tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.18)" }}>
            Лучшая ставка — та, которую не сделал
          </p>
        </div>
      )}

      {/* AI Predictions */}
      {!isLoading && hasAi && (
        <section>
          <div className="space-y-2">
            {aiPredictions!.map((p: any) => <PredictionCard key={`ai-${p.id}`} prediction={p} type="ai" />)}
          </div>
        </section>
      )}

      {/* Author Predictions */}
      {!isLoading && hasAuthor && (
        <section>
          <div className="space-y-2">
            {authorPredictions!.map((p: any) => <PredictionCard key={`author-${p.id}`} prediction={p} type="author" />)}
          </div>
        </section>
      )}

    </div>
  );
}
