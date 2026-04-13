export function Glow() {
  const card = {
    status: "pending" as const,
    league: "ЛИГА ЧЕМПИОНОВ",
    date: "10 апр, 21:00",
    homeTeam: "Бавария",
    awayTeam: "ПСЖ",
    prediction: "Обе забьют",
    odds: "1.72",
    confidence: 81,
    scorePredict: "2:2",
    scoreChance: 31,
    analysis: "Обе команды забивали в последних 7 встречах. Ожидается открытый матч."
  };

  const statusMap = {
    win:     { label: "ВЫИГРЫШ",   glow: "0 0 30px rgba(52,211,153,0.25)",   color: "#34d399", ring: "#34d399" },
    lose:    { label: "ПРОИГРЫШ",  glow: "0 0 30px rgba(248,113,113,0.25)",  color: "#f87171", ring: "#f87171" },
    refund:  { label: "ВОЗВРАТ",   glow: "0 0 30px rgba(161,161,170,0.2)",   color: "#a1a1aa", ring: "#a1a1aa" },
    pending: { label: "ОЖИДАЕТСЯ", glow: "0 0 30px rgba(56,189,248,0.22)",   color: "#38bdf8", ring: "#38bdf8" },
  };

  const s = statusMap[card.status];
  const confColor = card.confidence >= 70 ? "#34d399" : card.confidence >= 55 ? "#facc15" : "#f87171";
  const r = 26, circ = 2 * Math.PI * r;
  const dash = (card.confidence / 100) * circ;

  const scoreGlow = card.scoreChance >= 30 ? "#34d399" : card.scoreChance >= 20 ? "#facc15" : "#f87171";

  return (
    <div className="min-h-screen bg-[#07070d] flex items-center justify-center p-6">
      <div className="w-[380px]">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(145deg, #121218 0%, #0d0d14 100%)", boxShadow: `${s.glow}, 0 25px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)` }}
        >
          {/* Corner glow top-left */}
          <div className="absolute top-0 left-0 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ background: s.color }} />

          {/* Content */}
          <div className="relative z-10">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: s.color }}>{s.label}</span>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: s.color, opacity: 0.6 }}>{card.league}</div>
                <div className="font-mono text-[10px] text-white/20 mt-0.5">{card.date}</div>
              </div>
            </div>

            {/* Teams */}
            <div className="px-5 pb-5 border-b border-white/[0.05]">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <div className="font-black text-[22px] text-white leading-tight tracking-tight">{card.homeTeam}</div>
                  <div className="font-mono text-[9px] text-white/25 uppercase tracking-widest mt-0.5">Хозяева</div>
                </div>
                <div className="font-mono text-sm text-white/15 pb-1 shrink-0">vs</div>
                <div className="flex-1 text-right">
                  <div className="font-black text-[22px] text-white leading-tight tracking-tight">{card.awayTeam}</div>
                  <div className="font-mono text-[9px] text-white/25 uppercase tracking-widest mt-0.5">Гости</div>
                </div>
              </div>
            </div>

            {/* Main prediction block */}
            <div className="px-5 py-4 flex items-center gap-5">
              <div className="flex-1">
                <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-2">Прогноз ИИ</div>
                <div className="font-black text-[20px] text-white leading-tight mb-3">{card.prediction}</div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                  <span className="font-mono text-[9px] text-white/30 uppercase">Коэф.</span>
                  <span className="font-mono font-black text-xl" style={{ color: s.color }}>{card.odds}</span>
                </div>
              </div>

              {/* Confidence ring with glow */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative" style={{ width: 64, height: 64, filter: `drop-shadow(0 0 8px ${confColor}60)` }}>
                  <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                    <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4.5" />
                    <circle cx="32" cy="32" r={r} fill="none" stroke={confColor} strokeWidth="4.5"
                      strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono font-black text-[15px]" style={{ color: confColor }}>{card.confidence}%</span>
                  </div>
                </div>
                <span className="font-mono text-[8px] text-white/20 uppercase tracking-widest">ИИ</span>
              </div>
            </div>

            {/* Exact score — glowing box */}
            <div className="mx-5 mb-5 rounded-xl px-4 py-3.5 flex items-center justify-between border border-white/[0.06]"
              style={{ background: "rgba(255,255,255,0.03)", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)` }}>
              <div>
                <div className="font-mono text-[9px] text-white/25 uppercase tracking-widest mb-1.5">Точный счёт</div>
                <div className="font-mono font-black text-[28px] text-white tracking-[0.2em] leading-none"
                  style={{ textShadow: `0 0 20px rgba(255,255,255,0.15)` }}>
                  {card.scorePredict}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[9px] text-white/25 uppercase tracking-widest mb-1.5">Вероятность</div>
                <div className="font-mono font-black text-[28px] leading-none"
                  style={{ color: scoreGlow, textShadow: `0 0 20px ${scoreGlow}60` }}>
                  {card.scoreChance}%
                </div>
              </div>
            </div>

            {/* Analysis */}
            <div className="px-5 pb-5 border-t border-white/[0.04] pt-3.5">
              <p className="text-[11px] text-white/20 leading-relaxed">{card.analysis}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
