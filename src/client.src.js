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
			bgEnabled: true, panel: 55, dim: 0, blur: 0, effect: 'off', speed: 3, effectColor: '#60a5fa', giphyKeySet: false,
			borderStyle: 'off', borderWidth: 2, borderColor: '#7c5cff', borderOnlyWorking: false,
			intensity: 70, stateEffects: { warning: 'pulse', error: 'off', done: 'off' }, stateColors: { warning: '#fbbf24', error: '#f87171', done: '#4ade80' },
			celebrate: 'off', celebrateOnGame: true, accent: '', accentEnabled: false, fontFamily: 'default', fontSize: 0, lineSpacing: 0, userBubble: 'default', chatWidth: 0, avatarAssistantKind: 'none', avatarUserKind: 'none', avatarAssistantEmoji: '\u{1F916}', avatarUserEmoji: '\u{1F9D1}', avatarSize: 26, familyTint: true, lineageBadges: true,
			tintEnabled: false, petEnabled: false, windowX: -1, windowY: -1, windowTab: 'pet', windowMin: false, windowOpen: false, windowSize: 1,
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
			{ id: 'aurora', label: 'Aurora', hint: 'Soft green and violet curtains drift' },
			{ id: 'matrix', label: 'Matrix', hint: 'Green code rains down the row' },
			{ id: 'lightning', label: 'Lightning', hint: 'Quick electric flashes' },
		];
		const STATE_LIST = [
			{ key: 'warning', label: 'Waiting for you', hint: 'Needs an approval or an answer' },
			{ key: 'error', label: 'Error', hint: 'Something went wrong' },
			{ key: 'done', label: 'Finished', hint: 'A chat that completed' },
		];
		const STATE_EFFECT_LIST = [['off', 'Off'], ['pulse', 'Pulse'], ['scanner', 'Scanner'], ['ember', 'Ember']];
		const CELEBRATIONS = [['off', 'Off'], ['confetti', 'Confetti'], ['sparkles', 'Sparkles'], ['hearts', 'Hearts']];
		const RAINBOW = ['255,60,60', '255,170,40', '255,235,60', '60,230,110', '60,170,255', '170,90,255'];
		const WORKING = '[role="treeitem"]:has(svg[data-state="ongoing"])';
		const WORKING_ICON = WORKING + ' svg[data-state="ongoing"]';

/*@games*/
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
		function hexRgb(hex) {
			const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
			if (!m) return '255,48,48';
			const n = parseInt(m[1], 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
		}

		// ---------------------------------------------------------------- effects
		// One effect as CSS for any selector. `k` is the intensity (0.1 - 1): it scales glow strength and
		// fill opacity, so a low setting is a quiet hint and 100 is the full show. `name` keeps keyframes unique
		// per state so several effects can run at once.
		function effectCss(s, sel, icon, opt) {
			const o = opt || {};
			const effect = o.effect || s.effect;
			const k = clamp((o.intensity !== undefined ? o.intensity : s.intensity !== undefined ? s.intensity : 70) / 100, 0.1, 1);
			const d = clamp(Number(s.speed) || 3, 1, 8);
			const c = hexRgb(o.color || s.effectColor);
			const n = o.name || 'rzd';
			const a = (v) => (v * (0.35 + k * 0.9)).toFixed(3);
			const px = (v) => Math.max(1, Math.round(v * (0.25 + k * 0.5)));
			const iconOn = (color) => icon + '{color:' + color + '!important;filter:drop-shadow(0 0 ' + px(4) + 'px ' + color + ')}';
			if (effect === 'rainbow') {
				const stops = RAINBOW.concat(RAINBOW[0]).map((x) => 'rgba(' + x + ',' + a(0.38) + ')').join(',');
				const glow = RAINBOW.concat(RAINBOW[0]).map((x, i, arr) => Math.round((i / (arr.length - 1)) * 100) + '%{box-shadow:0 0 ' + px(10) + 'px 2px rgba(' + x + ',' + a(0.8) + ')}').join('');
				return {
					kf: '@keyframes ' + n + 'Wave{0%{background-position:0% 50%}100%{background-position:200% 50%}}@keyframes ' + n + 'Glow{' + glow + '}@keyframes ' + n + 'Hue{0%{filter:hue-rotate(0deg) drop-shadow(0 0 4px currentColor)}100%{filter:hue-rotate(360deg) drop-shadow(0 0 4px currentColor)}}',
					rule: sel + '{background-color:transparent!important;background-image:linear-gradient(100deg,' + stops + ')!important;background-size:200% 100%!important;border-radius:8px;animation:' + n + 'Wave ' + d + 's linear infinite,' + n + 'Glow ' + d + 's linear infinite}' + icon + '{color:#ff3030!important;animation:' + n + 'Hue ' + d + 's linear infinite}',
				};
			}
			if (effect === 'pulse') {
				return {
					kf: '@keyframes ' + n + 'Pulse{0%,100%{box-shadow:0 0 ' + px(6) + 'px 1px rgba(' + c + ',' + a(0.55) + '),inset 0 0 ' + px(8) + 'px rgba(' + c + ',' + a(0.25) + ')}50%{box-shadow:0 0 ' + px(16) + 'px 4px rgba(' + c + ',' + a(0.95) + '),inset 0 0 ' + px(14) + 'px rgba(' + c + ',' + a(0.45) + ')}}',
					rule: sel + '{background:rgba(' + c + ',' + a(0.12) + ')!important;border-radius:8px;animation:' + n + 'Pulse ' + (d * 0.55).toFixed(2) + 's ease-in-out infinite}' + iconOn('rgb(' + c + ')'),
				};
			}
			if (effect === 'scanner') {
				return {
					kf: '@keyframes ' + n + 'Scan{0%{background-position:0% 50%}100%{background-position:100% 50%}}',
					rule: sel + '{background-color:rgba(' + c + ',' + a(0.08) + ')!important;background-image:linear-gradient(90deg,transparent,rgba(' + c + ',' + a(0.6) + ') 50%,transparent)!important;background-size:38% 100%!important;background-repeat:no-repeat!important;border-radius:8px;box-shadow:0 0 ' + px(8) + 'px 1px rgba(' + c + ',' + a(0.35) + ');animation:' + n + 'Scan ' + (d * 0.5).toFixed(2) + 's ease-in-out infinite alternate}' + iconOn('rgb(' + c + ')'),
				};
			}
			if (effect === 'ember') {
				// A state ember is tinted from the state's own hue only; the working ember stays orange.
				const hot = o.color ? c : '255,120,30', warm = o.color ? c : '255,170,40', deep = o.color ? c : '255,80,0', low = o.color ? c : '255,60,0', mid = o.color ? c : '255,90,20', top = o.color ? c : '255,110,20';
				return {
					kf: '@keyframes ' + n + 'Ember{0%,100%{box-shadow:0 0 ' + px(8) + 'px 1px rgba(' + hot + ',' + a(0.6) + '),inset 0 -6px ' + px(10) + 'px rgba(' + deep + ',' + a(0.25) + ')}30%{box-shadow:0 0 ' + px(14) + 'px 3px rgba(' + warm + ',' + a(0.85) + '),inset 0 -10px ' + px(14) + 'px rgba(' + hot + ',' + a(0.35) + ')}60%{box-shadow:0 0 ' + px(10) + 'px 2px rgba(' + mid + ',' + a(0.7) + '),inset 0 -4px ' + px(8) + 'px rgba(' + low + ',' + a(0.2) + ')}}',
					rule: sel + '{background:linear-gradient(0deg,rgba(' + top + ',' + a(0.28) + '),rgba(' + low + ',' + a(0.06) + '))!important;border-radius:8px;animation:' + n + 'Ember ' + (d * 0.4).toFixed(2) + 's ease-in-out infinite}' + iconOn(o.color ? 'rgb(' + c + ')' : '#ff8a2a'),
				};
			}			if (effect === 'aurora') {
				return {
					kf: '@keyframes ' + n + 'Aurora{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
					rule: sel + '{background-color:transparent!important;background-image:linear-gradient(115deg,rgba(52,211,153,' + a(0.32) + '),rgba(56,189,248,' + a(0.26) + '),rgba(167,139,250,' + a(0.34) + '),rgba(52,211,153,' + a(0.28) + '))!important;background-size:300% 100%!important;border-radius:8px;box-shadow:0 0 ' + px(12) + 'px rgba(94,234,212,' + a(0.28) + ');animation:' + n + 'Aurora ' + (d * 2.2).toFixed(2) + 's ease-in-out infinite}' + iconOn('#5eead4'),
				};
			}
			if (effect === 'matrix') {
				const g = 'rgba(34,255,120,'; const ttl = sel + ' [class*="title"]';
				return {
					kf: '@keyframes ' + n + 'Rain{0%{background-position:0 0,0 0}100%{background-position:0 18px,0 34px}}',
					rule: sel + '{background-color:rgba(0,40,18,' + a(0.55) + ')!important;background-image:repeating-linear-gradient(180deg,' + g + a(0.3) + ') 0 2px,transparent 2px 7px),repeating-linear-gradient(90deg,transparent 0 5px,' + g + a(0.12) + ') 5px 6px)!important;background-size:100% 18px,12px 34px!important;border-radius:8px;box-shadow:0 0 ' + px(8) + 'px ' + g + a(0.4) + ');animation:' + n + 'Rain ' + (d * 0.35).toFixed(2) + 's linear infinite}' + ttl + '{background:rgba(0,28,12,.78);color:#d9ffe6!important;padding:0 5px;border-radius:4px}' + iconOn('#22ff78'),
				};
			}
			if (effect === 'lightning') {
				return {
					kf: '@keyframes ' + n + 'Zap{0%,86%,100%{box-shadow:0 0 ' + px(4) + 'px rgba(147,197,253,' + a(0.18) + ');background:rgba(30,58,138,' + a(0.12) + ')}88%{box-shadow:0 0 ' + px(22) + 'px 5px rgba(224,242,254,' + a(1) + '),inset 0 0 ' + px(16) + 'px rgba(224,242,254,' + a(0.7) + ');background:rgba(186,230,253,' + a(0.45) + ')}90%{box-shadow:0 0 ' + px(6) + 'px rgba(147,197,253,' + a(0.3) + ');background:rgba(30,58,138,' + a(0.16) + ')}93%{box-shadow:0 0 ' + px(18) + 'px 3px rgba(191,219,254,' + a(0.9) + ');background:rgba(147,197,253,' + a(0.35) + ')}}',
					rule: sel + '{background:rgba(30,58,138,' + a(0.12) + ')!important;border-radius:8px;animation:' + n + 'Zap ' + (d * 0.9).toFixed(2) + 's linear infinite}' + iconOn('#3b82f6') + icon + '{opacity:1!important}',
				};
			}
			return { kf: '', rule: '' };
		}

		// The working effect plus the optional looks for the other row states (waiting, error, done).
		// Each state targets the sidebar dot the app already draws, so nothing here needs app internals.
		const STATE_HUES = { warning: '#f59e0b', error: '#ef4444', done: '#22c55e' };
		const STATE_SELECTORS = {
			warning: ['[role="treeitem"]:has(svg[data-state="warning"])', '[role="treeitem"] svg[data-state="warning"]'],
			error: ['[role="treeitem"]:has(svg[data-state="error"])', '[role="treeitem"] svg[data-state="error"]'],
			done: ['[role="treeitem"]:has(svg[data-state="done"])', '[role="treeitem"] svg[data-state="done"]'],
		};
		function allEffectsCss(s) {
			const main = effectCss(s, WORKING, WORKING_ICON);
			let kf = main.kf, rule = main.rule;
			for (const key of Object.keys(STATE_SELECTORS)) {
				const effect = s.stateEffects && s.stateEffects[key];
				if (!effect || effect === 'off') continue;
				const sel = STATE_SELECTORS[key];
				const part = effectCss(s, sel[0], sel[1], { effect, color: (s.stateColors && /^#[0-9a-f]{6}$/i.test(s.stateColors[key] || '') ? s.stateColors[key] : STATE_HUES[key]), name: 'rzd' + key[0].toUpperCase() + key.slice(1), intensity: Math.min(s.intensity !== undefined ? s.intensity : 70, 80) });
				kf += part.kf; rule += part.rule;
			}
			return { kf, rule };
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
		// Rows carry --rzd-tint; sub-chat labels carry a text badge; nested groups get a coloured branch line.
		const TINT_CSS = '[data-rzd-tint]{--rzd-tint-fill:color-mix(in srgb,var(--rzd-tint) 14%,transparent)}[data-rzd-tint]::before{content:"";position:absolute;left:0;top:5px;bottom:5px;width:3px;border-radius:2px;background:var(--rzd-tint);pointer-events:none}[data-rzd-tint]:not(:hover){background-image:linear-gradient(90deg,var(--rzd-tint-fill),transparent 75%)}'
			+ '[data-rzd-badge]::before{content:attr(data-rzd-badge);display:inline-block;margin-right:6px;padding:0 6px;border-radius:999px;font-size:10px;line-height:15px;font-weight:600;vertical-align:1px;color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--rzd-badge) 24%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rzd-badge) 70%,transparent)}'
			+ '[data-subagent-panel] [role="group"][data-rzd-branch]{margin-left:8px;padding-left:2px;border-left:2px solid color-mix(in srgb,var(--rzd-branch) 65%,transparent);border-radius:0 0 0 6px}';
		// ----------------------------------------------------------------- themes
		// A theme is only settings (no background file, no GIPHY key, no pet).
		const THEME_KEYS = ['fontFamily', 'fontSize', 'lineSpacing', 'chatWidth', 'userBubble', 'intensity', 'stateEffects', 'stateColors', 'celebrate', 'accent', 'accentEnabled', 'familyTint', 'lineageBadges', 'panel', 'dim', 'blur', 'effect', 'speed', 'effectColor', 'borderStyle', 'borderWidth', 'borderColor', 'borderOnlyWorking', 'tintEnabled', 'tintRules'];
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

		// Settings from disk or from a shared theme may lack newer keys: always lay them over the defaults,
		// including the two nested maps, so no component ever meets an undefined.
		function withDefaults(s) {
			const o = Object.assign({}, DEFAULTS, s || {});
			o.stateEffects = Object.assign({}, DEFAULTS.stateEffects, (s && s.stateEffects) || {});
			o.stateColors = Object.assign({}, DEFAULTS.stateColors, (s && s.stateColors) || {});
			if (!Array.isArray(o.tintRules)) o.tintRules = DEFAULTS.tintRules.slice();
			return o;
		}

		// ------------------------------------------------------------------ store
		function createStore(rpc) {
			let state = { ready: false, busy: '', error: '', settings: withDefaults(DEFAULTS), bg: { has: false }, pet: null, lib: libEmpty(), thumbs: {}, avatars: { assistant: '', user: '' }, ctx: { chat: null, space: null, mood: null, tick: 0 }, shown: { id: null, why: 'none' }, working: false, toast: '', buddy: null, say: '', perch: false, burst: null };
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
						const [settings, data, pet, libr, th, av] = await Promise.all([call('getSettings'), call('data'), call('getPet'), call('libList').catch(() => ({ lib: libEmpty() })), call('libThumbs').catch(() => ({ thumbs: {} })), call('avatarGet').catch(() => ({ assistant: '', user: '' }))]);
						set({ ready: true, settings: withDefaults(settings), bg: toBg(data), pet: petTick(pet, Date.now()), lib: libClean(libr && libr.lib), thumbs: (th && th.thumbs) || {}, avatars: { assistant: avatarImage(av && av.assistant), user: avatarImage(av && av.user) }, ctx: { ...state.ctx, seed: (Date.now() ^ 0x5bd1e995) >>> 0 }, error: '' });
						refreshShown();
						return;
					} catch (e) {
						if (i === 5) set({ ready: true, error: 'Could not reach the Design plugin host: ' + (e && e.message) });
						else await sleep(1200 * (i + 1));
					}
				}
			}
			function setSettings(patch) {
				const settings = withDefaults({ ...state.settings, ...patch });
				set({ settings });
				clearTimeout(saveTimer);
				saveTimer = setTimeout(() => {
					const { giphyKeySet, ...toSave } = settings;
					call('setSettings', toSave).catch((e) => set({ error: 'Could not save settings: ' + e.message }));
				}, 350);
			}
			// A small JPEG preview of a library entry, drawn in the page (the host cannot decode GIFs).
			async function makeThumb(dataUrl, ext) {
				try {
					const video = /^(mp4|webm)$/.test(ext);
					const el = document.createElement(video ? 'video' : 'img');
					if (video) { el.muted = true; el.playsInline = true; }
					await new Promise((ok, no) => { el.onload = el.onloadeddata = ok; el.onerror = no; el.src = dataUrl; setTimeout(no, 8000); });
					const w = video ? el.videoWidth : el.naturalWidth, h2 = video ? el.videoHeight : el.naturalHeight;
					if (!w || !h2) return null;
					const k = Math.min(1, 240 / Math.max(w, h2));
					const cv = document.createElement('canvas');
					cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h2 * k));
					cv.getContext('2d').drawImage(el, 0, 0, cv.width, cv.height);
					const out = cv.toDataURL('image/jpeg', 0.7);
					return out.length < 110000 ? out : cv.toDataURL('image/jpeg', 0.4);
				} catch { return null; }
			}
			const cache = new Map(); // id -> { url, ext, version } for the entries shown in this page
			async function fetchEntry(id) {
				if (cache.has(id)) return cache.get(id);
				const d = await call('libData', { id });
				const e = { has: true, version: id, ext: d.ext, mime: d.mime, url: 'data:' + d.mime + ';base64,' + d.base64 };
				cache.set(id, e);
				if (cache.size > 6) cache.delete(cache.keys().next().value);
				return e;
			}
			async function refreshShown() {
				const s = state;
				const pick = libPick(s.lib, { chat: s.ctx.chat, space: s.ctx.space, mood: s.ctx.mood, tick: s.ctx.tick, seed: s.ctx.seed || 1 });
				if (pick.id === s.shown.id && pick.why === s.shown.why) return;
				if (!pick.id) { set({ shown: pick, bg: { has: false } }); return; }
				try {
					const bg = await fetchEntry(pick.id);
					if (state.lib.items.some((i) => i.id === pick.id)) set({ shown: pick, bg });
				} catch (e) { set({ error: e.message }); }
			}
			function setCtx(patch) {
				const next = { ...state.ctx, ...patch };
				if (next.chat === state.ctx.chat && next.space === state.ctx.space && next.mood === state.ctx.mood && next.tick === state.ctx.tick) return;
				set({ ctx: next });
				refreshShown();
			}
			let libTimer = 0;
			async function saveLib(next) {
				const lib = libClean(next);
				set({ lib });
				refreshShown();
				clearTimeout(libTimer);
				libTimer = setTimeout(() => { call('libSet', { assign: lib.assign, playlist: lib.playlist, current: lib.current }).catch((e) => set({ error: 'Could not save: ' + e.message })); }, 300);
			}
			// Add a background to the library (from the hub, a link or a file) and make it the default.
			async function applyBackground(kind, payload) {
				set({ busy: 'Adding to your library\u2026', error: '' });
				try {
					const body = kind === 'apply' ? { url: payload.url, hub: true, name: payload.name } : kind === 'applyLink' ? { url: payload.url } : payload;
					const r = await call('libAdd', body);
					const lib = { ...libClean(r.lib), current: r.id };
					set({ lib });
					const d = await fetchEntry(r.id);
					makeThumb(d.url, d.ext).then((thumb) => { if (thumb) call('libThumb', { id: r.id, thumb }).then(() => set({ thumbs: { ...state.thumbs, [r.id]: thumb } })).catch(() => {}); });
					await saveLib(lib);
					set({ busy: '' });
					if (!state.settings.bgEnabled) setSettings({ bgEnabled: true });
				} catch (e) {
					set({ busy: '', error: e.message });
				}
			}
			async function removeEntry(id) {
				try {
					const r = await call('libRemove', { id });
					cache.delete(id);
					const thumbs = { ...state.thumbs }; delete thumbs[id];
					set({ lib: libClean(r.lib), thumbs });
					refreshShown();
				} catch (e) { set({ error: e.message }); }
			}
			async function clearBackground() {
				if (state.lib.current) await removeEntry(state.lib.current);
				else set({ bg: { has: false }, error: '' });
			}			let petTimer = 0;
			let toastTimer = 0;
			let sayTimer = 0;
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
			state.burstNow = (kind) => set({ burst: { id: (state.burst ? state.burst.id : 0) + 1, kind, at: null } });
			const petActions = {
				feed: () => (state.pet && state.pet.coins >= FEED_COST ? pet(petFeed, 'Nom nom') : toast('Not enough coins. Finished chats earn them.')),
				play: () => pet(petPlay, 'Wheee'),
				pat: () => pet(petPat, 'Purr'),
				reward: () => pet(petReward, '+3 coins'),
				finishGame: (game, score) => {
					const before = state.pet;
					if (!before) return null;
					const r = petAfterGame(petTick(before, Date.now()), game, score);
					set({ pet: r.pet });
					savePet();
					if (r.reward.coins > 0) toast('+' + r.reward.coins + ' coins');
					return r;
				},
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
				celebrateGame: () => { if (state.settings.celebrateOnGame) { const k = state.settings.celebrate; if (k && k !== 'off') state.burstNow(k); } },
				celebrate: (kindOverride, at) => {
					const kind = kindOverride || state.settings.celebrate;
					if (!kind || kind === 'off' || !FX_KINDS.includes(kind)) return;
					set({ burst: { id: (state.burst ? state.burst.id : 0) + 1, kind, at: at || null } });
				},
				setPerch: (v) => { if (v !== state.perch) set({ perch: v }); },
				say: (line, ms = 3200) => {
					clearTimeout(sayTimer);
					set({ say: line });
					if (line) sayTimer = setTimeout(() => set({ say: '' }), ms);
				},
				setBuddy: (rect) => {
					const a = state.buddy, b = rect;
					if (a === b || (a && b && a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom)) return;
					set({ buddy: b });
				},
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
				removeEntry,
				setAvatar: async (side, image) => {
					try {
						const r = await call('avatarSet', { side, image });
						set({ avatars: { ...state.avatars, [side]: avatarImage(r.image) }, error: '' });
					} catch (e) { set({ error: e.message }); }
				},
				saveLib,
				setCtx,
				refreshShown,
				clearError: () => set({ error: '' }),
				saveGiphyKey: async (key) => {
					try {
						const settings = await call('setGiphyKey', { key });
						set({ settings: { ...state.settings, giphyKeySet: settings.giphyKeySet }, error: '' });
					} catch (e) {
						set({ error: e.message });
					}
				},
				dispose: () => {
					clearTimeout(libTimer);
					clearTimeout(saveTimer);
					clearTimeout(petTimer);
					clearTimeout(toastTimer);
					clearTimeout(sayTimer);
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
			const avatarStyle = document.createElement('style');
			avatarStyle.setAttribute('data-rayskinz-design', 'avatar');
			const lookStyle = document.createElement('style');
			lookStyle.setAttribute('data-rayskinz-design', 'look');
			document.head.append(bgStyle, fxStyle, frameStyle, tintStyle, lookStyle, avatarStyle);
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
			let badged = new Set();
			let grouped = new Set();
			function clearTints() {
				for (const el of tinted) { el.removeAttribute('data-rzd-tint'); el.style.removeProperty('--rzd-tint'); }
				for (const el of badged) { el.removeAttribute('data-rzd-badge'); el.style.removeProperty('--rzd-badge'); }
				for (const el of grouped) { el.removeAttribute('data-rzd-branch'); el.style.removeProperty('--rzd-branch'); }
				tinted = new Set(); badged = new Set(); grouped = new Set();
			}
			const rowText = (row, sel) => { const el = row.querySelector(sel); return (el ? el.textContent : String(row.innerText || '').split('\n')[0]) || ''; };
			const cap = (w) => (w ? w[0].toUpperCase() + w.slice(1) : '');
			// Two places show chats as rows: the sidebar list (each chat on its own, matched by title) and the
			// sub-chat tree in the header menu (nested by aria-level: children inherit a darker shade of the parent's colour).
			function applyTints(s) {
				if (!s.tintEnabled || !s.tintRules.length) {
					clearTints();
					tintStyle.textContent = '';
					return;
				}
				tintStyle.textContent = TINT_CSS;
				const nextT = new Set(), nextB = new Set(), nextG = new Set();
				const paint = (row, color) => {
					if (getComputedStyle(row).position === 'static') row.style.position = 'relative';
					row.setAttribute('data-rzd-tint', ''); row.style.setProperty('--rzd-tint', color); nextT.add(row);
				};
				document.querySelectorAll('[role="treeitem"][data-row-key^="session:"]').forEach((row) => {
					const m = famMatch(rowText(row, '[class*="title"]'), s.tintRules);
					if (m) paint(row, m.color.toLowerCase());
				});
				const panelRows = [...document.querySelectorAll('[data-subagent-panel] [role="treeitem"]')];
				if (panelRows.length) {
					const info = famResolve(panelRows.map((r) => ({ level: Number(r.getAttribute('aria-level')) || 1, text: rowText(r, '[class*="label"]') })), s.tintRules);
					panelRows.forEach((row, i) => {
						const r = info[i];
						if (!r.color || (r.inherited && !s.familyTint)) return;
						paint(row, r.color);
						const label = row.querySelector('[class*="label"]');
						if (label && s.lineageBadges) {
							const dot = row.querySelector('svg[data-state]');
							const state = dot ? famStateWord(dot.getAttribute('data-state')) : '';
							label.setAttribute('data-rzd-badge', cap(r.word) + (state && state !== 'idle' ? ' \u00B7 ' + state : ''));
							label.style.setProperty('--rzd-badge', r.color); nextB.add(label);
						}
						const group = row.parentElement && row.parentElement.querySelector(':scope > [role="group"]');
						if (group) { group.setAttribute('data-rzd-branch', ''); group.style.setProperty('--rzd-branch', r.color); nextG.add(group); }
					});
				}
				for (const el of tinted) if (!nextT.has(el)) { el.removeAttribute('data-rzd-tint'); el.style.removeProperty('--rzd-tint'); }
				for (const el of badged) if (!nextB.has(el)) { el.removeAttribute('data-rzd-badge'); el.style.removeProperty('--rzd-badge'); }
				for (const el of grouped) if (!nextG.has(el)) { el.removeAttribute('data-rzd-branch'); el.style.removeProperty('--rzd-branch'); }
				tinted = nextT; badged = nextB; grouped = nextG;
			}
			// Accent colour: recolours the app's own accent tokens (selected tab underline, focus rings, links,
			// primary buttons) and this plugin's own controls. Text on it is picked for contrast.
			const ACCENT_TOKENS = ['--dsw-alias-state-business-primary', '--dsw-alias-brand-primary', '--dsw-alias-brand-primary-invert', '--rzd-accent', '--rzd-accent-text'];
			// Chat look: fonts, size, spacing, width, bubble. Size is measured from the app's own value with our override
			// removed first, so "+2" always means two px above whatever the user chose in the app's settings.
			function applyLook(s) {
				lookStyle.textContent = '';
				const cs = getComputedStyle(body);
				const size = parseFloat(cs.getPropertyValue('--dsh-content-font-size')) || 14;
				const accent = s.accentEnabled && /^#[0-9a-f]{6}$/i.test(s.accent || '') ? s.accent : '';
				const text = accent ? (famContrast(accent, '#ffffff') >= famContrast(accent, '#111111') ? '#ffffff' : '#111111') : '';
				lookStyle.textContent = lookCss({ ...s, accentText: text }, { size });
			}			function applyAvatars(s) {
				const st = store.get();
				const species = st.pet ? (PET_SPECIES[st.pet.species] || PET_SPECIES.chick) : null;
				avatarStyle.textContent = avatarCss(s, st.avatars, species ? species.emoji : '');
			}
			function applyAccent(s) {
				const on = !!(s.accentEnabled && /^#[0-9a-f]{6}$/i.test(s.accent || ''));
				for (const k of ACCENT_TOKENS) body.style.removeProperty(k);
				if (!on) return;
				const text = famContrast(s.accent, '#ffffff') >= famContrast(s.accent, '#111111') ? '#ffffff' : '#111111';
				body.style.setProperty('--dsw-alias-state-business-primary', s.accent);
				body.style.setProperty('--dsw-alias-brand-primary', s.accent);
				body.style.setProperty('--dsw-alias-brand-primary-invert', text);
				body.style.setProperty('--rzd-accent', s.accent);
				body.style.setProperty('--rzd-accent-text', text);
			}			let tintTimer = 0;
			const listMo = new MutationObserver(() => {
				clearTimeout(tintTimer);
				tintTimer = setTimeout(() => applyTints(store.get().settings), 120);
			});
			listMo.observe(document.body, { childList: true, subtree: true, characterData: true });
			// Which chat is open, in which workspace, and what mood is it in? Read from the sidebar's own
			// markers (the selected session row, its parent workspace row, its status dot). Playlist steps tick on a timer.
			function readContext() {
				const row = document.querySelector('[role="treeitem"][data-row-key^="session:"][aria-selected="true"]');
				const chat = row ? libKeyOf(row.getAttribute('data-row-key')) : null;
				let space = null;
				if (row) {
					const all = [...document.querySelectorAll('[role="treeitem"][data-row-key]')];
					const at = all.indexOf(row);
					for (let i = at - 1; i >= 0; i--) { const k = all[i].getAttribute('data-row-key'); if (k && k.startsWith('workspace:')) { space = libKeyOf(k); break; } }
				}
				const dot = row ? row.querySelector('svg[data-state]') : null;
				return { chat, space, mood: dot ? libMoodOf(dot.getAttribute('data-state')) : null };
			}
			let ctxTimer = 0;
			const ctxMo = new MutationObserver(() => {
				clearTimeout(ctxTimer);
				ctxTimer = setTimeout(() => store.setCtx(readContext()), 150);
			});
			ctxMo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'data-state'] });
			store.setCtx(readContext());
			let rotateTimer = 0;
			function armRotate() {
				clearTimeout(rotateTimer);
				const { lib } = store.get();
				if (!lib.playlist.on || lib.playlist.ids.length < 2) return;
				rotateTimer = setTimeout(() => { store.setCtx({ tick: store.get().ctx.tick + 1 }); armRotate(); }, lib.playlist.minutes * 60000);
			}
			let armedKey = '';
			const unsubRotate = store.subscribe(() => {
				const p = store.get().lib.playlist;
				const k = [p.on, p.ids.join(','), p.minutes].join('|');
				if (k !== armedKey) { armedKey = k; armRotate(); }
			});
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
				const fx = allEffectsCss(s);
				fxStyle.textContent = fx.kf + fx.rule;
				renderBorder(s);
				applyTints(s);
				applyAccent(s);
				applyLook(s);
				applyAvatars(s);
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
			ctxMo.disconnect();
			unsubRotate();
			clearTimeout(ctxTimer);
			clearTimeout(rotateTimer);
			lookStyle.remove();
			avatarStyle.remove();
				clearTimeout(tintTimer);
				clearTints();
				for (const k of ACCENT_TOKENS) body.style.removeProperty(k);
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
.rzd-btn[data-primary]{background:var(--rzd-accent,var(--dsw-alias-brand-primary));border-color:transparent;color:var(--rzd-accent-text,var(--dsw-alias-bg-base))}
.rzd-btn[data-primary]:hover:not(:disabled){background:var(--rzd-accent,var(--dsw-alias-brand-primary));filter:brightness(1.1)}
.rzd-tabs{display:flex;gap:6px;flex-wrap:wrap}
.rzd-tab{border:0.5px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:999px;padding:5px 14px;font:inherit;cursor:pointer;transition:background .15s,color .15s}
.rzd-tab:hover{background:var(--dsw-alias-bg-layer-2)}
.rzd-tab[data-on]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--rzd-accent,var(--dsw-alias-brand-primary))}
.rzd-tab[aria-selected="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--rzd-accent,var(--dsw-alias-brand-primary))}
.rzd-input{flex:1;min-width:140px;border:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:inherit;border-radius:8px;padding:7px 10px;font:inherit;outline:none}
.rzd-input:focus{border-color:var(--rzd-accent,var(--dsw-alias-brand-primary))}
.rzd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.rzd-thumb{position:relative;aspect-ratio:16/10;padding:0;border:2px solid transparent;border-radius:10px;overflow:hidden;cursor:pointer;background:var(--dsw-alias-bg-layer-2);transition:transform .15s,border-color .15s}
.rzd-thumb:hover:not(:disabled){transform:translateY(-2px);border-color:var(--dsw-alias-border-l2)}
.rzd-thumb:disabled{cursor:default;opacity:.7}
.rzd-thumb[data-picked]{border-color:var(--rzd-accent,var(--dsw-alias-brand-primary))}
.rzd-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.rzd-libgrid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr))}
.rzd-nothumb{display:flex;align-items:center;justify-content:center;height:100%;min-height:62px;font-size:22px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}
.rzd-libname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%}
.rzd-tab:disabled{opacity:.45;cursor:default}
.rzd-emoji{width:38px;height:38px;font-size:20px;line-height:1;border-radius:10px;border:0.5px solid var(--dsw-alias-border-l2);background:transparent;cursor:pointer;padding:0}
.rzd-emoji:hover{background:var(--dsw-alias-bg-layer-2)}
.rzd-emoji[data-on]{border-color:var(--rzd-accent,var(--dsw-alias-brand-primary));box-shadow:inset 0 0 0 1px var(--rzd-accent,var(--dsw-alias-brand-primary))}
.rzd-avatar-prev{width:44px;height:44px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 1px var(--dsw-alias-border-l2)}
.rzd-opt{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;min-height:44px;padding:8px 12px;border-radius:12px;border:0.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}
.rzd-opt:hover{background:var(--dsw-alias-bg-layer-2)}
.rzd-opt[data-on]{border-color:var(--rzd-accent,var(--dsw-alias-brand-primary));box-shadow:inset 0 0 0 1px var(--rzd-accent,var(--dsw-alias-brand-primary))}
.rzd-opt-t{font-weight:600;font-size:13px}.rzd-opt-h{font-size:12px;color:var(--dsw-alias-label-secondary)}
.rzd-tag{position:absolute;left:6px;bottom:6px;padding:1px 6px;border-radius:6px;font-size:11px;line-height:16px;color:#fff;background:rgba(0,0,0,.55)}
.rzd-err{color:var(--dsw-alias-state-error-primary);font-size:13px}
.rzd-ok{color:var(--dsw-alias-state-success-primary);font-size:13px}
.rzd-credit{color:var(--dsw-alias-label-secondary);font-size:12px}
.rzd-preview{height:92px;border-radius:10px;overflow:hidden;border:0.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
.rzd-preview img,.rzd-preview video{width:100%;height:100%;object-fit:cover}
.rzd-slider{display:grid;grid-template-columns:150px 1fr 56px;align-items:center;gap:12px}
.rzd-slider input{width:100%;accent-color:var(--rzd-accent,var(--dsw-alias-brand-primary))}
.rzd-slider output{text-align:right;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.rzd-switch{position:relative;width:38px;height:22px;border-radius:999px;border:0;padding:0;cursor:pointer;background:var(--dsw-alias-border-l2);transition:background .15s;flex:none}
.rzd-switch[aria-checked="true"]{background:var(--rzd-accent,var(--dsw-alias-brand-primary))}
.rzd-switch::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}
.rzd-switch[aria-checked="true"]::after{transform:translateX(16px)}
.rzd-chips{display:flex;gap:8px;flex-wrap:wrap}
.rzd-chip{display:flex;flex-direction:column;gap:2px;text-align:left;min-width:130px;border:0.5px solid var(--dsw-alias-border-l1);background:transparent;color:inherit;border-radius:10px;padding:8px 12px;font:inherit;cursor:pointer;transition:background .15s,border-color .15s}
.rzd-chip:hover{background:var(--dsw-alias-bg-layer-2)}
.rzd-chip[aria-checked="true"]{border-color:var(--rzd-accent,var(--dsw-alias-brand-primary));background:var(--dsw-alias-bg-layer-2)}
.rzd-chip small{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px}
.rzd-working{padding:12px 14px;border-radius:8px;color:var(--dsw-alias-label-secondary);font-size:13px}
.rzd-swatch{width:30px;height:30px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18);transition:transform .12s}
.rzd-swatch:hover{transform:scale(1.1)}
.rzd-swatch[aria-checked="true"]{border-color:var(--dsw-alias-label-primary);box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1),inset 0 0 0 1px rgba(0,0,0,.18)}
.rzd-swatch:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:2px}
.rzd-color{width:38px;height:28px;padding:0;border:0.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;cursor:pointer}
.rzd a{color:var(--rzd-accent,var(--dsw-alias-brand-primary))}
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

		// One search hub for every source. Wallpapers, general GIFs (Wikimedia Commons) and anime GIFs
		// (nekos.best) need no account; GIPHY is optional and needs a free key.
		const HUBS = {
			wallhaven: { endpoint: 'wallhaven', ph: 'Search wallpapers (space, anime, forest...)', credit: 'Wallpapers from Wallhaven (safe for work only).' },
			commons: { endpoint: 'commons', ph: 'Search GIFs (cat, rain, space, fire...)', credit: 'GIFs from Wikimedia Commons, an open archive: no account needed, each file has its own license, and results are NOT filtered for sensitive content (news or science footage can show up). Check a GIF before you keep it.', needsQuery: true },
			anime: { endpoint: 'anime', ph: 'Search by show (avatar, naruto...) or leave empty for random reactions', credit: 'Anime GIFs from nekos.best. No account needed.' },
			giphy: { endpoint: 'giphy', ph: 'Search GIFs (avatar, rain, city...)', credit: 'Powered by GIPHY.', needsKey: true },
		};
		const REACTIONS = ['wave', 'dance', 'happy', 'smile', 'wink', 'blush', 'cuddle', 'pat', 'highfive', 'thumbsup', 'laugh', 'shrug', 'think', 'spin'];
		const SUGGEST = { commons: ['cat', 'fire', 'space', 'rain', 'ocean', 'city', 'robot', 'forest'], wallhaven: ['space', 'anime', 'forest', 'city', 'minimal'] };

		function Hub(p) {
			const { store, kind } = p;
			const st = useStore(store);
			const cfg = HUBS[kind];
			const needsKey = !!cfg.needsKey && !st.settings.giphyKeySet;
			const [q, setQ] = useState('');
			const [items, setItems] = useState([]);
			const [cursor, setCursor] = useState({ page: 1, offset: 0, more: false });
			const [loading, setLoading] = useState(false);
			const [err, setErr] = useState('');
			const [picked, setPicked] = useState('');
			const [reaction, setReaction] = useState('');
			const [keyDraft, setKeyDraft] = useState('');
			const [searched, setSearched] = useState(false);
			const seq = useRef(0);

			const run = useCallback(async (reset, query, react) => {
				const id = ++seq.current;
				setLoading(true);
				setErr('');
				try {
					let r;
					if (kind === 'wallhaven') r = await store.call('wallhaven', { q: query, page: reset ? 1 : cursor.page + 1 });
					else if (kind === 'commons') r = await store.call('commons', { q: query, offset: reset ? 0 : cursor.offset });
					else if (kind === 'anime') r = await store.call('anime', { q: query, reaction: react || '' });
					else r = await store.call('giphy', { q: query, offset: reset ? 0 : cursor.offset });
					if (id !== seq.current) return;
					setItems((cur) => (reset ? r.items : cur.concat(r.items)));
					if (kind === 'wallhaven') setCursor({ page: r.page, offset: 0, more: r.page < r.lastPage });
					else setCursor({ page: 1, offset: r.nextOffset || 0, more: !!r.more });
					setSearched(true);
				} catch (e) {
					if (id === seq.current) { setErr(e.message); setSearched(true); }
				} finally {
					if (id === seq.current) setLoading(false);
				}
			}, [kind, cursor.page, cursor.offset, store]);

			useEffect(() => {
				if (!needsKey && !cfg.needsQuery) run(true, '', '');
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [kind, needsKey]);

			const choose = async (it) => {
				setPicked(it.id);
				await store.applyBackground('apply', { url: it.full });
			};
			const busy = !!st.busy;
			const go = (query) => { setQ(query); setReaction(''); run(true, query, ''); };

			if (needsKey) {
				return h('div', { className: 'rzd-col' },
					h('div', { className: 'rzd-sub' }, 'GIPHY needs a free key (100 searches an hour). It takes about a minute. You can also just use the General and Anime tabs, which need nothing.'),
					h('ol', { className: 'rzd-sub', style: { margin: 0, paddingLeft: 20 } },
						h('li', null, 'Open ', h('a', { href: 'https://developers.giphy.com/dashboard/', target: '_blank', rel: 'noopener noreferrer' }, 'developers.giphy.com'), ' and sign in.'),
						h('li', null, 'Create an app, pick "API", and copy the key.'),
						h('li', null, 'Paste it below.')),
					h('div', { className: 'rzd-row' },
						h('input', { className: 'rzd-input', placeholder: 'Paste your GIPHY key', value: keyDraft, onChange: (e) => setKeyDraft(e.target.value), 'aria-label': 'GIPHY key' }),
						h('button', { type: 'button', className: 'rzd-btn', 'data-primary': '', disabled: keyDraft.trim().length < 16, onClick: () => store.saveGiphyKey(keyDraft.trim()).then(() => setKeyDraft('')) }, 'Save key')),
					h('div', { className: 'rzd-credit' }, 'The key is stored on this computer only.'));
			}

			return h('div', { className: 'rzd-col' },
				h('form', { className: 'rzd-row', onSubmit: (e) => { e.preventDefault(); setReaction(''); run(true, q, ''); } },
					h('input', { className: 'rzd-input', placeholder: cfg.ph, value: q, onChange: (e) => setQ(e.target.value), 'aria-label': 'Search' }),
					h('button', { type: 'submit', className: 'rzd-btn', 'data-primary': '', disabled: loading || (cfg.needsQuery && !q.trim()) }, 'Search'),
					kind === 'giphy' ? h('button', { type: 'button', className: 'rzd-btn', onClick: () => store.saveGiphyKey('') }, 'Change key') : null),
				SUGGEST[kind] ? h('div', { className: 'rzd-tabs', 'aria-label': 'Ideas' }, SUGGEST[kind].map((w) => h('button', { key: w, type: 'button', className: 'rzd-tab', onClick: () => go(w) }, w))) : null,
				kind === 'anime' ? h('div', { className: 'rzd-tabs', role: 'group', 'aria-label': 'Reactions' }, REACTIONS.map((w) => h('button', { key: w, type: 'button', className: 'rzd-tab', 'aria-pressed': reaction === w, 'data-on': reaction === w ? '' : undefined, onClick: () => { setQ(''); setReaction(w); run(true, '', w); } }, w))) : null,
				err ? h('div', { className: 'rzd-err', role: 'alert' }, err) : null,
				h('div', { className: 'rzd-grid' }, items.map((it) =>
					h('button', { key: it.id, type: 'button', className: 'rzd-thumb', 'data-picked': picked === it.id && !st.error ? '' : undefined, disabled: busy, title: it.label, onClick: () => choose(it) },
						h('img', { src: it.thumb, alt: it.label, loading: 'lazy' }),
						it.label ? h('span', { className: 'rzd-tag' }, picked === it.id && busy ? 'Applying...' : it.label) : null))),
				loading && items.length === 0 ? h('div', { className: 'rzd-sub', role: 'status' }, 'Loading...') : null,
				cfg.needsQuery && !searched && !loading ? h('div', { className: 'rzd-sub' }, 'Type a word above, or tap an idea, to find GIFs.') : null,
				!loading && searched && !err && items.length === 0 ? h('div', { className: 'rzd-sub' }, 'Nothing found. Try another word.') : null,
				cursor.more ? h('div', { className: 'rzd-row' }, h('button', { type: 'button', className: 'rzd-btn', disabled: loading, onClick: () => run(false, q, reaction) }, loading ? 'Loading...' : 'Show more')) : null,
				h('div', { className: 'rzd-credit' }, cfg.credit));
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

		const MOOD_LABELS = { working: 'While working', waiting: 'Waiting for you', error: 'On an error', done: 'When finished' };
		const WHY_LABEL = { mood: 'because of this chat\u2019s mood', chat: 'set for this chat', workspace: 'set for this workspace', playlist: 'from your playlist', default: 'your default', none: '' };

		// The saved backgrounds: pick the default, give one to this chat or workspace, set a mood, build a playlist.
		function LibraryCard(p) {
			const { store } = p;
			const st = useStore(store);
			const { lib, thumbs, ctx, shown } = st;
			const [sel, setSel] = useState(null);
			const cur = lib.items.find((i) => i.id === sel) || null;
			useEffect(() => { if (sel && !lib.items.some((i) => i.id === sel)) setSel(null); }, [lib.items.length]);
			const apply = (next) => store.saveLib(next);
			const chatKey = ctx.chat, spaceKey = ctx.space;
			const uses = cur ? libUses(lib, cur.id) : [];
			const Chip = (c) => h('button', { key: c.key || c.label, type: 'button', className: 'rzd-tab', 'data-on': c.on ? '' : undefined, 'aria-pressed': !!c.on, disabled: !!c.disabled, title: c.title, onClick: c.onClick }, c.label);
			return h('section', { className: 'rzd-card', 'aria-label': 'Saved backgrounds' },
				h('div', { className: 'rzd-col' },
					h('h3', { className: 'rzd-title' }, 'Saved backgrounds'),
					h('div', { className: 'rzd-sub' }, lib.items.length ? 'Pick one to use it everywhere, for one chat or workspace, or for a mood. Up to ' + LIB_MAX + '.' : 'Anything you add below is saved here, so you can switch between them.')),
				shown.id ? h('div', { className: 'rzd-sub', role: 'status' }, 'Showing now: ', h('b', null, (lib.items.find((i) => i.id === shown.id) || {}).name || 'background'), ' ', WHY_LABEL[shown.why] || '') : null,
				lib.items.length ? h('div', { className: 'rzd-grid rzd-libgrid', role: 'listbox', 'aria-label': 'Saved backgrounds' }, lib.items.map((it) => {
					const tags = libUses(lib, it.id);
					return h('button', { key: it.id, type: 'button', role: 'option', 'aria-selected': sel === it.id, className: 'rzd-thumb', 'data-picked': sel === it.id ? '' : undefined, title: it.name || 'Background', onClick: () => setSel(sel === it.id ? null : it.id) },
						thumbs[it.id] ? h('img', { src: thumbs[it.id], alt: it.name || 'Saved background', loading: 'lazy' }) : h('span', { className: 'rzd-nothumb', 'aria-hidden': true }, /^(mp4|webm)$/.test(it.ext) ? '\u25B6' : '\u25A3'),
						tags.length ? h('span', { className: 'rzd-tag' }, tags.slice(0, 2).join(' \u00B7 ')) : null);
				})) : null,
				cur ? h('div', { className: 'rzd-col', style: { gap: 8 } },
					h('div', { className: 'rzd-row' }, h('b', { className: 'rzd-libname' }, cur.name || 'Background'), h('span', { className: 'rzd-sub' }, (cur.bytes / 1048576).toFixed(1) + ' MB \u00B7 ' + cur.ext.toUpperCase())),
					h('div', { className: 'rzd-sub' }, 'Use it for\u2026'),
					h('div', { className: 'rzd-tabs', role: 'group', 'aria-label': 'Use this background for' },
						Chip({ label: 'Everywhere', on: lib.current === cur.id, onClick: () => apply({ ...lib, current: cur.id }) }),
						Chip({ label: 'This chat', on: !!(chatKey && lib.assign.chats[chatKey] === cur.id), disabled: !chatKey, title: chatKey ? 'Only while this chat is open' : 'Open a chat first', onClick: () => apply(libAssign(lib, 'chat', chatKey, lib.assign.chats[chatKey] === cur.id ? null : cur.id)) }),
						Chip({ label: 'This workspace', on: !!(spaceKey && lib.assign.spaces[spaceKey] === cur.id), disabled: !spaceKey, title: spaceKey ? 'Every chat in this workspace' : 'Open a chat in a workspace first', onClick: () => apply(libAssign(lib, 'space', spaceKey, lib.assign.spaces[spaceKey] === cur.id ? null : cur.id)) }),
						Chip({ label: lib.playlist.ids.includes(cur.id) ? 'In playlist' : 'Add to playlist', on: lib.playlist.ids.includes(cur.id), onClick: () => apply(libTogglePlaylist(lib, cur.id)) })),
					h('div', { className: 'rzd-sub' }, 'Or when a chat is\u2026'),
					h('div', { className: 'rzd-tabs', role: 'group', 'aria-label': 'Use this background for a mood' }, LIB_MOODS.map((m) => Chip({ key: m, label: MOOD_LABELS[m], on: lib.assign.moods[m] === cur.id, onClick: () => apply(libAssign(lib, 'mood', m, lib.assign.moods[m] === cur.id ? null : cur.id)) }))),
					h('div', { className: 'rzd-row', style: { justifyContent: 'flex-start' } }, h('button', { type: 'button', className: 'rzd-btn', onClick: () => store.removeEntry(cur.id) }, 'Delete this one'))) : null,
				lib.items.length ? h('div', { className: 'rzd-col', style: { gap: 8, borderTop: '0.5px solid var(--dsw-alias-border-l2)', paddingTop: 10 } },
					h('div', { className: 'rzd-row' },
						h('div', { className: 'rzd-col' }, h('b', null, 'Playlist'), h('div', { className: 'rzd-sub' }, lib.playlist.ids.length < 2 ? 'Add at least two backgrounds to rotate them.' : lib.playlist.ids.length + ' backgrounds, switching every ' + lib.playlist.minutes + ' min.')),
						h(Switch, { checked: lib.playlist.on && lib.playlist.ids.length > 1, label: 'Rotate backgrounds', onChange: (v) => apply(libSetPlaylist(lib, { on: v })) })),
					lib.playlist.ids.length > 1 ? h(Slider, { label: 'Switch every', min: 1, max: 60, step: 1, value: Math.min(60, lib.playlist.minutes), unit: ' min', onChange: (v) => apply(libSetPlaylist(lib, { minutes: v })) }) : null,
					lib.playlist.ids.length > 1 ? h('div', { className: 'rzd-row' }, h('span', null, 'Shuffle'), h(Switch, { checked: lib.playlist.shuffle, label: 'Shuffle the playlist', onChange: (v) => apply(libSetPlaylist(lib, { shuffle: v })) })) : null,
					h('div', { className: 'rzd-sub' }, 'A background set for the open chat, its workspace or its mood always wins over the playlist.')) : null);
		}
		function BackgroundCard(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const [tab, setTab] = useState('wallhaven');
			const tabs = [['wallhaven', 'Wallpapers'], ['commons', 'GIFs'], ['anime', 'Anime GIFs'], ['giphy', 'GIPHY'], ['link', 'Link or file']];
			const video = st.bg.has && /^(mp4|webm)$/.test(st.bg.ext);
			return h('section', { className: 'rzd-card', 'aria-label': 'Chat background' },
				h('div', { className: 'rzd-row' },
					h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Chat background'), h('div', { className: 'rzd-sub' }, 'Find something below. Whatever you pick is added to Saved backgrounds.')),
					h(Switch, { checked: s.bgEnabled, label: 'Show background', onChange: (v) => store.setSettings({ bgEnabled: v }) })),
				h('div', { className: 'rzd-preview' },
					st.bg.has ? (video ? h('video', { src: st.bg.url, muted: true, loop: true, autoPlay: true, playsInline: true }) : h('img', { src: st.bg.url, alt: 'Current background' })) : 'No background yet'),
				h('div', { className: 'rzd-row' },
					h('span', { className: 'rzd-sub' }, st.busy || (st.bg.has ? 'Current background' : '')),
					null),
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
			const stateOpen = !!p.stateOpen;
			return h('section', { className: 'rzd-card', 'aria-label': 'Working chat effect' },
				h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Working chat effect'), h('div', { className: 'rzd-sub' }, 'How a chat looks in the sidebar while the agent is working.')),
				h('div', { className: 'rzd-chips', role: 'radiogroup', 'aria-label': 'Effect' }, EFFECTS.map((e) =>
					h('button', { key: e.id, type: 'button', role: 'radio', 'aria-checked': s.effect === e.id, className: 'rzd-chip', onClick: () => store.setSettings({ effect: e.id }) }, h('span', null, e.label), h('small', null, e.hint)))),
				h('style', null, fx.kf + fx.rule),
				h('div', { className: 'rzd-working' }, s.effect === 'off' ? 'Preview: nothing changes (app default).' : 'Preview: this chat is working…'),
				s.effect !== 'off' ? h(Slider, { label: 'Cycle time', min: 1, max: 8, step: 0.5, value: s.speed, unit: 's', onChange: (v) => store.setSettings({ speed: v }) }) : null,
				s.effect !== 'off' ? h(Slider, { label: 'Intensity', min: 10, max: 100, step: 5, value: s.intensity, unit: '%', onChange: (v) => store.setSettings({ intensity: v }) }) : null,
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
.rzp-toast{color:var(--rzd-accent,var(--dsw-alias-brand-primary));font-weight:600}
@keyframes rzpBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes rzpHop{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-7px) scale(1.08)}}
@keyframes rzpShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
@media (prefers-reduced-motion:reduce){.rzp-face{animation:none!important}}
`;

		// ---------------------------------------------------------------- buddy
		// The pet itself: a small figure that sits to the right of the chat box. Clicking it
		// pats it; the little button opens the Pet / Snake / Tetris window.
		const BUDDY_W = 92, BUDDY_H = 118;
		const BUDDY_CSS = `
.rzb{position:fixed;z-index:9990;width:92px;height:118px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;user-select:none;pointer-events:none}
.rzb>*{pointer-events:auto}
.rzb-pet{position:relative;width:64px;height:64px;font-size:46px;line-height:56px;display:flex;align-items:center;justify-content:center;border:0;background:transparent;padding:0;cursor:pointer;border-radius:50%;transition:transform .12s}
.rzb-pet:active{transform:scale(.88)}
.rzb-pet:focus-visible{outline:2px solid var(--rzd-accent,var(--dsw-alias-brand-primary));outline-offset:2px}
.rzb-pet[data-mood="idle"] .rzp-face,.rzb-pet[data-mood="happy"] .rzp-face{animation:rzpBob 2.4s ease-in-out infinite}
.rzb-pet[data-mood="working"] .rzp-face{animation:rzpHop .6s ease-in-out infinite}
.rzb-pet[data-mood="hungry"] .rzp-face{animation:rzpShake .9s ease-in-out infinite}
.rzb-pet[data-mood="sad"] .rzp-face{filter:grayscale(.7);transform:translateY(2px)}
.rzb .rzp-bubble{position:absolute;top:-6px;right:-4px;font-size:18px}
.rzb-chip{display:flex;align-items:center;justify-content:center;gap:4px;max-width:100%;min-height:26px;padding:0 10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:color-mix(in srgb,var(--dsw-alias-label-primary) 78%,var(--dsw-alias-bg-layer-1));font:inherit;font-size:12px;line-height:16px;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s}
.rzb-chip:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary)}
.rzb-chip:focus-visible{outline:2px solid var(--rzd-accent,var(--dsw-alias-brand-primary));outline-offset:2px}
.rzb-fig{position:relative;display:flex;justify-content:center}
.rzb-perch{box-sizing:border-box;display:flex;justify-content:flex-end;align-items:center;gap:6px;width:100%;max-width:var(--dsh-composer-card-max-width,100%);height:38px;margin:0 auto 6px;user-select:none}
.rzb-perch .rzb-pet{width:34px;height:34px;font-size:26px;line-height:32px}
.rzb-perch .rzp-bubble{font-size:12px;top:-4px;right:-4px}
.rzb-chip-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.rzb:not(.rzb-perch) .rzb-chip{min-width:92px}
.rzb-chip[data-say]{border-color:var(--dsw-alias-label-secondary);color:var(--dsw-alias-label-primary);font-weight:600}
.rzb-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){.rzb .rzp-face{animation:none!important}}
`;
		function Buddy(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const pet = st.pet;
			const [spot, setSpot] = useState(null);
			const lastMood = useRef('');
			useEffect(() => {
				const id = setInterval(() => store.pet.tick(), 30000);
				return () => clearInterval(id);
			}, [store]);
			// Follow the chat box. It moves with the sidebar, window size and font size, so measure it,
			// not guess. No chat box on screen (settings page, empty state) means no buddy.
			useEffect(() => {
				if (!s.petEnabled) return undefined;
				let raf = 0;
				const measure = () => {
					raf = 0;
					const card = document.querySelector('[data-composer-card]');
					if (!card) return setSpot((cur) => (cur === null ? cur : null));
					const r = card.getBoundingClientRect();
					if (r.width < 60 || r.height < 20) return setSpot((cur) => (cur === null ? cur : null));
					const col = card.closest('[data-composer-dock]') ? null : null;
					const root = card.parentElement ? card.parentElement.getBoundingClientRect() : r;
					const scale = clamp(Number(s.windowSize) || 1, 0.8, 1.6);
					const w = Math.round(BUDDY_W * Math.min(scale, 1.3)), hgt = Math.round(BUDDY_H * Math.min(scale, 1.3));
					const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
					let w2 = w, h2 = hgt;
					let spotNow = placeBuddy(box, Math.max(root.right, r.right), w2, h2, window.innerWidth, window.innerHeight);
					if (spotNow.mode === 'above') {
						// Perched on the corner: shrink so it covers as little of the chat as possible.
						w2 = 128; h2 = 38;
						spotNow = placeBuddy(box, Math.max(root.right, r.right), w2, h2, window.innerWidth, window.innerHeight);
					}
					setSpot((cur) => (cur && cur.x === spotNow.x && cur.y === spotNow.y && cur.mode === spotNow.mode && cur.w === w2 ? cur : { ...spotNow, w: w2, h: h2 }));
				};
				const queue = () => { if (!raf) raf = requestAnimationFrame(measure); };
				measure();
				const mo = new MutationObserver(queue);
				mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'data-sidebar-open', 'data-sidebar-drawer', 'aria-expanded'] });
				const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(queue) : null;
				if (ro) ro.observe(document.body);
				// A sidebar sliding open moves the chat box without adding or removing anything, so
				// also follow transitions and, as a safety net, re-check twice a second.
				document.addEventListener('transitionend', queue, true);
				document.addEventListener('animationend', queue, true);
				window.addEventListener('resize', queue);
				const poll = setInterval(queue, 500);
				return () => { if (raf) cancelAnimationFrame(raf); clearInterval(poll); mo.disconnect(); if (ro) ro.disconnect(); document.removeEventListener('transitionend', queue, true); document.removeEventListener('animationend', queue, true); window.removeEventListener('resize', queue); };
			}, [s.petEnabled, s.windowSize]);
			const mood = pet ? petMood(pet, st.working) : 'idle';
			// A short comment when the mood changes (not on every render).
			useEffect(() => {
				if (!pet || lastMood.current === mood) return undefined;
				const first = lastMood.current === '';
				lastMood.current = mood;
				if (first && (mood === 'idle' || mood === 'happy')) return undefined;
				const line = { working: 'On it!', hungry: 'Feed me?', sad: 'Play with me?', happy: 'Happy!', idle: '' }[mood];
				if (!line) return undefined;
				store.say(line);
				return undefined;
			}, [mood, pet && pet.name]);
			const shown = !!(s.petEnabled && pet && spot);
			useEffect(() => {
				store.setBuddy(shown ? { left: spot.x, top: spot.y, right: spot.x + spot.w, bottom: spot.y + spot.h } : null);
			}, [shown, spot && spot.x, spot && spot.y, spot && spot.w, spot && spot.h]);
			useEffect(() => () => store.setBuddy(null), []);
			const perched = shown && spot.mode === 'above';
			useEffect(() => { store.setPerch(perched); }, [perched]);
			useEffect(() => () => store.setPerch(false), []);
			if (!shown || perched) return null;
			const sp = PET_SPECIES[pet.species] || PET_SPECIES.chick;
			const k = spot.w / BUDDY_W;
			const say = st.say;
			return h('div', { className: 'rzb', 'data-mode': spot.mode, role: 'group', 'aria-label': 'Pet ' + pet.name, style: { left: spot.x, top: spot.y, width: spot.w, height: spot.h } },
				h('style', null, PET_CSS + BUDDY_CSS),
				h('div', { className: 'rzb-fig' },
					h('button', { type: 'button', className: 'rzb-pet', 'data-mood': mood, 'aria-label': 'Pat ' + pet.name, title: pet.name + ' \u00B7 Lv ' + petLevel(pet.xp) + ' \u00B7 ' + pet.coins + ' coins', style: k === 1 ? undefined : { fontSize: 46 * k, width: 64 * k, height: 64 * k, lineHeight: 56 * k + 'px' }, onClick: () => store.pet.pat() },
						h('span', { className: 'rzp-face' }, sp.emoji),
						MOOD_BUBBLE[mood] ? h('span', { className: 'rzp-bubble', 'aria-hidden': true }, MOOD_BUBBLE[mood]) : null)),
				h('button', { type: 'button', className: 'rzb-chip', 'data-say': (st.toast || say) ? '' : undefined, 'aria-label': s.windowOpen ? 'Close pet and games window' : 'Open pet and games window', 'aria-expanded': !!s.windowOpen, onClick: () => store.setSettings({ windowOpen: !s.windowOpen }) }, h('span', { className: 'rzb-chip-text', 'aria-hidden': true }, st.toast || say || pet.name), h('span', { 'aria-hidden': true }, s.windowOpen ? '\u25BE' : '\u25B8')),
				h('span', { className: 'rzb-sr', role: 'status' }, st.toast || say || ''));
		}
		// When the chat box has no free space on its right, the pet takes its own row in the app's
		// own dock above the box (conversation.input.dock), so it reserves space instead of covering messages.
		function PerchDock(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const pet = st.pet;
			if (!s.petEnabled || !pet || !st.perch) return null;
			const mood = petMood(pet, st.working);
			const sp = PET_SPECIES[pet.species] || PET_SPECIES.chick;
			return h('div', { className: 'rzb-perch', role: 'group', 'aria-label': 'Pet ' + pet.name },
				h('style', null, PET_CSS + BUDDY_CSS),
				h('button', { type: 'button', className: 'rzb-chip', 'data-say': (st.toast || st.say) ? '' : undefined, 'aria-label': s.windowOpen ? 'Close pet and games window' : 'Open pet and games window', 'aria-expanded': !!s.windowOpen, onClick: () => store.setSettings({ windowOpen: !s.windowOpen }) }, h('span', { className: 'rzb-chip-text', 'aria-hidden': true }, st.toast || st.say || pet.name), h('span', { 'aria-hidden': true }, s.windowOpen ? '\u25BE' : '\u25B8')),
				h('span', { className: 'rzb-sr', role: 'status' }, st.toast || st.say || ''),
				h('button', { type: 'button', className: 'rzb-pet', 'data-mood': mood, 'aria-label': 'Pat ' + pet.name, title: pet.name + ' \u00B7 Lv ' + petLevel(pet.xp) + ' \u00B7 ' + pet.coins + ' coins', onClick: () => store.pet.pat() },
					h('span', { className: 'rzp-face' }, sp.emoji),
					MOOD_BUBBLE[mood] ? h('span', { className: 'rzp-bubble', 'aria-hidden': true }, MOOD_BUBBLE[mood]) : null));
		}
		// ------------------------------------------------------------- celebration
		// A full-window, click-through canvas that draws one particle burst when a chat finishes (or a
		// game is won). It mounts only while a burst is alive, uses requestAnimationFrame, respects the
		// reduced-motion setting, and removes itself when the last particle dies.
		function Celebration(p) {
			const { store } = p;
			const st = useStore(store);
			const cv = useRef(null);
			const burst = st.burst;
			const [live, setLive] = useState(null);
			useEffect(() => {
				if (!burst) return;
				if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
				setLive(burst);
			}, [burst && burst.id]);
			useEffect(() => {
				if (!live) return undefined;
				const canvas = cv.current;
				if (!canvas) return undefined;
				const dpr = window.devicePixelRatio || 1;
				const W = window.innerWidth, H = window.innerHeight;
				canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
				const c = canvas.getContext('2d');
				c.setTransform(dpr, 0, 0, dpr, 0, 0);
				const at = live.at || (() => {
					const card = document.querySelector('[data-composer-card]');
					const r = card ? card.getBoundingClientRect() : null;
					return r ? { x: r.left + r.width / 2, y: r.top } : { x: W / 2, y: H * 0.8 };
				})();
				const bgc = (getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base') || '').match(/\d+/g) || [255, 255, 255];
				const light = (Number(bgc[0]) * 299 + Number(bgc[1]) * 587 + Number(bgc[2]) * 114) / 1000 > 140;
				let parts = fxBurst(live.kind, makeRng((Date.now() ^ 0x85ebca6b) >>> 0), at.x, at.y, W, H, light);
				let last = performance.now(), raf = 0, stopped = false;
				const heart = (x, y, s) => { c.beginPath(); c.moveTo(x, y + s * 0.3); c.bezierCurveTo(x, y - s * 0.2, x - s * 0.6, y - s * 0.2, x - s * 0.6, y + s * 0.15); c.bezierCurveTo(x - s * 0.6, y + s * 0.5, x, y + s * 0.7, x, y + s * 0.95); c.bezierCurveTo(x, y + s * 0.7, x + s * 0.6, y + s * 0.5, x + s * 0.6, y + s * 0.15); c.bezierCurveTo(x + s * 0.6, y - s * 0.2, x, y - s * 0.2, x, y + s * 0.3); c.fill(); };
				const star = (s) => { c.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.28 : s * 0.7, a = (i * Math.PI) / 4; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); };
				const frame = (now) => {
					if (stopped) return;
					const dt = (now - last) / 1000; last = now;
					parts = parts.map((q) => fxStep(q, dt, live.kind)).filter(fxAlive);
					c.clearRect(0, 0, W, H);
					for (const q of parts) {
						c.globalAlpha = fxAlpha(q); c.fillStyle = q.color;
						if (q.shape === 'heart') heart(q.x, q.y, q.size);
						else { c.save(); c.translate(q.x, q.y); c.rotate(q.rot); if (q.shape === 'star') star(q.size); else c.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2); c.restore(); }
					}
					c.globalAlpha = 1;
					if (parts.length) raf = requestAnimationFrame(frame); else setLive(null);
				};
				raf = requestAnimationFrame(frame);
				return () => { stopped = true; cancelAnimationFrame(raf); };
			}, [live]);
			if (!live) return null;
			return h('canvas', { ref: cv, 'aria-hidden': true, style: { position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 10001, pointerEvents: 'none', filter: 'drop-shadow(0 0 1px rgba(0,0,0,.3))' } });
		}
		// ------------------------------------------------------------ game window
		const WIN_W = 300;
		const TABS = [['pet', 'Pet'], ['snake', 'Snake'], ['tetris', 'Tetris'], ['g2048', '2048'], ['mines', 'Mines'], ['pong', 'Pong']];
		const TILE_COLORS = { 0: [null, 'inherit'], 2: ['#eee4da', '#4a4036'], 4: ['#ede0c8', '#4a4036'], 8: ['#f2b179', '#3f3328'], 16: ['#f59563', '#3f3328'], 32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'], 128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'] };
		const MINE_NUM = ['', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#b45309', '#0891b2', '#111827', '#6b7280'];
		const TETRIS_COLORS = { I: '#38bdf8', O: '#facc15', T: '#a78bfa', S: '#4ade80', Z: '#f87171', J: '#60a5fa', L: '#fb923c' };
		const ico = (d) => h('svg', { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false }, h('path', { d }));
		const ICONS = { min: 'M3 7h8', up: 'M3 9l4-4 4 4', close: 'M3.5 3.5l7 7M10.5 3.5l-7 7', rotate: 'M11 7a4 4 0 1 1-1.2-2.85M11 2.5v2.4H8.6' };
		const GAME_CSS = `
.rzw{--rzw-soft:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,var(--dsw-alias-bg-layer-1));--rzw-line:var(--dsw-alias-border-l2);position:fixed;z-index:9998;display:flex;flex-direction:column;width:300px;max-width:calc(100vw - 16px);border:0.5px solid var(--rzw-line);border-radius:14px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 10px 32px rgba(0,0,0,.3);font-size:12px;line-height:16px;user-select:none;overflow:hidden;transform-origin:top left}
.rzw[data-min="true"]{width:auto;min-width:180px}
.rzw-bar{display:flex;align-items:center;gap:4px;padding:4px 6px;cursor:grab;touch-action:none;border-bottom:0.5px solid var(--rzw-line);background:var(--rzw-soft)}
.rzw[data-min="true"] .rzw-bar{border-bottom:0}
.rzw[data-drag="true"] .rzw-bar{cursor:grabbing}
.rzw-grip{display:flex;align-items:center;justify-content:center;width:16px;height:24px;color:var(--dsw-alias-label-secondary);letter-spacing:-3px;font-size:14px;line-height:1;opacity:.85}
.rzw-tabs{display:flex;gap:2px;flex:1;min-width:0}
.rzw-tabrow{display:flex;gap:2px;padding:4px 6px;border-bottom:0.5px solid var(--rzw-line)}
.rzw-tabrow .rzw-tab{flex:1 1 0;min-width:0;padding:0 2px;text-align:center;font-size:12px}
.rzw-tab{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;min-height:32px;padding:0 11px;border-radius:999px;cursor:pointer;transition:background .15s,color .15s}
.rzw-tab:hover{background:var(--rzw-soft)}
.rzw-tab[aria-selected="true"]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-weight:600;box-shadow:0 0 0 0.5px var(--rzw-line)}
.rzw-ico{display:flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--dsw-alias-label-secondary);width:32px;height:32px;border-radius:8px;cursor:pointer;padding:0}
.rzw-ico:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.rzw-body{padding:10px;display:flex;flex-direction:column;gap:8px;align-items:stretch}
.rzw-mini{display:flex;align-items:center;gap:6px;flex:1;padding:0 6px;color:var(--dsw-alias-label-primary);font-weight:600}
.rzw-head{display:flex;justify-content:space-between;gap:8px;color:var(--dsw-alias-label-secondary)}
.rzw-head b{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.rzw-cv{display:block;width:100%;border-radius:8px;background:var(--rzw-soft);border:0.5px solid var(--rzw-line);outline:none}
.rzw-cv:focus-visible{border-color:var(--rzd-accent,var(--dsw-alias-brand-primary))}
.rzw-row{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
.rzw-btn{border:0.5px solid var(--rzw-line);background:transparent;color:inherit;border-radius:999px;min-height:32px;min-width:32px;padding:0 13px;font:inherit;cursor:pointer;transition:background .15s,transform .1s}
.rzw-btn:hover:not(:disabled){background:var(--rzw-soft)}
.rzw-btn:active:not(:disabled){transform:scale(.95)}
.rzw-btn:disabled{opacity:.45;cursor:default}
.rzw-btn[data-primary]{background:var(--rzd-accent,var(--dsw-alias-brand-primary));border-color:transparent;color:var(--rzd-accent-text,var(--dsw-alias-bg-base))}
.rzw-pad{display:grid;grid-template-columns:repeat(3,44px);grid-auto-rows:36px;gap:5px;justify-content:center;touch-action:manipulation}
.rzw-tpad{display:grid;grid-template-columns:repeat(4,36px) 1fr 1fr;gap:6px;height:36px;touch-action:manipulation}
.rzw-tpad .rzw-btn{height:36px;padding:0;min-width:0}
.rzw-pad .rzw-btn,.rzw-tpad .rzw-btn,.rzw-pad-btn{border-radius:10px}
.rzw-pad .rzw-btn{padding:0;font-size:15px}
.rzw-tpad .rzw-btn{display:flex;align-items:center;justify-content:center;font-size:15px}
.rzw-tpad .rzw-btn:nth-child(n+5){font-size:12px;font-weight:500}
.rzw-over{text-align:center;color:var(--dsw-alias-label-secondary)}
.rzw-over b{color:var(--dsw-alias-label-primary)}
.rzw-msg{color:var(--rzd-accent,var(--dsw-alias-brand-primary));font-weight:600;text-align:center;min-height:16px}
.rzw-tiles{display:grid;gap:6px;padding:6px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 20%,var(--dsw-alias-bg-layer-1));border:0.5px solid var(--rzw-line);touch-action:none}
.rzw-tile{display:flex;align-items:center;justify-content:center;aspect-ratio:1;border-radius:6px;font-weight:700;transition:background .12s;background:color-mix(in srgb,var(--dsw-alias-label-primary) 15%,var(--dsw-alias-bg-layer-1));box-shadow:inset 0 0 0 0.5px var(--rzw-line)}
.rzw-tile[aria-label=empty]{color:transparent}
.rzw-mines{display:grid;gap:2px;padding:2px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,var(--dsw-alias-bg-layer-1));border:0.5px solid var(--rzw-line);touch-action:manipulation}
.rzw-mine{display:flex;align-items:center;justify-content:center;aspect-ratio:1;border:0;padding:0;font:inherit;font-size:13px;font-weight:700;line-height:1;cursor:pointer;background:color-mix(in srgb,var(--dsw-alias-label-primary) 24%,var(--dsw-alias-bg-layer-1));box-shadow:inset 0 -2px 0 rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.12);color:var(--dsw-alias-label-primary);border-radius:3px}
.rzw-mine:hover:not([data-open]){background:color-mix(in srgb,var(--dsw-alias-label-primary) 32%,var(--dsw-alias-bg-layer-1))}
.rzw-mine[data-open]{background:var(--dsw-alias-bg-layer-1);box-shadow:none;cursor:default}
.rzw-mine[data-boom]{background:#fecaca}
.rzw-mine[data-cursor]{outline:2px solid var(--rzd-accent,var(--dsw-alias-brand-primary));outline-offset:-2px;border-radius:5px;z-index:1}
.rzw-hint{color:var(--dsw-alias-label-secondary);text-align:center;font-size:11px}
.rzw .rzp-bars{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rzw-meter{display:flex;flex-direction:column;gap:4px}
.rzw-meter span{font-size:11px;line-height:14px;color:var(--dsw-alias-label-secondary)}
.rzw .rzp-bar{height:6px;background:var(--rzw-soft);border:0.5px solid var(--rzw-line)}
.rzw-stage{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 0}
.rzw-stage .rzp-pet{width:72px;height:72px;font-size:52px;line-height:60px}
.rzw-stage .rzp-bubble{font-size:20px;top:-2px;right:-4px}
.rzw-name{font-weight:600;font-size:13px}
.rzw-sub{color:var(--dsw-alias-label-secondary)}
@media (prefers-reduced-motion:reduce){.rzw *{animation:none!important;transition:none!important}}
`;

		function PetPanel(p) {
			const { store, pet, working } = p;
			const st = useStore(store);
			const mood = petMood(pet, working);
			const sp = PET_SPECIES[pet.species] || PET_SPECIES.chick;
			const bar = (value, color, label) => h('div', { className: 'rzw-meter' }, h('span', null, label), h('div', { className: 'rzp-bar', role: 'meter', 'aria-label': label, 'aria-valuenow': Math.round(value), 'aria-valuemin': 0, 'aria-valuemax': 100, title: label + ' ' + Math.round(value) + '%' }, h('i', { style: { width: Math.round(value) + '%', background: color } })));
			const broke = pet.coins < FEED_COST;
			return h('div', { className: 'rzw-body' },
				h('div', { className: 'rzw-stage' },
					h('button', { type: 'button', className: 'rzp-pet', 'data-mood': mood, 'aria-label': 'Pet ' + pet.name, onClick: () => store.pet.pat() },
						h('span', { className: 'rzp-face' }, sp.emoji),
						MOOD_BUBBLE[mood] ? h('span', { className: 'rzp-bubble', 'aria-hidden': true }, MOOD_BUBBLE[mood]) : null),
					h('div', { className: 'rzw-name' }, pet.name),
					h('div', { className: 'rzw-sub' }, 'Lv ' + petLevel(pet.xp) + ' \u00B7 ' + pet.coins + ' coins')),
				h('div', { className: 'rzp-bars' }, bar(pet.hunger, '#f59e0b', 'Fullness'), bar(pet.joy, '#ec4899', 'Joy')),
				h('div', { className: st.toast ? 'rzw-msg' : 'rzw-hint', 'aria-live': 'polite' }, st.toast || (broke && (mood === 'hungry') ? 'Need ' + FEED_COST + ' coins: finish a chat or play a game' : MOOD_TEXT[mood])),
				h('div', { className: 'rzw-row' },
					h('button', { type: 'button', className: 'rzw-btn', title: broke ? 'Need ' + FEED_COST + ' coins' : 'Feed', disabled: broke, onClick: () => store.pet.feed() }, 'Feed \u00B7 ' + FEED_COST),
					h('button', { type: 'button', className: 'rzw-btn', onClick: () => store.pet.play() }, 'Play'),
					h('button', { type: 'button', className: 'rzw-btn', onClick: () => store.pet.pat() }, 'Pat')),
				h('div', { className: 'rzw-hint' }, 'Finished chats and games earn coins.'));
		}

		// Shared shell for the two games: header, canvas, controls, game-over card.
		function useGame(store, game, makeState, stepFn, delayFn) {
			const [seed, setSeed] = useState(() => (Date.now() ^ 0x5bd1e995) >>> 0);
			const rng = useRef(null);
			const [s, setS] = useState(() => { rng.current = makeRng(seed); return makeState(rng.current); });
			const [paused, setPaused] = useState(true);
			const [done, setDone] = useState(null);
			const sRef = useRef(s);
			sRef.current = s;
			const apply = useCallback((fn) => setS((cur) => { const next = fn(cur); sRef.current = next; return next; }), []);
			const reset = useCallback(() => { const r = makeRng((Date.now() ^ 0x9e3779b9) >>> 0); rng.current = r; setSeed(r()); setDone(null); setS(makeState(r)); setPaused(false); }, []);
			useEffect(() => {
				if (paused || s.over) return undefined;
				const id = setTimeout(() => apply((cur) => stepFn(cur, rng.current)), delayFn(s));
				return () => clearTimeout(id);
			}, [paused, s, apply]);
			useEffect(() => {
				if (s.over && !done) setDone(store.pet.finishGame(game, s.score));
			}, [s.over]);
			useEffect(() => {
				const onVis = () => { if (document.hidden) setPaused(true); };
				document.addEventListener('visibilitychange', onVis);
				return () => document.removeEventListener('visibilitychange', onVis);
			}, []);
			return { s, apply, rng, paused, setPaused, done, reset };
		}

		function paintGrid(canvas, w, h, draw) {
			if (!canvas) return;
			const css = canvas.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;
			const cw = Math.max(1, Math.round(css.width * dpr)), ch = Math.max(1, Math.round(css.height * dpr));
			if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
			const ctx2 = canvas.getContext('2d');
			ctx2.setTransform(cw / w, 0, 0, ch / h, 0, 0);
			ctx2.clearRect(0, 0, w, h);
			draw(ctx2);
		}
		// Offset that centres a piece's real bounding box inside a w x h grid of cells scaled by k.
		function centerPiece(type, w, hgt, k) {
			const cs = PIECES[type][0];
			const xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);
			const pw = (Math.max(...xs) - Math.min(...xs) + 1) * k, ph = (Math.max(...ys) - Math.min(...ys) + 1) * k;
			return { ox: (w - pw) / 2 - Math.min(...xs) * k, oy: (hgt - ph) / 2 - Math.min(...ys) * k };
		}
		const cssVar = (name, fallback) => (getComputedStyle(document.body).getPropertyValue(name).trim() || fallback);

		function GameOver(p) {
			const { done, score, onAgain } = p;
			return h('div', { className: 'rzw-over', role: 'status' },
				h('div', null, p.text || 'Game over. Score ', h('b', null, score)),
				done && (done.reward.coins > 0 || done.reward.xp > 0) ? h('div', null, done.newBest ? 'New best! ' : '', '+' + done.reward.coins + ' coins, +' + done.reward.xp + ' xp') : (done ? h('div', null, 'No points this time.') : null),
				h('div', { className: 'rzw-row', style: { marginTop: 6 } }, h('button', { type: 'button', className: 'rzw-btn', 'data-primary': '', onClick: onAgain }, 'Play again')));
		}

		function SnakePanel(p) {
			const { store, best } = p;
			const g = useGame(store, 'snake', (r) => snakeNew(r), (cur, r) => snakeStep(cur, r), snakeDelay);
			const { s, apply, paused, setPaused, done, reset } = g;
			const cv = useRef(null);
			const root = useRef(null);
			useEffect(() => { if (root.current) root.current.focus(); }, []);
			useEffect(() => {
				paintGrid(cv.current, s.w, s.h, (c) => {
					c.fillStyle = 'rgba(128,128,128,.10)';
					for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if ((x + y) % 2) c.fillRect(x, y, 1, 1);
					if (s.food) { c.fillStyle = '#f43f5e'; c.beginPath(); c.arc(s.food[0] + .5, s.food[1] + .5, .36, 0, 7); c.fill(); }
					s.snake.forEach(([x, y], i) => { c.fillStyle = i === 0 ? '#86efac' : '#22c55e'; c.beginPath(); c.roundRect ? c.roundRect(x + .06, y + .06, .88, .88, .22) : c.rect(x + .06, y + .06, .88, .88); c.fill(); });
				});
			});
			const turn = (dir) => { if (paused && !s.over) setPaused(false); apply((cur) => snakeTurn(cur, dir)); };
			const onKey = (e) => {
				const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
				const dir = map[e.key];
				if (dir) { e.preventDefault(); turn(dir); }
				else if (e.key === ' ' || e.key === 'p') { e.preventDefault(); if (!s.over) setPaused((v) => !v); }
				else if (e.key === 'r') { e.preventDefault(); reset(); }
			};
			return h('div', { className: 'rzw-body', ref: root, tabIndex: 0, onKeyDown: onKey, 'aria-label': 'Snake. Arrow keys or WASD to steer, space to pause.', style: { outline: 'none' } },
				h('div', { className: 'rzw-head' }, h('span', null, 'Score ', h('b', null, s.score)), h('span', null, 'Best ', h('b', null, Math.max(best, s.score)))),
				h('canvas', { ref: cv, className: 'rzw-cv', style: { aspectRatio: s.w + ' / ' + s.h }, role: 'img', 'aria-label': 'Snake board' }),
				s.over ? h(GameOver, { done, score: s.score, onAgain: reset }) : h('div', { className: 'rzw-hint' }, paused ? 'Press an arrow key or Start' : 'Arrows or WASD to steer'),
				!s.over ? h('div', { className: 'rzw-row' }, h('button', { type: 'button', className: 'rzw-btn', 'data-primary': paused ? '' : undefined, onClick: () => setPaused((v) => !v) }, paused ? (s.ticks ? 'Resume' : 'Start') : 'Pause')) : null,
				h('div', { className: 'rzw-pad', 'aria-label': 'Touch controls' },
					h('span'), h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Up', onClick: () => turn('up') }, '\u25B2'), h('span'),
					h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Left', onClick: () => turn('left') }, '\u25C0'), h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Down', onClick: () => turn('down') }, '\u25BC'), h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Right', onClick: () => turn('right') }, '\u25B6')));
		}

		function TetrisPanel(p) {
			const { store, best } = p;
			const g = useGame(store, 'tetris', (r) => tetrisNew(r), (cur, r) => tetrisTick(cur, r), tetrisDelay);
			const { s, apply, rng, paused, setPaused, done, reset } = g;
			const cv = useRef(null);
			const nx = useRef(null);
			const hd = useRef(null);
			const root = useRef(null);
			useEffect(() => { if (root.current) root.current.focus(); }, []);
			useEffect(() => {
				paintGrid(cv.current, s.w, s.h, (c) => {
					c.fillStyle = 'rgba(128,128,128,.12)';
					for (let x = 1; x < s.w; x++) c.fillRect(x - .02, 0, .04, s.h);
					for (let y = 1; y < s.h; y++) c.fillRect(0, y - .02, s.w, .04);
					const block = (x, y, color, a) => { c.globalAlpha = a; c.fillStyle = color; c.fillRect(x + .04, y + .04, .92, .92); c.globalAlpha = 1; };
					s.board.forEach((row, y) => row.forEach((cell, x) => { if (cell) block(x, y, TETRIS_COLORS[cell], 1); }));
					if (!s.over) {
						const gy = ghostY(s);
						cells({ ...s.piece, y: gy }).forEach(([x, y]) => { if (y >= 0) block(x, y, TETRIS_COLORS[s.piece.type], .22); });
						cells(s.piece).forEach(([x, y]) => { if (y >= 0) block(x, y, TETRIS_COLORS[s.piece.type], 1); });
					}
				});
				const draw = (c, type, a) => { const o = centerPiece(type, 5, 4, 0.8); PIECES[type][0].forEach(([x, y]) => { c.globalAlpha = a; c.fillStyle = TETRIS_COLORS[type]; c.fillRect(o.ox + x * .8 + .04, o.oy + y * .8 + .04, .74, .74); c.globalAlpha = 1; }); };
				paintGrid(nx.current, 5, 4, (c) => { draw(c, s.next, 1); });
				paintGrid(hd.current, 5, 4, (c) => { if (s.hold) draw(c, s.hold, s.canHold ? 1 : 0.4); });
			});
			const play = (fn) => { if (s.over) return; if (paused) setPaused(false); apply(fn); };
			const onKey = (e) => {
				const k = e.key;
				if (k === 'ArrowLeft' || k === 'a') { e.preventDefault(); play((c) => tetrisMove(c, -1)); }
				else if (k === 'ArrowRight' || k === 'd') { e.preventDefault(); play((c) => tetrisMove(c, 1)); }
				else if (k === 'ArrowUp' || k === 'w' || k === 'x') { e.preventDefault(); play((c) => tetrisRotate(c, 1)); }
				else if (k === 'z') { e.preventDefault(); play((c) => tetrisRotate(c, -1)); }
				else if (k === 'ArrowDown' || k === 's') { e.preventDefault(); play((c) => tetrisSoftDrop(c, rng.current)); }
				else if (k === ' ') { e.preventDefault(); play((c) => tetrisHardDrop(c, rng.current)); }
				else if (k === 'c' || k === 'Shift') { e.preventDefault(); play((c) => tetrisHold(c, rng.current)); }
				else if (k === 'p') { e.preventDefault(); if (!s.over) setPaused((v) => !v); }
				else if (k === 'r') { e.preventDefault(); reset(); }
			};
			return h('div', { className: 'rzw-body', ref: root, tabIndex: 0, onKeyDown: onKey, 'aria-label': 'Tetris. Arrows to move, up to rotate, space to drop, C to hold.', style: { outline: 'none' } },
				h('div', { className: 'rzw-head' }, h('span', null, 'Score ', h('b', null, s.score)), h('span', null, 'Lines ', h('b', null, s.lines)), h('span', null, 'Lv ', h('b', null, s.level)), h('span', null, 'Best ', h('b', null, Math.max(best, s.score)))),
				h('div', { style: { display: 'flex', gap: 8, alignItems: 'stretch' } },
					h('canvas', { ref: cv, className: 'rzw-cv', style: { aspectRatio: s.w + ' / ' + s.h, width: '62%' }, role: 'img', 'aria-label': 'Tetris board' }),
					h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 } },
						h('div', { className: 'rzw-sub' }, 'Next'), h('canvas', { ref: nx, className: 'rzw-cv', style: { aspectRatio: '5 / 4' }, role: 'img', 'aria-label': 'Next piece' }),
						h('div', { className: 'rzw-sub' }, 'Hold'), h('canvas', { ref: hd, className: 'rzw-cv', style: { aspectRatio: '5 / 4' }, role: 'img', 'aria-label': s.hold ? 'Held piece ' + s.hold : 'Nothing held' }),
						h('div', { className: 'rzw-hint', style: { textAlign: 'left' } }, 'Space drop', h('br'), 'C hold', h('br'), 'P pause'),
						!s.over ? h('button', { type: 'button', className: 'rzw-btn rzw-pad-btn', style: { marginTop: 'auto', width: '100%' }, 'data-primary': paused ? '' : undefined, onClick: () => setPaused((v) => !v) }, paused ? (s.score || s.lines ? 'Resume' : 'Start') : 'Pause') : null)),
				s.over ? h(GameOver, { done, score: s.score, onAgain: reset }) : null,
				h('div', { className: 'rzw-tpad', 'aria-label': 'Touch controls' },
					h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Left', onClick: () => play((c) => tetrisMove(c, -1)) }, '\u25C0'),
					h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Rotate', onClick: () => play((c) => tetrisRotate(c, 1)) }, h('svg', { width: 17, height: 17, viewBox: '0 0 14 14', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: ICONS.rotate }))),
					h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Right', onClick: () => play((c) => tetrisMove(c, 1)) }, '\u25B6'),
					h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Soft drop', onClick: () => play((c) => tetrisSoftDrop(c, rng.current)) }, '\u25BC'),
					h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Hard drop', onClick: () => play((c) => tetrisHardDrop(c, rng.current)) }, 'Drop'),
					h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Hold', onClick: () => play((c) => tetrisHold(c, rng.current)) }, 'Hold')));
		}

		function G2048Panel(p) {
			const { store, best } = p;
			const g = useGame(store, 'g2048', (r) => g2048New(r), (cur) => cur, () => 1e9);
			const { s, apply, rng, done, reset } = g;
			const root = useRef(null);
			useEffect(() => { if (root.current) root.current.focus(); }, []);
			const go = (dir) => apply((cur) => g2048Move(cur, dir, rng.current));
			const onKey = (e) => {
				const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
				if (map[e.key]) { e.preventDefault(); go(map[e.key]); } else if (e.key === 'r') { e.preventDefault(); reset(); }
			};
			// swipe support for touch
			const start = useRef(null);
			const onDown = (e) => { start.current = { x: e.clientX, y: e.clientY }; };
			const onUp = (e) => { const a = start.current; start.current = null; if (!a) return; const dx = e.clientX - a.x, dy = e.clientY - a.y; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); };
			const cell = (v) => { const c = TILE_COLORS[v] || ['#3c3a32', '#fff']; const o = { color: c[1], fontSize: v >= 1024 ? 14 : v >= 128 ? 17 : 21 }; if (c[0]) o.background = c[0]; return o; };
			return h('div', { className: 'rzw-body', ref: root, tabIndex: 0, onKeyDown: onKey, 'aria-label': '2048. Arrow keys or WASD slide the tiles, R restarts.', style: { outline: 'none' } },
				h('div', { className: 'rzw-head' }, h('span', null, 'Score ', h('b', null, s.score)), h('span', null, 'Best ', h('b', null, Math.max(best, s.score)))),
				h('div', { className: 'rzw-tiles', onPointerDown: onDown, onPointerUp: onUp, style: { gridTemplateColumns: 'repeat(' + s.size + ',1fr)' }, role: 'grid', 'aria-label': '2048 board' },
					s.board.flat().map((v, i) => h('div', { key: i, className: 'rzw-tile', role: 'gridcell', style: cell(v), 'aria-label': v ? String(v) : 'empty' }, v || ''))),
				s.over ? h(GameOver, { done, score: s.score, onAgain: reset }) : h('div', { className: s.won ? 'rzw-msg' : 'rzw-hint' }, s.won ? 'You made 2048! Keep going.' : 'Arrows or WASD, or swipe'),
				h('div', { className: 'rzw-pad', 'aria-label': 'Touch controls' },
					h('span'), h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Up', onClick: () => go('up') }, '\u25B2'), h('span'),
					h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Left', onClick: () => go('left') }, '\u25C0'), h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Down', onClick: () => go('down') }, '\u25BC'), h('button', { type: 'button', className: 'rzw-btn', 'aria-label': 'Right', onClick: () => go('right') }, '\u25B6')));
		}

		function MinesPanel(p) {
			const { store, best } = p;
			const [seed] = useState(() => makeRng((Date.now() ^ 0x1b873593) >>> 0));
			const rng = useRef(seed);
			const [s, setS] = useState(() => minesNew(9, 9, 10));
			const [secs, setSecs] = useState(0);
			const [flagMode, setFlagMode] = useState(false);
			const [done, setDone] = useState(null);
			const [cursor, setCursor] = useState({ x: 4, y: 4 });
			const root = useRef(null);
			useEffect(() => { if (root.current) root.current.focus(); }, []);
			useEffect(() => {
				if (s.status !== 'playing') return undefined;
				const id = setInterval(() => setSecs((v) => v + 1), 1000);
				return () => clearInterval(id);
			}, [s.status]);
			const score = minesScore(s, secs);
			useEffect(() => {
				if ((s.status === 'won' || s.status === 'lost') && !done) setDone(store.pet.finishGame('mines', score));
				if (s.status === 'won') store.celebrateGame();
			}, [s.status]);
			const reset = () => { rng.current = makeRng((Date.now() ^ 0x2545f491) >>> 0); setS(minesNew(9, 9, 10)); setSecs(0); setDone(null); };
			const act = (x, y, flag) => setS((cur) => {
				const c = cur.cells[y * cur.w + x];
				if (flag) return minesFlag(cur, x, y);
				if (c.state === 'open') return minesChord(cur, x, y, rng.current);
				return minesReveal(cur, x, y, rng.current);
			});
			const onKey = (e) => {
				const mv = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
				if (mv) { e.preventDefault(); setCursor((c) => ({ x: clamp(c.x + mv[0], 0, s.w - 1), y: clamp(c.y + mv[1], 0, s.h - 1) })); }
				else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); act(cursor.x, cursor.y, flagMode); }
				else if (e.key === 'f') { e.preventDefault(); act(cursor.x, cursor.y, true); }
				else if (e.key === 'r') { e.preventDefault(); reset(); }
			};
			const end = s.status === 'won' || s.status === 'lost';
			return h('div', { className: 'rzw-body', ref: root, tabIndex: 0, onKeyDown: onKey, 'aria-label': 'Minesweeper. Arrow keys move, space opens, F flags, R restarts.', style: { outline: 'none' } },
				h('div', { className: 'rzw-head' }, h('span', null, '\uD83D\uDEA9 ', h('b', null, minesFlagsLeft(s))), h('span', null, '\u23F1 ', h('b', null, secs)), h('span', null, 'Best ', h('b', null, Math.max(best, end ? score : 0)))),
				h('div', { className: 'rzw-mines', style: { gridTemplateColumns: 'repeat(' + s.w + ',1fr)' }, role: 'grid', 'aria-label': 'Minesweeper board' },
					s.cells.map((c, i) => {
						const x = i % s.w, y = Math.floor(i / s.w);
						const open = c.state === 'open';
						return h('button', { key: i, type: 'button', tabIndex: -1, role: 'gridcell', className: 'rzw-mine', 'data-open': open ? '' : undefined, 'data-cursor': cursor.x === x && cursor.y === y ? '' : undefined, 'data-boom': open && c.mine ? '' : undefined,
							'aria-label': open ? (c.mine ? 'mine' : c.adj ? c.adj + ' nearby' : 'empty') : c.state === 'flag' ? 'flag' : 'hidden', style: open && !c.mine && c.adj ? { color: MINE_NUM[c.adj] } : undefined,
							onClick: () => { setCursor({ x, y }); act(x, y, flagMode); }, onContextMenu: (e) => { e.preventDefault(); act(x, y, true); } },
							open ? (c.mine ? '\uD83D\uDCA3' : c.adj || '') : c.state === 'flag' ? '\uD83D\uDEA9' : '');
					})),
				end ? h(GameOver, { done, score, onAgain: reset, text: s.status === 'won' ? 'You cleared it! Score ' : 'Boom. Score ' }) : h('div', { className: 'rzw-hint' }, flagMode ? 'Flag mode: tap to flag' : 'Tap to open, right-click or Flag mode to flag'),
				h('div', { className: 'rzw-row' },
					h('button', { type: 'button', className: 'rzw-btn', 'aria-pressed': flagMode, 'data-primary': flagMode ? '' : undefined, onClick: () => setFlagMode((v) => !v) }, '\uD83D\uDEA9 Flag mode'),
					h('button', { type: 'button', className: 'rzw-btn', onClick: reset }, 'New game')));
		}

		function PongPanel(p) {
			const { store, best } = p;
			const rng = useRef(null);
			if (rng.current === null) rng.current = makeRng((Date.now() ^ 0x7feb352d) >>> 0);
			const [s, setS] = useState(() => pongNew(rng.current));
			const [paused, setPaused] = useState(true);
			const [done, setDone] = useState(null);
			const sRef = useRef(s); sRef.current = s;
			const dir = useRef(0);
			const keys = useRef({ up: false, down: false });
			const cv = useRef(null);
			const root = useRef(null);
			useEffect(() => { if (root.current) root.current.focus(); }, []);
			useEffect(() => {
				if (paused || s.over) return undefined;
				let raf = 0, last = performance.now();
				const loop = (now) => {
					const dt = now - last; last = now;
					const next = pongStep(sRef.current, dt, { dir: dir.current }, rng.current);
					sRef.current = next; setS(next);
					if (!next.over) raf = requestAnimationFrame(loop);
				};
				raf = requestAnimationFrame(loop);
				return () => cancelAnimationFrame(raf);
			}, [paused, s.over]);
			useEffect(() => { if (s.over && !done) { setDone(store.pet.finishGame('pong', pongScore(s))); if (s.winner === 'player') store.celebrateGame(); } }, [s.over]);
			useEffect(() => {
				const onVis = () => { if (document.hidden) setPaused(true); };
				document.addEventListener('visibilitychange', onVis);
				return () => document.removeEventListener('visibilitychange', onVis);
			}, []);
			useEffect(() => {
				paintGrid(cv.current, PONG_W, PONG_H, (c) => {
					c.fillStyle = 'rgba(128,128,128,.35)';
					for (let y = 1; y < PONG_H; y += 4) c.fillRect(PONG_W / 2 - 0.4, y, 0.8, 2);
					c.fillStyle = cssVar('--dsw-alias-label-primary', '#fff');
					c.fillRect(PONG_PADDLE_X, s.player.y - PONG_PADDLE_H / 2, 1.5, PONG_PADDLE_H);
					c.fillRect(PONG_W - PONG_PADDLE_X - 1.5, s.ai.y - PONG_PADDLE_H / 2, 1.5, PONG_PADDLE_H);
					c.fillStyle = '#f59e0b'; c.beginPath(); c.arc(s.ball.x, s.ball.y, PONG_BALL_R, 0, 7); c.fill();
				});
			});
			const set = (v) => { dir.current = v; if (paused && !s.over && v !== 0) setPaused(false); };
			const onKey = (e) => {
				const up = ['ArrowUp', 'w'].includes(e.key), down = ['ArrowDown', 's'].includes(e.key);
				if (up || down) { e.preventDefault(); keys.current[up ? 'up' : 'down'] = e.type === 'keydown'; set(keys.current.down ? 1 : keys.current.up ? -1 : 0); }
				else if (e.type === 'keydown' && (e.key === ' ' || e.key === 'p')) { e.preventDefault(); if (!s.over) setPaused((v) => !v); }
				else if (e.type === 'keydown' && e.key === 'r') { e.preventDefault(); reset(); }
			};
			const reset = () => { rng.current = makeRng((Date.now() ^ 0x68e31da4) >>> 0); const n = pongNew(rng.current); sRef.current = n; setS(n); setDone(null); setPaused(false); };
			const pointer = (e) => {
				const r = cv.current.getBoundingClientRect();
				const y = ((e.clientY - r.top) / r.height) * PONG_H;
				const diff = y - sRef.current.player.y;
				set(Math.abs(diff) < 1.5 ? 0 : diff > 0 ? 1 : -1);
			};
			return h('div', { className: 'rzw-body', ref: root, tabIndex: 0, onKeyDown: onKey, onKeyUp: onKey, 'aria-label': 'Pong. Up and down arrows or W and S move your paddle, space pauses.', style: { outline: 'none' } },
				h('div', { className: 'rzw-head' }, h('span', null, 'You ', h('b', null, s.score.player)), h('span', null, 'First to ', h('b', null, PONG_WIN)), h('span', null, 'CPU ', h('b', null, s.score.ai))),
				h('canvas', { ref: cv, className: 'rzw-cv', style: { aspectRatio: PONG_W + ' / ' + PONG_H, touchAction: 'none' }, role: 'img', 'aria-label': 'Pong board', onPointerDown: pointer, onPointerMove: (e) => { if (e.buttons) pointer(e); }, onPointerUp: () => set(0), onPointerCancel: () => set(0) }),
				s.over ? h(GameOver, { done, score: pongScore(s), onAgain: reset, text: s.winner === 'player' ? 'You win! Score ' : 'CPU wins. Score ' }) : h('div', { className: 'rzw-hint' }, paused ? 'Press W/S or drag on the board to start' : 'Up/Down or W/S, or drag the board'),
				!s.over ? h('div', { className: 'rzw-row' }, h('button', { type: 'button', className: 'rzw-btn', 'data-primary': paused ? '' : undefined, onClick: () => setPaused((v) => !v) }, paused ? (s.rallies || s.score.player || s.score.ai ? 'Resume' : 'Start') : 'Pause')) : null,
				h('div', { className: 'rzw-row', 'aria-label': 'Touch controls' },
					h('button', { type: 'button', className: 'rzw-btn rzw-pad-btn', 'aria-label': 'Paddle up', onPointerDown: () => set(-1), onPointerUp: () => set(0), onPointerLeave: () => set(0) }, '\u25B2 Up'),
					h('button', { type: 'button', className: 'rzw-btn rzw-pad-btn', 'aria-label': 'Paddle down', onPointerDown: () => set(1), onPointerUp: () => set(0), onPointerLeave: () => set(0) }, '\u25BC Down')));
		}
		function GameWindow(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const pet = st.pet;
			const el = useRef(null);
			const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
			const [drag, setDrag] = useState(null);
			const [measured, setMeasured] = useState(0);
			// The window's real on-screen height (it changes with the tab and the size slider),
			// so it can always be kept fully inside the app.
			useEffect(() => {
				const hh = el.current ? el.current.getBoundingClientRect().height : 0;
				if (hh > 0 && Math.abs(hh - measured) > 1) setMeasured(hh);
			});
			useEffect(() => {
				const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
				window.addEventListener('resize', on);
				return () => window.removeEventListener('resize', on);
			}, []);
			useEffect(() => {
				const id = setInterval(() => store.pet.tick(), 30000);
				return () => clearInterval(id);
			}, [store]);
			if (!s.petEnabled || !pet || !s.windowOpen) return null;
			const minimized = s.windowMin;
			const scale = clamp(Number(s.windowSize) || 1, 0.8, 1.6);
			const width = WIN_W * scale;
			const estimate = minimized ? 42 * scale : ({ pet: 313, snake: 448, tetris: 470, g2048: 440, mines: 440, pong: 380 }[s.windowTab] || 313) * scale;
			const height = measured || estimate;
			const unplaced = !(s.windowX >= 0 && s.windowY >= 0);
			const buddyRect = unplaced ? st.buddy : null;
			const pos = drag || (buddyRect ? placeAbove(buddyRect, width, height, vp.w, vp.h) : placeWindow({ x: s.windowX, y: s.windowY }, width, height, vp.w, vp.h));
			const startDrag = (e) => {
				if (e.button !== undefined && e.button !== 0) return;
				if (e.target.closest && e.target.closest('button')) return;
				const box = el.current.getBoundingClientRect();
				const grab = { dx: e.clientX - box.left, dy: e.clientY - box.top };
				const bar = e.currentTarget;
				try { bar.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
				setDrag({ x: box.left, y: box.top, grab });
				const move = (ev) => setDrag({ ...clampWindow(ev.clientX - grab.dx, ev.clientY - grab.dy, width, el.current ? el.current.getBoundingClientRect().height : height, window.innerWidth, window.innerHeight), grab });
				const up = (ev) => {
					bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
					const end = clampWindow(ev.clientX - grab.dx, ev.clientY - grab.dy, width, el.current ? el.current.getBoundingClientRect().height : height, window.innerWidth, window.innerHeight);
					setDrag(null);
					store.setSettings({ windowX: end.x, windowY: end.y });
				};
				bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
			};
			const nudge = (e) => {
				const step = e.shiftKey ? 40 : 10;
				const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
				if (!d) return;
				e.preventDefault();
				const box = el.current.getBoundingClientRect();
				const n = clampWindow(box.left + d[0], box.top + d[1], width, box.height, vp.w, vp.h);
				store.setSettings({ windowX: n.x, windowY: n.y });
			};
			const tab = TABS.some(([id]) => id === s.windowTab) ? s.windowTab : 'pet';
			const working = st.working;
			const mood = petMood(pet, working);
			const sp = PET_SPECIES[pet.species] || PET_SPECIES.chick;
			return h('div', { ref: el, className: 'rzw', role: 'dialog', 'aria-label': 'Pet and games', 'data-min': minimized, 'data-drag': !!drag, style: { left: pos.x, top: pos.y, transform: scale === 1 ? undefined : 'scale(' + scale + ')' } },
				h('style', null, GAME_CSS + PET_CSS),
				h('div', { className: 'rzw-bar', onPointerDown: startDrag, onKeyDown: nudge, tabIndex: 0, role: 'group', 'aria-label': 'Move window (drag, or use arrow keys)' },
					h('span', { className: 'rzw-grip', 'aria-hidden': true }, '\u22EE\u22EE'),
					h('span', { className: 'rzw-mini' }, h('span', { 'aria-hidden': true, style: { fontSize: 18 } }, sp.emoji), pet.name),
					h('button', { type: 'button', className: 'rzw-ico', 'aria-label': minimized ? 'Expand window' : 'Minimize window', title: minimized ? 'Expand' : 'Minimize', onClick: () => store.setSettings({ windowMin: !minimized }) }, ico(minimized ? ICONS.up : ICONS.min)),
					h('button', { type: 'button', className: 'rzw-ico', 'aria-label': 'Close window', title: 'Close (click your pet to open it again)', onClick: () => store.setSettings({ windowOpen: false }) }, ico(ICONS.close))),
				minimized ? null : h('div', { className: 'rzw-tabrow', role: 'tablist', 'aria-label': 'Pet and games' }, TABS.map(([id, label]) => h('button', { key: id, type: 'button', role: 'tab', 'aria-selected': tab === id, className: 'rzw-tab', onClick: () => store.setSettings({ windowTab: id }) }, label))),
				minimized ? null
					: tab === 'snake' ? h(SnakePanel, { key: 'snake', store, best: (pet.best && pet.best.snake) || 0 })
					: tab === 'tetris' ? h(TetrisPanel, { key: 'tetris', store, best: (pet.best && pet.best.tetris) || 0 })
					: tab === 'g2048' ? h(G2048Panel, { key: 'g2048', store, best: (pet.best && pet.best.g2048) || 0 })
					: tab === 'mines' ? h(MinesPanel, { key: 'mines', store, best: (pet.best && pet.best.mines) || 0 })
					: tab === 'pong' ? h(PongPanel, { key: 'pong', store, best: (pet.best && pet.best.pong) || 0 })
					: h(PetPanel, { store, pet, working }));
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
					h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Pet'), h('div', { className: 'rzd-sub' }, 'Your pet sits to the right of the chat box. Click it to pat it, or click its name to open a window you can drag anywhere, with Pet, Snake and Tetris. Finished chats and games earn coins; spend them on food and new friends. The pet never dies, it just gets sad.')),
					h(Switch, { checked: s.petEnabled, label: 'Show pet', onChange: (v) => store.setSettings({ petEnabled: v }) })),
				s.petEnabled ? h(Slider, { label: 'Window size', min: 0.8, max: 1.6, step: 0.1, value: s.windowSize, unit: 'x', onChange: (v) => store.setSettings({ windowSize: v }) }) : null,
				s.petEnabled ? h('div', { className: 'rzd-row', style: { justifyContent: 'flex-start' } }, h('button', { type: 'button', className: 'rzd-btn', onClick: () => store.setSettings({ windowOpen: !s.windowOpen, windowX: -1, windowY: -1, windowMin: false }) }, s.windowOpen ? 'Close the window and reset its spot' : 'Open the window'), h('span', { className: 'rzd-credit' }, 'Drag the window by its title bar. Arrow keys move it too.')) : null,
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

		function StateEffectsCard(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const set = (key, patch) => store.setSettings({ stateEffects: { ...s.stateEffects, ...(patch.effect ? { [key]: patch.effect } : {}) }, stateColors: { ...s.stateColors, ...(patch.color ? { [key]: patch.color } : {}) } });
			return h('section', { className: 'rzd-card', 'aria-label': 'Other chat states' },
				h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Other chat states'), h('div', { className: 'rzd-sub' }, 'Give chats a different look when they are waiting for you, hit an error, or just finished. Uses the same intensity as the working effect.')),
				STATE_LIST.map((row) => h('div', { key: row.key, className: 'rzd-col', style: { gap: 6 } },
					h('div', { className: 'rzd-row', style: { justifyContent: 'flex-start' } },
						h('span', { style: { minWidth: 120, fontWeight: 600 } }, row.label),
						h('span', { className: 'rzd-sub' }, row.hint)),
					h('div', { className: 'rzd-tabs', role: 'radiogroup', 'aria-label': row.label + ' effect' },
						STATE_EFFECT_LIST.map(([id, label]) => h('button', { key: id, type: 'button', role: 'radio', 'aria-checked': (s.stateEffects[row.key] || 'off') === id, className: 'rzd-tab', 'data-on': (s.stateEffects[row.key] || 'off') === id ? '' : undefined, onClick: () => set(row.key, { effect: id }) }, label)),
						(s.stateEffects[row.key] && s.stateEffects[row.key] !== 'off') ? h('input', { type: 'color', className: 'rzd-color', 'aria-label': row.label + ' color', value: s.stateColors[row.key], onChange: (e) => set(row.key, { color: e.target.value }) }) : null))));
		}

		function CelebrateCard(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			return h('section', { className: 'rzd-card', 'aria-label': 'Celebration' },
				h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Finish celebration'), h('div', { className: 'rzd-sub' }, 'A short burst over the chat box when a chat finishes working. Turned off automatically if your computer asks apps to reduce motion.')),
				h('div', { className: 'rzd-tabs', role: 'radiogroup', 'aria-label': 'Celebration' }, CELEBRATIONS.map(([id, label]) => h('button', { key: id, type: 'button', role: 'radio', 'aria-checked': s.celebrate === id, className: 'rzd-tab', 'data-on': s.celebrate === id ? '' : undefined, onClick: () => { store.setSettings({ celebrate: id }); if (id !== 'off') store.celebrate(id); } }, label))),
				h('div', { className: 'rzd-row' },
					h('span', null, 'Also celebrate a won game'),
					h(Switch, { checked: s.celebrateOnGame, label: 'Celebrate a won game', onChange: (v) => store.setSettings({ celebrateOnGame: v }) })),
				s.celebrate !== 'off' ? h('div', { className: 'rzd-row', style: { justifyContent: 'flex-start' } }, h('button', { type: 'button', className: 'rzd-btn', onClick: () => store.celebrate(s.celebrate) }, 'Try it')) : null);
		}
		const ACCENT_SWATCHES = ['#4176e6', '#7c5cff', '#ec4899', '#ef4444', '#f59e0b', '#22c55e', '#14b8a6', '#06b6d4'];
		function AccentCard(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const color = /^#[0-9a-f]{6}$/i.test(s.accent || '') ? s.accent : '#4176e6';
			const page = getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base').trim();
			const bg = (page.match(/\d+/g) || [255, 255, 255]).slice(0, 3);
			const bgHex = famToHex({ r: Number(bg[0]), g: Number(bg[1]), b: Number(bg[2]) });
			const ratio = famContrast(color, bgHex);
			return h('section', { className: 'rzd-card', 'aria-label': 'Accent color' },
				h('div', { className: 'rzd-row' },
					h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Accent color'), h('div', { className: 'rzd-sub' }, 'Recolors the selected tab line, focus rings, primary buttons and this plugin\u2019s controls.')),
					h(Switch, { checked: s.accentEnabled, label: 'Use my accent color', onChange: (v) => store.setSettings({ accentEnabled: v, accent: v && !s.accent ? color : s.accent }) })),
				s.accentEnabled ? h('div', { className: 'rzd-col' },
					h('div', { className: 'rzd-chips', role: 'radiogroup', 'aria-label': 'Accent swatches' }, ACCENT_SWATCHES.map((c) => h('button', { key: c, type: 'button', role: 'radio', 'aria-checked': color.toLowerCase() === c, 'aria-label': c, className: 'rzd-swatch', style: { background: c }, onClick: () => store.setSettings({ accent: c }) }))),
					h('label', { className: 'rzd-slider' }, h('span', null, 'Custom'), h('input', { type: 'color', className: 'rzd-color', value: color, onChange: (e) => store.setSettings({ accent: e.target.value }) }), h('span', null)),
					ratio < 3 ? h('div', { className: 'rzd-err', role: 'status' }, 'That color is hard to see against the page (contrast ' + ratio.toFixed(1) + ':1). Pick something darker or brighter.') : h('div', { className: 'rzd-ok' }, 'Contrast ' + ratio.toFixed(1) + ':1, easy to see.')) : null);
		}
		const FONT_CHOICES = Object.keys(LOOK_FONTS);
		const BUBBLE_CHOICES = Object.keys(LOOK_BUBBLES);
		function LookCard(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const Pick = (items, value, label, on, sample) => h('div', { className: 'rzd-tabs', role: 'radiogroup', 'aria-label': label }, items.map(([id, text]) => h('button', { key: id, type: 'button', role: 'radio', 'aria-checked': value === id, className: 'rzd-tab', 'data-on': value === id ? '' : undefined, style: sample ? sample(id) : undefined, onClick: () => on(id) }, text)));
			return h('section', { className: 'rzd-card', 'aria-label': 'Chat look' },
				h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Chat look'), h('div', { className: 'rzd-sub' }, 'Text, spacing and how your messages look. "App default" leaves the app exactly as it is.')),
				h('div', { className: 'rzd-sub' }, 'Font'),
				Pick(FONT_CHOICES.map((id) => [id, LOOK_FONTS[id].label]), s.fontFamily, 'Font', (id) => store.setSettings({ fontFamily: id }), (id) => (LOOK_FONTS[id].stack ? { fontFamily: LOOK_FONTS[id].stack } : undefined)),
				h(Slider, { label: 'Text size', min: -3, max: 6, step: 1, value: s.fontSize, unit: ' px', onChange: (v) => store.setSettings({ fontSize: v }) }),
				h(Slider, { label: 'Line spacing', min: -4, max: 10, step: 1, value: s.lineSpacing, unit: ' px', onChange: (v) => store.setSettings({ lineSpacing: v }) }),
				h(Slider, { label: 'Chat width', min: 0, max: 1600, step: 20, value: s.chatWidth, unit: s.chatWidth === 0 ? ' (app)' : ' px', onChange: (v) => store.setSettings({ chatWidth: v === 0 ? 0 : Math.max(520, v) }) }),
				h('div', { className: 'rzd-sub' }, 'Your message bubble'),
				h('div', { className: 'rzd-chips', role: 'radiogroup', 'aria-label': 'Message bubble' }, BUBBLE_CHOICES.map((id) => h('button', { key: id, type: 'button', role: 'radio', 'aria-checked': s.userBubble === id, className: 'rzd-opt', 'data-on': s.userBubble === id ? '' : undefined, onClick: () => store.setSettings({ userBubble: id }) }, h('span', { className: 'rzd-opt-t' }, LOOK_BUBBLES[id].label), h('span', { className: 'rzd-opt-h' }, LOOK_BUBBLES[id].hint)))),
				(s.fontSize !== 0 || s.lineSpacing !== 0 || s.chatWidth !== 0 || s.fontFamily !== 'default' || s.userBubble !== 'default') ? h('div', { className: 'rzd-row', style: { justifyContent: 'flex-start' } }, h('button', { type: 'button', className: 'rzd-btn', onClick: () => store.setSettings({ fontFamily: 'default', fontSize: 0, lineSpacing: 0, chatWidth: 0, userBubble: 'default' }) }, 'Back to app default')) : null);
		}
		// A face above each reply and each of your messages: an emoji, your pet, or a small picture you upload.
		function shrinkImage(file, size) {
			return new Promise((ok, no) => {
				const url = URL.createObjectURL(file);
				const img = new Image();
				img.onload = () => {
					try {
						const s = Math.min(size / img.naturalWidth, size / img.naturalHeight, 1);
						const w = Math.max(1, Math.round(img.naturalWidth * s)), h2 = Math.max(1, Math.round(img.naturalHeight * s));
						const sq = Math.min(img.naturalWidth, img.naturalHeight);
						const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
						const c = cv.getContext('2d');
						c.drawImage(img, (img.naturalWidth - sq) / 2, (img.naturalHeight - sq) / 2, sq, sq, 0, 0, size, size);
						void w; void h2;
						let out = cv.toDataURL('image/webp', 0.85);
						if (!/^data:image\/webp/.test(out)) out = cv.toDataURL('image/png');
						URL.revokeObjectURL(url);
						ok(out.length <= 110000 ? out : cv.toDataURL('image/jpeg', 0.6));
					} catch (e) { URL.revokeObjectURL(url); no(e); }
				};
				img.onerror = () => { URL.revokeObjectURL(url); no(new Error('That file is not a picture I can read.')); };
				img.src = url;
			});
		}

		function AvatarSide(p) {
			const { store, side, label } = p;
			const st = useStore(store);
			const s = st.settings;
			const kindKey = side === 'assistant' ? 'avatarAssistantKind' : 'avatarUserKind';
			const emojiKey = side === 'assistant' ? 'avatarAssistantEmoji' : 'avatarUserEmoji';
			const kind = s[kindKey];
			const [err, setErr] = useState('');
			const onFile = async (e) => {
				const f = e.target.files && e.target.files[0];
				e.target.value = '';
				if (!f) return;
				if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) return setErr('Use a png, jpg, webp or gif picture.');
				if (f.size > 8 * 1024 * 1024) return setErr('That picture is over 8 MB.');
				setErr('');
				try { await store.setAvatar(side, await shrinkImage(f, 96)); store.setSettings({ [kindKey]: 'image' }); } catch (x) { setErr(x.message); }
			};
			return h('div', { className: 'rzd-col', style: { gap: 8 } },
				h('div', { className: 'rzd-sub' }, label),
				h('div', { className: 'rzd-tabs', role: 'radiogroup', 'aria-label': label + ' picture type' }, [['none', 'None'], ['emoji', 'Emoji'], ['pet', 'My pet'], ['image', 'Picture']].map(([id, text]) => h('button', { key: id, type: 'button', role: 'radio', 'aria-checked': kind === id, className: 'rzd-tab', 'data-on': kind === id ? '' : undefined, onClick: () => store.setSettings({ [kindKey]: id }) }, text))),
				kind === 'emoji' ? h('div', { className: 'rzd-chips', role: 'radiogroup', 'aria-label': label + ' emoji' }, AVATAR_EMOJI.map((e) => h('button', { key: e, type: 'button', role: 'radio', 'aria-checked': s[emojiKey] === e, 'aria-label': e, className: 'rzd-emoji', 'data-on': s[emojiKey] === e ? '' : undefined, onClick: () => store.setSettings({ [emojiKey]: e }) }, e))) : null,
				kind === 'image' ? h('div', { className: 'rzd-row', style: { justifyContent: 'flex-start', gap: 10 } },
					st.avatars[side] ? h('img', { className: 'rzd-avatar-prev', src: st.avatars[side], alt: label + ' picture' }) : h('span', { className: 'rzd-sub' }, 'No picture yet.'),
					h('label', { className: 'rzd-btn', style: { cursor: 'pointer' } }, st.avatars[side] ? 'Change picture' : 'Pick a picture', h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', onChange: onFile, style: { display: 'none' } })),
					st.avatars[side] ? h('button', { type: 'button', className: 'rzd-btn', onClick: () => store.setAvatar(side, '') }, 'Remove') : null,
					err ? h('span', { className: 'rzd-err', role: 'alert' }, err) : null) : null);
		}

		function AvatarCard(p) {
			const { store } = p;
			const st = useStore(store);
			const s = st.settings;
			const any = s.avatarAssistantKind !== 'none' || s.avatarUserKind !== 'none';
			return h('section', { className: 'rzd-card', 'aria-label': 'Chat pictures' },
				h('div', { className: 'rzd-col' }, h('h3', { className: 'rzd-title' }, 'Chat pictures'), h('div', { className: 'rzd-sub' }, 'A small round picture above each reply and above each of your messages. Pictures stay on this computer.')),
				h(AvatarSide, { store, side: 'assistant', label: 'Replies' }),
				h(AvatarSide, { store, side: 'user', label: 'You' }),
				any ? h(Slider, { label: 'Picture size', min: 20, max: 44, step: 2, value: s.avatarSize, unit: ' px', onChange: (v) => store.setSettings({ avatarSize: v }) }) : null);
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
					h('div', { className: 'rzd-row' }, h('span', null, 'Sub-chats get a darker shade of their parent\u2019s color'), h(Switch, { checked: s.familyTint, label: 'Family shades', onChange: (v) => store.setSettings({ familyTint: v }) })),
					h('div', { className: 'rzd-row' }, h('span', null, 'Show a label badge on colored sub-chats'), h(Switch, { checked: s.lineageBadges, label: 'Badges', onChange: (v) => store.setSettings({ lineageBadges: v }) })),
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
					h(LibraryCard, { store }),
					h(EffectCard, { store }),
					h(StateEffectsCard, { store }),
					h(CelebrateCard, { store }),
					h(BorderCard, { store }),
					h(AccentCard, { store }),
					h(LookCard, { store }),
					h(AvatarCard, { store }),
					h(TintCard, { store }),
					h(PetCard, { store }),
					h('div', { className: 'rzd-row' },
						h('button', { type: 'button', className: 'rzd-btn', onClick: () => store.setSettings({ ...DEFAULTS, giphyKeySet: undefined, petEnabled: store.get().settings.petEnabled, windowX: store.get().settings.windowX, windowY: store.get().settings.windowY }) }, 'Reset all options'),
						h('span', { className: 'rzd-credit' }, 'Rayskinz DSH Design 0.8.0')));
			};
		}

		return {
			__test: { avatarCss, lookCss, famContrast, LookCard, LibraryCard, withDefaults, G2048Panel, MinesPanel, PongPanel, allEffectsCss, StateEffectsCard, Celebration, PerchDock, Buddy, centerPiece, PetPanel, GameWindow, effectCss, borderCss, tintFor, hexRgb, clamp, petTick, petFeed, petPlay, petPat, petReward, petBuy, petMood, petLevel, themeFrom, exportTheme, parseTheme, PRESETS },
			inject: ['slots', 'connection'],
			apply(ctx) {
				const store = createStore(ctx.get('connection').rpc);
				store.load();
				ctx.effect(() => mountEngine(store), 'rayskinz-design: background and effect engine');
				ctx.effect(() => () => store.dispose(), 'rayskinz-design: store');
				const Section = makeSection(store);
				ctx.slots.inject('settings.section', () =>
					ctx.slots.register({ name: 'settings.section', id: 'rayskinz-design', order: 30, label: () => 'Design Options' }, Section));
				const Floating = function GameSeat() {
					return h(React.Fragment, null, h(Buddy, { store }), h(GameWindow, { store }), h(Celebration, { store }));
				};
				ctx.slots.inject('conversation.input.dock', () =>
					ctx.slots.register({ name: 'conversation.input.dock', id: 'rayskinz-perch', order: 50 }, function PerchSeat() { return h(PerchDock, { store }); }));
				ctx.slots.inject('shell.overlay', () =>
					ctx.slots.register({ name: 'shell.overlay', id: 'rayskinz-game-window', order: 40 }, Floating));
				ctx.effect(() => {
					// The sidebar shows a spinning dot on every working chat; a chat that stops
					// working earns the pet its reward.
					let was = false;
					const check = () => {
						const now = !!document.querySelector('svg[data-state="ongoing"]');
						if (was && !now) { store.pet.reward(); store.celebrate(); }
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
