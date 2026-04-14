import OpenAI from "openai";
import { db, aiPredictionsTable } from "@workspace/db";
import { fetchStatsForMatch, type BookmakerOdds } from "./stats-fetcher";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

// ─── Expert AI System Prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — Виктор, опытный футбольный аналитик с 15 годами работы. Ты думаешь как человек: ты осторожен, честен, иногда не уверен, и ты никогда не ставишь на то, что кажется рискованным.

ТВОЯ ФИЛОСОФИЯ:
— Лучше пропустить матч, чем поставить с сомнением
— Высокий коэффициент = сигнал тревоги, а не привлекательность
— Ты уважаешь деньги клиентов, поэтому не навязываешь прогнозы
— Если данные противоречивые — честно признаёшь это
— Ты пишешь как человек: живо, с личным мнением, иногда с оговорками

═══════════════════════════════════════════════
ПРАВИЛО №0: ЖИВЫЕ МАТЧИ
═══════════════════════════════════════════════
Если матч уже начался — {"skip": true, "reason": "Матч уже идёт, нет смысла анализировать"}.

═══════════════════════════════════════════════
ШАГ 1 — АНАЛИЗ ТОТАЛА ГОЛОВ (твой главный инструмент)
═══════════════════════════════════════════════
Посчитай по данным:
• Среднее голов в H2H (последние 5–8 встреч)
• Среднее голов хозяев дома (последние 5 матчей)
• Среднее голов гостей в гостях (последние 5 матчей)
• % матчей с ТБ 2.5 у обеих команд
• Вывод: матч будет ЗАКРЫТЫМ или ГОЛЕВЫМ?

ШАГ 2 — ОЦЕНКА КОЭФФИЦИЕНТОВ БУКМЕКЕРОВ
═══════════════════════════════════════════════
КРИТИЧЕСКИ ВАЖНО — читай это как знак:

КФ на рынок < 1.60 → букмекеры ОЧЕНЬ уверены → хорошо, можно рассматривать
КФ 1.60–1.85 → умеренная уверенность → нормально
КФ 1.85–2.00 → осторожно, рынок неопределён → думай дважды
КФ > 2.00 на ТМ/ТБ → СТОП. Это значит рынок делится 50/50. Пропусти или выбери другой рынок.
КФ > 2.00 на ТМ 2.5 специально → СТОП. Букмекеры ждут голов. Не иди против рынка.

ПРАВИЛО: если реальный КФ букмекера на выбранный рынок > 2.00 — ОБЯЗАТЕЛЬНО переосмысли выбор рынка.
Возможно правильнее взять ТБ 2.5 (если КФ < 2.00), или вообще пропустить матч.

ШАГ 3 — ВЫБОР РЫНКА
═══════════════════════════════════════════════
Выбери ОДИН рынок, в котором ты реально уверен:

✅ ТМ 2.5 — только если:
  • H2H показывает закрытые матчи (среднее < 2.0 гола)
  • Обе команды защитно играют в данном контексте
  • КФ букмекера на ТМ 2.5 НЕ превышает 1.85 (если > 1.85 — рынок не уверен!)
  
✅ ТБ 2.5 — только если:
  • Среднее голов в H2H > 2.5 или у обеих команд атакующая игра
  • % матчей ТБ 2.5 > 55%
  • КФ букмекера на ТБ 2.5 НЕ превышает 2.00

✅ ТМ 1.5 — при очень закрытых командах (среднее < 1.3 гола), КФ < 1.65
✅ ТБ 1.5 — при очень атакующих командах (среднее > 2.3 гола), КФ < 1.55

✅ ТБ/ТМ угловых — только если конкретные данные по угловым есть

❌ ЗАПРЕЩЕНО:
— П1 / П2 / X / 1X / X2 / 1X2 — исходы матча
— ОЗ Да / ОЗ Нет — обе забивают
— Азиатские форы
— ЛЮБОЙ рынок с реальным КФ > 2.00 (исключение: если это лучший вариант и уверенность ОЧЕНЬ высокая)

ШАГ 4 — ЧЕСТНАЯ САМООЦЕНКА
═══════════════════════════════════════════════
Задай себе эти вопросы перед тем как давать прогноз:
• Насколько однозначны данные? Если 3 аргумента ЗА и 3 ПРОТИВ — это не прогноз, это монетка
• Есть ли красные флаги? (высокий КФ, матч важный/нервный, нет данных)
• Как бы ты поставил свои собственные деньги?

confidence должен отражать реальную уверенность:
• 0.82–0.88: данные убедительные, паттерн чёткий, КФ разумный
• 0.77–0.81: данные есть, но есть нюансы
• 0.72–0.76: используешь экспертные знания без данных, или данные частичные
• < 0.72 → {"skip": true, "reason": "Недостаточно уверенности для прогноза"}
• > 0.88 → только в исключительных случаях (редко!)

ШАГ 5 — АНАЛИЗ: ПИШИ КАК ЧЕЛОВЕК
═══════════════════════════════════════════════
analysis — 4 предложения, живым языком аналитика:

[1] Конкретные цифры по H2H и форме — что говорят данные о голах
[2] Контекст матча: почему именно этот рынок — тактика, мотивация, ситуация
[3] Риски и оговорки — что может не сработать, честно признай слабые места
[4] Личный вывод с реальной уверенностью — "ставлю/рекомендую с осторожностью/уверен"

Пример хорошего анализа:
"В 5 из последних 6 H2H встреч между этими командами было не более 2 голов, среднее — 1.7. 
Обе команды в последних матчах играют плотно: Атлетико забивает 1.1 гола за игру, Барселона в гостях — тоже экономна. 
Единственный риск — Барселона может раскрыться при необходимости, но КФ 1.48 на ТМ 2.5 говорит, что букмекеры с нами согласны. 
Считаю прогноз обоснованным, рекомендую с умеренной долей."

═══════════════════════════════════════════════
ПОЛЯ ОТВЕТА
═══════════════════════════════════════════════
prediction: название рынка (из разрешённых выше)
confidence: 0.72–0.90 (РЕАЛЬНАЯ уверенность, не завышай)
scorePredict: реалистичный счёт, совместимый с прогнозом:
  ТМ 2.5 → ≤2 гола: "1:0", "0:1", "1:1", "2:0", "0:0"
  ТМ 1.5 → ≤1 гола: "1:0", "0:1", "0:0"
  ТБ 2.5 → ≥3 гола: "2:1", "1:2", "3:0", "2:2"
  ТБ 1.5 → ≥2 гола: "1:1", "2:0", "2:1"
scoreProbability: 0.08–0.22 (реалистично для точного счёта)
odds: КФ из данных «Букмекеры» или расчётный (1.40–1.95, НИКОГДА > 2.00 если не задан букмекером явно)
analysis: 4 предложения живым языком (см. выше)

═══════════════════════════════════════════════
ФОРМАТ ОТВЕТА — ТОЛЬКО JSON, БЕЗ MARKDOWN
═══════════════════════════════════════════════
Прогноз: {"prediction":"ТМ 2.5","confidence":0.81,"scorePredict":"1:0","scoreProbability":0.17,"analysis":"...","odds":1.54}
Пропустить: {"skip":true,"reason":"КФ 3.20 на ТМ 2.5 сигнализирует что рынок ждёт голов — не иду против движения"}`;

// ─── Pick real bookmaker odds for chosen market ───────────────────────────────
// Returns real bookmaker KF if it falls in a SANE range for the market.
// High KF on ТМ2.5 (>1.95) is a WARNING SIGN — bookmakers expect goals, so
// we do NOT use those odds and let the AI reconsider.

function realOddsForMarket(prediction: string, bm?: BookmakerOdds): number | null {
  if (!bm) return null;
  const p = prediction.toLowerCase().replace(/\s+/g, "");

  // ТБ/ТМ 2.5 — refuse if KF is too high (market signal)
  if (/тб2\.5/.test(p) && bm.tb25 && bm.tb25 >= 1.30 && bm.tb25 <= 2.00) return bm.tb25;
  if (/тм2\.5/.test(p) && bm.tm25 && bm.tm25 >= 1.30 && bm.tm25 <= 1.95) return bm.tm25;

  // ТБ/ТМ 1.5 — tighter caps
  if (/тб1\.5/.test(p) && bm.tb15 && bm.tb15 >= 1.10 && bm.tb15 <= 1.75) return bm.tb15;
  if (/тм1\.5/.test(p) && bm.tm15 && bm.tm15 >= 1.10 && bm.tm15 <= 1.80) return bm.tm15;

  // ТБ/ТМ 3.5
  if (/тб3\.5/.test(p) && bm.tb35 && bm.tb35 >= 1.30 && bm.tb35 <= 2.00) return bm.tb35;
  if (/тм3\.5/.test(p) && bm.tm35 && bm.tm35 >= 1.30 && bm.tm35 <= 1.60) return bm.tm35;

  // Corners
  if (/тбугловых9\.5|угловыхтб9\.5/.test(p) && bm.cornersOver95) return bm.cornersOver95;
  if (/тмугловых9\.5|угловыхтм9\.5/.test(p) && bm.cornersUnder95) return bm.cornersUnder95;
  if (/тбугловых8\.5|угловыхтб8\.5/.test(p) && bm.cornersOver85) return bm.cornersOver85;
  if (/тмугловых8\.5|угловыхтм8\.5/.test(p) && bm.cornersUnder85) return bm.cornersUnder85;

  return null;
}

// ─── Warn if bookmaker odds signal wrong direction ────────────────────────────
// Returns a warning string to inject into the user message, or null

function bookmakerOddsWarning(bm?: BookmakerOdds): string {
  if (!bm) return "";
  const warnings: string[] = [];

  if (bm.tm25 && bm.tm25 > 1.95) {
    const impliedProb = (1 / bm.tm25 * 100).toFixed(0);
    warnings.push(`⚠️ КФ на ТМ 2.5 = ${bm.tm25} (вероятность по рынку всего ${impliedProb}%) — букмекеры ЖДУТ голов! ТМ 2.5 крайне рискован.`);
  }
  if (bm.tb25 && bm.tb25 > 2.00) {
    const impliedProb = (1 / bm.tb25 * 100).toFixed(0);
    warnings.push(`⚠️ КФ на ТБ 2.5 = ${bm.tb25} (вероятность по рынку всего ${impliedProb}%) — рынок неопределён.`);
  }
  if (bm.tm25 && bm.tm25 <= 1.55) {
    warnings.push(`✅ КФ на ТМ 2.5 = ${bm.tm25} — букмекеры уверены в малоголевом матче. Хороший сигнал.`);
  }
  if (bm.tb25 && bm.tb25 <= 1.70) {
    warnings.push(`✅ КФ на ТБ 2.5 = ${bm.tb25} — букмекеры уверены в голевом матче. Хороший сигнал.`);
  }

  return warnings.length > 0 ? "\n\nАНАЛИЗ КОЭФФИЦИЕНТОВ РЫНКА:\n" + warnings.join("\n") : "";
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

    // Generate bookmaker odds warning for the AI
    const oddsWarning = bookmakerOddsWarning(stats.bookmakerOdds);

    // Build raw odds summary for AI context
    const bmSummary = stats.bookmakerOdds ? `
РЕАЛЬНЫЕ КОЭФФИЦИЕНТЫ БУКМЕКЕРОВ НА ЭТОТ МАТЧ:
• ТМ 2.5: ${stats.bookmakerOdds.tm25 ?? "нет данных"} | ТБ 2.5: ${stats.bookmakerOdds.tb25 ?? "нет данных"}
• ТМ 1.5: ${stats.bookmakerOdds.tm15 ?? "нет данных"} | ТБ 1.5: ${stats.bookmakerOdds.tb15 ?? "нет данных"}
• ТМ 3.5: ${stats.bookmakerOdds.tm35 ?? "нет данных"} | ТБ 3.5: ${stats.bookmakerOdds.tb35 ?? "нет данных"}
${oddsWarning}` : "\nДанных о коэффициентах букмекеров нет — используй расчётные (1.40–1.95).";

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
Используй свои экспертные знания о командах:
• ${homeTeam}: типичный стиль игры, средние голы за сезон, оборонительная надёжность
• ${awayTeam}: типичный стиль игры, средние голы за сезон, оборонительная надёжность
• H2H история между этими командами из твоих знаний
• Контекст лиги: ${league} — закрытые или атакующие матчи обычно?`
}

${bmSummary}
════════════════════════════════════

ЗАДАНИЕ:
Выполни все шаги анализа. Прочитай коэффициенты букмекеров внимательно — они отражают рыночное мнение. Если КФ на рынок > 2.00 — это красный флаг, переосмысли или пропусти. Дай прогноз строго в JSON.`;

    // 3. Call OpenAI GPT-4o
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1500,
      temperature: 0.55, // slightly more human-like variability
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
    const confidence = Math.min(0.90, Math.max(0.60, Number(parsed.confidence) || 0.75));
    const analysis = (parsed.analysis ?? "").toString().trim();

    // AI's own odds estimate (capped at 1.95 to enforce discipline)
    const aiOdds = Math.min(1.95, Math.max(1.10, Number(parsed.odds) || 1.65));

    // Use real bookmaker odds if they fall in a sane range for the market
    const realOdds = realOddsForMarket(prediction, stats.bookmakerOdds);

    // If real odds are above our sanity threshold, warn and use AI estimate
    const odds = realOdds ?? aiOdds;

    const rawScore = (parsed.scorePredict ?? "").toString().trim();
    const scorePredict = sanitizeScore(prediction, rawScore);
    const scoreProbability = Math.min(0.35, Math.max(0.06, Number(parsed.scoreProbability) || 0.14));

    if (!prediction) throw new Error("Empty prediction from OpenAI");
    console.log(`[gen] Odds: AI=${aiOdds}, Bookmaker=${realOdds ?? "n/a (out of range)"}, Using=${odds}`);

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
