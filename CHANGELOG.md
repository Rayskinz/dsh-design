# Changelog

Every release of Rayskinz DSH Design, newest first. Each version has a matching tag (`v0.9.0`) and a release page under
**Releases** on GitHub, so you can see exactly what changed and download that version.

**How to follow updates**
- On the repo page click **Watch -> Custom -> Releases** and GitHub emails you when a new version comes out.
- Or add the feed to a reader: `https://github.com/Rayskinz/dsh-design/releases.atom`
- To update: in your install folder run `git pull`, then switch the plugin off and on in **Settings -> Plugins** (or restart DSH).
- Your settings, saved backgrounds, themes and pet live in `~/.dsh/plugins/rayskinz-design/` and are not touched by an update.
- To see which version you have: open `package.json` in the install folder, or the small footer at the bottom of **Design Options**.

---

## 0.9.1 - 2026-11-18

- Docs only: README rewritten with a full feature tour, install, update and uninstall steps. First GitHub release.

---

## 0.9.0 - 2026-11-17  (first public release)

Everything below is in this version. The earlier numbers were built the same day while the plugin took shape.

**New in 0.9.0**
- **Saved themes**: name your current look and keep up to 12. Switch with Prev / Next or **Ctrl + Alt + Left / Right**.
- **A look per workspace**: pick a theme for a workspace and it shows while a chat from that workspace is open. Your own settings are not changed.
- **Chat pictures are now zero-height**: fixes a bug where the chat could jump under you while you were reading, when an empty reply row filled in or folded away.
- Controls on a see-through settings panel are now solid, so text is always readable. Selected chips and switches are clearer in light and dark.
- The GIFs tab only searches Wikimedia Commons' curated "Animated GIF files" category. Commons has no family-friendly switch, so the tab still warns you to check a GIF before keeping it.
- `npm test` now runs every test file (158 tests).

## 0.8.x - 2026-11-17

- **Saved backgrounds**: keep up to 24, then use one everywhere, for one chat, for one workspace, or for a chat mood (working, waiting, error, finished). Optional playlist with shuffle.
- **Sub-chat colors**: sub-chats get a darker shade of their parent's color, a small label (for example "Opus - working") and a branch line.
- **Accent color** for the selected tab line, focus rings and buttons, with text picked for contrast.
- **Chat look**: font, text size, line spacing, chat width, and four message-bubble styles.
- **Chat pictures**: a round picture for replies and for your messages (emoji, your pet, or an uploaded image).
- **Pet extras**: hats you buy with coins, a stats panel, and soft sounds (off until you raise the volume).

## 0.7.0 - 2026-11-17

- Three more sidebar effects (aurora, matrix, lightning) and an intensity slider.
- Different looks for chats that are waiting for you, errored or finished.
- Finish celebration: confetti, sparkles or hearts when a chat finishes.
- Three more games: **2048**, **Minesweeper** and **Pong**. The games window now has six tabs.

## 0.6.0 - 2026-11-17

- **GIF search that works with no account**: Wikimedia Commons and anime reaction GIFs (nekos.best). GIPHY stays optional with a free key.

## 0.5.x - 2026-11-17

- 0.5.1: the pet sits to the right of the chat box and follows it, or takes its own row above the box when there is no room. Its name label shows what it says.
- 0.5.0: a draggable pet and games window with Pet, Snake and Tetris.

## 0.4.x - 2026-11-17

- 0.4.1: security hardening of the background process (local-network link guard checked on every connection and redirect, streamed size limits, atomic file writes, the GIPHY key never sent back to the page).
- 0.4.0: four one-click themes and copy / paste sharing.

## 0.3.0 - 2026-11-17

- First pet, and a guard that refuses links pointing at your own computer or network.

## 0.2.0 - 2026-11-17

- Window borders (neon, rainbow, gold, stripes, fire), chat colors by a word in the title, and the first offline tests.

## 0.1.0 - 2026-11-17

- First version: chat background hub (wallpapers, GIF search, link or file), working-chat effects and the Design Options page.

---

What is planned next is in [`docs/PLAN-2.md`](docs/PLAN-2.md).

