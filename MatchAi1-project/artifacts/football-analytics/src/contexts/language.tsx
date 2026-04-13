import { useState, type ReactNode } from "react";
import { translations, type Lang, leagueTranslations, teamTranslations } from "@/i18n/translations";
import { LanguageContext } from "./language-ctx";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("matchai1_lang");
    return (saved as Lang) || "ru";
  });

  const setLang = (l: Lang) => {
    localStorage.setItem("matchai1_lang", l);
    setLangState(l);
  };

  const t = (key: string): string => {
    const dict = translations[lang] as Record<string, string>;
    if (dict?.[key] !== undefined) return dict[key];
    const ruDict = translations["ru"] as Record<string, string>;
    return ruDict?.[key] ?? key;
  };

  const tLeague = (league: string): string => {
    const trimmed = league.trim();
    return leagueTranslations[trimmed]?.[lang] ?? league;
  };

  const tTeam = (team: string): string => {
    return teamTranslations[team.trim()]?.[lang] ?? team;
  };

  const tMatchTitle = (title: string): string => {
    const seps = [" vs ", " vs. "];
    for (const sep of seps) {
      if (title.includes(sep)) {
        const [home, away] = title.split(sep);
        return `${tTeam(home.trim())} vs ${tTeam(away.trim())}`;
      }
    }
    return title;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tLeague, tTeam, tMatchTitle }}>
      {children}
    </LanguageContext.Provider>
  );
}
