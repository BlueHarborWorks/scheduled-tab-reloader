// Scheduled Tab Reloader: background event page.
// Each schedule owns one periodic alarm ("reload:<id>"). Schedules live in
// storage.session, so they survive the event page being suspended but are
// cleared when the browser restarts (tab ids are not stable across restarts).

const ALARM_PREFIX = "reload:";
const MIN_INTERVAL_MS = 10 * 1000;

// Serialize every read-modify-write of the schedule store: alarms for several
// schedules can fire together, and popup messages can arrive mid-tick.
let queue = Promise.resolve();
function serial(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function loadSchedules() {
  const { schedules } = await browser.storage.session.get("schedules");
  return schedules || {};
}

async function saveSchedules(schedules) {
  await browser.storage.session.set({ schedules });
  await updateBadge(schedules);
}

async function updateBadge(schedules) {
  const count = Object.keys(schedules).length;
  await browser.action.setBadgeText({ text: count ? String(count) : "" });
  await browser.action.setBadgeBackgroundColor({ color: "#2563eb" });
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function startSchedule({ tabIds, intervalMs, durationMs, bypassCache }) {
  if (!Array.isArray(tabIds) || tabIds.length === 0) {
    throw new Error("Select at least one tab.");
  }
  if (!Number.isFinite(intervalMs) || intervalMs < MIN_INTERVAL_MS) {
    throw new Error("The interval must be at least 10 seconds.");
  }
  if (durationMs != null && (!Number.isFinite(durationMs) || durationMs < intervalMs)) {
    throw new Error("The duration must be at least one interval long.");
  }
  return serial(async () => {
    const schedules = await loadSchedules();
    // A tab belongs to at most one schedule: the newest one wins.
    for (const s of Object.values(schedules)) {
      s.tabIds = s.tabIds.filter((t) => !tabIds.includes(t));
      if (s.tabIds.length === 0) {
        await browser.alarms.clear(ALARM_PREFIX + s.id);
        delete schedules[s.id];
      }
    }
    const now = Date.now();
    const id = newId();
    schedules[id] = {
      id,
      tabIds: [...tabIds],
      intervalMs,
      startedAt: now,
      endAt: durationMs == null ? null : now + durationMs,
      // The end is a reload count, not a clock check: periodic alarms drift a
      // little each tick, and "every 2 min for 2 hours" must mean 60 reloads.
      totalReloads: durationMs == null ? null : Math.floor(durationMs / intervalMs),
      nextAt: now + intervalMs,
      bypassCache: !!bypassCache,
      reloads: 0,
    };
    const minutes = intervalMs / 60000;
    browser.alarms.create(ALARM_PREFIX + id, {
      delayInMinutes: minutes,
      periodInMinutes: minutes,
    });
    await saveSchedules(schedules);
    return schedules[id];
  });
}

async function stopSchedule(id) {
  return serial(async () => {
    const schedules = await loadSchedules();
    await browser.alarms.clear(ALARM_PREFIX + id);
    delete schedules[id];
    await saveSchedules(schedules);
  });
}

async function stopAll() {
  return serial(async () => {
    const schedules = await loadSchedules();
    for (const id of Object.keys(schedules)) {
      await browser.alarms.clear(ALARM_PREFIX + id);
    }
    await saveSchedules({});
  });
}

async function tabExists(tabId) {
  try {
    await browser.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

async function onAlarm(alarm) {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const id = alarm.name.slice(ALARM_PREFIX.length);
  return serial(async () => {
    const schedules = await loadSchedules();
    const s = schedules[id];
    if (!s) {
      // Stale alarm (schedule already stopped, or left over from a restart).
      await browser.alarms.clear(alarm.name);
      return;
    }
    const now = Date.now();
    const alive = [];
    for (const tabId of s.tabIds) {
      if (await tabExists(tabId)) alive.push(tabId);
    }
    for (const tabId of alive) {
      try {
        await browser.tabs.reload(tabId, { bypassCache: s.bypassCache });
      } catch {
        // Tab closed between the check and the reload; dropped below.
      }
    }
    s.tabIds = alive;
    s.reloads += 1;
    s.nextAt = (alarm.scheduledTime || now) + s.intervalMs;

    const finished = s.totalReloads != null && s.reloads >= s.totalReloads;
    if (alive.length === 0 || finished) {
      await browser.alarms.clear(alarm.name);
      delete schedules[id];
    }
    await saveSchedules(schedules);
  });
}

async function onTabRemoved(tabId) {
  return serial(async () => {
    const schedules = await loadSchedules();
    let changed = false;
    for (const s of Object.values(schedules)) {
      if (!s.tabIds.includes(tabId)) continue;
      changed = true;
      s.tabIds = s.tabIds.filter((t) => t !== tabId);
      if (s.tabIds.length === 0) {
        await browser.alarms.clear(ALARM_PREFIX + s.id);
        delete schedules[s.id];
      }
    }
    if (changed) await saveSchedules(schedules);
  });
}

async function onMessage(msg) {
  switch (msg && msg.type) {
    case "start":
      return { ok: true, schedule: await startSchedule(msg) };
    case "stop":
      await stopSchedule(msg.id);
      return { ok: true };
    case "stopAll":
      await stopAll();
      return { ok: true };
    case "list":
      return { ok: true, schedules: await loadSchedules() };
    default:
      return { ok: false, error: "Unknown message." };
  }
}

browser.alarms.onAlarm.addListener(onAlarm);
browser.tabs.onRemoved.addListener(onTabRemoved);
browser.runtime.onMessage.addListener((msg) =>
  onMessage(msg).catch((err) => ({ ok: false, error: err.message }))
);
browser.runtime.onStartup.addListener(async () => {
  // storage.session is empty after a restart; drop any alarms that outlived it.
  const alarms = await browser.alarms.getAll();
  for (const a of alarms) {
    if (a.name.startsWith(ALARM_PREFIX)) await browser.alarms.clear(a.name);
  }
  await updateBadge({});
});

if (typeof module !== "undefined") {
  module.exports = { onAlarm, onTabRemoved, onMessage, MIN_INTERVAL_MS };
}
