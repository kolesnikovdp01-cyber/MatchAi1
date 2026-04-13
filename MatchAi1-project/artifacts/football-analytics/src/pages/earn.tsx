import { useState, useEffect, useRef } from "react";
import { Coins, ExternalLink, CheckCircle2, Clock, Tv2, ChevronLeft, AlertCircle, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function apiUrl(path: string) {
  return `${BASE}/api${path}`;
}

function getTgUser() {
  try {
    const u = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    return u ? { id: u.id as number, first_name: u.first_name as string, username: u.username as string | undefined } : null;
  } catch { return null; }
}

interface Ad {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  mediaType: string | null;
  linkUrl: string;
  rewardCoins: number;
  durationSeconds: number;
}

function mediaServingUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("/objects/")) return `${BASE}/api/storage${imageUrl}`;
  return imageUrl;
}

export default function EarnPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [ad, setAd] = useState<Ad | null | "loading">("loading");
  const [coins, setCoins] = useState<number>(0);
  const [phase, setPhase] = useState<"idle" | "watching" | "done" | "already">("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const tgUser = getTgUser();

  useEffect(() => {
    fetch(apiUrl("/ads/active"))
      .then(r => r.json())
      .then(data => setAd(data))
      .catch(() => setAd(null));

    if (tgUser?.id) {
      fetch(apiUrl(`/ads/user-coins?telegramId=${tgUser.id}`))
        .then(r => r.json())
        .then(data => setCoins(data.coins ?? 0))
        .catch(() => {});
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const isVideoAd = ad && ad !== "loading" && ad.mediaType === "video" && ad.imageUrl;

  function startTimer(durationSeconds: number) {
    setSecondsLeft(durationSeconds);
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          rewardUser();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function startWatching() {
    if (!ad || ad === "loading") return;
    setPhase("watching");

    if (isVideoAd) {
      // VIDEO MODE: play inline, award coins when video ends
      setSecondsLeft(ad.durationSeconds);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().then(() => setVideoPlaying(true)).catch(() => {
          // If autoplay fails, still start timer as fallback
          startTimer(ad.durationSeconds);
        });
      }
    } else {
      // LINK MODE: open link, run timer, award coins when timer ends
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openLink) {
        tg.openLink(ad.linkUrl);
      } else {
        window.open(ad.linkUrl, "_blank");
      }
      startTimer(ad.durationSeconds);
    }
  }

  function handleVideoTimeUpdate() {
    if (!ad || ad === "loading" || !videoRef.current) return;
    const video = videoRef.current;
    const remaining = Math.ceil(video.duration - video.currentTime);
    setSecondsLeft(remaining > 0 ? remaining : 0);
  }

  function handleVideoEnded() {
    setVideoPlaying(false);
    setSecondsLeft(0);
    if (timerRef.current) clearInterval(timerRef.current);
    rewardUser();
  }

  function openAdLink() {
    if (!ad || ad === "loading") return;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(ad.linkUrl);
    else window.open(ad.linkUrl, "_blank");
  }

  async function rewardUser() {
    if (!tgUser?.id || !ad || ad === "loading") {
      setPhase("done");
      return;
    }

    try {
      const res = await fetch(apiUrl("/ads/view"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: tgUser.id,
          adId: ad.id,
          firstName: tgUser.first_name,
          username: tgUser.username,
        }),
      });
      const data = await res.json();

      if (data.error === "already_viewed_today") {
        setPhase("already");
        toast({ title: "Уже просмотрено сегодня", description: "Возвращайся завтра за новыми монетами" });
      } else if (data.success) {
        setCoins(data.coins);
        setPhase("done");
        toast({ title: `+${data.coinsEarned} монет! 🪙`, description: `Баланс: ${data.coins} монет` });
      }
    } catch {
      setPhase("done");
    }
  }

  const adData = ad !== "loading" ? ad : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="h-12 border-b border-border bg-card flex items-center px-4 gap-3">
        <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-mono text-sm font-bold text-foreground flex-1">Заработать монеты</span>
        {tgUser && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-mono text-xs font-bold text-amber-400">{coins}</span>
          </div>
        )}
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-5 pt-6">

        {/* Coins balance card */}
        <div className="rounded-2xl p-5 text-center" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
              <Coins className="h-8 w-8 text-amber-400" />
            </div>
          </div>
          <div className="font-mono text-4xl font-black text-amber-400 mb-1">{coins}</div>
          <div className="text-sm text-muted-foreground font-mono">монет на балансе</div>
        </div>

        {/* How it works */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Как это работает</div>
          {[
            { icon: Tv2, text: isVideoAd ? "Нажми «Смотреть» — видео запустится прямо здесь" : "Нажми «Смотреть рекламу» — откроется ссылка" },
            { icon: Clock, text: isVideoAd ? "Досмотри видео до конца — монеты начислятся" : "Подожди таймер — монеты начислятся автоматически" },
            { icon: Coins, text: "Используй монеты для покупки premium прогнозов" },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(245,158,11,0.1)" }}>
                <Icon className="h-3.5 w-3.5 text-amber-400" />
              </div>
              <span className="text-sm text-foreground/80 leading-snug">{text}</span>
            </div>
          ))}
        </div>

        {/* Ad card */}
        {ad === "loading" ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="font-mono text-sm text-muted-foreground">Загрузка...</div>
          </div>
        ) : !adData ? (
          <div className="rounded-2xl p-8 text-center space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div className="font-mono text-sm text-muted-foreground">Сейчас нет активной рекламы</div>
            <div className="text-xs text-muted-foreground/60">Загляни позже — реклама появится скоро</div>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>

            {/* VIDEO AD: inline player */}
            {adData.mediaType === "video" && adData.imageUrl ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  src={mediaServingUrl(adData.imageUrl) ?? undefined}
                  className="w-full h-52 object-cover"
                  playsInline
                  muted={muted}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onEnded={handleVideoEnded}
                  onPlay={() => setVideoPlaying(true)}
                  onPause={() => { if (phase === "watching") setVideoPlaying(false); }}
                />
                {/* Play overlay when idle */}
                {phase === "idle" && !videoPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(245,158,11,0.25)", border: "1.5px solid rgba(245,158,11,0.5)" }}>
                      <Play className="h-6 w-6 text-amber-400 ml-1" />
                    </div>
                  </div>
                )}
                {/* Timer overlay while watching */}
                {phase === "watching" && (
                  <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full font-mono text-xs font-bold text-amber-400" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(245,158,11,0.3)" }}>
                    {secondsLeft > 0 ? `${secondsLeft} сек` : "⏳"}
                  </div>
                )}
                {/* Mute toggle — always visible when video is present */}
                {(phase === "watching" || videoPlaying) && (
                  <button
                    onClick={() => {
                      setMuted(m => {
                        const next = !m;
                        if (videoRef.current) videoRef.current.muted = next;
                        return next;
                      });
                    }}
                    className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    {muted
                      ? <VolumeX className="h-4 w-4 text-white/70" />
                      : <Volume2 className="h-4 w-4 text-white" />
                    }
                  </button>
                )}
              </div>
            ) : adData.imageUrl ? (
              /* IMAGE AD */
              <img src={mediaServingUrl(adData.imageUrl) ?? ""} alt={adData.title} className="w-full h-48 object-cover" />
            ) : null}

            <div className="p-4 space-y-3" style={{ background: "rgba(10,10,10,0.85)" }}>
              {/* Reward badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <Coins className="h-3 w-3 text-amber-400" />
                  <span className="font-mono text-xs font-bold text-amber-400">+{adData.rewardCoins} монет</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground/50">
                  <Clock className="h-3 w-3" />
                  <span className="font-mono text-xs">{adData.durationSeconds} сек</span>
                </div>
              </div>

              <div>
                <div className="font-mono font-bold text-base text-foreground">{adData.title}</div>
                {adData.description && <div className="text-sm text-muted-foreground mt-1 leading-snug">{adData.description}</div>}
              </div>

              {/* CTA — idle */}
              {phase === "idle" && (
                <Button onClick={startWatching} className="w-full font-mono font-bold"
                  style={{ background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b" }}>
                  {adData.mediaType === "video" ? (
                    <><Play className="h-4 w-4 mr-2" />Смотреть видео</>
                  ) : (
                    <><ExternalLink className="h-4 w-4 mr-2" />Смотреть рекламу</>
                  )}
                </Button>
              )}

              {/* Watching — link mode (timer progress) */}
              {phase === "watching" && !isVideoAd && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-mono">Ожидание...</span>
                    <span className="font-mono font-bold text-amber-400">{secondsLeft} сек</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${((adData.durationSeconds - secondsLeft) / adData.durationSeconds) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground/60 font-mono">Ссылка открылась — не закрывай вкладку</p>
                </div>
              )}

              {/* Watching — video mode (just hint) */}
              {phase === "watching" && isVideoAd && (
                <p className="text-xs text-center text-muted-foreground/60 font-mono py-1">
                  Досмотри видео до конца — монеты начислятся
                </p>
              )}

              {/* Done */}
              {phase === "done" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 py-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span className="font-mono font-bold text-emerald-400">Монеты начислены!</span>
                  </div>
                  {adData.linkUrl && (
                    <button onClick={openAdLink}
                      className="w-full text-xs font-mono text-muted-foreground/50 hover:text-muted-foreground flex items-center justify-center gap-1.5 py-1">
                      <ExternalLink className="h-3 w-3" />
                      Открыть ссылку объявления
                    </button>
                  )}
                </div>
              )}

              {phase === "already" && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <AlertCircle className="h-4 w-4 text-sky-400" />
                  <span className="font-mono text-sm text-sky-400">Уже просмотрено сегодня</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
