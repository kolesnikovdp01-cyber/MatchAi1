import { useListAuthorPredictions } from "@workspace/api-client-react";
import { PredictionCard } from "@/components/prediction-card";
import { Skeleton } from "@/components/ui/skeleton";
import { PenLine, Clock, BookOpen } from "lucide-react";
import authorBanner from "@/assets/author-banner.png";

export default function AuthorPredictions() {
  const { data: predictions, isLoading } = useListAuthorPredictions({});

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* Hero Banner */}
      <div className="relative w-full overflow-hidden rounded-sm" style={{ height: "180px" }}>
        <img src={authorBanner} alt="Author Predictions" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-amber-950/30" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(180,83,9,0.15) 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-6">
          <div className="flex items-center gap-2 mb-1">
            <PenLine className="h-3 w-3" style={{ color: "#f59e0b" }} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#f59e0b" }}>Expert Picks</span>
          </div>
          <h1 className="font-black font-mono text-2xl text-white tracking-tight leading-none">
            Авторские <span style={{ color: "#f59e0b" }}>прогнозы</span>
          </h1>
          <p className="font-mono text-[11px] text-white/50 mt-1.5 uppercase tracking-wider">
            Экспертный анализ · Авторский взгляд
          </p>
        </div>
      </div>

      {isLoading || !predictions ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-md" />)}</div>
      ) : predictions.length === 0 ? (
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(10,10,10,0.85)", border: "1px solid rgba(245,158,11,0.25)", boxShadow: "0 0 30px rgba(245,158,11,0.06)" }}>
            <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.8) 0%, rgba(245,158,11,0.2) 100%)" }} />
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <BookOpen className="h-4 w-4 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="font-mono text-[10px] uppercase tracking-widest text-amber-400/70 mb-0.5">Экспертный канал</div>
                <div className="font-mono font-bold text-sm text-white leading-tight">Прогнозов пока нет</div>
              </div>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            </div>
            <div className="mx-4" style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />
            <div className="px-4 py-4 space-y-2">
              <p className="font-mono text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Эксперт анализирует сегодняшние матчи. Авторские прогнозы публикуются только при высокой уверенности в исходе.
              </p>
              <p className="font-mono text-xs font-semibold" style={{ color: "rgba(245,158,11,0.75)" }}>
                Следите за обновлениями — прогнозы появятся в ближайшее время.
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 pb-4">
              <Clock className="h-3 w-3" style={{ color: "rgba(255,255,255,0.2)" }} />
              <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                Обновления публикуются в течение дня
              </span>
            </div>
          </div>
          <p className="text-center font-mono text-[10px] tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.18)" }}>
            Качество важнее количества
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {predictions.map((prediction: any) => (
            <PredictionCard key={prediction.id} prediction={prediction} type="author" />
          ))}
        </div>
      )}
    </div>
  );
}
