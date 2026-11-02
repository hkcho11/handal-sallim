import styles from "./coming-soon.module.css";

export default function ComingSoonScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1>{title}</h1>
      </header>
      <section className={styles.card} aria-labelledby="coming-soon-title">
        <span className={styles.badge}>준비중</span>
        <h2 id="coming-soon-title">조금만 기다려 주세요</h2>
        <p>{description}</p>
      </section>
    </main>
  );
}
