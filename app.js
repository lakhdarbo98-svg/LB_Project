/* =====================================================================
   استوديو المونتاج — تطبيق إدارة مشاريع الفيديو إديتور
   يعمل بالكامل داخل المتصفح (localStorage) — بدون سيرفر أو حساب أو أي تكلفة
===================================================================== */

const STORAGE_KEY = "video_studio_projects_v1";

// ---------- constants ----------
const STAGE_TEMPLATE = [
  { name: "استلام وتنظيم المواد", icon: "📥" },
  { name: "المونتاج الأولي (Rough Cut)", icon: "✂️" },
  { name: "المونتاج النهائي (Fine Cut)", icon: "🎞️" },
  { name: "تصحيح وتلوين الألوان", icon: "🎨" },
  { name: "تصميم الصوت والمكساج", icon: "🎧" },
  { name: "الموشن جرافيك والمؤثرات", icon: "✨" },
  { name: "مراجعة العميل والتعديلات", icon: "👁️" },
  { name: "التصدير والتسليم", icon: "📦" },
];

const PRIORITIES = {
  urgent: { label: "عاجلة", color: "var(--danger)", dim: "var(--danger-dim)" },
  high: { label: "مرتفعة", color: "var(--orange)", dim: "var(--orange-dim)" },
  medium: { label: "متوسطة", color: "var(--warning)", dim: "var(--warning-dim)" },
  low: { label: "منخفضة", color: "var(--teal)", dim: "var(--teal-dim)" },
};

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function makeStages() { return STAGE_TEMPLATE.map(s => ({ id: uid(), name: s.name, icon: s.icon, tasks: [] })); }

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d - now) / 86400000);
}
function urgencyColor(days) {
  if (days === null) return "var(--text-faint)";
  if (days <= 2) return "var(--danger)";
  if (days <= 6) return "var(--orange)";
  return "var(--teal)";
}
function projectProgress(p) {
  let total = 0, done = 0;
  (p.stages || []).forEach(s => (s.tasks || []).forEach(t => { total++; if (t.done) done++; }));
  return total ? Math.round((done / total) * 100) : 0;
}
function fmtDate(dateStr) {
  if (!dateStr) return "بدون موعد";
  return new Date(dateStr).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
}
function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => (t.hidden = true), 2400);
}

// ---------- state ----------
let projects = [];
let selectedId = null;
let filter = "all";
let search = "";

// ============================================================
// LOCAL STORAGE DATA LAYER
// ============================================================
const SEED = [
  {
    id: uid(), name: "حملة إعلانية - براند قهوة", client: "Roast Co.", type: "إعلان تجاري",
    deadline: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
    priority: "high", storage: "480 GB", notes: "التسليم بصيغة 4K + نسخة عمودية للسوشيال.",
    stages: (() => {
      const st = makeStages();
      st[0].tasks = [{ id: uid(), text: "نسخ المواد الخام على SSD", done: true }, { id: uid(), text: "ترتيب المشاهد حسب اللوكيشن", done: true }];
      st[1].tasks = [{ id: uid(), text: "تجميع أفضل اللقطات (Selects)", done: true }, { id: uid(), text: "بناء الهيكل الزمني للسيناريو", done: false }];
      st[2].tasks = [{ id: uid(), text: "ضبط الإيقاع والانتقالات", done: false }];
      st[3].tasks = [{ id: uid(), text: "ضبط توازن الأبيض", done: false }, { id: uid(), text: "لوك سينمائي دافئ", done: false }];
      return st;
    })(),
  },
];

function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error("تعذّر قراءة البيانات المحفوظة", e); }
  return null;
}

function saveProjects() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error(e);
    showToast("تعذّر حفظ البيانات — مساحة التخزين المحلي ممتلئة");
  }
}

function initApp() {
  const loaded = loadProjects();
  projects = loaded && loaded.length ? loaded : SEED;
  if (!loaded) saveProjects();
  selectedId = projects[0]?.id || null;
  renderSidebar();
  renderMain();
}

function projectsCol() { /* kept for naming parity, not used with localStorage */ }

async function createProject(data) {
  const doc = {
    id: uid(),
    name: data.name, client: data.client, type: data.type,
    deadline: data.deadline, priority: data.priority, storage: data.storage,
    notes: "", stages: makeStages(), createdAt: Date.now(),
  };
  projects = [doc, ...projects];
  selectedId = doc.id;
  saveProjects();
  renderSidebar();
  renderMain();
}

async function patchProject(id, patch) {
  projects = projects.map(p => (p.id === id ? { ...p, ...patch } : p));
  saveProjects();
  renderSidebar();
  renderMain();
}

async function deleteProjectDoc(id) {
  projects = projects.filter(p => p.id !== id);
  if (selectedId === id) selectedId = projects[0]?.id || null;
  saveProjects();
  renderSidebar();
  renderMain();
}

// ---------- backup: export / import ----------
document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(projects, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `video-studio-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("تم تنزيل النسخة الاحتياطية");
});

document.getElementById("import-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("invalid format");
      if (projects.length && !confirm("عندك مشاريع محفوظة حاليًا. الاستيراد هيضيف المشاريع الجديدة فوقها. تكمل؟")) return;
      projects = [...data, ...projects];
      saveProjects();
      selectedId = projects[0]?.id || null;
      renderSidebar();
      renderMain();
      showToast("تم استيراد النسخة الاحتياطية بنجاح");
    } catch (err) {
      showToast("ملف غير صالح — تأكد إنه نسخة احتياطية صحيحة");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

// ============================================================
// RENDER: SIDEBAR
// ============================================================
const projectListEl = document.getElementById("project-list");

function getFiltered() {
  let list = projects;
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(p => (p.name||"").toLowerCase().includes(q) || (p.client||"").toLowerCase().includes(q));
  }
  if (filter === "active") list = list.filter(p => projectProgress(p) < 100);
  if (filter === "overdue") list = list.filter(p => { const d = daysUntil(p.deadline); return d !== null && d < 0; });
  if (filter === "done") list = list.filter(p => projectProgress(p) === 100);
  return [...list].sort((a, b) => {
    const da = daysUntil(a.deadline), db_ = daysUntil(b.deadline);
    if (da === null) return 1; if (db_ === null) return -1;
    return da - db_;
  });
}

function renderSidebar() {
  const list = getFiltered();
  if (!list.length) {
    projectListEl.innerHTML = `<div style="text-align:center;padding:30px 10px;color:var(--text-faint);font-size:12.5px;">لا توجد مشاريع مطابقة</div>`;
    return;
  }
  projectListEl.innerHTML = list.map(p => {
    const days = daysUntil(p.deadline);
    const color = urgencyColor(days);
    const pct = projectProgress(p);
    const daysLabel = days === null ? "—" : days < 0 ? `متأخر ${-days}ي` : `${days}ي`;
    return `
      <button class="project-row ${p.id === selectedId ? "active" : ""}" data-id="${p.id}">
        <div class="project-row-top">
          <span class="project-row-name">${escapeHtml(p.name)}</span>
          <span class="dot" style="background:${color}"></span>
        </div>
        <div class="project-row-meta">
          <span class="client">${escapeHtml(p.client) || "—"}</span>
          <span style="font-family:var(--mono);color:${color}">${daysLabel}</span>
        </div>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      </button>`;
  }).join("");

  projectListEl.querySelectorAll(".project-row").forEach(btn => {
    btn.addEventListener("click", () => { selectedId = btn.dataset.id; renderSidebar(); renderMain(); });
  });
}

document.getElementById("search-input").addEventListener("input", e => { search = e.target.value; renderSidebar(); });
document.querySelectorAll("#filter-row .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    filter = chip.dataset.filter;
    document.querySelectorAll("#filter-row .chip").forEach(c => c.classList.toggle("active", c === chip));
    renderSidebar();
  });
});

// ============================================================
// RENDER: MAIN
// ============================================================
const mainEl = document.getElementById("main-content");
const openStages = new Set();

function renderMain() {
  const p = projects.find(x => x.id === selectedId);
  if (!p) {
    mainEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🗂️</div><div>اختر مشروعًا من القائمة أو أنشئ مشروعًا جديدًا</div></div>`;
    return;
  }

  const total = projects.length;
  const active = projects.filter(x => projectProgress(x) < 100).length;
  const overdue = projects.filter(x => { const d = daysUntil(x.deadline); return d !== null && d < 0; }).length;
  const dueSoon = projects.filter(x => { const d = daysUntil(x.deadline); return d !== null && d >= 0 && d <= 3; }).length;

  const days = daysUntil(p.deadline);
  const color = urgencyColor(days);
  const pct = projectProgress(p);
  const span = days === null ? 14 : Math.max(Math.abs(days) + 2, 7);
  const clipEndPct = days === null ? 0 : Math.min(100, Math.max(0, ((span - Math.max(days,0)) / span) * 100));
  const tickCount = 15;
  const ticksHtml = Array.from({length: tickCount}).map((_,i) =>
    `<div style="height:${i % 4 === 0 ? 10 : 5}px;margin-top:${i % 4 === 0 ? 0 : 5}px"></div>`).join("");

  const daysLabel = days === null ? "لا يوجد موعد تسليم" : days < 0 ? `متأخر ${-days} يوم` : days === 0 ? "التسليم اليوم" : `${days} يوم متبقي`;
  const prio = PRIORITIES[p.priority] || PRIORITIES.medium;

  mainEl.innerHTML = `
    <div class="content-wrap">
      <div class="stats-row">
        <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">إجمالي المشاريع</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--teal)">${active}</div><div class="stat-label">نشطة</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${dueSoon}</div><div class="stat-label">قريبة الموعد</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${overdue}</div><div class="stat-label">متأخرة</div></div>
      </div>

      <div class="project-header">
        <div>
          <div class="project-title-row">
            <h1>${escapeHtml(p.name)}</h1>
            <span class="priority-chip" style="background:${prio.dim};color:${prio.color};border:1px solid ${prio.color}44">
              <span class="dot" style="background:${prio.color}"></span> ${prio.label}
            </span>
          </div>
          <div class="meta-row">
            <span class="meta-item">👤 ${escapeHtml(p.client) || "بدون عميل"}</span>
            <span class="meta-item">⭐ ${escapeHtml(p.type)}</span>
            ${p.storage ? `<span class="meta-item">💾 ${escapeHtml(p.storage)}</span>` : ""}
          </div>
        </div>
        <button class="delete-project-btn" id="delete-project-btn">🗑️ حذف المشروع</button>
      </div>

      <div class="ruler-box">
        <div class="ruler-top">
          <span class="ruler-days" style="color:${color}">⏱ ${daysLabel}</span>
          <span class="ruler-date">${fmtDate(p.deadline)}</span>
        </div>
        <div class="ruler-track">
          <div class="ruler-base"></div>
          <div class="ruler-fill" style="width:${clipEndPct}%;background:${color}"></div>
          <div class="ruler-ticks">${ticksHtml}</div>
        </div>
        <div class="ruler-progress-row">
          <span>تقدّم المشروع</span>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
          <span class="pct">${pct}%</span>
        </div>
      </div>

      <div class="section-head">
        <h2>مراحل الإنتاج</h2>
        <div id="add-stage-slot"></div>
      </div>
      <div class="stage-list" id="stage-list">
        ${(p.stages || []).length === 0 ? `<div class="empty-stages">لا توجد مراحل — أضف مرحلة جديدة للبدء</div>` : (p.stages || []).map((s, i) => renderStage(s, i === 0)).join("")}
      </div>

      <div class="section-head"><h2>ملاحظات</h2></div>
      <textarea class="notes-area" id="notes-area" placeholder="أضف ملاحظات عن المشروع، متطلبات العميل، مصادر الموسيقى...">${escapeHtml(p.notes || "")}</textarea>
    </div>
  `;

  renderAddStageForm(p.id);
  attachMainEvents(p);
}

function renderStage(stage, defaultOpen) {
  const total = (stage.tasks || []).length;
  const done = (stage.tasks || []).filter(t => t.done).length;
  const pctS = total ? Math.round((done/total)*100) : 0;
  const complete = total > 0 && done === total;
  const isOpen = openStages.has(stage.id) || (defaultOpen && !openStages.has("__closed_" + stage.id));
  const tasksHtml = (stage.tasks || []).length === 0
    ? `<div style="font-size:12.5px;color:var(--text-faint);padding:6px 40px;">لا توجد مهام بعد — أضف أول مهمة بالأسفل.</div>`
    : stage.tasks.map(t => `
      <div class="task-row">
        <button class="task-check" data-stage="${stage.id}" data-task="${t.id}" data-action="toggle-task">${t.done ? "✅" : "⚪"}</button>
        <span class="task-text ${t.done ? "done" : ""}">${escapeHtml(t.text)}</span>
        <button class="task-del" data-stage="${stage.id}" data-task="${t.id}" data-action="delete-task">✕</button>
      </div>`).join("");

  return `
    <div class="stage-track" data-stage-id="${stage.id}">
      <button class="stage-head" data-action="toggle-stage" data-stage="${stage.id}">
        <span>${isOpen ? "▾" : "◂"}</span>
        <span class="stage-icon ${complete ? "done" : ""}">${complete ? "✅" : stage.icon || "📌"}</span>
        <span class="stage-name">${escapeHtml(stage.name)}</span>
        <span class="stage-count">${done}/${total}</span>
        <span class="progress-bar stage-mini-progress"><div class="progress-bar-fill" style="width:${pctS}%;background:${complete ? "var(--teal)" : "var(--orange)"}"></div></span>
        <span class="task-del" data-action="delete-stage" data-stage="${stage.id}" title="حذف المرحلة">🗑️</span>
      </button>
      <div class="stage-body ${isOpen ? "open" : ""}">
        ${tasksHtml}
        <div class="task-add-row">
          <input type="text" placeholder="أضف مهمة جديدة..." data-stage="${stage.id}" class="new-task-input" />
          <button data-action="add-task" data-stage="${stage.id}">إضافة</button>
        </div>
      </div>
    </div>`;
}

function renderAddStageForm(projectId) {
  const slot = document.getElementById("add-stage-slot");
  slot.innerHTML = `<button class="add-stage-toggle" id="add-stage-toggle">＋ إضافة مرحلة</button>`;
  document.getElementById("add-stage-toggle").addEventListener("click", () => {
    slot.innerHTML = `
      <div class="add-stage-form">
        <input type="text" id="new-stage-input" placeholder="اسم المرحلة الجديدة..." />
        <button class="add-stage-btn-add" id="new-stage-submit">إضافة</button>
        <button class="icon-btn" id="new-stage-cancel">✕</button>
      </div>`;
    const input = document.getElementById("new-stage-input");
    input.focus();
    const submit = async () => {
      const v = input.value.trim();
      if (!v) return;
      const p = projects.find(x => x.id === projectId);
      const stages = [...(p.stages || []), { id: uid(), name: v, icon: "📌", tasks: [] }];
      await patchProject(projectId, { stages });
    };
    document.getElementById("new-stage-submit").addEventListener("click", submit);
    input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); if (e.key === "Escape") renderAddStageForm(projectId); });
    document.getElementById("new-stage-cancel").addEventListener("click", () => renderAddStageForm(projectId));
  });
}

function attachMainEvents(p) {
  document.getElementById("delete-project-btn").addEventListener("click", async () => {
    if (!confirm(`متأكد إنك عايز تحذف مشروع "${p.name}"؟`)) return;
    await deleteProjectDoc(p.id);
  });

  document.getElementById("notes-area").addEventListener("change", async (e) => {
    await patchProject(p.id, { notes: e.target.value });
  });

  const stageList = document.getElementById("stage-list");
  stageList.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const stageId = btn.dataset.stage;

    if (action === "toggle-stage") {
      if (openStages.has(stageId)) { openStages.delete(stageId); openStages.add("__closed_" + stageId); }
      else { openStages.add(stageId); openStages.delete("__closed_" + stageId); }
      renderMain();
      return;
    }
    if (action === "delete-stage") {
      const stages = p.stages.filter(s => s.id !== stageId);
      await patchProject(p.id, { stages });
      return;
    }
    if (action === "toggle-task") {
      const taskId = btn.dataset.task;
      const stages = p.stages.map(s => s.id === stageId
        ? { ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) } : s);
      await patchProject(p.id, { stages });
      return;
    }
    if (action === "delete-task") {
      const taskId = btn.dataset.task;
      const stages = p.stages.map(s => s.id === stageId
        ? { ...s, tasks: s.tasks.filter(t => t.id !== taskId) } : s);
      await patchProject(p.id, { stages });
      return;
    }
    if (action === "add-task") {
      const input = stageList.querySelector(`.new-task-input[data-stage="${stageId}"]`);
      const v = input.value.trim();
      if (!v) return;
      const stages = p.stages.map(s => s.id === stageId
        ? { ...s, tasks: [...s.tasks, { id: uid(), text: v, done: false }] } : s);
      await patchProject(p.id, { stages });
    }
  });

  stageList.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && e.target.classList.contains("new-task-input")) {
      const stageId = e.target.dataset.stage;
      const v = e.target.value.trim();
      if (!v) return;
      const stages = p.stages.map(s => s.id === stageId
        ? { ...s, tasks: [...s.tasks, { id: uid(), text: v, done: false }] } : s);
      await patchProject(p.id, { stages });
    }
  });
}

// ============================================================
// NEW PROJECT MODAL
// ============================================================
const modalOverlay = document.getElementById("modal-overlay");
const projectForm = document.getElementById("project-form");

document.getElementById("new-project-btn").addEventListener("click", () => { modalOverlay.hidden = false; });
document.getElementById("modal-close").addEventListener("click", () => { modalOverlay.hidden = true; });
document.getElementById("modal-cancel").addEventListener("click", () => { modalOverlay.hidden = true; });
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) modalOverlay.hidden = true; });

projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("p-name").value.trim();
  if (!name) return;
  await createProject({
    name,
    client: document.getElementById("p-client").value.trim(),
    type: document.getElementById("p-type").value,
    deadline: document.getElementById("p-deadline").value,
    priority: document.getElementById("p-priority").value,
    storage: document.getElementById("p-storage").value.trim(),
  });
  projectForm.reset();
  modalOverlay.hidden = true;
  showToast("تم إنشاء المشروع");
});

// ============================================================
// GO
// ============================================================
initApp();
