"use client";

/**
 * Fixed slot under every significant Analytics OS block.
 * Always visible: either a ready management line or an explicit empty state
 * so the UI shows where decisions will live before logic is wired.
 */
export function DecisionBrief({
  title = "Решение",
  body,
  empty = false
}: {
  title?: string;
  /** Plain management language. Omit or pass null → empty placeholder. */
  body?: string | null;
  /** Force empty slot even if body is set. */
  empty?: boolean;
}) {
  const isEmpty = empty || !body?.trim();
  return (
    <aside className={`aos-decision ${isEmpty ? "aos-decision--empty" : ""}`} aria-label={title}>
      <div className="aos-decision__label">{title}</div>
      <p className="aos-decision__body">
        {isEmpty
          ? "Здесь будет простой вывод для управления по цифрам выше. Пока правило не подключено — смотрите таблицу и решайте вручную."
          : body}
      </p>
    </aside>
  );
}
