const path = require('path');

// Resolve npm packages from backend/node_modules when bot is in a separate folder
module.paths.unshift(path.join(__dirname, '..', 'backend', 'node_modules'));

try {
  require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
} catch {
  // dotenv already loaded by server.js when bot is imported from there
}

const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://your-domain.com';

if (!BOT_TOKEN) {
  console.error('[bot] BOT_TOKEN is required');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'путешественник';

  bot.sendMessage(msg.chat.id,
    `Привет, ${name}! 🌍✈️\n\n` +
    `Я — *TravelBlog AI*, твой помощник в создании контента о путешествиях по России.\n\n` +
    `Что я умею:\n` +
    `📝 Генерировать посты для блога\n` +
    `🗺️ Составлять мини-гиды\n` +
    `💬 Писать отзывы\n` +
    `📱 Создавать сценарии Stories\n` +
    `🖼️ Готовить промпты для генерации изображений\n\n` +
    `Нажми кнопку ниже, чтобы открыть приложение 👇`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Открыть TravelBlog AI', web_app: { url: WEBAPP_URL } },
        ]],
      },
    },
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📖 *Как пользоваться:*\n\n` +
    `1. Нажми «Открыть TravelBlog AI»\n` +
    `2. Выбери место в России\n` +
    `3. Настрой тип контента, стиль, аудиторию\n` +
    `4. Нажми «Сгенерировать»\n` +
    `5. Копируй, сохраняй, делись!\n\n` +
    `🆓 Бесплатно: 14 генераций в день\n` +
    `⭐ Premium Telegram: без ограничений`,
    { parse_mode: 'Markdown' },
  );
});

bot.on('polling_error', (err) => {
  console.error('[bot] polling error:', err.code, err.message);
});

console.log('[bot] @TravelBlog AI bot is running');

module.exports = bot;
