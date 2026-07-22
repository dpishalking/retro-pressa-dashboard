# Traffic Health

Прозрачный health-слой Marketing Control Layer (без ML / AI).

## Traffic Health Score

Формула (веса в `01_Settings` и `src/config/marketing-os.ts`):

| Компонент | Вес (default) | Смысл |
|-----------|---------------|--------|
| Unknown (инверсия share) | 0.25 | Чем меньше unknown, тем лучше |
| Channel coverage | 0.20 | Доля classified traffic_type |
| Landing coverage | 0.15 | `landing_id != landing:unknown` |
| Revenue coverage | 0.20 | Attributed / Sales calendar revenue |
| Broken UTM (инверсия) | 0.10 | Макросы `{{ }}` в UTM |
| Freshness | 0.10 | Sync день = сегодня / вчера |

`Score = 100 × Σ(weightᵢ × componentᵢ)` где component ∈ [0..1].

`threshold_status = default_not_approved` — веса системные, не утверждённая политика.

## Статусы Score

| Score | Status |
|------:|--------|
| ≥ 75 | Healthy |
| ≥ 50 | Warning |
| < 50 | Critical |

## Где смотреть

- Сводка: `30_Marketing_Home` → block `traffic_health`
- Все DQ-метрики: `32_Data_Quality_Center`
- История: `33_Marketing_Timeline` (`traffic_health_score` и coverage deltas)

## Что не входит в Score

Spend / ROAS / CAC / forecast / Meta / GA4 / Google Ads — вне scope.
