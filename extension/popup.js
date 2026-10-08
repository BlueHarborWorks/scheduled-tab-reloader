const $ = (id) => document.getElementById(id);
const MIN_INTERVAL_MS = 10 * 1000;

let tabs = [];
let schedules = {};

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

function formatInterval(ms) {
  if (ms % 3600000 === 0) return plural(ms / 3600000, "hour");
  if (ms % 60000 === 0) return plural(ms / 60000, "minute");
  return plural(Math.round(ms / 1000), "second");
}

function plural(n, word) {
  return n === 1 ? `${word}` : `${n} ${word}s`;
}

function formatClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function scheduledTabIds() {
  const map = new Map();
  for (const s of Object.values(schedules)) {
    for (const t of s.tabIds) map.set(t, s);
  }
  return map;
}

function readForm() {
  const intervalMs = Number($("interval-value").value) * Number($("interval-unit").value);
  const unit = $("duration-unit").value;
  const durationMs = unit === "forever" ? null : Number($("duration-value").value) * Number(unit);
  const tabIds = [...document.querySelectorAll(".tab-list input:checked")].map((i) => Number(i.value));
  return { tabIds, intervalMs, durationMs, bypassCache: $("bypass-cache").checked };
}

function validate({ tabIds, intervalMs, durationMs }) {
  if (tabIds.length === 0) return "Select at least one tab.";
  if (!(intervalMs >= MIN_INTERVAL_MS)) return "The interval must be at least 10 seconds.";
  if (durationMs != null && !(durationMs >= intervalMs)) return "The duration must be at least one interval long.";
  return null;
}

function updateSummary() {
  const form = readForm();
  const error = validate(form);
  $("duration-value").disabled = $("duration-unit").value === "forever";
  $("start").disabled = !!error;
  if (error) {
    $("summary").textContent = error;
    return;
  }
  const n = form.tabIds.length;
  const what = n === 1 ? "1 tab" : `${n} tabs`;
  if (form.durationMs == null) {
    $("summary").textContent = `Reloads ${what} every ${formatInterval(form.intervalMs)} until stopped.`;
  } else {
    const count = Math.floor(form.durationMs / form.intervalMs);
    $("summary").textContent =
      `Reloads ${what} every ${formatInterval(form.intervalMs)}, ${count} time${count === 1 ? "" : "s"}, ` +
      `ending around ${formatClock(Date.now() + form.durationMs)}.`;
  }
}

function renderTabs(activeTabId, preserveChecked) {
  const checked = preserveChecked
    ? new Set([...document.querySelectorAll(".tab-list input:checked")].map((i) => Number(i.value)))
    : new Set([activeTabId]);
  const busy = scheduledTabIds();
  const list = $("tab-list");
  list.replaceChildren();
  for (const tab of tabs) {
    const box = el("input", { type: "checkbox", value: String(tab.id), checked: checked.has(tab.id) });
    box.addEventListener("change", () => { syncSelectAll(); updateSummary(); });
    const icon = tab.favIconUrl && /^(https?|data):/.test(tab.favIconUrl)
      ? el("img", { src: tab.favIconUrl, alt: "" })
      : el("span", { className: "favicon-blank" });
    if (icon.tagName === "IMG") {
      icon.addEventListener("error", () => icon.replaceWith(el("span", { className: "favicon-blank" })));
    }
    const children = [box, icon, el("span", { className: "title", textContent: tab.title || tab.url, title: tab.url })];
    if (busy.has(tab.id)) children.push(el("span", { className: "chip", textContent: "scheduled" }));
    list.append(el("li", {}, [el("label", {}, children)]));
  }
  syncSelectAll();
}

function syncSelectAll() {
  const boxes = [...document.querySelectorAll(".tab-list input")];
  $("select-all").checked = boxes.length > 0 && boxes.every((b) => b.checked);
}

function tabTitle(tabId) {
  const t = tabs.find((x) => x.id === tabId);
  return t ? t.title || t.url : `Tab ${tabId}`;
}

function renderSchedules() {
  const list = $("schedule-list");
  list.replaceChildren();
  const items = Object.values(schedules).sort((a, b) => a.startedAt - b.startedAt);
  $("no-schedules").hidden = items.length > 0;
  $("stop-all").hidden = items.length < 2;
  const now = Date.now();
  for (const s of items) {
    const names = s.tabIds.map(tabTitle);
    const label = names.length === 1 ? names[0] : `${names.length} tabs: ${names.join(", ")}`;
    const ends = s.endAt == null ? "until stopped" : `ends ${formatClock(s.endAt)} (${formatDuration(s.endAt - now)} left)`;
    const stop = el("button", { className: "secondary", textContent: "Stop" });
    stop.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ type: "stop", id: s.id });
      await refresh(true);
    });
    list.append(el("li", {}, [
      el("span", { className: "tabs", textContent: label, title: names.join("\n") }),
      stop,
      el("span", { className: "meta", textContent: `Every ${formatInterval(s.intervalMs)}, ${ends}` }),
      el("span", {
        className: "meta",
        textContent: `Next reload in ${formatDuration(s.nextAt - now)}. Reloaded ${s.reloads}` +
          (s.totalReloads != null ? ` of ${s.totalReloads} times.` : ` time${s.reloads === 1 ? "" : "s"}.`),
      }),
    ]));
  }
}

async function refresh(preserveChecked) {
  const res = await browser.runtime.sendMessage({ type: "list" });
  schedules = res && res.ok ? res.schedules : {};
  const [active] = await browser.tabs.query({ active: true, currentWindow: true });
  tabs = await browser.tabs.query({ currentWindow: true });
  renderTabs(active && active.id, preserveChecked);
  renderSchedules();
  updateSummary();
}

async function loadPrefs() {
  try {
    const { prefs } = await browser.storage.local.get("prefs");
    if (!prefs) return;
    for (const id of ["interval-value", "interval-unit", "duration-value", "duration-unit"]) {
      if (prefs[id] != null) $(id).value = prefs[id];
    }
    $("bypass-cache").checked = !!prefs.bypassCache;
  } catch {
    // Defaults in the markup are fine.
  }
}

async function savePrefs() {
  const prefs = { bypassCache: $("bypass-cache").checked };
  for (const id of ["interval-value", "interval-unit", "duration-value", "duration-unit"]) {
    prefs[id] = $(id).value;
  }
  try { await browser.storage.local.set({ prefs }); } catch { /* not critical */ }
}

$("select-all").addEventListener("change", (e) => {
  for (const b of document.querySelectorAll(".tab-list input")) b.checked = e.target.checked;
  updateSummary();
});
for (const id of ["interval-value", "interval-unit", "duration-value", "duration-unit"]) {
  $(id).addEventListener("input", updateSummary);
}
$("start").addEventListener("click", async () => {
  const form = readForm();
  const error = validate(form);
  $("error").hidden = true;
  if (error) return;
  const res = await browser.runtime.sendMessage({ type: "start", ...form });
  if (!res || !res.ok) {
    $("error").textContent = (res && res.error) || "Could not start the schedule.";
    $("error").hidden = false;
    return;
  }
  await savePrefs();
  await refresh(true);
});
$("stop-all").addEventListener("click", async () => {
  await browser.runtime.sendMessage({ type: "stopAll" });
  await refresh(true);
});

(async () => {
  await loadPrefs();
  await refresh(false);
  // Keep countdowns live, and pick up reloads that happened while open.
  setInterval(async () => {
    const res = await browser.runtime.sendMessage({ type: "list" });
    if (res && res.ok) {
      const changed = JSON.stringify(Object.keys(res.schedules)) !== JSON.stringify(Object.keys(schedules));
      schedules = res.schedules;
      if (changed) renderTabs(null, true);
    }
    renderSchedules();
  }, 1000);
})();
