import OpenAI from "openai";
import { db, aiPredictionsTable } from "@workspace/db";
import { fetchStatsForMatch } from "./stats-fetcher";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

const SYSTEM_PROMPT = `Ты — элитный футбольный аналитик. Твоя задача — давать конкретные прогнозы на матчи.

═══ ГЛАВНОЕ ПРАВИЛО ═══
Ты ВСЕГДА должен дать прогноз. Пропускать разрешено ТОЛЬКО если матч уже начался (идёт в прямом эфире).
Если статистика из API неполная — используй свои глубокие знания о командах, их форме и стиле игры.
Для топ-команд (Барселона, Реал, ПСЖ, Ливерпуль, Манчестер Сити и т.д.) ты знаешь достаточно.

═══ ЗАПРЕТ: LIVE-МАТЧИ ═══
Если матч уже начался — верни {"skip": true, "reason": "Матч уже идёт"}.
Все остальные случаи — ОБЯЗАТЕЛЬНО дай прогноз.

═══ АЛГОРИТМ АНАЛИЗА ═══
1. Изучи H2H если есть: ищи паттерн голов в последних встречах
2. Изучи форму команд: последние 5–8 матчей
3. Посмотри статистику сезона: голы за/против, угловые, карточки
4. Коэффициенты букмекеров (если есть): низкий КФ (1.40–1.65) = высокая уверенность рынка
5. Если данных API мало — используй свои знания о стиле игры этих команд
6. Выбери рынок где у тебя максимальная уверенность

═══ ЗАПРЕЩЁННЫЕ РЫНКИ ═══
❌ П1 / П2 / победа конкретной команды
❌ X / ничья / 1X / X2 / 1X2
❌ Азиатские форы и тоталы

═══ РАЗРЕШЁННЫЕ РЫНКИ ═══
▶ ГОЛЕВЫЕ ТОТАЛЫ:
• «ТМ 2.5» / «ТМ 1.5» — закрытая игра, мало голов
• «ТБ 2.5» / «ТБ 1.5» — атакующие команды, много голов

▶ ИНДИВИДУАЛЬНЫЕ ТОТАЛЫ:
• «ИТБ 1.5 (Команда)» — команда забивает 2+ в большинстве матчей
• «ИТМ 0.5 (Команда)» — команда редко забивает

▶ УГЛОВЫЕ:
• «ТБ угловых 9.5» / «ТМ угловых 8.5»

▶ КАРТОЧКИ:
• «ТБ карточек 3.5» / «ТМ карточек 2.5»

═══ ФОРМАТ ПОЛЕЙ ═══
confidence: 0.72–0.92 (честная оценка, не завышай)
scorePredict: реалистичный счёт совместимый с прогнозом:
  • ТМ 2.5 → голов ≤ 2: "1:0", "0:1", "1:1", "2:0"
  • ТМ 1.5 → голов ≤ 1: "1:0", "0:0", "0:1"
  • ТБ 2.5 → голов ≥ 3: "2:1", "1:2", "3:0", "3:1"
  • ТБ 1.5 → голов ≥ 2: "1:1", "2:0", "2:1"
odds: тоталы голов 1.45–1.80, угловые 1.50–1.85, карточки 1.55–1.90
analysis: 4–5 предложений с конкретными аргументами (форма, стиль, H2H, статистика)

═══ ФОРМАТ ОТВЕТА ═══
ТОЛЬКО валидный JSON без markdown.
Прогноз: {"prediction": "ТМ 2.5", "confidence": 0.81, "scorePredict": "1:0", "scoreProbability": 0.18, "analysis": "...", "odds": 1.65}
Только если матч уже начался: {"skip": true, "reason": "Матч уже идёт"}`;

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
  if (/оз\s*—?\s*да/.test(pred) && (h === 0 || a === 0)) return "1:1";
  if (/оз\s*—?\s*нет/.test(pred) && h > 0 && a > 0) return "1:0";
  return score;
}

export interface GenerateInput {
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: Date;
  fixtureId?: number;
  /** When to make this prediction visible to users. null = immediately. */
  publishAt: Date | null;
}

export type GenerateResult =
  | { saved: true; id: number; prediction: string; confidence: number }
  | { saved: false; skipped: true; reason: string }
  | { saved: false; error: string };

export async function generateAndSave(input: GenerateInput): Promise<GenerateResult> {
  const { homeTeam, awayTeam, league, matchDate, fixtureId, publishAt } = input;

  try {
    // 1. Fetch live stats from API-Football
    console.log(`[gen] Fetching stats: ${homeTeam} vs ${awayTeam}`);
    const stats = await fetchStatsForMatch(homeTeam, awayTeam, league, fixtureId);
    console.log(`[gen] Stats done (${stats.requestsUsed} API calls). Calling OpenAI...`);

    // 2. Build user message
    const dateStr = matchDate.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Kiev" });
    const timeStr = matchDate.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kiev" });
    const hasStats = stats.statsText && stats.statsText.length > 50;

    const userMsg = `═══ ДАННЫЕ МАТЧА ═══
Хозяева: ${homeTeam}
Гости:   ${awayTeam}
Лига:    ${league || "Неизвестна"}
Дата:    ${dateStr}
Время:   ${timeStr} (по Киеву)
════════════════════════════════

═══ СТАТИСТИКА ИЗ API-FOOTBALL ═══
${hasStats ? stats.statsText : "⚠️ Статистика API недоступна — используй свои знания об этих командах для анализа"}
════════════════════════════════

ВАЖНО: Дай прогноз обязательно. Если данных API мало — опирайся на свои знания об этих командах.
Дай прогноз ТОЛЬКО в JSON формате.`;

    // 3. Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.skip === true) {
      console.log(`[gen] Skipped: ${homeTeam} vs ${awayTeam} — ${parsed.reason}`);
      return { saved: false, skipped: true, reason: parsed.reason ?? "Матч уже начался" };
    }

    const prediction = parsed.prediction ?? "";
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
    const analysis = parsed.analysis ?? "";
    const odds = Math.min(10, Math.max(1.01, Number(parsed.odds) || 1.85));
    const scorePredict = sanitizeScore(prediction, parsed.scorePredict ?? "");

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

    console.log(`[gen] Saved id=${saved.id} | "${prediction}" | conf=${confidence} | publishAt=${publishAt?.toISOString() ?? "now"}`);
    return { saved: true, id: saved.id, prediction, confidence };

  } catch (err: any) {
    console.error(`[gen] Error for ${homeTeam} vs ${awayTeam}:`, err?.message);
    return { saved: false, error: err?.message ?? "Unknown error" };
  }
}
