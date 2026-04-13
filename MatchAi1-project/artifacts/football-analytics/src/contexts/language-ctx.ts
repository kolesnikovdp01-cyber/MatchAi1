import { createContext } from "react";
import type { Lang } from "@/i18n/translations";

export interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  tLeague: (league: string) => string;
  tTeam: (team: string) => string;
  tMatchTitle: (title: string) => string;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);
