import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { FloatingAdButton } from "@/components/floating-ad-button";
import { 
  LayoutDashboard, 
  BrainCircuit, 
  UserPen,
  BarChart3, 
  Settings,
  ShieldCheck,
} from "lucide-react";

const SUPER_ADMIN_ID = "8589717818";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function getTelegramUserId(): string | null {
  try {
    const id = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    return id ? String(id) : null;
  } catch { return null; }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Detect admin status
  useEffect(() => {
    const tgId = getTelegramUserId();
    const savedId = localStorage.getItem("matchai1_admin_id");
    const idToCheck = tgId || savedId;

    if (!idToCheck) return;

    // Quick local check first (super admin or previously verified)
    if (idToCheck === SUPER_ADMIN_ID || savedId === SUPER_ADMIN_ID) {
      setIsAdmin(true);
      return;
    }

    // Verify via API for non-super admins
    fetch(`${BASE}/api/admins/check?id=${encodeURIComponent(idToCheck)}`)
      .then(r => r.json())
      .then((data: { isAdmin: boolean }) => {
        if (data.isAdmin) {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  const NAV_ITEMS = [
    { href: "/", label: t("nav.home"), icon: LayoutDashboard },
    { href: "/ai", label: t("nav.ai"), icon: BrainCircuit },
    { href: "/author", label: t("nav.author"), icon: UserPen },
    { href: "/statistics", label: t("nav.statistics"), icon: BarChart3 },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
    ...(isAdmin ? [{ href: "/admin", label: "Админ", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="h-12 border-b border-border bg-card flex items-center px-4 gap-0">
        <span className="font-mono text-base font-black tracking-tight text-white leading-none">
          Match<span className="text-primary">Ai</span>1
        </span>
        <img
          src={`${BASE}/logo.jpeg`}
          alt="MatchAi1 logo"
          className="w-10 h-10 object-contain mix-blend-screen flex-shrink-0 -mt-1.5"
          style={{ display: "block" }}
        />
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-28">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>

      <FloatingAdButton />

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-2">
        <div className="flex items-stretch h-16">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href === "/admin" && location === "/admin");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive
                    ? item.href === "/admin" ? "text-amber-400" : "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`nav-${item.href.replace("/", "") || "home"}`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
                <span className={`text-[10px] font-mono tracking-tight ${isActive ? "font-semibold" : ""}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-t-full ${item.href === "/admin" ? "bg-amber-400" : "bg-primary"}`} />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
