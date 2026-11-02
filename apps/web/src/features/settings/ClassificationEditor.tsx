"use client";
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  renameCategory,
  reorderClassifications,
  moveSubcategory,
  updateSubcategory,
} from "./classificationApi";
import styles from "./settings.module.css";

type Category = { id: string; name: string };
type Subcategory = Category & { categoryId: string };
type Layout = { items: Category[]; subcategories: Subcategory[] };
type Drag = {
  id: string;
  parent?: string;
  x: number;
  y: number;
  moved: boolean;
  original: Layout;
  valid: boolean;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  label: string;
};
export default function ClassificationEditor({
  items,
  subcategories,
  disabled,
  onChange,
  onBusy,
  query = "",
  onSearchFocus,
}: {
  items: Category[];
  subcategories: Subcategory[];
  disabled: boolean;
  onChange: (items: Category[], subcategories: Subcategory[]) => void;
  onBusy: (value: boolean) => void;
  query?: string;
  onSearchFocus?: () => void;
}) {
  const [editing, setEditing] = useState<
    (Category & { categoryId?: string }) | null
  >(null);
  const [parentId, setParentId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [preview, setPreview] = useState<Layout | null>(null);
  const previewRef = useRef<Layout | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const [floating, setFloating] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
  } | null>(null);
  const suppressClick = useRef(false);
  const [moving, setMoving] = useState<{
    id: string;
    from: string;
    to: string;
    before?: string;
  } | null>(null);
  const drag = useRef<Drag | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const busy = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const moveDialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
  const search = normalize(query);
  const layout = preview ?? { items, subcategories };
  const groups = layout.items
    .map((item) => {
      const all = layout.subcategories.filter(
        (sub) => sub.categoryId === item.id,
      );
      const children =
        !search || normalize(item.name).includes(search)
          ? all
          : all.filter((sub) => normalize(sub.name).includes(search));
      return { item, all, children };
    })
    .filter(
      (group) =>
        !search ||
        normalize(group.item.name).includes(search) ||
        group.children.length > 0,
    );
  const showPreview = useCallback((value: Layout | null) => {
    previewRef.current = value;
    setPreview(value);
  }, []);
  const cancelDrag = useCallback(() => {
    drag.current = null;
    setDragging(null);
    setFloating(null);
    showPreview(null);
  }, [showPreview]);
  const updateTarget = useCallback(
    (x: number, y: number) => {
      const current = drag.current;
      if (!current) return;
      setFloating({
        x: Math.max(
          8,
          Math.min(x - current.offsetX, window.innerWidth - current.width - 8),
        ),
        y: Math.max(
          8,
          Math.min(
            y - current.offsetY,
            window.innerHeight - current.height - 8,
          ),
        ),
        width: current.width,
        height: current.height,
        label: current.label,
      });
      const element = document.elementFromPoint(x, y);
      const group = element?.closest<HTMLElement>("[data-sort-category]");
      if (!group || !list.current?.contains(group)) {
        current.valid = false;
        showPreview(current.original);
        return;
      }
      current.valid = true;
      const value = previewRef.current ?? current.original;
      const row = element?.closest<HTMLElement>("[data-sort-sub]");
      if (!current.parent) {
        if (group.dataset.sortCategory === current.id) return;
        const rest = value.items.filter((item) => item.id !== current.id);
        const position = rest.findIndex(
          (item) => item.id === group.dataset.sortCategory,
        );
        const rect = group.getBoundingClientRect();
        rest.splice(
          position + (y > rect.top + rect.height / 2 ? 1 : 0),
          0,
          value.items.find((item) => item.id === current.id)!,
        );
        showPreview({ ...value, items: rest });
        return;
      }
      if (row?.dataset.sortSub === current.id) return;
      const to = group.dataset.sortCategory!;
      const boxes = Array.from(
        group.querySelectorAll<HTMLElement>("[data-sort-sub]"),
      ).filter((box) => box.dataset.sortSub !== current.id);
      const before = boxes.find((box) => {
        const rect = box.getBoundingClientRect();
        return (
          y < rect.top || (y <= rect.bottom && x < rect.left + rect.width / 2)
        );
      })?.dataset.sortSub;
      const others = value.subcategories.filter((sub) => sub.id !== current.id);
      const siblings = others.filter((sub) => sub.categoryId === to);
      const position = before
        ? siblings.findIndex((sub) => sub.id === before)
        : siblings.length;
      siblings.splice(position < 0 ? siblings.length : position, 0, {
        ...value.subcategories.find((sub) => sub.id === current.id)!,
        categoryId: to,
      });
      showPreview({
        items: value.items,
        subcategories: [
          ...others.filter((sub) => sub.categoryId !== to),
          ...siblings,
        ],
      });
    },
    [showPreview],
  );
  useEffect(() => {
    if (editing) dialog.current?.showModal();
  }, [editing]);
  useEffect(() => {
    if (moving) moveDialog.current?.showModal();
  }, [moving]);
  useEffect(() => {
    if (!dragging) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelDrag();
      }
    }
    window.addEventListener("keydown", escape);
    let frame: number;
    function scroll() {
      if (!drag.current) return;
      const { x, y } = pointer.current;
      const edge = 80;
      const bottom = window.innerHeight - 100;
      const speed =
        y < edge
          ? -Math.min(12, (edge - y) / 4)
          : y > bottom
            ? Math.min(12, (y - bottom) / 4)
            : 0;
      if (speed) {
        window.scrollBy(0, speed);
        updateTarget(x, y);
      }
      frame = requestAnimationFrame(scroll);
    }
    frame = requestAnimationFrame(scroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", escape);
    };
  }, [dragging, cancelDrag, updateTarget]);

  function closeMove() {
    const id = moving?.id;
    moveDialog.current?.close();
    setMoving(null);
    showPreview(null);
    setError("");
    if (id)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(
            `[data-handle-id="${CSS.escape(id)}"]`,
          )
          ?.focus(),
      );
  }
  function chooseMoveParent(to: string) {
    if (!moving) return;
    setMoving({ ...moving, to, before: undefined });
    const item = subcategories.find((sub) => sub.id === moving.id)!;
    showPreview({
      items,
      subcategories: [
        ...subcategories.filter((sub) => sub.id !== moving.id),
        { ...item, categoryId: to },
      ],
    });
  }
  async function confirmMove(event: React.FormEvent) {
    event.preventDefault();
    if (!moving || busy.current) return;
    busy.current = true;
    onBusy(true);
    setError("");
    try {
      await moveSubcategory(moving.id, moving.from, moving.to, moving.before);
      const item = subcategories.find((sub) => sub.id === moving.id)!;
      const others = subcategories.filter((sub) => sub.id !== moving.id);
      const siblings = others.filter((sub) => sub.categoryId === moving.to);
      const position = moving.before
        ? siblings.findIndex((sub) => sub.id === moving.before)
        : siblings.length;
      siblings.splice(position < 0 ? siblings.length : position, 0, {
        ...item,
        categoryId: moving.to,
      });
      onChange(items, [
        ...others.filter((sub) => sub.categoryId !== moving.to),
        ...siblings,
      ]);
      closeMove();
      setNotice(
        "세부 분류를 옮겼습니다. 이 가계부의 과거 내역과 통계에도 반영됩니다.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "분류를 옮기지 못했습니다.",
      );
    } finally {
      busy.current = false;
      onBusy(false);
    }
  }

  function close() {
    dialog.current?.close();
    setEditing(null);
    setError("");
  }
  function restoreEditFocus() {
    requestAnimationFrame(() => {
      if (
        trigger.current?.isConnected &&
        !trigger.current.hasAttribute("disabled")
      )
        trigger.current.focus();
      else onSearchFocus?.();
    });
  }
  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || busy.current) return;
    if (!name.trim() || name.trim().length > 80) {
      setError("분류 이름은 1~80자로 입력해 주세요.");
      return;
    }
    busy.current = true;
    onBusy(true);
    setError("");
    try {
      if (editing.categoryId) {
        await updateSubcategory(
          editing.id,
          name.trim(),
          editing.name,
          parentId,
          editing.categoryId,
        );
        const updated = {
          id: editing.id,
          name: name.trim(),
          categoryId: parentId,
        };
        onChange(
          items,
          parentId === editing.categoryId
            ? subcategories.map((sub) =>
                sub.id === editing.id ? updated : sub,
              )
            : [
                ...subcategories.filter((sub) => sub.id !== editing.id),
                updated,
              ],
        );
      } else {
        await renameCategory(editing.id, name.trim(), editing.name);
        onChange(
          items.map((item) =>
            item.id === editing.id ? { ...item, name: name.trim() } : item,
          ),
          subcategories,
        );
      }
      close();
      setNotice("분류를 수정했습니다.");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "저장하지 못했습니다.",
      );
    } finally {
      busy.current = false;
      onBusy(false);
    }
  }
  async function move(id: string, to: string, parent?: string) {
    if (disabled || busy.current || id === to) return;
    const rows: Category[] = parent
      ? subcategories.filter((sub) => sub.categoryId === parent)
      : items;
    const previous = rows.map((row) => row.id);
    const from = previous.indexOf(id),
      end = previous.indexOf(to);
    if (from < 0 || end < 0) return;
    const ids = [...previous];
    ids.splice(from, 1);
    ids.splice(end, 0, id);
    busy.current = true;
    onBusy(true);
    setError("");
    setNotice("");
    try {
      await reorderClassifications(ids, previous, parent);
      if (parent) {
        const siblings = ids.map((key) =>
          subcategories.find((sub) => sub.id === key)!,
        );
        onChange(items, [
          ...subcategories.filter((sub) => sub.categoryId !== parent),
          ...siblings,
        ]);
      } else
        onChange(
          ids.map((key) => items.find((item) => item.id === key)!),
          subcategories,
        );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "순서를 저장하지 못했습니다.",
      );
    } finally {
      busy.current = false;
      onBusy(false);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(
            `[data-handle-id="${CSS.escape(id)}"]`,
          )
          ?.focus(),
      );
    }
  }
  async function saveDrag(current: Drag, next: Layout) {
    const previousIds = current.parent
      ? current.original.subcategories
          .filter((sub) => sub.categoryId === current.parent)
          .map((sub) => sub.id)
      : current.original.items.map((item) => item.id);
    const ids = current.parent
      ? next.subcategories
          .filter((sub) => sub.categoryId === current.parent)
          .map((sub) => sub.id)
      : next.items.map((item) => item.id);
    if (ids.every((id, index) => id === previousIds[index])) {
      showPreview(null);
      return;
    }
    busy.current = true;
    onBusy(true);
    setNotice("");
    setError("");
    try {
      await reorderClassifications(ids, previousIds, current.parent);
      onChange(next.items, next.subcategories);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "순서를 저장하지 못했습니다.",
      );
    } finally {
      showPreview(null);
      busy.current = false;
      onBusy(false);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(
            `[data-handle-id="${CSS.escape(current.id)}"]`,
          )
          ?.focus(),
      );
    }
  }
  function start(
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
    parent?: string,
  ) {
    if (disabled || busy.current || search || event.button !== 0) return;
    suppressClick.current = false;
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      id,
      parent,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      original: { items, subcategories },
      valid: true,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      label:
        event.currentTarget.getAttribute("aria-label") ??
        event.currentTarget.textContent ??
        "",
    };
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current) return;
    if (
      Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6 &&
      !current.moved
    )
      return;
    if (!current.moved) list.current?.setPointerCapture(event.pointerId);
    current.moved = true;
    suppressClick.current = true;
    setDragging(current.id);
    pointer.current = { x: event.clientX, y: event.clientY };
    updateTarget(event.clientX, event.clientY);
  }
  function stop() {
    const current = drag.current;
    const next = previewRef.current;
    drag.current = null;
    setDragging(null);
    setFloating(null);
    if (current?.moved && current.valid && next) {
      const moved = next.subcategories.find((sub) => sub.id === current.id);
      if (current.parent && moved && moved.categoryId !== current.parent) {
        setError("");
        const siblings = next.subcategories.filter(
          (sub) => sub.categoryId === moved.categoryId,
        );
        const position = siblings.findIndex((sub) => sub.id === current.id);
        setMoving({
          id: current.id,
          from: current.parent,
          to: moved.categoryId,
          before: siblings[position + 1]?.id,
        });
      } else void saveDrag(current, next);
    } else showPreview(null);
  }
  function handle(
    id: string,
    label: string,
    parent?: string,
    edit?: () => void,
    path?: string,
  ) {
    return (
      <button
        type="button"
        data-handle-id={id}
        className={`${styles.dragName} ${parent ? styles.subcategoryName : styles.categoryName}`}
        aria-label={edit ? label : `${label} 순서 이동`}
        data-dragging={dragging === id}
        aria-describedby={search ? undefined : "classification-drag-help"}
        disabled={disabled}
        onPointerDown={(event) => start(event, id, parent)}
        onClick={(event) => {
          if (suppressClick.current && event.detail > 0) {
            suppressClick.current = false;
            event.preventDefault();
            return;
          }
          if (edit) {
            trigger.current = event.currentTarget;
            edit();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            cancelDrag();
          }
          if (
            search ||
            !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
              event.key,
            )
          )
            return;
          event.preventDefault();
          const rows = parent
            ? subcategories.filter((sub) => sub.categoryId === parent)
            : items;
          const next =
            rows[
              rows.findIndex((row) => row.id === id) +
                (["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1)
            ];
          if (next) void move(id, next.id, parent);
        }}
      >
        <span>
          {path && <small className={styles.searchPath}>{path} › </small>}
          {label}
        </span>
      </button>
    );
  }
  return (
    <>
      <p id="classification-drag-help" className={styles.srOnly}>
        분류를 누르면 수정합니다. 끌어서 위치를 바꾸거나 키보드 위·아래 화살표로
        순서를 바꿀 수 있습니다.
      </p>
      {error && !editing && !moving && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {search && (
        <p role="status" className={styles.searchResultCount}>
          검색 결과 {groups.length}개 상위 분류 ·{" "}
          {groups.reduce((total, group) => total + group.children.length, 0)}개
          세부 분류
        </p>
      )}
      {search && groups.length === 0 && (
        <p className={styles.emptyClassifications}>일치하는 분류가 없어요.</p>
      )}
      <div
        ref={list}
        className={styles.classificationList}
        data-searching={!!search}
        onPointerMove={pointerMove}
        onPointerUp={stop}
        onPointerCancel={cancelDrag}
        onLostPointerCapture={(event) => {
          if (event.target === list.current && drag.current?.moved)
            cancelDrag();
        }}
      >
        {groups.map(({ item, all, children }) => (
          <section
            key={item.id}
            data-sort-category={item.id}
            data-drag-source={dragging === item.id}
            className={styles.classificationGroup}
          >
            <div
              className={`${styles.classificationHeading} ${styles.groupHeading}`}
            >
              <h3>
                {handle(item.id, item.name, undefined, () => {
                  setEditing(item);
                  setName(item.name);
                  setError("");
                })}
              </h3>
              <span
                className={styles.classificationCount}
                aria-label={`세부 분류 ${all.length}개`}
              >
                {all.length}
              </span>
            </div>
            <ul className={styles.subcategoryList}>
              {children.map((sub) => (
                <li
                  key={sub.id}
                  data-sort-sub={sub.id}
                  data-parent={item.id}
                  data-drag-source={dragging === sub.id}
                >
                  {handle(
                    sub.id,
                    sub.name,
                    item.id,
                    () => {
                      setEditing(sub);
                      setName(sub.name);
                      setParentId(item.id);
                      setError("");
                    },
                    search ? item.name : undefined,
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {floating && (
        <div
          aria-hidden="true"
          data-drag-floating
          className={styles.dragFloating}
          style={{
            left: floating.x,
            top: floating.y,
            width: floating.width,
            minHeight: floating.height,
          }}
        >
          {floating.label}
        </div>
      )}
      <dialog
        ref={moveDialog}
        className={styles.dialog}
        aria-labelledby="move-subcategory-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy.current) closeMove();
        }}
      >
        {moving && (
          <form onSubmit={confirmMove}>
            <div className={styles.classificationHeading}>
              <h2 id="move-subcategory-title">소속 분류 변경</h2>
              <button
                type="button"
                className={styles.secondary}
                aria-label="분류 이동 닫기"
                disabled={disabled}
                onClick={closeMove}
              >
                ×
              </button>
            </div>
            <p>
              <strong>
                {subcategories.find((sub) => sub.id === moving?.id)?.name}
              </strong>{" "}
              분류의 과거 내역과 통계도 새 상위 분류로 옮겨집니다. 금액과
              결제일은 유지됩니다.
            </p>
            <label className={styles.field}>
              소속 상위 분류
              <select
                aria-label="소속 상위 분류"
                value={moving?.to ?? ""}
                disabled={disabled}
                onChange={(event) => chooseMoveParent(event.target.value)}
              >
                {items
                  .filter((item) => item.id !== moving?.from)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={closeMove}
                disabled={disabled}
              >
                취소
              </button>
              <button className={styles.primary} disabled={disabled}>
                변경 저장
              </button>
            </div>
          </form>
        )}
      </dialog>
      <dialog
        ref={dialog}
        onClose={restoreEditFocus}
        className={styles.dialog}
        aria-labelledby="rename-category-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy.current) close();
        }}
      >
        <form onSubmit={saveName}>
          <div className={styles.classificationHeading}>
            <h2 id="rename-category-title">
              {editing?.categoryId ? "세부 분류 수정" : "상위 분류 수정"}
            </h2>
            <button
              className={styles.secondary}
              type="button"
              aria-label="분류 수정 닫기"
              disabled={disabled}
              onClick={close}
            >
              ×
            </button>
          </div>
          <label className={styles.field}>
            {editing?.categoryId ? "세부 분류 이름" : "상위 분류 이름"}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
              disabled={disabled}
            />
          </label>
          {editing?.categoryId && (
            <label className={styles.field}>
              소속 상위 분류
              <select
                aria-label="소속 상위 분류"
                value={parentId}
                disabled={disabled}
                onChange={(event) => setParentId(event.target.value)}
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {editing?.categoryId && parentId !== editing.categoryId && (
            <p>
              과거 내역과 통계도 선택한 상위 분류로 변경됩니다. 금액과 결제일은
              유지됩니다.
            </p>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button className={styles.primary} disabled={disabled}>
              저장
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
