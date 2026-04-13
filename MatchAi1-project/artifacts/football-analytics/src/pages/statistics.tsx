import { useState } from "react";
import { useGetStatisticsSummary, useListHistory, ListHistoryStatus, ListHistoryType } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PredictionCard } from "@/components/prediction-card";
import { BarChart3, TrendingUp, Percent, Target, History as HistoryIcon, Clock } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import statsBanner from "@/assets/stats-banner.png";

type Tab = "stats" | "history";

export default function Statistics() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("stats");
  const [statusFilter, setStatusFilter] = useState<ListHistoryStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ListHistoryType | "all">("all");

  const { data: summary, isLoading: isLoadingSummary } = useGetStatisticsSummary();

  const histParams: any = {};
  if (statusFilter !== "all") histParams.status = statusFilter;
  if (typeFilter !== "all") histParams.type = typeFilter;
  const { data: history, isLoading: isLoadingHistory } = useListHistory(histParams);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* Hero Banner — Statistics themed */}
      <div className="relative w-full overflow-hidden rounded-sm" style={{ height: "182px" }}>
        {/* Background image */}
        <img src={statsBanner} alt="Statistics" className="absolute inset-0 w-full h-full object-cover object-center" style={{ objectPosition: "center 40%" }} />
        {/* Dark overlays */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0.2) 100%)" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" />

        {/* Left side text */}
        <div className="absolute inset-0 flex flex-col justify-center px-6">
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart3 className="h-3 w-3 text-emerald-400" />
            <span className="font-mono text-[9px] text-emerald-400/80 uppercase tracking-[0.25em]">Аналитика</span>
          </div>
          <h1 className="font-black font-mono text-[26px] text-white tracking-tight leading-none">
            Стати<span className="text-emerald-400">стика</span>
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
              <span className="font-mono text-[10px] text-white/50 uppercase tracking-wide">Win Rate</span>
            </div>
            <div className="h-2.5 w-px bg-white/10" />
            <div className="flex items-center gap-1">
              <Percent className="h-2.5 w-2.5 text-emerald-400/70" />
              <span className="font-mono text-[10px] text-white/50 uppercase tracking-wide">Прогнозы</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-card border border-border/50">
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono text-sm font-medium transition-all ${
            activeTab === "stats"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          {t("stats.title")}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono text-sm font-medium transition-all ${
            activeTab === "history"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <HistoryIcon className="h-4 w-4" />
          {t("history.title")}
        </button>
      </div>

      {/* STATISTICS TAB */}
      {activeTab === "stats" && (
        <>
          {isLoadingSummary || !summary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-md" />)}
              </div>
              <Skeleton className="h-[300px] w-full rounded-md" />
            </div>
          ) : summary.totalPredictions === 0 && !summary.pending ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-card/30 rounded-lg border border-dashed border-border/50">
              <BarChart3 className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-mono text-sm">{t("stats.noData")}</p>
            </div>
          ) : summary.totalPredictions === 0 && summary.pending > 0 ? (
            <div className="space-y-3">
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(10,10,10,0.85)", border: "1px solid rgba(52,211,153,0.2)" }}>
                <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.8) 0%, rgba(245,158,11,0.15) 100%)" }} />
                <div className="flex items-center gap-3 px-4 py-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <Clock className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-amber-400/70 mb-0.5">В ожидании</div>
                    <div className="font-mono font-bold text-sm text-white leading-tight">
                      {summary.pending} {summary.pending === 1 ? "прогноз" : summary.pending < 5 ? "прогноза" : "прогнозов"} в игре
                    </div>
                    <div className="font-mono text-[10px] text-white/40 mt-1">
                      Статистика появится после завершения матчей
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { title: t("stats.totalPredictions"), value: summary.totalPredictions, icon: Target, desc: t("stats.totalDesc") },
                  { title: "ROI", value: `${summary.roi > 0 ? "+" : ""}${summary.roi.toFixed(2)}%`, icon: TrendingUp, desc: t("stats.roiDesc"), cls: summary.roi >= 0 ? "text-emerald-400" : "text-red-400" },
                  { title: t("stats.winRate"), value: `${summary.winRate.toFixed(1)}%`, icon: Percent, desc: t("stats.winRateDesc"), cls: "text-emerald-400" },
                  { title: t("stats.avgOdds"), value: summary.averageOdds.toFixed(2), icon: BarChart3, desc: t("stats.avgOddsDesc") },
                ].map((s, i) => (
                  <Card key={i} className="bg-card border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 px-4 pt-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.title}</CardTitle>
                      <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className={`text-2xl font-bold font-mono ${s.cls || ""}`}>{s.value}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="bg-card border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <CardTitle className="font-mono text-sm text-primary uppercase">{t("stats.winRateBreakdown")}</CardTitle>
                    {summary.firstPredictionDate && (
                      <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                        с {new Date(summary.firstPredictionDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Kiev" })} · {summary.totalPredictions} прогн.
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* AI Predictions */}
                  {(() => {
                    const total = summary.aiTotal || 1;
                    const wr = summary.aiWinRate;
                    const textCls = wr >= 60 ? "text-emerald-400" : wr >= 40 ? "text-yellow-400" : "text-red-400";
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-white/80">{t("stats.aiPredictions")}</span>
                          <span className={`font-mono text-xs font-bold ${textCls}`}>{wr.toFixed(1)}%</span>
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-20 shrink-0 whitespace-nowrap text-[10px] font-mono text-emerald-400">{t("stats.wins")} {summary.aiWins}</span>
                            <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${(summary.aiWins / total) * 100}%`, background: "hsl(142 71% 45%)" }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-20 shrink-0 whitespace-nowrap text-[10px] font-mono text-red-400">{t("stats.losses")} {summary.aiLosses}</span>
                            <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${(summary.aiLosses / total) * 100}%`, background: "hsl(0 72% 50%)" }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-20 shrink-0 whitespace-nowrap text-[10px] font-mono text-zinc-500">{t("stats.refunds")} {summary.aiRefunds}</span>
                            <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${(summary.aiRefunds / total) * 100}%`, background: "hsl(0 0% 40%)" }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Author Predictions */}
                  {(() => {
                    const total = summary.authorTotal || 1;
                    const wr = summary.authorWinRate;
                    const textCls = wr >= 60 ? "text-emerald-400" : wr >= 40 ? "text-yellow-400" : "text-red-400";
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-white/80">{t("stats.authorPrediction")}</span>
                          <span className={`font-mono text-xs font-bold ${textCls}`}>{wr.toFixed(1)}%</span>
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-20 shrink-0 whitespace-nowrap text-[10px] font-mono text-emerald-400">{t("stats.wins")} {summary.authorWins}</span>
                            <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${(summary.authorWins / total) * 100}%`, background: "hsl(142 71% 45%)" }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-20 shrink-0 whitespace-nowrap text-[10px] font-mono text-red-400">{t("stats.losses")} {summary.authorLosses}</span>
                            <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${(summary.authorLosses / total) * 100}%`, background: "hsl(0 72% 50%)" }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-20 shrink-0 whitespace-nowrap text-[10px] font-mono text-zinc-500">{t("stats.refunds")} {summary.authorRefunds}</span>
                            <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${(summary.authorRefunds / total) * 100}%`, background: "hsl(0 0% 40%)" }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Totals row */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/30">
                    {[
                      { label: t("stats.wins"), val: summary.wins, cls: "text-emerald-400", dot: "bg-emerald-500" },
                      { label: t("stats.losses"), val: summary.losses, cls: "text-red-400", dot: "bg-red-500" },
                      { label: t("stats.refunds"), val: summary.refunds, cls: "text-zinc-400", dot: "bg-zinc-600" },
                    ].map((item, i) => (
                      <div key={i} className="bg-background/40 p-2.5 rounded-lg border border-border/30 text-center">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.dot} mx-auto mb-1`} />
                        <div className={`text-lg font-mono font-bold ${item.cls}`}>{item.val}</div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
        </>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
              <SelectTrigger className="font-mono bg-card flex-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("history.typeAll")}</SelectItem>
                <SelectItem value="ai">{t("history.typeAi")}</SelectItem>
                <SelectItem value="author">{t("history.typeAuthor")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="font-mono bg-card flex-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("history.statusAll")}</SelectItem>
                <SelectItem value="win">{t("history.statusWin")}</SelectItem>
                <SelectItem value="lose">{t("history.statusLose")}</SelectItem>
                <SelectItem value="refund">{t("history.statusRefund")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoadingHistory || !history ? (
            <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-md" />)}</div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-card/30 rounded-lg border border-dashed border-border/50">
              <HistoryIcon className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-mono">{t("history.noRecords")}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {history.map((entry: any) => <PredictionCard key={entry.id} prediction={entry} type="history" />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
