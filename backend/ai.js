const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Построение промпта
// ---------------------------------------------------------------------------

const STYLE_MAP = {
  romantic: 'романтичный, вдохновляющий, с красивыми метафорами',
  family: 'тёплый семейный, с заботой о детях и комфорте',
  extreme: 'динамичный, адреналиновый, для любителей приключений',
  budget: 'практичный, с акцентом на экономию и лайфхаки',
};

const AUDIENCE_MAP = {
  couple: 'пара влюблённых',
  family: 'семья с детьми',
  solo: 'самостоятельный путешественник',
};

const TYPE_INSTRUCTIONS = {
  post: `Напиши пост для тревел-блога (200–500 слов).
Структура: цепляющий заголовок, вступление, основная часть с личными впечатлениями, призыв к действию.
Добавь уместные эмодзи и 5–8 хэштегов в конце.`,

  guide: `Напиши мини-гид из 5–7 ключевых мест/точек.
Для каждой точки дай: название, описание (2–3 предложения), один практический совет.
Добавь вступление и завершение.`,

  review: `Напиши живой отзыв от первого лица.
Передай эмоции, конкретные детали, что понравилось и что можно улучшить.
Дай оценку по 10-балльной шкале и резюме.`,

  stories: `Напиши сценарий для 7–10 слайдов Stories.
Каждый слайд: короткий текст (1–2 предложения) + идея визуала.
Формат: «Слайд N: [текст] | Визуал: [описание]».`,

  image: `Сгенерируй 3 подробных prompt'а для AI-генерации изображений (на английском).
Каждый prompt должен содержать: описание сцены, стиль, освещение, атмосферу, уровень детализации.
Подходит для Midjourney, Kandinsky, Stable Diffusion.
Формат: «Prompt 1: ...», «Prompt 2: ...», «Prompt 3: ...».`,
};

function buildPrompt(place, contentType, style, audience, language) {
  const langNote =
    language === 'en'
      ? 'Write the ENTIRE response in English.'
      : 'Пиши на русском языке.';

  return `Ты — профессиональный тревел-блогер и контент-мейкер.

Место: ${place.name} (${place.region})
Ключевые факты: ${place.facts.join('; ')}
Активности: ${place.activities.join(', ')}
Сезоны: ${place.season.join(', ')}
Ориентировочные цены: ${place.prices}

Стиль подачи: ${STYLE_MAP[style] || style}
Целевая аудитория: ${AUDIENCE_MAP[audience] || audience}

Задание:
${TYPE_INSTRUCTIONS[contentType] || 'Напиши интересный пост.'}

${langNote}`;
}

// ---------------------------------------------------------------------------
// GigaChat Provider
// ---------------------------------------------------------------------------

class GigaChatProvider {
  constructor(clientId, clientSecret, authKey) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.authKey = authKey;
    this.token = null;
    this.tokenExpiresAt = 0;
    this.authUrl = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
    this.apiUrl =
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
    this.scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS';
    this._refreshPromise = null;
  }

  _getCredentials() {
    if (this.authKey) return this.authKey;
    return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
  }

  async refreshToken() {
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = (async () => {
      const credentials = this._getCredentials();

      const res = await fetch(this.authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          Authorization: `Basic ${credentials}`,
          RqUID: crypto.randomUUID(),
        },
        body: `scope=${this.scope}`,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`GigaChat auth ${res.status}: ${text}`);
      }

      const data = await res.json();
      this.token = data.access_token;
      this.tokenExpiresAt = Date.now() + 28 * 60 * 1000;
      console.log('[AI] GigaChat token refreshed, expires in 28m');
    })();

    try {
      await this._refreshPromise;
    } finally {
      this._refreshPromise = null;
    }
  }

  async ensureToken() {
    if (!this.token || Date.now() >= this.tokenExpiresAt) {
      await this.refreshToken();
    }
  }

  async generate(prompt, attempt = 0) {
    await this.ensureToken();

    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        model: 'GigaChat',
        messages: [
          {
            role: 'system',
            content: 'Ты — профессиональный тревел-блогер и контент-мейкер.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.87,
        max_tokens: 2048,
      }),
    });

    if (res.status === 401 && attempt < 1) {
      this.token = null;
      return this.generate(prompt, attempt + 1);
    }

    if (res.status === 429 && attempt < 3) {
      const delay = (attempt + 1) * 3000;
      console.log(`[AI] GigaChat 429 rate-limit, retry in ${delay / 1000}s (attempt ${attempt + 1}/3)`);
      await new Promise((r) => setTimeout(r, delay));
      return this.generate(prompt, attempt + 1);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GigaChat API ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }
}

// ---------------------------------------------------------------------------
// YandexGPT Provider
// ---------------------------------------------------------------------------

class YandexGPTProvider {
  constructor(apiKey, folderId) {
    this.apiKey = apiKey;
    this.folderId = folderId;
    this.apiUrl =
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
  }

  async generate(prompt) {
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Api-Key ${this.apiKey}`,
        'x-folder-id': this.folderId,
      },
      body: JSON.stringify({
        modelUri: `gpt://${this.folderId}/yandexgpt-lite/latest`,
        completionOptions: {
          stream: false,
          temperature: 0.7,
          maxTokens: '2048',
        },
        messages: [
          {
            role: 'system',
            text: 'Ты — профессиональный тревел-блогер и контент-мейкер.',
          },
          { role: 'user', text: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`YandexGPT API ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.result.alternatives[0].message.text;
  }
}

// ---------------------------------------------------------------------------
// Mock Provider (для разработки без ключей)
// ---------------------------------------------------------------------------

class MockProvider {
  async generate(prompt) {
    const lines = prompt.split('\n');
    const placeLine = lines.find((l) => l.startsWith('Место:')) || '';
    const place = placeLine.replace('Место:', '').trim();

    await new Promise((r) => setTimeout(r, 800));

    if (prompt.includes('image') || prompt.includes('Prompt')) {
      return `Prompt 1: Breathtaking aerial view of ${place}, golden hour sunlight, dramatic clouds, ultra-detailed landscape photography, 8k resolution, cinematic composition

Prompt 2: Cozy travel scene in ${place}, local architecture, warm ambient lighting, depth of field, street photography style, Fujifilm color grading

Prompt 3: Epic panoramic vista of ${place}, foreground wildflowers, misty mountains in background, National Geographic style, vibrant natural colors, sharp detail`;
    }

    return `✈️ **${place} — место, которое покоряет с первого взгляда!**

Здесь каждый уголок дышит историей и красотой. Представьте себе: утренний туман рассеивается, открывая потрясающий вид, который запомнится на всю жизнь.

🏛 **Что посмотреть:**
• Главные достопримечательности — атмосфера здесь непередаваемая
• Местная кухня — обязательно попробуйте региональные блюда
• Природные локации — фотографии получаются невероятными

💡 **Совет:** приезжайте на рассвете — туристов ещё нет, а свет идеален для фото.

📌 Сохраняйте и делитесь с друзьями!

#Россия #Путешествия #${place.replace(/\s+/g, '')} #ТревелБлог #Туризм #Отдых`;
  }
}

// ---------------------------------------------------------------------------
// Image Prompt Builder
// ---------------------------------------------------------------------------

const IMAGE_STYLE_MAP = {
  romantic: 'romantic warm golden hour, soft bokeh, dreamy pastel tones, love atmosphere',
  family: 'bright cheerful scene, warm sunlight, friendly joyful atmosphere, vivid colors',
  extreme: 'dramatic epic composition, intense lighting, dynamic action angle, bold contrast, adrenaline',
  budget: 'authentic local atmosphere, street-level perspective, natural light, documentary travel style',
};

function buildImagePrompt(place, style) {
  const modifier = IMAGE_STYLE_MAP[style] || '';
  return `${place.imagePrompt}, ${modifier}, masterpiece, best quality, highly detailed`;
}

// ---------------------------------------------------------------------------
// YandexART — генерация изображений (Yandex Cloud)
// ---------------------------------------------------------------------------

class YandexArtProvider {
  constructor(apiKey, folderId) {
    this.apiKey = apiKey;
    this.folderId = folderId;
    this.genUrl =
      'https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync';
    this.opsUrl = 'https://llm.api.cloud.yandex.net/operations';
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${this.apiKey}`,
      'x-folder-id': this.folderId,
    };
  }

  async generateImage(prompt) {
    const res = await fetch(this.genUrl, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        modelUri: `art://${this.folderId}/yandex-art/latest`,
        generationOptions: {
          seed: Math.floor(Math.random() * 100000),
          aspectRatio: { widthRatio: '1', heightRatio: '1' },
        },
        messages: [{ weight: '1', text: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`YandexART submit ${res.status}: ${text}`);
    }

    const { id } = await res.json();

    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const opRes = await fetch(`${this.opsUrl}/${id}`, {
        headers: { Authorization: `Api-Key ${this.apiKey}` },
      });
      if (!opRes.ok) continue;

      const op = await opRes.json();
      if (op.done && op.response) {
        return op.response.image; // base64 string
      }
      if (op.error) {
        throw new Error(`YandexART: ${op.error.message || 'generation error'}`);
      }
    }
    throw new Error('YandexART generation timeout (120s)');
  }
}

// ---------------------------------------------------------------------------
// GigaChat Image — генерация изображений через GigaChat API
// ---------------------------------------------------------------------------

class GigaChatImageProvider {
  constructor(clientId, clientSecret, authKey) {
    this.gc = new GigaChatProvider(clientId, clientSecret, authKey);
    this.filesUrl =
      'https://gigachat.devices.sberbank.ru/api/v1/files';
  }

  async generateImage(prompt, attempt = 0) {
    await this.gc.ensureToken();

    const res = await fetch(this.gc.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.gc.token}`,
      },
      body: JSON.stringify({
        model: 'GigaChat',
        messages: [
          { role: 'system', content: 'Ты — талантливый художник. Создай изображение по описанию.' },
          { role: 'user', content: `Нарисуй изображение: ${prompt}` },
        ],
        function_call: 'auto',
      }),
    });

    if (res.status === 429 && attempt < 3) {
      const delay = (attempt + 1) * 3000;
      console.log(`[AI] GigaChat image 429 rate-limit, retry in ${delay / 1000}s (attempt ${attempt + 1}/3)`);
      await new Promise((r) => setTimeout(r, delay));
      return this.generateImage(prompt, attempt + 1);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GigaChat image ${res.status}: ${text}`);
    }

    const data = await res.json();
    const content = data.choices[0]?.message?.content || '';

    // GigaChat returns <img src="file_uuid" ...> in response text
    const match = content.match(/<img\s+src="([^"]+)"/);
    if (!match) {
      throw new Error('GigaChat не вернул изображение (возможно, модель не поддерживает генерацию картинок в вашем тарифе)');
    }

    const fileId = match[1];

    // Download the generated image
    const imgRes = await fetch(`${this.filesUrl}/${fileId}/content`, {
      headers: {
        Authorization: `Bearer ${this.gc.token}`,
        Accept: 'application/jpg',
      },
    });

    if (!imgRes.ok) {
      throw new Error(`GigaChat file download ${imgRes.status}`);
    }

    const buffer = await imgRes.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }
}

// ---------------------------------------------------------------------------
// Фабрика провайдера изображений
// ---------------------------------------------------------------------------

function createImageProvider() {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase();

  // YandexART
  if (provider === 'yandexart' || provider === 'auto') {
    const key = process.env.YANDEX_API_KEY;
    const folder = process.env.YANDEX_FOLDER_ID;
    if (key && folder && key !== 'your_api_key') {
      console.log('[AI] YandexART image provider ready');
      return new YandexArtProvider(key, folder);
    }
  }

  // GigaChat images (fallback — uses existing GigaChat credentials)
  if (provider === 'gigachat' || provider === 'auto') {
    const authKey = process.env.GIGACHAT_AUTH_KEY;
    const id = process.env.GIGACHAT_CLIENT_ID;
    const secret = process.env.GIGACHAT_CLIENT_SECRET;
    if (authKey || (id && secret && id !== 'your_client_id')) {
      console.log('[AI] GigaChat image provider ready');
      return new GigaChatImageProvider(id, secret, authKey);
    }
  }

  console.log('[AI] No image provider configured → image generation disabled');
  return null;
}

// ---------------------------------------------------------------------------
// Фабрика текстовых провайдеров
// ---------------------------------------------------------------------------

function createProvider() {
  const name = (process.env.AI_PROVIDER || 'mock').toLowerCase();

  if (name === 'gigachat') {
    const authKey = process.env.GIGACHAT_AUTH_KEY;
    const id = process.env.GIGACHAT_CLIENT_ID;
    const secret = process.env.GIGACHAT_CLIENT_SECRET;
    if (!authKey && (!id || !secret)) {
      console.warn('[AI] GigaChat credentials missing → fallback to mock');
      return new MockProvider();
    }
    console.log('[AI] Using GigaChat provider');
    return new GigaChatProvider(id, secret, authKey);
  }

  if (name === 'yandexgpt') {
    const key = process.env.YANDEX_API_KEY;
    const folder = process.env.YANDEX_FOLDER_ID;
    if (!key || !folder) {
      console.warn('[AI] YandexGPT credentials missing → fallback to mock');
      return new MockProvider();
    }
    console.log('[AI] Using YandexGPT provider');
    return new YandexGPTProvider(key, folder);
  }

  console.log('[AI] Using Mock provider (set AI_PROVIDER in .env)');
  return new MockProvider();
}

module.exports = { buildPrompt, buildImagePrompt, createProvider, createImageProvider };
