// app.js (client-side)
// Expects a password-only admin flow. The login modal should include an input with id="authPassword"
// and buttons with ids: authBtn, loginSubmit, closeModal, and a modal container id="authModal".
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your values.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allEntries = [];
let isAdmin = false;
let sortDirection = { name: "asc", date: "asc" };

// ---------- Admin session functions ----------
async function checkAdminSession() {
  try {
    const res = await fetch("/api/admin-auth", { method: "GET", credentials: "same-origin" });
    if (!res.ok) {
      isAdmin = false;
    } else {
      const json = await res.json();
      isAdmin = !!json.admin;
    }
  } catch (err) {
    console.error("checkAdminSession error:", err);
    isAdmin = false;
  }
  updateUiForAdmin();
}

async function adminLogin(password) {
  try {
    const res = await fetch("/api/admin-auth", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Login failed");
      return false;
    }
    isAdmin = true;
    updateUiForAdmin();
    closeAuthModal();
    await loadEntries();
    return true;
  } catch (err) {
    console.error("adminLogin error:", err);
    alert("Login failed (network error).");
    return false;
  }
}

async function adminLogout() {
  try {
    const res = await fetch("/api/admin-auth", { method: "DELETE", credentials: "same-origin" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      console.error("Logout failed:", json);
      alert("Logout failed.");
      return;
    }
  } catch (err) {
    console.error("adminLogout error:", err);
  }
  isAdmin = false;
  updateUiForAdmin();
  await loadEntries();
}

// ---------- UI helpers ----------
function updateUiForAdmin() {
  const form = document.getElementById("entryForm");
  const authBtn = document.getElementById("authBtn");
  if (!form || !authBtn) return;

  if (!isAdmin) {
    form.style.display = "none";
    authBtn.textContent = "Admin Login";
  } else {
    form.style.display = "flex";
    authBtn.textContent = "Logout";
  }
  renderEntries(allEntries);
}

// ---------- Auth modal wiring ----------
const authBtn = document.getElementById("authBtn");
const authModal = document.getElementById("authModal");
const closeModal = document.getElementById("closeModal");
const loginSubmit = document.getElementById("loginSubmit");
const authPassword = document.getElementById("authPassword");

function openAuthModal() {
  if (!authModal) return;
  authModal.classList.add("open");
  if (authPassword) authPassword.value = "";
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.classList.remove("open");
}

if (authBtn) {
  authBtn.addEventListener("click", async () => {
    if (!isAdmin) openAuthModal();
    else await adminLogout();
  });
}
if (closeModal) closeModal.addEventListener("click", closeAuthModal);
if (authModal) authModal.addEventListener("click", (e) => { if (e.target === authModal) closeAuthModal(); });

if (loginSubmit) {
  loginSubmit.addEventListener("click", async (e) => {
    e.preventDefault();
    const pwd = authPassword?.value ?? "";
    if (!pwd) {
      alert("Enter admin password.");
      return;
    }
    await adminLogin(pwd);
  });
}

// ---------- Data loading ----------
async function loadEntries() {
  try {
    const { data, error } = await supabase.from("overtime_entries").select("*");
    if (error) {
      console.error("Error loading entries:", error);
      allEntries = [];
      renderEntries(allEntries);
      return;
    }
    allEntries = data || [];
    renderEntries(allEntries);
  } catch (err) {
    console.error("Unexpected error loading entries:", err);
    allEntries = [];
    renderEntries(allEntries);
  }
}

// ---------- Rendering ----------
function renderEntries(entries) {
  const tbody = document.getElementById("entries");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!entries || entries.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No entries found.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  entries.forEach(entry => {
    const row = document.createElement("tr");

    const idCell = document.createElement("td");
    idCell.textContent = entry.id ?? "(no id)";

    const nameCell = document.createElement("td");
    nameCell.textContent = entry.name ?? "(no name)";

    const dateCell = document.createElement("td");
    dateCell.textContent = entry.date ?? "(no date)";

    const notesCell = document.createElement("td");
    notesCell.textContent = entry.notes ?? "";

    const actionCell = document.createElement("td");

    if (isAdmin) {
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "delete-btn";
      deleteBtn.addEventListener("click", async () => {
        if (!confirm(`Delete entry ID ${entry.id}?`)) return;
        const { error } = await supabase.from("overtime_entries").delete().eq("id", entry.id);
        if (error) {
          console.error("Delete error:", error);
          alert("Failed to delete entry: " + (error.message || ""));
        } else {
          await loadEntries();
        }
      });
      actionCell.appendChild(deleteBtn);

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.style.marginLeft = "8px";
      editBtn.addEventListener("click", () => openEditDialog(entry));
      actionCell.appendChild(editBtn);
    } else {
      actionCell.textContent = "-";
    }

    row.appendChild(idCell);
    row.appendChild(nameCell);
    row.appendChild(dateCell);
    row.appendChild(notesCell);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  });
}

// ---------- Inline edit ----------
async function openEditDialog(entry) {
  const newName = window.prompt("Edit name:", entry.name ?? "");
  if (newName === null) return;
  const newDate = window.prompt("Edit date (YYYY-MM-DD):", entry.date ?? "");
  if (newDate === null) return;
  const newNotes = window.prompt("Edit notes:", entry.notes ?? "");
  if (newNotes === null) return;

  const { error } = await supabase.from("overtime_entries").update({ name: newName, date: newDate, notes: newNotes }).eq("id", entry.id);
  if (error) {
    console.error("Update error:", error);
    alert("Failed to update entry: " + (error.message || ""));
  } else {
    await loadEntries();
  }
}

// ---------- Form submission ----------
function setupForm() {
  const form = document.getElementById("entryForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      alert("You must be logged in as admin to add entries.");
      return;
    }

    const id = document.getElementById("id").value;
    const name = document.getElementById("name").value;
    const date = document.getElementById("date").value;
    const notes = document.getElementById("notes").value;

    if (!id || !name || !date) {
      alert("Please fill ID, Name, and Date.");
      return;
    }

    const { error } = await supabase.from("overtime_entries").insert([{ id: parseInt(id, 10), name, date, notes }]);
    if (error) {
      console.error("Insert error:", error);
      alert("Failed to add entry: " + (error.message || ""));
    } else {
      form.reset();
      await loadEntries();
    }
  });
}

// ---------- Search ----------
function setupSearch() {
  const searchInput = document.getElementById("search");
  if (!searchInput) return;
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase();
    const filtered = allEntries.filter(entry =>
      (entry.name?.toLowerCase().includes(q)) ||
      (entry.date?.toLowerCase().includes(q)) ||
      (entry.notes?.toLowerCase().includes(q))
    );
    renderEntries(filtered);
  });
}

// ---------- Sorting ----------
function setupSorting() {
  const nameHeader = document.getElementById("sortName");
  const dateHeader = document.getElementById("sortDate");

  if (nameHeader) {
    nameHeader.addEventListener("click", () => {
      sortDirection.name = sortDirection.name === "asc" ? "desc" : "asc";
      const sorted = [...allEntries].sort((a, b) => {
        const aName = (a.name ?? "").toString();
        const bName = (b.name ?? "").toString();
        return sortDirection.name === "asc"
          ? aName.localeCompare(bName, undefined, { sensitivity: "base" })
          : bName.localeCompare(aName, undefined, { sensitivity: "base" });
      });
      updateSortIndicators();
      renderEntries(sorted);
    });
  }

  if (dateHeader) {
    dateHeader.addEventListener("click", () => {
      sortDirection.date = sortDirection.date === "asc" ? "desc" : "asc";
      const sorted = [...allEntries].sort((a, b) => {
        const aDate = a.date ? new Date(a.date) : new Date(0);
        const bDate = b.date ? new Date(b.date) : new Date(0);
        return sortDirection.date === "asc" ? aDate - bDate : bDate - aDate;
      });
      updateSortIndicators();
      renderEntries(sorted);
    });
  }
}

function updateSortIndicators() {
  const nameHeader = document.getElementById("sortName");
  const dateHeader = document.getElementById("sortDate");
  if (nameHeader) nameHeader.textContent = `Name ${sortDirection.name === "asc" ? "▲" : "▼"}`;
  if (dateHeader) dateHeader.textContent = `Date ${sortDirection.date === "asc" ? "▲" : "▼"}`;
}

// ---------- Realtime ----------
function setupRealtime() {
  supabase
    .channel("overtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "overtime_entries" }, (payload) => {
      console.log("Realtime change:", payload);
      loadEntries();
    })
    .subscribe();
}

// ---------- Init ----------
async function init() {
  setupForm();
  setupSearch();
  setupSorting();
  updateSortIndicators();
  await checkAdminSession();
  setupRealtime();
  await loadEntries();
}

init();