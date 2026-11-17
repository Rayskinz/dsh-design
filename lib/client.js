// Rayskinz DSH Design - browser half.
// Three parts: a store (talks to the host half), an engine (paints the
// background and the working-chat effect), and the "Design Options" page.
window.__ModuleLoader__.load({
	id: '@rayskinz/dsh-design',
	factory(require) {
		const React = require('react');
		const h = React.createElement;
		const { useState, useEffect, useRef, useCallback } = React;

		const CHANNEL = '/api';
		const PREFIX = 'rayskinz-design.';
		const DEFAULTS = {
			bgEnabled: true, panel: 55, dim: 0, blur: 0, effect: 'off', speed: 3, effectColor: '#ff3030', giphyKey: '',
			borderStyle: 'off', borderWidth: 2, borderColor: '#7c5cff', borderOnlyWorking: false,
			tintEnabled: false,
			tintRules: [
				{ match: 'opus', color: '#a78bfa' }, { match: 'sonnet', color: '#60a5fa' }, { match: 'haiku', color: '#4ade80' },
				{ match: 'astra', color: '#fb923c' }, { match: 'sol', color: '#facc15' }, { match: 'luna', color: '#2dd4bf' },
			],
		};
		const BORDERS = [
			{ id: 'off', label: 'Off', hint: 'No frame' },
			{ id: 'neon', label: 'Neon', hint: 'One glowing color' },
			{ id: 'rainbow', label: 'Rainbow', hint: 'Colors flow around the edge' },
			{ id: 'gold', label: 'Gold', hint: 'Shiny metal frame' },
			{ id: 'stripes', label: 'Stripes', hint: 'Moving candy stripes' },
			{ id: 'fire', label: 'Fire', hint: 'Flickering orange edge' },
		];
		const EFFECTS = [
			{ id: 'off', label: 'Off', hint: 'Keep the app default' },
			{ id: 'rainbow', label: 'Rainbow wave', hint: 'Colors slide across the chat' },
			{ id: 'pulse', label: 'Pulse', hint: 'One color, breathing glow' },
			{ id: 'scanner', label: 'Scanner', hint: 'A bright bar sweeps back and forth' },
			{ id: 'ember', label: 'Ember', hint: 'Warm flickering fire edge' },
		];
		const RAINBOW = ['255,60,60', '255,170,40', '255,235,60', '60,230,110', '60,170,255', '170,90,255'];
		const WORKING = '[role="treeitem"]:has(svg[data-state="ongoing"])';
		const WORKING_ICON = WORKING + ' svg[data-state="ongoing"]';

		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
		function hexRgb(hex) {
			const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
			if (!m) return '255,48,48';
			const n = parseInt(m[1], 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
		}

		// ---------------------------------------------------------------- effects
		function effectCss(s, sel, icon) {
			const d = clamp(Number(s.speed) || 3, 1, 8);
			const c = hexRgb(s.effectColor);
			if (s.effect === 'rainbow') {
				const stops = RAINBOW.concat(RAINBOW[0]).map((x) => 'rgba(' + x + ',.38)').join(',');
				const glow = RAINBOW.concat(RAINBOW[0]).map((x, i, a) => Math.round((i / (a.length - 1)) * 100) + '%{box-shadow:0 0 10px 2px rgba(' + x + ',.8)}').join('');
				return {
					kf: '@keyframes rzdWave{0%{background-position:0% 50%}100%{background-position:200% 50%}}@keyframes rzdGlow{' + glow + '}@keyframes rzdHue{0%{filter:hue-rotate(0deg) drop-shadow(0 0 4px currentColor)}100%{filter:hue-rotate(360deg) drop-shadow(0 0 4px currentColor)}}',
					rule: sel + '{background-color:transparent!important;background-image:linear-gradient(100deg,' + stops + ')!important;background-size:200% 100%!important;border-radius:8px;animation:rzdWave ' + d + 's linear infinite,rzdGlow ' + d + 's linear infinite}' + icon + '{color:#ff3030!important;animation:rzdHue ' + d + 's linear infinite}',
				};
			}
			if (s.effect === 'pulse') {
				return {
					kf: '@keyframes rzdPulse{0%,100%{box-shadow:0 0 6px 1px rgba(' + c + ',.55),inset 0 0 8px rgba(' + c + ',.25)}50%{box-shadow:0 0 16px 4px rgba(' + c + ',.95),inset 0 0 14px rgba(' + c + ',.45)}}',
					rule: sel + '{background:rgba(' + c + ',.12)!important;border-radius:8px;animation:rzdPulse ' + (d * 0.55).toFixed(2) + 's ease-in-out infinite}' + icon + '{color:rgb(' + c + ')!important;filter:drop-shadow(0 0 4px rgb(' + c + '))}',
				};
			}
			if (s.effect === 'scanner') {
				return {
					kf: '@keyframes rzdScan{0%{background-position:0% 50%}100%{background-position:100% 50%}}',
					rule: sel + '{background-color:rgba(' + c + ',.08)!important;background-image:linear-gradient(90deg,transparent,rgba(' + c + ',.6) 50%,transparent)!important;background-size:38% 100%!important;background-repeat:no-repeat!important;border-radius:8px;box-shadow:0 0 8px 1px rgba(' + c + ',.35);animation:rzdScan ' + (d * 0.5).toFixed(2) + 's ease-in-out infinite alternate}' + icon + '{color:rgb(' + c + ')!important;filter:drop-shadow(0 0 4px rgb(' + c + '))}',
				};
			}
			if (s.effect === 'ember') {
				return {
					kf: '@keyframes rzdEmber{0%,100%{box-shadow:0 0 8px 1px rgba(255,120,30,.6),inset 0 -6px 10px rgba(255,80,0,.25)}30%{box-shadow:0 0 14px 3px rgba(255,170,40,.85),inset 0 -10px 14px rgba(255,120,0,.35)}60%{box-shadow:0 0 10px 2px rgba(255,90,20,.7),inset 0 -4px 8px rgba(255,60,0,.2)}}',
					rule: sel + '{background:linear-gradient(0deg,rgba(255,110,20,.28),rgba(255,60,0,.06))!important;border-radius:8px;animation:rzdEmber ' + (d * 0.4).toFixed(2) + 's ease-in-out infinite}' + icon + '{color:#ff8a2a!important;filter:drop-shadow(0 0 4px #ff8a2a)}',
				};
			}
			return { kf: '', rule: '' };
		}

		// ---------------------------------------------------------------- borders
		// A fixed, click-through frame around the whole window. Gradient styles draw
		// the ring with a mask (padding box minus content box), so the app stays visible.
		function borderCss(s, id) {
			if (!s || s.borderStyle === 'off') return '';
			const w = clamp(Number(s.borderWidth) || 2, 1, 8);
			const c = hexRgb(s.borderColor);
			const d = clamp(Number(s.speed) || 3, 1, 8) * 2;
			const base = '#' + id + '{position:fixed;inset:0;z-index:9999;pointer-events:none;box-sizing:border-box;' + (s.borderOnlyWorking ? 'opacity:0;transition:opacity .35s ease;' : '');
			const ring = 'padding:' + w + 'px;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);';
			const show = s.borderOnlyWorking ? 'body:has(svg[data-state="ongoing"]) #' + id + '{opacity:1}' : '';
			let rule;
			switch (s.borderStyle) {
				case 'neon':
					rule = base + 'border:' + w + 'px solid rgb(' + c + ');box-shadow:inset 0 0 ' + (w * 6) + 'px rgba(' + c + ',.75),0 0 ' + (w * 6) + 'px rgba(' + c + ',.6)}';
					break;
				case 'rainbow':
					rule = base + ring + 'background:linear-gradient(90deg,#ff3c3c,#ffaa28,#ffeb3c,#3ce66e,#3caaff,#aa5aff,#ff3c3c);background-size:300% 100%;animation:rzdBorderFlow ' + d + 's linear infinite}@keyframes rzdBorderFlow{to{background-position:300% 0}}';
					break;
				case 'gold':
					rule = base + ring + 'background:linear-gradient(135deg,#8a6a1a,#f6e27a 25%,#b8860b 50%,#fff3b0 75%,#8a6a1a)}';
					break;
				case 'stripes':
					rule = base + ring + 'background:repeating-linear-gradient(45deg,rgb(' + c + ') 0 12px,rgba(255,255,255,.9) 12px 24px);background-size:34px 34px;animation:rzdBorderStripes ' + (d / 4).toFixed(2) + 's linear infinite}@keyframes rzdBorderStripes{to{background-position:34px 0}}';
					break;
				case 'fire':
					rule = base + ring + 'background:linear-gradient(0deg,#ff2a00,#ff8a00 40%,#ffd23f 70%,#ff4500);background-size:100% 220%;animation:rzdBorderFire ' + (d / 4).toFixed(2) + 's ease-in-out infinite alternate;filter:drop-shadow(0 0 ' + (w * 3) + 'px rgba(255,100,0,.8))}@keyframes rzdBorderFire{to{background-position:0 100%}}';
					break;
				default:
					return '';
			}
			return rule + show;
		}

		// ------------------------------------------------------------------- tints
		// Colour a chat row by the words in its title. Whole-word, case-insensitive,
		// first rule wins ("sol" must not match "solve").
		function tintFor(title, rules) {
			if (typeof title !== 'string' || title === '' || !Array.isArray(rules)) return null;
			for (const r of rules) {
				if (!r || !r.match || !/^#[0-9a-f]{6}$/i.test(r.color || '')) continue;
				const esc = String(r.match).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				if (esc === '') continue;
				if (new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)', 'i').test(title)) return r.color;
			}
			return null;
		}
		const TINT_CSS = '[data-rzd-tint]{--rzd-tint-fill:color-mix(in srgb,var(--rzd-tint) 14%,transparent)}[data-rzd-tint]::before{content:"";position:absolute;left:0;top:5px;bottom:5px;width:3px;border-radius:2px;background:var(--rzd-tint);pointer-events:none}[data-rzd-tint]:not(:hover){background-image:linear-gradient(90deg,var(--rzd-tint-fill),transparent 75%)}';

		// ----------------------------------------------------------------- themes
		// A theme is only settings (no background file, no GIPHY key, no pet).
		const THEME_KEYS = ['panel', 'dim', 'blur', 'effect', 'speed', 'effectColor', 'borderStyle', 'borderWidth', 'borderColor', 'borderOnlyWorking', 'tintEnabled', 'tintRules'];
		const PRESETS = [
			{ id: 'avatar', label: 'Avatar', hint: 'Warm sky, gold frame', theme: { panel: 50, dim: 8, blur: 0, effect: 'ember', speed: 3, borderStyle: 'gold', borderWidth: 2, borderOnlyWorking: false } },
			{ id: 'cyberpunk', label: 'Cyberpunk', hint: 'Neon pink, scanner', theme: { panel: 45, dim: 25, blur: 2, effect: 'scanner', speed: 3, effectColor: '#ff2bd6', borderStyle: 'neon', borderWidth: 2, borderColor: '#00e5ff', borderOnlyWorking: false } },
			{ id: 'minimal', label: 'Minimal', hint: 'Calm and readable', theme: { panel: 85, dim: 0, blur: 0, effect: 'pulse', speed: 4, effectColor: '#60a5fa', borderStyle: 'off', borderOnlyWorking: false, tintEnabled: false } },
			{ id: 'party', label: 'Party', hint: 'Rainbow everything', theme: { panel: 55, dim: 0, blur: 0, effect: 'rainbow', speed: 2, borderStyle: 'rainbow', borderWidth: 3, borderOnlyWorking: true } },
		];
		function themeFrom(settings) {
			const out = {};
			for (const k of THEME_KEYS) if (settings[k] !== undefined) out[k] = settings[k];
			return out;
		}
		function exportTheme(settings) {
			return JSON.stringify({ rayskinzDesignTheme: 1, theme: themeFrom(settings) });
		}
		// Returns { theme } or { error }. Unknown keys are dropped; values are re-checked by the host on save.
		function parseTheme(text) {
			let data;
			try {
				data = JSON.parse(String(text).trim());
			} catch (e) {
				return { error: 'That is not valid theme text. Paste exactly what "Copy my look" gave you.' };
			}
			if (!data || data.rayskinzDesignTheme !== 1 || typeof data.theme !== 'object' || data.theme === null) return { error: 'That is not a Rayskinz theme.' };
			const theme = {};
			for (const k of THEME_KEYS) if (data.theme[k] !== undefined) theme[k] = data.theme[k];
			return Object.keys(theme).length ? { theme } : { error: 'That theme is empty.' };
		}

		// -------------------------------------------------------------------- pet
		// Pure game rules. The pet never dies: neglect only makes it sad.
		const PET_SPECIES = {
			chick: { emoji: '\uD83D\uDC24', cost: 0 }, cat: { emoji: '\uD83D\uDC31', cost: 0 }, dog: { emoji: '\uD83D\uDC36', cost: 40 },
			fox: { emoji: '\uD83E\uDD8A', cost: 80 }, frog: { emoji: '\uD83D\uDC38', cost: 120 }, octopus: { emoji: '\uD83D\uDC19', cost: 200 }, dragon: { emoji: '\uD83D\uDC32', cost: 400 },
		};
		const FEED_COST = 2;
		const petLevel = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 20)) + 1;
		function petTick(p, now) {
			const el = clamp(now - p.lastTick, 0, 48 * 3600e3);
			if (el < 1000) return p;
			const min = el / 60e3;
			return { ...p, hunger: clamp(p.hunger - min / 6, 0, 100), joy: clamp(p.joy - min / 9, 0, 100), lastTick: now };
		}
		function petFeed(p) {
			if (p.coins < FEED_COST) return p;
			return { ...p, coins: p.coins - FEED_COST, hunger: clamp(p.hunger + 25, 0, 100), joy: clamp(p.joy + 3, 0, 100), xp: p.xp + 1 };
		}
		function petPlay(p) {
			return { ...p, joy: clamp(p.joy + 20, 0, 100), hunger: clamp(p.hunger - 5, 0, 100), xp: p.xp + 2 };
		}
		function petPat(p) {
			return { ...p, joy: clamp(p.joy + 4, 0, 100), xp: p.xp + 1 };
		}
		function petReward(p) {
			return { ...p, coins: p.coins + 3, xp: p.xp + 10, joy: clamp(p.joy + 6, 0, 100) };
		}
		function petBuy(p, species) {
			const sp = PET_SPECIES[species];
			if (!sp || p.unlocked.includes(species) || p.coins < sp.cost) return p;
			return { ...p, coins: p.coins - sp.cost, unlocked: p.unlocked.concat([species]), species };
		}
		function petMood(p, working) {
			if (working) return 'working';
			if (p.hunger < 25) return 'hungry';
			if (p.joy < 25) return 'sad';
			if (p.hunger >= 60 && p.joy >= 60) return 'happy';
			return 'idle';
		}
		const MOOD_BUBBLE = { working: '\u26A1', hungry: '\uD83C\uDF56', sad: '\uD83D\uDC94', happy: '\u2728', idle: '' };
		const MOOD_TEXT = { working: 'Cheering you on', hungry: 'Hungry!', sad: 'Lonely, play with me', happy: 'Happy', idle: 'Chilling' };

		// ------------------------------------------------------------------ store
		function createStore(rpc) {
			let state = { ready: false, busy: '', error: '', settings: DEFAULTS, bg: { has: false }, pet: null, working: false, toast: '' };
			const subs = new Set();
			let saveTimer = 0;
			const emit = () => subs.forEach((f) => f());
			const set = (patch) => {
				state = { ...state, ...patch };
				emit();
			};
			async function call(endpoint, payload) {
				const r = await rpc.call(CHANNEL, PREFIX + endpoint, payload === undefined ? {} : payload);
				if (!r || !r.ok) throw new Error((r && r.error && r.error.message) || 'Something went wrong.');
				return r.value;
			}
			const toBg = (v) => (v && v.has ? { has: true, version: v.version, ext: v.ext, mime: v.mime, url: 'data:' + v.mime + ';base64,' + v.base64 } : { has: false });
			async function load() {
				for (let i = 0; i < 6; i++) {
					try {
						const [settings, data, pet] = await Promise.all([call('getSettings'), call('data'), call('getPet')]);
						set({ ready: true, settings, bg: toBg(data), pet: petTick(pet, Date.now()), error: '' });
						return;
					} catch (e) {
						if (i === 5) set({ ready: true, error: 'Could not reach the Design plugin host: ' + (e && e.message) });
						else await sleep(1200 * (i + 1));
					}
				}
			}
			function setSettings(patch) {
				const settings = { ...state.settings, ...patch };
				set({ settings });
				clearTimeout(saveTimer);
				saveTimer = setTimeout(() => {
					call('setSettings', settings).catch((e) => set({ error: 'Could not save settings: ' + e.message }));
				}, 350);
			}
			async function applyBackground(kind, payload) {
				set({ busy: 'Applying background…', error: '' });
				try {
					await call(kind, payload);
					const bg = toBg(await call('data'));
					set({ bg, busy: '' });
					if (!state.settings.bgEnabled) setSettings({ bgEnabled: true });
				} catch (e) {
					set({ busy: '', error: e.message });
				}
			}
			async function clearBackground() {
				try {
					await call('clear');
					set({ bg: { has: false }, error: '' });
				} catch (e) {
					set({ error: e.message });
				}
			}
			let petTimer = 0;
			let toastTimer = 0;
			function savePet() {
				clearTimeout(petTimer);
				petTimer = setTimeout(() => {
					if (state.pet) call('setPet', state.pet).catch(() => {});
				}, 800);
			}
			function toast(text) {
				clearTimeout(toastTimer);
				set({ toast: text });
				toastTimer = setTimeout(() => set({ toast: '' }), 2200);
			}
			function pet(fn, message) {
				if (!state.pet) return;
				const next = fn(petTick(state.pet, Date.now()));
				set({ pet: next });
				savePet();
				if (message) toast(message);
			}
			const petActions = {
				feed: () => (state.pet && state.pet.coins >= FEED_COST ? pet(petFeed, 'Nom nom') : toast('Not enough coins. Finished chats earn them.')),
				play: () => pet(petPlay, 'Wheee'),
				pat: () => pet(petPat, 'Purr'),
				reward: () => pet(petReward, '+3 coins'),
				buy: (species) => {
					const sp = PET_SPECIES[species];
					if (!state.pet || !sp) return;
					if (state.pet.unlocked.includes(species)) return pet((p) => ({ ...p, species }), '');
					if (state.pet.coins < sp.cost) return toast('Need ' + sp.cost + ' coins');
					pet((p) => petBuy(p, species), 'New friend unlocked');
				},
				rename: (name) => pet((p) => ({ ...p, name: String(name).slice(0, 16) || p.name }), ''),
				tick: () => {
					if (state.pet) set({ pet: petTick(state.pet, Date.now()) });
				},
			};
			return {
				pet: petActions,
				setWorking: (working) => {
					if (working !== state.working) set({ working });
				},
				flushPet: () => {
					clearTimeout(petTimer);
					if (state.pet) call('setPet', state.pet).catch(() => {});
				},
				get: () => state,
				subscribe: (f) => (subs.add(f), () => subs.delete(f)),
				call,
				load,
				setSettings,
				applyBackground,
				clearBackground,
				clearError: () => set({ error: '' }),
				dispose: () => {
					clearTimeout(saveTimer);
					clearTimeout(petTimer);
					clearTimeout(toastTimer);
				},
			};
		}

		// ----------------------------------------------------------------- engine
		function mountEngine(store) {
			const ID = 'rzd-bg';
			const bgStyle = document.createElement('style');
			bgStyle.setAttribute('data-rayskinz-design', 'background');
			const fxStyle = document.createElement('style');
			fxStyle.setAttribute('data-rayskinz-design', 'effect');
			const frameStyle = document.createElement('style');
			frameStyle.setAttribute('data-rayskinz-design', 'border');
			const tintStyle = document.createElement('style');
			tintStyle.setAttribute('data-rayskinz-design', 'tint');
			document.head.append(bgStyle, fxStyle, frameStyle, tintStyle);
			const FRAME = 'rzd-frame';
			let frame = null;
			let tinted = new Set();
			function renderBorder(s) {
				const css = borderCss(s, FRAME);
				frameStyle.textContent = css;
				if (css && !frame) {
					frame = document.createElement('div');
					frame.id = FRAME;
					frame.setAttribute('aria-hidden', 'true');
					document.body.append(frame);
				} else if (!css && frame) {
					frame.remove();
					frame = null;
				}
			}
			function clearTints() {
				for (const el of tinted) {
					el.removeAttribute('data-rzd-tint');
					el.style.removeProperty('--rzd-tint');
				}
				tinted = new Set();
			}
			// Sidebar rows are the only chat/sub-chat rows with a text title in the page.
			function applyTints(s) {
				if (!s.tintEnabled || !s.tintRules.length) {
					clearTints();
					tintStyle.textContent = '';
					return;
				}
				tintStyle.textContent = TINT_CSS;
				const seen = new Set();
				document.querySelectorAll('[role="treeitem"][data-row-key^="session:"]').forEach((row) => {
					const titleEl = row.querySelector('[class*="title"]');
					const text = titleEl ? titleEl.textContent : String(row.innerText || '').split('\n')[0];
					const color = tintFor(text, s.tintRules);
					if (color) {
						if (getComputedStyle(row).position === 'static') row.style.position = 'relative';
						row.setAttribute('data-rzd-tint', '');
						row.style.setProperty('--rzd-tint', color);
						seen.add(row);
					} else if (tinted.has(row)) {
						row.removeAttribute('data-rzd-tint');
						row.style.removeProperty('--rzd-tint');
					}
				});
				tinted = seen;
			}
			let tintTimer = 0;
			const listMo = new MutationObserver(() => {
				clearTimeout(tintTimer);
				tintTimer = setTimeout(() => applyTints(store.get().settings), 120);
			});
			listMo.observe(document.body, { childList: true, subtree: true, characterData: true });
			let box = null;
			let media = null;
			let dim = null;
			let mediaKey = '';
			let busy = false;
			const body = document.body;
			const TOKENS = [['--dsw-alias-bg-base', 0.65], ['--dsw-alias-bg-layer-1', 1.1], ['--dsw-alias-bg-layer-2', 1.1], ['--dsw-specific-sidebar-fill', 1.27]];

			function tint(on, panel) {
				if (busy) return;
				busy = true;
				for (const [k] of TOKENS) body.style.removeProperty(k);
				if (on) {
					const cs = getComputedStyle(body);
					for (const [k, mul] of TOKENS) {
						const v = cs.getPropertyValue(k).trim();
						if (v) body.style.setProperty(k, 'color-mix(in srgb, ' + v + ' ' + clamp(Math.round(panel * mul), 5, 100) + '%, transparent)');
					}
				}
				busy = false;
			}

			function render() {
				const { settings: s, bg } = store.get();
				const on = !!(s.bgEnabled && bg.has && bg.url);
				if (on) {
					const key = bg.version + ':' + bg.ext;
					if (!box) {
						box = document.createElement('div');
						box.id = ID;
						dim = document.createElement('div');
						body.prepend(box);
					}
					if (key !== mediaKey) {
						mediaKey = key;
						box.textContent = '';
						const video = /^(mp4|webm)$/.test(bg.ext);
						media = document.createElement(video ? 'video' : 'img');
						if (video) {
							media.muted = true;
							media.loop = true;
							media.autoplay = true;
							media.playsInline = true;
						} else media.alt = '';
						media.src = bg.url;
						box.append(media, dim);
						if (video) media.play().catch(() => {});
					}
					media.style.filter = s.blur > 0 ? 'blur(' + s.blur + 'px)' : '';
					media.style.transform = s.blur > 0 ? 'scale(1.06)' : '';
					dim.style.background = 'rgba(0,0,0,' + (s.dim / 100).toFixed(2) + ')';
					bgStyle.textContent =
						'#' + ID + '{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;background:#000}' +
						'#' + ID + ' img,#' + ID + ' video{width:100%;height:100%;object-fit:cover;display:block}' +
						'#' + ID + ' div{position:absolute;inset:0}' +
						'html,body,#root{background:transparent!important}';
				} else {
					if (box) {
						box.remove();
						box = media = dim = null;
						mediaKey = '';
					}
					bgStyle.textContent = '';
				}
				tint(on, s.panel);
				const fx = effectCss(s, WORKING, WORKING_ICON);
				fxStyle.textContent = fx.kf + fx.rule;
				renderBorder(s);
				applyTints(s);
			}

			render();
			const off = store.subscribe(render);
			const mo = new MutationObserver(() => {
				if (!busy) setTimeout(() => render(), 0);
			});
			const attrs = ['class', 'data-theme', 'data-color-mode', 'data-mode', 'data-color-scheme'];
			mo.observe(body, { attributes: true, attributeFilter: attrs });
			mo.observe(document.documentElement, { attributes: true, attributeFilter: attrs });
			return () => {
				off();
				mo.disconnect();
				listMo.disconnect();
				clearTimeout(tintTimer);
				clearTints();
				if (frame) frame.remove();
				if (box) box.remove();
				tint(false, 0);
				bgStyle.remove();
				fxStyle.remove();
				frameStyle.remove();
				tintStyle.remove();
			};
		}

		// -------------------------------------------------------------------- UI
		const CSS = `
.rzd{display:flex;flex-direction:column;gap:16px;padding:2px 2px 28px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px}
.rzd-head{display:flex;flex-direction:column;gap:2px}
.rzd-h1{font-size:18px;line-height:26px;font-weight:600;margin:0}
.rzd-card{display:flex;flex-direction:column;gap:12px;padding:16px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.rzd-title{font-size:15px;font-weight:600;margin:0}
.rzd-sub{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:19px}
.rzd-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.rzd-col{display:flex;flex-direction:column;gap:6px;min-width:0}
.rzd-btn{border:0.5px solid var(--dsw-alias-border-l2);background:transparent;color:inherit;border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer;transition:background .15s,transform .1s}
.rzd-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.rzd-btn:active:not(:disabled){transform:scale(.97)}
.rzd-btn:disabled{opacity:.5;cursor:default}
.rzd-btn[data-primary]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}
.rzd-btn[data-primary]:hover:not(:disabled){background:var(--dsw-alias-brand-primary);filter:brightness(1.1)}
.rzd-tabs{display:flex;gap:6px;flex-wrap:wrap}
.rzd-tab{border:0.5px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:999px;padding:5px 14px;font:inherit;cursor:pointer;transition:background .15s,color .15s}
.rzd-tab:hover{background:var(--dsw-alias-bg-layer-2)}
.rzd-tab[aria-selected="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}
.rzd-input{flex:1;min-width:140px;border:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:inherit;border-radius:8px;padding:7px 10px;font:inherit;outline:none}
.rzd-input:focus{border-color:var(--dsw-alias-brand-primary)}
.rzd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.rzd-thumb{position:relative;aspect-ratio:16/10;padding:0;border:2px solid transparent;border-radius:10px;overflow:hidden;cursor:pointer;background:var(--dsw-alias-bg-layer-2);transition:transform .15s,border-color .15s}
.rzd-thumb:hover:not(:disabled){transform:translateY(-2px);border-color:var(--dsw-alias-border-l2)}
.rzd-thumb:disabled{cursor:default;opacity:.7}
.rzd-thumb[data-picked]{border-color:var(--dsw-alias-brand-primary)}
.rzd-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.rzd-tag{position:absolute;left:6px;bottom:6px;padding:1px 6px;border-radius:6px;font-size:11px;line-height:16px;color:#fff;background:rgba(0,0,0,.55)}
.rzd-err{color:var(--dsw-alias-state-error-primary);font-size:13px}
.rzd-ok{color:var(--dsw-alias-state-success-primary);font-size:13px}
.rzd-credit{color:var(--dsw-alias-label-secondary);font-size:12px}
.rzd-preview{height:92px;border-radius:10px;overflow:hidden;border:0.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
.rzd-preview img,.rzd-preview video{width:100%;height:100%;object-fit:cover}
.rzd-slider{display:grid;grid-template-columns:150px 1fr 56px;align-items:center;gap:12px}
.rzd-slider input{width:100%;accent-color:var(--dsw-alias-brand-primary)}
.rzd-slider output{text-align:right;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.rzd-switch{position:relative;width:38px;height:22px;border-radius:999px;border:0;padding:0;cursor:pointer;background:var(--dsw-alias-border-l2);transition:background .15s;flex:none}
.rzd-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}
.rzd-switch::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}
.rzd-switch[aria-checked="true"]::after{transform:translateX(16px)}
.rzd-chips{display:flex;gap:8px;flex-wrap:wrap}
.rzd-chip{display:flex;flex-direction:column;gap:2px;text-align:left;min-width:130px;border:0.5px solid var(--dsw-alias-border-l1);background:transparent;color:inherit;border-radius:10px;padding:8px 12px;font:inherit;cursor:pointer;transition:background .15s,border-color .15s}
.rzd-chip:hover{background:var(--dsw-alias-bg-layer-2)}
.rzd-chip[aria-checked="true"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.rzd-chip small{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px}
.rzd-working{padding:12px 14px;border-radius:8px;color:var(--dsw-alias-label-secondary);font-size:13px}
.rzd-color{width:38px;height:28px;padding:0;border:0.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;cursor:pointer}
.rzd a{color:var(--dsw-alias-brand-primary)}
@media (max-width:640px){.rzd-slider{grid-template-columns:1fr}.rzd-slider output{text-align:left}}
`;

		function useStore(store) {
			const [, bump] = useState(0);
			useEffect(() => store.subscribe(() => bump((n) => n + 1)), [store]);
			return store.get();
		}

		function Slider(p) {
			return h('label', { className: 'rzd-slider' },
				h('span', null, p.label),
				h('input', { type: 'range', min: p.min, max: p.max, step: p.step || 1, value: p.value, onChange: (e) => p.onChange(Number(e.target.value)) }),
				h('output', null, p.value + (p.unit || '')));
		}

		function Switch(p) {
			return h('button', { type: 'button', role: 'switch', 'aria-checked': p.checked, 'aria-label': p.label, className: 'rzd-switch', onClick: () => p.onChange(!p.checked) });
		}

		function Hub(p) {
			const { store, kind } = p;
			const st = useStore(store);
			const key = st.settings.giphyKey;
			const needsKey = kind === 'giphy' && !key;
			const [q, setQ] = useState('');
			const [items, setItems] = useState([]);
			const [cursor, setCursor] = useState({ page: 1, offset: 0, more: false });
			const [loading, setLoading] = useState(false);
			const [err, setErr] = useState('');
			const [picked, setPicked] = useState('');
			const [keyDraft, setKeyDraft] = useState('');
			const seq = useRef(0);

			const run = useCallback(async (reset, query) => {
				const id = ++seq.current;
				setLoading(true);
				setErr('');
				try {
					if (kind === 'wallhaven') {
						const page = reset ? 1 : cursor.page + 1;
						const r = await store.call('wallhaven', { q: query, page });
						if (id !== seq.current) return;
						setItems((cur) => (reset ? r.items : cur.concat(r.items)));
						setCursor({ page: r.page, offset: 0, more: r.page < r.lastPage });
					} else {
						const r = await store.call('giphy', { key, q: query, offset: reset ? 0 : cursor.offset });
						if (id !== seq.current) return;
						setItems((cur) => (reset ? r.items : cur.concat(r.items)));
						setCursor({ page: 1, offset: r.nextOffset, more: r.more });
					}
				} catch (e) {
					if (id === seq.current) setErr(e.message);
				} finally {
					if (id === seq.current) setLoading(false);
				}
			}, [kind, key, cursor.page, cursor.offset, store]);

			useEffect(() => {
				if (!needsKey) run(true, '');
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [kind, key]);

			const choose = async (it) => {
				setPicked(it.id);
				await store.applyBackground('apply', { url: it.full });
			};
			const busy = !!st.busy;

			if (needsKey) {
				return h('div', { className: 'rzd-col' },
					h('div', { className: 'rzd-sub' }, 'GIFs come from GIPHY, which needs a free key (100 searches an hour). It takes about a minute:'),
					h('ol', { className: 'rzd-sub', style: { margin: 0, paddingLeft: 20 } },
						h('li', null, 'Open ', h('a', { href: 'https://developers.giphy.com/dashboard/', target: '_blank', rel: 'noopener noreferrer' }, 'developers.giphy.com'), ' and sign in.'),
						h('li', null, 'Create an app, pick "API", and copy the key.'),
						h('li', null, 'Paste it below.')),
					h('div', { className: 'rzd-row' },
						h('input', { className: 'rzd-input', placeholder: 'Paste your GIPHY key', value: keyDraft, onChange: (e) => setKeyDraft(e.target.value), 'aria-label': 'GIPHY key' }),
						h('button', { type: 'button', className: 'rzd-btn', 'data-primary': '', disabled: keyDraft.trim().length < 16, onClick: () => store.setSettings({ giphyKey: keyDraft.trim() }) }, 'Save key')),
					h('div', { className: 'rzd-credit' }, 'The key is stored on this computer only.'));
			}

			return h('div', { className: 'rzd-col' },
				h('form', { className: 'rzd-row', onSubmit: (e) => { e.preventDefault(); run(true, q); } },
					h('input', { className: 'rzd-input', placeholder: kind === 'wallhaven' ? 'Search wallpapers (space, anime, forest…)' : 'Search GIFs (avatar, rain, city…)', value: q, onChange: (e) => setQ(e.target.value), 'aria-label': 'Search' }),
					h('button', { type: 'submit', className: 'rzd-btn', 'data-primary': '', disabled: loading }, 'Search'),
					kind === 'giphy' ? h('button', { type: 'button', className: 'rzd-btn', onClick: () => store.setSettings({ giphyKey: '' }) }, 'Change key') : null),
				err ? h('div', { className: 'rzd-err', role: 'alert' }, err) : null,
				h('div', { className: 'rzd-grid' }, items.map((it) =>
					h('button', { key: it.id, type: 'button', className: 'rzd-thumb', 'data-picked': picked === it.id && !st.error ? '' : undefined, disabled: busy, title: it.label, onClick: () => choose(it) },
						h('img', { src: it.thumb, alt: it.label, loading: 'lazy' }),
						it.label ? h('span', { className: 'rzd-tag' }, picked === it.id && busy ? 'Applying…' : it.label) : null))),
				loading && items.length === 0 ? h('div', { className: 'rzd-sub' }, 'Loading…') : null,
				!loading && !err && items.length === 0 ? h('div', { className: 'rzd-sub' }, 'Nothing found. Try another word.') : null,
				cursor.more ? h('div', { className: 'rzd-row' }, h('button', { type: 'button', className: 'rzd-btn', disabled: loading, onClick: () => run(false, q) }, loading ? 'Loading…' : 'Show more')) : null,
				h('div', { className: 'rzd-credit' }, kind === 'wallhaven' ? 'Wallpapers from Wallhaven (safe for work only).' : 'Powered by GIPHY.'));
		}

		function LinkOrFile(p) {
			const { store } = p;
			const st = useStore(store);
			const [url, setUrl] = useState('');
			const [fileErr, setFileErr] = useState('');
			const onFile = (e) => {
				const f = e.target.files && e.target.files[0];
				e.target.value = '';
				if (!f) return;
				const ext = (f.name.split('.').pop() || '').toLowerCase();
				if (!/^(gif|png|jpe?g|webp|mp4|webm)$/.test(ext)) return setFileErr('Use a gif, png, jpg, webp, mp4 or webm file.');
				if (f.size > 40 * 1024 * 1024) return setFileErr('That file is over 40 MB.');
				setFileErr('');
				const r = new FileReader();
				r.onload = () => {
					const s = String(r.result);
					store.applyBackground('applyData', { ext, base64: s.slice(s.indexOf(',') + 1) });
				};
				r.onerror = () => setFileErr('Could not read that file.');
				r.readAsDataURL(f);
			};
			return h('div', { className: 'rzd-col' },
				h('div', { className: 'rzd-sub' }, 'Paste a link to a GIF, image or video (https only), or pick a file from your computer. Up to 40 MB.'),
				h('form', { className: 'rzd-row', onSubmit: (e) => { e.preventDefault(); if (url.trim()) store.applyBackground('applyLink', { url: url.trim() }); } },
					h('input', { className: 'rzd-input', placeholder: 'https://…/my.gif', value: url, onChange: (e) => setUrl(e.target.value), 'aria-label': 'Link' }),
					h('button', { type: 'submit', className: 'rzd-btn', 'data-primary': '', disabled: !url.trim() || !!st.busy }, 'Use link')),
				h('div', { className: 'rzd-row', style: { justifyContent: 'flex-start' } },
					h('label', { className: 'rzd-btn', style: { cursor: 'pointer' } }, 'Pick a file…', h('input', { type: 'file', accept: '.gif,.png,.jpg,.jpeg,.webp,.mp4,.webm', onChange: onFile, style: { display: 'none' } })),
					fileErr ? h('span', { className: 'rzd-err' }, fileErr) : null));
		}

		function BackgroundCard(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const [tab, setTab] = useState('wallhaven');
			const tabs = [['wallhaven', 'Wallpapers'], ['giphy', 'GIFs'], ['link', 'Link or file']];
			const video = st.bg.has && /^(mp4|webm)$/.test(st.bg.ext);
			return h('section', { className: 'rzd-card', 'aria-label': 'Chat background' },
				h('div', { className: 'rzd-row' },
					h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Chat background'), h('div', { className: 'rzd-sub' }, 'Sits behind every chat. Pick one below.')),
					h(Switch, { checked: s.bgEnabled, label: 'Show background', onChange: (v) => store.setSettings({ bgEnabled: v }) })),
				h('div', { className: 'rzd-preview' },
					st.bg.has ? (video ? h('video', { src: st.bg.url, muted: true, loop: true, autoPlay: true, playsInline: true }) : h('img', { src: st.bg.url, alt: 'Current background' })) : 'No background yet'),
				h('div', { className: 'rzd-row' },
					h('span', { className: 'rzd-sub' }, st.busy || (st.bg.has ? 'Current background' : '')),
					st.bg.has ? h('button', { type: 'button', className: 'rzd-btn', onClick: () => store.clearBackground() }, 'Remove background') : null),
				st.error ? h('div', { className: 'rzd-err', role: 'alert', onClick: () => store.clearError() }, st.error) : null,
				h('div', { className: 'rzd-tabs', role: 'tablist' }, tabs.map(([id, label]) => h('button', { key: id, type: 'button', role: 'tab', 'aria-selected': tab === id, className: 'rzd-tab', onClick: () => setTab(id) }, label))),
				tab === 'link' ? h(LinkOrFile, { store }) : h(Hub, { key: tab, store, kind: tab }),
				h('div', { className: 'rzd-col', style: { gap: 10, marginTop: 4 } },
					h(Slider, { label: 'Panel see-through', min: 10, max: 100, value: s.panel, unit: '%', onChange: (v) => store.setSettings({ panel: v }) }),
					h(Slider, { label: 'Darken background', min: 0, max: 80, value: s.dim, unit: '%', onChange: (v) => store.setSettings({ dim: v }) }),
					h(Slider, { label: 'Blur background', min: 0, max: 20, value: s.blur, unit: 'px', onChange: (v) => store.setSettings({ blur: v }) }),
					h('div', { className: 'rzd-sub' }, 'Lower "Panel see-through" lets more of the background show. If text gets hard to read, raise it or darken the background.')));
		}

		function EffectCard(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const fx = effectCss(s, '.rzd-working', '.rzd-working-none');
			const needsColor = s.effect === 'pulse' || s.effect === 'scanner';
			return h('section', { className: 'rzd-card', 'aria-label': 'Working chat effect' },
				h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Working chat effect'), h('div', { className: 'rzd-sub' }, 'How a chat looks in the sidebar while the agent is working.')),
				h('div', { className: 'rzd-chips', role: 'radiogroup', 'aria-label': 'Effect' }, EFFECTS.map((e) =>
					h('button', { key: e.id, type: 'button', role: 'radio', 'aria-checked': s.effect === e.id, className: 'rzd-chip', onClick: () => store.setSettings({ effect: e.id }) }, h('span', null, e.label), h('small', null, e.hint)))),
				h('style', null, fx.kf + fx.rule),
				h('div', { className: 'rzd-working' }, s.effect === 'off' ? 'Preview: nothing changes (app default).' : 'Preview: this chat is working…'),
				s.effect !== 'off' ? h(Slider, { label: 'Cycle time', min: 1, max: 8, step: 0.5, value: s.speed, unit: 's', onChange: (v) => store.setSettings({ speed: v }) }) : null,
				needsColor ? h('label', { className: 'rzd-slider' }, h('span', null, 'Color'), h('input', { type: 'color', className: 'rzd-color', value: s.effectColor, onChange: (e) => store.setSettings({ effectColor: e.target.value }) }), h('span', null)) : null);
		}

		const PET_CSS = `
.rzp{display:flex;align-items:center;gap:10px;padding:6px 10px;margin:4px auto 0;max-width:420px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;line-height:16px;user-select:none}
.rzp-pet{position:relative;font-size:26px;line-height:30px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:0;background:transparent;padding:0;cursor:pointer;border-radius:50%;transition:transform .12s}
.rzp-pet:active{transform:scale(.88)}
.rzp-pet[data-mood="idle"] .rzp-face,.rzp-pet[data-mood="happy"] .rzp-face{animation:rzpBob 2.4s ease-in-out infinite}
.rzp-pet[data-mood="working"] .rzp-face{animation:rzpHop .6s ease-in-out infinite}
.rzp-pet[data-mood="hungry"] .rzp-face{animation:rzpShake .9s ease-in-out infinite}
.rzp-pet[data-mood="sad"] .rzp-face{filter:grayscale(.7);transform:translateY(2px)}
.rzp-bubble{position:absolute;top:-8px;right:-6px;font-size:13px}
.rzp-col{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.rzp-top{display:flex;gap:8px;align-items:baseline}
.rzp-name{font-weight:600}
.rzp-sub{color:var(--dsw-alias-label-secondary)}
.rzp-bars{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rzp-bar{height:5px;border-radius:3px;background:var(--dsw-alias-border-l1);overflow:hidden}
.rzp-bar>i{display:block;height:100%;border-radius:3px;transition:width .4s}
.rzp-btns{display:flex;gap:4px}
.rzp-btn{border:0.5px solid var(--dsw-alias-border-l2);background:transparent;color:inherit;border-radius:999px;padding:3px 9px;font:inherit;cursor:pointer;transition:background .15s,transform .1s}
.rzp-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.rzp-btn:active:not(:disabled){transform:scale(.95)}
.rzp-btn:disabled{opacity:.45;cursor:default}
.rzp-toast{color:var(--dsw-alias-brand-primary);font-weight:600}
@keyframes rzpBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes rzpHop{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-7px) scale(1.08)}}
@keyframes rzpShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
@media (prefers-reduced-motion:reduce){.rzp-face{animation:none!important}}
`;

		function PetDock(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const pet = st.pet;
			useEffect(() => {
				const id = setInterval(() => store.pet.tick(), 30000);
				return () => clearInterval(id);
			}, [store]);
			if (!s.petEnabled || !pet) return null;
			const mood = petMood(pet, st.working);
			const lvl = petLevel(pet.xp);
			const sp = PET_SPECIES[pet.species] || PET_SPECIES.chick;
			const bar = (value, color, label) => h('div', { className: 'rzp-bar', role: 'meter', 'aria-label': label, 'aria-valuenow': Math.round(value), 'aria-valuemin': 0, 'aria-valuemax': 100, title: label + ' ' + Math.round(value) + '%' }, h('i', { style: { width: Math.round(value) + '%', background: color } }));
			return h('div', { className: 'rzp', role: 'group', 'aria-label': 'Pet ' + pet.name },
				h('style', null, PET_CSS),
				h('button', { type: 'button', className: 'rzp-pet', 'data-mood': mood, 'aria-label': 'Pet ' + pet.name, onClick: () => store.pet.pat() },
					h('span', { className: 'rzp-face' }, sp.emoji),
					MOOD_BUBBLE[mood] ? h('span', { className: 'rzp-bubble', 'aria-hidden': true }, MOOD_BUBBLE[mood]) : null),
				h('div', { className: 'rzp-col' },
					h('div', { className: 'rzp-top' },
						h('span', { className: 'rzp-name' }, pet.name),
						h('span', { className: 'rzp-sub' }, 'Lv ' + lvl + ' \u00B7 ' + pet.coins + ' coins'),
						h('span', { className: st.toast ? 'rzp-toast' : 'rzp-sub', 'aria-live': 'polite' }, st.toast || MOOD_TEXT[mood])),
					h('div', { className: 'rzp-bars' }, bar(pet.hunger, '#f59e0b', 'Fullness'), bar(pet.joy, '#ec4899', 'Joy'))),
				h('div', { className: 'rzp-btns' },
					h('button', { type: 'button', className: 'rzp-btn', title: 'Feed (2 coins)', disabled: pet.coins < FEED_COST, onClick: () => store.pet.feed() }, 'Feed'),
					h('button', { type: 'button', className: 'rzp-btn', title: 'Play', onClick: () => store.pet.play() }, 'Play')));
		}

		function PetCard(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const pet = st.pet;
			const [name, setName] = useState('');
			useEffect(() => { if (pet && name === '') setName(pet.name); }, [pet && pet.name]);
			return h('section', { className: 'rzd-card', 'aria-label': 'Pet' },
				h('div', { className: 'rzd-row' },
					h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Pet'), h('div', { className: 'rzd-sub' }, 'A little pet under the chat box. Finished chats earn it coins. Feed it, play with it, unlock new friends. It never dies, it just gets sad.')),
					h(Switch, { checked: s.petEnabled, label: 'Show pet', onChange: (v) => store.setSettings({ petEnabled: v }) })),
				pet ? h('div', { className: 'rzd-col' },
					h('div', { className: 'rzd-row', style: { justifyContent: 'flex-start' } },
						h('span', { className: 'rzd-sub' }, 'Name'),
						h('input', { className: 'rzd-input', style: { maxWidth: 180 }, value: name, maxLength: 16, 'aria-label': 'Pet name', onChange: (e) => setName(e.target.value), onBlur: () => name.trim() && store.pet.rename(name.trim()) }),
						h('span', { className: 'rzd-sub' }, 'Lv ' + petLevel(pet.xp) + ' \u00B7 ' + pet.coins + ' coins')),
					h('div', { className: 'rzd-chips', role: 'radiogroup', 'aria-label': 'Species' }, Object.keys(PET_SPECIES).map((id) => {
						const owned = pet.unlocked.includes(id);
						const cost = PET_SPECIES[id].cost;
						return h('button', { key: id, type: 'button', role: 'radio', 'aria-checked': pet.species === id, className: 'rzd-chip', style: { minWidth: 110 }, onClick: () => store.pet.buy(id) },
							h('span', null, PET_SPECIES[id].emoji + ' ' + id[0].toUpperCase() + id.slice(1)),
							h('small', null, owned ? (pet.species === id ? 'Current' : 'Owned') : cost + ' coins'));
					}))) : null);
		}

		function BorderCard(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const needsColor = s.borderStyle === 'neon' || s.borderStyle === 'stripes';
			return h('section', { className: 'rzd-card', 'aria-label': 'Window border' },
				h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Window border'), h('div', { className: 'rzd-sub' }, 'A frame around the whole app. It never blocks clicks.')),
				h('div', { className: 'rzd-chips', role: 'radiogroup', 'aria-label': 'Border style' }, BORDERS.map((b) =>
					h('button', { key: b.id, type: 'button', role: 'radio', 'aria-checked': s.borderStyle === b.id, className: 'rzd-chip', onClick: () => store.setSettings({ borderStyle: b.id }) }, h('span', null, b.label), h('small', null, b.hint)))),
				s.borderStyle !== 'off' ? h(Slider, { label: 'Thickness', min: 1, max: 8, value: s.borderWidth, unit: 'px', onChange: (v) => store.setSettings({ borderWidth: v }) }) : null,
				needsColor ? h('label', { className: 'rzd-slider' }, h('span', null, 'Color'), h('input', { type: 'color', className: 'rzd-color', value: s.borderColor, onChange: (e) => store.setSettings({ borderColor: e.target.value }) }), h('span', null)) : null,
				s.borderStyle !== 'off' ? h('div', { className: 'rzd-row' },
					h('span', null, 'Only show the border while a chat is working'),
					h(Switch, { checked: s.borderOnlyWorking, label: 'Only while working', onChange: (v) => store.setSettings({ borderOnlyWorking: v }) })) : null);
		}

		function TintCard(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const rules = s.tintRules;
			const update = (i, patch) => store.setSettings({ tintRules: rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
			return h('section', { className: 'rzd-card', 'aria-label': 'Chat colors' },
				h('div', { className: 'rzd-row' },
					h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Chat colors'), h('div', { className: 'rzd-sub' }, 'Color a chat in the sidebar when its title has a word you pick. Sub-chats named after their model (like "Opus design audit") get that color.')),
					h(Switch, { checked: s.tintEnabled, label: 'Color chats by name', onChange: (v) => store.setSettings({ tintEnabled: v }) })),
				s.tintEnabled ? h('div', { className: 'rzd-col' },
					rules.map((r, i) => h('div', { key: i, className: 'rzd-row', style: { justifyContent: 'flex-start' } },
						h('span', { className: 'rzd-sub' }, 'Title has'),
						h('input', { className: 'rzd-input', style: { maxWidth: 180, minWidth: 90 }, value: r.match, 'aria-label': 'Word to match', onChange: (e) => update(i, { match: e.target.value }) }),
						h('input', { type: 'color', className: 'rzd-color', value: r.color, 'aria-label': 'Color', onChange: (e) => update(i, { color: e.target.value }) }),
						h('button', { type: 'button', className: 'rzd-btn', 'aria-label': 'Remove rule', onClick: () => store.setSettings({ tintRules: rules.filter((_, j) => j !== i) }) }, 'Remove'))),
					h('div', { className: 'rzd-row', style: { justifyContent: 'flex-start' } },
						rules.length < 12 ? h('button', { type: 'button', className: 'rzd-btn', onClick: () => store.setSettings({ tintRules: rules.concat([{ match: 'new', color: '#f472b6' }]) }) }, 'Add a rule') : null,
						h('span', { className: 'rzd-credit' }, 'Whole words only, first match wins. "sol" will not color "solve".'))) : null);
		}

		function ThemeCard(p) {
			const { store } = p;
			const st = useStore(store);
			const [text, setText] = useState('');
			const [msg, setMsg] = useState({ kind: '', text: '' });
			const note = (kind, t) => {
				setMsg({ kind, text: t });
				setTimeout(() => setMsg({ kind: '', text: '' }), 4000);
			};
			const copy = async () => {
				const out = exportTheme(st.settings);
				try {
					await navigator.clipboard.writeText(out);
					note('ok', 'Copied. Send it to a friend.');
				} catch (e) {
					setText(out);
					note('ok', 'Copy was blocked, so the text is in the box below. Select it and copy.');
				}
			};
			const apply = () => {
				const r = parseTheme(text);
				if (r.error) return note('err', r.error);
				store.setSettings(r.theme);
				setText('');
				note('ok', 'Theme applied. Your background and pet are unchanged.');
			};
			return h('section', { className: 'rzd-card', 'aria-label': 'Themes' },
				h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Themes'), h('div', { className: 'rzd-sub' }, 'One click looks, and a way to share yours. Themes change sliders, effects, borders and colors. They never change your background, pet or GIPHY key.')),
				h('div', { className: 'rzd-chips' }, PRESETS.map((pr) =>
					h('button', { key: pr.id, type: 'button', className: 'rzd-chip', onClick: () => { store.setSettings(pr.theme); note('ok', pr.label + ' applied.'); } }, h('span', null, pr.label), h('small', null, pr.hint)))),
				h('div', { className: 'rzd-row', style: { justifyContent: 'flex-start' } },
					h('button', { type: 'button', className: 'rzd-btn', onClick: copy }, 'Copy my look'),
					msg.text ? h('span', { className: msg.kind === 'err' ? 'rzd-err' : 'rzd-ok', role: msg.kind === 'err' ? 'alert' : 'status' }, msg.text) : null),
				h('div', { className: 'rzd-row' },
					h('input', { className: 'rzd-input', placeholder: 'Paste a theme someone sent you', value: text, 'aria-label': 'Theme text', onChange: (e) => setText(e.target.value) }),
					h('button', { type: 'button', className: 'rzd-btn', 'data-primary': '', disabled: !text.trim(), onClick: apply }, 'Apply')));
		}

		function makeSection(store) {
			return function DesignOptions() {
				const st = useStore(store);
				return h('div', { className: 'rzd' },
					h('style', null, CSS),
					h('div', { className: 'rzd-head' },
						h('h2', { className: 'rzd-h1' }, 'Design Options'),
						h('div', { className: 'rzd-sub' }, 'Rayskinz DSH Design. Backgrounds and effects are saved on this computer and apply to every chat.')),
					!st.ready ? h('div', { className: 'rzd-sub' }, 'Loading…') : null,
					h(ThemeCard, { store }),
					h(BackgroundCard, { store }),
					h(EffectCard, { store }),
					h(BorderCard, { store }),
					h(TintCard, { store }),
					h(PetCard, { store }),
					h('div', { className: 'rzd-row' },
						h('button', { type: 'button', className: 'rzd-btn', onClick: () => store.setSettings({ ...DEFAULTS, giphyKey: store.get().settings.giphyKey }) }, 'Reset all options'),
						h('span', { className: 'rzd-credit' }, 'Rayskinz DSH Design 0.4.0')));
			};
		}

		return {
			__test: { effectCss, borderCss, tintFor, hexRgb, clamp, petTick, petFeed, petPlay, petPat, petReward, petBuy, petMood, petLevel, themeFrom, exportTheme, parseTheme, PRESETS },
			inject: ['slots', 'connection'],
			apply(ctx) {
				const store = createStore(ctx.get('connection').rpc);
				store.load();
				ctx.effect(() => mountEngine(store), 'rayskinz-design: background and effect engine');
				ctx.effect(() => () => store.dispose(), 'rayskinz-design: store');
				const Section = makeSection(store);
				ctx.slots.inject('settings.section', () =>
					ctx.slots.register({ name: 'settings.section', id: 'rayskinz-design', order: 30, label: () => 'Design Options' }, Section));
				const Pet = function PetSeat() {
					return h(PetDock, { store });
				};
				ctx.slots.inject('conversation.composer.dock', () =>
					ctx.slots.register({ name: 'conversation.composer.dock', id: 'rayskinz-pet', order: 40 }, Pet));
				ctx.effect(() => {
					// The sidebar shows a spinning dot on every working chat; a chat that stops
					// working earns the pet its reward.
					let was = false;
					const check = () => {
						const now = !!document.querySelector('svg[data-state="ongoing"]');
						if (was && !now) store.pet.reward();
						was = now;
						store.setWorking(now);
					};
					const mo = new MutationObserver(() => { clearTimeout(check.t); check.t = setTimeout(check, 400); });
					mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
					check();
					return () => { mo.disconnect(); clearTimeout(check.t); store.flushPet(); };
				}, 'rayskinz-design: pet working watcher');
			},
		};
	},
});
