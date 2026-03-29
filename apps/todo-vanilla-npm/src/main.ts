import { AppBase, CollectionRef } from "@appbase-pfe/sdk";
import { z } from "zod";
import "./style.css";

const TodoSchema = z.object({
  title: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
  description: z.string().optional(),
});

type TodoData = z.infer<typeof TodoSchema>;

function requireEnv(key: keyof ImportMetaEnv): string {
  const v = import.meta.env[key];
  if (v == null || String(v).trim() === "") {
    throw new Error(`Missing env ${String(key)} — copy apps/todo-vanilla-npm/.env.example to .env`);
  }
  return String(v).trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const appRoot =
  document.getElementById("app") ??
  (() => {
    throw new Error("#app missing");
  })();

let app: AppBase;
let todosCollection: CollectionRef<TodoData>;

try {
  app = AppBase.init({
    endpoint: requireEnv("VITE_APPBASE_ENDPOINT"),
    apiKey: requireEnv("VITE_APPBASE_API_KEY"),
    sessionStorageKey: "appbase_vanilla_npm_todo_session",
    dbCache: true,
  });
  todosCollection = app.db.collection<TodoData>("todos", TodoSchema);
} catch (e) {
  appRoot.innerHTML = `<div class="card err">${escapeHtml(e instanceof Error ? e.message : String(e))}</div>`;
  throw e;
}

function renderLogin(msg?: string): void {
  const state = app.auth.getAuthState();
  appRoot.innerHTML = `
    <span class="badge">@appbase-pfe/sdk (^0.1.0)</span>
    <h1>Sign in</h1>
    <p class="muted">Pure TypeScript + Vite. API must allow this origin (CORS). Depends on <code>@appbase-pfe/sdk@^0.1.0</code> like external apps.</p>
    ${msg ? `<p class="err">${escapeHtml(msg)}</p>` : ""}
    <div class="card">
      <form id="form-login">
        <label>Email</label>
        <input type="email" name="email" required autocomplete="username" />
        <label>Password</label>
        <input type="password" name="password" required autocomplete="current-password" />
        <button type="submit">Sign in</button>
      </form>
      <hr style="border:none;border-top:1px solid #eee;margin:1rem 0" />
      <p class="muted" style="margin:0 0 0.5rem">No account?</p>
      <form id="form-register">
        <label>Email</label>
        <input type="email" name="email" required />
        <label>Password</label>
        <input type="password" name="password" required minlength="8" />
        <button type="submit" class="secondary">Create account</button>
      </form>
    </div>
  `;

  document.querySelector("#form-login")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target as HTMLFormElement);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    try {
      await app.auth.signIn({ email, password });
      await refreshTodosUi();
    } catch (err) {
      renderLogin(err instanceof Error ? err.message : String(err));
    }
  });

  document.querySelector("#form-register")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target as HTMLFormElement);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    try {
      await app.auth.signUp({ email, password });
      await app.auth.signIn({ email, password });
      await refreshTodosUi();
    } catch (err) {
      renderLogin(err instanceof Error ? err.message : String(err));
    }
  });

  if (state.authenticated) {
    void refreshTodosUi();
  }
}

async function refreshTodosUi(errMsg?: string): Promise<void> {
  await app.auth.ready();
  const { authenticated, user } = app.auth.getAuthState();
  if (!authenticated || !user) {
    renderLogin(errMsg);
    return;
  }

  let listHtml = "";
  let loadError = errMsg ?? "";

  try {
    const { items } = await todosCollection.list({ limit: 50 });
    listHtml = items
      .map(
        (row) => `
      <li data-id="${escapeHtml(row.id)}" class="${row.data.done ? "done" : ""}">
        <input type="checkbox" ${row.data.done ? "checked" : ""} data-toggle />
        <span class="title">${escapeHtml(row.data.title)}</span>
        <button type="button" class="secondary" data-delete>Delete</button>
      </li>`,
      )
      .join("");
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  appRoot.innerHTML = `
    <span class="badge">@appbase-pfe/sdk (^0.1.0)</span>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
      <h1 style="margin:0">Todos</h1>
      <div>
        <span class="muted">${escapeHtml(user.email)}</span>
        <button type="button" id="btn-out" class="secondary" style="margin-left:0.5rem">Sign out</button>
      </div>
    </div>
    ${loadError ? `<p class="err">${escapeHtml(loadError)}</p>` : ""}
    <div class="card">
      <form id="form-add">
        <label>New todo</label>
        <input type="text" name="title" placeholder="Title" required />
        <button type="submit">Add</button>
      </form>
    </div>
    <div class="card">
      <ul class="todos">${listHtml || '<li class="muted">No todos yet</li>'}</ul>
    </div>
  `;

  document.querySelector("#btn-out")?.addEventListener("click", async () => {
    await app.auth.signOut();
    renderLogin();
  });

  document.querySelector("#form-add")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target as HTMLFormElement);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return;
    const btn = (ev.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    try {
      await todosCollection.create({
        title,
        done: false,
        createdAt: new Date().toISOString(),
      });
      (ev.target as HTMLFormElement).reset();
      await refreshTodosUi();
    } catch (e) {
      await refreshTodosUi(e instanceof Error ? e.message : String(e));
    } finally {
      btn.disabled = false;
    }
  });

  appRoot.querySelectorAll("ul.todos li[data-id]").forEach((li) => {
    const id = li.getAttribute("data-id");
    if (!id) return;

    li.querySelector("[data-toggle]")?.addEventListener("change", async (ev) => {
      const checked = (ev.target as HTMLInputElement).checked;
      const toggleBtn = li.querySelector("[data-toggle]") as HTMLInputElement;
      toggleBtn.disabled = true;
      try {
        await todosCollection.update(id, { done: checked });
        await refreshTodosUi();
      } catch (e) {
        await refreshTodosUi(e instanceof Error ? e.message : String(e));
      }
    });

    li.querySelector("[data-delete]")?.addEventListener("click", async () => {
      try {
        await todosCollection.delete(id);
        await refreshTodosUi();
      } catch (e) {
        await refreshTodosUi(e instanceof Error ? e.message : String(e));
      }
    });
  });
}

void app.auth.ready().then(() => {
  const { authenticated } = app.auth.getAuthState();
  if (authenticated) {
    void refreshTodosUi();
  } else {
    renderLogin();
  }
});
