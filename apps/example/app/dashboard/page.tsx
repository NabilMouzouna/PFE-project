"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useAppBase, useAuth, useRequireAuth } from "@/lib/appbase";
import type { DbRecord } from "@appbase/sdk";

const TodoSchema = z.object({
  title: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
});

type TodoData = z.infer<typeof TodoSchema>;
type Todo = DbRecord<TodoData>;

export default function DashboardPage() {
  const router = useRouter();
  const appBase = useAppBase();
  const { signOut } = useAuth();
  const { authState, authenticated, user } = useRequireAuth("/sign-in", router);
  const todosCollection = useMemo(
    () => appBase.db.collection<TodoData>("todos", TodoSchema),
    [appBase],
  );

  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");

  const loadTodos = useCallback(async () => {
    setError(null);
    try {
      const res = await todosCollection.list({
        filter: filter === "all" ? undefined : { done: filter === "done" },
        limit: 100,
      });
      setTodos(res.items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load todos";
      setError(msg);
    }
  }, [todosCollection, filter]);

  useEffect(() => {
    if (authState === null || !authenticated) return;
    void loadTodos();
  }, [authState, authenticated, loadTodos]);

  useEffect(() => {
    if (authState === null || !authenticated) return;
    const unsub = todosCollection.subscribe(() => {
      void loadTodos();
    });
    return unsub;
  }, [authState, authenticated, todosCollection, loadTodos]);

  const createTodo = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await todosCollection.create({
        title: title.trim(),
        done: false,
        createdAt: new Date().toISOString(),
      });
      setTitle("");
      await loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create todo");
    } finally {
      setBusy(false);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    setBusy(true);
    setError(null);
    try {
      await todosCollection.update(todo.id, { done: !todo.data.done });
      await loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update todo");
    } finally {
      setBusy(false);
    }
  };

  const removeTodo = async (todoId: string) => {
    setBusy(true);
    setError(null);
    try {
      await todosCollection.delete(todoId);
      await loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete todo");
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      router.push("/sign-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
    } finally {
      setBusy(false);
    }
  };

  if (authState === null) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <p className="text-sm opacity-75">Restoring session...</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <p className="text-sm opacity-75">Redirecting to sign in...</p>
      </main>
    );
  }

  const userEmail = user?.email ?? "user";

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="grain pointer-events-none absolute inset-0 -z-10" />

      <header className="app-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] opacity-60">Protected</p>
            <h1 className="mt-1 text-4xl font-extrabold">Todo Dashboard</h1>
            <p className="mt-2 text-sm opacity-75">Signed in as {userEmail}</p>
          </div>
          <div className="flex gap-2">
            <Link className="rounded-lg border-2 border-var(--line) px-3 py-2 text-sm" href="/">
              Home
            </Link>
            <button
              disabled={busy}
              className="rounded-lg border-2 border-var(--line) bg-var(--accent) px-3 py-2 text-sm text-[#fffaf0] disabled:opacity-60"
              onClick={onSignOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="app-card p-6">
        <h2 className="text-lg font-semibold">Add todo</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            className="app-input flex-1"
            placeholder="Write your next task..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            disabled={busy}
            className="app-button rounded-lg px-4 py-2 disabled:opacity-60"
            onClick={createTodo}
          >
            Add
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      </section>

      <section className="app-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your todos</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-75">Show:</span>
            {(["all", "open", "done"] as const).map((f) => (
              <button
                key={f}
                className={`rounded-lg border-2 px-3 py-2 text-sm capitalize ${
                  filter === f ? "border-var(--accent) bg-var(--accent) text-[#fffaf0]" : "border-var(--line)"
                }`}
                onClick={() => setFilter(f)}
                disabled={busy}
              >
                {f}
              </button>
            ))}
            <button className="rounded-lg border-2 border-var(--line) px-3 py-2 text-sm" onClick={() => void loadTodos()} disabled={busy}>
              Refresh
            </button>
          </div>
        </div>

        {todos.length === 0 ? (
          <p className="rounded-lg border-2 border-dashed border-var(--line) p-6 text-center text-sm opacity-75">
            No todos yet. Add one above to get started.
          </p>
        ) : (
          <ul className="grid gap-3">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <button
                  className={`text-left ${todo.data.done ? "line-through opacity-60" : ""} transition hover:translate-x-0.5`}
                  onClick={() => toggleTodo(todo)}
                  disabled={busy}
                >
                  <div className="font-medium">{todo.data.title}</div>
                  <div className="text-xs opacity-65">
                    {new Date(todo.data.createdAt).toLocaleString()} | {todo.data.done ? "Done" : "Open"}
                  </div>
                </button>
                <button
                  className="rounded-lg border-2 border-var(--line) bg-var(--panel) px-3 py-1 text-sm"
                  onClick={() => removeTodo(todo.id)}
                  disabled={busy}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

