export function Ticket() {
  const card = {
    status: "win" as const,
    league: "СЕРИЯ А",
    date: "8 апр, 20:45",
    homeTeam: "Ювентус",
    awayTeam: "Милан",
    prediction: "Победа хозяев",
    odds: "1.87",
    confidence: 75,
    scorePredict: "2:1",
    scoreChance: 28,
    analysis: "Ювентус без поражений дома 9 матчей подряд. Милан потерял 3 ключевых игрока."
  };

  const statusMap = {
    win:     { label: "ВЫИГРЫШ",   color: "#34d399", bg: "bg-emerald-500", light: "bg-emerald-500/10", border: "border-emerald-500/30" },
    lose:    { label: "ПРОИГРЫШ",  color: "#f87171", bg: "bg-red-500",     light: "bg-red-500/10",     border: "border-red-500/30"     },
    refund:  { label: "ВОЗВРАТ",   color: "#a1a1aa", bg: "bg-zinc-500",    light: "bg-zinc-500/10",    border: "border-zinc-500/30"    },
    pending: { label: "ОЖИДАЕТСЯ", color: "#38bdf8", bg: "bg-sky-500",     light: "bg-sky-500/10",     border: "border-sky-500/30"     },
  };

  const s = statusMap[card.status];

  return (
    <div className="min-h-screen bg-[#0e0e14] flex items-center justify-center p-6">
      <div className="w-[380px]">

        {/* Ticket */}
        <div className="bg-[#16161e] rounded-2xl overflow-hidden shadow-2xl border border-white/[0.07]">

          {/* Top strip */}
          <div className="flex items-stretch">
            {/* Left colored accent */}
            <div className="w-1.5 shrink-0" style={{ backgroundColor: s.color }} />

            {/* Content */}
            <div className="flex-1 p-5">
              {/* Row 1: Status + League */}
              <div className="flex items-center justify-between mb-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${s.light} ${s.border} border`} style={{ color: s.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
                <div className="text-right">
                  <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest">{card.league}</div>
                  <div className="font-mono text-[10px] text-white/25">{card.date}</div>
                </div>
              </div>

              {/* Teams row */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1">
                  <div className="font-black text-xl text-white">{card.homeTeam}</div>
                  <div className="font-mono text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Хозяева</div>
                </div>
                <div className="font-mono text-sm text-white/20 font-bold">vs</div>
                <div className="flex-1 text-right">
                  <div className="font-black text-xl text-white">{card.awayTeam}</div>
                  <div className="font-mono text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Гости</div>
                </div>
              </div>

              {/* Perforated divider */}
              <div className="relative my-4">
                <div className="border-t border-dashed border-white/10" />
                <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#0e0e14]" />
                <div className="absolute -right-5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#0e0e14]" />
              </div>

              {/* Prediction + Odds + Confidence in 3 cols */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="font-mono text-[9px] text-white/30 uppercase tracking-wider mb-1.5">Прогноз</div>
                  <div className="font-black text-sm text-white leading-tight">{card.prediction}</div>
                </div>
                <div className="border-x border-white/[0.06] px-4">
                  <div className="font-mono text-[9px] text-white/30 uppercase tracking-wider mb-1.5">Коэффициент</div>
                  <div className="font-mono font-black text-2xl" style={{ color: s.color }}>{card.odds}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[9px] text-white/30 uppercase tracking-wider mb-1.5">ИИ</div>
                  <div className="font-mono font-black text-2xl text-white">{card.confidence}%</div>
                </div>
              </div>

              {/* Perforated divider */}
              <div className="relative my-4">
                <div className="border-t border-dashed border-white/10" />
                <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#0e0e14]" />
                <div className="absolute -right-5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#0e0e14]" />
              </div>

              {/* Exact score */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-[9px] text-white/30 uppercase tracking-wider mb-1">Точный счёт</div>
                  <div className="font-mono font-black text-3xl text-white tracking-[0.25em]">{card.scorePredict}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[9px] text-white/30 uppercase tracking-wider mb-1">Вероятность</div>
                  <div className="font-mono font-black text-3xl" style={{ color: s.color }}>{card.scoreChance}%</div>
                </div>
              </div>

              {/* Analysis */}
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-[11px] text-white/25 leading-relaxed">{card.analysis}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ticket stub shadow */}
        <div className="h-2 mx-4 rounded-b-xl bg-white/[0.02] border-x border-b border-white/[0.04]" />
        <div className="h-1.5 mx-7 rounded-b-xl bg-white/[0.01] border-x border-b border-white/[0.03]" />
      </div>
    </div>
  );
}
