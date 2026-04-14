import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, LogOut, Plus, Trash2, ExternalLink, ChevronDown, ChevronUp, BrainCircuit, UserPen, BarChart3, Edit2, Check, X, ArrowLeft, Loader2, TrendingUp, RefreshCw, Database, Megaphone, Coins, ToggleLeft, ToggleRight, Users, Bell, BellOff, Trophy, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ADMIN_STORAGE_KEY = "matchai1_admin_id";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function apiUrl(path: string) {
  return `${BASE}/api${path}`;
}

async function apiFetch(path: string, options: RequestInit = {}, adminId: string) {
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Id": adminId,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Ошибка запроса");
  }
  if (res.status === 204) return null;
  return res.json();
}

type PredButton = { id: number; label: string; url: string; sortOrder: number };
type AiPred = { id: number; matchTitle: string; homeTeam: string; awayTeam: string; league: string; prediction: string; status: string; analysis: string; confidence: number; odds: number; publishAt?: string | null; matchDate?: string | null };
type AuthorPred = { id: number; matchTitle: string; homeTeam: string; awayTeam: string; league: string; prediction: string; status: string; reasoning: string; odds: number; stake: number };

function ButtonManager({ type, predId, adminId }: { type: "ai" | "author"; predId: number; adminId: string }) {
  const [buttons, setButtons] = useState<PredButton[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const fetchButtons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(apiUrl(`/buttons?type=${type}&predictionId=${predId}`)).then(r => r.json());
      setButtons(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [type, predId]);

  useEffect(() => { fetchButtons(); }, [fetchButtons]);

  const addButton = async () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    if (buttons.length >= 3) { toast({ title: "Максимум 3 кнопки", variant: "destructive" }); return; }
    setAdding(true);
    try {
      const btn = await apiFetch("/admin/buttons", {
        method: "POST",
        body: JSON.stringify({ predictionType: type, predictionId: predId, label: newLabel.trim(), url: newUrl.trim(), sortOrder: buttons.length }),
      }, adminId);
      setButtons(prev => [...prev, btn]);
      setNewLabel(""); setNewUrl("");
      toast({ title: "Кнопка добавлена" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
    setAdding(false);
  };

  const deleteButton = async (id: number) => {
    try {
      await apiFetch(`/admin/buttons/${id}`, { method: "DELETE" }, adminId);
      setButtons(prev => prev.filter(b => b.id !== id));
      toast({ title: "Кнопка удалена" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
        Кнопки ({buttons.length}/3)
      </div>
      {loading ? (
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
      ) : (
        <>
          {buttons.map(btn => (
            <div key={btn.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{btn.label}</div>
                <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{btn.url}</div>
              </div>
              <button onClick={() => deleteButton(btn.id)} className="shrink-0 p-1 rounded hover:bg-red-500/20 transition-colors">
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
          ))}

          {buttons.length < 3 && (
            <div className="flex gap-2 mt-2">
              <div className="flex-1 space-y-1.5">
                <Input
                  placeholder="Текст кнопки"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  className="h-8 text-xs bg-black/30 border-white/10 text-white placeholder:text-white/30"
                />
                <Input
                  placeholder="https://..."
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  className="h-8 text-xs bg-black/30 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              <Button size="sm" onClick={addButton} disabled={adding || !newLabel || !newUrl} className="h-auto self-stretch text-xs px-3">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type LiveOddsRow = { id: number; fixtureId: string; homeTeam: string; awayTeam: string; league: string; matchDate: string; oddsHome: number | null; oddsDraw: number | null; oddsAway: number | null; bookmaker: string | null; fetchedAt: string };

function OddsTab({ adminId, onAiGenerated }: { adminId: string; onAiGenerated?: () => void }) {
  const [rows, setRows] = useState<LiveOddsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [genResults, setGenResults] = useState<Record<number, { ok: boolean; text: string }>>({});
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(apiUrl("/live-odds")).then(r => r.json());
      setRows(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch("/admin/live-odds/refresh", { method: "POST" }, adminId);
      toast({ title: `Обновлено: ${res.fetched} матчей на ${res.date}` });
      await load();
    } catch (e: any) {
      toast({ title: "Ошибка обновления", description: e.message, variant: "destructive" });
    }
    setRefreshing(false);
  };

  const clear = async () => {
    if (!confirm("Очистить все коэффициенты?")) return;
    await apiFetch("/admin/live-odds", { method: "DELETE" }, adminId);
    setRows([]);
    toast({ title: "Коэффициенты очищены" });
  };

  const generateAi = async (row: LiveOddsRow) => {
    setGeneratingFor(row.id);
    try {
      const res = await apiFetch("/admin/generate-prediction", {
        method: "POST",
        body: JSON.stringify({
          homeTeam: row.homeTeam,
          awayTeam: row.awayTeam,
          league: row.league,
          matchDate: row.matchDate,
        }),
      }, adminId);
      if (res.skipped) {
        setGenResults(prev => ({ ...prev, [row.id]: { ok: false, text: `Пропущено: ${res.reason}` } }));
        toast({ title: "ИИ пропустил матч", description: res.reason });
      } else {
        setGenResults(prev => ({ ...prev, [row.id]: { ok: true, text: `${res.prediction} · ${Math.round(res.confidence * 100)}% · КФ ${Number(res.odds).toFixed(2)}` } }));
        toast({ title: "✅ Прогноз создан!", description: `${res.prediction} · КФ ${Number(res.odds).toFixed(2)}` });
        onAiGenerated?.();
      }
    } catch (e: any) {
      setGenResults(prev => ({ ...prev, [row.id]: { ok: false, text: e.message } }));
      toast({ title: "Ошибка генерации", description: e.message, variant: "destructive" });
    }
    setGeneratingFor(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wide">Коэффициенты</h2>
        <div className="flex gap-2">
          <button onClick={clear} className="text-[10px] text-red-400/60 hover:text-red-400 font-mono transition-colors">Очистить</button>
          <button onClick={load} className="text-[10px] text-white/30 hover:text-white/60 font-mono">↻ Обновить</button>
        </div>
      </div>

      <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
        <div>
          <div className="font-mono text-xs font-semibold text-primary">API-Football (RapidAPI)</div>
          <div className="text-[10px] text-white/30 font-mono mt-0.5">Очищается каждые сутки · {rows.length} матчей загружено</div>
        </div>
        <Button
          onClick={refresh}
          disabled={refreshing}
          size="sm"
          className="gap-1.5 font-mono text-xs bg-primary text-black hover:bg-primary/90 h-8"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {refreshing ? "Загрузка..." : "Обновить"}
        </Button>
      </div>

      {/* Hint */}
      <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}>
        <BrainCircuit className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(34,197,94,0.6)" }} />
        <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          Нажмите «ИИ» рядом с матчем чтобы сгенерировать прогноз
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/30 font-mono text-sm">Загрузка...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <TrendingUp className="h-10 w-10 text-white/10 mx-auto" />
          <div className="text-white/30 font-mono text-sm">Нет данных</div>
          <div className="text-[11px] text-white/20 font-mono">Нажмите «Обновить» для загрузки матчей дня</div>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const isGenerating = generatingFor === row.id;
            const result = genResults[row.id];
            return (
              <div key={row.id} className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${result ? (result.ok ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.07)") : "rgba(255,255,255,0.07)"}` }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-bold text-white truncate">{row.homeTeam} — {row.awayTeam}</div>
                    <div className="text-[10px] text-white/30 font-mono mt-0.5">{row.league} · {new Date(row.matchDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kiev" })}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {[
                      { label: "П1", val: row.oddsHome, cls: "text-emerald-400" },
                      { label: "X", val: row.oddsDraw, cls: "text-white/60" },
                      { label: "П2", val: row.oddsAway, cls: "text-sky-400" },
                    ].map(item => (
                      <div key={item.label} className="text-center w-11 rounded px-1 py-1" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className={`font-mono font-black text-sm leading-none ${item.cls}`}>{item.val?.toFixed(2) ?? "—"}</div>
                        <div className="text-[8px] text-white/25 font-mono mt-0.5">{item.label}</div>
                      </div>
                    ))}
                    <button
                      onClick={() => generateAi(row)}
                      disabled={isGenerating || !!result}
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                      style={{ background: result ? (result.ok ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)") : "rgba(34,197,94,0.12)", border: `1px solid ${result ? (result.ok ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)") : "rgba(34,197,94,0.25)"}` }}
                      title={result ? result.text : "Генерировать ИИ прогноз"}
                    >
                      {isGenerating
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        : result
                          ? (result.ok ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <X className="h-3.5 w-3.5 text-white/30" />)
                          : <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                      }
                    </button>
                  </div>
                </div>
                {result && (
                  <div className={`mt-1.5 font-mono text-[10px] ${result.ok ? "text-emerald-400" : "text-white/30"}`}>
                    {result.ok ? "✅ " : "⚠️ "}{result.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type StatsStatus = { usage: { today: number; limit: number; canFetch: boolean; blocked?: boolean }; cachedEntries: number; history: { id: number; date: string; provider: string; count: number }[] };
type StatsCacheEntry = { id: number; key: string; type: string; fetchedAt: string };

function StatsApiTab({ adminId }: { adminId: string }) {
  const [status, setStatus] = useState<StatsStatus | null>(null);
  const [entries, setEntries] = useState<StatsCacheEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const { toast } = useToast();

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([
        apiFetch("/admin/stats-cache/status", { method: "GET" }, adminId),
        apiFetch("/admin/stats-cache/entries", { method: "GET" }, adminId),
      ]);
      setStatus(s);
      setEntries(Array.isArray(e) ? e : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [adminId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch("/admin/stats-cache/refresh", { method: "POST" }, adminId);
      toast({ title: `База обновлена. Запросов сегодня: ${res.usage?.today}/${res.usage?.limit}. Записей: ${res.cachedEntries}` });
      await loadStatus();
    } catch (e: any) {
      toast({ title: "Ошибка обновления", description: e.message, variant: "destructive" });
    }
    setRefreshing(false);
  };

  const autoGenerate = async () => {
    setAutoGenerating(true);
    try {
      await apiFetch("/admin/auto-generate", { method: "POST" }, adminId);
      toast({ title: "🤖 Авто-генерация запущена", description: "Прогнозы появятся в течение нескольких минут. Проверь вкладку ИИ-прогнозы." });
    } catch (e: any) {
      toast({ title: "Ошибка запуска", description: e.message, variant: "destructive" });
    }
    setTimeout(() => setAutoGenerating(false), 10000);
  };

  const byType: Record<string, number> = {};
  entries.forEach(e => { byType[e.type] = (byType[e.type] ?? 0) + 1; });

  const usedPct = status ? Math.round((status.usage.today / status.usage.limit) * 100) : 0;
  const barColor = usedPct < 60 ? "#22c55e" : usedPct < 85 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wide">База Статистики</h2>
        <button onClick={loadStatus} className="text-[10px] text-white/30 hover:text-white/60 font-mono">↻ Обновить</button>
      </div>

      {/* Auto-generate button */}
      <div className="rounded-xl p-4" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-xs font-bold text-green-400">🤖 Авто-генерация прогнозов</div>
            <div className="text-[10px] text-white/30 font-mono mt-0.5">
              Каждый день в 06:00 КВ автоматически. Или нажми вручную.
            </div>
          </div>
          <Button
            onClick={autoGenerate}
            disabled={autoGenerating}
            size="sm"
            className="gap-1.5 font-mono text-xs h-8 shrink-0"
            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            {autoGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />}
            {autoGenerating ? "Идёт генерация..." : "Запустить сейчас"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/30 font-mono text-sm">Загрузка...</div>
      ) : (
        <>
          <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-xs font-semibold text-white">API-Football · Статистика</div>
                <div className="text-[10px] text-white/30 font-mono mt-0.5">Данные хранятся навсегда · используются ИИ при анализе</div>
              </div>
              <Button onClick={refresh} disabled={refreshing} size="sm" className="gap-1.5 font-mono text-xs bg-primary text-black hover:bg-primary/90 h-8">
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {refreshing ? "Загрузка..." : "Обновить"}
              </Button>
            </div>

            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-white/40">Запросов сегодня</span>
                <span style={{ color: barColor }}>{status?.usage.today ?? 0} / {status?.usage.limit ?? 85}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, usedPct)}%`, background: barColor }} />
              </div>
              {status?.usage.blocked && (
                <div className="mt-2 rounded-lg p-2.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <div className="text-[10px] text-red-400 font-mono font-bold mb-1">⚠ Нет доступа (403)</div>
                  <div className="text-[10px] text-red-400/70 font-mono">Активируйте подписку на API-Football на RapidAPI, затем нажмите «Сбросить блок».</div>
                  <button
                    onClick={async () => {
                      await apiFetch("/admin/stats-cache/reset-block", { method: "POST" }, adminId);
                      await loadStatus();
                      toast({ title: "Блок сброшен. Нажмите «Обновить» для повторной попытки." });
                    }}
                    className="mt-1.5 text-[10px] font-mono text-red-300 hover:text-red-200 underline"
                  >
                    Сбросить блок и повторить
                  </button>
                </div>
              )}
              {!status?.usage.blocked && !status?.usage.canFetch && (
                <div className="text-[10px] text-red-400 font-mono mt-1">Дневной лимит исчерпан. Обновление завтра.</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="font-mono font-black text-2xl text-primary">{entries.length}</div>
              <div className="text-[10px] text-white/30 font-mono mt-0.5">Всего записей</div>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="font-mono font-black text-2xl text-white">{Object.keys(byType).length}</div>
              <div className="text-[10px] text-white/30 font-mono mt-0.5">Типов данных</div>
            </div>
          </div>

          {Object.keys(byType).length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-2 border-b border-white/5 font-mono text-[10px] uppercase tracking-widest text-white/30">Структура кэша</div>
              {Object.entries(byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between px-4 py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <Database className="h-3 w-3 text-primary/60" />
                    <span className="font-mono text-xs text-white/70">{type}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-primary">{count}</span>
                </div>
              ))}
            </div>
          )}

          {status?.history && status.history.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-2 border-b border-white/5 font-mono text-[10px] uppercase tracking-widest text-white/30">История запросов</div>
              {status.history.slice().reverse().slice(0, 7).map(h => (
                <div key={h.id} className="flex items-center justify-between px-4 py-2 border-b border-white/5 last:border-0">
                  <span className="font-mono text-xs text-white/40">{h.date}</span>
                  <span className="font-mono text-xs font-bold text-white">{h.count} запросов</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}


function AiCard({ pred, adminId, onStatusChange }: { pred: AiPred; adminId: string; onStatusChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [editingAnalysis, setEditingAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState(pred.analysis);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(pred.status);
  const { toast } = useToast();

  const saveAnalysis = async () => {
    setSaving(true);
    try {
      await apiFetch(`/admin/ai-predictions/${pred.id}`, { method: "PATCH", body: JSON.stringify({ analysis }) }, adminId);
      toast({ title: "Анализ обновлён" });
      setEditingAnalysis(false);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const saveStatus = async (val: string) => {
    setStatus(val);
    try {
      await apiFetch(`/admin/ai-predictions/${pred.id}`, { method: "PATCH", body: JSON.stringify({ status: val }) }, adminId);
      toast({ title: "Статус обновлён" });
      onStatusChange();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const isScheduled = pred.publishAt && new Date(pred.publishAt) > new Date();
  const publishTime = pred.publishAt
    ? new Date(pred.publishAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kiev" })
    : null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: isScheduled ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.03)", border: isScheduled ? "1px solid rgba(99,102,241,0.25)" : "1px solid rgba(255,255,255,0.07)" }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-bold text-white truncate">{pred.homeTeam} vs {pred.awayTeam}</div>
          <div className="text-[11px] mt-0.5 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.4)" }}>
            <span>{pred.league} · {pred.prediction} · {pred.odds.toFixed(2)}</span>
            {isScheduled && publishTime && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.2)", color: "rgb(165,180,252)" }}>
                ⏰ с {publishTime}
              </span>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${status === "win" ? "bg-green-500/20 text-green-400" : status === "lose" ? "bg-red-500/20 text-red-400" : status === "refund" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/40"}`}>
          {status.toUpperCase()}
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-white/30" /> : <ChevronDown className="h-4 w-4 shrink-0 text-white/30" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          <div className="mt-3">
            <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Статус</div>
            <Select value={status} onValueChange={saveStatus}>
              <SelectTrigger className="h-8 text-xs bg-black/30 border-white/10 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Ожидание</SelectItem>
                <SelectItem value="win">Выигрыш</SelectItem>
                <SelectItem value="lose">Проигрыш</SelectItem>
                <SelectItem value="refund">Возврат</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Анализ</div>
              {!editingAnalysis ? (
                <button onClick={() => setEditingAnalysis(true)} className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70">
                  <Edit2 className="h-3 w-3" /> Изменить
                </button>
              ) : (
                <div className="flex gap-1">
                  <button onClick={saveAnalysis} disabled={saving} className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300">
                    <Check className="h-3 w-3" /> {saving ? "..." : "Сохранить"}
                  </button>
                  <button onClick={() => { setEditingAnalysis(false); setAnalysis(pred.analysis); }} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 ml-2">
                    <X className="h-3 w-3" /> Отмена
                  </button>
                </div>
              )}
            </div>
            {editingAnalysis ? (
              <Textarea
                rows={3}
                value={analysis}
                onChange={e => setAnalysis(e.target.value)}
                className="text-xs bg-black/30 border-white/10 text-white placeholder:text-white/30"
              />
            ) : (
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{analysis}</p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// Manual AI prediction generator (for matches not in live odds)
function ManualAiGenerateForm({ adminId, onGenerated }: { adminId: string; onGenerated: () => void }) {
  const [open, setOpen] = useState(false);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [league, setLeague] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const { toast } = useToast();

  const generate = async () => {
    if (!homeTeam || !awayTeam || !matchDate) {
      toast({ title: "Заполни команды и дату матча", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await apiFetch("/admin/generate-prediction", {
        method: "POST",
        body: JSON.stringify({ homeTeam, awayTeam, league: league || "Неизвестная лига", matchDate: new Date(matchDate).toISOString() }),
      }, adminId);
      if (res.skipped) {
        setResult({ ok: false, text: `ИИ пропустил: ${res.reason}` });
        toast({ title: "ИИ пропустил матч", description: res.reason });
      } else {
        setResult({ ok: true, text: `${res.prediction} · ${Math.round(res.confidence * 100)}% · КФ ${Number(res.odds).toFixed(2)}` });
        toast({ title: "✅ Прогноз создан!", description: `${res.prediction} · КФ ${Number(res.odds).toFixed(2)}` });
        setHomeTeam(""); setAwayTeam(""); setLeague(""); setMatchDate("");
        onGenerated();
      }
    } catch (e: any) {
      setResult({ ok: false, text: e.message });
      toast({ title: "Ошибка генерации", description: e.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.2)" }}>
      <button onClick={() => { setOpen(!open); setResult(null); }} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-bold text-white">Сгенерировать ИИ прогноз</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="font-mono text-[10px] text-white/30">Введи данные матча — ИИ проанализирует статистику и создаст прогноз</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-white/50 text-[10px] font-mono uppercase">Хозяева</Label>
              <Input value={homeTeam} onChange={e => setHomeTeam(e.target.value)} placeholder="Арсенал"
                className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
            </div>
            <div>
              <Label className="text-white/50 text-[10px] font-mono uppercase">Гости</Label>
              <Input value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder="Челси"
                className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-white/50 text-[10px] font-mono uppercase">Лига (необяз.)</Label>
              <Input value={league} onChange={e => setLeague(e.target.value)} placeholder="АПЛ"
                className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
            </div>
            <div>
              <Label className="text-white/50 text-[10px] font-mono uppercase">Дата и время</Label>
              <Input type="datetime-local" value={matchDate} onChange={e => setMatchDate(e.target.value)}
                className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
            </div>
          </div>
          {result && (
            <div className={`font-mono text-xs rounded-lg px-3 py-2 ${result.ok ? "text-emerald-400 bg-emerald-500/10" : "text-white/40 bg-white/5"}`}>
              {result.ok ? "✅ " : "⚠️ "}{result.text}
            </div>
          )}
          <Button onClick={generate} disabled={generating} className="w-full font-mono text-sm"
            style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>
            {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Анализирую...</> : <><BrainCircuit className="h-4 w-4 mr-2" />Генерировать прогноз</>}
          </Button>
          <p className="font-mono text-[9px] text-white/20 text-center">
            Если уверенность ИИ &lt; 78% — прогноз будет пропущен автоматически
          </p>
        </div>
      )}
    </div>
  );
}

// Global buttons for ALL AI predictions (predictionId=0)
function GlobalAiButtonManager({ adminId }: { adminId: string }) {
  const [buttons, setButtons] = useState<PredButton[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const fetchButtons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(apiUrl("/admin/global-ai-buttons"), {
        headers: { "x-admin-id": adminId },
      }).then(r => r.json());
      setButtons(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [adminId]);

  useEffect(() => { fetchButtons(); }, [fetchButtons]);

  const addButton = async () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    if (buttons.length >= 3) { toast({ title: "Максимум 3 кнопки", variant: "destructive" }); return; }
    setAdding(true);
    try {
      const btn = await apiFetch("/admin/buttons", {
        method: "POST",
        body: JSON.stringify({ predictionType: "ai", predictionId: 0, label: newLabel.trim(), url: newUrl.trim(), sortOrder: buttons.length }),
      }, adminId);
      setButtons(prev => [...prev, btn]);
      setNewLabel(""); setNewUrl("");
      toast({ title: "Кнопка добавлена — будет показана во всех ИИ прогнозах" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
    setAdding(false);
  };

  const deleteButton = async (id: number) => {
    try {
      await apiFetch(`/admin/buttons/${id}`, { method: "DELETE" }, adminId);
      setButtons(prev => prev.filter(b => b.id !== id));
      toast({ title: "Кнопка удалена" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-xs font-bold text-green-400 uppercase tracking-wider">Глобальные кнопки ИИ</div>
          <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            Показываются под всеми ИИ-прогнозами автоматически ({buttons.length}/3)
          </div>
        </div>
        <button onClick={fetchButtons} className="text-[10px] text-white/30 hover:text-white/60 font-mono">↻</button>
      </div>

      {loading ? (
        <div className="text-xs text-white/30">Загрузка...</div>
      ) : (
        <>
          <div className="space-y-2">
            {buttons.map(btn => (
              <div key={btn.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{btn.label}</div>
                  <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{btn.url}</div>
                </div>
                <button onClick={() => deleteButton(btn.id)} className="shrink-0 p-1 rounded hover:bg-red-500/20 transition-colors">
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
            ))}
          </div>

          {buttons.length < 3 && (
            <div className="flex gap-2 mt-3">
              <div className="flex-1 space-y-1.5">
                <Input
                  placeholder="Текст кнопки (напр. Подписаться на канал)"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  className="h-8 text-xs bg-black/30 border-white/10 text-white placeholder:text-white/30"
                />
                <Input
                  placeholder="https://t.me/..."
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addButton()}
                  className="h-8 text-xs bg-black/30 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              <Button size="sm" onClick={addButton} disabled={adding || !newLabel || !newUrl} className="h-auto self-stretch text-xs px-3 bg-green-600 hover:bg-green-500 text-black">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Global buttons for ALL Author predictions (predictionId=0)
function GlobalAuthorButtonManager({ adminId }: { adminId: string }) {
  const [buttons, setButtons] = useState<PredButton[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const fetchButtons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(apiUrl("/admin/global-author-buttons"), {
        headers: { "x-admin-id": adminId },
      }).then(r => r.json());
      setButtons(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [adminId]);

  useEffect(() => { fetchButtons(); }, [fetchButtons]);

  const addButton = async () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    if (buttons.length >= 3) { toast({ title: "Максимум 3 кнопки", variant: "destructive" }); return; }
    setAdding(true);
    try {
      const btn = await apiFetch("/admin/buttons", {
        method: "POST",
        body: JSON.stringify({ predictionType: "author", predictionId: 0, label: newLabel.trim(), url: newUrl.trim(), sortOrder: buttons.length }),
      }, adminId);
      setButtons(prev => [...prev, btn]);
      setNewLabel(""); setNewUrl("");
      toast({ title: "Кнопка добавлена — будет показана во всех авторских прогнозах" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
    setAdding(false);
  };

  const deleteButton = async (id: number) => {
    try {
      await apiFetch(`/admin/buttons/${id}`, { method: "DELETE" }, adminId);
      setButtons(prev => prev.filter(b => b.id !== id));
      toast({ title: "Кнопка удалена" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-xs font-bold text-amber-400 uppercase tracking-wider">Глобальные кнопки Автора</div>
          <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            Показываются под всеми авторскими прогнозами автоматически ({buttons.length}/3)
          </div>
        </div>
        <button onClick={fetchButtons} className="text-[10px] text-white/30 hover:text-white/60 font-mono">↻</button>
      </div>

      {loading ? (
        <div className="text-xs text-white/30">Загрузка...</div>
      ) : (
        <>
          <div className="space-y-2">
            {buttons.map(btn => (
              <div key={btn.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{btn.label}</div>
                  <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{btn.url}</div>
                </div>
                <button onClick={() => deleteButton(btn.id)} className="shrink-0 p-1 rounded hover:bg-red-500/20 transition-colors">
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
            ))}
          </div>

          {buttons.length < 3 && (
            <div className="flex gap-2 mt-3">
              <div className="flex-1 space-y-1.5">
                <Input
                  placeholder="Текст кнопки (напр. Подписаться на канал)"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  className="h-8 text-xs bg-black/30 border-white/10 text-white placeholder:text-white/30"
                />
                <Input
                  placeholder="https://t.me/..."
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addButton()}
                  className="h-8 text-xs bg-black/30 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              <Button size="sm" onClick={addButton} disabled={adding || !newLabel || !newUrl} className="h-auto self-stretch text-xs px-3 bg-amber-600 hover:bg-amber-500 text-black">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const DRAFT_KEY = "matchai1_author_draft";

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function AddAuthorForm({ adminId, onCreated }: { adminId: string; onCreated: () => void }) {
  const draft = loadDraft();
  const [open, setOpen] = useState(!!draft);
  const [homeTeam, setHomeTeam] = useState(draft?.homeTeam ?? "");
  const [awayTeam, setAwayTeam] = useState(draft?.awayTeam ?? "");
  const [league, setLeague] = useState(draft?.league ?? "");
  const [matchDate, setMatchDate] = useState(draft?.matchDate ?? "");
  const [publishAt, setPublishAt] = useState(draft?.publishAt ?? "");
  const [prediction, setPrediction] = useState(draft?.prediction ?? "");
  const [odds, setOdds] = useState(draft?.odds ?? "");
  const [stake, setStake] = useState(draft?.stake ?? "75");
  const [reasoning, setReasoning] = useState(draft?.reasoning ?? "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function saveDraft(patch: Record<string, string>) {
    try {
      const current = loadDraft() ?? {};
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...current, ...patch }));
    } catch { /* ignore */ }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  async function submit() {
    if (!homeTeam || !awayTeam || !league || !matchDate || !prediction || !odds || !reasoning) {
      toast({ title: "Заполни все поля", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/author-predictions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-id": adminId },
        body: JSON.stringify({
          homeTeam,
          awayTeam,
          matchTitle: `${homeTeam} vs ${awayTeam}`,
          league,
          matchDate: new Date(matchDate).toISOString(),
          publishAt: publishAt ? new Date(publishAt).toISOString() : null,
          prediction,
          odds: parseFloat(odds),
          stake: parseInt(stake),
          reasoning,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Прогноз добавлен" });
      clearDraft();
      setOpen(false);
      setHomeTeam(""); setAwayTeam(""); setLeague(""); setMatchDate(""); setPublishAt("");
      setPrediction(""); setOdds(""); setStake("75"); setReasoning("");
      onCreated();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(10,10,10,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <button className="w-full flex items-center gap-3 px-4 py-3" onClick={() => setOpen(o => !o)}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <Plus className="h-4 w-4 text-amber-400" />
        </div>
        <span className="font-mono text-sm font-bold text-amber-400 flex-1 text-left">Добавить прогноз</span>
        {open ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-white/50 text-[10px] font-mono uppercase">Хозяева</Label>
              <Input value={homeTeam} onChange={e => { setHomeTeam(e.target.value); saveDraft({ homeTeam: e.target.value }); }} placeholder="Арсенал"
                className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
            </div>
            <div>
              <Label className="text-white/50 text-[10px] font-mono uppercase">Гости</Label>
              <Input value={awayTeam} onChange={e => { setAwayTeam(e.target.value); saveDraft({ awayTeam: e.target.value }); }} placeholder="Челси"
                className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-white/50 text-[10px] font-mono uppercase">Лига</Label>
            <Input value={league} onChange={e => { setLeague(e.target.value); saveDraft({ league: e.target.value }); }} placeholder="Английская Премьер-лига"
              className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
          </div>

          <div>
            <Label className="text-white/50 text-[10px] font-mono uppercase">Дата и время матча</Label>
            <Input type="datetime-local" value={matchDate} onChange={e => { setMatchDate(e.target.value); saveDraft({ matchDate: e.target.value }); }}
              className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
          </div>

          <div>
            <Label className="text-white/50 text-[10px] font-mono uppercase">
              Время публикации <span className="text-white/25 normal-case">(пусто = сразу)</span>
            </Label>
            <Input type="datetime-local" value={publishAt} onChange={e => { setPublishAt(e.target.value); saveDraft({ publishAt: e.target.value }); }}
              className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
            {publishAt && (
              <div className="mt-1 text-[10px] font-mono" style={{ color: "rgba(245,158,11,0.7)" }}>
                Прогноз появится у пользователей {new Date(publishAt).toLocaleString("ru-RU", { timeZone: "Europe/Kiev", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            {!publishAt && (
              <div className="mt-1 text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                Прогноз появится сразу после сохранения
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-white/50 text-[10px] font-mono uppercase">Прогноз</Label>
              <Input value={prediction} onChange={e => { setPrediction(e.target.value); saveDraft({ prediction: e.target.value }); }} placeholder="ТБ 2.5"
                className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
            </div>
            <div>
              <Label className="text-white/50 text-[10px] font-mono uppercase">Коэф.</Label>
              <Input type="number" value={odds} onChange={e => { setOdds(e.target.value); saveDraft({ odds: e.target.value }); }} placeholder="1.85" step="0.01" min="1"
                className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
            </div>
            <div>
              <Label className="text-white/50 text-[10px] font-mono uppercase">Уверенность (%)</Label>
              <Input type="number" value={stake} onChange={e => { setStake(e.target.value); saveDraft({ stake: e.target.value }); }} placeholder="75" min="1" max="100"
                className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-white/50 text-[10px] font-mono uppercase">Анализ</Label>
            <Textarea value={reasoning} onChange={e => { setReasoning(e.target.value); saveDraft({ reasoning: e.target.value }); }}
              placeholder="Обоснование прогноза..." rows={4}
              className="mt-1 text-white bg-white/5 border-white/10 font-mono text-sm resize-none" />
          </div>

          <Button onClick={submit} disabled={saving}
            className="w-full font-mono text-sm"
            style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Сохранить прогноз
          </Button>
        </div>
      )}
    </div>
  );
}

function AuthorCard({ pred, adminId, onDelete, onStatusChange }: { pred: AuthorPred; adminId: string; onDelete: () => void; onStatusChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(pred.status);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const saveStatus = async (val: string) => {
    setStatus(val);
    try {
      await apiFetch(`/author-predictions/${pred.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: val }),
      }, adminId);
      toast({ title: "Статус обновлён" });
      onStatusChange();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const deletePred = async () => {
    if (!confirm(`Удалить прогноз ${pred.homeTeam} vs ${pred.awayTeam}?`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/admin/author-predictions/${pred.id}`, { method: "DELETE" }, adminId);
      toast({ title: "Прогноз удалён" });
      onDelete();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
    setDeleting(false);
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-bold text-white truncate">{pred.homeTeam} vs {pred.awayTeam}</div>
          <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{pred.league} · {pred.prediction} · {pred.stake}% вер.</div>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${status === "win" ? "bg-green-500/20 text-green-400" : status === "lose" ? "bg-red-500/20 text-red-400" : status === "refund" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/40"}`}>
          {status.toUpperCase()}
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-white/30" /> : <ChevronDown className="h-4 w-4 shrink-0 text-white/30" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          <div className="mt-3 flex items-end gap-3">
            <div className="flex-1">
              <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Статус</div>
              <Select value={status} onValueChange={saveStatus}>
                <SelectTrigger className="h-8 text-xs bg-black/30 border-white/10 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Ожидание</SelectItem>
                  <SelectItem value="win">Выигрыш</SelectItem>
                  <SelectItem value="lose">Проигрыш</SelectItem>
                  <SelectItem value="refund">Возврат</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="destructive" onClick={deletePred} disabled={deleting} className="h-8 text-xs gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> {deleting ? "..." : "Удалить"}
            </Button>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Обоснование</div>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{pred.reasoning}</p>
          </div>

          <ButtonManager type="author" predId={pred.id} adminId={adminId} />
        </div>
      )}
    </div>
  );
}

// ─── Ads Admin Tab ────────────────────────────────────────────────────────────

interface AdItem {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  mediaType: string | null;
  linkUrl: string;
  rewardCoins: number;
  durationSeconds: number;
  isActive: boolean;
  createdAt: string;
}

function AdsAdminTab({ adminId }: { adminId: string }) {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", imageUrl: "", mediaType: "image", linkUrl: "", rewardCoins: "5", durationSeconds: "15" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/admin/ads"), { headers: { "x-admin-id": adminId } });
      setAds(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [adminId]);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast({ title: "Только изображения и видео", variant: "destructive" });
      return;
    }

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setMediaPreview(objectUrl);
    setForm(f => ({ ...f, mediaType: isVideo ? "video" : "image" }));

    // Upload to object storage
    setUploading(true);
    setUploadProgress(0);
    try {
      // Step 1: get presigned URL
      const urlRes = await fetch(apiUrl("/storage/uploads/request-url"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Не удалось получить URL для загрузки");
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: upload directly to GCS with XHR for progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Ошибка загрузки")));
        xhr.onerror = () => reject(new Error("Ошибка сети"));
        xhr.open("PUT", uploadURL);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      setForm(f => ({ ...f, imageUrl: objectPath }));
      toast({ title: isVideo ? "Видео загружено ✓" : "Изображение загружено ✓" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
      setMediaPreview(null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function createAd() {
    if (!form.title || !form.linkUrl) { toast({ title: "Заполни название и ссылку", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/admin/ads"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-id": adminId },
        body: JSON.stringify({ ...form, rewardCoins: Number(form.rewardCoins), durationSeconds: Number(form.durationSeconds) }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Реклама добавлена" });
      setShowForm(false);
      setForm({ title: "", description: "", imageUrl: "", mediaType: "image", linkUrl: "", rewardCoins: "5", durationSeconds: "15" });
      setMediaPreview(null);
      fetchAds();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function toggleAd(id: number, isActive: boolean) {
    try {
      await fetch(apiUrl(`/admin/ads/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-id": adminId },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchAds();
    } catch { /* ignore */ }
  }

  async function deleteAd(id: number) {
    try {
      await fetch(apiUrl(`/admin/ads/${id}`), { method: "DELETE", headers: { "x-admin-id": adminId } });
      fetchAds();
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wide">Рекламные объявления</h2>
        <button onClick={() => setShowForm(o => !o)} className="text-[10px] text-white/30 hover:text-white/60 font-mono flex items-center gap-1">
          <Plus className="h-3 w-3" /> Добавить
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <div className="font-mono text-xs text-amber-400/60 uppercase tracking-widest mb-1">Новое объявление</div>
          <Input placeholder="Название (обязательно)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="h-9 text-sm bg-black/30 border-white/10 text-white placeholder:text-white/20" />
          <Input placeholder="Описание (необязательно)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="h-9 text-sm bg-black/30 border-white/10 text-white placeholder:text-white/20" />
          {/* Media upload */}
          <div>
            <Label className="text-white/40 text-[10px] font-mono uppercase">Медиа (фото или видео)</Label>
            <label className="mt-1 flex items-center gap-3 cursor-pointer rounded-lg border border-dashed border-white/10 px-3 py-2.5 hover:border-amber-500/30 transition-colors" style={{ background: "rgba(0,0,0,0.3)" }}>
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} disabled={uploading} />
              {uploading ? (
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-xs font-mono text-white/50">
                    <span>Загрузка...</span><span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : mediaPreview ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {form.mediaType === "video" ? (
                    <video src={mediaPreview} className="h-10 w-16 rounded object-cover shrink-0" muted />
                  ) : (
                    <img src={mediaPreview} className="h-10 w-16 rounded object-cover shrink-0" />
                  )}
                  <span className="text-xs text-white/50 font-mono truncate">{form.mediaType === "video" ? "Видео загружено ✓" : "Фото загружено ✓"}</span>
                </div>
              ) : (
                <span className="text-xs text-white/30 font-mono">Нажми чтобы выбрать фото или видео</span>
              )}
            </label>
          </div>
          <Input placeholder="Ссылка объявления (обязательно)" value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
            className="h-9 text-sm bg-black/30 border-white/10 text-white placeholder:text-white/20" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-white/40 text-[10px] font-mono uppercase">Монет за просмотр</Label>
              <Input type="number" value={form.rewardCoins} onChange={e => setForm(f => ({ ...f, rewardCoins: e.target.value }))} min="1" max="100"
                className="mt-1 h-9 text-sm bg-black/30 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/40 text-[10px] font-mono uppercase">Длительность (сек)</Label>
              <Input type="number" value={form.durationSeconds} onChange={e => setForm(f => ({ ...f, durationSeconds: e.target.value }))} min="5" max="120"
                className="mt-1 h-9 text-sm bg-black/30 border-white/10 text-white" />
            </div>
          </div>
          <Button onClick={createAd} disabled={saving} className="w-full h-9 font-mono text-sm"
            style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Сохранить
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-white/30 font-mono text-sm">Загрузка...</div>
      ) : ads.length === 0 ? (
        <div className="text-center py-16 text-white/20 font-mono text-sm flex flex-col items-center gap-3">
          <Megaphone className="h-10 w-10 opacity-20" />
          <span>Нет объявлений</span>
        </div>
      ) : (
        ads.map(ad => (
          <div key={ad.id} className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${ad.isActive ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-bold text-white truncate">{ad.title}</div>
                {ad.description && <div className="text-xs text-white/40 mt-0.5 line-clamp-1">{ad.description}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleAd(ad.id, ad.isActive)} className="text-white/40 hover:text-white/70 transition-colors">
                  {ad.isActive ? <ToggleRight className="h-5 w-5 text-amber-400" /> : <ToggleLeft className="h-5 w-5" />}
                </button>
                <button onClick={() => deleteAd(ad.id)} className="text-white/20 hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-white/40">
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${ad.isActive ? "bg-amber-500/10 text-amber-400" : "bg-white/5 text-white/30"}`}>
                {ad.isActive ? "Активна" : "Выключена"}
              </span>
              <span className="flex items-center gap-1"><Coins className="h-3 w-3 text-amber-400/60" />{ad.rewardCoins} монет</span>
              <span>{ad.durationSeconds}с</span>
            </div>
            <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-primary/60 hover:text-primary font-mono truncate">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{ad.linkUrl}</span>
            </a>
          </div>
        ))
      )}
    </div>
  );
}

// ─── End Ads Admin Tab ────────────────────────────────────────────────────────

const SUPER_ADMIN_ID = "8589717818";

type AdminEntry = { id: number; telegramId: string; addedBy: string | null; isSuperAdmin: boolean; createdAt: string };

export default function AdminPanel() {
  const [, navigate] = useLocation();
  const [adminId, setAdminId] = useState<string | null>(() => localStorage.getItem(ADMIN_STORAGE_KEY));
  const [inputId, setInputId] = useState("");
  const [checking, setChecking] = useState(false);
  const [tgLoginFailed, setTgLoginFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<"ai" | "author" | "stats" | "odds" | "apistat" | "access" | "ads" | "users">("ai");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminsList, setAdminsList] = useState<AdminEntry[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [newAdminId, setNewAdminId] = useState("");
  const [aiPreds, setAiPreds] = useState<AiPred[]>([]);
  const [authorPreds, setAuthorPreds] = useState<AuthorPred[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingAuthor, setLoadingAuthor] = useState(false);
  const [userStats, setUserStats] = useState<{
    total: number; notifyAi: number; notifyAuthor: number;
    notifyBoth: number; notifyNone: number;
    newToday: number; newWeek: number; newMonth: number;
    topCoins: { telegramId: number; firstName: string | null; username: string | null; coins: number }[];
  } | null>(null);
  const [usersList, setUsersList] = useState<{
    telegramId: number; firstName: string | null; username: string | null;
    coins: number; notificationsAi: boolean; notificationsAuthor: boolean; createdAt: string;
  }[]>([]);
  const [usersOffset, setUsersOffset] = useState(0);
  const [usersHasMore, setUsersHasMore] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const { toast } = useToast();

  // Auto-detect Telegram user ID on mount
  useEffect(() => {
    if (adminId) return;
    try {
      const tg = (window as any).Telegram?.WebApp;
      const tgId = tg?.initDataUnsafe?.user?.id;
      if (tgId) {
        const idStr = String(tgId);
        setInputId(idStr);
        // Auto-login attempt via admins/check endpoint
        (async () => {
          setChecking(true);
          try {
            const res = await fetch(apiUrl(`/admins/check?id=${encodeURIComponent(idStr)}`));
            if (res.ok) {
              const data = await res.json();
              if (data.isAdmin) {
                localStorage.setItem(ADMIN_STORAGE_KEY, idStr);
                setAdminId(idStr);
                setChecking(false);
                return;
              }
            }
          } catch { /* ignore */ }
          setTgLoginFailed(true);
          setChecking(false);
        })();
      }
    } catch { /* ignore */ }
  }, []);

  const login = async () => {
    if (!inputId.trim()) return;
    setChecking(true);
    try {
      const res = await fetch(apiUrl(`/admins/check?id=${encodeURIComponent(inputId.trim())}`));
      if (res.ok) {
        const data = await res.json();
        if (data.isAdmin) {
          localStorage.setItem(ADMIN_STORAGE_KEY, inputId.trim());
          setAdminId(inputId.trim());
          setChecking(false);
          return;
        }
      }
      toast({ title: "Неверный ID или нет доступа", variant: "destructive" });
    } catch {
      toast({ title: "Ошибка соединения", variant: "destructive" });
    }
    setChecking(false);
  };

  const logout = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setAdminId(null);
    setInputId("");
  };

  const fetchAi = useCallback(async () => {
    if (!adminId) return;
    setLoadingAi(true);
    try {
      const data = await apiFetch("/admin/ai-predictions", {}, adminId);
      setAiPreds(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoadingAi(false);
  }, [adminId]);

  const fetchAuthor = useCallback(async () => {
    if (!adminId) return;
    setLoadingAuthor(true);
    try {
      const data = await apiFetch("/admin/author-predictions-all", {}, adminId);
      setAuthorPreds(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoadingAuthor(false);
  }, [adminId]);

  const fetchUserStats = useCallback(async () => {
    if (!adminId) return;
    try {
      const data = await apiFetch("/admin/users/stats", {}, adminId);
      setUserStats(data);
    } catch { /* ignore */ }
  }, [adminId]);

  const fetchUsersList = useCallback(async (reset = false) => {
    if (!adminId) return;
    setUsersLoading(true);
    const offset = reset ? 0 : usersOffset;
    try {
      const data = await apiFetch(`/admin/users/list?limit=30&offset=${offset}`, {}, adminId);
      const arr = Array.isArray(data) ? data : [];
      setUsersList(prev => reset ? arr : [...prev, ...arr]);
      setUsersOffset(offset + arr.length);
      setUsersHasMore(arr.length === 30);
    } catch { /* ignore */ }
    setUsersLoading(false);
  }, [adminId, usersOffset]);

  const fetchAdmins = useCallback(async () => {
    if (!adminId) return;
    setLoadingAdmins(true);
    try {
      const data = await apiFetch("/admins", {}, adminId);
      setAdminsList(data ?? []);
    } catch { /* ignore */ }
    setLoadingAdmins(false);
  }, [adminId]);

  const addAdmin = async () => {
    if (!newAdminId.trim() || !adminId) return;
    try {
      await apiFetch("/admins", {
        method: "POST",
        body: JSON.stringify({ telegramId: newAdminId.trim() }),
      }, adminId);
      setNewAdminId("");
      toast({ title: "Администратор добавлен" });
      fetchAdmins();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const removeAdmin = async (telegramId: string) => {
    if (!adminId) return;
    try {
      await apiFetch(`/admins/${telegramId}`, { method: "DELETE" }, adminId);
      toast({ title: "Администратор удалён" });
      setAdminsList(prev => prev.filter(a => a.telegramId !== telegramId));
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (adminId) {
      fetchAi();
      fetchAuthor();
      fetchUserStats();
      // Check if current user is super admin
      setIsSuperAdmin(adminId === SUPER_ADMIN_ID);
    }
  }, [adminId, fetchAi, fetchAuthor, fetchUserStats]);

  if (!adminId) {
    const tgDetected = !!(window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const showManualInput = !tgDetected || tgLoginFailed;
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <button
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-mono">Назад</span>
        </button>
        <div className="w-full max-w-sm mx-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-mono text-xl font-bold text-white">ADMIN PANEL</h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>MatchAi1 · Панель управления</p>
          </div>
          <div className="rounded-2xl p-6 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {tgDetected && checking && (
              <div className="text-center py-2">
                <p className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                  ⏳ Проверка Telegram ID...
                </p>
              </div>
            )}
            {showManualInput && !checking && (
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>Ваш Telegram ID</Label>
                <Input
                  type="password"
                  placeholder="Введите ваш ID..."
                  value={inputId}
                  onChange={e => setInputId(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && login()}
                  className="bg-black/40 border-white/10 text-white placeholder:text-white/20"
                />
                {tgLoginFailed && (
                  <p className="text-[11px]" style={{ color: "rgba(245,158,11,0.6)" }}>
                    Автоматический вход не удался — введите ID вручную
                  </p>
                )}
              </div>
            )}
            {showManualInput && !checking && (
              <Button onClick={login} disabled={checking || !inputId} className="w-full gap-2">
                <ShieldCheck className="h-4 w-4" />
                {checking ? "Проверка..." : "Войти"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const aiWins = aiPreds.filter(p => p.status === "win").length;
  const aiLoses = aiPreds.filter(p => p.status === "lose").length;
  const authorWins = authorPreds.filter(p => p.status === "win").length;
  const authorLoses = authorPreds.filter(p => p.status === "lose").length;
  const aiTotal = aiWins + aiLoses;
  const authorTotal = authorWins + authorLoses;

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 h-14 border-b border-white/10" style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(8px)" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-mono">Назад</span>
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-mono text-sm font-bold text-primary">ADMIN</span>
            <span className="font-mono text-sm text-white/40 hidden sm:inline">· MatchAi1</span>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
          <LogOut className="h-3.5 w-3.5" /> Выйти
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: "ai", icon: BrainCircuit, label: "ИИ" },
            { key: "author", icon: UserPen, label: "Автор" },
            { key: "stats", icon: BarChart3, label: "Стат." },
            { key: "users", icon: Users, label: "Юзеры" },
            { key: "odds", icon: TrendingUp, label: "КФ" },
            { key: "apistat", icon: Database, label: "База" },
            { key: "ads", icon: Megaphone, label: "Реклама" },
            ...(isSuperAdmin ? [{ key: "access", icon: ShieldCheck, label: "Доступ" }] : []),
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any);
                if (tab.key === "access") fetchAdmins();
                if (tab.key === "users") { fetchUserStats(); fetchUsersList(true); }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-medium transition-colors ${activeTab === tab.key ? "bg-primary text-black" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "ai" && (
          <div className="space-y-3">

            {/* Manual generate form */}
            <ManualAiGenerateForm adminId={adminId!} onGenerated={fetchAi} />

            {/* Global buttons for all AI predictions */}
            <GlobalAiButtonManager adminId={adminId!} />

            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wide">ИИ Прогнозы</h2>
              <button onClick={fetchAi} className="text-[10px] text-white/30 hover:text-white/60 font-mono">↻ Обновить</button>
            </div>
            {loadingAi ? (
              <div className="text-center py-12 text-white/30 font-mono text-sm">Загрузка...</div>
            ) : aiPreds.length === 0 ? (
              <div className="text-center py-12 text-white/30 font-mono text-sm">Нет прогнозов · нажми «Сгенерировать» выше или перейди во вкладку «КФ»</div>
            ) : (
              aiPreds.map(pred => <AiCard key={pred.id} pred={pred} adminId={adminId} onStatusChange={fetchAi} />)
            )}
          </div>
        )}

        {activeTab === "author" && (
          <div className="space-y-3">
            {/* Global buttons for all Author predictions */}
            <GlobalAuthorButtonManager adminId={adminId!} />

            <AddAuthorForm adminId={adminId!} onCreated={fetchAuthor} />

            <div className="flex items-center justify-between">
              <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wide">Авторские прогнозы</h2>
              <button onClick={fetchAuthor} className="text-[10px] text-white/30 hover:text-white/60 font-mono">↻ Обновить</button>
            </div>
            {loadingAuthor ? (
              <div className="text-center py-12 text-white/30 font-mono text-sm">Загрузка...</div>
            ) : authorPreds.length === 0 ? (
              <div className="text-center py-12 text-white/30 font-mono text-sm">Нет прогнозов</div>
            ) : (
              authorPreds.map(pred => (
                <AuthorCard
                  key={pred.id}
                  pred={pred}
                  adminId={adminId!}
                  onDelete={() => setAuthorPreds(prev => prev.filter(p => p.id !== pred.id))}
                  onStatusChange={fetchAuthor}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-4">
            <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wide mb-4">Статистика</h2>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "ИИ Прогнозы", wins: aiWins, loses: aiLoses, total: aiTotal, pending: aiPreds.filter(p => p.status === "pending").length, color: "#22c55e" },
                { label: "Авторские", wins: authorWins, loses: authorLoses, total: authorTotal, pending: authorPreds.filter(p => p.status === "pending").length, color: "#f59e0b" },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>{stat.label}</div>
                  <div className="font-mono text-3xl font-black" style={{ color: stat.color }}>
                    {stat.total > 0 ? `${Math.round((stat.wins / stat.total) * 100)}%` : "—"}
                  </div>
                  <div className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>Победы</div>
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    <div className="text-center">
                      <div className="text-sm font-bold text-green-400">{stat.wins}</div>
                      <div className="text-[9px] text-white/30">WIN</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-red-400">{stat.loses}</div>
                      <div className="text-[9px] text-white/30">LOSE</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-white/50">{stat.pending}</div>
                      <div className="text-[9px] text-white/30">WAIT</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>Всего прогнозов</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-mono text-2xl font-black text-white">{aiPreds.length}</div>
                  <div className="text-[10px] text-white/30 font-mono">ИИ прогнозов</div>
                </div>
                <div>
                  <div className="font-mono text-2xl font-black text-white">{authorPreds.length}</div>
                  <div className="text-[10px] text-white/30 font-mono">Авторских</div>
                </div>
              </div>
            </div>

            {/* ── Users block ── */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Пользователи</div>
                <button
                  onClick={fetchUserStats}
                  className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="h-2.5 w-2.5" /> обновить
                </button>
              </div>
              {userStats === null ? (
                <div className="text-xs text-white/20 font-mono">загрузка...</div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="font-mono text-2xl font-black text-white">{userStats.total}</div>
                    <div className="text-[10px] text-white/30 font-mono mt-0.5">всего</div>
                  </div>
                  <div className="rounded-lg p-3 text-center" style={{ background: "rgba(34,197,94,0.08)" }}>
                    <div className="font-mono text-2xl font-black text-green-400">{userStats.notifyAi}</div>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(34,197,94,0.5)" }}>ИИ уведом.</div>
                  </div>
                  <div className="rounded-lg p-3 text-center" style={{ background: "rgba(245,158,11,0.08)" }}>
                    <div className="font-mono text-2xl font-black text-amber-400">{userStats.notifyAuthor}</div>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(245,158,11,0.5)" }}>Авт. уведом.</div>
                  </div>
                </div>
              )}
              <div className="text-[10px] font-mono pt-1" style={{ color: "rgba(255,255,255,0.18)" }}>
                Пользователи, запустившие бота хотя бы раз
              </div>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wide">Пользователи</h2>
              <button
                onClick={() => { fetchUserStats(); fetchUsersList(true); }}
                className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
              >
                <RefreshCw className="h-2.5 w-2.5" /> обновить
              </button>
            </div>

            {/* ── Activity row ── */}
            {userStats && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "всего", value: userStats.total, color: "text-white" },
                    { label: "сегодня", value: userStats.newToday, color: "text-cyan-400" },
                    { label: "за 7 дней", value: userStats.newWeek, color: "text-blue-400" },
                    { label: "за 30 дней", value: userStats.newMonth, color: "text-indigo-400" },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className={`font-mono text-xl font-black ${s.color}`}>{s.value}</div>
                      <div className="text-[9px] text-white/30 font-mono mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* ── Subscription breakdown ── */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Подписки на уведомления</div>
                  {[
                    { label: "ИИ прогнозы", value: userStats.notifyAi, color: "#22c55e", icon: Bell },
                    { label: "Авторские", value: userStats.notifyAuthor, color: "#f59e0b", icon: Bell },
                    { label: "Оба типа", value: userStats.notifyBoth, color: "#60a5fa", icon: Bell },
                    { label: "Отписаны всё", value: userStats.notifyNone, color: "rgba(255,255,255,0.3)", icon: BellOff },
                  ].map(row => {
                    const pct = userStats.total > 0 ? Math.round((row.value / userStats.total) * 100) : 0;
                    return (
                      <div key={row.label} className="flex items-center gap-3">
                        <row.icon className="h-3 w-3 flex-shrink-0" style={{ color: row.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-mono text-white/60">{row.label}</span>
                            <span className="text-[11px] font-mono font-bold" style={{ color: row.color }}>{row.value} <span className="text-white/30 font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                            <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: row.color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Top by coins ── */}
                {userStats.topCoins.length > 0 && (
                  <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="h-3.5 w-3.5 text-amber-400" />
                      <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Топ по монетам</div>
                    </div>
                    {userStats.topCoins.map((u, i) => (
                      <div key={u.telegramId} className="flex items-center gap-3 py-1">
                        <div className={`font-mono text-xs font-bold w-4 text-center ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-white/30"}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-mono text-white truncate">
                            {u.firstName ?? "—"}{u.username ? <span className="text-white/40"> @{u.username}</span> : null}
                          </div>
                          <div className="text-[10px] text-white/30 font-mono">{u.telegramId}</div>
                        </div>
                        <div className="flex items-center gap-1 font-mono text-sm font-bold text-amber-400">
                          <Coins className="h-3 w-3" />{u.coins}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── User list ── */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-3 font-mono text-xs uppercase tracking-widest" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                Последние пользователи
              </div>
              {usersList.length === 0 && !usersLoading && (
                <div className="px-4 py-6 text-center text-xs text-white/20 font-mono">Нет данных</div>
              )}
              {usersList.map(u => (
                <div key={u.telegramId} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-white truncate">{u.firstName ?? "—"}</span>
                      {u.username && <span className="text-xs text-white/30 font-mono">@{u.username}</span>}
                    </div>
                    <div className="text-[10px] text-white/20 font-mono">{u.telegramId} · {new Date(u.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {u.notificationsAi ? <Bell className="h-3 w-3 text-green-400" /> : <BellOff className="h-3 w-3 text-white/15" />}
                    {u.notificationsAuthor ? <Bell className="h-3 w-3 text-amber-400" /> : <BellOff className="h-3 w-3 text-white/15" />}
                    {u.coins > 0 && (
                      <span className="flex items-center gap-0.5 font-mono text-xs text-amber-400">
                        <Coins className="h-2.5 w-2.5" />{u.coins}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {usersLoading && (
                <div className="px-4 py-3 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-white/30 animate-spin" />
                </div>
              )}
              {usersHasMore && !usersLoading && usersList.length > 0 && (
                <button
                  onClick={() => fetchUsersList()}
                  className="w-full px-4 py-3 flex items-center justify-center gap-1.5 text-xs font-mono text-white/30 hover:text-white/60 transition-colors"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <ChevronRight className="h-3 w-3" /> Загрузить ещё
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "odds" && (
          <OddsTab adminId={adminId!} onAiGenerated={fetchAi} />
        )}

        {activeTab === "apistat" && (
          <StatsApiTab adminId={adminId!} />
        )}

        {activeTab === "ads" && (
          <AdsAdminTab adminId={adminId!} />
        )}

        {activeTab === "access" && isSuperAdmin && (
          <div className="space-y-4">
            <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wide mb-4">Управление доступом</h2>

            {/* Add new admin */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Добавить администратора</div>
              <div className="flex gap-2">
                <Input
                  placeholder="Telegram ID нового администратора"
                  value={newAdminId}
                  onChange={e => setNewAdminId(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addAdmin()}
                  className="flex-1 h-9 text-sm bg-black/30 border-white/10 text-white placeholder:text-white/20"
                />
                <Button size="sm" onClick={addAdmin} disabled={!newAdminId.trim()} className="h-9 gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Добавить
                </Button>
              </div>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                Введите числовой Telegram ID пользователя. Найти ID можно через бота @userinfobot
              </p>
            </div>

            {/* Admins list */}
            <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Список администраторов</div>
                <button onClick={fetchAdmins} className="text-[10px] text-white/30 hover:text-white/60 font-mono">↻</button>
              </div>
              {loadingAdmins ? (
                <div className="text-center py-8 text-white/30 font-mono text-xs">Загрузка...</div>
              ) : adminsList.length === 0 ? (
                <div className="text-center py-8 text-white/30 font-mono text-xs">Нет администраторов</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {adminsList.map(a => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-white">{a.telegramId}</span>
                          {a.isSuperAdmin && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">SUPER</span>
                          )}
                        </div>
                        {a.addedBy && (
                          <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Добавлен: {a.addedBy}</div>
                        )}
                      </div>
                      {!a.isSuperAdmin && (
                        <button
                          onClick={() => removeAdmin(a.telegramId)}
                          className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
