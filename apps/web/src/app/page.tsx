import styles from "./page.module.css";
import Link from "next/link";

export default function Home() {
  return (
    <main className={styles.page}>
      <h1>한달살림</h1>
      <p>반복 생활비를 관리할 준비를 하고 있습니다.</p>
      <Link href="/entries/new">내역 추가</Link>
    </main>
  );
}
