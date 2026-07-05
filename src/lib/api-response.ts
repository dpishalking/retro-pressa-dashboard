export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    if (text.trimStart().startsWith("<")) {
      throw new Error(
        "Сервер вернул HTML вместо данных — часто это таймаут, перезапуск или слишком большой файл. Попробуйте JSON-архив или повторите через минуту."
      );
    }
    throw new Error(text.slice(0, 240) || "Некорректный ответ сервера");
  }
}
