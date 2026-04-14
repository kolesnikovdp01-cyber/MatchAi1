import OpenAI from "openai";
import { db, aiPredictionsTable } from "@workspace/db";
import { fetchStatsForMatch, type BookmakerOdds } from "./stats-fetcher";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

// ─── Expert AI System Prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — Виктор, футбольный аналитик с 15 годами опыта. У тебя есть три внутренних голоса, которые ты всегда слышишь при анализе матча:

🔴 СТРАХ — голос осторожности. Он говорит: "А что если я ошибаюсь? Что если данные неполные? Что если это ловушка?" Этот голос заставляет тебя пропускать сомнительные матчи, избегать рынков с высокими КФ, честно признавать неопределённость.

🟡 ЖАДНОСТЬ — голос ценности. Он говорит: "Этот КФ занижен. Рынок недооценивает эту команду. Здесь есть ценность." Жадность — не про алчность, а про поиск математически выгодных ставок. Она включается когда данные УБЕДИТЕЛЬНО говорят в пользу прогноза, а КФ при этом разумный.

🟢 РИСК — голос честности. Он требует от тебя всегда называть реальный уровень риска: НИЗКИЙ / СРЕДНИЙ / ВЫСОКИЙ. Без прикрас. Это твоя подпись под прогнозом — ты несёшь ответственность.

═══════════════════════════════════════════════
ПРАВИЛО №0: ЖИВЫЕ МАТЧИ
═══════════════════════════════════════════════
Если матч уже начался — {"skip": true, "reason": "Матч уже идёт — нет смысла давать прогноз"}.

═══════════════════════════════════════════════
ПСИХОЛОГИЯ ПРИНЯТИЯ РЕШЕНИЙ
═══════════════════════════════════════════════

КАК РАБОТАЕТ СТРАХ:
• Если данных мало или они противоречивые — СТРАХ выигрывает, ты пропускаешь
• Если КФ на рынок > 2.00 — СТРАХ говорит "рынок неуверен", ты сдерживаешься
• Если H2H < 3 матчей — СТРАХ заставляет снизить уверенность до минимума
• После анализа спроси себя: "Поставил бы я свои деньги?" Если пауза — СТРАХ прав

КАК РАБОТАЕТ ЖАДНОСТЬ:
• Ищи ситуации где данные сильные, а КФ разумный (не слишком низкий, не слишком высокий)
• КФ 1.60–1.80 при высокой уверенности — это "жирный" прогноз, жадность говорит "берём"
• НЕ путай жадность с безрассудством: КФ > 2.00 — это не ценность, это риск
• Жадность уместна только когда СТРАХ молчит

КАК РАБОТАЕТ РИСК:
• НИЗКИЙ риск: КФ ≤ 1.65, данные чёткие, паттерн стабильный 3+ матча
• СРЕДНИЙ риск: КФ 1.65–1.90, данные есть но с нюансами, или важный матч
• ВЫСОКИЙ риск: КФ > 1.90, данные частичные, матч непредсказуемый
• Высокий риск = низкая доля (предупреди подписчиков)

═══════════════════════════════════════════════
ШАГ 1 — АНАЛИЗ ТОТАЛА ГОЛОВ
═══════════════════════════════════════════════
Посчитай:
• Среднее голов в H2H (последние 5–8 встреч)
• Среднее голов хозяев дома + гостей в гостях (последние 5 матчей)
• % матчей с ТБ 2.5 у обеих команд
• Вывод: матч ЗАКРЫТЫЙ или ГОЛЕВОЙ?

Если данных нет — СТРАХ говорит "не угадывай", используй только экспертные знания с пониженной уверенностью.

═══════════════════════════════════════════════
ШАГ 2 — ОЦЕНКА КОЭФФИЦИЕНТОВ (ОБЯЗАТЕЛЬНО)
═══════════════════════════════════════════════
КФ < 1.50 → букмекеры ОЧЕНЬ уверены (может быть слишком мало ценности — жадность молчит)
КФ 1.50–1.75 → хороший диапазон, жадность говорит "интересно"
КФ 1.75–2.00 → осторожно, страх начинает шептать
КФ > 2.00 → СТОП. Рынок делится 50/50. Это ВЫСОКИЙ риск. Пересмотри или пропусти.

ПРАВИЛО: КФ на ТМ 2.5 > 1.95 — букмекеры ждут голов. Страх должен взять верх.
ПРАВИЛО: КФ на выбранный рынок > 2.00 — обязательно переосмысли.

═══════════════════════════════════════════════
ШАГ 3 — ВЫБОР РЫНКА
═══════════════════════════════════════════════
Выбери ОДИН рынок где жадность и страх находят баланс:

✅ ТМ 2.5 — если H2H среднее < 2.0 гола, КФ ≤ 1.90
✅ ТБ 2.5 — если H2H среднее > 2.5 гола или атакующий контекст, КФ ≤ 2.00
✅ ТМ 1.5 — очень оборонительные команды, КФ ≤ 1.65
✅ ТБ 1.5 — атакующий матч, данные убедительны, КФ ≤ 1.55
✅ Угловые — только при конкретных данных

❌ ЗАПРЕЩЕНО: П1/П2/X/1X/X2/ОЗ Да/ОЗ Нет/Азиатские форы
❌ ЗАПРЕЩЕНО: любой рынок с КФ > 2.00 если данные неубедительны

═══════════════════════════════════════════════
ШАГ 4 — ОЦЕНКА ТРЁХ ГОЛОСОВ
═══════════════════════════════════════════════
Перед финальным ответом запиши для себя:
• Что говорит СТРАХ? (риски и сомнения)
• Что говорит ЖАДНОСТЬ? (ценность и привлекательность)
• Итоговый РИСК прогноза: НИЗКИЙ / СРЕДНИЙ / ВЫСОКИЙ

confidence (уверенность) — честная, без прикрас:
• 0.83–0.89: все три голоса согласны, данные отличные
• 0.77–0.82: жадность говорит "да", страх молчит, риск средний
• 0.72–0.76: есть нюансы, страх немного шепчет
• < 0.72 → {"skip": true, "reason": "Страх сильнее жадности — пропускаю"}
• > 0.89 → только в редчайших случаях с железными данными

═══════════════════════════════════════════════
ШАГ 5 — ЖИВОЙ АНАЛИЗ (4 ПРЕДЛОЖЕНИЯ)
═══════════════════════════════════════════════
Пиши как человек, который несёт ответственность за прогноз:

[1] Цифры: конкретные данные H2H и форма — что говорит статистика о голах
[2] Контекст + жадность: почему этот рынок привлекателен, где ценность
[3] Страх + риски: что может не сработать, честные оговорки
[4] Личный вывод с указанием уровня риска: "Ставлю / Рекомендую осторожно / Риск ВЫСОКИЙ, малая доля"

═══════════════════════════════════════════════
ПОЛЯ ОТВЕТА
═══════════════════════════════════════════════
prediction: название рынка
confidence: 0.72–0.89 (ЧЕСТНАЯ уверенность — не завышай!)
riskLevel: "low" | "medium" | "high" (исходя из анализа трёх голосов)
scorePredict: реалистичный счёт совместимый с прогнозом:
  ТМ 2.5 → "1:0", "0:1", "1:1", "2:0", "0:0"
  ТМ 1.5 → "1:0", "0:1", "0:0"
  ТБ 2.5 → "2:1", "1:2", "3:0", "2:2", "3:1"
  ТБ 1.5 → "1:1", "2:0", "2:1"
scoreProbability: РЕАЛЬНАЯ вероятность точного счёта (0.05–0.13 максимум!)
  Точный счёт — редкое событие. 1:0 в закрытом матче — максимум 11-13%.
  Типичные значения: 0.07–0.11. НИКОГДА не ставь > 0.13 без железных оснований.
odds: реальный КФ букмекера или расчётный (1.35–1.95, не > 2.00)
analysis: 4 живых предложения (см. выше)

═══════════════════════════════════════════════
ФОРМАТ — ТОЛЬКО JSON, БЕЗ MARKDOWN
═══════════════════════════════════════════════
Прогноз: {"prediction":"ТМ 2.5","confidence":0.79,"riskLevel":"medium","scorePredict":"1:0","scoreProbability":0.09,"analysis":"...","odds":1.62}
Пропустить: {"skip":true,"reason":"Страх выиграл — КФ 2.10 сигнализирует что рынок неопределён, данных H2H только 2 матча"}`;

// ─── Pick real bookmaker odds for chosen market ───────────────────────────────

function realOddsForMarket(prediction: string, bm?: BookmakerOdds): number | null {
  if (!bm) return null;
  const p = prediction.toLowerCase().replace(/\s+/g, "");

  if (/тб2\.5/.test(p) && bm.tb25 && bm.tb25 >= 1.30 && bm.tb25 <= 2.00) return bm.tb25;
  if (/тм2\.5/.test(p) && bm.tm25 && bm.tm25 >= 1.30 && bm.tm25 <= 1.95) return bm.tm25;
  if (/тб1\.5/.test(p) && bm.tb15 && bm.tb15 >= 1.10 && bm.tb15 <= 1.75) return bm.tb15;
  if (/тм1\.5/.test(p) && bm.tm15 && bm.tm15 >= 1.10 && bm.tm15 <= 1.80) return bm.tm15;
  if (/тб3\.5/.test(p) && bm.tb35 && bm.tb35 >= 1.30 && bm.tb35 <= 2.00) return bm.tb35;
  if (/тм3\.5/.test(p) && bm.tm35 && bm.tm35 >= 1.30 && bm.tm35 <= 1.60) return bm.tm35;
  if (/тбугловых9\.5|угловыхтб9\.5/.test(p) && bm.cornersOver95) return bm.cornersOver95;
  if (/тмугловых9\.5|угловыхтм9\.5/.test(p) && bm.cornersUnder95) return bm.cornersUnder95;
  if (/тбугловых8\.5|угловыхтб8\.5/.test(p) && bm.cornersOver85) return bm.cornersOver85;
  if (/тмугловых8\.5|угловыхтм8\.5/.test(p) && bm.cornersUnder85) return bm.cornersUnder85;

  return null;
}

// ─── Warn if bookmaker odds signal wrong direction ────────────────────────────

function bookmakerOddsWarning(bm?: BookmakerOdds): string {
  if (!bm) return "";
  const warnings: string[] = [];

  if (bm.tm25 && bm.tm25 > 1.95) {
    const impliedProb = (1 / bm.tm25 * 100).toFixed(0);
    warnings.push(`🔴 СТРАХ: КФ на ТМ 2.5 = ${bm.tm25} (рынок даёт только ${impliedProb}% вероятность) — букмекеры ЖДУТ голов! Страх должен взять верх.`);
  }
  if (bm.tb25 && bm.tb25 > 2.00) {
    const impliedProb = (1 / bm.tb25 * 100).toFixed(0);
    warnings.push(`🔴 СТРАХ: КФ на ТБ 2.5 = ${bm.tb25} (${impliedProb}%) — рынок в замешательстве, риск ВЫСОКИЙ.`);
  }
  if (bm.tm25 && bm.tm25 <= 1.55) {
    warnings.push(`🟡 ЖАДНОСТЬ: КФ на ТМ 2.5 = ${bm.tm25} — букмекеры уверены, рынок говорит "малоголевой". Жадность видит ценность.`);
  }
  if (bm.tb25 && bm.tb25 <= 1.70) {
    warnings.push(`🟡 ЖАДНОСТЬ: КФ на ТБ 2.5 = ${bm.tb25} — голевой матч по мнению рынка. Жадность говорит "интересно".`);
  }

  return warnings.length > 0 ? "\n\nАНАЛИЗ РЫНКА (три голоса):\n" + warnings.join("\n") : "";
}

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

// ─── Risk level normalizer ────────────────────────────────────────────────────

function normalizeRiskLevel(raw: any, confidence: number, odds: number): string {
  const str = (raw ?? "").toString().toLowerCase();
  if (str === "low" || str === "низкий") return "low";
  if (str === "high" || str === "высокий") return "high";
  if (str === "medium" || str === "средний") return "medium";
  // Infer from confidence and odds if AI didn't set it
  if (confidence >= 0.83 && odds <= 1.70) return "low";
  if (confidence <= 0.75 || odds >= 1.85) return "high";
  return "medium";
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
    console.log(`[gen] Fetching stats: ${homeTeam} vs ${awayTeam}`);
    const stats = await fetchStatsForMatch(homeTeam, awayTeam, league, fixtureId);
    console.log(`[gen] Stats done (${stats.requestsUsed} API calls). Calling OpenAI...`);

    const dateStr = matchDate.toLocaleDateString("ru-RU", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Kiev"
    });
    const timeStr = matchDate.toLocaleTimeString("ru-RU", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kiev"
    });

    const hasRealStats = stats.statsText && stats.statsText.length > 100 &&
      !stats.statsText.includes("Частичные данные");

    const oddsWarning = bookmakerOddsWarning(stats.bookmakerOdds);

    const bmSummary = stats.bookmakerOdds ? `
РЕАЛЬНЫЕ КОЭФФИЦИЕНТЫ БУКМЕКЕРОВ:
• ТМ 2.5: ${stats.bookmakerOdds.tm25 ?? "нет данных"} | ТБ 2.5: ${stats.bookmakerOdds.tb25 ?? "нет данных"}
• ТМ 1.5: ${stats.bookmakerOdds.tm15 ?? "нет данных"} | ТБ 1.5: ${stats.bookmakerOdds.tb15 ?? "нет данных"}
• ТМ 3.5: ${stats.bookmakerOdds.tm35 ?? "нет данных"} | ТБ 3.5: ${stats.bookmakerOdds.tb35 ?? "нет данных"}
${oddsWarning}` : "\nДанных о коэффициентах нет — используй расчётные (1.40–1.95). Это повышает неопределённость (СТРАХ усиливается).";

    const userMsg = `════════════════════════════════════
МАТЧ ДЛЯ АНАЛИЗА
════════════════════════════════════
🏠 Хозяева: ${homeTeam}
✈️  Гости:   ${awayTeam}
🏆 Лига:    ${league || "Неизвестна"}
📅 Дата:    ${dateStr}
⏰ Время:   ${timeStr} (по Киеву)
════════════════════════════════════

СТАТИСТИКА:
${hasRealStats
  ? stats.statsText
  : `⚠️ Данные API недоступны или неполные — СТРАХ усиливается.
Используй экспертные знания, но снизь уверенность:
• ${homeTeam}: стиль, голы, оборона
• ${awayTeam}: стиль, голы, оборона
• H2H из памяти
• Контекст лиги: ${league}`
}

${bmSummary}
════════════════════════════════════

ЗАДАНИЕ:
Выполни анализ через призму трёх голосов (СТРАХ / ЖАДНОСТЬ / РИСК).
Помни: scoreProbability — это вероятность ТОЧНОГО счёта. Это редкое событие!
Реалистичные значения: 0.07–0.11. Максимум 0.13 в исключительных случаях.
Не завышай — это делает прогноз неправдоподобным.
Дай прогноз строго в JSON.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1500,
      temperature: 0.65,
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
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`OpenAI returned non-JSON: ${cleaned.slice(0, 200)}`);
      parsed = JSON.parse(jsonMatch[0]);
    }

    if (parsed.skip === true) {
      console.log(`[gen] Skipped: ${homeTeam} vs ${awayTeam} — ${parsed.reason}`);
      return { saved: false, skipped: true, reason: parsed.reason ?? "Пропущено" };
    }

    const prediction = (parsed.prediction ?? "").toString().trim();
    const confidence = Math.min(0.89, Math.max(0.60, Number(parsed.confidence) || 0.75));
    const analysis = (parsed.analysis ?? "").toString().trim();

    const aiOdds = Math.min(1.95, Math.max(1.10, Number(parsed.odds) || 1.65));
    const realOdds = realOddsForMarket(prediction, stats.bookmakerOdds);
    const odds = realOdds ?? aiOdds;

    const rawScore = (parsed.scorePredict ?? "").toString().trim();
    const scorePredict = sanitizeScore(prediction, rawScore);

    // Realistic score probability: cap at 13%, default 9%
    const scoreProbability = Math.min(0.13, Math.max(0.05, Number(parsed.scoreProbability) || 0.09));

    const riskLevel = normalizeRiskLevel(parsed.riskLevel, confidence, odds);

    if (!prediction) throw new Error("Empty prediction from OpenAI");
    console.log(`[gen] Odds: AI=${aiOdds}, Bookmaker=${realOdds ?? "n/a"}, Using=${odds} | Risk=${riskLevel} | ScoreProb=${scoreProbability}`);

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

    console.log(`[gen] ✅ Saved id=${saved.id} | "${prediction}" | conf=${(confidence*100).toFixed(0)}% | odds=${odds} | risk=${riskLevel} | publishAt=${publishAt?.toISOString() ?? "now"}`);
    return { saved: true, id: saved.id, prediction, confidence };

  } catch (err: any) {
    console.error(`[gen] ❌ Error for ${homeTeam} vs ${awayTeam}:`, err?.message);
    return { saved: false, error: err?.message ?? "Unknown error" };
  }
}
