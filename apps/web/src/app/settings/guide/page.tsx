import Link from "@/shared/ui/AppLink";
import styles from "@/features/settings/settings.module.css";
export default function Page() {
  return (
    <main className={styles.screen}>
      <Link className={styles.back} href="/settings">
        ‹ 설정
      </Link>
      <header className={styles.header}>
        <h1>사용 및 데이터 안내</h1>
      </header>
      <section className={styles.card}>
        <h2>결제수단 관리</h2>
        <p>
          카드·계좌·현금을 별명으로 등록해요. 실제 카드번호나 계좌번호 전체는
          입력하지 마세요. 보관한 결제수단의 과거 완료·지출 기록은 유지돼요.
          연결된 미완료 고정비는 결제수단이 미지정으로 바뀌어요.
        </p>
      </section>
      <section className={styles.card}>
        <h2>날짜와 금액 기준</h2>
        <p>
          일정은 한국 시간(Asia/Seoul), 금액은 원 단위로 관리해요. 고정비의 첫
          결제일과 이후 반복 결제일은 각각 설정할 수 있어요.
        </p>
      </section>
      <section className={styles.card}>
        <h2>고정비 삭제</h2>
        <p>
          고정비를 삭제하면 현재와 이후의 미완료 예정 내역을 취소하고 새 예정
          내역 생성을 중단해요. 완료된 청구와 지출 기록은 유지돼요.
        </p>
      </section>
    </main>
  );
}
