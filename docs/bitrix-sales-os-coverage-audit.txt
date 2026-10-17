# Bitrix24 Coverage Audit — будущая Sales OS

**Дата аудита:** 2026-07-22  
**Тип:** read-only coverage audit (код + интеграция + доступные данные)  
**Цель:** определить, может ли Bitrix быть единственным источником истины для будущей Sales OS, и где начинается Business OS.

> Этот документ — обязательный артефакт решения: что остаётся event-master в Bitrix, а что должно жить/считаться в Sales OS / Business OS.

---

## 0. Вердикт

**Bitrix уже является рабочим event-master для ядра воронки Lead → Deal → Invoice(event) → Paid Deal.**  
Он **не** является достаточным единственным источником истины для полной Sales OS: нет стабильного `customer_key`, нет платёжного журнала, нет полноценной истории стадий в текущей интеграции, нет причин потерь как CRM-полей, нет контактов/дублей, нет AI/прогнозов.

**Итоговая готовность Bitrix как SSOT для Sales OS: ~58%.**

Оценка означает покрытие *необходимых* данных Sales OS, а не «насколько хорош текущий дашборд».

---

## 1. Ограничения доказательной базы

Все выводы ниже основаны только на:

| Источник | Статус в этой среде |
|----------|---------------------|
| Код `src/lib/bitrix/*`, `src/config/os-sheets.ts`, `src/lib/os-sheets/orders-mapper.ts` | Есть |
| Mapping `ORDERS_BITRIX_MAP` | Есть |
| `metric-definitions.ts` / known gaps | Есть |
| `data/bitrix-snapshots/` | **Отсутствует** (в `.gitignore`, в workspace пусто; в git history тоже нет) |
| Live `BITRIX_WEBHOOK_URL` | **Не сконфигурирован** в этой среде |
| `data/conversation-exports/` (май/июнь 2026) | Есть (архив gift-ai / bundled) |
| `data/conversation-snapshots/` | Есть (агрегаты) |

**Следствие:** fill-rate полей CRM (UTM, страна, LEAD_ID и т.д.) по реальным Bitrix snapshots **измерить нельзя**. Где нет evidence — статус `Unknown` / «недостаточно данных», без догадок.

Известный portal из теста URL: `bb-wood.bitrix24.eu` (`os-orders-mapper.test.ts`).

---

## 2. Карта текущей интеграции

### 2.1 Webhook

- Env: `BITRIX_WEBHOOK_URL` (`.env.example`)
- Вызовы: `{webhook}{method}.json` (CRM) и `{webhook}{method}` (IM / Open Lines)
- Права, явно упомянутые в коде ошибок: CRM + `im` + `imopenlines`

### 2.2 REST-методы, которые уже вызываются

| Метод | Где | Назначение |
|-------|-----|------------|
| `crm.lead.list` | `connector.ts` | Лиды периода + recent 10 дней |
| `crm.lead.fields` | `connector.ts` | Enum страны лида |
| `crm.deal.list` | `connector.ts` | Счета (по UF-дате), оплаты (WON+CLOSEDATE), OS deal universe |
| `crm.deal.fields` | `connector.ts` | Enum страны сделки |
| `crm.deal.productrows.get` | `connector.ts` (через `batch`) | Товары сделки |
| `crm.stagehistory.list` | `connector.ts` | **Только** переход в `STAGE_ID=1` («Выставление счета») |
| `user.get` | `connector.ts` | Имя менеджера |
| `batch` | `connector.ts` | Пакет productrows |
| `crm.activity.list` | `openline-crm-connector.ts` | Open Lines sessions (`TYPE_ID=6`, `PROVIDER_ID=IMOPENLINES_SESSION`) |
| `imopenlines.session.list` | `conversation-connector.ts` | Список сессий |
| `imopenlines.session.history.get` | conversation + openline connectors | История сообщений |
| `im.recent.list` | `conversation-connector.ts` | Recent dialogs |
| `im.dialog.messages.get` | `conversation-connector.ts` | Сообщения чата |

**Не вызываются в коде:** `crm.contact.*`, `crm.company.*`, `crm.invoice.*` / smart invoice items, `crm.timeline.*`, `crm.activity.*` кроме Open Lines, department/orgstructure, `crm.status.*` (кроме косвенного знания STATUS_ID).

### 2.3 Snapshots

Модель `BitrixSnapshot` v2 (`snapshot-store.ts`):

- путь: `data/bitrix-snapshots/{period}.json`
- содержимое: `leads`, `recentLeads`, `deals` (invoice set), `paidDeals`, country/product options, period bounds
- запись: при live sync (`writeBitrixSnapshot`)
- чтение: analytics, UTM audit, OS Orders sync

В этой среде snapshots **недоступны** → fill-rate CRM-полей = Unknown.

### 2.4 Модели Orders

Контракт Sheets `03_Orders` + `ORDERS_BITRIX_MAP` (`os-sheets.ts`):

- `order_id` v1 = `deal.ID`
- CRM-поля заполняются из Bitrix snapshot/deal universe
- Ops-поля (`production_*`, `shipment_*`, `delivery_*`, `notes`) — manual / Sheets
- `customer_key` = **TBD**, в mapper всегда `""`
- `source_of_truth`: `bitrix` | `hybrid` | `manual`

### 2.5 Пользовательские поля, подтверждённые кодом

| Field ID | Сущность | Смысл в коде |
|----------|----------|--------------|
| `UF_CRM_1737995147` | Lead | Страна (enum) |
| `UF_CRM_6797B3DA00D16` | Deal | Страна (enum) |
| `UF_CRM_FORMNAME` | Lead | Имя формы |
| `UF_CRM_1758618010118` | Deal | «Выставлен счет» (дата) |
| `UF_CRM_1739982211` | Deal | «Сумма для счета» |
| `UF_CRM_1778244823819` | Deal | «Счет выставлен?» (`BITRIX_INVOICE_FLAG_YES=2752`) — **объявлен, но не select’ится** |

### 2.6 Сущности, которые реально используются

| Сущность | Используется? | Как |
|----------|---------------|-----|
| Lead | Да | list + snapshot + UTM/country/source |
| Deal (category «Продажа» = 0) | Да | invoice/paid/order proxy |
| Product Row | Да | primary product → Orders |
| Stage History | Частично | только invoice stage |
| User | Да | ASSIGNED_BY_ID → name |
| Activity (Open Lines) | Да | conversation import |
| Open Lines / IM messages | Да | ROP quality |
| Contact | **Нет** | — |
| Company | **Нет** | — |
| Invoice entity | **Нет** | счёт = UF на Deal + stage |
| Timeline | **Нет** | — |
| Smart Process | **Нет** | — |

### 2.7 Синхронизация

| Endpoint / функция | Что тянет |
|--------------------|-----------|
| `/api/sync/bitrix` → `syncBitrixMetrics` | leads + invoice deals + paid deals → dashboard metrics |
| `loadOsBitrixDealUniverse` | created + invoiced + paid deals → Orders |
| `/api/conversations/sync-bitrix` / daily-sync | Open Lines / IM |
| `openline-crm-connector` | activities → session history |
| UTM audit | читает bitrix snapshot (не live) |

SSOT в Business OS (`ssot-rules.ts`): revenue / sales / invoices / paid+organic leads → **bitrix**; QL / adSpend → Google Sheets; quality → conversation analytics.

---

## 3. Покрытие по доменам

Легенда статуса поля: **Есть** / **Частично** / **Нет** / **Unknown**.

Для каждого поля: наличие в Bitrix (по evidence кода), сущность, поля, fill-rate, API, уже в интеграции, нужна доработка, SSOT.

### 3.1 Лиды

| Поле Sales OS | В Bitrix | Сущность | Поля | Fill-rate | API | Уже в интеграции | Доработать | SSOT |
|---------------|----------|----------|------|-----------|-----|------------------|------------|------|
| `lead_id` | Есть | Lead | `ID` | Unknown (snapshots нет) | Да (`crm.lead.list`) | Да | Нет | Bitrix |
| `created_at` | Есть | Lead | `DATE_CREATE` | Unknown | Да | Да | Нет | Bitrix |
| `source` | Есть | Lead | `SOURCE_ID` | Unknown | Да | Да (paid FB/IG set vs other) | Частично: нет `ORGANIC` id; классификация грубая | Bitrix |
| `channel` | Частично | Lead | derived from `SOURCE_ID` / UTM | Unknown | Да | Да как `paid_social` / `organic_other` | Нормализовать channel taxonomy | Business OS |
| `campaign` | Частично | Lead | `UTM_CAMPAIGN` (+ form/WEB) | Unknown | Да | Да | Контроль заполняемости | Bitrix → Business OS audit |
| `utm_source` | Есть | Lead | `UTM_SOURCE` | Unknown | Да | Да | Нет | Bitrix |
| `utm_medium` | Есть | Lead | `UTM_MEDIUM` | Unknown | Да | Да | Нет | Bitrix |
| `utm_campaign` | Есть | Lead | `UTM_CAMPAIGN` | Unknown | Да | Да | Нет | Bitrix |
| `utm_content` | Есть | Lead | `UTM_CONTENT` | Unknown | Да | Да (snapshot), слабо в Orders | Пробросить в Orders при необходимости | Bitrix |
| `fbclid` | Нет* | — | в select/mapping нет | — | Unknown | Нет | Если нужно — искать UF / WEB params; сейчас evidence нет | Unknown |
| `gclid` | Нет* | — | в select/mapping нет | — | Unknown | Нет | То же | Unknown |
| страна | Есть | Lead UF | `UF_CRM_1737995147` | Unknown | Да | Да | Нет | Bitrix |
| язык | Нет* | — | не используется | — | Unknown | Нет | Добавить UF / не подтверждено | Unknown |
| интересующий продукт | Частично | Lead? / Deal productrows | на Lead не тянется; продукт берётся из Deal productrows | Unknown | Productrows — да | Только на Deal | Решить: UF на Lead или только Deal | Bitrix (Deal) / Business OS |
| ответственный | Есть | Lead + User | `ASSIGNED_BY_ID` → `user.get` | Unknown | Да | Да | Нет | Bitrix |
| `customer_key` | Нет | Contact TBD | mapping: `CONTACT_ID or phone/email hash` | — | Contact API не используется | Нет (`""`) | Подключить Contact | Business OS (ключ) + Bitrix (сырьё) |
| статус | Есть | Lead | `STATUS_ID` (исключения: spam=`1`, reviews=`3`) | Unknown | Да | Да | Уточнить полный словарь статусов | Bitrix |
| дата конверсии | Частично | Deal link | через `deal.LEAD_ID` + даты сделки/оплаты; отдельного lead conversion field нет | Unknown | Да косвенно | Частично | Считать в OS по связке Lead→Deal→Paid | Business OS |
| дата потери | Частично | Lead status / Deal `F` | отдельного loss date на Lead нет в интеграции | Unknown | Unknown | Нет как lead field | Для lost deals есть semantic `F` + `CLOSEDATE` (если заполнен) | Unknown / Business OS |

\*«Нет» = нет evidence в текущей схеме/интеграции; не утверждаем, что поля физически отсутствуют в портале.

**Оценка покрытия лидов: ~70%** (ядро есть; identity/click-ids/язык/конверсия — дыры).

### 3.2 Сделки

| Поле | В Bitrix | Сущность | Поля | Fill-rate | API | В интеграции | Доработать | SSOT |
|------|----------|----------|------|-----------|-----|--------------|------------|------|
| `deal_id` | Есть | Deal | `ID` | Unknown | Да | Да (= order_id) | Нет | Bitrix |
| сумма | Есть | Deal | `OPPORTUNITY` + `UF_CRM_1739982211` | Unknown | Да | Да | Развести quote/invoice/paid amount | Bitrix |
| стадия | Есть | Deal | `STAGE_ID`, `STAGE_SEMANTIC_ID` | Unknown | Да | Да | Словарь стадий воронки «Продажа» | Bitrix |
| история стадий | Частично | Stage History | `crm.stagehistory.list` | Unknown | Да | Только `STAGE_ID=1` | Тянуть полную историю | Bitrix (события) / Business OS (таймлайн) |
| дата создания | Есть | Deal | `DATE_CREATE` | Unknown | Да | Да | Нет | Bitrix |
| дата изменения | Unknown | Deal | `DATE_MODIFY` не select’ится | — | Обычно да в Bitrix | Нет | Добавить в select | Unknown |
| дата закрытия | Есть | Deal | `CLOSEDATE` | Unknown | Да | Да (paid_at при `S`) | Проверить заполненность на `F` | Bitrix |
| причина проигрыша | Нет* | — | в коде нет UF/REASON | — | Unknown | Нет | Завести UF / стандартное поле и тянуть | Unknown → Manual/Bitrix |
| причина победы | Нет* | — | нет | — | Unknown | Нет | То же | Unknown |
| товары сделки | Есть | Product Row | `PRODUCT_ID/NAME/QTY/PRICE` | Unknown | Да | Да | Multi-product → Orders | Bitrix |
| валюта | Есть | Deal | `CURRENCY_ID` | Unknown | Да | Да (default EUR в mapper если пусто) | Не полагаться на default | Bitrix |
| ответственный | Есть | Deal + User | `ASSIGNED_BY_ID` | Unknown | Да | Да | Нет | Bitrix |
| источник | Есть | Deal/Lead | `SOURCE_ID`, UTM | Unknown | Да | Да | Нет | Bitrix |
| `customer_key` | Нет | — | TBD | — | — | Нет | Contact bridge | Business OS |

**Оценка покрытия сделок/продаж: ~78%.**

### 3.3 Контакты

| Поле | В Bitrix | Сущность | Поля | Fill-rate | API | В интеграции | Доработать | SSOT |
|------|----------|----------|------|-----------|-----|--------------|------------|------|
| `CONTACT_ID` | Unknown* | Contact | стандартно есть в Bitrix; **не используется** | Unknown | `crm.contact.*` не вызывается | Нет | Получать через REST + связки Lead/Deal | Bitrix |
| телефон | Unknown* | Contact/Lead | не select’ится | Unknown | Обычно да | Нет | REST + нормализация | Bitrix |
| email | Unknown* | Contact/Lead | не select’ится | Unknown | Обычно да | Нет | REST + нормализация | Bitrix |
| страна | Частично | Lead/Deal UF | страны на Lead/Deal есть; на Contact — Unknown | Unknown | Частично | Да на Lead/Deal | Решить канон | Bitrix |
| язык | Нет* | — | нет evidence | — | Unknown | Нет | UF | Unknown |
| дубли | Нет | — | логика дедупа отсутствует | — | Unknown | Нет | Правила в Business OS | Business OS |
| стабильный `customer_key` | Нет | — | mapper всегда `""`; map = TBD | 0% в коде | — | Нет | `CONTACT_ID` или hash(phone/email) | Business OS |

\*Contact entity в Bitrix типовая, но **наличие и заполненность в этом портале не подтверждены** (нет вызовов, нет snapshots).

**Доказательство из conversation exports (май/июнь):** `contact_id` / `lead_id` / `deal_id` заполнены в **0%** диалогов архива. Это не Bitrix snapshot, но показывает текущий разрыв CRM↔диалоги в доступных данных.

**Оценка покрытия контактов: ~25%.**

### 3.4 Оплаты

Текущая модель оплаты = **прокси на Deal**, не Payment entity:

- paid = `STAGE_SEMANTIC_ID = S` + `CLOSEDATE` в периоде
- сумма paid = `OPPORTUNITY`
- invoice ≠ payment (разные срезы; зафиксировано в `BITRIX_METRIC_DEFINITIONS` и knownGaps)

| Поле | В Bitrix | Сущность | Поля | Fill-rate | API | В интеграции | Доработать | SSOT |
|------|----------|----------|------|-----------|-----|--------------|------------|------|
| дата оплаты | Частично | Deal | `CLOSEDATE` как proxy | Unknown | Да | Да | Подтвердить, что CLOSEDATE = money-in date | Bitrix (proxy) / Bank → Business OS |
| сумма оплаты | Частично | Deal | `OPPORTUNITY` | Unknown | Да | Да | Частичные оплаты не моделируются | Bitrix |
| валюта | Есть | Deal | `CURRENCY_ID` | Unknown | Да | Да | — | Bitrix |
| оплачено полностью | Частично | Deal semantic `S` | binary won | Unknown | Да | Да | Нет partial state | Bitrix |
| частичная оплата | Нет | — | нет | — | Unknown | Нет | Внешняя модель / банк / UF schedule | Business OS |
| `invoice_id` | Нет | — | счёт не отдельная сущность | — | Invoice API не используется | Нет | Либо smart invoice, либо `deal_id`+invoice event | Business OS |
| связь со сделкой | Есть | Deal | deal сам и есть носитель | — | Да | Да | — | Bitrix |

**Оценка покрытия оплат: ~45%.**

### 3.5 Счета

Счёт в текущей системе — **событие на Deal**, не `crm.invoice`:

1. дата `UF_CRM_1758618010118` («Выставлен счет»)
2. fallback: первый вход в стадию `STAGE_ID=1` через `crm.stagehistory.list`
3. сумма `UF_CRM_1739982211` иначе `OPPORTUNITY`
4. флаг `UF_CRM_1778244823819` объявлен, но **не используется**

| Поле | В Bitrix | Сущность | Поля | Fill-rate | API | В интеграции | Доработать | SSOT |
|------|----------|----------|------|-----------|-----|--------------|------------|------|
| `invoice_id` | Нет / proxy | Deal | нет отдельного id | — | — | Нет | Использовать `deal_id` + invoice_at как event id | Business OS |
| `created_at` | Частично | Deal UF / StageHistory | invoice date / stage enter | Unknown | Да | Да как `invoice_at` | Дожать заполнение UF | Bitrix |
| `amount` | Есть | Deal UF | `UF_CRM_1739982211` | Unknown | Да | Да | — | Bitrix |
| `status` | Частично | Deal semantic + invoice fields | derived: unpaid/invoiced/paid/lost | Unknown | Да | Да (`payment_status`) | Явная state machine в OS | Business OS |
| `paid_at` | Частично | Deal | `CLOSEDATE` if won | Unknown | Да | Да | — | Bitrix |
| `cancelled_at` | Частично | Deal `F` среди invoice set | cancelled = lost invoiced deals; отдельной cancelled_at нет | Unknown | Да | Да как count/amount | Нужна дата перехода в F из stagehistory | Business OS + Bitrix history |

Known gap (код): API-набор счетов не воспроизводит ручной отчёт 1:1.

**Оценка покрытия счетов: ~55%.**

### 3.6 Активности

| Нужно | В Bitrix (evidence) | Сущность | В интеграции | Можно получить | SSOT |
|-------|---------------------|----------|--------------|----------------|------|
| первое действие | Частично | Open Lines messages / Activity | Да (сообщения) | Да из timestamps диалога | Business OS (calc) |
| последнее действие | Частично | messages | Да | Да | Business OS |
| следующий follow-up | Нет* | Activity/Task? | Нет | Unknown без task/activity sync | Unknown |
| просроченные активности | Нет* | Activity | Нет | Unknown | Unknown |
| звонки | Нет* | Activity TYPE call | Нет | Unknown | Unknown |
| письма | Нет* | Activity email | Нет | Unknown | Unknown |
| сообщения | Есть | Open Lines / IM | Да | Да | Bitrix |
| задачи | Нет* | Task | Нет | Unknown | Unknown |
| встречи | Нет* | Activity | Нет | Unknown | Unknown |

Текущий activity sync фильтрует **только** Open Lines sessions.

**Оценка покрытия активностей: ~35%.**

### 3.7 История стадий

Требуемый путь:

`Новый → Первый ответ → Выявлена потребность → Расчет → Счет → Оплата`

| Вопрос | Evidence |
|--------|----------|
| Хранит ли Bitrix только текущую стадию? | Нет: есть `crm.stagehistory.list` (уже используется). |
| Можно ли восстановить полный путь сейчас? | **Нет из текущей интеграции**: history тянется **только** для `STAGE_ID=1` (счёт). |
| Соответствуют ли стадии CRM бизнес-стадиям выше? | **Unknown**: в коде подтверждена только стадия «Выставление счета» (`1`) + semantic `P/S/F`. Остальной словарь стадий воронки «Продажа» не задокументирован в репозитории. |
| «Первый ответ» как CRM-стадия? | В коде это **не** CRM stage, а расчёт по сообщениям (`conversation-rop-report` / `conversation-intelligence`). |

**Вывод:** Bitrix *может* быть источником событий смены стадий Deal, но Sales OS должна сама строить канонический timeline. Часть шагов (первый ответ, потребность) сейчас живут в conversation layer / AI heuristics, не в CRM stages.

### 3.8 Менеджеры

| Поле | В Bitrix | В интеграции | Считать где | SSOT |
|------|----------|--------------|-------------|------|
| `manager_id` | `ASSIGNED_BY_ID` / `user.ID` | Да | — | Bitrix |
| имя | `NAME`+`LAST_NAME` | Да | — | Bitrix |
| отдел | не select’ится (`UF_DEPARTMENT` и т.п. нет) | Нет | Unknown / HR Sheets | Unknown / Manual |
| кол-во лидов | сырьё есть | агрегат да | Business OS | Business OS |
| кол-во сделок | сырьё есть | агрегат да | Business OS | Business OS |
| кол-во оплат | proxy paid deals | агрегат да | Business OS | Business OS |
| сумма продаж | `OPPORTUNITY` paid | агрегат да | Business OS | Business OS |
| текущий pipeline | deals с semantic `P` | **не** как отдельный pipeline endpoint | Business OS (нужен active deal pull) | Business OS |
| активные сделки | можно через `crm.deal.list` filter `STAGE_SEMANTIC_ID=P` | OS universe тянет created/invoiced/paid, не полный active set | Доработать фильтр | Bitrix → OS |

SLA-поля менеджера в dashboard (`medianResponseMinutes` и т.д.) в Bitrix connector **зануляются** и наполняются из conversation/demo слоя, не из CRM.

**Оценка покрытия менеджеров: ~60%.**

### 3.9 SLA

| Метрика | Автоматически из Bitrix CRM? | Как сейчас | Почему нельзя/можно |
|---------|------------------------------|------------|---------------------|
| время первого ответа | Не из Lead/Deal полей | Из timestamps сообщений Open Lines / archive | CRM stage history этого не даёт в текущей схеме |
| среднее время ответа | То же | `conversation-intelligence.summarizeDialogs` | Нужны сообщения + роли |
| время до расчета | Нет отдельного поля | Text NLP (`hadFullCalculation`) / будущий stage | Нет подтверждённой CRM-стадии «Расчет» |
| время до счета | Частично | `invoice_at` − `deal.DATE_CREATE` / lead create | Можно считать в OS при связке |
| время до оплаты | Частично | `CLOSEDATE` − create/invoice | Proxy; не банковская дата |
| время на каждой стадии | Потенциально да | **Не реализовано** (history только stage=1) | Нужен полный `crm.stagehistory.list` |

**Оценка покрытия SLA: ~40%** (сообщения дают response SLA; stage SLA — недостроен).

### 3.10 Pipeline

| Метрика | Что даёт Bitrix | Что считать в Business OS |
|---------|-----------------|---------------------------|
| active pipeline | текущие Deal `STAGE_SEMANTIC_ID=P` + `OPPORTUNITY` (API способен; полный active pull не сделан) | агрегация, фильтры, срезы |
| weighted pipeline | нет probability model в интеграции | веса стадий / ML |
| вероятность оплаты | нет | AI / historical conversion |
| прогноз месяца | нет | Growth Intelligence / Digital Twin / FOS |

В UI уже есть weighted forecast и probability — это **Business OS / AI**, не Bitrix.

**Оценка покрытия pipeline: ~50%.**

### 3.11 Конверсии

| Воронка | Можно считать? | Условие | Где считать |
|---------|----------------|---------|------------|
| Lead → Deal | Частично | нужен заполненный `deal.LEAD_ID` (select есть; fill Unknown) | Business OS |
| Deal → Invoice | Да | invoice UF / stage history | Business OS на Bitrix events |
| Invoice → Payment | Да (proxy) | won+CLOSEDATE среди invoiced | Business OS |
| Lead → Payment | Частично | Lead→Deal link + paid | Business OS |
| Deal → Payment | Да | semantic S | Business OS |
| Payment → Repeat | Нет | нет `customer_key` / Contact | Business OS после identity |

**Оценка покрытия конверсий: ~55%.**

### 3.12 Причины потерь

| Нужно | Evidence |
|-------|----------|
| Отдельные CRM-поля причины | **Не найдены** в коде/mapping |
| Только статус проигрыша | Да: `STAGE_SEMANTIC_ID=F`; cancelled invoices = lost среди invoice set |
| причина | Нет в CRM-интеграции; в диалогах — NLP (`lossReasons`: цена/доставка/сроки/интерес) |
| комментарий | Нет |
| дата | Частично через CLOSEDATE / неизвестный stagehistory enter-to-F |
| автор | Нет |

**Оценка покрытия причин потерь: ~20%** (CRM) / качество текста — AI layer.

### 3.13 Переписки

| Вопрос | Evidence |
|--------|----------|
| Хранит ли Bitrix сообщения? | Да (Open Lines / IM) |
| Время сообщений? | Да (`date`) |
| Автор? | Да (`author_id` / users; роль manager/client) |
| Уже тянем? | Да, двумя путями (IM recent/sessions + CRM activities) |
| Первое сообщение менеджера | Да, считается в OS |
| Последнее сообщение клиента | Да, можно |
| Количество сообщений | Да |
| Момент прекращения диалога | Частично: last message timestamp; явного close reason в archive нет |
| Связь dialog→lead/deal/contact в archive exports | **0%** fill в доступных JSON |

Архивные outcomes в raw export почти все `unknown`; orderConversion в snapshot считается эвристиками gift-ai / text markers, не CRM sale field.

**Оценка покрытия переписок как event source: ~75%** (текст есть; CRM-linkage слабый).

---

## 4. Что Bitrix НЕ сможет дать (или не должен)

Даже при идеальной CRM-настройке эти вещи — зона Business OS / AI / Manual:

| Capability | Почему не Bitrix |
|------------|------------------|
| AI-анализ качества продажи | Gemini / conversation-intelligence |
| Вероятность покупки (predictive) | Модель на исторических конверсиях |
| Прогноз выручки / выполнение плана | Growth Intelligence, Twin, FOS |
| Рекомендации менеджеру | AI + playbooks + training |
| Прогноз загрузки отдела | capacity model (HR/production/sales) |
| Необходимые лиды для плана | план + конверсии + AOV (Planning Layer) |
| QL как маркетинговая метрика | сейчас SSOT = Google Sheets |
| Ad spend / CPL / ROAS | Google Sheets + GA4 |
| Production / delivery / shipment | Sheets manual columns |
| Bank cash-in truth | Bank source в snapshot rules |
| Стабильный customer identity / LTV / repeat | Нужен ключ; Bitrix только сырьё Contact |
| Частичные оплаты / график платежей | Нет в текущей CRM-модели |
| Канонический Order lifecycle end-to-end | Order = hybrid Deal + Sheets ops |

---

## 5. Итоговая матрица

| Сущность | Метрика / поле | Есть в Bitrix | Уже используется | Можно получить | Нужно доработать | Источник истины |
|----------|----------------|---------------|------------------|----------------|------------------|-----------------|
| Lead | id / created / status / assignee | Да | Да | Да | Нет | Bitrix |
| Lead | source / UTM* | Да | Да | Да | Контроль fill + taxonomy | Bitrix |
| Lead | country | Да (UF) | Да | Да | Нет | Bitrix |
| Lead | language / fbclid / gclid | Нет evidence | Нет | Unknown | Поиск UF / отказ | Unknown |
| Lead | customer_key | Нет | Нет | Через Contact | Да | Business OS |
| Deal | id / amount / stage / dates / currency / products | Да | Да | Да | Полный active pipeline pull | Bitrix |
| Deal | stage history full | Да (API) | Частично (только счёт) | Да | Тянуть все стадии | Bitrix → OS timeline |
| Deal | win/loss reason | Нет evidence | Нет | Unknown | UF + REST | Unknown / Manual |
| Contact | CONTACT_ID / phone / email | Unknown (не интегрировано) | Нет | Вероятно да через REST | Да | Bitrix (сырьё) |
| Contact | duplicates / customer_key | Нет | Нет | Частично | Правила дедупа | Business OS |
| Invoice | event date/amount | Да (UF+stage) | Да | Да | Использовать flag UF; выровнять с ручным отчётом | Bitrix |
| Invoice | invoice entity id/status machine | Нет | Proxy | Опционально smart invoice | Решить модель | Business OS |
| Payment | paid date/amount full | Proxy Deal won | Да | Да как proxy | Банк/partials | Bitrix proxy / Bank |
| Payment | partial / schedule | Нет | Нет | Unknown | Внешняя модель | Business OS |
| Activity | Open Lines messages | Да | Да | Да | Связка с Lead/Deal/Contact | Bitrix |
| Activity | calls/emails/tasks/meetings/follow-ups | Unknown | Нет | Unknown | Расширить activity sync | Unknown |
| Manager | id/name | Да | Да | Да | — | Bitrix |
| Manager | department | Нет evidence | Нет | Unknown | UF/department API | Unknown |
| Manager | KPI counts/revenue | Сырьё да | Агрегаты да | Да | — | Business OS |
| SLA | first/avg response | Из сообщений | Да (OS) | Да | Линковка к CRM entity | Business OS |
| SLA | stage dwell / time-to-invoice/pay | Частично | Слабо | Да после full history | Да | Business OS |
| Pipeline | active amounts | Да | Частично | Да | Active deal sync | Bitrix + OS |
| Pipeline | weighted / probability / forecast | Нет | OS/AI UI | Нет из Bitrix | Модели | AI / Business OS |
| Conversion | Lead→Deal→Invoice→Pay | Частично | Агрегаты | Да при связках | Identity + LEAD_ID fill | Business OS |
| Conversion | Repeat | Нет | Нет | Нет без customer_key | Identity layer | Business OS |
| Loss reason | CRM structured | Нет evidence | Нет | Unknown | UF | Manual / Bitrix |
| Loss reason | from chat text | Proxy | Да (NLP) | Да | Качество модели | AI |
| Quality / AI coaching | — | Нет | Gemini/ROP | — | — | AI |
| Production/Delivery | — | Нет | Sheets manual | — | — | Manual / Sheets |

---

## 6. Проблемы → решения

| # | Проблема | Решение |
|---|----------|---------|
| 1 | Нет `customer_key` | Получать `CONTACT_ID` (+ phone/email) через REST; канонический ключ считать в Business OS |
| 2 | Contact/Company не интегрированы | Добавить `crm.contact.get/list` в connector; не делать Contact SSOT для финансов |
| 3 | Счёт = UF на Deal, не Invoice entity | Оставить Bitrix event-model; в OS хранить `invoice_event` с id=`dealId@invoiceAt` |
| 4 | `BITRIX_INVOICE_FLAG_FIELD` не используется | Либо включить в select/фильтр, либо удалить из контракта после проверки на портале |
| 5 | Stage history только для стадии счёта | Расширить `crm.stagehistory.list` на все стадии category 0; строить timeline в OS |
| 6 | Нет словаря стадий воронки | Один раз выгрузить `crm.dealcategory.stage.list` / statuses (live) и зафиксировать map бизнес-стадий |
| 7 | Оплата = CLOSEDATE proxy | Зафиксировать правило SSOT; сверка с банком в snapshot reconciliation |
| 8 | Частичные оплаты невозможны в модели | Считать во внешней модели (Bank / payment schedule), не ждать от Bitrix |
| 9 | Причины потерь только semantic F / NLP | Добавить пользовательское поле причины + комментарий; до этого — AI из чатов (не financial SSOT) |
| 10 | fbclid/gclid/язык — нет evidence | Live field audit (`crm.lead.fields`); если нет — не выдумывать, хранить в OS из вебхуков сайта/GA4 |
| 11 | Диалоги не связаны с CRM ids в archive | При Bitrix openline sync сохранять `OWNER_ID`/`OWNER_TYPE_ID` (уже есть в activity path) в live store |
| 12 | Active pipeline не собран | REST filter `STAGE_SEMANTIC_ID=P` (+ category 0) отдельным snapshot slice |
| 13 | SLA стадии нельзя считать | После full stagehistory — calc в OS |
| 14 | Repeat / LTV | Невозможно получить из Bitrix без identity; считать в OS |
| 15 | AI/прогнозы/рекомендации | Не пытаться размещать в Bitrix; Sales OS / Twin / Gemini |
| 16 | Нет bitrix-snapshots в репо/среде | Для следующего аудита: выгрузить периоды и посчитать fill-rate UTM/country/LEAD_ID (обязательный follow-up) |
| 17 | Расхождение с ручными отчётами (knownGaps) | Не «чинить Sheets вместо Bitrix»; выровнять определения метрик и фильтры воронки |

---

## 7. Ролевая модель источников (решение)

| Класс данных | Источник истины | Комментарий |
|--------------|-----------------|-------------|
| CRM-события (lead created, deal stage, invoice event, won/lost) | **Bitrix** | Уже так в SSOT rules |
| Товары сделки, менеджер, страна CRM | **Bitrix** | Есть |
| Сообщения Open Lines | **Bitrix** | Есть |
| Order ops (production/delivery) | **Manual / Sheets** | ORDERS_MANUAL_COLUMNS |
| Customer identity / LTV / repeat | **Business OS** | Bitrix только сырьё Contact |
| Payment truth (деньги на счёте) | **Bank + Business OS** | Bitrix = commercial won proxy |
| QL, ad spend, channel economics | **Google Sheets / GA4** | Не Bitrix |
| Quality score, objections, coaching | **AI / conversation analytics** | Bitrix = raw messages |
| Forecast, weighted pipeline, plan gap | **Business OS / AI** | — |

**Ответ на главный вопрос:** Bitrix **не должен** быть единственным источником истины для всей Sales OS.  
Bitrix **должен** остаться единственным источником истины для **операционных CRM-событий** воронки. Всё, что является identity, деньгами, прогнозом, качеством и ops lifecycle — в Business OS / AI / Manual.

---

## 8. Итоговые проценты готовности

Оценки = доля необходимых атрибутов/способностей Sales OS, которые Bitrix уже покрывает *как SSOT или надёжный event source* по текущему evidence.

| Домен | Покрытие | Комментарий |
|-------|----------|-------------|
| Лиды | **70%** | Ядро + UTM/source/country; нет identity/click-ids/языка |
| Продажи (Deal core) | **78%** | Сильное ядро; слабые reason/history/active pipeline |
| Контакты | **25%** | Не интегрированы; customer_key пуст |
| Оплаты | **45%** | Proxy won-deal, нет partials/payment journal |
| Счета | **55%** | UF-событие работает; нет invoice entity |
| Активности (кроме чатов) | **35%** | Только Open Lines |
| История стадий | **40%** | API есть, интеграция узкая |
| Менеджеры | **60%** | id/name/KPI сырья; нет отдела/полноценного pipeline desk |
| SLA | **40%** | Response из чатов; stage SLA нет |
| Pipeline | **50%** | Amounts/stages да; weights/forecast нет |
| Конверсии | **55%** | Считаемы при связках; repeat нет |
| Причины потерь | **20%** | Только F + NLP |
| Переписки | **75%** | Сообщения да; CRM link слаб |
| AI / прогнозы / recommendations | **0%** | Не зона Bitrix |

### Итоговая готовность Bitrix как единственного SSOT Sales OS

**~58%**

Интерпретация:

- **Для CRM event backbone — достаточно начинать Sales OS вокруг Bitrix.**
- **Для полной Sales OS как единственного источника — недостаточно.** Нужны Business OS identity, payment reconciliation, stage timeline, loss taxonomy, и AI-слой поверх сообщений.

---

## 9. Follow-up (без изменений сейчас)

Чтобы снять статус Unknown по fill-rate и Contact/loss fields, нужен отдельный **live field audit** (не часть этого PR):

1. Вызвать `crm.lead.fields`, `crm.deal.fields`, `crm.contact.fields` на портале.
2. Выгрузить `data/bitrix-snapshots/{may,june,july-2026}.json`.
3. Посчитать % заполненности: UTM_*, country UF, `LEAD_ID`, invoice UF, `CLOSEDATE` на F/S, productrows.
4. Зафиксировать словарь стадий category 0.
5. Обновить эту матрицу колонкой fill-rate с числами.

До этого шага любые утверждения вида «UTM заполнены хорошо/плохо» были бы выдумкой — поэтому они сознательно помечены Unknown.
