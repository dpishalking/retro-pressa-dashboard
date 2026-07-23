# Start Here — Retro Pressa Business OS

**С чего начать?** Этот файл — единственная обязательная точка входа.

Если вы новый разработчик: пройдите порядок ниже за 30–60 минут.

---

## Порядок чтения (обязательный)

1. Этот файл — `docs/00_START_HERE.md`
2. [BUSINESS_OS.md](./BUSINESS_OS.md) — миссия и карта системы
3. [ARCHITECTURE.md](./ARCHITECTURE.md) — границы OS и SSOT
4. [SYSTEMS.md](./SYSTEMS.md) — статус каждой OS
5. [DATA_FLOW.md](./DATA_FLOW.md) — как текут данные
6. [business-os/BUSINESS_OS_STANDARD_V1.md](./business-os/BUSINESS_OS_STANDARD_V1.md) — слои и контракты
7. Доменная глубина по задаче:
   - Sales → [business-os/SALES_OS.md](./business-os/SALES_OS.md)
   - Traffic → [business-os/TRAFFIC_OS.md](./business-os/TRAFFIC_OS.md)
8. Операции: [RECOVERY.md](./RECOVERY.md) · [SECURITY.md](./SECURITY.md) · [DEVELOPMENT.md](./DEVELOPMENT.md)

Карта агента в корне: [`AGENTS.md`](../AGENTS.md) (код/UI/API). Не заменяет этот хаб.

---

## Быстрые ссылки

| Нужно | Документ |
|-------|----------|
| Википедия проекта | [BUSINESS_OS.md](./BUSINESS_OS.md) |
| Архитектура | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Реестр систем | [SYSTEMS.md](./SYSTEMS.md) |
| Реестр Google Sheets | [SPREADSHEETS.md](./SPREADSHEETS.md) |
| Потоки данных | [DATA_FLOW.md](./DATA_FLOW.md) |
| Индекс всех docs | [DOCUMENT_INDEX.md](./DOCUMENT_INDEX.md) |
| Решения (ADR) | [decisions/](./decisions/) |
| Recovery | [RECOVERY.md](./RECOVERY.md) |
| Releases | [RELEASES.md](./RELEASES.md) |
| Readiness | [READINESS.md](./READINESS.md) |
| Как пилить новую OS | [DEVELOPMENT.md](./DEVELOPMENT.md) |
| Структура репо | [REPOSITORY.md](./REPOSITORY.md) |
| Security | [SECURITY.md](./SECURITY.md) |
| Git | [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) |
| Артефакты | [ARTIFACTS.md](./ARTIFACTS.md) |
| Проблемы docs | [DOC_ISSUES.md](./DOC_ISSUES.md) |
| Roadmap | [business-os/ROADMAP.md](./business-os/ROADMAP.md) |
| Деплой | [../AUTO_DEPLOY.md](../AUTO_DEPLOY.md) |

---

## Запуск локально (минимум)

```bash
cp .env.example .env.local   # заполнить секреты
npm install
npm run dev                  # http://127.0.0.1:4174
npm test
```

Секреты: только `.env.local`. См. [SECURITY.md](./SECURITY.md).

---

## Что нельзя делать без отдельного спринта

- Mother / Sales / Traffic cutover  
- Новые OS (Finance / Product) без Coverage Audit  
- Commit/push секретов и `data/**`  
- Менять схему `99_EXPORT` без новой версии контракта  

---

## Навигация

← вы здесь · далее → [BUSINESS_OS.md](./BUSINESS_OS.md)
