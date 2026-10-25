# StellarPay MCP: состояние проекта и объединение с нашим MVP

Проверено 25 октября 2026. Репозитории: [`HackatonWinnners/stellarpay-mcp`](https://github.com/HackatonWinnners/stellarpay-mcp), commit `12e48fa7df62f82b33197c63a45d953c8a993255`; [`madvil2/stellar-tools-mvp`](https://github.com/madvil2/stellar-tools-mvp), commit `20483a5ceef0602ef5ce0ba220c592855a4c3a2c`.

## Решение

**Объединять имеет смысл. Основой продукта стоит сделать `HackatonWinnners/stellarpay-mcp`.** В ней уже есть приложение для продавца, SDK, клиентский CLI/bridge, работающий USDC payment path и развёрнутая инфраструктура. Наш проект полезен как источник buyer/discovery функций, обработки повторов и неизвестного результата оплаты, а также исследования экосистемы.

Переносить нужно выбранные функции и тесты. Полное объединение деревьев дублирует клиент, backend, конфигурацию, демо и хранилища, при этом не решает новую пользовательскую задачу.

## Что уже сделано в StellarPay

| Часть | Реализация |
|---|---|
| Shared core | USDC units с 7 decimals, network constants, hosted/in-process facilitator, resource server, account/trustline helpers |
| Seller SDK | `createPaidMcpHandler`, `server.paidTool(...)`, свободные и платные инструменты |
| Buyer SDK | `StellarPayClient`, x402 MCP payment handshake, per-call cap и общий session budget |
| CLI | Создание testnet wallet, получение/покупка test USDC, просмотр tools, платный call |
| Один MCP для нескольких серверов | Stdio bridge объединяет инструменты по заранее заданным URLs и разделяет общий бюджет |
| Gateway | Hono proxy, регистрация upstream MCP, цены/enabled flags, forwarding, verify → execute → settle |
| Данные и вход | Drizzle + SQLite/libSQL/Turso, wallet message sign-in, owner-only управление |
| Web | Next.js registry с фильтром, Freighter sign-in, добавление сервера, цены, revenue и call log |
| Demo provider | `ping`, `account_summary`, `dex_best_path` с реальными чтениями Horizon |
| Deployment | Vercel web, gateway и demo; Turso для hosted DB |

Подтверждение кодом: [README](https://github.com/HackatonWinnners/stellarpay-mcp/blob/12e48fa7df62f82b33197c63a45d953c8a993255/README.md), [buyer](https://github.com/HackatonWinnners/stellarpay-mcp/blob/12e48fa7df62f82b33197c63a45d953c8a993255/packages/mcp/src/client.ts), [seller](https://github.com/HackatonWinnners/stellarpay-mcp/blob/12e48fa7df62f82b33197c63a45d953c8a993255/packages/mcp/src/server.ts), [bridge](https://github.com/HackatonWinnners/stellarpay-mcp/blob/12e48fa7df62f82b33197c63a45d953c8a993255/packages/cli/src/bridge.ts), [gateway](https://github.com/HackatonWinnners/stellarpay-mcp/blob/12e48fa7df62f82b33197c63a45d953c8a993255/apps/gateway/src/app.ts), [web](https://github.com/HackatonWinnners/stellarpay-mcp/tree/12e48fa7df62f82b33197c63a45d953c8a993255/apps/web).

## Что проверено независимо

- Web возвращает HTTP 200; gateway health сообщает `ok: true`, testnet, database/facilitator ok.
- Registry возвращает один сервер Stellar Oracle и три инструмента: ping free, account_summary 0.01 USDC, dex_best_path 0.02 USDC.
- На deployed MCP прошли `initialize`, `tools/list` и бесплатный `ping`.
- Неоплаченный `dex_best_path` вернул стандартный x402 v2 MCP challenge: `stellar:testnet`, USDC SAC, `200000` units, sponsored fees. Запрос не подписывался и не оплачивался.
- Две опубликованные транзакции найдены через Horizon testnet со статусом successful. Для deployed flow `b3168b85…` — время 25 октября 12:02:02 UTC. Это подтверждает успешные on-chain transactions; новый платный end-to-end в рамках проверки не запускался.
- Локально прошли **32/32 теста** и `npm run typecheck` по всем workspace-пакетам. Зависимости установлены по lockfile через `npm ci --ignore-scripts`.

Публичные точки проверки: [web](https://stellarpay-web.vercel.app), [health](https://stellarpay-gateway-ten.vercel.app/api/health), [registry](https://stellarpay-gateway-ten.vercel.app/api/servers), [deployed transaction](https://stellar.expert/explorer/testnet/tx/b3168b851ff33fc7cd7f64d1ef336bafa2187c64c5747cf39bcb99bc5e6efb76).

## Что дополняет наш MVP

| Возможность | StellarPay MCP | Наш MVP | Решение |
|---|---|---|---|
| Seller onboarding, цены, dashboard | Есть | Нет | Сохранить StellarPay |
| USDC + hosted facilitator | Реализовано, есть deployed proof | Наш оплаченный smoke использовал DEMO | Сохранить путь StellarPay |
| Единый MCP | Bridge со списком URLs | Discovery/execution MCP | Дополнить bridge поиском и выбором tools |
| Каталоги | Собственный registry; web substring filter | Rail402 Bazaar + JSON manifest, schemas, source status | Перенести provider adapters и нормализацию |
| Quote | PaymentRequired при вызове | Отдельный `probe_tool` без покупки | Добавить удобный quote tool |
| Внешние HTTP API | Нет универсального buyer adapter | Есть HTTP и MCP targets | Добавить путь для Router/HTTP suppliers |
| Общий бюджет | В памяти процесса, concurrent reserve | Persistent SQLite spend ledger через Rail402 | Перенести persistence и states, учесть deployment |
| Повтор операции | Защита от того же payment payload в памяти gateway | Durable request idempotency и сохранённый run | Перенести request identity/result lookup |
| История | Seller calls/revenue, без полного buyer result | Run, result, payment, error, receipt | Добавить buyer history |
| MPP Router | Не подключён | Исследован, тоже ещё не подключён | Новый adapter; готовым не считать |
| On-chain spending policy | Не сделана | Не сделана | Не описывать серверный budget как контрактный |

Наши исходники: [router](https://github.com/madvil2/stellar-tools-mvp/blob/20483a5ceef0602ef5ce0ba220c592855a4c3a2c/src/router.js), [catalog](https://github.com/madvil2/stellar-tools-mvp/blob/20483a5ceef0602ef5ce0ba220c592855a4c3a2c/src/catalog.js), [MCP tools](https://github.com/madvil2/stellar-tools-mvp/blob/20483a5ceef0602ef5ce0ba220c592855a4c3a2c/src/mcp-server.js).

## Важные ограничения до объединения

### 1. Потеря ответа может освободить уже потраченный бюджет

В `StellarPayClient.callTool` при любом исключении все резервы освобождаются с `settled=false`. Если сервер уже списал деньги, а соединение оборвалось до получения receipt, локальный budget считает сумму свободной. Следующий вызов может выйти за намеренный бюджет. Это также воспроизведено локальной симуляцией: после одобрения 0.02 USDC и исключения получены `spent=0`, `reserved=0`, следующий вызов на полный бюджет разрешён. Реальные деньги не списывались, live-сбой не провоцировали.

Нужно различать `not_paid`, `paid`, `payment_unknown`; сохранять резерв при неизвестном статусе и сверять transaction/receipt. Эту модель стоит перенести из нашего buyer/router. [client.ts:150](https://github.com/HackatonWinnners/stellarpay-mcp/blob/12e48fa7df62f82b33197c63a45d953c8a993255/packages/mcp/src/client.ts#L150).

### 2. Budget и replay state не переживают перезапуски

`SpendGuard.spent/reserved` и `PaymentEngine.seenPayments` находятся в памяти. Session budget после перезапуска начинается заново; разные Vercel instances не разделяют replay Map. Это уже признано README. Локальная проверка двух экземпляров PaymentEngine подтвердила: в одном повторный claim отвергается, в другом тот же payload принимается. On-chain nonce защищает от второго settlement того же разрешения, но не заменяет запрет повторного upstream execution: при гонке оба процесса могут пройти verify и вызвать инструмент до settle.

Buyer budget должен иметь durable ledger, а gateway — атомарный claim и понятные execution/payment states в общей БД. Наш request idempotency тоже не обеспечивает универсальное exactly-once исполнение при любом crash; переносить его вместе с честными ограничениями. [SpendGuard](https://github.com/HackatonWinnners/stellarpay-mcp/blob/12e48fa7df62f82b33197c63a45d953c8a993255/packages/mcp/src/client.ts#L26), [PaymentEngine](https://github.com/HackatonWinnners/stellarpay-mcp/blob/12e48fa7df62f82b33197c63a45d953c8a993255/apps/gateway/src/payments.ts#L72), [execution order](https://github.com/HackatonWinnners/stellarpay-mcp/blob/12e48fa7df62f82b33197c63a45d953c8a993255/apps/gateway/src/proxy.ts#L149).

### 3. Нельзя просто перенести локальный SQLite backend в Vercel

Наш MVP использует `node:sqlite` и локальные файлы. У StellarPay уже правильное для serverless разделение: local SQLite и remote Turso. Для hosted state нужен существующий libSQL/Drizzle путь; для локального CLI/agent можно сохранять ledger на диске. Ключ агента остаётся у агента: создание buyer history не требует переносить секрет в web/gateway.

### 4. Автоматическая покупка HTTP API — новая интеграция

MPP Router содержит HTTP services, а gateway монетизирует MCP upstreams. Внешний платный supplier лучше вызывать buyer adapter напрямую, сохраняя один budget/receipt flow. Не стоит пропускать его как бесплатный upstream и случайно получать двойную оплату или терять платёжные headers.

Оба проекта используют x402 v2, но разные версии: StellarPay lockfile — x402 2.28.0, Zod 3; наш MVP — x402 2.27.0, Zod 4, Rail402 SDK. Поэтому переносить интерфейсы и функции в текущий TypeScript workspace, согласовав версии, а не объединять package.json целиком.

### 5. Небольшая ошибка инструкции в UI

Registry page всё ещё предлагает `npx stellarpay wallet create --usdc 5`, хотя `lib/api.ts` и README говорят, что пакет ещё не опубликован. Generated MCP config уже использует локальный путь. Надпись тоже нужно привести к текущему способу запуска до демо. [page.tsx:78](https://github.com/HackatonWinnners/stellarpay-mcp/blob/12e48fa7df62f82b33197c63a45d953c8a993255/apps/web/app/page.tsx#L78), [CLI config helper](https://github.com/HackatonWinnners/stellarpay-mcp/blob/12e48fa7df62f82b33197c63a45d953c8a993255/apps/web/lib/api.ts).

## Порядок объединения

1. Основная репа — `HackatonWinnners/stellarpay-mcp`; сохранить seller SDK, gateway, wallet setup, UI, USDC и существующий deploy.
2. Перенести актуальное исследование в `docs/research`, чтобы все работали по одному плану.
3. Добавить buyer/discovery модуль с `search_tools`, descriptor, quote, invoke, run и budget; существующий stdio CLI использовать как вход для агента.
4. Перенести durable budget, reservation/unknown states, request idempotency и тесты. Разделить локальное клиентское хранилище и hosted gateway state.
5. Подключить 3–5 полезных внешних tools; MPP Router mainnet — отдельный adapter и отдельная проверка оплаты, текущий testnet flow сохранить.
6. Доработать buyer UI/демо-сценарий: задача → поиск → цена → результат → расход/tx; затем отказ из-за бюджета и безопасный повтор.

Сейчас StellarPay ближе к MCPay: монетизация собственных MCP-сервисов и доступ к ним. Наш дополнительный слой приближает его к нужному Frames-подобному сценарию: агент находит и покупает инструмент из разных источников через одну точку входа. F1, собственная модель, новые контракты или ещё один facilitator для этого не нужны.

## Локальные проверки

Проверки выполнялись в отдельном клоне; исходники и remote репозиториев не изменялись.

- `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline` — завершено по lockfile.
- `npm test` — **32/32**, три test files: core units, paid MCP SDK, gateway.
- `npm run typecheck` — CLI, core, MCP, demo server, gateway, web проходят.
- Локальная симуляция ambiguous response loss — резерв обнуляется, новая покупка на полный бюджет разрешается; найденный риск подтверждён.
- Два локальных PaymentEngine — одинаковый payload принимается каждым отдельным экземпляром; общей replay-защиты нет.
- Deployed health, registry, MCP initialize/list/ping и unpaid price challenge — успешно.
- Freighter browser sign-in, mainnet, новая оплаченная покупка, performance/load и UI interaction не проверялись.
