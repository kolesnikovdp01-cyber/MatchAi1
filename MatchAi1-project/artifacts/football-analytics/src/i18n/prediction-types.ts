import type { Lang } from "./translations";

const predictionMap: Record<string, Record<Lang, string>> = {
  // Outcomes
  "Home Win":               { ru: "Победа хозяев",         uk: "Перемога господарів",      en: "Home Win" },
  "Away Win":               { ru: "Победа гостей",          uk: "Перемога гостей",           en: "Away Win" },
  "Draw":                   { ru: "Ничья",                  uk: "Нічия",                     en: "Draw" },
  "1X":                     { ru: "П1 или Ничья",           uk: "П1 або Нічия",              en: "1X (Home/Draw)" },
  "X2":                     { ru: "Ничья или П2",           uk: "Нічия або П2",              en: "X2 (Draw/Away)" },
  "12":                     { ru: "Любая победа",           uk: "Будь-яка перемога",         en: "Both Win" },

  // Goals
  "Over 2.5 Goals":         { ru: "Тотал больше 2.5",      uk: "Тотал більше 2.5",          en: "Over 2.5 Goals" },
  "Under 2.5 Goals":        { ru: "Тотал меньше 2.5",      uk: "Тотал менше 2.5",           en: "Under 2.5 Goals" },
  "Over 1.5 Goals":         { ru: "Тотал больше 1.5",      uk: "Тотал більше 1.5",          en: "Over 1.5 Goals" },
  "Under 1.5 Goals":        { ru: "Тотал меньше 1.5",      uk: "Тотал менше 1.5",           en: "Under 1.5 Goals" },
  "Over 3.5 Goals":         { ru: "Тотал больше 3.5",      uk: "Тотал більше 3.5",          en: "Over 3.5 Goals" },
  "Under 3.5 Goals":        { ru: "Тотал меньше 3.5",      uk: "Тотал менше 3.5",           en: "Under 3.5 Goals" },

  // BTTS
  "BTTS Yes":               { ru: "Обе забьют",            uk: "Обидві заб'ють",            en: "Both Teams Score" },
  "BTTS No":                { ru: "Не обе забьют",         uk: "Не обидві заб'ють",         en: "Both Teams Don't Score" },
  "Both Teams Score":       { ru: "Обе забьют",            uk: "Обидві заб'ють",            en: "Both Teams Score" },

  // Combos
  "Home Win & Over 1.5":    { ru: "П1 + Тотал > 1.5",     uk: "П1 + Тотал > 1.5",          en: "Home Win & Over 1.5" },
  "Home Win & Over 2.5":    { ru: "П1 + Тотал > 2.5",     uk: "П1 + Тотал > 2.5",          en: "Home Win & Over 2.5" },
  "Away Win & Over 1.5":    { ru: "П2 + Тотал > 1.5",     uk: "П2 + Тотал > 1.5",          en: "Away Win & Over 1.5" },
  "Away Win & Over 2.5":    { ru: "П2 + Тотал > 2.5",     uk: "П2 + Тотал > 2.5",          en: "Away Win & Over 2.5" },
  "Home Win & BTTS":        { ru: "П1 + Обе забьют",      uk: "П1 + Обидві заб'ють",       en: "Home Win & BTTS" },
  "Away Win & BTTS":        { ru: "П2 + Обе забьют",      uk: "П2 + Обидві заб'ють",       en: "Away Win & BTTS" },

  // Asian handicap / corners
  "Asian Handicap -1":      { ru: "Фора (-1) хозяев",     uk: "Фора (-1) господарів",      en: "Asian Handicap -1" },
  "Asian Handicap +1":      { ru: "Фора (+1) гостей",     uk: "Фора (+1) гостей",          en: "Asian Handicap +1" },
};

export function translatePrediction(raw: string, lang: Lang): string {
  const entry = predictionMap[raw.trim()];
  if (entry) return entry[lang];
  return raw;
}
