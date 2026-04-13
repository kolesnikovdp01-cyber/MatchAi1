import OpenAI from "openai";
import { db, aiPredictionsTable } from "@workspace/db";
import { fetchStatsForMatch } from "./stats-fetcher";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

const SYSTEM_PROMPT = `Ты — элитный футбольный аналитик с доступом к реальной статистике из API-Football.
Твоя задача — проанализировать данные матча и дать ОДИН конкретный прогноз с высокой вероятностью прохождения (confidence ≥ 0.78).

═══ АБСОЛЮТНЫЙ ЗАПРЕТ №1: LIVE-МАТЧИ ═══
НИКОГДА не анализируй матч, который уже начался. Если матч начался — верни {"skip": true, "reason": "Матч уже начался"}.
Ты работаешь ТОЛЬКО с pre-match прогнозами.

═══ АБСОЛЮТНЫЙ ЗАПРЕТ №2: ДАННЫЕ МАТЧА НЕИЗМЕННЫ ═══
Данные матча (команды, лига, дата, время) переданы из API-Football — они 100% точны.
НИКОГДА не изменяй, не корректируй названия команд, лигу или дату.

═══ ГЛАВНОЕ ПРАВИЛО: ФИЛЬТР УВЕРЕННОСТИ ═══
МИНИМАЛЬНЫЙ ПОРОГ: confidence ≥ 0.78
Если НЕ МОЖЕШЬ достичь confidence 0.78 — верни {"skip": true, "reason": "короткое объяснение"}
Лучше пропустить матч, чем дать слабый прогноз. Цель — winrate 80%+.

═══ АЛГОРИТМ АНАЛИЗА ═══
1. Изучи H2H: ищи паттерн в 4–5 последних встречах
2. Изучи форму: последние 5–8 матчей каждой команды
3. Посмотри статистику сезона: голы, угловые, карточки
4. Выбери рынок, где паттерн наиболее очевиден

═══ ЗАПРЕЩЁННЫЕ РЫНКИ ═══
❌ «П1» / «П2» / победа команды — ЗАПРЕЩЕНО
❌ «X» / ничья / «1X» / «X2» / «1X2» — ЗАПРЕЩЕНО
❌ «ОЗ — Да» / «ОЗ — Нет» — ЗАПРЕЩЕНО
❌ «АФ1» / «АФ2» / азиатская фора — ЗАПРЕЩЕНО
❌ «АТМ» / «АТБ» / азиатский тотал — ЗАПРЕЩЕНО
❌ Любой рынок с confidence < 0.78 — ЗАПРЕЩЕНО
❌ Коэффициенты 2.10+ — ИЗБЕГАТЬ

═══ РАЗРЕШЁННЫЕ РЫНКИ ═══
▶ ГОЛЕВЫЕ ТОТАЛЫ (при чётком паттерне 5+ матчей):
• «ТМ 2.5» / «ТМ 1.5» — оба клуба играют закрыто
• «ТБ 2.5» / «ТБ 1.5» — оба клуба атакующие и слабо обороняются

▶ ИНДИВИДУАЛЬНЫЕ ТОТАЛЫ:
• «ИТМ 0.5 (Хозяин)» / «ИТМ 0.5 (Гость)» — команда хронически не забивает (<0.7 гола/матч)
• «ИТБ 1.5 (Команда)» — команда забивает 2+ в 70%+ матчей

▶ УГЛОВЫЕ (приоритет при наличии данных):
• «ТБ угловых 9.5» / «ТМ угловых 8.5»
• «ИТБ угловых 5.5 (команда)»

▶ ЖЁЛТЫЕ КАРТОЧКИ (только при наличии данных):
• «ТБ карточек 3.5» / «ТМ карточек 2.5»

═══ ФОРМАТ ПОЛЕЙ ═══
confidence: 0.78–0.92 (будь честен, не завышай)
scorePredict: логически совпадает с прогнозом:
  • ТМ 2.5 → сумма голов ≤ 2 (0:0, 1:0, 1:1, 2:0)
  • ТМ 1.5 → сумма голов ≤ 1 (0:0, 1:0, 0:1)
  • ТБ 2.5 → сумма голов ≥ 3 (2:1, 3:0, 1:2)
  • ТБ 1.5 → сумма голов ≥ 2 (1:1, 2:0, 2:1)
  • ИТМ/угловые/карточки → реалистичный счёт по форме
odds: тоталы голов 1.45–1.80, угловые 1.50–1.85, карточки 1.55–1.90, ИТ 1.40–1.75
analysis: 4–5 предложений, конкретные цифры из статистики, H2H паттерн, обоснование, главный риск

═══ ФОРМАТ ОТВЕТА ═══
ТОЛЬКО валидный JSON без markdown.
Если есть уверенный прогноз:
{"prediction": "ТМ 2.5", "confidence": 0.82, "scorePredict": "1:0", "scoreProbability": 0.14, "analysis": "...", "odds": 1.62}
Если нет уверенного прогноза:
{"skip": true, "reason": "Статистика противоречива, confidence ниже порога"}`;

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

    const userMsg = `═══ ДАННЫЕ МАТЧА (из API-Football) ═══
Хозяева: ${homeTeam}
Гости:   ${awayTeam}
Лига:    ${league || "Неизвестна"}
Дата:    ${dateStr}
Время:   ${timeStr} (КВ)
════════════════════════════════

═══ СТАТИСТИКА ИЗ API-FOOTBALL ═══
${stats.statsText || "⚠️ Статистика недоступна — используй общие знания об этих командах"}
════════════════════════════════

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
      return { saved: false, skipped: true, reason: parsed.reason ?? "Недостаточная уверенность" };
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
