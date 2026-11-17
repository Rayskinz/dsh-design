import test from 'node:test'
import assert from 'node:assert/strict'
import * as p from '../src/pet2.js'
import { makeRng } from '../src/games.js'

const pet = (o = {}) => ({ coins: 100, hats: [], hat: 'none', stats: p.petStatsEmpty(), ...o })

test('hats: buying needs enough coins, charges once, wears the new hat, and counts spending', () => {
  const a = p.petBuyHat(pet({ coins: 20 }), 'party'); assert.equal(a.coins, 0); assert.deepEqual(a.hats, ['party']); assert.equal(a.hat, 'party'); assert.equal(a.stats.coinsSpent, 20)
  const poor = pet({ coins: 19 }); assert.equal(p.petBuyHat(poor, 'party'), poor, 'not enough coins changes nothing')
  assert.equal(p.petBuyHat(a, 'party'), a, 'cannot buy twice'); assert.equal(p.petBuyHat(poor, 'none'), poor); assert.equal(p.petBuyHat(poor, 'toaster'), poor); assert.equal(p.petBuyHat(poor, undefined), poor)
  const b = p.petBuyHat({ coins: 100 }, 'cap'); assert.deepEqual(b.hats, ['cap'], 'an old pet with no hats list still works')
})

test('hats: wear and take off only what you own', () => {
  const owner = pet({ hats: ['crown'], hat: 'none' })
  assert.equal(p.petWearHat(owner, 'crown').hat, 'crown'); assert.equal(p.petWearHat(owner, 'cap'), owner, 'not owned'); assert.equal(p.petWearHat(owner, 'bogus'), owner)
  const on = p.petWearHat(owner, 'crown'); assert.equal(p.petWearHat(on, 'crown'), on, 'wearing the same hat is a no-op'); assert.equal(p.petWearHat(on, 'none').hat, 'none')
  assert.equal(p.petWearHat({ coins: 1 }, 'none').hat, 'none')
})

test('hats: clean drops unknown and duplicate hats and a hat that is not owned', () => {
  assert.deepEqual(p.petHatClean('crown', ['crown', 'crown', 'x', 'none', 5]), { hats: ['crown'], hat: 'crown' })
  assert.deepEqual(p.petHatClean('cap', ['crown']), { hats: ['crown'], hat: 'none' }); assert.deepEqual(p.petHatClean('crown', null), { hats: [], hat: 'none' }); assert.deepEqual(p.petHatClean('none', ['cap']), { hats: ['cap'], hat: 'none' })
  for (const [id, h] of Object.entries(p.HATS)) { assert.ok(h.label && h.cost >= 0, id); if (id !== 'none') assert.ok(h.emoji && h.cost > 0, id) }
})

test('stats: clean clamps, bump adds, coins go to earned or spent', () => {
  const c = p.petStatsClean({ chats: -5, games: 1e12, wins: 'x', feeds: 3.6, lastDay: '2026-11-17', streak: NaN, junk: 1 })
  assert.equal(c.chats, 0); assert.equal(c.games, 100_000_000); assert.equal(c.wins, 0); assert.equal(c.feeds, 4); assert.equal(c.lastDay, '2026-11-17'); assert.equal(c.streak, 0); assert.ok(!('junk' in c))
  assert.equal(p.petStatsClean({ lastDay: 'tomorrow' }).lastDay, ''); assert.deepEqual(p.petStatsClean(null), p.petStatsEmpty()); assert.deepEqual(p.petStatsClean('x'), p.petStatsEmpty())
  const s = p.petStatsBump(p.petStatsEmpty(), 'chats', 1, 3); assert.equal(s.chats, 1); assert.equal(s.coinsEarned, 3); assert.equal(p.petStatsBump(s, 'feeds', 1, -2).coinsSpent, 2)
  assert.deepEqual(p.petStatsBump(s, 'bogus', 5), s); assert.equal(p.petStatsBump(s, 'lastDay', 5).lastDay, ''); assert.equal(p.petStatsBump(s, 'chats', NaN).chats, 1)
})

test('stats: days and streak count calendar days in a row', () => {
  const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime()
  let s = p.petStatsVisit(p.petStatsEmpty(), at(2026, 11, 1)); assert.deepEqual([s.days, s.streak, s.lastDay], [1, 1, '2026-11-01'])
  assert.equal(p.petStatsVisit(s, at(2026, 11, 1, 23)).days, 1, 'the same day twice counts once'); assert.deepEqual(p.petStatsVisit(s, at(2026, 11, 1, 23)), s)
  s = p.petStatsVisit(s, at(2026, 11, 2)); assert.deepEqual([s.days, s.streak], [2, 2])
  s = p.petStatsVisit(s, at(2026, 11, 3, 0)); assert.deepEqual([s.days, s.streak], [3, 3], 'just after midnight is a new day')
  s = p.petStatsVisit(s, at(2026, 11, 6)); assert.deepEqual([s.days, s.streak], [4, 1], 'a gap resets the streak')
  s = p.petStatsVisit({ ...s, lastDay: '2026-12-31', streak: 5 }, at(2027, 1, 1)); assert.equal(s.streak, 6, 'year boundary')
  s = p.petStatsVisit({ ...s, lastDay: '2026-02-28', streak: 2 }, at(2026, 3, 1)); assert.equal(s.streak, 3, 'month boundary')
})

test('sound: every event has a tune; volume scales loudness; 0 is silent', () => {
  for (const e of p.SOUND_EVENTS) { const plan = p.soundPlan(e, 60); assert.ok(plan.length >= 2, e); for (const t of plan) { assert.ok(t.freq > 100 && t.freq < 4000 && t.ms > 0 && t.gain > 0 && t.gain <= 0.4, e + JSON.stringify(t)); assert.ok(['sine', 'triangle', 'square', 'sawtooth'].includes(t.type)) } assert.ok(p.soundLength(plan) <= 600, e + ' stays short') }
  const quiet = p.soundPlan('finish', 20), loud = p.soundPlan('finish', 100); assert.ok(loud[0].gain > quiet[0].gain * 2, 'louder is louder'); assert.deepEqual(p.soundPlan('finish', 0), [])
  assert.deepEqual(p.soundPlan('nope', 80), []); assert.deepEqual(p.soundPlan('finish', 'x'), []); assert.deepEqual(p.soundPlan('finish', -9), []); assert.deepEqual(p.soundPlan('finish', 80, ['finish']), [], 'a muted event is silent'); assert.ok(p.soundPlan('coin', 80, ['finish']).length)
  assert.ok(p.soundPlan('finish', 9999)[0].gain <= 0.35, 'volume above 100 is capped')
})

test('sound: the finish tune is a rising major arpeggio (C E G C)', () => {
  assert.deepEqual(p.soundPlan('finish', 80).map((t) => t.freq), [523, 659, 784, 1047])
})

test('sound: rate limit allows the first, blocks a burst, allows again after the gap, ignores unknown events', () => {
  let last = {}; let r = p.soundAllow(last, 'coin', 1000); assert.equal(r.ok, true); last = r.last
  r = p.soundAllow(last, 'coin', 1200); assert.equal(r.ok, false); assert.equal(r.last, last)
  assert.equal(p.soundAllow(last, 'finish', 1200).ok, true, 'a different event is independent'); assert.equal(p.soundAllow(last, 'coin', 1400).ok, true)
  assert.equal(p.soundAllow(last, 'bogus', 99999).ok, false); assert.equal(p.soundAllow(undefined, 'coin', 5).ok, true)
})

test('pet2: fuzz - random buys, wears and bumps keep the pet valid', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = makeRng(seed); let x = pet({ coins: Math.floor(r() * 500) })
    for (let i = 0; i < 60; i++) {
      const id = p.HAT_IDS[Math.floor(r() * p.HAT_IDS.length)], a = r()
      x = a < 0.4 ? p.petBuyHat(x, id) : a < 0.7 ? p.petWearHat(x, id) : { ...x, stats: p.petStatsBump(x.stats, ['chats', 'games', 'feeds', 'wins'][Math.floor(r() * 4)], 1, Math.floor(r() * 5) - 2) }
      assert.ok(x.coins >= 0, 'coins never go negative'); assert.deepEqual(p.petHatClean(x.hat, x.hats), { hats: x.hats, hat: x.hat }, 'hat state stays valid')
      assert.deepEqual(p.petStatsClean(x.stats), x.stats)
    }
  }
})
