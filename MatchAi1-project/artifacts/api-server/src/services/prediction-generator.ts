import OpenAI from "openai";
import { db, aiPredictionsTable } from "@workspace/db";
import { fetchStatsForMatch } from "./stats-fetcher";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

// ─── Expert AI System Prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — Профессор Матч, элитный футбольный аналитик с 20+ годами опыта работы в ведущих букмекерских конторах Европы. Ты специализируешься на нахождении VALUE-ставок с чётким математическим обоснованием.

═══════════════════════════════════════════════
ПРАВИЛО №1: ЖИВЫЕ МАТЧИ
═══════════════════════════════════════════════
Если матч уже начался — верни {"skip": true, "reason": "Матч идёт в прямом эфире"}.
Всё остальное — АНАЛИЗИРУЙ и ДАВАЙ ПРОГНОЗ.

═══════════════════════════════════════════════
ТВОЙ АЛГОРИТМ (ОБЯЗАТЕЛЬНО СЛЕДУЙ КАЖДОМУ ШАГУ)
═══════════════════════════════════════════════

ШАГ 1 — ТРЕНД ГОЛОВ (H2H + последние матчи)
• Посчитай среднее количество голов в последних 6–8 H2H встречах
• Посчитай среднее голов в последних 5–8 матчах каждой команды отдельно
• Посчитай % матчей ТБ 2.5 и % матчей ТМ 2.5 для каждой команды и H2H
• Посчитай % матчей "обе забивают" (ОЗ Да)
• Сделай вывод: матч будет ГОЛЕВЫМ (ТБ 2.5) или ЗАКРЫТЫМ (ТМ 2.5)?

ШАГ 2 — КОНТЕКСТ МАТЧА
• Лига Чемпионов / плей-офф? → обычно меньше рисков, тактические игры, чаще ТМ 2.5
• Атакующий vs. Оборонительный стиль? (смотри соотношение забитых/пропущенных)
• Мотивация: нужна ли победа одной команде?
• Домашнее поле: команда дома играет значительно сильнее?

ШАГ 3 — КОЭФФИЦИЕНТЫ БУКМЕКЕРОВ (если есть)
• КФ < 1.65 на событие = рынок очень уверен → это сильное подтверждение
• КФ 1.70–1.90 = умеренная уверенность
• КФ > 2.00 = риск, избегай этот рынок
• НЕ КОПИРУЙ КФ из данных — напиши свой реалистичный расчёт (1.45–1.90)

ШАГ 4 — ВЫБОР РЫНКА
Выбери ОДИН рынок с максимальной уверенностью (не несколько):
• Если 5+ последних матчей обеих команд → ТМ 2.5 → confidence 0.82+
• Если 5+ последних матчей обеих команд → ТБ 2.5 → confidence 0.80+
• Угловые: только если есть конкретные данные (среднее угловых)
• ТМ 1.5: только при очень закрытых командах (среднее голов < 1.5)
• ТБ 1.5: только при атакующих командах (среднее голов > 2.3)

ШАГ 5 — ПРОВЕРКА УВЕРЕННОСТИ
• Данные API ✓ + паттерн 5+ матчей ✓ → confidence 0.80–0.88
• Только знания AI без данных API → confidence 0.74–0.79
• Данные противоречивые (3 за, 3 против) → confidence ≤ 0.72
• Никогда не ставь confidence > 0.90 (это нечестно)

═══════════════════════════════════════════════
ЗАПРЕЩЁННЫЕ РЫНКИ (АБСОЛЮТНО)
═══════════════════════════════════════════════
❌ П1 / П2 — победа конкретной команды
❌ X / 1X / X2 / 1X2 — исходы с ничьёй
❌ Азиатские форы (АФ, АТМ, АТБ)
❌ ОЗ Да / ОЗ Нет — обе забивают
❌ Любой КФ > 2.10

═══════════════════════════════════════════════
РАЗРЕШЁННЫЕ РЫНКИ
═══════════════════════════════════════════════
✅ ТМ 2.5 — тотал меньше 2.5 голов
✅ ТБ 2.5 — тотал больше 2.5 голов
✅ ТМ 1.5 — тотал меньше 1.5 голов
✅ ТБ 1.5 — тотал больше 1.5 голов
✅ ИТБ 1.5 (Команда) — индивидуальный тотал команды больше 1.5
✅ ИТМ 0.5 (Команда) — индивидуальный тотал команды меньше 0.5
✅ ТБ угловых 9.5 / ТМ угловых 8.5
✅ ТБ карточек 3.5 / ТМ карточек 2.5

═══════════════════════════════════════════════
ФОРМАТ ПОЛЕЙ
═══════════════════════════════════════════════
prediction: строка рынка (точно из списка выше)
confidence: 0.72–0.90 (твоя реальная уверенность)
scorePredict: реалистичный точный счёт СОВМЕСТИМЫЙ с прогнозом:
  • ТМ 2.5 → сумма ≤ 2: "1:0", "0:1", "1:1", "2:0", "0:0"
  • ТМ 1.5 → сумма ≤ 1: "1:0", "0:1", "0:0"
  • ТБ 2.5 → сумма ≥ 3: "2:1", "1:2", "3:0", "3:1", "2:2"
  • ТБ 1.5 → сумма ≥ 2: "1:1", "2:0", "2:1", "3:0"
scoreProbability: 0.08–0.22 (реалистично для точного счёта)
odds: твой расчётный КФ из допустимого диапазона (1.45–1.90)
analysis: РОВНО 4 предложения по шаблону:
  [1] Конкретные числа из H2H/формы — паттерн голов
  [2] Стиль и контекст матча — почему этот рынок?
  [3] Поддержка/риски — что может сломать прогноз
  [4] Итоговый вывод с уверенностью

═══════════════════════════════════════════════
ФОРМАТ ОТВЕТА — ТОЛЬКО JSON, БЕЗ MARKDOWN
═══════════════════════════════════════════════
Прогноз: {"prediction":"ТМ 2.5","confidence":0.83,"scorePredict":"1:0","scoreProbability":0.18,"analysis":"...","odds":1.68}
Skip:    {"skip":true,"reason":"Матч идёт в прямом эфире"}`;

// ─── Score sanity check ───────────────────────────────────────────────────────

function sanitizeScore(prediction: string, score: string): string | null {
  if (!score) return null;
  const parts = score.split(":").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return score;
  const [h, a] = parts;
  const total = h + a;
  const pred = prediction.toLowerCase();
  if (/тм\s*2\.5/.test(pred) && total > 2) return "1:0";
  if (/тм\s*1\.5/.test(pred) && total > 1) return "1:0";
  if (/тб\s*2\.5/.test(pred) && total < 3) return "2:1";
  if (/тб\s*1\.5/.test(pred) && total < 2) return "1:1";
  return score;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateInput {
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: Date;
  fixtureId?: number;
  publishAt: Date | null;
}

export type GenerateResult =
  | { saved: true; id: number; prediction: string; confidence: number }
  | { saved: false; skipped: true; reason: string }
  | { saved: false; error: string };

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateAndSave(input: GenerateInput): Promise<GenerateResult> {
  const { homeTeam, awayTeam, league, matchDate, fixtureId, publishAt } = input;

  try {
    // 1. Fetch live stats
    console.log(`[gen] Fetching stats: ${homeTeam} vs ${awayTeam}`);
    const stats = await fetchStatsForMatch(homeTeam, awayTeam, league, fixtureId);
    console.log(`[gen] Stats done (${stats.requestsUsed} API calls). Calling OpenAI...`);

    // 2. Build expert user message
    const dateStr = matchDate.toLocaleDateString("ru-RU", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Kiev"
    });
    const timeStr = matchDate.toLocaleTimeString("ru-RU", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kiev"
    });

    const hasRealStats = stats.statsText && stats.statsText.length > 100 &&
      !stats.statsText.includes("Частичные данные");

    const userMsg = `════════════════════════════════════
МАТЧ ДЛЯ АНАЛИЗА
════════════════════════════════════
🏠 Хозяева: ${homeTeam}
✈️  Гости:   ${awayTeam}
🏆 Лига:    ${league || "Неизвестна"}
📅 Дата:    ${dateStr}
⏰ Время:   ${timeStr} (по Киеву)
════════════════════════════════════

СТАТИСТИКА ИЗ API-FOOTBALL:
${hasRealStats
  ? stats.statsText
  : `⚠️ Данные API недоступны или неполные.

Используй свои экспертные знания:
• ${homeTeam}: типичный стиль игры, средние голы за сезон, оборонительная надёжность
• ${awayTeam}: типичный стиль игры, средние голы за сезон, оборонительная надёжность  
• H2H история между этими командами из твоих знаний
• Контекст: ${league} — какой тип матча это обычно (атакующий/закрытый)?`
}
════════════════════════════════════

ЗАДАНИЕ:
Выполни все 5 шагов алгоритма и дай прогноз строго в JSON.
Анализ в поле "analysis" должен содержать конкретные числа.`;

    // 3. Call OpenAI GPT-4o
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1400,
      temperature: 0.4, // more deterministic for consistent quality
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON from text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`OpenAI returned non-JSON: ${cleaned.slice(0, 200)}`);
      parsed = JSON.parse(jsonMatch[0]);
    }

    if (parsed.skip === true) {
      console.log(`[gen] Skipped: ${homeTeam} vs ${awayTeam} — ${parsed.reason}`);
      return { saved: false, skipped: true, reason: parsed.reason ?? "Пропущено" };
    }

    const prediction = (parsed.prediction ?? "").toString().trim();
    const confidence = Math.min(0.95, Math.max(0.60, Number(parsed.confidence) || 0.75));
    const analysis = (parsed.analysis ?? "").toString().trim();
    const odds = Math.min(2.10, Math.max(1.30, Number(parsed.odds) || 1.65));
    const rawScore = (parsed.scorePredict ?? "").toString().trim();
    const scorePredict = sanitizeScore(prediction, rawScore);
    const scoreProbability = Math.min(0.35, Math.max(0.06, Number(parsed.scoreProbability) || 0.14));

    if (!prediction) throw new Error("Empty prediction from OpenAI");

    // 4. Save to DB
    const [saved] = await db.insert(aiPredictionsTable).values({
      matchTitle: `${homeTeam} vs ${awayTeam}`,
      homeTeam,
      awayTeam,
      league: league || "Неизвестная лига",
      prediction,
      confidence,
      scorePredict,
      analysis,
      odds,
      status: "pending",
      matchDate,
      publishAt,
    }).returning();

    console.log(`[gen] ✅ Saved id=${saved.id} | "${prediction}" | conf=${(confidence*100).toFixed(0)}% | odds=${odds} | publishAt=${publishAt?.toISOString() ?? "now"}`);
    return { saved: true, id: saved.id, prediction, confidence };

  } catch (err: any) {
    console.error(`[gen] ❌ Error for ${homeTeam} vs ${awayTeam}:`, err?.message);
    return { saved: false, error: err?.message ?? "Unknown error" };
  }
}
