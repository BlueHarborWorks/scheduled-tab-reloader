const $ = (id) => document.getElementById(id);
const MIN_INTERVAL_MS = 10 * 1000;
const PREF_FIELDS = ["interval-value", "interval-unit", "duration-value", "duration-unit"];

let tabs = []; // tabs in the current window (the picker)
let allTabs = []; // tabs in every window (titles for schedules started elsewhere)
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

function showError(message) {
  $("error").textContent = message || "";
  $("error").hidden = !message;
}

function updateSummary() {
  const form = readForm();
  const error = validate(form);
  $("duration-value").disabled = $("duration-unit").value === "forever";
  // The spinner's lower bound follows the unit, so arrowing down cannot
  // land on an interval the background would reject.
  $("interval-value").min = $("interval-unit").value === "1000" ? "10" : "1";
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
  let activeItem = null;
  for (const tab of tabs) {
    const box = el("input", { type: "checkbox", value: String(tab.id), checked: checked.has(tab.id) });
    box.addEventListener("change", () => { syncSelectAll(); updateSummary(); showError(null); });
    const icon = tab.favIconUrl && /^(https?|data):/.test(tab.favIconUrl)
      ? el("img", { src: tab.favIconUrl, alt: "" })
      : el("span", { className: "favicon-blank" });
    if (icon.tagName === "IMG") {
      icon.addEventListener("error", () => icon.replaceWith(el("span", { className: "favicon-blank" })));
    }
    const children = [box, icon, el("span", { className: "title", textContent: tab.title || tab.url, title: tab.url })];
    if (busy.has(tab.id)) children.push(el("span", { className: "chip", textContent: "scheduled" }));
    const item = el("li", {}, [el("label", {}, children)]);
    if (tab.id === activeTabId) activeItem = item;
    list.append(item);
  }
  if (activeItem && !preserveChecked) activeItem.scrollIntoView({ block: "nearest" });
  syncSelectAll();
}

function syncSelectAll() {
  const boxes = [...document.querySelectorAll(".tab-list input")];
  $("select-all").checked = boxes.length > 0 && boxes.every((b) => b.checked);
}

function tabTitle(tabId) {
  const t = allTabs.find((x) => x.id === tabId) || tabs.find((x) => x.id === tabId);
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
    const next = s.nextAt - now < 1000 ? "Next reload now." : `Next reload in ${formatDuration(s.nextAt - now)}.`;
    const stop = el("button", { className: "secondary", textContent: "Stop", title: "Stop this schedule" });
    stop.addEventListener("click", async () => {
      await send({ type: "stop", id: s.id });
      await refresh(true);
    });
    list.append(el("li", {}, [
      el("span", { className: "tabs", textContent: label, title: names.join("\n") }),
      stop,
      el("span", { className: "meta", textContent: `Every ${formatInterval(s.intervalMs)}, ${ends}` }),
      el("span", {
        className: "meta",
        textContent: `${next} Reloaded ${s.reloads}` +
          (s.totalReloads != null ? ` of ${s.totalReloads} times.` : ` time${s.reloads === 1 ? "" : "s"}.`),
      }),
    ]));
  }
}

// Messaging can fail while the event page is restarting; surface it instead
// of leaving the popup half-rendered.
async function send(msg) {
  try {
    const res = await browser.runtime.sendMessage(msg);
    if (res && !res.ok && res.error) showError(res.error);
    return res || { ok: false, error: "No response from the extension." };
  } catch (err) {
    showError("The extension did not respond. Try closing and reopening the popup.");
    return { ok: false, error: String(err && err.message) };
  }
}

function tabSignature(list) {
  return list.map((t) => `${t.id}:${t.title || ""}:${t.favIconUrl || ""}`).join("|");
}

function scheduleSignature(set) {
  return Object.values(set).map((s) => `${s.id}:${s.tabIds.join(",")}`).sort().join("|");
}

async function queryTabs() {
  const [active] = await browser.tabs.query({ active: true, currentWindow: true });
  tabs = await browser.tabs.query({ currentWindow: true });
  allTabs = await browser.tabs.query({});
  return active && active.id;
}

async function refresh(preserveChecked) {
  const res = await send({ type: "list" });
  schedules = res.ok ? res.schedules : {};
  const activeId = await queryTabs();
  renderTabs(activeId, preserveChecked);
  renderSchedules();
  updateSummary();
}

async function loadPrefs() {
  try {
    const { prefs } = await browser.storage.local.get("prefs");
    if (!prefs) return;
    for (const id of PREF_FIELDS) {
      if (prefs[id] != null) $(id).value = prefs[id];
    }
    $("bypass-cache").checked = !!prefs.bypassCache;
  } catch {
    // Defaults in the markup are fine.
  }
}

async function savePrefs() {
  const prefs = { bypassCache: $("bypass-cache").checked };
  for (const id of PREF_FIELDS) {
    prefs[id] = $(id).value;
  }
  try { await browser.storage.local.set({ prefs }); } catch { /* not critical */ }
}

async function start() {
  const form = readForm();
  const error = validate(form);
  showError(null);
  if (error) return;
  $("start").disabled = true;
  const res = await send({ type: "start", ...form });
  if (!res.ok) {
    showError(res.error || "Could not start the schedule.");
    $("start").disabled = false;
    return;
  }
  await savePrefs();
  await refresh(true);
}

$("select-all").addEventListener("change", (e) => {
  for (const b of document.querySelectorAll(".tab-list input")) b.checked = e.target.checked;
  updateSummary();
  showError(null);
});
for (const id of PREF_FIELDS) {
  $(id).addEventListener("input", () => { updateSummary(); showError(null); });
}
$("bypass-cache").addEventListener("change", () => showError(null));
$("start").addEventListener("click", start);
document.querySelector(".form").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName !== "BUTTON") {
    e.preventDefault();
    start();
  }
});
$("stop-all").addEventListener("click", async () => {
  await send({ type: "stopAll" });
  await refresh(true);
});

(async () => {
  await loadPrefs();
  await refresh(false);
  // Keep countdowns live, pick up reloads that happened while open, and
  // follow tabs that were opened, closed or renamed in the meantime.
  setInterval(async () => {
    let res;
    try {
      res = await browser.runtime.sendMessage({ type: "list" });
    } catch {
      return; // transient; the next tick will try again
    }
    const before = scheduleSignature(schedules);
    if (res && res.ok) schedules = res.schedules;
    const tabsBefore = tabSignature(tabs);
    const activeId = await queryTabs();
    if (tabSignature(tabs) !== tabsBefore || scheduleSignature(schedules) !== before) {
      renderTabs(activeId, true);
      updateSummary();
    }
    renderSchedules();
  }, 1000);
})();
