import { useContext } from "react";
import { LanguageContext } from "@/contexts/language-ctx";

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
