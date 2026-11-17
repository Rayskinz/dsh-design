# Rayskinz DSH Design

A design plugin for DeepSeek Harness (DSH). Backgrounds, effects, colors, a chat look and a small pet with games, all on one **Design Options** page in Settings.

## Features

**Backgrounds**
- A chat background behind every chat from: wallpaper search (Wallhaven), GIF search (Wikimedia Commons and anime GIFs from nekos.best, no account needed; GIPHY is optional with a free key), a pasted link, or your own file. Animated GIFs and mp4/webm work.
- **Saved backgrounds**: keep up to 24, pick one for everywhere, for one chat, for one workspace, or for a chat mood (working, waiting, error, finished). An optional playlist rotates through the ones you choose (every 1 to 60 minutes, shuffle optional).
- Sliders for panel see-through, darken and blur.

**Effects and colors**
- Working-chat effects in the sidebar: rainbow wave, pulse, scanner, ember, aurora, matrix, lightning, with an intensity slider. Optional looks for chats waiting for you (amber), errored (red) or finished (green).
- Finish celebration: a short confetti, sparkle or heart burst when a chat finishes (respects reduced motion).
- Window border: neon, rainbow, gold, stripes or fire, optionally only while a chat is working.
- Chat colors: color a sidebar chat by a word in its title. Sub-chats get a darker shade of their parent's color, a small label (for example "Opus - working") and a colored branch line. Whole words only.
- Accent color: recolors the selected tab line, focus rings, primary buttons and this plugin's controls. Text on it is picked for contrast.

**Chat look**
- Font, text size, line spacing and chat width. Everything starts at "App default" and changes nothing until you move it.
- Your message bubble: soft, outline, accent or minimal.
- Chat pictures: a small round picture above each reply and above your messages (an emoji, your pet, or a picture you upload). Pictures stay on your computer.

**Pet and games**
- The pet sits to the right of the chat box and follows it when the layout changes. If there is no room it takes its own small row above the box, so it never covers messages. Its name label shows what it says and opens the games window.
- A small draggable window with tabs: Pet (feed, play, unlock species with coins, hats, stats), Snake, Tetris, 2048, Minesweeper and Pong (keyboard and touch, best scores saved). Finished chats and games earn coins. The pet never dies.
- Sounds: short soft tones made on your computer (Web Audio, no files). Off until you turn the volume up; each event can be muted.

**Themes**
- Four one-click looks (Avatar, Cyberpunk, Minimal, Party), your own saved themes, Prev/Next buttons and the shortcut **Ctrl + Alt + Left / Right**, and a look per workspace (shown only while a chat from that workspace is open; your own settings are not changed).
- Copy my look / paste a theme to share yours as text. Themes never include your background, pet, avatars, sounds or GIPHY key.

See `docs/PLAN-2.md` for what comes next.

## Install

In DSH open **Settings -> Plugins** and install a bundle from a local folder or git:

```
git clone https://github.com/rayskinz/dsh-design.git
```

Then add the folder as a bundle (`@rayskinz/dsh-design`) and enable it. Open **Settings -> Design Options**.

## GIFs work out of the box

Wallpapers, the **GIFs** tab (Wikimedia Commons) and the **Anime GIFs** tab (nekos.best) need no account or key. The optional **GIPHY** tab needs a free key from https://developers.giphy.com/dashboard/ (100 searches an hour); paste it into that tab. The key is stored on your computer only and never sent back to the Settings page.

The GIFs tab searches only files that Wikimedia Commons itself files under "Animated GIF files". Commons has no family-friendly switch, so results are not guaranteed to be free of sensitive content: the tab says so, and you should check a GIF before you keep it. Each file has its own license (see its page on commons.wikimedia.org). The plugin sends a descriptive User-Agent as Wikimedia and nekos.best require.

## Tests

`npm test` runs the offline tests (about 150: settings validation, tint and family-color matching, border and effect CSS, the host relay and file handling, library and theme rules, look and avatar CSS, pet hats, stats and sound plans, and the rules for all five games). Needs Node 20+.

## Developing

The browser half is built from `src/client.src.js` plus the pure rule files (`src/games.js`, `games2.js`, `fx.js`, `family.js`, `library.js`, `look.js`, `pet2.js`, `themes.js`): edit those, then run `npm run build` to regenerate `lib/client.js` (`npm test` fails if it is out of date). Never edit `lib/client.js` by hand.

## Where things are stored

`~/.dsh/plugins/rayskinz-design/` holds your settings, pet, saved backgrounds (`library.json` and `lib-*` files), saved themes (`themes.json`) and chat pictures (`avatar-*.img`). Delete the folder to reset everything.

## Safety

- Pasted links must be https and may not point at your own computer or local network (checked when the connection is made and on every redirect).
- Downloads are size-limited while they stream (40 MB; chat pictures 120 KB).
- Your GIPHY key is stored on disk and used only by the plugin's background process. The Settings page never receives it back.
- The saved-backgrounds list is owned by the plugin's background process: the page can organize it but can never add or point at files.
- Settings, pet, library and theme saves are written atomically, so a crash cannot leave half a file.
- Chat pictures accept only png, jpeg and webp (never SVG) and emoji are checked so nothing can break out of the page styles.

## Privacy

The plugin talks only to wallhaven.cc, commons.wikimedia.org, nekos.best and api.giphy.com when you search, and to the link you paste when you use one. It never reads your message text. Nothing is sent anywhere else.

## Notes

- Wallhaven results are safe for work only.
- Backgrounds over 40 MB are refused. The library holds 24.
- This plugin restyles the app with CSS custom properties and may need updates when DSH changes its theme.
- The effects, colors and chat look use the app's own markers (sidebar rows, status dots, message bubbles). If a DSH update renames them, a feature may quietly stop applying until the plugin is updated; nothing breaks.

## License

MIT, Rayskinz.
