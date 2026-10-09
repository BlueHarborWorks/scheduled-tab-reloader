// Drives background.js against a fake WebExtension API with a fake clock.
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

function setup({ badgeThrows = false } = {}) {
  let now = 1_000_000;
  const store = {};
  const alarms = new Map();
  const reloads = [];
  const openTabs = new Set([1, 2, 3]);
  const listeners = {};
  const badge = [];
  const on = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
  const badgeCall = async (v) => {
    if (badgeThrows) throw new Error("setBadgeText is not supported");
    badge.push(v);
  };

  global.browser = {
    storage: {
      session: {
        get: async (k) => ({ [k]: store[k] && structuredClone(store[k]) }),
        set: async (obj) => Object.assign(store, structuredClone(obj)),
      },
    },
    action: { setBadgeText: badgeCall, setBadgeBackgroundColor: badgeCall },
    alarms: {
      create: (name, info) => alarms.set(name, info),
      clear: async (name) => alarms.delete(name),
      getAll: async () => [...alarms.keys()].map((name) => ({ name })),
      onAlarm: on("alarm"),
    },
    tabs: {
      get: async (id) => { if (!openTabs.has(id)) throw new Error("no tab"); return { id }; },
      reload: async (id, opts) => reloads.push({ id, at: now, ...opts }),
      onRemoved: on("removed"),
    },
    runtime: { onMessage: on("message"), onStartup: on("startup"), onInstalled: on("installed") },
  };
  Date.now = () => now;

  const file = path.join(__dirname, "../extension/background.js");
  delete require.cache[file];
  const bg = require(file);
  return {
    bg, store, alarms, reloads, openTabs, listeners, badge,
    advance: (ms) => { now += ms; },
    now: () => now,
    // Fire every pending alarm the way Firefox does: scheduledTime = due time.
    fire: async (name, scheduledTime) => bg.onAlarm({ name, scheduledTime }),
    // The runtime.onMessage listener as registered, including its error wrapper.
    message: (msg) => listeners.message(msg),
  };
}

const MIN = 60_000;

test("every 2 minutes for 2 hours reloads exactly 60 times, then stops", async () => {
  const t = setup();
  const res = await t.bg.onMessage({ type: "start", tabIds: [1, 2], intervalMs: 2 * MIN, durationMs: 120 * MIN });
  assert.ok(res.ok);
  const name = [...t.alarms.keys()][0];
  assert.deepStrictEqual(t.alarms.get(name), { delayInMinutes: 2, periodInMinutes: 2 });

  let ticks = 0;
  while (t.alarms.has(name) && ticks < 100) {
    t.advance(2 * MIN + 300); // a little timer jitter each tick
    await t.fire(name, t.now() - 300);
    ticks++;
  }
  assert.strictEqual(ticks, 60);
  assert.strictEqual(t.reloads.length, 120); // 2 tabs x 60 ticks
  assert.deepStrictEqual(t.store.schedules, {});
});

test("closing every scheduled tab ends the schedule", async () => {
  const t = setup();
  await t.bg.onMessage({ type: "start", tabIds: [3], intervalMs: MIN, durationMs: null });
  assert.strictEqual(t.alarms.size, 1);
  t.openTabs.delete(3);
  await t.bg.onTabRemoved(3);
  assert.strictEqual(t.alarms.size, 0);
  assert.deepStrictEqual(t.store.schedules, {});
});

test("a tab closed without an onRemoved event is dropped at the next tick", async () => {
  const t = setup();
  await t.bg.onMessage({ type: "start", tabIds: [1, 2], intervalMs: MIN, durationMs: null });
  const name = [...t.alarms.keys()][0];
  t.openTabs.delete(2);
  t.advance(MIN);
  await t.fire(name, t.now());
  assert.deepStrictEqual(t.reloads.map((r) => r.id), [1]);
  assert.deepStrictEqual(Object.values(t.store.schedules)[0].tabIds, [1]);
});

test("until-stopped runs until stop is sent", async () => {
  const t = setup();
  const { schedule } = await t.bg.onMessage({ type: "start", tabIds: [1], intervalMs: 30_000, durationMs: null, bypassCache: true });
  const name = [...t.alarms.keys()][0];
  for (let i = 0; i < 500; i++) { t.advance(30_000); await t.fire(name, t.now()); }
  assert.strictEqual(t.reloads.length, 500);
  assert.ok(t.reloads.every((r) => r.bypassCache === true));
  await t.bg.onMessage({ type: "stop", id: schedule.id });
  assert.strictEqual(t.alarms.size, 0);
});

test("a tab moves to the newest schedule instead of being reloaded twice", async () => {
  const t = setup();
  await t.bg.onMessage({ type: "start", tabIds: [1, 2], intervalMs: MIN, durationMs: null });
  await t.bg.onMessage({ type: "start", tabIds: [2], intervalMs: 5 * MIN, durationMs: null });
  const all = Object.values(t.store.schedules).map((s) => s.tabIds).sort();
  assert.deepStrictEqual(all, [[1], [2]]);
  await t.bg.onMessage({ type: "start", tabIds: [1], intervalMs: MIN, durationMs: null });
  assert.strictEqual(Object.keys(t.store.schedules).length, 2); // the [1] schedule was replaced
  assert.strictEqual(t.alarms.size, 2);
});

test("invalid input is rejected", async () => {
  const t = setup();
  const r1 = await t.bg.onMessage({ type: "start", tabIds: [], intervalMs: MIN, durationMs: null }).catch((e) => e);
  assert.match(String(r1.message || r1.error), /at least one tab/);
  const r2 = await t.bg.onMessage({ type: "start", tabIds: [1], intervalMs: 5000, durationMs: null }).catch((e) => e);
  assert.match(String(r2.message || r2.error), /10 seconds/);
  const r3 = await t.bg.onMessage({ type: "start", tabIds: [1], intervalMs: 5 * MIN, durationMs: MIN }).catch((e) => e);
  assert.match(String(r3.message || r3.error), /one interval/);
  assert.strictEqual(t.alarms.size, 0);
});

test("the message listener turns a thrown error into an { ok: false } reply", async () => {
  const t = setup();
  const res = await t.message({ type: "start", tabIds: [], intervalMs: MIN, durationMs: null });
  assert.deepStrictEqual(res, { ok: false, error: "Select at least one tab." });
  const unknown = await t.message({ type: "nope" });
  assert.strictEqual(unknown.ok, false);
});

test("duplicate and malformed tab ids are dropped", async () => {
  const t = setup();
  const { schedule } = await t.bg.onMessage({
    type: "start", tabIds: [1, 1, "2", -5, 2.5, null, 2], intervalMs: MIN, durationMs: null,
  });
  assert.deepStrictEqual(schedule.tabIds, [1, 2]);
  const name = [...t.alarms.keys()][0];
  t.advance(MIN);
  await t.fire(name, t.now());
  assert.deepStrictEqual(t.reloads.map((r) => r.id), [1, 2]); // once each, not twice
});

test("stale alarms with no schedule are cleared", async () => {
  const t = setup();
  t.alarms.set("reload:ghost", {});
  await t.fire("reload:ghost", t.now());
  assert.strictEqual(t.alarms.size, 0);
  assert.strictEqual(t.reloads.length, 0);
});

test("a badge API that throws does not stop schedules from starting", async () => {
  const t = setup({ badgeThrows: true });
  const res = await t.message({ type: "start", tabIds: [1], intervalMs: MIN, durationMs: null });
  assert.ok(res.ok, JSON.stringify(res));
  assert.strictEqual(t.alarms.size, 1);
});

test("the badge shows the number of active schedules", async () => {
  const t = setup();
  await t.bg.onMessage({ type: "start", tabIds: [1], intervalMs: MIN, durationMs: null });
  await t.bg.onMessage({ type: "start", tabIds: [2], intervalMs: MIN, durationMs: null });
  assert.deepStrictEqual(t.badge.filter((b) => "text" in b).map((b) => b.text), ["1", "2"]);
  await t.bg.onMessage({ type: "stopAll" });
  assert.strictEqual(t.badge.filter((b) => "text" in b).pop().text, "");
});

test("a burst of catch-up alarms after sleep reloads once, not once per missed period", async () => {
  const t = setup();
  await t.bg.onMessage({ type: "start", tabIds: [1], intervalMs: MIN, durationMs: null });
  const name = [...t.alarms.keys()][0];
  t.advance(MIN);
  await t.fire(name, t.now());
  // The machine slept for 30 minutes; Firefox delivers the missed ticks back to back.
  t.advance(30 * MIN);
  for (let i = 0; i < 30; i++) {
    await t.fire(name, t.now() - (30 - i) * MIN);
    t.advance(5); // a few ms apart
  }
  assert.strictEqual(t.reloads.length, 2);
  // The schedule carries on normally afterwards.
  t.advance(MIN);
  await t.fire(name, t.now());
  assert.strictEqual(t.reloads.length, 3);
  assert.strictEqual(Object.values(t.store.schedules)[0].reloads, 3);
});

test("a timed schedule ends once the clock is past its end, even if reloads were missed", async () => {
  const t = setup();
  await t.bg.onMessage({ type: "start", tabIds: [1], intervalMs: 2 * MIN, durationMs: 60 * MIN });
  const name = [...t.alarms.keys()][0];
  t.advance(2 * MIN);
  await t.fire(name, t.now());
  assert.strictEqual(t.reloads.length, 1);
  // Three hours of sleep: one late tick arrives, reloads once more, then the schedule ends.
  t.advance(180 * MIN);
  await t.fire(name, t.now() - 178 * MIN);
  assert.strictEqual(t.reloads.length, 2);
  assert.strictEqual(t.alarms.size, 0);
  assert.deepStrictEqual(t.store.schedules, {});
});

test("startup and install clear leftover alarms and the badge", async () => {
  const t = setup();
  t.alarms.set("reload:old", {});
  t.alarms.set("other:keep", {});
  await t.listeners.installed();
  assert.deepStrictEqual([...t.alarms.keys()], ["other:keep"]);
  assert.strictEqual(t.badge.filter((b) => "text" in b).pop().text, "");
  t.alarms.set("reload:old2", {});
  await t.listeners.startup();
  assert.deepStrictEqual([...t.alarms.keys()], ["other:keep"]);
});
