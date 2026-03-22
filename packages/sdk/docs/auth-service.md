# Auth Service

Auth for AppBase — simple. Session lives in an HttpOnly cookie; the access token is stored in `localStorage` when `sessionStorageKey` is set.

---

## Quick start

```ts
import { AppBase } from "@appbase/sdk";

const appbase = AppBase.init({
  endpoint: "http://localhost:3000",
  apiKey: "hs_live_your_key",
  sessionStorageKey: "my_app_session", // optional; persists across reloads
});

// Destructure what you need
const { signIn, signOut, signUp, getAuthState, onAuthStateChange } = appbase.auth;

// Check auth — SDK restores from localStorage and refreshes stale tokens automatically
const { authenticated, user } = getAuthState();
```

---

## Methods


| Method                        | Description                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `signUp(data)`                | Register and sign in. `data`: `{ email, password, customIdentity? }`                                                                |
| `signIn(data)`                | Sign in. `data`: `{ email, password }`                                                                                              |
| `signOut()`                   | Sign out and clear session                                                                                                          |
| `getAuthState()`              | `{ authenticated: boolean; user: { id, email } | null }` — use for conditional render and redirects                                 |
| `onAuthStateChange(callback)` | Subscribe to auth changes. First callback fires after startup restore/refresh; subsequent callbacks on changes. Returns unsubscribe |
| `ready()`                     | `Promise<void>` — resolves when startup restore/refresh is done                                                                     |
| `getCustomIdentity()`         | Custom fields from sign-up                                                                                                          |


---

## React / Next.js

Use `@appbase/sdk/react` — one provider, one hook. Startup check and subscriptions run under the hood.

### Setup

```tsx
// lib/appbase.tsx
"use client";

import { useMemo } from "react";
import { AppBase } from "@appbase/sdk";
import { AppBaseProvider as SDKProvider } from "@appbase/sdk/react";

export function AppBaseProvider({ children }: { children: React.ReactNode }) {
  const appbase = useMemo(() =>
    AppBase.init({
      endpoint: process.env.NEXT_PUBLIC_APPBASE_ENDPOINT!,
      apiKey: process.env.NEXT_PUBLIC_APPBASE_API_KEY!,
      sessionStorageKey: "my_app_session",
    }),
    [],
  );
  return <SDKProvider appBase={appbase}>{children}</SDKProvider>;
}

export { useAppBase, useAuth, useRequireAuth } from "@appbase/sdk/react";
```

```tsx
// app/layout.tsx
import { AppBaseProvider } from "@/lib/appbase";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AppBaseProvider>{children}</AppBaseProvider>
      </body>
    </html>
  );
}
```

### Sign up

```tsx
import { useAuth } from "@/lib/appbase";

export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const { user } = await signUp({ email, password });
    router.push("/dashboard");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Create account</button>
    </form>
  );
}
```

### Sign in

```tsx
import { useAuth } from "@/lib/appbase";

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await signIn({ email, password });
    router.push("/dashboard");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Sign in</button>
    </form>
  );
}
```

### Sign out

```tsx
import { useAuth } from "@/lib/appbase";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const { signOut, authState } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push("/sign-in");
  };

  return (
    <div>
      <p>Signed in as {authState?.user?.email}</p>
      <button onClick={handleSignOut}>Sign out</button>
    </div>
  );
}
```

### Protected routes

`useAuth()` returns `authState` — `null` means loading (startup restore), otherwise `{ authenticated, user }`.  
`useRequireAuth(redirectTo, router)` handles redirect for you.

```tsx
import { useAuth, useRequireAuth, useAppBase } from "@/lib/appbase";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const { signOut, authState } = useAuth();
  const { authenticated, user } = useRequireAuth("/sign-in", router);
  const appbase = useAppBase();

  if (authState === null) return <p>Loading...</p>;
  if (!authenticated) return <p>Redirecting...</p>;

  return (
    <div>
      <p>Welcome {user?.email}</p>
      <button onClick={async () => { await signOut(); router.push("/sign-in"); }}>Sign out</button>
    </div>
  );
}
```

---

## Plain JS/TS

```ts
const { signIn, signOut, signUp, getAuthState, onAuthStateChange, ready } = appbase.auth;

await ready();

if (getAuthState().authenticated) {
  showDashboard();
} else {
  showLoginForm();
}

onAuthStateChange(({ authenticated, user }) => {
  authenticated ? showDashboard(user) : showLoginForm();
});
```

---

## Security

- **Access token** in `localStorage` — readable by JS; keep third-party scripts minimal.
- **Session** in HttpOnly cookie — not readable by JS.

