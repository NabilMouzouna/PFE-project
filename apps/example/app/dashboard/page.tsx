"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useAppBase, useAuth, useRequireAuth } from "@/lib/appbase";
import type { DbRecord } from "@appbase/sdk";
import { Button, Input, Textarea, Modal, Badge, CardHeader } from "@/components/ui";

const TodoSchema = z.object({
  title: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
  description: z.string().optional(),
  updatedAt: z.string().optional(),
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
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");

  // Per-action loading for production UX
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyToggleId, setBusyToggleId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [busySignOut, setBusySignOut] = useState(false);

  // Edit modal state
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [busyEdit, setBusyEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadTodos = useCallback(async () => {
    setError(null);
    try {
      const res = await todosCollection.list({
        filter: filter === "all" ? undefined : { done: filter === "done" },
      });
      setTodos(res.items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load todos";
      setError(msg);
    }
  }, [todosCollection, filter]);

  useEffect(() => {
    if (authState === null || !authenticated) return;
    setTodos([]);
    void loadTodos();
  }, [authState, authenticated, loadTodos, user?.id]);

  const createTodo = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setBusyCreate(true);
    setError(null);
    try {
      const created = await todosCollection.create({
        title: title.trim(),
        done: false,
        createdAt: new Date().toISOString(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setTitle("");
      setDescription("");
      setTodos((prev) => (prev.some((t) => t.id === created.id) ? prev : [...prev, created]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create todo");
    } finally {
      setBusyCreate(false);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    setBusyToggleId(todo.id);
    setError(null);
    const nextDone = !todo.data.done;
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, data: { ...t.data, done: nextDone } } : t)),
    );
    try {
      const updated = await todosCollection.update(todo.id, { done: nextDone });
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, data: { ...t.data, done: todo.data.done } } : t)),
      );
      setError(err instanceof Error ? err.message : "Failed to update todo");
    } finally {
      setBusyToggleId(null);
    }
  };

  const removeTodo = async (todoId: string) => {
    const removed = todos.find((t) => t.id === todoId);
    setBusyDeleteId(todoId);
    setError(null);
    setTodos((prev) => prev.filter((t) => t.id !== todoId));
    try {
      await todosCollection.delete(todoId);
    } catch (err) {
      if (removed) setTodos((prev) => [...prev, removed].sort((a, b) => a.data.createdAt.localeCompare(b.data.createdAt)));
      setError(err instanceof Error ? err.message : "Failed to delete todo");
    } finally {
      setBusyDeleteId(null);
    }
  };

  const openEditModal = (todo: Todo) => {
    setEditingTodo(todo);
    setEditTitle(todo.data.title);
    setEditDescription(todo.data.description ?? "");
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingTodo(null);
    setEditTitle("");
    setEditDescription("");
    setEditError(null);
    setBusyEdit(false);
  };

  const saveEdit = async () => {
    if (!editingTodo) return;
    if (!editTitle.trim()) {
      setEditError("Title is required");
      return;
    }
    setBusyEdit(true);
    setEditError(null);
    try {
      const updated = await todosCollection.update(editingTodo.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      closeEditModal();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update todo");
    } finally {
      setBusyEdit(false);
    }
  };

  const onSignOut = async () => {
    setBusySignOut(true);
    setError(null);
    try {
      await signOut();
      router.push("/sign-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
    } finally {
      setBusySignOut(false);
    }
  };

  const hasBusyItem = busyToggleId ?? busyDeleteId;

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
            <Link
              className="rounded-lg border-2 border-var(--line) px-3 py-2 text-sm transition-colors hover:bg-var(--panel) focus:outline-none focus:ring-2 focus:ring-var(--accent)"
              href="/"
            >
              Home
            </Link>
            <Button variant="primary" disabled={busySignOut} loading={busySignOut} onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <section className="app-card p-6">
        <CardHeader title="Add todo" />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 flex-col gap-2">
            <Input
              placeholder="Write your next task..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTodo()}
              disabled={busyCreate}
            />
            <Input
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTodo()}
              disabled={busyCreate}
            />
          </div>
          <Button variant="primary" disabled={busyCreate} loading={busyCreate} onClick={createTodo}>
            Add
          </Button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="app-card p-6">
        <CardHeader
          title="Your todos"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm opacity-75">Show:</span>
              {(["all", "open", "done"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setFilter(f)}
                  disabled={!!hasBusyItem}
                >
                  {f}
                </Button>
              ))}
              <Button variant="secondary" size="sm" onClick={() => void loadTodos()} disabled={!!hasBusyItem}>
                Refresh
              </Button>
            </div>
          }
        />

        {todos.length === 0 ? (
          <p className="rounded-lg border-2 border-dashed border-var(--line) p-6 text-center text-sm opacity-75">
            No todos yet. Add one above to get started.
          </p>
        ) : (
          <ul className="grid gap-3">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-var(--line) bg-var(--paper) p-4 transition-colors hover:border-var(--accent)/50"
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className={`cursor-pointer text-left transition hover:translate-x-0.5 focus:outline-none focus:ring-2 focus:ring-var(--accent) focus:ring-offset-2 ${
                      todo.data.done ? "line-through opacity-60" : ""
                    }`}
                    onClick={() => toggleTodo(todo)}
                    disabled={!!hasBusyItem || busyToggleId === todo.id}
                  >
                    <div className="font-medium">{todo.data.title}</div>
                    {todo.data.description && (
                      <div className="mt-1 text-sm text-var(--foreground)/75">{todo.data.description}</div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs opacity-65">
                        {new Date(todo.data.createdAt).toLocaleString()}
                      </span>
                      <Badge variant={todo.data.done ? "done" : "open"}>
                        {todo.data.done ? "Done" : "Open"}
                      </Badge>
                    </div>
                  </button>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditModal(todo)}
                    disabled={!!hasBusyItem}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => removeTodo(todo.id)}
                    disabled={!!hasBusyItem}
                    loading={busyDeleteId === todo.id}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        isOpen={!!editingTodo}
        onClose={closeEditModal}
        title="Edit todo"
      >
        {editingTodo && (
          <div className="space-y-4">
            <Input
              label="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Todo title"
              error={editError && !editTitle.trim() ? "Title is required" : undefined}
            />
            <Textarea
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
            {editError && editTitle.trim() ? (
              <p className="text-sm text-red-600 dark:text-red-300" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex gap-2 pt-2">
              <Button variant="primary" onClick={saveEdit} loading={busyEdit} disabled={busyEdit}>
                Save
              </Button>
              <Button variant="secondary" onClick={closeEditModal} disabled={busyEdit}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
