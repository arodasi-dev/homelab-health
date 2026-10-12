const REFRESH_MS = 10000;
const RING_LENGTH = 2 * Math.PI * 32;
const LIMITS = {
  cpu: { label: "CPU", warn: 70, bad: 90 },
  mem: { label: "Memória", warn: 80, bad: 92 },
  disk: { label: "Disco", warn: 80, bad: 90 },
  temp: { label: "Temperatura", warn: 70, bad: 85 },
};
const UNITS = { second: "s", minute: "min", hour: "h", week: "sem", month: "mês" };

const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* modo privado: pede de novo */ } },
};

const gb = (bytes) => (bytes / 1024 ** 3).toFixed(1);

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}min` : `${m}min`;
}

// "Up 12 days" (Docker) -> "12 dias"; o que não for reconhecido aparece como veio.
function formatContainerStatus(c) {
  const match = c.state === "running" && c.status.match(/^Up (?:About )?(an?|\d+) (second|minute|hour|day|week|month)/);
  if (!match) return c.status;
  const n = /^an?$/.test(match[1]) ? 1 : Number(match[1]);
  return match[2] === "day" ? `${n} ${n === 1 ? "dia" : "dias"}` : `${n} ${UNITS[match[2]]}`;
}

function levelOf(kind, value) {
  const { warn, bad } = LIMITS[kind];
  return value >= bad ? "bad" : value >= warn ? "warn" : "ok";
}

function renderTile(kind, text, percent, detail) {
  const level = levelOf(kind, percent);
  const clamped = Math.min(percent, 100);
  const tile = $(kind);
  tile.className = `tile ${level}`;
  tile.innerHTML = `
    <h2></h2>
    <div class="ring">
      <svg viewBox="0 0 84 84"><circle class="trk" cx="42" cy="42" r="32"/><circle class="arc" cx="42" cy="42" r="32"/></svg>
      <p class="big"></p>
    </div>
    <p class="big value"></p>
    <div class="bar"><i></i></div>
    <small></small>`;
  tile.querySelector("h2").textContent = LIMITS[kind].label;
  tile.querySelector(".ring .big").textContent = text;
  tile.querySelector(".value").textContent = text;
  tile.querySelector(".arc").style.strokeDasharray = `${(clamped / 100) * RING_LENGTH} ${RING_LENGTH}`;
  tile.querySelector(".bar i").style.width = `${clamped}%`;
  tile.querySelector("small").textContent = detail;
  return level;
}

function renderList(id, items, emptyText) {
  const ul = $(id);
  ul.replaceChildren();
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = emptyText;
    ul.append(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = `dot ${item.dot}`;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = item.name;
    const note = document.createElement("small");
    note.textContent = item.note;
    if (item.dot === "down") note.className = "fail";
    li.append(dot, name, note);
    ul.append(li);
  }
}

// Junta tudo que merece atenção; o pior nível manda no resumo do topo.
function findIssues(data, levels) {
  const issues = [];
  const add = (level, text) => issues.push({ level, text });
  for (const [kind, level] of Object.entries(levels)) {
    if (level !== "ok") add(level, `${LIMITS[kind].label} ${level === "bad" ? "crítica" : "alta"}`);
  }
  for (const s of data.services.filter((s) => !s.up)) add("bad", `${s.name} fora do ar`);
  if (data.containers === null) add("warn", "Docker indisponível");
  else for (const c of data.containers.filter((c) => c.state !== "running")) add("bad", `${c.name} parado`);
  return issues;
}

function renderHero(data, levels) {
  const issues = findIssues(data, levels);
  const level = issues.some((i) => i.level === "bad") ? "bad" : issues.length ? "warn" : "ok";
  const running = (data.containers || []).filter((c) => c.state === "running").length;
  const servicesUp = data.services.filter((s) => s.up).length;
  $("hero").className = `hero ${level}`;
  $("hero-icon").textContent = { ok: "✓", warn: "!", bad: "✕" }[level];
  $("hero-title").textContent = { ok: "Tudo certo", warn: "Atenção", bad: "Problema" }[level];
  $("hero-sub").textContent = issues.length
    ? issues.slice(0, 2).map((i) => i.text).join(" · ")
    : `${running} containers, ${servicesUp} serviços no ar`;
}

function render(data) {
  const temp = data.temperature_c;
  const levels = {
    cpu: renderTile("cpu", `${data.cpu_percent.toFixed(0)}%`, data.cpu_percent,
      `carga ${data.load.join(" · ")}`),
    mem: renderTile("mem", `${data.memory.percent.toFixed(0)}%`, data.memory.percent,
      `${gb(data.memory.used)} de ${gb(data.memory.total)} GB`),
    disk: renderTile("disk", `${data.disk.percent.toFixed(0)}%`, data.disk.percent,
      `${gb(data.disk.used)} de ${gb(data.disk.total)} GB`),
    temp: renderTile("temp", temp === null ? "—" : `${temp.toFixed(0)}°C`, temp ?? 0,
      temp === null ? "sem sensor" : "maior sensor"),
  };
  renderHero(data, levels);

  renderList("services", data.services.map((s) => ({
    name: s.name, dot: s.up ? "" : "down", note: s.up ? `${s.ms} ms` : "fora do ar",
  })), "Nenhum serviço configurado");
  renderList("containers", (data.containers || []).map((c) => ({
    name: c.name, dot: c.state === "running" ? "" : "down", note: formatContainerStatus(c),
  })), data.containers === null ? "Docker indisponível" : "Nenhum container");

  $("updated").textContent =
    `ligado há ${formatUptime(data.uptime_s)} · atualizado às ${new Date(data.time * 1000).toLocaleTimeString("pt-BR")}`;
}

function setConn(ok, text) {
  const pill = $("conn");
  pill.className = `pill ${ok ? "ok" : "bad"}`;
  pill.textContent = text;
}

async function refresh() {
  const url = store.get("url"), token = store.get("token");
  if (!url || !token) {
    if (!$("settings").open) openSettings();
    return;
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401) throw new Error("token inválido");
    if (!res.ok) throw new Error(`erro ${res.status}`);
    render(await res.json());
    $("dashboard").hidden = false;
    setConn(true, "online");
  } catch (err) {
    setConn(false, err.message === "token inválido" ? err.message : "sem conexão");
  }
}

function openSettings() {
  $("url").value = store.get("url");
  $("token").value = store.get("token");
  $("settings").showModal();
}

$("open-settings").addEventListener("click", openSettings);
$("cancel").addEventListener("click", () => $("settings").close());
$("settings-form").addEventListener("submit", () => {
  store.set("url", $("url").value.trim());
  store.set("token", $("token").value.trim());
  refresh();
});

refresh();
setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
