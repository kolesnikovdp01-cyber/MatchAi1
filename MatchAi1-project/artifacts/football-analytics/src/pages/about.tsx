import { useLocation } from "wouter";
import { ArrowLeft, BrainCircuit, UserPen, BarChart3, Zap } from "lucide-react";

export default function About() {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Назад к настройкам
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono text-primary tracking-tight uppercase">MatchAi1</h1>
            <p className="text-xs text-muted-foreground font-mono">Football Analytics · v1.0.0</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          MatchAi1 — это инструмент для тех, кто подходит к ставкам осознанно. Мы объединяем мощь искусственного интеллекта и опыт профессиональных аналитиков, чтобы вы принимали решения на основе данных, а не интуиции.
        </p>
      </div>

      {/* Features with expanded descriptions */}
      <div>
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">О приложении</h2>
        <div className="space-y-3">

          <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
            <div className="flex items-center gap-3">
              <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
                <BrainCircuit className="h-[18px] w-[18px] text-primary" />
              </div>
              <div className="font-mono text-sm font-semibold text-primary">ИИ Прогнозы</div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Искусственный интеллект анализирует сотни показателей перед каждым матчем: форму команд за последние игры, домашнюю и выездную статистику, травмы и дисквалификации ключевых игроков, движение коэффициентов на рынке. На основе этого анализа система рассчитывает вероятность каждого исхода и публикует только те прогнозы, в которых уверена на 65% и выше.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Это убирает человеческий фактор — эмоции, симпатии к командам, случайные решения. Только математика и данные.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
            <div className="flex items-center gap-3">
              <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-amber-400/10">
                <UserPen className="h-[18px] w-[18px] text-amber-400" />
              </div>
              <div className="font-mono text-sm font-semibold text-amber-400">Авторские прогнозы</div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Помимо ИИ, в приложении публикуются авторские прогнозы от профессионального аналитика. Это то, что алгоритм не умеет учитывать: инсайдерская информация, мотивация команд в конкретном матче, тактические нюансы, психологическое состояние игроков накануне важных встреч.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Каждый авторский прогноз сопровождается детальным разбором — вы видите не только результат, но и логику рассуждений. Это помогает самостоятельно оценить, насколько прогноз вам подходит.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
            <div className="flex items-center gap-3">
              <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-sky-400/10">
                <BarChart3 className="h-[18px] w-[18px] text-sky-400" />
              </div>
              <div className="font-mono text-sm font-semibold text-sky-400">Статистика и прозрачность</div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Все прогнозы — и ИИ, и авторские — фиксируются в системе с самого начала. Результат каждого записывается после матча. Вы всегда можете зайти в историю и увидеть реальный процент побед, средний коэффициент и ROI — без приукрашиваний.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Мы не удаляем неудачные прогнозы и не показываем только красивые цифры. Полная история доступна в разделе «Статистика».
            </p>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-2 text-xs text-muted-foreground/50 font-mono">
        MatchAi1 © {new Date().getFullYear()} · All rights reserved
      </div>
    </div>
  );
}
