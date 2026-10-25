# HackMeridian: готовые блоки для нашего агрегатора MCP

Проверено 25 октября 2026. Исследование первичных источников и неоплачиваемые HTTP-проверки. Секреты не создавались, транзакции не подписывались, деньги не переводились, существующий MVP не менялся. Снимки ответов лежат в `work/hackmeridian-primary/`.

## Главный результат

С нуля делать платёжный протокол, кошелёк, facilitator и поставщиков инструментов не нужно. Самое сильное новое открытие — **MPP Router**: уже предоставляет платные полезные API за Stellar USDC и отдаёт публичный каталог. Для нас это потенциальный второй источник каталога рядом с Rail402. Платежи работают также через **x402**, поэтому добавление MPP-протокола не является обязательным условием. Публичный production Router работает только на mainnet; наш нынешний MVP — testnet. Автоматически переключать его на реальные деньги нельзя. [Исходники Router](https://github.com/mpprouter/rozo-mpprouter), [публичный каталог](https://apiserver.mpprouter.dev/v1/services/catalog), [пример для агентов](https://github.com/mpprouter/rozo-mpprouter/tree/main/examples/vercel-ai-sdk).

Программа **Stellar Composed** прямо предлагает комбинировать кошельки агентов, OpenZeppelin policies, stablecoins и x402/MPP. Это официально предполагаемая стратегия сборки, а не обход требования писать новый код. Своя работа — удобный поиск, нормализованные схемы инструментов, универсальный MCP, контроль расходов, история и реальная пользовательская задача. [HackMeridian Build](https://www.hackmeridian.com/build).

## Рейтинг для нашего проекта

| Приоритет | Блок | Что забираем | Состояние и ограничения |
|---|---|---|---|
| 1 | MPP Router | Каталог и готовую поставку Exa, Firecrawl, Parallel, fal, Anthropic и др. | Public mainnet, часть каталога недоступна или не проверена; оплачиваемый результат нами не проверен |
| 1 | Rail402 SDK, уже в нашем MVP | Покупатель, бюджетный журнал, квитанции, MCP/HTTP вызовы | Уже интегрирован; не нужно заменять ради замены |
| 1 | `@x402/stellar`, `@x402/express`, `@x402/fetch` | Клиент и paywall для собственных инструментов | Готовые пакеты; testnet и pubnet; 7 decimals USDC |
| 1 | OpenZeppelin Channels x402 | Hosted verification/settlement + спонсирование комиссий | Testnet и mainnet, разные ключи; наши sellers могут использовать вместо собственного facilitator |
| 2 | Smart Account Kit | Passkey onboarding и SDK правил/политик | Реальный код и demo; пред-1.0, SDK 16.3.x, интеграция с текущим buyer потребует отдельной проверки |
| 2 | Stellar Raven | Пример `search` + `execute`, источник бесплатных ecosystem tools | Hosted remote MCP + Apache-2.0 source; не платёжный marketplace |
| 2 | Canonical `stellar/x402-stellar` | Готовый React/Vite wallet paywall, Express, facilitator | Локальный starter, обе сети; более прямой фундамент frontend, чем контрактный Scaffold |
| 3 | Scaffold Stellar | React + контракты + generated TypeScript clients | Нужен, если добавляем собственные Soroban contracts; backend с нуля пересобирать незачем |
| 3 | `@stellar/mpp` + demo | MPP charge и session channels | Есть код и testnet end-to-end demo; добавлять при конкретной потребности |
| 3 | Eunomia | On-chain bounded treasury, session keys, task/payee/month limits | MIT, mainnet beta; собственные контракты, интеграция не plug-and-play; внешний audit ещё в roadmap |
| 4 | Nirium | Готовый `x402Serve`, TS/Python/MCP/CLI | Альтернативная обёртка, не обязательна при уже работающем x402; treasury autonomy mainnet ограничена invite-only |
| 4 | stellar-build | Комплект developer skills и ecosystem research | Не готовый backend и не библиотека runtime; установка меняет агентскую среду |

## 1. MPP Router — готовая поставка инструментов

### Что независимо проверено сейчас

`GET https://apiserver.mpprouter.dev/v1/services/catalog` вернул HTTP 200 и `generated_at: 2026-10-25T12:15:44.111Z`. В массиве **675 endpoint-записей**. Поля summary: **448 payable, 27 verified, 421 available_unverified, 227 unavailable, 7 direct_settlement, 5 third_party_directory**. Это endpoint-записи, а не 675 независимых компаний. Их счётчики и `verified` — утверждения оператора, не наши успешные покупки. Снимок: `work/hackmeridian-primary/mpprouter-catalog.json`. [Живой JSON](https://apiserver.mpprouter.dev/v1/services/catalog).

`GET /x402/supported` вернул x402 v2 `exact`, `stellar:pubnet`, sponsored fees, pool и адреса отдельных операторов. Снимок: `mpprouter-supported.json`. Для Firecrawl мы отправили обычный unsigned POST с `{"url":"https://example.com"}`: сервер вернул **402**, одновременно `WWW-Authenticate: Payment ...` для MPP и `Payment-Required` для x402. Декодированный x402 quote: **20000 base units = 0.002 USDC**, pubnet USDC SAC `CCW67...JMI75`, `areFeesSponsored: true`. Платёж не проводился. Файлы: `firecrawl-curl-headers.txt`, `firecrawl-curl-body.txt`.

Дополнительно unsigned curl POST Exa с `numResults: 1` вернул 402 на **70000 = 0.007 USDC**, OpenAI `gpt-4o-mini`, `max_tokens: 16` — **110 = 0.000011 USDC**. У обоих x402 v2 exact, pubnet USDC, sponsored fees. Это подтверждает только актуальную выдачу charge quote, не получение купленного результата. Evidence: `exa-curl-headers.txt`, `exa-curl-body.txt`, `openai-curl-headers.txt`, `openai-curl-body.txt`.

Ранние запросы Python urllib получили Cloudflare 1010, обычный curl получил корректный 402. Это разница транспорта/WAF, не доказательство неработающего продукта.

### Практически интересные записи

| ID | Операция | Цена, которую сейчас рекламирует каталог | Статус оператора |
|---|---|---|---|
| `firecrawl_scrape` | POST `/v1/services/firecrawl/scrape` | $0.002/request | verified charge |
| `exa_search` | POST `/v1/services/exa/search` | $0.007–$0.015 dynamic | verified charge |
| `parallel_search` | POST `/v1/services/parallel/search` | $0.010/request | verified charge; `status: limited` из-за отсутствия llms.txt |
| `fal_flux_schnell` | POST `/v1/services/fal/flux_schnell` | $0.003/request | verified charge |
| `anthropic_chat_completions` | POST `/v1/services/anthropic/chat_completions` | dynamic | verified charge |
| `tavily_tavily_search` | POST `/v1/services/tavily/tavily_search` | $0.09 basic / $0.16 advanced | verified charge |
| `mercury_events_by_contract` | GET `/v1/services/mercury/events/by-contract` | $0.001/request | verified charge, operator-direct settlement |

Для цены при покупке авторитетен свежий 402 quote с известными asset/network/payee и нашим потолком, а не строка цены. Не парсить первое число из диапазона как гарантированную стоимость. [Каталог](https://apiserver.mpprouter.dev/v1/services/catalog).

### Доказательства оператора отдельно от нашей проверки

В [docs/verified-runs.json](https://github.com/mpprouter/rozo-mpprouter/blob/main/docs/verified-runs.json) есть результаты реальных платных прогонов, tx hashes, ошибки и refunds. Снимок: `mpprouter-verified-runs.json`. Например, Firecrawl последний опубликованный pass: `2026-10-24T22:02:33Z`, HTTP 200, 0.002 USDC, tx `0d920ff7b35855f1b63357adc4a9910bca6c39f0b2517af7f20ebc6c6068d342`; Exa: `22:02:13Z`, 0.007 USDC, tx `1586a0899953a08c4b4daf52906efd47a260b4c941eeb7fa0cf93be907fd2515`. Эти опубликованные записи повышают уверенность, но мы самостоятельно не получали купленный контент и не подтверждали все транзакции explorer/RPC.

### Как брать готовое

В repo есть framework-independent `src/mpp-x402.ts` и обёртка `src/tools.ts` для Vercel AI SDK. Два инструмента: `mppDiscover`, `mppCall`. Предел на вызов, общий бюджет, резервирование перед конкурентными вызовами, проверка origin, asset, payee, обработка оплаченой ошибки уже показаны. Это исходник для сверки wire format, **не повод выбрасывать нашу durable SQLite/idempotency реализацию**. В demo бюджет живёт в closure процесса. [Payment core](https://github.com/mpprouter/rozo-mpprouter/blob/main/examples/vercel-ai-sdk/src/mpp-x402.ts), [tools](https://github.com/mpprouter/rozo-mpprouter/blob/main/examples/vercel-ai-sdk/src/tools.ts).

Команды из README, здесь не выполнялись:

```bash
cd examples/vercel-ai-sdk
npm install
npm run demo:free
# demo:paid и demo:agent требуют реального mainnet кошелька и тратят деньги.
```

Полный агент дополнительно использует свой model API key; покупаемые инструменты не требуют отдельных vendor keys. [Demo README](https://github.com/mpprouter/rozo-mpprouter/blob/main/examples/vercel-ai-sdk/README.md).

Наш адаптер должен читать `payment_enabled`, `payment_status`, `payment_hints`, `live_status`, сеть и вид расчётов. **`status: active` не равен payable**: status здесь также отражает полноту upstream docs. В demo source фильтр только `status !== unavailable` недостаточен для текущей формы каталога. Для хакатонного демо сначала whitelist 3–5 проверенных charge endpoints, явные схемы аргументов и динамический quote. Полный импорт 675 строк без нормализации даст плохой продукт.

В `third_party_providers` есть сервисы, которые **нельзя оплачивать через Router** (`payable_through_router: false`): там указан `resource_url`, оплачиваем напрямую оператору. В Proxy-каталоге Mercury использует direct settlement через router paywall. Это разные пути, объединять без проверки нельзя.

### Где источники расходятся

Главная страница ещё пишет 88 providers / 489 endpoints. Wallet skill говорит, что OpenAI session-only, тогда как live `openai_chat` одновременно имеет старую `verified_mode: session` и актуальные `methods.stellar.intents: [charge]`, `payment_hints.intent: charge`, `payment_status: verified`. А новый Router README рекомендует OpenAI как первый paid call. Поэтому не надо строить eligibility по одному старому `verified_mode` и обещать весь каталог без теста. [Wallet discover skill](https://github.com/mpprouter/stellar-agent-wallet-skill/blob/main/skills/discover/SKILL.md), [Router README](https://github.com/mpprouter/rozo-mpprouter).

Router source BSD-2-Clause; wallet skill MIT. Можно переиспользовать с сохранением лицензий/notice. Refund logic уже есть, но receipt/refund — отдельное состояние; не считать upstream 500 автоматическим возвратом. [Router license](https://github.com/mpprouter/rozo-mpprouter/blob/main/LICENSE), [refund implementation overview](https://github.com/mpprouter/rozo-mpprouter#automatic-non-delivery-refunds).

### Проверка исходников wire protocol и settlement order

Скачан исходный архив main в `work/hackmeridian-primary/rozo-mpprouter-main`, код не запускался. В [src/routes/proxy.ts](https://github.com/mpprouter/rozo-mpprouter/blob/main/src/routes/proxy.ts#L1780) x402 и MPP действительно используют **разный порядок**:

- x402 branch 1780–2093: local validation + replay reservation → Soroban verify/simulation → запрос/оплата upstream → после merchant 2xx settle Stellar. Merchant failure до settlement не списывает Stellar. Settlement failure после успешного upstream может оставить доставленный ответ с unsuccessful receipt; это отдельный статус.
- MPP charge branch: inbound Stellar платёж settles до merchant call; merchant failure после него требует refund job. Поэтому общий текст «оплата всегда до доставки» или «никогда не платишь за ошибку» неверен без указания протокола.

В synchronous x402 response код на строках 2062+ формирует стандартный **`PAYMENT-RESPONSE`**: base64 JSON с `success`, `transaction`, `network`, опциональными `payer`/`errorReason`. Дополнительно есть `X-Payment-Tx`, `X-Payment-Settle-Status`. Это совпадает с базовым ожиданием нашего buyer о стандартной квитанции; совместимость полного цикла всё ещё надо проверить интеграцией. В async 202 branch (около 1978) код возвращает `handleAsyncJob` response после settlement, не проходя через тот же receipt builder. Поэтому для первого демо лучше синхронные Exa/Firecrawl, а не генерация видео с polling.

Public docs/llms.txt смешивают порядки и старые headers; текущий исходник — более точное объяснение. Нельзя объявлять готовую совместимость Rail402 с Router по одному unsigned 402. Нужны quote→sign→receipt→chain verification→idempotent retry, нормализация `payment_unknown` и раздельная обработка refunds. Уже существующий mainnet adapter сейчас не реализован.

## 2. x402 и hosted facilitator

Официальный stack: `@x402/core`, `@x402/express`, `@x402/stellar`, `@x402/fetch`. Seller: `paymentMiddleware` + `ExactStellarScheme`; buyer: wrapped fetch или низкоуровневый client. В нашем MVP первые три уже используются, `@rail402.dev/sdk` обеспечивает buyer. Переход DEMO → USDC не требует своего токен-контракта: использовать Circle testnet USDC и trustlines, получать средства через faucet. [Официальный x402 guide](https://developers.stellar.org/docs/build/agentic-payments/x402), [quickstart](https://developers.stellar.org/docs/build/agentic-payments/x402/quickstart-guide).

Вместо своего demo facilitator для собственных продавцов можно использовать OpenZeppelin:

| Сеть | Endpoint | Ключ |
|---|---|---|
| testnet | `https://channels.openzeppelin.com/x402/testnet` | [testnet/gen](https://channels.openzeppelin.com/testnet/gen) |
| mainnet | `https://channels.openzeppelin.com/x402` | [gen](https://channels.openzeppelin.com/gen) |

SDF docs подтверждают обе сети, hosted fee sponsorship и x402 v2. Coinbase public facilitator подтверждён только для testnet. Если seller — внешний Router, его facilitator выбирает seller; покупателю не надо запускать свой settlement server ради этого вызова. [Built on Stellar facilitator](https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar), [OZ facilitator source](https://github.com/OpenZeppelin/relayer-plugin-x402-facilitator).

## 3. Готовый frontend для x402

Canonical [stellar/x402-stellar](https://github.com/stellar/x402-stellar) содержит `examples/simple-paywall/client` (React/Vite), server (Express) и `examples/facilitator`. Поддерживает testnet, mainnet или обе сети в зависимости от env. Это прямой источник wallet integration и визуального challenge/sign/pay/result flow.

Документированные команды, не выполнялись:

```bash
git clone https://github.com/stellar/x402-stellar.git
cd x402-stellar
pnpm install
pnpm build
cp examples/simple-paywall/server/.env.example examples/simple-paywall/server/.env
# Далее отдельные pnpm dev в facilitator, server, client.
```

Необязательно переносить всю монорепу; можно взять flow/компоненты в наш frontend и оставить готовый backend.

Второй starter из официального guide — [ElliotFriend browser-wallet branch](https://github.com/ElliotFriend/x402/tree/stellar-browser-wallet-example/examples/typescript/fullstack/browser-wallet-example). Однако README этой ветки ещё описывает Base Sepolia, 0x address и Viem. Это реальный docs drift; для быстрого старта предпочесть canonical SDF repo, а не слепо копировать env этой ссылки. [README ветки](https://raw.githubusercontent.com/ElliotFriend/x402/stellar-browser-wallet-example/examples/typescript/fullstack/browser-wallet-example/README.md).

## 4. Smart Account Kit и OpenZeppelin policies

Готовый SDK закрывает passkeys, wallet create/connect, signing, context rules, policies, external signers, relayer и session storage. Есть рабочая React demo и env с testnet verifier/policy адресами. README прямо ограничивает текущую совместимость Stellar SDK **16.3.x**, не 17. Наш MVP pinned 16.3.0, поэтому базовая совместимость версий хорошая. `package.json` main сейчас version 0.8.0; ecosystem-guide ещё пишет 0.6.x — проверять выбранный release. [SDK](https://github.com/stellar/smart-account-kit), [package](https://github.com/stellar/smart-account-kit/blob/main/package.json).

```bash
pnpm add smart-account-kit @stellar/stellar-sdk@^16.3.0
# Локальное знакомство с полным demo:
git clone https://github.com/stellar/smart-account-kit
cd smart-account-kit
cp demo/.env.example demo/.env
pnpm install
pnpm build:all
pnpm --filter smart-account-kit-demo dev
```

Последняя команда выводится из реально существующего `demo/package.json` script `dev: vite`; остальное взято из SDK README. Не выполнялись. [Demo package](https://github.com/stellar/smart-account-kit/blob/main/demo/package.json).

Published [deployment manifest](https://github.com/stellar/smart-account-kit/blob/main/docs/deployments-protocol-27-2026-07-09.md) содержит testnet/mainnet WASM hash, WebAuthn/Ed25519 verifiers и spending-limit/threshold policies. Smart account разворачивается отдельно на пользователя, verifier/policy контракты можно переиспользовать. Самостоятельно писать verifier/контракт расходов для MVP незачем.

OpenZeppelin policy исполняется при smart account authorization, а не просто при записи числа в нашей БД. Все policies выбранного context rule должны пройти; превышение on-chain лимита отклоняет транзакцию. **Добавить passkey login и назвать наш нынешний серверный лимит on-chain policy нельзя**: buyer должен действительно тратить с этого smart account и формировать подходящую auth entry. Совместимость такого signer с Rail402/x402 пока не проверена. [Policies](https://docs.openzeppelin.com/stellar-contracts/accounts/policies), [authorization flow](https://docs.openzeppelin.com/stellar-contracts/accounts/authorization).

В SDK есть `signAuthEntry`, но browser user presence не следует требовать на каждом автономном запросе: правильный UX — человек выдаёт ограниченный signer/context, агент исполняет внутри него. Потребуется небольшой integration spike. Relayer proxy с credential остаётся на нашем сервере; `relayerUrl` не означает наличие готового публичного browser endpoint с секретом. Для самого быстрого демо оставить ограниченный отдельный classic wallet + серверный бюджет, а passkey/on-chain delegation добавить следующей итерацией.

## 5. Scaffold Stellar и Registry

[Scaffold CLI](https://github.com/stellar-scaffold/cli) реально генерирует full-stack dApp: контракты, React frontend, generated TS clients, environment configuration и build/watch/deploy. Registry публикует versioned WASM и именованные contract instances; **это registry контрактов, не каталог платных API/MCP**.

```bash
cargo install --locked stellar-scaffold-cli
cargo install --locked stellar-registry-cli
stellar scaffold init my-project
cd my-project
npm install
npm run dev
```

Registry flow из README:

```bash
stellar registry publish --wasm path/to/contract.wasm --wasm-name my-contract
stellar registry deploy --contract-name my-instance --wasm-name my-contract
stellar registry install my-instance
```

Сеть выбирается конфигом. Сейчас CLI README использует `scaffold.yml`, `app/`, `app-lib/clients`; [Stellar docs page](https://developers.stellar.org/docs/tools/scaffold-stellar) ещё показывает `environments.toml`, `src/`, `packages/` и `npm start`. Опираться на установленную версию и её generated repo. Для нашего уже работающего Node backend Scaffold не обязателен. Он полезен для отдельного policy-contract workspace или если команда решит строить contract-centered frontend.

OpenZeppelin [UI Builder](https://builder.openzeppelin.com/) генерирует формы contract methods и экспорт React app, а [Contract Wizard](https://wizard.openzeppelin.com/stellar) — код типовых контрактов. Для marketplace UX каталог/поиск/квитанции всё равно свои; UI Builder особенно полезен для внутренней панели настроек treasury. [Ecosystem guide UI Builder](https://github.com/stellar/ecosystem-resources/blob/main/openzeppelin/ui-builder.md).

## 6. MPP SDK: готово, но не обязательное расширение MVP

Официальный [stellar/stellar-mpp-sdk](https://github.com/stellar/stellar-mpp-sdk) предоставляет `@stellar/mpp` для charge и payment channels. Charge не требует отдельного facilitator; сервер проверяет/submit сам. Session: deposit on-chain → cumulative signed commitments off-chain → close/settle. Это полезно для множества дешёвых calls/streaming, не необходимо для нескольких покупок инструментов.

Актуальный README требует peer dependencies `mppx@^0.13.4` и `viem@^2.57.3` наряду со Stellar SDK. Docs example с голым `npm install @stellar/mpp mppx @stellar/stellar-sdk` может не показать всю нужную комбинацию. Есть миграция v0.7; спеку charge README называет draft. [SDK README](https://github.com/stellar/stellar-mpp-sdk#install).

В repo готовы charge demo/browser UI и полный channel E2E с выводом explorer links. [Demo instructions](https://github.com/stellar/stellar-mpp-sdk/blob/main/demo/README.md):

```bash
./demo/run.sh
./demo/run-channel.sh
# Полный жизненный цикл после сборки one-way-channel WASM:
WASM_PATH=path/to/channel.wasm ./demo/run-channel-e2e.sh
```

Это документированные команды, не выполнялись. Для real implementation нужен durable atomic replay store и сохранение последнего voucher, а не только `Store.memory`. Контракт [one-way-channel](https://github.com/stellar-experimental/one-way-channel) — уже написан; не изобретать каналы заново.

## 7. Eunomia, Nirium и Stellar CLI — альтернативы авторизации/обвязки

**Eunomia**: готовая bounded treasury, task budgets, payee whitelist/caps, rolling daily/month limits, expiring/revocable agent session key, escrow, MCP/TS package. Mainnet beta. [DEPLOYMENT](https://github.com/eunomia-finance/eunomia/blob/main/DEPLOYMENT.md) содержит factory/registry mainnet адреса и говорит о деплое 24 октября; [ROADMAP](https://github.com/eunomia-finance/eunomia/blob/main/ROADMAP.md) ещё оставляет mainnet deployment unchecked — устаревший чекбокс. По DEPLOYMENT beta deposit cap 100 USDC или 500 XLM на treasury. Внешний audit, production reputation oracle, production fiat anchor, ZK в beta не завершены. Можно интегрировать как отдельный spending backend, но не обещать готовое универсальное x402 покрытие всех продавцов: в roadmap real API directory ещё следующий шаг. [MCP README](https://github.com/eunomia-finance/eunomia/blob/main/packages/mcp/README.md).

**Nirium**: source/package с `x402Serve()` Express middleware, `initX402`, TS/Python SDK, MCP, CLI, examples. Полезный one-call seller wrapper, но добавлять второй SDK поверх уже работающего `@x402/express` необязательно. README чётко отмечает: pre-sign policy experimental; treasury autonomous mainnet execution invite-only; простой `x402Serve` сам не dedupe/rate limit. Market API требует API key. [Nirium README](https://github.com/nirium-protocol/nirium), [per-agent policy example](https://github.com/nirium-protocol/nirium/tree/main/examples/x402-policy-daily-budget).

**Stellar CLI for Agents**: существующий CLI уже работает как wallet для shell-capable агента; balance, transfers, approve/allowance, unsigned drafts, SEP-53 signatures. `stellar skill` печатает conventions, CLI 28.1.0+ нужен для новых token/skill commands. Но встроенного spend cap в CLI нет, on-chain allowance использует `transfer-from`, тогда как стандартный x402 обычно подписывает `transfer`: это не drop-in policy для любого x402 endpoint. [Agent CLI guide](https://github.com/stellar/ecosystem-resources/blob/main/agentic-payments/stellar-cli-for-agents.md).

## 8. Developer context: Raven, Docs MCP, stellar-build

Raven — готовый hosted gateway с `search` и `execute`, source [stellar-experimental/stellar-raven](https://github.com/stellar-experimental/stellar-raven), remote `https://raven.stellar.org/mcp`; OAuth. Документы, ecosystem data и skills, без paid settlement. Бесплатный Docs MCP: `https://developers.stellar.org/mcp`, без sign-in. Их можно использовать во время разработки и как архитектурные референсы, а не писать собственный Stellar docs crawler. [Building with AI](https://github.com/stellar/ecosystem-resources/blob/main/building-with-ai/README.md).

`kaankacar/stellar-build`, ссылка с hackathon site, — набор **46 skills**, curated ecosystem data и development workflow для Claude/Codex. Это не starter приложения и не обязательный dependency. Его installer настраивает skills/hooks и background learning loop; в рамках research его не запускали. Можно брать конкретные docs/знания, не менять глобальную среду ради готового каталога инструкций. [stellar-build README](https://github.com/kaankacar/stellar-build).

## Рекомендуемая сборка без переписывания MVP

1. Сохранить наш router/MCP, persistent budgets, schema validation, idempotency, run receipts. Это уже полезный свой слой.
2. Добавить каталог MPP Router как **опциональный mainnet источник**. Изначально разрешить 3–5 verified charge инструментов; schema/примеры явные, а не 675 неструктурированных строк.
3. Для быстрого UI взять canonical x402 React wallet flow, поверх него показать каталог, quote, лимит, результат и tx. Не переделывать backend под Scaffold без своей contract-задачи.
4. Собственные demo endpoints перевести на Circle testnet USDC + hosted OZ facilitator, оставив локальный facilitator как self-contained demo/offline path.
5. Отдельно проверить passkey smart account + delegated signer + наш buyer. Это более сильная композиция для judges, чем очередной paywall, но только после работающего user flow.
6. Не добавлять MPP channels, новый token, escrow/reputation/ZK/cross-chain в обязательный MVP. Уже готовая Router инфраструктура решает cross-chain supplier payment за нас; пользователю этого не нужно видеть.

Это инженерная рекомендация по наблюдаемым источникам; оплачиваемое mainnet end-to-end подтверждение остаётся отдельным следующим шагом, не выполненным в исследовании.
