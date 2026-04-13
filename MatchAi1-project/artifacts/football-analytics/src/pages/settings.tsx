import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Bell, Globe, Info, User, ChevronRight, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import type { Lang } from "@/i18n/translations";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

function getTelegramUser(): TgUser | null {
  try {
    const user = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    return user ? (user as TgUser) : null;
  } catch { return null; }
}

function UserProfile() {
  const [tgUser, setTgUser] = useState<TgUser | null>(null);

  useEffect(() => {
    // Try immediately
    const user = getTelegramUser();
    if (user) { setTgUser(user); return; }
    // Retry after short delay in case SDK is still initializing
    const timer = setTimeout(() => {
      setTgUser(getTelegramUser());
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const displayName = tgUser
    ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ")
    : null;

  const initials = displayName
    ? displayName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <Card className="bg-card border-border/50">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            {tgUser?.photo_url ? (
              <img
                src={tgUser.photo_url}
                alt={displayName ?? "User"}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/30"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/10 ring-2 ring-primary/30 flex items-center justify-center">
                {tgUser ? (
                  <span className="font-mono text-lg font-bold text-primary">{initials}</span>
                ) : (
                  <User className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-card" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {tgUser ? (
              <>
                <div className="font-semibold text-base text-foreground truncate">{displayName}</div>
                {tgUser.username && (
                  <div className="text-sm text-muted-foreground font-mono">@{tgUser.username}</div>
                )}
                <div className="text-xs text-muted-foreground/60 font-mono mt-0.5">ID: {tgUser.id}</div>
              </>
            ) : (
              <>
                <div className="font-semibold text-base text-foreground">Гость</div>
                <div className="text-sm text-muted-foreground">Откройте через Telegram для профиля</div>
              </>
            )}
          </div>

          {/* Telegram badge */}
          {tgUser && (
            <div className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
              TG
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CoinsCard() {
  const [coins, setCoins] = useState<number | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    try {
      const id = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (!id) return;
      fetch(`${BASE}/api/ads/user-coins?telegramId=${id}`)
        .then(r => r.json())
        .then(d => setCoins(d.coins ?? 0))
        .catch(() => {});
    } catch { /* ignore */ }
  }, []);

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:opacity-90 transition-opacity"
      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
      onClick={() => navigate("/earn")}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(245,158,11,0.15)" }}>
        <Coins className="h-5 w-5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm font-bold text-amber-400">Монеты</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {coins === null ? "Загрузка..." : `${coins} монет на балансе`}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {coins !== null && (
          <span className="font-mono text-xl font-black text-amber-400">{coins}</span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function getTelegramId(): number | null {
  try {
    const id = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    return id ? Number(id) : null;
  } catch { return null; }
}

export default function Settings() {
  const { toast } = useToast();
  const { t, lang, setLang } = useLanguage();
  const [, navigate] = useLocation();
  const [notifsSaving, setNotifsSaving] = useState(false);
  const [notifs, setNotifs] = useState({ ai: true, author: true });

  // Load notification prefs from server
  useEffect(() => {
    const tgId = getTelegramId();
    if (!tgId) return;
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    fetch(`${BASE}/api/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramId: tgId,
        firstName: tgUser?.first_name,
        username: tgUser?.username,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.notificationsAi !== undefined) {
          setNotifs({ ai: d.notificationsAi, author: d.notificationsAuthor });
        }
      })
      .catch(() => {});
  }, []);

  const handleLangChange = (val: Lang) => {
    setLang(val);
    toast({ title: t("settings.saved"), description: t("settings.savedDesc") });
  };

  const handleNotifChange = async (key: "ai" | "author", val: boolean) => {
    const prev = notifs;
    setNotifs(n => ({ ...n, [key]: val }));
    const tgId = getTelegramId();
    if (!tgId) {
      toast({ title: "Откройте через Telegram", variant: "destructive" });
      setNotifs(prev);
      return;
    }
    setNotifsSaving(true);
    try {
      const res = await fetch(`${BASE}/api/users/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: tgId,
          ...(key === "ai" ? { notificationsAi: val } : { notificationsAuthor: val }),
        }),
      });
      if (!res.ok) throw new Error();
      toast({
        title: val ? "Уведомления включены" : "Уведомления беззвучные",
        description: val
          ? "Будете получать уведомления со звуком"
          : "Прогнозы будут приходить без звука",
      });
    } catch {
      setNotifs(prev);
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    } finally {
      setNotifsSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-3xl">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold font-mono text-primary tracking-tight uppercase">{t("settings.title")}</h1>
        </div>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      {/* User Profile */}
      <UserProfile />

      {/* Coins */}
      <CoinsCard />

      {/* Language */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="font-mono text-sm uppercase tracking-wider">{t("settings.localization")}</CardTitle>
          </div>
          <CardDescription className="text-xs">{t("settings.localizationDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("settings.language")}</Label>
            <Select value={lang} onValueChange={(val) => handleLangChange(val as Lang)}>
              <SelectTrigger className="w-full sm:w-[260px] font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                <SelectItem value="uk">🇺🇦 Українська</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{t("settings.languageNote")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="font-mono text-sm uppercase tracking-wider">{t("settings.notifications")}</CardTitle>
          </div>
          <CardDescription className="text-xs">{t("settings.notificationsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {([
            { key: "ai",     label: "AI прогнозы",      desc: "Уведомление когда AI выпускает прогноз" },
            { key: "author", label: "Авторские прогнозы", desc: "Уведомление когда выходит авторский прогноз" },
          ] as const).map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label className="text-sm">{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
                <p className="text-xs font-mono" style={{ color: notifs[item.key] ? "rgba(34,197,94,0.7)" : "rgba(255,255,255,0.3)" }}>
                  {notifs[item.key] ? "🔔 Со звуком" : "🔕 Беззвучно"}
                </p>
              </div>
              <Switch
                checked={notifs[item.key]}
                disabled={notifsSaving}
                onCheckedChange={(val) => handleNotifChange(item.key, val)}
              />
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground/60 font-mono pt-1">
            Выкл = уведомления приходят беззвучно. Вкл = со звуком.
          </p>
        </CardContent>
      </Card>

      {/* About App */}
      <button
        onClick={() => navigate("/about")}
        className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <div className="font-mono text-sm font-medium">О приложении</div>
            <div className="text-xs text-muted-foreground">MatchAi1 · версия и описание</div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </button>
    </div>
  );
}
