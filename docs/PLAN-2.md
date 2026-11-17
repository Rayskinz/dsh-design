# Rayskinz DSH Design: plan 2

Everything on plan 1 is built (see the README). This is the next list, in the order I would build it. Each item says what you would see, how big the job is, how I would check it, and anything that needs your yes first. Nothing here is started.

Sizes: **S** = an afternoon, **M** = a day, **L** = several days.

---

## Where we are

| | Done in 0.9.0 |
|---|---|
| Backgrounds | Wallpapers, free GIF search (Wikimedia Commons, anime reactions), optional GIPHY, link or file, saved list of 24, per chat / workspace / mood, playlist with shuffle |
| Effects | 7 sidebar looks with intensity, different looks for waiting / error / finished, finish celebration |
| Colors | Chat colors by word, sub-chats get darker shades, labels, branch lines, accent color |
| Chat look | Font, text size, spacing, width, 4 message bubble styles, round pictures for you and the replies |
| Pet | 7 species, hats, stats, sounds, 5 games |
| Themes | Presets, save your own, quick switch (buttons and Ctrl+Alt+Arrows), a look per workspace |

Honest status: everything is tested in a copy of the app's layout using the app's real colors. **You have not yet seen it in the real app**, so the first job on plan 2 is that check.

---

## Tier 0: before anything new

### 0.1 A live check in the real app (S)
Open Design Options, go through every card once, and tell me what looks off. I fix before building more.
- **Why first:** the screenshots use a stand-in for the app. The real chat box, sidebar and sub-chat menu may differ.
- **What I need from you:** 15 minutes and a list of anything weird.

### 0.2 A "Reset everything" button (S)
One button per card plus a global one, with an "are you sure". Right now you reset by turning things off one by one.

### 0.3 Safe search for the GIF tab (M)
Wikimedia Commons has no "family friendly" switch. I already limited it to its animated-GIF category and added a warning, but a search for "fire" once returned strike footage. Options:
1. Keep as is, with the warning (today).
2. Add a block list of words (cheap, imperfect).
3. Add a "Show only GIFs from these categories" allow list: animals, space, nature, art, science (safest, smaller choice).
- **My pick:** 3, with a switch to turn the filter off.

---

## Tier 1: things you will notice every day

### 1.1 Per-project looks that follow you automatically (M)
Today a workspace can pick a theme. Add: a theme can also set its **background** and **pet outfit**, so opening the Roblox project looks different from opening the website project.
- **Check:** switch workspaces in the real app, confirm the look swaps in under a second and swaps back.

### 1.2 Time-of-day looks (M)
"Day" and "Night" themes that switch on their own at times you pick, or when your computer goes dark/light.
- Schedules are plain numbers in the settings, no timers keep running when the app is closed.

### 1.3 Smarter chat colors (M)
- Color by **model** automatically (read from the chat, not just the title word).
- Color by **who is working on it** (you vs a helper).
- A "legend" you can show: a little key of what each color means.

### 1.4 Work-status strip (M)
A thin bar at the top that shows: how many chats are running, how many are waiting for you, how many finished since you last looked. Click a number to jump to the first one.
- **Needs care:** it must never cover app buttons. I would build it as a one-line row and have it audited first.

### 1.5 Better "waiting for you" alert (S)
Today it is a color. Add an optional gentle repeat (every 2 minutes, max 3 times, quiet), a tab-title badge, and a sound. All off by default.

---

## Tier 2: the pet becomes a real companion

### 2.1 Pet moods tied to your work (M)
- Sleeps when the app has been idle 10 minutes.
- Gets excited when 3 chats finish in a row.
- Wears a hat automatically on a streak ("3-day streak crown").

### 2.2 Outfits and room (M)
More than hats: scarves, glasses, a small room with items you buy with coins. All drawn with emoji and CSS (no downloads).

### 2.3 Two more games (S each)
- **Memory match** (flip cards).
- **Flappy-style one-button game.**
Both follow the same pure-rules, tested approach as the first five.

### 2.4 Daily goals (S)
"Finish 3 chats today: 5 coins." Resets at midnight. Never punishes you for skipping.

### 2.5 Pet speech lines (S)
A few hundred short, friendly lines picked by mood and time of day, so it does not repeat for weeks. Easy to extend.

---

## Tier 3: more ways to customize

### 3.1 Custom CSS box (S, **advanced**)
A text box for your own CSS that applies to the whole app. Powerful, and easy to break the app with, so: off by default, a visible "Remove my CSS" button, and it never loads if the app fails to start twice in a row.
- **Needs your yes:** this is the one feature that lets a pasted snippet change anything on screen.

### 3.2 Cursor and scrollbar styling (S)
Colored scrollbars matching your accent, an optional custom text cursor color.

### 3.3 Loading screens and empty states (M)
A friendlier "no chats yet" picture and a cute "thinking" animation next to the working effect.

### 3.4 Sidebar density and icons (M)
Compact / comfortable / roomy chat rows, optional emoji icons per chat (set by a word in the title like colors).

### 3.5 Window title and tab text (S)
Show the number of chats waiting in the window title.

### 3.6 Import / export everything (M)
One file that holds all your looks, saved themes and library list (never your API keys, never your pet unless you tick it). For moving to a new computer or sharing with a friend.
- **Check:** export, wipe, import, compare byte for byte.

---

## Tier 4: sharing and publishing (needs your yes on every step)

### 4.1 Put it on GitHub (S) **needs your yes**
Create `rayskinz/dsh-design` and push. I need: your yes, and how you are signed in to GitHub. Nothing is pushed until you say so.

### 4.2 Plugin icon and detail page (S)
A proper icon and a "what it does" page for the plugin list, with screenshots from real use.

### 4.3 A share gallery (L, **optional**)
A simple page of looks people made, installable with one click. Would need a place to host it, which may cost money, so this one waits for your decision.

---

## Things I would not build

| Idea | Why not |
|---|---|
| Sounds from files you download | Downloads and licenses; the built-in tones cover it |
| Live wallpapers from video sites | Streaming terms and heavy on your computer |
| Reading your chat text to react to it | Privacy; the plugin never reads message content today and should not start |
| Anything that sends data out | Right now the only outside calls are the GIF and wallpaper searches you click |

---

## Suggested order

1. 0.1 live check (you) and 0.2 reset buttons
2. 0.3 safe search
3. 1.1 per-project looks, 1.5 waiting alert
4. 2.1 mood links, 2.4 daily goals, 2.5 speech lines
5. 3.6 import / export, 4.1 GitHub (when you say yes)
6. 1.4 status strip, 1.2 time-of-day looks
7. The rest, by what you reach for most

## What I need from you

- **Yes/no:** put it on GitHub, and how you sign in to GitHub.
- **Pick:** safe search option 1, 2 or 3.
- **Time:** the 15-minute live check.
- **Anything you want added:** the list above is mine; yours goes first.
