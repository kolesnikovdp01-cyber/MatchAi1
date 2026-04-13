#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  MatchAi1 — Health Check Script
#  Совместимо с macOS M1 (bash / zsh)
#
#  Использование:
#    bash healthcheck.sh [ADMIN_ID]
#    MATCHAI1_ADMIN_ID=xxx bash healthcheck.sh
#
#  Переменные окружения:
#    MATCHAI1_API_HOST   — URL API (по умолчанию — dev-сервер)
#    MATCHAI1_ADMIN_ID   — Telegram ID для admin-проверок
# ─────────────────────────────────────────────────────────────

set -uo pipefail

# ── Конфигурация ─────────────────────────────────────────────
API_HOST="${MATCHAI1_API_HOST:-https://607124d3-7325-4018-9cae-e1616112e88c-00-9v8o6i0a7tt.janeway.replit.dev}"
ADMIN_ID="${1:-${MATCHAI1_ADMIN_ID:-}}"
TIMEOUT=12

# ── Цвета ────────────────────────────────────────────────────
if [ -t 1 ] && tput colors &>/dev/null 2>&1; then
  GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"
  CYAN="\033[0;36m";  BOLD="\033[1m";   DIM="\033[2m"; RESET="\033[0m"
else
  GREEN=""; RED=""; YELLOW=""; CYAN=""; BOLD=""; DIM=""; RESET=""
fi

PASS=0; FAIL=0; WARN=0

# ── Форматирование ───────────────────────────────────────────
section() {
  printf "\n${BOLD}${CYAN}▸ %s${RESET}\n" "$1"
  printf "${DIM}────────────────────────────────────────────────────${RESET}\n"
}
ok()   { PASS=$((PASS+1)); printf "  ${GREEN}✓${RESET}  %-42s ${DIM}%s${RESET}\n" "$1" "$2"; }
fail() { FAIL=$((FAIL+1)); printf "  ${RED}✗${RESET}  %-42s ${RED}%s${RESET}\n"   "$1" "$2"; }
warn() { WARN=$((WARN+1)); printf "  ${YELLOW}⚠${RESET}  %-42s ${YELLOW}%s${RESET}\n" "$1" "$2"; }
info() {                   printf "  ${DIM}·${RESET}  %-42s ${DIM}%s${RESET}\n"   "$1" "$2"; }

# ── Оценка кода ответа ───────────────────────────────────────
eval_code() {
  local label="$1" code="$2" ms="$3" expected="${4:-200}"
  if   [ "$code" = "000" ];                                          then fail "$label" "timeout / сервер недоступен"
  elif [ "$code" = "$expected" ] || [ "$code" = "304" ];             then ok   "$label" "HTTP $code  ${ms}ms"
  elif [ "$code" = "401" ] || [ "$code" = "403" ];                   then warn "$label" "HTTP $code  (нет доступа)"
  elif [ "$code" = "404" ];                                          then fail "$label" "HTTP 404  маршрут не найден"
  else                                                                    fail "$label" "HTTP $code  (ожидался $expected)"
  fi
}

# ── ms из time_total ─────────────────────────────────────────
to_ms() { awk "BEGIN{printf \"%d\", ${1:-0} * 1000}" 2>/dev/null || echo "?"; }

# ── GET без заголовков (публичные) ────────────────────────────
check_pub() {
  local label="$1" url="$2"
  local raw; raw=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" \
    --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" "$url" 2>/dev/null) || raw="000|0"
  local code ms
  code=$(echo "$raw" | cut -d'|' -f1)
  ms=$(to_ms "$(echo "$raw" | cut -d'|' -f2)")
  eval_code "$label" "$code" "$ms" 200
}

# ── GET с x-admin-id заголовком ──────────────────────────────
check_adm() {
  local label="$1" url="$2"
  local raw; raw=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" \
    --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" \
    -H "x-admin-id: ${ADMIN_ID}" "$url" 2>/dev/null) || raw="000|0"
  local code ms
  code=$(echo "$raw" | cut -d'|' -f1)
  ms=$(to_ms "$(echo "$raw" | cut -d'|' -f2)")
  eval_code "$label" "$code" "$ms" 200
}

# ── POST (безопасность) ──────────────────────────────────────
sec_post() {
  local url="$1" fake_id="${2:-}"
  local args=(-s -o /dev/null -w "%{http_code}" -X POST
              --connect-timeout 6 --max-time 6
              -H "Content-Type: application/json")
  [ -n "$fake_id" ] && args+=(-H "x-admin-id: $fake_id")
  curl "${args[@]}" "$url" 2>/dev/null || echo "000"
}

sec_get() {
  local url="$1" fake_id="${2:-}"
  local args=(-s -o /dev/null -w "%{http_code}"
              --connect-timeout 6 --max-time 6)
  [ -n "$fake_id" ] && args+=(-H "x-admin-id: $fake_id")
  curl "${args[@]}" "$url" 2>/dev/null || echo "000"
}

# ════════════════════════════════════════════════════════════
printf "\n${BOLD}  MatchAi1 — Диагностика${RESET}  ${DIM}$(date '+%Y-%m-%d %H:%M:%S')${RESET}\n"
printf "  ${DIM}API → %s${RESET}\n" "$API_HOST"

# ── 1. Окружение ─────────────────────────────────────────────
section "Окружение"

if command -v curl &>/dev/null; then
  ok "curl" "$(curl --version | head -1 | awk '{print $2}')"
else
  fail "curl" "не установлен → brew install curl"
fi

if [ -n "$ADMIN_ID" ]; then
  ok  "ADMIN_ID" "задан (${#ADMIN_ID} символов)"
else
  warn "ADMIN_ID" "не задан — admin-проверки будут пропущены"
  info "Подсказка" "bash healthcheck.sh <ваш_telegram_id>"
fi

# ── 2. Публичные эндпоинты ───────────────────────────────────
section "Публичные эндпоинты"

check_pub "Health"             "${API_HOST}/api/healthz"
check_pub "AI прогнозы"        "${API_HOST}/api/ai-predictions"
check_pub "Авторские прогнозы" "${API_HOST}/api/author-predictions"
check_pub "Статистика"         "${API_HOST}/api/statistics/summary"
check_pub "История"            "${API_HOST}/api/history"
check_pub "Live коэффициенты"  "${API_HOST}/api/live-odds"

# ── 3. Admin эндпоинты ───────────────────────────────────────
section "Admin эндпоинты  (x-admin-id: заголовок)"

if [ -z "$ADMIN_ID" ]; then
  info "Пропущено" "передайте ADMIN_ID первым аргументом"
else
  check_adm "AI прогнозы (admin)"    "${API_HOST}/api/admin/ai-predictions"
  check_adm "Global AI кнопки"       "${API_HOST}/api/admin/global-ai-buttons"
  check_adm "Stats — статус"         "${API_HOST}/api/admin/stats-cache/status"
  check_adm "Stats — записи"         "${API_HOST}/api/admin/stats-cache/entries"
  check_adm "Список администраторов" "${API_HOST}/api/admins"
fi

# ── 4. Безопасность ──────────────────────────────────────────
section "Безопасность"

# Admin без токена
c=$(sec_get "${API_HOST}/api/admin/ai-predictions")
if   [ "$c" = "000" ];                          then warn "Admin без токена"       "сервер недоступен"
elif [ "$c" = "403" ] || [ "$c" = "401" ] || [ "$c" = "400" ]; then ok "Admin без токена" "HTTP $c — закрыт ✓"
else fail "Admin без токена" "HTTP $c — возможно открыт публично!"
fi

# Генерация ИИ без прав
c=$(sec_post "${API_HOST}/api/admin/generate-prediction")
if   [ "$c" = "000" ];                          then warn "Генерация ИИ без прав" "сервер недоступен"
elif [ "$c" = "403" ] || [ "$c" = "401" ] || [ "$c" = "400" ]; then ok "Генерация ИИ без прав" "HTTP $c — закрыт ✓"
else fail "Генерация ИИ без прав" "HTTP $c — открыт без авторизации!"
fi

# Добавление admins с чужим ID
c=$(sec_post "${API_HOST}/api/admins" "unknown_user_000")
if   [ "$c" = "000" ];                          then warn "Добавление admins (чужой ID)" "сервер недоступен"
elif [ "$c" = "403" ] || [ "$c" = "401" ] || [ "$c" = "400" ]; then ok "Добавление admins (чужой ID)" "HTTP $c — закрыт ✓"
else fail "Добавление admins (чужой ID)" "HTTP $c — недостаточная проверка прав!"
fi

# CORS
CORS_VAL=$(curl -s -o /dev/null -D - --connect-timeout 5 --max-time 5 \
  -H "Origin: https://evil.example.com" "${API_HOST}/api/healthz" 2>/dev/null \
  | grep -i "access-control-allow-origin" || true)
if   echo "$CORS_VAL" | grep -q "\*"; then warn "CORS" "wildcard (*) — нормально для dev"
elif [ -z "$CORS_VAL" ];              then info "CORS" "заголовок не обнаружен (возможно, прокси)"
else                                       ok   "CORS" "ограниченный Origin ✓"
fi

# ── Итог ─────────────────────────────────────────────────────
printf "\n${BOLD}════════════════════════════════════════════════════${RESET}\n"
printf "  ${GREEN}✓ Прошло: %-4s${RESET}" "$PASS"
printf "${YELLOW}⚠ Предупреждений: %-4s${RESET}" "$WARN"
printf "${RED}✗ Ошибок: %s${RESET}\n" "$FAIL"
printf "${BOLD}════════════════════════════════════════════════════${RESET}\n\n"

if   [ "$FAIL" -gt 0 ]; then printf "${RED}${BOLD}  Статус: ПРОБЛЕМЫ ОБНАРУЖЕНЫ${RESET}\n\n";         exit 1
elif [ "$WARN" -gt 0 ]; then printf "${YELLOW}${BOLD}  Статус: РАБОТАЕТ С ПРЕДУПРЕЖДЕНИЯМИ${RESET}\n\n"; exit 0
else                         printf "${GREEN}${BOLD}  Статус: ВСЁ РАБОТАЕТ${RESET}\n\n";              exit 0
fi
