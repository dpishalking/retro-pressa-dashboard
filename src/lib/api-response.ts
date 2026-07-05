export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    if (text.trimStart().startsWith("<")) {
      const hint = response.status >= 500 || response.status === 408
        ? "Похоже на таймаут или перезапуск сервера."
        : "Похоже, прокси вернул HTML-страницу вместо JSON.";
      throw new Error(
        `${hint} Попробуйте ещё раз через минуту или загрузите JSON-архив вручную.`
      );
    }
    throw new Error(text.slice(0, 240) || "Некорректный ответ сервера");
  }
}
