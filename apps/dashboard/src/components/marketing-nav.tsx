import Link from "next/link";
import styles from "./marketing-nav.module.css";

type Props = {
  /** Highlight "Sign in" vs "Register" context */
  variant?: "default" | "login" | "register";
  /** When true, primary nav action opens the operator console. */
  authenticated?: boolean;
};

export function MarketingNav({ variant = "default", authenticated = false }: Props) {
  return (
    <div className={styles.outer}>
      <header className={styles.bar}>
        <Link href="/" className={styles.brand}>
          AppBase
        </Link>
        <nav className={styles.links} aria-label="Marketing">
          <Link href="/docs" className={styles.docLink}>
            Docs
          </Link>
          {variant === "login" && (
            <Link href="/register" className={styles.cta}>
              Create account
            </Link>
          )}
          {variant === "register" && (
            <Link href="/login" className={styles.ctaGhost}>
              Sign in
            </Link>
          )}
          {variant === "default" && (
            <>
              {authenticated ? (
                <Link href="/overview" className={styles.cta}>
                  Console
                </Link>
              ) : (
                <Link href="/login" className={styles.ctaGhost}>
                  Log in
                </Link>
              )}
            </>
          )}
        </nav>
      </header>
    </div>
  );
}
