# Unknown Center (`31_Unknown_Center`)

Центр честного unknown: не «доугадываем» канал, а приоритизируем разбор.

## Сортировка

По `impact_score` (лиды + attributed revenue среди unknown):

`impact ≈ 0.6 × lead_share + 0.4 × revenue_share`

Затем по количеству лидов.

## Колонки

| Поле | Смысл |
|------|--------|
| `rank` | Порядок влияния |
| `entity_type` / `entity_id` / `entity_name` | Обычно source |
| `leads` / `lead_share_pct` | Объём unknown |
| `attributed_revenue` / `revenue_share_pct` | Деньги, уже attributed на lead, но traffic_type=unknown |
| `impact_score` | Приоритет разбора |
| `reason` | `bare_web`, `ambiguous_instagram_social`, `broken_macro`, `missing_utm`, … |
| `recommended_action` | Операционное действие (не AI) |

## Правила

- Ambiguous Instagram `social` и bare WEB **остаются unknown** до evidence.
- Broken macros → чинить UTM, не маппить в paid.
- Не перераспределять unknown в paid/organic «для красоты отчёта».

## Связь с Home

`30_Marketing_Home` → priorities / traffic_health.unknown_share → drill-down сюда.
