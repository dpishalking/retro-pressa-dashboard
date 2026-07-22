# Marketing Home (`30_Marketing_Home`)

Главный ежедневный экран маркетолога в Traffic OS.

## Зачем

Открыть один лист утром и за ~5 минут понять:

- что требует внимания сегодня;
- health трафика;
- статус каналов / лендингов / источников;
- operational readiness (что готово, что нет).

Без графиков и без frontend — табличные блоки.

## Блоки (`block`)

| block | Содержание |
|-------|------------|
| `traffic_health` | Score + Unknown / Coverage / Linkage / Broken UTM / Freshness |
| `todays_priorities` | Rule-based список внимания (не AI) |
| `today` / `this_month` | Sync freshness и объём / attributed revenue |
| `main_changes` | Δ vs identity / enrichment baseline |
| `main_wins` / `main_problems` | Краткие победы и проблемы |
| `channel_monitor` | Каналы → Healthy / Warning / Critical / Unknown |
| `landing_monitor` | Лендинги → тот же статус |
| `source_monitor` | Источники из Source Map |
| `operational_status` | Traffic / Landing / Attribution / Forecast / Spend |
| `marketing_readiness` | Foundation → Control Ready; Spend/Planning/Forecast blocked |
| `definitions` | Definition / Source / Confidence / Owner для ключевых карточек |

## Карточка (контракт строки)

Каждая строка несёт: `definition`, `source`, `confidence`, `coverage_pct`, `owner`, `status`, `comment`.

## Как читать

1. `traffic_health` → Score и статус.
2. `todays_priorities` → что делать сегодня.
3. Monitors → где копать глубже (`18–20`, `31`, `32`).
4. `33_Marketing_Timeline` → прогресс между sync.

## Не путать

- Attributed revenue ≠ вся выручка Sales OS.
- Payment linkage по лидам может быть низким при хорошем amount coverage.
- Spend / Forecast / ROAS здесь **не подключены** (и не должны выглядеть как готовые).
