# HackMeridian: что взять готовым для нашего paid-tools MCP

Проверено **25 октября 2026**. Исследованы публичные страницы организаторов, официальный resource repo, документация и исходники инструментов. Выполнены бесплатные HTTP-проверки. Во время этого исследования MVP не менялся, платные запросы не выполнялись.

## Вывод для проекта

**Платёжный протокол, кошелёк, facilitator и поставку полезных API можно взять готовыми.** Наш продуктовый слой — один MCP для агента, небольшой понятный каталог, нормальные схемы аргументов, поиск, цена до покупки, бюджет, история и результат. Уже написанное ядро сохраняем; новую платёжную инфраструктуру не строим.

Главная дополнительная находка — **MPP Router**, поставщик API с оплатой Stellar USDC через x402 или MPP. Он снимает необходимость сначала привлекать продавцов или покупать отдельные ключи Exa/Firecrawl. Это также прямое пересечение с нашей идеей: просто ещё один список платных API будет слабым отличием. Более конкретное предложение — «подключи один MCP, дай агенту бюджет, получай полезные результаты и понятные квитанции». [Router source](https://github.com/mpprouter/rozo-mpprouter), [каталог](https://apiserver.mpprouter.dev/v1/services/catalog).

Организаторы предлагают **Stellar Composed**: собрать новое решение из двух или более компонентов экосистемы; среди примеров прямо есть agent wallet + OpenZeppelin policy + x402/MPP. Для свежего проекта подходит Genesis → Composed. Это наша оценка соответствия, не предварительное решение жюри. [Build](https://www.hackmeridian.com/build).

## Что берём, а что остаётся нашим

| Задача | Готовый компонент | Решение для нашего MVP |
|---|---|---|
| Полезные платные API | MPP Router | Добавить отдельный источник каталога; начать с 3–5 синхронных операций |
| Покупка по x402 | Rail402 SDK + официальный `@x402/stellar` | Уже используем, сохраняем |
| Verify/settle и network fee | OpenZeppelin hosted x402 facilitator | Для собственных sellers использовать готовый сервис с поддерживаемым USDC |
| Пример платного seller | 57Blocks weather-x402 | Готовый testnet USDC пример вместо разработки ещё одного paywall |
| Wallet/payment UI | `stellar/x402-stellar/examples/simple-paywall/client` | Взять React/Vite flow подключения, challenge, подписи, результата |
| Passkey и правила кошелька | Smart Account Kit + OZ policies | Отдельная проверка интеграции после основного пользовательского сценария |
| Поиск/исполнение через один MCP | Raven, AgentSmith как reference | Переиспользовать подход и разрешённый код; наш каталог и пользовательский сценарий остаются своими |
| Контрактный full-stack starter | Scaffold Stellar + Registry | Нужен при работе с контрактами; работающий Node backend пересоздавать не требуется |
| MPP charge/channels | Официальный Stellar MPP SDK и demos | Готово для отдельной потребности; Router можно покупать через уже используемый x402 |
| Бюджет, повторные запросы, история | Наш durable router | Сохраняем; demo с бюджетом только в памяти будет регрессом |

Первичные источники: [x402 examples](https://github.com/stellar/x402-stellar), [OZ facilitator](https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar), [AgentSmith](https://github.com/57blocks/agentsmith-x402), [weather demo](https://github.com/57blocks/weather-x402), [Smart Account Kit](https://github.com/stellar/smart-account-kit), [Raven](https://github.com/stellar-experimental/stellar-raven), [Scaffold](https://github.com/stellar-scaffold/cli), [MPP SDK](https://github.com/stellar/stellar-mpp-sdk).

### MPP Router: проверено больше, чем лендинг

Live catalog в снимке **2026-10-25 12:15 UTC** содержит **675 endpoint-записей**, из них оператор отмечает **448 payable**, **27 verified**, 421 available-unverified и 227 unavailable. Это не 675 работающих сервисов и не 675 независимых поставщиков. Homepage ещё показывает другие числа — для импорта актуальнее API. [Live catalog](https://apiserver.mpprouter.dev/v1/services/catalog).

Независимо получены неоплаченные **402 quotes**:

| Операция и параметры | Цена в полученном ответе | Что это доказывает |
|---|---:|---|
| Firecrawl scrape, example.com | 0.002 USDC | Endpoint выдаёт Stellar pubnet payment challenge |
| Exa search, numResults=1 | 0.007 USDC | Есть действующий price quote для заданного запроса |
| OpenAI gpt-4o-mini, max_tokens=16 | 0.000011 USDC | Charge доступен на уровне challenge, несмотря на старое описание session-only |

Все три — x402 v2, `stellar:pubnet`, sponsored fees. Цены относятся к конкретным запросам и времени проверки. Доставку купленного контента мы самостоятельно не проверяли. Оператор публикует свои платные прогоны с tx hashes, результатами и refunds. [Verification records](https://github.com/mpprouter/rozo-mpprouter/blob/main/docs/verified-runs.json).

Полезные кандидаты: Firecrawl scrape, Exa search, Parallel search, Mercury contract events; также есть Anthropic, Tavily и fal. Для старта брать короткие синхронные операции с явными схемами. Проверять `payment_enabled`, `payment_status`, payment hints и свежий quote, а не только `status: active` или рекламную строку цены. Часть third-party directory оплачивается напрямую внешнему оператору. [Каталог](https://apiserver.mpprouter.dev/v1/services/catalog).

Проверены исходники Router. В обычном synchronous x402 пути порядок такой: verify → upstream → после успешного ответа settle Stellar. Есть стандартный `PAYMENT-RESPONSE`. В MPP charge оплата происходит раньше upstream, при недоставке появляется refund workflow. Async 202 идёт отдельным путём. Поэтому совместимость нашего buyer выглядит реалистично, но требует полного интеграционного прогона, включая квитанцию, неясный статус оплаты и повтор запроса. [proxy.ts](https://github.com/mpprouter/rozo-mpprouter/blob/main/src/routes/proxy.ts).

Есть готовый framework-independent payment client и пример двух инструментов `mppDiscover` / `mppCall` для Vercel AI SDK. Router — BSD-2-Clause, wallet skill — MIT; при переносе сохраняем требуемые notices. **Production Router — mainnet. Нынешнее наше демо — testnet.** Добавление адаптера и проверка реальной оплаты — следующий отдельный этап. [Пример интеграции](https://github.com/mpprouter/rozo-mpprouter/tree/main/examples/vercel-ai-sdk), [лицензия](https://github.com/mpprouter/rozo-mpprouter/blob/main/LICENSE).

### AgentSmith: готовый близкий проект у партнёра

57Blocks публикует Apache-2.0 **AgentSmith**: PostgreSQL Bazaar discovery, MCP search и отдельный Stellar facilitator. Это уже существующие поиск и оплата; имеет смысл интегрировать их или брать как reference. У них также готов browser-wallet weather seller на testnet USDC. Сайт различает доступный buyer/seller SDK и будущие discovery helpers: не считать каждый заявленный SDK workflow уже реализованным. [Код](https://github.com/57blocks/agentsmith-x402), [продукт](https://agentsmith.xyz/), [weather-x402](https://github.com/57blocks/weather-x402).

### Кошелёк, лимиты и комиссия

**Smart Account Kit** имеет React demo, passkeys, signing и context/policy SDK. Опубликованы testnet/mainnet deployments verifier и spending-limit policy. Текущая совместимая ветка Stellar SDK — 16.3.x, как в нашем pin. Но подключение UI само по себе не превращает серверный бюджет в on-chain ограничение: наш buyer должен реально подписывать и тратить через этот smart account. Совместимость delegated signer с Rail402 ещё не проверена. [Kit](https://github.com/stellar/smart-account-kit), [deployments](https://github.com/stellar/smart-account-kit/blob/main/docs/deployments-protocol-27-2026-07-09.md), [OZ policies](https://docs.openzeppelin.com/stellar-contracts/accounts/policies).

Для своего seller можно использовать `https://channels.openzeppelin.com/x402/testnet` или mainnet endpoint `https://channels.openzeppelin.com/x402`. Hosted infrastructure спонсирует network fee. Это **не бесплатная покупка Exa/Firecrawl**. У Channels есть fair-use лимиты; выбранную stable-версию и квоты уточнить при подключении. При покупке внешнего Router его settlement infrastructure уже выбрана продавцом. [Официальный guide](https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar), [Channels](https://docs.openzeppelin.com/relayer/guides/stellar-channels-guide).

Текущий локальный facilitator понадобился из-за нашего собственного DEMO asset. Для следующего сетевого демо логичнее testnet USDC и готовый facilitator; локальный вариант можно сохранить как воспроизводимое демо. Собственный токен для продукта не требуется. [Официальный quickstart](https://developers.stellar.org/docs/build/agentic-payments/x402/quickstart-guide).

## Партнёры: кто действительно указан и чем полезен

Организатор называет их **partners**. Финансовые sponsorship tiers и отдельные partner bounties не опубликованы. [Список на главной](https://www.hackmeridian.com/).

| Организация | Практическая польза для нас |
|---|---|
| Guava | Организация, portal, поиск нужного ментора, уточнение perks |
| OpenZeppelin | Smart accounts, policies, sponsored settlement |
| 57Blocks | AgentSmith, seller demos, помощь с интеграцией paid APIs |
| The Aha Company | Scaffold Stellar, Registry, разработка приложения |
| Drips | Продолжение OSS-разработки через Waves, если проект примут |
| GrantFox | Тестеры, UX feedback и соответствующие opportunities |
| Stellar Passport | Reference passkey onboarding и builder stamps |
| Trustless Work | Готовое escrow для долгих paid jobs, если понадобится позже |
| DeFindex | Возможный поставщик данных о vaults; yield не нужен в первом MVP |
| XOXNO | Lending-интеграции и данные, не обязательная платёжная зависимость |

Технические подтверждения: [Guava](https://www.growwithguava.com/), [OZ](https://docs.openzeppelin.com/stellar-contracts), [57Blocks](https://github.com/57blocks/agentsmith-x402), [Aha](https://www.theaha.co/), [Drips](https://www.drips.network/wave/stellar), [GrantFox](https://grantfox.xyz/bounties), [Passport](https://stellarpassport.xyz/docs), [Trustless Work](https://docs.trustlesswork.com/trustless-work/react-library/getting-started), [DeFindex](https://www.defindex.io/), [XOXNO](https://xoxno.com/docs/stellar-lending/overview).

Отдельные activation/community partners: De Vinci Blockchain, H.E.R.DAO, CryptoDays, 42Blockchain, LayerX, Open Builders, WebZero, KRYPTOSPHERE, Agentic Engineering, Encode Club, The Nest by NEAR и touchgrass. Их роль — мероприятия и сообщества; из логотипов не следует наличие технических призов. [Partner program](https://www.hackmeridian.com/yourway-partner), [главная](https://www.hackmeridian.com/).

### К кому подойти на площадке

| Человек | Конкретный предмет разговора |
|---|---|
| Leo Meng, 57Blocks | AgentSmith endpoints, готовые sellers, интеграция и отличие нашего продукта |
| Shawn Yu / ROZO | MPP Router: рекомендуемые синхронные endpoints, receipt/retry, подключение Stellar buyer; roster также использует имя Shawn Muggle |
| Tyler van der Hoeven, SDF Frontier Lab | Минимальный agent payment flow и подходящая модель полномочий |
| Pamela Selle / Willem Wyndham, Aha | Актуальные Scaffold/Registry версии и reusable frontend |
| Boyan Barakov, OpenZeppelin | Совместимые account/policy версии и интеграция x402 signer |
| Pablo Mora, GrantFox / Jason Efstathiou, Drips | Тестирование продукта и дальнейшая OSS-программа |

Это рекомендации по опубликованным ролям; люди не обещали выделенное время нашей команде. [Менторы](https://www.hackmeridian.com/mentors), [смены](https://www.hackmeridian.com/schedule/mentors), [спикеры](https://www.hackmeridian.com/speakers).

## Все публичные материалы для хакеров

Создан [отдельный индекс](hackmeridian-research/resource-index.md): **41 Markdown-файл, 20 тематических разделов, 684 ссылки / 568 уникальных адресов** из официального ecosystem-resources, плюс страницы мероприятия и найденные готовые проекты. Глубокая проверка сконцентрирована на зависимостях нашего MVP; индекс не означает аудит каждого внешнего проекта. [Официальный resource repo](https://github.com/stellar/ecosystem-resources).

Главные входы с сайта: Platform Onboarding, Judging Insights, Ecosystem Resources, Raven и Stellar Build. Полные транскрипты двух обучающих видео получить не удалось; проверены ссылки и метаданные. Ограничения submission-video из длительности этих роликов не выводим. [Build resources](https://www.hackmeridian.com/build).

Есть готовые workshop packages: **Connect Wallet** (React/Svelte/vanilla examples, slides/script), **Guestbook** (full dApp, starter, slides, video), **KALE**, **KaleFail**, **Stellar Quest**. Это библиотека материалов, включая старые занятия, а не подтверждённые записи сегодняшних выступлений. [Connect Wallet](https://github.com/stellar/ecosystem-resources/tree/main/connect-wallet), [Guestbook](https://github.com/stellar/ecosystem-resources/tree/main/guestbook), [KALE](https://github.com/stellar/ecosystem-resources/tree/main/kale), [KaleFail](https://github.com/stellar/ecosystem-resources/tree/main/kalefail), [Quest](https://github.com/stellar/ecosystem-resources/tree/main/stellar-quest).

Для разработки уже есть **Raven** (`search` + `execute`, OAuth) и бесплатный Docs MCP без sign-in. У Raven проверены публичные health endpoints и прочитана архитектура: поиск по каталогу и исполнение через host adapters. Не нужно писать собственный Stellar docs crawler. `stellar-build` — набор 46 developer skills, не готовый runtime приложения; installer меняет среду, в исследовании его не запускали. [Raven architecture](https://github.com/stellar-experimental/stellar-raven/blob/main/ARCHITECTURE.md), [Docs MCP / AI guide](https://github.com/stellar/ecosystem-resources/tree/main/building-with-ai), [stellar-build](https://github.com/kaankacar/stellar-build).

### Обнаруженные устаревания

- Старые guestbook recordings используют passkey-kit / Launchtube / Mercury Zephyr. Актуальный путь — Smart Account Kit / OZ accounts / Channels. [Предупреждение tutorial](https://github.com/stellar/ecosystem-resources/tree/main/guestbook).
- Один linked x402 browser starter ещё описывает Base/Viem в README. Для нас надёжнее canonical `stellar/x402-stellar`. [Старая ветка](https://github.com/ElliotFriend/x402/tree/stellar-browser-wallet-example/examples/typescript/fullstack/browser-wallet-example), [canonical](https://github.com/stellar/x402-stellar).
- Scaffold README и docs расходятся по generated structure и командам запуска. Использовать инструкции выбранного release и сгенерированного проекта; актуальный Registry — `rgstry.xyz`. [CLI](https://github.com/stellar-scaffold/cli), [docs](https://developers.stellar.org/docs/tools/scaffold-stellar).
- Perch помечен design phase; не брать его как готовый cumulative budget policy. BlockSmith — private beta, некоторые функции только planned. [Perch](https://github.com/stellar-registry/perch), [BlockSmith](https://www.blocksmith.co/).
- Eunomia имеет опубликованный mainnet beta deployment, но внешний audit и ряд возможностей ещё не завершены. Nirium — альтернативный wrapper с experimental policy и ограниченным доступом к treasury autonomy. Изучать можно, замена нашего рабочего ядра сейчас не даёт очевидной выгоды. [Eunomia deployment](https://github.com/eunomia-finance/eunomia/blob/main/DEPLOYMENT.md), [Nirium](https://github.com/nirium-protocol/nirium).

## Практические сроки, judging и подача

**Дедлайн: понедельник 26 октября, 12:00 по Лиссабону; late submissions не принимаются.** Нужны demo video, pitch deck, GitHub и ответы заявки. Веса: alignment 20%, user value 20%, execution 15%, innovation 15%, progress 10%, market 10%, UX 10%. Приоритет: adoption → discovery → continuation. Поэтому демонстрация полезной покупки и понятный README важнее количества подключённых SDK. [Build](https://www.hackmeridian.com/build).

Команда — до пяти человек, формат очный. AI разрешён с атрибуцией. Сторонние код, инструменты и assets нужно указывать; правильно лицензированная работа допускается. [FAQ](https://www.hackmeridian.com/faq), [портал](https://app.hackmeridian.com/), [Code of Conduct §10](https://app.hackmeridian.com/code-of-conduct), [Terms](https://www.hackmeridian.com/terms.html).

Полезные сессии **25 октября, Lisbon local**:

| Время | Сессия |
|---|---|
| 13:30–13:50 | Kaan Kaçar — AI tooling |
| 14:00–14:20 | Briana Wylde — RAVEN 101 |
| 14:30–14:50 | Wlademyr Mendes — Win a Hackathon |
| 15:00–15:20 | Elliot Voris — Mainnet readiness |
| 15:30–16:00 | Boyan Barakov — Confidentiality |
| 16:10–16:25 | Leo Meng — From Build to Earn on Soroban |
| 16:35–17:05 | Pamela Selle / Willem Wyndham — Scaffold. Registry. |

26 октября 12:05 — Drips / GrantFox post-hackathon pathways, уже после сдачи. [Расписание](https://www.hackmeridian.com/schedule).

Точный лимит видео, шаблон deck, поля формы и требование mainnet в открытых материалах не подтверждены. Портал просит вход; закрытые resources/perks не просмотрены. Это вопросы к порталу/организаторам, а не основание придумывать требования. Публичный контакт: meridian@growwithguava.com; сообщений не отправляли. [FAQ](https://www.hackmeridian.com/faq), [портал](https://app.hackmeridian.com/).

## Призы, credits и продолжение

Общий фонд **$30,000 на шесть победителей**, выплата эквивалентом XLM; распределение по победителям публично не подтверждено. Отдельных sponsor bounties и пакета cloud/LLM/API credits в просмотренных открытых источниках не найдено. [Главная](https://www.hackmeridian.com/), [FAQ](https://www.hackmeridian.com/faq).

Готовые бесплатные возможности — testnet assets и hosted network-fee sponsorship с ограничениями. Drips Wave 10 уже закрылась 22 октября, действующую награду команде не обещает. SCF Awards показывает следующий deadline **8 ноября 2026**, но это отдельный отбор и milestones. GrantFox полезен для тестеров и feedback opportunities. [Payments guide](https://github.com/stellar/ecosystem-resources/tree/main/agentic-payments), [Drips](https://www.drips.network/wave/stellar), [SCF Awards](https://communityfund.stellar.org/awards), [GrantFox](https://grantfox.xyz/bounties).

## Конкретная следующая сборка

1. **Сохранить нынешний router/MCP:** поиск, descriptors, quotes, durable budget, idempotency, receipts/history.
2. **Сделать один законченный сценарий:** агент ищет информацию, выбирает подходящий инструмент, видит цену, получает полезный результат в пределах бюджета.
3. **Подключить поставку:** опциональный MPP Router adapter с 3–5 явными schemas; полный цикл и retry проверить до обещания поддержки. Mainnet держать отдельным от testnet demo.
4. **Собрать UI на готовом x402 wallet flow:** подключение, баланс/бюджет, каталог, quote, результат, tx. Не пересоздавать backend под Scaffold без необходимости контрактов.
5. **Привести testnet demo к USDC + hosted facilitator**, сохранив локальный воспроизводимый путь.
6. **Если основной flow готов — добавить on-chain delegation** через Smart Account Kit/OZ после проверки signer. Не смешивать серверный cap с wallet-enforced policy.
7. **Подготовить сдачу:** полезный результат, отказ из-за бюджета, повтор без двойной оплаты; README с архитектурой, вкладом команды, attribution и ограничениями.

Это инженерный план по результатам исследования. Дополнительно реверсить закрытый backend Frames для такой сборки не требуется: готовых открытых интерфейсов, исходников и примеров достаточно.

## Подробные заметки и границы проверки

- [Инструменты: версии, команды, wire protocol и ограничения](hackmeridian-research/tooling-details.md).
- [Партнёры, менторы и funding](hackmeridian-research/partners-details.md).
- [Материалы, правила и submission](hackmeridian-research/hacker-materials-details.md).
- [Полный указатель ресурсов](hackmeridian-research/resource-index.md).

Счётчики и production-статусы меняются. Метка verified в каталоге — заявление оператора. Отдельные API проверены до оплаты, исходники прочитаны; оплаченный mainnet end-to-end и совместимость smart-account signer пока не проверены. Видео не выдаются за просмотренные, закрытый портал — за исследованный. Детальные заметки содержат рабочие пути к evidence; пользовательские выводы и ссылки собраны здесь.
