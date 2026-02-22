import { createClient } from "https://cdn.jsdelivr.net";

const SUPABASE_URL = "https://bisvmgjgyvludhqsvvcn.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY"; // 請替換回你的 Key
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLE_NAME = "overtime_entries";

let allEntries = [];
let isAdmin = false;
let sortDirection = { name: "asc", date: "asc" };

// --- Auth Functions ---
async function checkAdminSession() {
  try {
    const res = await fetch("/api/admin-auth");
    const json = await res.json();
    isAdmin = !!json.admin;
  } catch (err) { isAdmin = false; }
  updateUiForAdmin();
}

async function adminLogin(password) {
  const res = await fetch("/api/admin-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  if (res.ok) {
    isAdmin = true;
    updateUiForAdmin();
    closeAuthModal();
    await loadEntries();
  } else {
    alert("密碼錯誤");
  }
}

async function adminLogout() {
  await fetch("/api/admin-auth", { method: "DELETE" });
  isAdmin = false;
  updateUiForAdmin();
  await loadEntries();
}

// --- UI Helpers ---
function updateUiForAdmin() {
  document.getElementById("entryForm").style.display = isAdmin ? "flex" : "none";
  document.getElementById("authBtn").textContent = isAdmin ? "Logout" : "Admin Login";
  renderEntries(allEntries);
}

// --- Data & Rendering ---
async function loadEntries() {
  const { data, error } = await supabase.from(TABLE_NAME).select("*");
  if (!error) {
    allEntries = data || [];
    renderEntries(allEntries);
  }
}

function renderEntries(entries) {
  const tbody = document.getElementById("entries");
  tbody.innerHTML = entries.length ? "" : "<tr><td colspan='5'>無資料</td></tr>";
  
  entries.forEach(entry => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.id}</td>
      <td>${entry.name}</td>
      <td>${entry.date}</td>
      <td>${entry.notes || ""}</td>
      <td class="actions"></td>
    `;
    
    if (isAdmin) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "刪除";
      delBtn.onclick = async () => {
        if(confirm("確定刪除？")) {
            await supabase.from(TABLE_NAME).delete().eq("id", entry.id);
            await loadEntries();
        }
      };
      row.querySelector(".actions").appendChild(delBtn);
    } else {
      row.querySelector(".actions").textContent = "-";
    }
    tbody.appendChild(row);
  });
}

// --- Initialization ---
function init() {
  // Modal Events
  document.getElementById("authBtn").onclick = () => isAdmin ? adminLogout() : document.getElementById("authModal").classList.add("open");
  document.getElementById("closeModal").onclick = () => document.getElementById("authModal").classList.remove("open");
  document.getElementById("loginSubmit").onclick = () => adminLogin(document.getElementById("authPassword").value);
  
  // Search
  document.getElementById("search").oninput = (e) => {
    const q = e.target.value.toLowerCase();
    renderEntries(allEntries.filter(i => i.name.toLowerCase().includes(q) || i.date.includes(q)));
  };

  // Form
  document.getElementById("entryForm").onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
        id: parseInt(document.getElementById("id").value),
        name: document.getElementById("name").value,
        date: document.getElementById("date").value,
        notes: document.getElementById("notes").value
    };
    const { error } = await supabase.from(TABLE_NAME).insert([payload]);
    if (error) alert(error.message);
    else { e.target.reset(); await loadEntries(); }
  };

  checkAdminSession().then(() => loadEntries());
}

init();
