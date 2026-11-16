import {
  createIcons, VolumeX, Volume2, CircleHelp, Maximize, Minimize,
  Globe2, Navigation, Search, Plane, ArrowUpRight, MapPin,
  PlaneTakeoff, ArrowRight, Orbit, Plus, Minus, Sun, Moon,
  LocateFixed, Mouse, Sparkles, X, CircleDot, Check, BookOpen,
} from 'lucide';
import { LANDMARKS } from './landmarks.js';

const iconSet = { VolumeX, Volume2, CircleHelp, Maximize, Minimize, Globe2, Navigation, Search, Plane, ArrowUpRight, MapPin, PlaneTakeoff, ArrowRight, Orbit, Plus, Minus, Sun, Moon, LocateFixed, Mouse, Sparkles, X, CircleDot, Check, BookOpen };
const flags = { paris: '🇫🇷', 'new-york': '🇺🇸', giza: '🇪🇬', agra: '🇮🇳', rio: '🇧🇷', sydney: '🇦🇺', fuji: '🇯🇵', rome: '🇮🇹' };
const STORAGE_KEY = 'atlas-discoveries-v1';
const $ = id => document.getElementById(id);
const icon = name => { const i = document.createElement('i'); i.dataset.lucide = name; return i; };
const refreshIcons = () => createIcons({ icons: iconSet });

// Small, original architectural silhouettes rather than remote thumbnails.
const silhouettes = {
  eiffel: '<path d="M9 34 15 21 17 12 18 3 19 12 21 21 27 34M13 26h10M15 20h6M17 12h2M8 34h20M11 30l12-10M25 30 13 26M15 20l7 6M15 34c0-8 6-8 6 0"/>',
  liberty: '<path d="m12 34 3-16 7 1 2 15ZM17 18v-4m-4 20h12M17 8l-3-3m5 3V3m2 6 4-4m-8 6a3 3 0 1 0 6 0 3 3 0 1 0-6 0M22 18l5-10m-1 0h4m-3 0V4m0 0c-3-3 3-3 0-6M15 19l-4 7 5 1"/>',
  pyramids: '<path d="M3 31 16 9 29 31ZM16 9l3 22M20 31l8-15 7 15ZM2 34h33"/>',
  taj: '<path d="M8 33V21h20v12ZM13 21c-6-6 3-11 5-14 2 3 11 8 5 14M18 7V4M2 33V14h4v19m24 0V14h4v19M2 14l2-5 2 5m24 0 2-5 2 5M15 33v-6q3-6 6 0v6M0 34h36"/>',
  christ: '<path d="M9 34h18M13 34v-4h10v4M14 30l2-15L3 14v-3l13 1V9m4 0v3l13-1v3l-13 1 2 15ZM15 6a3 3 0 1 0 6 0 3 3 0 1 0-6 0"/>',
  opera: '<path d="M2 32h32v3H2ZM5 31C2 23 5 17 11 12l2 19M12 31c-3-12 2-20 8-26 7 9 7 18 3 26M22 31c-1-9 4-16 9-20 4 9 2 17-1 20M2 31h32M10 18l10 13M20 5l3 26"/>',
  fuji: '<path d="m1 32 10-13 5-13h5l5 13 9 13ZM11 19l5 2 3-4 3 3 4-1M15 8h7M2 35h32"/>',
  colosseum: '<path d="M3 11q15-9 30 0v20q-15 9-30 0ZM3 18q15 9 30 0M3 25q15 9 30 0M3 11q15 10 30 0M8 16v7m6-5v7m8-7v7m6-9v7M8 26v6m6-4v6m8-6v6m6-8v6M8 8v4m6-6v8m8-8v8m6-6v4"/>',
};
function thumbnail(type) {
  const node = document.createElement('span');
  node.className = 'destination-thumb';
  // This SVG is constant application content, never user-provided input.
  node.innerHTML = `<svg viewBox="0 0 36 38" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${silhouettes[type] || silhouettes.eiffel}</svg>`;
  return node;
}
function readDiscoveries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const valid = {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const location of LANDMARKS) {
        const value = parsed[location.id];
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) valid[location.id] = value;
      }
    }
    return valid;
  } catch { return {}; }
}

export function initUI(api) {
  let selected = LANDMARKS[0];
  let filter = 'all';
  let discoveries = readDiscoveries();
  let toastTimer;
  let view = 'orbit';
  const help = $('help-dialog');
  const log = $('log-dialog');

  function notify(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4200);
  }

  function updateProgress() {
    const count = Object.keys(discoveries).length;
    for (const id of ['log-badge', 'discovered-tab-count', 'progress-count']) $(id).textContent = count;
    const segments = $('progress-segments');
    segments.replaceChildren();
    for (const location of LANDMARKS) {
      const item = document.createElement('i');
      item.classList.toggle('filled', Boolean(discoveries[location.id]));
      item.title = `${location.name}${discoveries[location.id] ? ' — discovered' : ''}`;
      segments.append(item);
    }
  }

  function updateCard() {
    $('selected-name').textContent = selected.name;
    $('selected-location').textContent = `${selected.city}, ${selected.country}`;
    $('destination-flag').textContent = flags[selected.id];
    $('selected-coordinates').textContent = `${Math.abs(selected.lat).toFixed(4)}° ${selected.lat < 0 ? 'S' : 'N'} · ${Math.abs(selected.lon).toFixed(4)}° ${selected.lon < 0 ? 'W' : 'E'}`;
    $('selected-category').textContent = selected.category;
    $('fly-button-text').textContent = `Fly to ${selected.city}`;
    $('flight-card-eyebrow').textContent = discoveries[selected.id] ? 'WORTH ANOTHER VISIT' : 'UP NEXT';
    const flightNumber = document.querySelector('.flight-number');
    flightNumber.replaceChildren(document.createTextNode(`AT–${String(LANDMARKS.indexOf(selected) + 1).padStart(3, '0')} `), icon('plane'));
    refreshIcons();
  }

  function select(id, invoke = true) {
    const location = typeof id === 'string' ? LANDMARKS.find(item => item.id === id) : id;
    if (!location || !LANDMARKS.includes(location)) return;
    selected = location;
    renderDestinations();
    updateCard();
    if (invoke) api.selectDestination(location);
  }

  function renderDestinations() {
    const list = $('destination-list');
    const query = $('destination-search').value.trim().toLocaleLowerCase();
    list.replaceChildren();
    const matches = LANDMARKS.filter(location =>
      (filter === 'all' || discoveries[location.id]) &&
      `${location.name} ${location.city} ${location.country} ${location.category}`.toLocaleLowerCase().includes(query),
    );
    for (const location of matches) {
      const button = document.createElement('button');
      button.className = 'destination';
      button.dataset.destination = location.id;
      button.classList.toggle('active', selected.id === location.id);
      button.classList.toggle('visited', Boolean(discoveries[location.id]));
      button.setAttribute('aria-pressed', String(selected.id === location.id));
      button.setAttribute('aria-label', `${location.name}, ${location.city}, ${location.country}${discoveries[location.id] ? ', discovered' : ''}`);
      const copy = document.createElement('span');
      copy.className = 'destination-copy';
      const name = document.createElement('strong');
      name.textContent = location.name;
      const details = document.createElement('small');
      details.textContent = `${location.city}, ${location.country}`;
      copy.append(name, details);
      const marker = document.createElement('span');
      marker.className = 'destination-marker';
      marker.setAttribute('aria-hidden', 'true');
      if (discoveries[location.id]) marker.textContent = '✓';
      button.append(thumbnail(location.type), copy, marker);
      button.addEventListener('click', () => select(location.id));
      list.append(button);
    }
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = query ? 'No destinations match. Try a city, country, or landmark.' : 'Your next discovery is out there. Fly through a checkpoint to add it here.';
      list.append(empty);
    }
  }

  function renderLog() {
    const content = $('log-content');
    content.replaceChildren();
    const entries = LANDMARKS.filter(location => discoveries[location.id]).sort((a, b) => discoveries[b.id] - discoveries[a.id]);
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const title = document.createElement('strong');
      title.textContent = 'Your story starts in the sky.';
      empty.append(icon('book-open'), title, document.createTextNode('Fly through the glowing checkpoint rings to collect all eight wonders. Your discoveries will be saved here.'));
      content.append(empty);
    }
    for (const location of entries) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      const flag = document.createElement('span');
      flag.textContent = flags[location.id];
      const copy = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = location.name;
      const description = document.createElement('p');
      description.textContent = `${location.city}, ${location.country}`;
      copy.append(name, description);
      const date = document.createElement('small');
      date.textContent = new Date(discoveries[location.id]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      entry.append(flag, copy, date);
      content.append(entry);
    }
    refreshIcons();
  }

  function discover(id) {
    const location = LANDMARKS.find(item => item.id === id);
    if (!location || discoveries[id]) return false;
    discoveries[id] = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(discoveries)); } catch { /* Flight works when persistent storage is unavailable. */ }
    updateProgress();
    renderDestinations();
    updateCard();
    renderLog();
    const count = Object.keys(discoveries).length;
    notify(count === LANDMARKS.length ? 'World explorer! You discovered all eight wonders.' : `${location.name} discovered. ${count} of 8 wonders are yours.`);
    return true;
  }

  function setView(mode) {
    view = mode === 'flight' ? 'flight' : 'orbit';
    for (const name of ['orbit', 'flight']) {
      $(`view-${name}`).classList.toggle('active', view === name);
      $(`view-${name}`).setAttribute('aria-pressed', String(view === name));
    }
    $('app').classList.toggle('flight-mode', view === 'flight');
    document.querySelector('.mobile-flight-controls').classList.toggle('visible', view === 'flight');
    $('orbit-hint').replaceChildren(icon(view === 'flight' ? 'navigation' : 'mouse'));
    const hint = document.createElement('span');
    hint.textContent = view === 'flight' ? 'WASD to fly · ↑ ↓ altitude · Shift to boost' : 'Drag to explore · Scroll to get closer';
    $('orbit-hint').append(hint);
    $('world').setAttribute('aria-label', view === 'flight' ? 'Aircraft flight view. Use WASD to fly, up and down arrows for altitude.' : 'Interactive 3D Earth. Drag to orbit and scroll to zoom.');
    refreshIcons();
  }

  $('destination-search').addEventListener('input', renderDestinations);
  document.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', () => {
      filter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(tab => {
        tab.classList.toggle('active', tab === button);
        tab.setAttribute('aria-pressed', String(tab === button));
      });
      renderDestinations();
    });
  });
  $('fly-button').addEventListener('click', () => api.flyTo(selected));
  $('view-orbit').addEventListener('click', () => { api.setView('orbit'); setView('orbit'); });
  $('view-flight').addEventListener('click', () => { api.setView('flight'); setView('flight'); });
  $('zoom-in').addEventListener('click', () => api.zoom(1));
  $('zoom-out').addEventListener('click', () => api.zoom(-1));
  $('reset-view').addEventListener('click', () => { api.reset(); setView('orbit'); });
  $('lighting').addEventListener('click', () => {
    const night = api.toggleNight();
    $('lighting').replaceChildren(icon(night ? 'moon' : 'sun'));
    $('lighting').setAttribute('aria-label', night ? 'Switch to daylight' : 'Switch to night');
    $('lighting').setAttribute('aria-pressed', String(night));
    refreshIcons();
  });
  $('sound').addEventListener('click', () => {
    const enabled = api.toggleSound();
    $('sound').replaceChildren(icon(enabled ? 'volume-2' : 'volume-x'));
    $('sound').setAttribute('aria-label', `Turn ambient sound ${enabled ? 'off' : 'on'}`);
    $('sound').setAttribute('aria-pressed', String(enabled));
    refreshIcons();
  });
  $('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notify('Fullscreen is unavailable in this browser. Expand the preview for a wider view.');
    } catch { notify('Fullscreen is unavailable here. Expand the preview for a wider view.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    $('fullscreen').replaceChildren(icon(active ? 'minimize' : 'maximize'));
    $('fullscreen').setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    refreshIcons();
  });

  $('help').addEventListener('click', () => help.showModal());
  $('nav-log').addEventListener('click', () => {
    renderLog();
    $('nav-log').classList.add('active');
    $('nav-explore').classList.remove('active');
    log.showModal();
  });
  $('nav-explore').addEventListener('click', () => { if (log.open) log.close(); });
  $('log-explore').addEventListener('click', () => log.close());
  document.querySelector('.close-help').addEventListener('click', () => help.close());
  for (const dialog of [help, log]) {
    dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
  }
  log.addEventListener('close', () => { $('nav-log').classList.remove('active'); $('nav-explore').classList.add('active'); });

  document.querySelectorAll('[data-key]').forEach(button => {
    const release = () => { api.setKey(button.dataset.key, false); button.classList.remove('pressed'); };
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      api.setKey(button.dataset.key, true);
      button.classList.add('pressed');
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });

  const credits = document.createElement('p');
  credits.className = 'credits';
  const source = document.createElement('a');
  source.href = 'https://www.solarsystemscope.com/textures/';
  source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = 'Solar System Scope / INOVE';
  const license = document.createElement('a');
  license.href = 'https://creativecommons.org/licenses/by/4.0/';
  license.target = '_blank'; license.rel = 'noopener noreferrer'; license.textContent = 'CC BY 4.0';
  credits.append('Earth imagery: ', source, ', based on NASA data. Licensed under ', license, '. Some maps resized and recompressed. Landmarks are intentionally oversized for exploration.');
  help.append(credits);

  renderDestinations();
  updateCard();
  updateProgress();
  setView('orbit');
  refreshIcons();

  return {
    updateTelemetry(data = {}) {
      if (Number.isFinite(data.speed)) $('speed-value').textContent = Math.max(0, Math.round(data.speed)).toLocaleString();
      if (Number.isFinite(data.altitude)) $('altitude-value').textContent = Math.max(0, Math.round(data.altitude)).toLocaleString();
      if (Number.isFinite(data.heading)) {
        const heading = ((Math.round(data.heading) % 360) + 360) % 360;
        $('heading-value').textContent = String(heading).padStart(3, '0');
        $('heading-value').nextElementSibling.textContent = `° ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(heading / 45) % 8]}`;
      }
      if (data.status) $('flight-state').textContent = data.status;
    },
    setFlightStatus(text) { $('flight-state').textContent = text; },
    setLoading(percent, label) {
      $('loading-fill').style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
      if (label) $('loading-label').textContent = label;
    },
    finishLoading() {
      $('loading-fill').style.width = '100%';
      $('loading-label').textContent = 'Ready for your next extraordinary.';
      $('loading').classList.add('done');
      setTimeout(() => { $('loading').hidden = true; $('loading').style.display = 'none'; }, 1100);
    },
    notify,
    discover,
    getSelected: () => selected,
    getVisited: () => new Set(Object.keys(discoveries)),
    setView,
    select,
  };
}
