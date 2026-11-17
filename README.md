# Rayskinz DSH Design

A design plugin for DeepSeek Harness (DSH). Backgrounds, a wallpaper and GIF hub, and working-chat effects, all on one **Design Options** page in Settings.

## Features

- Chat background behind every chat: wallpaper search (Wallhaven), GIF search (Wikimedia Commons and anime GIFs from nekos.best, no account needed; GIPHY optional with a free key), a pasted link, or your own file. Animated GIFs and mp4/webm work.
- Sliders for panel see-through, darken and blur.
- Working-chat effects in the sidebar: rainbow wave, pulse, scanner, ember.
- Window border: neon, rainbow, gold, stripes or fire, optionally only while a chat is working.
- Chat colors: color a sidebar chat by a word in its title, so sub-chats named after a model (Opus, Sonnet, Haiku...) are easy to tell apart. Whole words only.
- Themes: four one-click looks (Avatar, Cyberpunk, Minimal, Party) and Copy my look / Paste a theme to share yours as text. Themes never include your background, pet or GIPHY key.
- Pet: sits to the right of the chat box, bottom edges lined up, and follows the box when the layout changes. If there is no room on the right it takes its own small row just above the box instead, so it never covers messages. Click it to pat it; its name chip shows what it is saying and opens the games window.
- Pet and games window: a small draggable window (drag the title bar, or use the arrow keys on it; minimize or close it; resize it with a slider). Tabs: Pet (feed it, play with it, unlock new species with coins), Snake and Tetris (keyboard and touch controls, best scores saved). Finished chats and games earn coins. The pet never dies.

More is planned (pet mini-games, sound). See the issues.

## Install

In DSH open **Settings → Plugins** and install a bundle from a local folder or git:

```
git clone https://github.com/rayskinz/dsh-design.git
```

Then add the folder as a bundle (`@rayskinz/dsh-design`) and enable it. Open **Settings → Design Options**.

## GIFs work out of the box

Wallpapers, the **GIFs** tab (Wikimedia Commons) and the **Anime GIFs** tab (nekos.best) need no account or key. The optional **GIPHY** tab needs a free key from https://developers.giphy.com/dashboard/ (100 searches an hour); paste it into that tab. The key is stored on your computer only and never sent back to the Settings page. GIFs from Commons carry their own licenses; each file's page on commons.wikimedia.org has the details. The plugin sends a descriptive User-Agent as Wikimedia and nekos.best require.

## Tests

`npm test` runs the offline tests (settings validation, tint matching, border/effect CSS, host relay, Snake and Tetris rules). Needs Node 20+.

## Developing

The browser half is built from `src/client.src.js` and `src/games.js`: edit those, then run `npm run build` to regenerate `lib/client.js` (`npm test` fails if it is out of date).

## Where things are stored

`~/.dsh/plugins/rayskinz-design/` holds `settings.json` and your current background file. Delete the folder to reset everything.

## Safety

- Pasted links must be https and may not point at your own computer or local network (checked when the connection is made and on every redirect).
- Downloads are size-limited while they stream (40 MB).
- Your GIPHY key is stored on disk and used only by the plugin's background process. The Settings page never receives it back.
- Settings and pet saves are written atomically, so a crash cannot leave half a file.

## Privacy

The plugin talks only to wallhaven.cc, commons.wikimedia.org, nekos.best and api.giphy.com when you search, and to the link you paste when you use one. Nothing is sent anywhere else.

## Notes

- Wallhaven results are safe for work only.
- Backgrounds over 40 MB are refused.
- This plugin restyles the app with CSS custom properties and may need updates when DSH changes its theme.

## License

MIT, Rayskinz.
