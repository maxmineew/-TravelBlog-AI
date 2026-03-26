require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { validateInitData, devUser } = require('./auth');
const { buildPrompt, buildImagePrompt, createProvider, createImageProvider } = require('./ai');

const places = require('../data/russia_places.json');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const FREE_LIMIT = parseInt(process.env.FREE_DAILY_LIMIT, 10) || 14;
const IS_DEV = process.env.NODE_ENV !== 'production';

const placesMap = Object.fromEntries(places.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// In-memory stores (замените на Redis/Postgres в production)
// ---------------------------------------------------------------------------

const usage = new Map();     // userId → { date: 'YYYY-MM-DD', count: number }
const history = new Map();   // userId → [{ id, placeId, ... }]

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getUsage(userId) {
  const today = todayStr();
  let rec = usage.get(userId);
  if (!rec || rec.date !== today) {
    rec = { date: today, count: 0 };
    usage.set(userId, rec);
  }
  return rec;
}

function addHistory(userId, item) {
  let arr = history.get(userId);
  if (!arr) {
    arr = [];
    history.set(userId, arr);
  }
  arr.unshift(item);
  if (arr.length > 50) arr.length = 50;
}

// ---------------------------------------------------------------------------
// AI Provider
// ---------------------------------------------------------------------------

const ai = createProvider();
const imageAi = createImageProvider();

// ---------------------------------------------------------------------------
// Express App
// ---------------------------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, попробуйте через минуту' },
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function authMiddleware(req, res, next) {
  const initData = req.headers['x-init-data'] || req.body?.initData || '';
  const user = validateInitData(initData, BOT_TOKEN);

  if (user) {
    req.tgUser = user;
    return next();
  }

  if (IS_DEV) {
    req.tgUser = devUser();
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', places: places.length, provider: process.env.AI_PROVIDER || 'mock' });
});

app.get('/api/places', (_req, res) => {
  res.json(places);
});

app.post('/api/generate', authMiddleware, async (req, res) => {
  try {
    const { placeId, contentType, style, audience, language } = req.body;

    if (!placeId || !contentType) {
      return res.status(400).json({ error: 'placeId and contentType are required' });
    }

    const place = placesMap[placeId];
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const validTypes = ['post', 'guide', 'review', 'stories', 'image'];
    if (!validTypes.includes(contentType)) {
      return res.status(400).json({ error: `Invalid contentType. Valid: ${validTypes.join(', ')}` });
    }

    const userId = req.tgUser.id;
    const isPremium = req.tgUser.isPremium;
    const rec = getUsage(userId);

    if (!isPremium && rec.count >= FREE_LIMIT) {
      return res.status(429).json({
        error: 'daily_limit',
        message: `Лимит ${FREE_LIMIT} генераций в день исчерпан`,
        limit: FREE_LIMIT,
        used: rec.count,
      });
    }

    const effectiveStyle = style || 'romantic';
    const effectiveAudience = audience || 'couple';
    const effectiveLang = language || 'ru';

    // Image generation via Kandinsky
    if (contentType === 'image' && imageAi) {
      const imgPrompt = buildImagePrompt(place, effectiveStyle);
      const imageBase64 = await imageAi.generateImage(imgPrompt);

      rec.count += 1;

      const historyItem = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        placeId,
        placeName: place.name,
        contentType,
        style: effectiveStyle,
        audience: effectiveAudience,
        language: effectiveLang,
        preview: `🖼️ ${place.name} — изображение`,
        result: imgPrompt,
        isImage: true,
        createdAt: new Date().toISOString(),
      };

      addHistory(userId, historyItem);

      return res.json({
        isImage: true,
        image: imageBase64,
        prompt: imgPrompt,
        usage: { used: rec.count, limit: isPremium ? null : FREE_LIMIT },
        historyId: historyItem.id,
      });
    }

    // Text generation (post / guide / review / stories / image-fallback)
    const prompt = buildPrompt(
      place,
      contentType,
      effectiveStyle,
      effectiveAudience,
      effectiveLang,
    );

    const result = await ai.generate(prompt);

    rec.count += 1;

    const historyItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      placeId,
      placeName: place.name,
      contentType,
      style: effectiveStyle,
      audience: effectiveAudience,
      language: effectiveLang,
      preview: result.slice(0, 120),
      result,
      createdAt: new Date().toISOString(),
    };

    addHistory(userId, historyItem);

    res.json({
      result,
      usage: { used: rec.count, limit: isPremium ? null : FREE_LIMIT },
      historyId: historyItem.id,
    });
  } catch (err) {
    console.error('[generate]', err);
    res.status(500).json({ error: 'Generation failed', details: err.message });
  }
});

app.get('/api/history', authMiddleware, (req, res) => {
  const userId = req.tgUser.id;
  const items = (history.get(userId) || []).slice(0, 10);
  res.json(items);
});

app.get('/api/usage', authMiddleware, (req, res) => {
  const userId = req.tgUser.id;
  const isPremium = req.tgUser.isPremium;
  const rec = getUsage(userId);
  res.json({ used: rec.count, limit: isPremium ? null : FREE_LIMIT });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function startServer() {
  app.listen(PORT, () => {
    console.log(`[server] http://localhost:${PORT}`);
    console.log(`[server] ENV=${IS_DEV ? 'development' : 'production'}`);
  });
}

// Если запущен напрямую — стартуем сервер + бот
if (require.main === module) {
  startServer();

  if (BOT_TOKEN && BOT_TOKEN !== '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11') {
    try {
      require('../bot/bot');
      console.log('[bot] started');
    } catch (err) {
      console.error('[bot] failed to start:', err.message);
    }
  } else {
    console.log('[bot] BOT_TOKEN not set, bot disabled');
  }
}

module.exports = { app, startServer };
