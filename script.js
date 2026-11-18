
const DB_NAME = "ChatVersoDB";
const DB_VERSION = 1;

let db;
let ideas = [];
let projects = [];
let toastTimer;

const $ = id => document.getElementById(id);

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

// BANCO DE DADOS LOCAL

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB não está disponível."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains("ideas")) {
        database.createObjectStore("ideas", { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains("projects")) {
        database.createObjectStore("projects", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly")
      .objectStore(storeName).getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveItem(storeName, item) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(item);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function deleteItem(storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function loadData() {
  [ideas, projects] = await Promise.all([
    getAll("ideas"),
    getAll("projects")
  ]);

  ideas.sort((a, b) => b.updatedAt - a.updatedAt);
  projects.sort((a, b) => b.updatedAt - a.updatedAt);

  renderAll();
}

// AVISOS

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// NAVEGAÇÃO

function navigate(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// FORMULÁRIO DE IDEIAS

function openIdeaForm(id = null) {
  $("ideaForm").reset();
  $("ideaId").value = "";
  $("ideaDialogTitle").textContent = "Nova ideia";

  updateProjectOptions();

  if (id) {
    const idea = ideas.find(item => item.id === id);
    if (!idea) return;

    $("ideaId").value = idea.id;
    $("ideaTitle").value = idea.title;
    $("ideaDescription").value = idea.description;
    $("ideaCategory").value = idea.category;
    $("ideaProject").value = idea.projectId || "";
    $("ideaDialogTitle").textContent = "Editar ideia";
  }

  $("ideaDialog").showModal();
  $("ideaTitle").focus();
}

function updateProjectOptions() {
  const select = $("ideaProject");
  const previousValue = select.value;

  select.innerHTML = '<option value="">Nenhum projeto</option>';

  projects.forEach(project => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    select.appendChild(option);
  });

  if (projects.some(project => project.id === previousValue)) {
    select.value = previousValue;
  }
}

$("ideaForm").addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("ideaId").value || crypto.randomUUID();
  const oldIdea = ideas.find(item => item.id === id);
  const now = Date.now();

  const idea = {
    id,
    title: $("ideaTitle").value.trim(),
    description: $("ideaDescription").value.trim(),
    category: $("ideaCategory").value,
    projectId: $("ideaProject").value,
    createdAt: oldIdea?.createdAt || now,
    updatedAt: now
  };

  if (!idea.title) {
    showToast("Digite um nome para sua ideia.");
    return;
  }

  try {
    await saveItem("ideas", idea);
    $("ideaDialog").close();
    await loadData();
    showToast(oldIdea ? "Ideia atualizada!" : "Ideia salva!");
  } catch {
    showToast("Não foi possível salvar a ideia.");
  }
});

// EXCLUSÃO E EDIÇÃO DE IDEIAS

async function removeIdea(id) {
  if (!confirm("Deseja realmente excluir esta ideia?")) return;

  try {
    await deleteItem("ideas", id);
    await loadData();
    showToast("Ideia excluída.");
  } catch {
    showToast("Não foi possível excluir.");
  }
}

// FORMULÁRIO DE PROJETOS

function openProjectForm(id = null) {
  $("projectForm").reset();
  $("projectId").value = "";
  $("projectDialogTitle").textContent = "Novo projeto";

  if (id) {
    const project = projects.find(item => item.id === id);
    if (!project) return;

    $("projectId").value = project.id;
    $("projectName").value = project.name;
    $("projectDescription").value = project.description;
    $("projectStatus").value = project.status;
    $("projectDialogTitle").textContent = "Editar projeto";
  }

  $("projectDialog").showModal();
  $("projectName").focus();
}

$("projectForm").addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("projectId").value || crypto.randomUUID();
  const oldProject = projects.find(item => item.id === id);
  const now = Date.now();

  const project = {
    id,
    name: $("projectName").value.trim(),
    description: $("projectDescription").value.trim(),
    status: $("projectStatus").value,
    createdAt: oldProject?.createdAt || now,
    updatedAt: now
  };

  if (!project.name) {
    showToast("Digite um nome para o projeto.");
    return;
  }

  try {
    await saveItem("projects", project);
    $("projectDialog").close();
    await loadData();
    showToast(oldProject ? "Projeto atualizado!" : "Projeto criado!");
  } catch {
    showToast("Não foi possível salvar o projeto.");
  }
});

async function removeProject(id) {
  if (!confirm("Excluir este projeto? As ideias relacionadas serão mantidas sem projeto.")) {
    return;
  }

  try {
    await deleteItem("projects", id);

    const relatedIdeas = ideas.filter(idea => idea.projectId === id);

    await Promise.all(relatedIdeas.map(idea =>
      saveItem("ideas", { ...idea, projectId: "", updatedAt: Date.now() })
    ));

    await loadData();
    showToast("Projeto excluído.");
  } catch {
    showToast("Não foi possível excluir o projeto.");
  }
}

// EXIBIÇÃO DAS IDEIAS

function renderIdeaCard(idea) {
  const project = projects.find(p => p.id === idea.projectId);

  return `
    <article class="idea-card">
      <div class="card-top">
        <div class="card-title">${escapeHTML(idea.title)}</div>
      </div>

      <p class="card-description">${escapeHTML(idea.description || "Sem descrição.")}</p>

      <span class="tag">${escapeHTML(idea.category)}</span>
      ${project ? `<span class="tag">${escapeHTML(project.name)}</span>` : ""}

      <div class="card-actions">
        <button class="small-btn" data-action="edit-idea" data-id="${escapeHTML(idea.id)}">Editar</button>
        <button class="small-btn delete" data-action="delete-idea" data-id="${escapeHTML(idea.id)}">Excluir</button>
      </div>
    </article>
  `;
}

function renderIdeas() {
  const query = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;

  const filtered = ideas.filter(idea => {
    const matchesText =
      idea.title.toLowerCase().includes(query) ||
      idea.description.toLowerCase().includes(query);

    const matchesCategory = !category || idea.category === category;

    return matchesText && matchesCategory;
  });

  $("allIdeas").innerHTML = filtered.length
    ? filtered.map(renderIdeaCard).join("")
    : `<div class="empty-state">Nenhuma ideia encontrada.<br>Experimente adicionar uma nova!</div>`;

  const recent = ideas.slice(0, 3);

  $("recentIdeas").innerHTML = recent.length
    ? recent.map(renderIdeaCard).join("")
    : `<div class="empty-state">Seu universo ainda está vazio.<br>Comece guardando uma ideia!</div>`;
}

// EXIBIÇÃO DOS PROJETOS

function renderProjects() {
  $("allProjects").innerHTML = projects.length
    ? projects.map(project => {
      const count = ideas.filter(idea => idea.projectId === project.id).length;

      return `
        <article class="project-card">
          <div class="card-title">${escapeHTML(project.name)}</div>
          <p class="card-description">${escapeHTML(project.description || "Sem descrição.")}</p>
          <span class="tag">${escapeHTML(project.status)}</span>
          <span class="tag">${count} ideia(s)</span>

          <div class="card-actions">
            <button class="small-btn" data-action="edit-project" data-id="${escapeHTML(project.id)}">Editar</button>
            <button class="small-btn delete" data-action="delete-project" data-id="${escapeHTML(project.id)}">Excluir</button>
          </div>
        </article>
      `;
    }).join("")
    : `<div class="empty-state">Você ainda não criou projetos.<br>Que tal começar um?</div>`;
}

// ATUALIZAÇÃO GERAL

function renderAll() {
  $("ideaCount").textContent = ideas.length;
  $("projectCount").textContent = projects.length;

  renderIdeas();
  renderProjects();
  updateProjectOptions();
}

// CLIQUES DOS BOTÕES

document.addEventListener("click", async event => {
  const pageButton = event.target.closest("[data-page]");

  if (pageButton) {
    navigate(pageButton.dataset.page);
    return;
  }

  const closeButton = event.target.closest("[data-close]");

  if (closeButton) {
    $(closeButton.dataset.close).close();
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  switch (action) {
    case "new-idea":
      openIdeaForm();
      break;
    case "edit-idea":
      openIdeaForm(id);
      break;
    case "delete-idea":
      await removeIdea(id);
      break;
    case "new-project":
      openProjectForm();
      break;
    case "edit-project":
      openProjectForm(id);
      break;
    case "delete-project":
      await removeProject(id);
      break;
  }
});

// PESQUISA E FILTROS

$("searchInput").addEventListener("input", renderIdeas);
$("categoryFilter").addEventListener("change", renderIdeas);

// BACKUP

function downloadBackup() {
  const backup = {
    app: "ChatVerso",
    version: 1,
    exportedAt: new Date().toISOString(),
    ideas,
    projects
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `ChatVerso-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Backup exportado!");
}

$("backupButton").addEventListener("click", downloadBackup);
$("exportButton").addEventListener("click", downloadBackup);

$("importButton").addEventListener("click", () => {
  $("importFile").click();
});

$("importFile").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);

      const validIdea = item =>
        item && typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.description === "string" &&
        typeof item.category === "string";

      const validProject = item =>
        item && typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.description === "string" &&
        typeof item.status === "string";

      if (
        data.app !== "ChatVerso" ||
        data.version !== 1 ||
        !Array.isArray(data.ideas) ||
        !Array.isArray(data.projects) ||
        !data.ideas.every(validIdea) ||
        !data.projects.every(validProject) ||
        data.ideas.length > 10000 ||
        data.projects.length > 10000
      ) {
        throw new Error("Arquivo de backup inválido.");
      }

      if (!confirm("Restaurar este backup? Os dados atuais serão substituídos.")) {
        return;
      }

      const transaction = db.transaction(
        ["ideas", "projects"],
        "readwrite"
      );

      const ideaStore = transaction.objectStore("ideas");
      const projectStore = transaction.objectStore("projects");

      ideaStore.clear();
      projectStore.clear();

      data.ideas.forEach(item => ideaStore.put(item));
      data.projects.forEach(item => projectStore.put(item));

      transaction.oncomplete = async () => {
        await loadData();
        showToast("Backup restaurado!");
        $("importFile").value = "";
      };

      transaction.onerror = () => showToast("Erro ao restaurar backup.");

    } catch {
      showToast("Arquivo inválido ou incompatível.");
      $("importFile").value = "";
    }
  };

  reader.readAsText(file);
});

// INICIALIZAÇÃO

async function initialize() {
  try {
    db = await openDatabase();
    await loadData();
  } catch (error) {
    console.error(error);
    showToast("Erro ao abrir o armazenamento local.");
  }
}

initialize();

// INSTALAÇÃO PWA

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.error("Erro no modo offline:", error));
  });
}
