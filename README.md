# Rayskinz DSH Design

A design plugin for DeepSeek Harness (DSH). Backgrounds, a wallpaper and GIF hub, and working-chat effects, all on one **Design Options** page in Settings.

## Features

- Chat background behind every chat: wallpaper search (Wallhaven), GIF search (GIPHY), pasted link, or your own file. Animated GIFs and mp4/webm work.
- Sliders for panel see-through, darken and blur.
- Working-chat effects in the sidebar: rainbow wave, pulse, scanner, ember.
- Window border: neon, rainbow, gold, stripes or fire, optionally only while a chat is working.
- Chat colors: color a sidebar chat by a word in its title, so sub-chats named after a model (Opus, Sonnet, Haiku...) are easy to tell apart. Whole words only.
- Pet: a small pet under the chat box. Finished chats earn it coins; feed it, play with it, unlock new species. It never dies.

More is planned (theme packs, pet mini-games). See the issues.

## Install

In DSH open **Settings → Plugins** and install a bundle from a local folder or git:

```
git clone https://github.com/rayskinz/dsh-design.git
```

Then add the folder as a bundle (`@rayskinz/dsh-design`) and enable it. Open **Settings → Design Options**.

## GIFs need a free GIPHY key

Wallpapers work with no setup. For GIF search, create a free key at https://developers.giphy.com/dashboard/ (100 searches an hour), and paste it into the GIFs tab. The key is stored on your computer only. A background GIF downloaded from GIPHY is shown with "Powered by GIPHY" credit in the hub.

## Tests

`npm test` runs the offline tests (settings validation, tint matching, border/effect CSS, host relay). Needs Node 20+.

## Where things are stored

`~/.dsh/plugins/rayskinz-design/` holds `settings.json` and your current background file. Delete the folder to reset everything.

## Privacy

The plugin talks only to wallhaven.cc and api.giphy.com when you search, and to the link you paste when you use one. Nothing is sent anywhere else.

## Notes

- Wallhaven results are safe for work only.
- Backgrounds over 40 MB are refused.
- This plugin restyles the app with CSS custom properties and may need updates when DSH changes its theme.

## License

MIT, Rayskinz.
