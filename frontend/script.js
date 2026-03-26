/* ===================================================================
   TravelBlog AI — Mini App Frontend
   =================================================================== */

(function () {
  'use strict';

  // ----- Telegram WebApp ---------------------------------------------------

  const tg = window.Telegram?.WebApp;
  const isTg = !!(tg && tg.initData);

  if (isTg) {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation?.();
  }

  function haptic(type) {
    if (!isTg) return;
    try {
      if (type === 'light') tg.HapticFeedback.impactOccurred('light');
      else if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      else if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
      else tg.HapticFeedback.impactOccurred('medium');
    } catch {}
  }

  // ----- State -------------------------------------------------------------

  const state = {
    places: [],
    selectedPlace: null,
    contentType: 'post',
    style: 'romantic',
    audience: 'couple',
    language: 'ru',
    currentResult: null,
    history: [],
    favorites: [],
    usage: { used: 0, limit: 14 },
    currentScreen: 'places',
  };

  // ----- DOM refs ----------------------------------------------------------

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const dom = {
    app: $('#app'),
    btnBack: $('#btn-back'),
    btnHistory: $('#btn-history'),
    btnFavorites: $('#btn-favorites'),
    headerTitle: $('#header-title'),
    limitText: $('#limit-text'),
    limitFill: $('#limit-fill'),
    search: $('#search'),
    placesGrid: $('#places-grid'),
    selectedPlace: $('#selected-place'),
    btnGenerate: $('#btn-generate'),
    resultMeta: $('#result-meta'),
    resultImageWrap: $('#result-image-wrap'),
    resultImage: $('#result-image'),
    resultContent: $('#result-content'),
    btnCopy: $('#btn-copy'),
    btnDownload: $('#btn-download'),
    btnShare: $('#btn-share'),
    btnFav: $('#btn-fav'),
    btnNew: $('#btn-new'),
    historyList: $('#history-list'),
    historyEmpty: $('#history-empty'),
    favoritesList: $('#favorites-list'),
    favoritesEmpty: $('#favorites-empty'),
    loading: $('#loading'),
    loadingText: $('#loading-text'),
    toast: $('#toast'),
  };

  // ----- API ---------------------------------------------------------------

  const API_BASE = '';

  async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (isTg && tg.initData) headers['X-Init-Data'] = tg.initData;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(API_BASE + path, opts);
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  }

  // ----- Navigation --------------------------------------------------------

  function showScreen(name) {
    $$('.screen').forEach((s) => s.classList.remove('active'));
    const el = $(`#screen-${name}`);
    if (el) el.classList.add('active');

    state.currentScreen = name;

    dom.btnBack.classList.toggle('hidden', name === 'places');

    const titles = {
      places: 'TravelBlog AI',
      config: state.selectedPlace?.name || 'Настройки',
      result: 'Результат',
      history: 'История',
      favorites: 'Избранное',
    };
    dom.headerTitle.textContent = titles[name] || 'TravelBlog AI';

    if (isTg) {
      if (name === 'places') {
        tg.BackButton?.hide();
      } else {
        tg.BackButton?.show();
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    haptic('light');
    const map = {
      config: 'places',
      result: 'config',
      history: 'places',
      favorites: 'places',
    };
    showScreen(map[state.currentScreen] || 'places');
  }

  // ----- Places ------------------------------------------------------------

  const PLACE_ICONS = {
    sochi: '🏖️', spb: '🏛️', kazan: '🕌', baikal: '🏔️', kaliningrad: '⚓',
    nizhny: '🌉', altai: '🏔️', kamchatka: '🌋', crimea: '🏰', moscow: '🏙️',
    yaroslavl: '⛪', vladivostok: '🌊', murmansk: '🌌', karelia: '🛶',
    kavminvody: '💧', suzdal: '🏡', dombay: '⛷️', arkhyz: '🔭',
    veliky_novgorod: '🏰', vyborg: '🏰', sheregesh: '🏂', dagestan: '🏜️',
    plyos: '🎨', kirzhach: '🪂', vladimir: '👑', linda: '🌲', barnaul: '🏭',
  };

  async function loadPlaces() {
    try {
      state.places = await api('GET', '/api/places');
    } catch {
      const res = await fetch('russia_places.json').catch(() => null);
      if (res?.ok) state.places = await res.json();
    }
    renderPlaces();
  }

  function renderPlaces(filter = '') {
    const q = filter.toLowerCase().trim();
    const list = q
      ? state.places.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.region.toLowerCase().includes(q),
        )
      : state.places;

    dom.placesGrid.innerHTML = list
      .map(
        (p) => `
      <div class="place-card" data-id="${p.id}">
        <div class="place-emoji">${PLACE_ICONS[p.id] || '📍'}</div>
        <div class="place-name">${p.name}</div>
        <div class="place-region">${p.region}</div>
      </div>`,
      )
      .join('');
  }

  function selectPlace(id) {
    const place = state.places.find((p) => p.id === id);
    if (!place) return;

    haptic();
    state.selectedPlace = place;

    dom.selectedPlace.innerHTML = `
      <div class="hero-name">${PLACE_ICONS[place.id] || '📍'} ${place.name}</div>
      <div class="hero-region">${place.region}</div>
      <div class="hero-tags">
        ${place.season.map((s) => `<span class="hero-tag">${s}</span>`).join('')}
        <span class="hero-tag">${place.prices}</span>
      </div>`;

    $$('.chips .chip').forEach((c) => c.classList.remove('selected'));
    setDefault('contentType', 'post');
    setDefault('style', 'romantic');
    setDefault('audience', 'couple');
    setDefault('language', 'ru');

    showScreen('config');
  }

  function setDefault(group, value) {
    const container = $(`.chips[data-group="${group}"]`);
    if (!container) return;
    const chip = container.querySelector(`[data-value="${value}"]`);
    if (chip) chip.classList.add('selected');
    state[group] = value;
  }

  // ----- Chips -------------------------------------------------------------

  function handleChipClick(e) {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    haptic('light');

    const group = chip.parentElement.dataset.group;
    const value = chip.dataset.value;
    if (!group || !value) return;

    chip.parentElement
      .querySelectorAll('.chip')
      .forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
    state[group] = value;
  }

  // ----- Generate ----------------------------------------------------------

  async function generate() {
    if (!state.selectedPlace) return;

    haptic();
    dom.btnGenerate.disabled = true;
    dom.loading.classList.remove('hidden');

    const isImage = state.contentType === 'image';
    dom.loadingText.textContent = isImage
      ? 'Генерируем изображение... (до 60 сек)'
      : 'Генерируем контент...';

    try {
      const data = await api('POST', '/api/generate', {
        placeId: state.selectedPlace.id,
        contentType: state.contentType,
        style: state.style,
        audience: state.audience,
        language: state.language,
      });

      state.currentResult = {
        id: data.historyId,
        placeId: state.selectedPlace.id,
        placeName: state.selectedPlace.name,
        contentType: state.contentType,
        style: state.style,
        audience: state.audience,
        language: state.language,
        result: data.isImage ? data.prompt : data.result,
        isImage: !!data.isImage,
        image: data.image || null,
        createdAt: new Date().toISOString(),
      };

      if (data.usage) {
        state.usage = data.usage;
        updateLimit();
      }

      renderResult();
      showScreen('result');
      haptic('success');
    } catch (err) {
      haptic('error');
      if (err.error === 'daily_limit') {
        toast('Лимит генераций исчерпан на сегодня');
      } else {
        toast(err.message || 'Ошибка генерации');
      }
    } finally {
      dom.btnGenerate.disabled = false;
      dom.loading.classList.add('hidden');
    }
  }

  // ----- Result ------------------------------------------------------------

  const TYPE_LABELS = {
    post: '📝 Пост',
    guide: '🗺️ Гид',
    review: '💬 Отзыв',
    stories: '📱 Сторис',
    image: '🖼️ Изображение',
  };
  const STYLE_LABELS = {
    romantic: '💕 Романтичный',
    family: '👨‍👩‍👧 Семейный',
    extreme: '⚡ Экстрим',
    budget: '💰 Бюджетный',
  };

  function renderResult() {
    const r = state.currentResult;
    if (!r) return;

    dom.resultMeta.innerHTML = `
      <span class="meta-tag">${r.placeName}</span>
      <span class="meta-tag">${TYPE_LABELS[r.contentType] || r.contentType}</span>
      <span class="meta-tag">${STYLE_LABELS[r.style] || r.style}</span>`;

    if (r.isImage && r.image) {
      dom.resultImageWrap.classList.remove('hidden');
      dom.resultImage.src = 'data:image/png;base64,' + r.image;
      dom.resultContent.classList.add('compact');
      dom.resultContent.innerHTML =
        '<div class="result-prompt-label">Prompt</div>' + escapeHtml(r.result);
    } else {
      dom.resultImageWrap.classList.add('hidden');
      dom.resultImage.src = '';
      dom.resultContent.classList.remove('compact');
      dom.resultContent.textContent = r.result;
    }

    const isFav = state.favorites.some((f) => f.id === r.id);
    dom.btnFav.classList.toggle('favorited', isFav);

    addToHistory(r);
  }

  // ----- Copy / Download / Share -------------------------------------------

  async function copyResult() {
    if (!state.currentResult) return;
    haptic('light');

    const r = state.currentResult;

    if (r.isImage && r.image) {
      try {
        const byteStr = atob(r.image);
        const arr = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
        const blob = new Blob([arr], { type: 'image/png' });
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Изображение скопировано!');
        return;
      } catch {
        // fallback: copy prompt instead
      }
    }

    try {
      await navigator.clipboard.writeText(r.result);
      toast('Скопировано!');
    } catch {
      fallbackCopy(r.result);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Скопировано!');
  }

  function downloadResult() {
    if (!state.currentResult) return;
    haptic('light');
    const r = state.currentResult;

    if (r.isImage && r.image) {
      const a = document.createElement('a');
      a.href = 'data:image/png;base64,' + r.image;
      a.download = `${r.placeName}_${r.style}.png`;
      a.click();
      toast('Изображение скачано');
      return;
    }

    const blob = new Blob([r.result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${r.placeName}_${r.contentType}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Файл скачан');
  }

  async function shareResult() {
    if (!state.currentResult) return;
    haptic('light');
    const r = state.currentResult;

    if (r.isImage && r.image && navigator.share) {
      try {
        const byteStr = atob(r.image);
        const arr = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
        const file = new File([arr], `${r.placeName}.png`, { type: 'image/png' });
        await navigator.share({ title: `TravelBlog AI: ${r.placeName}`, files: [file] });
        return;
      } catch {}
    }

    const text = `${r.placeName} — ${TYPE_LABELS[r.contentType]}\n\n${r.result}`;
    if (navigator.share) {
      navigator.share({ title: `TravelBlog AI: ${r.placeName}`, text }).catch(() => {});
    } else {
      fallbackCopy(text);
      toast('Текст скопирован для вставки');
    }
  }

  // ----- Favorites ---------------------------------------------------------

  function toggleFavorite() {
    if (!state.currentResult) return;
    haptic();

    const idx = state.favorites.findIndex((f) => f.id === state.currentResult.id);
    if (idx >= 0) {
      state.favorites.splice(idx, 1);
      dom.btnFav.classList.remove('favorited');
      toast('Убрано из избранного');
    } else {
      state.favorites.unshift({ ...state.currentResult });
      dom.btnFav.classList.add('favorited');
      toast('Добавлено в избранное ⭐');
    }
    saveFavorites();
  }

  function saveFavorites() {
    try {
      localStorage.setItem('tba_favorites', JSON.stringify(state.favorites.slice(0, 50)));
    } catch {}

    if (isTg && tg.CloudStorage) {
      const ids = state.favorites.map((f) => f.id).slice(0, 50);
      tg.CloudStorage.setItem('fav_ids', JSON.stringify(ids), () => {});
    }
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem('tba_favorites');
      if (raw) state.favorites = JSON.parse(raw);
    } catch {}
  }

  function renderFavorites() {
    if (!state.favorites.length) {
      dom.favoritesList.innerHTML = '';
      dom.favoritesEmpty.classList.remove('hidden');
      return;
    }
    dom.favoritesEmpty.classList.add('hidden');
    dom.favoritesList.innerHTML = state.favorites.map(historyCardHTML).join('');
  }

  // ----- History -----------------------------------------------------------

  function addToHistory(item) {
    const exists = state.history.findIndex((h) => h.id === item.id);
    if (exists >= 0) state.history.splice(exists, 1);
    const stored = { ...item };
    delete stored.image; // base64 too large for localStorage
    state.history.unshift(stored);
    if (state.history.length > 10) state.history.length = 10;
    saveHistory();
  }

  function saveHistory() {
    try {
      localStorage.setItem('tba_history', JSON.stringify(state.history));
    } catch {}
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem('tba_history');
      if (raw) state.history = JSON.parse(raw);
    } catch {}
  }

  function renderHistory() {
    if (!state.history.length) {
      dom.historyList.innerHTML = '';
      dom.historyEmpty.classList.remove('hidden');
      return;
    }
    dom.historyEmpty.classList.add('hidden');
    dom.historyList.innerHTML = state.history.map(historyCardHTML).join('');
  }

  function historyCardHTML(item) {
    const d = new Date(item.createdAt);
    const dateStr = d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const preview = (item.result || item.preview || '').slice(0, 100);

    return `
      <div class="history-card" data-history-id="${item.id}">
        <div class="hc-top">
          <span class="hc-place">${item.placeName}</span>
          <span class="hc-type">${TYPE_LABELS[item.contentType] || item.contentType}</span>
        </div>
        <div class="hc-preview">${escapeHtml(preview)}…</div>
        <div class="hc-date">${dateStr}</div>
      </div>`;
  }

  function openHistoryItem(id) {
    const item =
      state.history.find((h) => h.id === id) ||
      state.favorites.find((f) => f.id === id);
    if (!item) return;

    haptic('light');
    state.currentResult = { ...item };
    renderResult();
    showScreen('result');
  }

  // ----- Limit -------------------------------------------------------------

  async function fetchUsage() {
    try {
      const data = await api('GET', '/api/usage');
      state.usage = data;
      updateLimit();
    } catch {}
  }

  function updateLimit() {
    const { used, limit } = state.usage;
    if (limit === null) {
      dom.limitText.textContent = '⭐ Premium — без лимита';
      dom.limitFill.style.width = '100%';
      dom.limitFill.className = '';
      return;
    }

    const remaining = Math.max(0, limit - used);
    dom.limitText.textContent = `Осталось: ${remaining} / ${limit}`;

    const pct = ((limit - used) / limit) * 100;
    dom.limitFill.style.width = Math.max(0, pct) + '%';
    dom.limitFill.classList.remove('warn', 'danger');
    if (pct <= 15) dom.limitFill.classList.add('danger');
    else if (pct <= 40) dom.limitFill.classList.add('warn');
  }

  // ----- Toast -------------------------------------------------------------

  let toastTimer;
  function toast(msg) {
    clearTimeout(toastTimer);
    dom.toast.textContent = msg;
    dom.toast.classList.remove('hidden');
    requestAnimationFrame(() => dom.toast.classList.add('show'));
    toastTimer = setTimeout(() => {
      dom.toast.classList.remove('show');
      setTimeout(() => dom.toast.classList.add('hidden'), 300);
    }, 2200);
  }

  // ----- Helpers -----------------------------------------------------------

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ----- Events ------------------------------------------------------------

  function setupEvents() {
    dom.btnBack.addEventListener('click', goBack);
    if (isTg) tg.BackButton?.onClick(goBack);

    dom.btnHistory.addEventListener('click', () => {
      haptic('light');
      renderHistory();
      showScreen('history');
    });

    dom.btnFavorites.addEventListener('click', () => {
      haptic('light');
      renderFavorites();
      showScreen('favorites');
    });

    dom.search.addEventListener('input', (e) => renderPlaces(e.target.value));

    dom.placesGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.place-card');
      if (card) selectPlace(card.dataset.id);
    });

    $$('.chips').forEach((c) => c.addEventListener('click', handleChipClick));

    dom.btnGenerate.addEventListener('click', generate);

    dom.btnCopy.addEventListener('click', copyResult);
    dom.btnDownload.addEventListener('click', downloadResult);
    dom.btnShare.addEventListener('click', shareResult);
    dom.btnFav.addEventListener('click', toggleFavorite);

    dom.btnNew.addEventListener('click', () => {
      haptic('light');
      showScreen('config');
    });

    dom.historyList.addEventListener('click', (e) => {
      const card = e.target.closest('.history-card');
      if (card) openHistoryItem(card.dataset.historyId);
    });

    dom.favoritesList.addEventListener('click', (e) => {
      const card = e.target.closest('.history-card');
      if (card) openHistoryItem(card.dataset.historyId);
    });
  }

  // ----- Init --------------------------------------------------------------

  function init() {
    loadHistory();
    loadFavorites();
    loadPlaces();
    fetchUsage();
    setupEvents();
    updateLimit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
