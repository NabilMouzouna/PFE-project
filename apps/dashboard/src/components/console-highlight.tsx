import styles from "./console-highlight.module.css";

type Props = {
  title?: string;
  children: React.ReactNode;
  variant?: "default" | "storage";
};

export function ConsoleHighlight({ title = "Tip", children, variant = "default" }: Props) {
  return (
    <aside
      className={`${styles.highlight} ${variant === "storage" ? styles.storage : ""}`}
      aria-label={title}
    >
      <div className={styles.kicker}>{title}</div>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
