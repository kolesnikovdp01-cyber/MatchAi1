export function Scorecard() {
  const card = {
    status: "pending" as const,
    league: "ПРЕМЬЕР-ЛИГА",
    date: "9 апр, 16:00",
    homeTeam: "Арсенал",
    awayTeam: "Челси",
    prediction: "Победа хозяев",
    odds: "1.95",
    confidence: 69,
    scorePredict: "1:0",
    scoreChance: 26,
    analysis: "Арсенал выиграл 12 из 14 домашних матчей. Челси нестабилен на выезде."
  };

  const statusMap = {
    win:     { label: "ВЫИГРЫШ",   bar: "from-emerald-500/80 to-emerald-600/40",  accent: "#34d399", dot: "bg-emerald-400" },
    lose:    { label: "ПРОИГРЫШ",  bar: "from-red-500/80 to-red-600/40",          accent: "#f87171", dot: "bg-red-400"     },
    refund:  { label: "ВОЗВРАТ",   bar: "from-zinc-500/80 to-zinc-600/40",        accent: "#a1a1aa", dot: "bg-zinc-400"    },
    pending: { label: "ОЖИДАЕТСЯ", bar: "from-sky-500/80 to-sky-600/40",          accent: "#38bdf8", dot: "bg-sky-400"     },
  };

  const s = statusMap[card.status];

  const r = 28, circ = 2 * Math.PI * r;
  const dash = (card.confidence / 100) * circ;
  const color = card.confidence >= 70 ? "#34d399" : card.confidence >= 55 ? "#facc15" : "#f87171";

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <div className="w-[380px] bg-[#111118] rounded-xl overflow-hidden shadow-2xl border border-white/5">

        {/* Status gradient bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${s.bar}`} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${s.dot} shadow-lg`} style={{ boxShadow: `0 0 6px ${s.accent}` }} />
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: s.accent }}>{s.label}</span>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest">{card.league}</div>
            <div className="font-mono text-[10px] text-white/30">{card.date}</div>
          </div>
        </div>

        {/* Teams — scorecard style */}
        <div className="px-5 py-5 border-t border-b border-white/[0.06]">
          <div className="flex items-center">
            {/* Home */}
            <div className="flex-1">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-2">
                <span className="text-xl">🏟</span>
              </div>
              <div className="font-black text-lg text-white leading-tight">{card.homeTeam}</div>
              <div className="font-mono text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Хозяева</div>
            </div>

            {/* VS center */}
            <div className="px-4 text-center">
              <div className="font-mono text-[10px] text-white/20 uppercase tracking-widest mb-1">vs</div>
              <div className="w-px h-8 bg-white/10 mx-auto" />
            </div>

            {/* Away */}
            <div className="flex-1 text-right">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-2 ml-auto">
                <span className="text-xl">⚽</span>
              </div>
              <div className="font-black text-lg text-white leading-tight">{card.awayTeam}</div>
              <div className="font-mono text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Гости</div>
            </div>
          </div>
        </div>

        {/* AI Prediction row */}
        <div className="px-5 py-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-1.5">Прогноз ИИ</div>
            <div className="font-black text-xl text-white">{card.prediction}</div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="font-mono text-[9px] text-white/30 uppercase">Коэф.</span>
              <span className="font-mono font-bold text-base" style={{ color: s.accent }}>{card.odds}</span>
            </div>
          </div>

          {/* Ring */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="relative" style={{ width: 68, height: 68 }}>
              <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
                <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="5"
                  strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono font-black text-[16px] leading-none" style={{ color }}>{card.confidence}%</span>
              </div>
            </div>
            <span className="font-mono text-[8px] text-white/25 uppercase tracking-widest">Точность</span>
          </div>
        </div>

        {/* Exact score */}
        <div className="mx-5 mb-4 rounded-lg bg-white/[0.04] border border-white/[0.08] px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-1">Точный счёт</div>
            <div className="font-mono font-black text-2xl text-white tracking-[0.2em]">{card.scorePredict}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-1">Вероятность</div>
            <div className="font-mono font-bold text-xl" style={{ color }}>{card.scoreChance}%</div>
          </div>
        </div>

        {/* Analysis */}
        <div className="px-5 pb-5">
          <p className="text-[11px] text-white/25 leading-relaxed">{card.analysis}</p>
        </div>
      </div>
    </div>
  );
}
