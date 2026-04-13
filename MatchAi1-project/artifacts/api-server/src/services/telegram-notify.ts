import { db, usersTable } from "@workspace/db";

const BOT_TOKEN = process.env["BOT_TOKEN"];
const APP_URL = "https://server-node-express--kolesnikovdp01.replit.app/";

async function sendMessage(chatId: number, text: string, silent: boolean) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_notification: silent,
        reply_markup: {
          inline_keyboard: [[
            { text: "⚽ Открыть прогноз", web_app: { url: APP_URL } }
          ]]
        }
      }),
    });
  } catch { /* ignore individual send failures */ }
}

export async function notifyNewAiPrediction(prediction: {
  homeTeam: string;
  awayTeam: string;
  league: string;
  prediction: string;
  odds: number;
  confidence: number;
}) {
  if (!BOT_TOKEN) return;

  const text =
    `🤖 <b>AI Прогноз вышел!</b>\n\n` +
    `⚽ <b>${prediction.homeTeam} vs ${prediction.awayTeam}</b>\n` +
    `🏆 ${prediction.league}\n\n` +
    `📊 Прогноз: <b>${prediction.prediction}</b>\n` +
    `💰 Коэффициент: <b>${prediction.odds.toFixed(2)}</b>\n` +
    `🎯 Уверенность: <b>${Math.round(prediction.confidence * 100)}%</b>`;

  const users = await db.select({
    telegramId: usersTable.telegramId,
    notificationsAi: usersTable.notificationsAi,
  }).from(usersTable);

  for (const user of users) {
    const silent = !user.notificationsAi;
    await sendMessage(user.telegramId, text, silent);
  }
}

export async function notifyNewAuthorPrediction(prediction: {
  homeTeam: string;
  awayTeam: string;
  league: string;
  prediction: string;
  odds: number;
  stake: number;
}) {
  if (!BOT_TOKEN) return;

  const text =
    `✍️ <b>Авторский прогноз вышел!</b>\n\n` +
    `⚽ <b>${prediction.homeTeam} vs ${prediction.awayTeam}</b>\n` +
    `🏆 ${prediction.league}\n\n` +
    `📊 Прогноз: <b>${prediction.prediction}</b>\n` +
    `💰 Коэффициент: <b>${prediction.odds.toFixed(2)}</b>\n` +
    `🎯 Уверенность: <b>${prediction.stake}%</b>`;

  const users = await db.select({
    telegramId: usersTable.telegramId,
    notificationsAuthor: usersTable.notificationsAuthor,
  }).from(usersTable);

  for (const user of users) {
    const silent = !user.notificationsAuthor;
    await sendMessage(user.telegramId, text, silent);
  }
}
