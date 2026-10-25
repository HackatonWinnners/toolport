# HackMeridian 2026: партнёры, помощь и готовые блоки для paid MCP MVP

Проверено **25 октября 2026**, время и даты — Lisbon local. Исследованы официальные страницы HackMeridian и собственные сайты/документация/репозитории организаций. Регистраций, установки SDK, получения ключей, переводов и сообщений людям не было.

## Что практически полезнее всего

Для MVP агрегатора платных MCP/API на Stellar наиболее ценные контакты и зависимости: **57Blocks / AgentSmith** (готовые discovery, MCP search, facilitator и paid weather demo), **OpenZeppelin** (smart account policies и бесплатная sponsored transaction infrastructure), **Aha** (Scaffold/Registry и поддержка разработчиков), **SDF Frontier Lab** (agentic architecture), **Drips / GrantFox / SCF** (продолжение после демо). Это приоритет исследования, не обещание поддержки от этих организаций.

**Partner-specific bounties, бесплатные LLM/API credits или гарантированный грант именно нашей команде в просмотренных публичных материалах не подтверждены.** Публичный общий prize pool — $30 000, шесть победителей; платят эквивалентом XLM. Логотип партнёра не доказывает отдельный bounty. [HackMeridian](https://www.hackmeridian.com/)

## 1. Подтверждённые роли организаций

Главная использует заголовок **PARTNERS**, а не Sponsor tiers. Следующие десять названы там партнёрами. Их финансовый вклад, эксклюзивные призы и обязательства перед участниками не опубликованы. [Первичный список](https://www.hackmeridian.com/)

| Партнёр | Подтверждённая специализация | Практическое применение и ограничение |
|---|---|---|
| Guava | Организация мероприятий и ecosystem activations. Guava Global названа организатором в правилах участия | Операционные вопросы, portal, помощь с нужным ментором; не API-поставщик. [Компания](https://www.growwithguava.com/), [организатор/роли](https://www.hackmeridian.com/contribute) |
| Drips | Финансирование open source, recurring Waves за merged PR | После MVP обсудить включение OSS репозитория/issue backlog в будущие Waves. Это отбор, не автоматически заработанный грант. [Drips](https://www.drips.network/), [Stellar Wave](https://www.drips.network/wave/stellar) |
| OpenZeppelin | Soroban contracts, accounts/policies, relayer и monitoring | Готовая wallet policy и sponsored settlement вместо собственного платёжного ядра. [Stellar suite](https://docs.openzeppelin.com/stellar-contracts) |
| Stellar Passport | Passkey onboarding, Stellar wallet, on-chain nontransferable attendance/contribution stamps | Пример понятного onboarding или optional builder reputation; не готовая лицензия/репутация качества paid API. Бесплатно присоединиться. [Passport](https://stellarpassport.xyz/), [Docs](https://stellarpassport.xyz/docs) |
| The Aha Company | Stellar tooling и smart contract development; собственный сайт называет Scaffold Stellar | Ускорить dApp/UI/typed contract clients; техническая помощь по Scaffold и Registry. [Aha](https://www.theaha.co/), [Scaffold](https://github.com/stellar-scaffold/cli) |
| GrantFox | OSS contribution platform и product/UX feedback bounties | Набор тестеров и проверка onboarding после MVP. Название платформы Bounties не означает отдельный HackMeridian bounty. [GrantFox](https://grantfox.xyz/), [Bounties](https://grantfox.xyz/bounties) |
| DeFindex | Stablecoin yield infrastructure через API/SDK; PaltaLabs | Возможный будущий paid data provider для vault/strategy аналитики. Yield на остаток user budget сильно расширяет MVP и не нужен для первой оплаты. [DeFindex](https://www.defindex.io/) |
| 57Blocks | Engineering services и собственные OSS инструменты | AgentSmith прямо пересекается с нашей идеей; лучше reuse/integration и ясный дополнительный user value. [57Blocks](https://57blocks.com/), [AgentSmith code](https://github.com/57blocks/agentsmith-x402) |
| Trustless Work | Stablecoin milestone escrows без написания собственного контракта | Полезно для длинных agent jobs/approval/refund milestone workflows; лишняя сложность для дешёвого synchronous lookup. Есть API, SDK и шаблоны. [Продукт](https://www.trustlesswork.com/), [SDK](https://docs.trustlesswork.com/trustless-work/react-library/getting-started) |
| XOXNO | На официальной Stellar docs — supply/borrow modular money market | Потенциальный источник данных или финансовая интеграция после MVP, а не готовая платёжная middleware. [Stellar docs](https://xoxno.com/docs/stellar-lending/overview) |

### Отдельно: FIND YOUR WAY / ROAD TO LISBON

В HTML главной под отдельной секцией activation partners стоят: **De Vinci Blockchain, H.E.R.DAO, CryptoDays, 42Blockchain, LayerX, Open Builders, WebZero, KRYPTOSPHERE, Agentic Engineering, Encode Club, The Nest by NEAR, touchgrass**. Это региональный recruitment/activation слой; нет основания приписывать им sponsor bounty или техническую поддержку MVP на площадке. [Главная, секция FIND YOUR WAY](https://www.hackmeridian.com/)

Программа описывает workshops, founder evenings и mini-hacks. Guava предоставляет контент, registration/tracking и travel-grant infrastructure; местный партнёр — сообщество и организацию. Приём partner proposals закрывался 4 сентября 2026. В этой программе нет опубликованного универсального пакета cloud/AI credits для хакеров. [Partner program](https://www.hackmeridian.com/yourway-partner)

Адреса `/partner-program`, `/program`, `/build/mentors` не оказались рабочими самостоятельными страницами. Актуальные найденные маршруты: `/yourway-partner`, `/yourway-partner/resources`, `/schedule`, `/mentors`, `/schedule/mentors`. Footer «Program» на главной ведёт к секции Paths; это не отдельный каталог sponsor benefits. [Partner guide](https://www.hackmeridian.com/yourway-partner/resources), [Schedule](https://www.hackmeridian.com/schedule)

## 2. AgentSmith: самый близкий готовый блок и прямое пересечение

Официальный репозиторий 57Blocks разделяет:

- `bazaar/`: PostgreSQL-backed discovery API и MCP search service.
- `facilitator/`: Stellar exact verify/settle через `@x402/stellar`.
- Это независимые процессы: Bazaar не хранит payment credentials; facilitator не держит provider credentials и не исполняет платный ресурс.

Лицензия Apache-2.0. Это подтверждено опубликованным кодом/README, но самостоятельно сервисы не поднимались. [agentsmith-x402](https://github.com/57blocks/agentsmith-x402)

Собственный сайт заявляет task/capability search, разделение budget constraints и relevance, confidence ranking, sponsored fee, подпись Soroban auth entry для конкретной покупки. Сайт отдельно уточняет: SDK содержит seller payment middleware и Node buyer paid fetch; discovery helpers — future delivery, HTTP/MCP discovery пока отдельный workflow. Testnet facilitator без API key; mainnet требует seller key. Это заявления интерфейса и контракт интеграции, не наша проверка production. Веб-парсер сайт не открыл, публичный HTML получен обычным GET и сохранён в `work/agentsmith-home.html`. [AgentSmith](https://agentsmith.xyz/)

Очень подходящий reference: **57blocks/weather-x402** — METAR weather lookup по ICAO, реальная testnet USDC оплата, seller verify/settle и browser Freighter buyer; заявлены exact и experimental upto. Facilitator спонсирует XLM fee; немного XLM всё равно нужно для USDC trustline. [Готовый demo repo](https://github.com/57blocks/weather-x402)

**Рекомендация:** наш первый provider может опираться на этот пример. Дополнительная ценность продукта должна быть выше facilitator/search: один понятный MCP entrypoint, ограниченный каталог конкретной задачи, budget UX, прозрачные результаты и replay-safe execution. Это проектное предложение на базе найденных компонентов.

## 3. OpenZeppelin: кошелёк, policy, sponsored execution

Smart Accounts разделяют scope/context rules, signers и policy contracts. `spending_limit` учитывает cumulative token `transfer` в rolling ledger window; другие вызовы под этой policy отвергаются. Нельзя считать обычный per-call amount bound месячным бюджетом. Политика имеет ограничение истории 815 transfers в окне. Это релевантно частым микроплатежам. [Accounts](https://docs.openzeppelin.com/stellar-contracts/accounts/smart-account), [Policies](https://docs.openzeppelin.com/stellar-contracts/accounts/policies)

**Stellar Channels** — managed relayer с автоматической оплатой network fee. Документация прямо говорит free to use без credits/subscription, но с fair-use fee limit на API key и reset через 24 часа от первой транзакции; конкретная квота на странице не указана. URL mainnet/testnet и генерация ключей опубликованы. Изученная страница помечена development/unreleased docs: перед интеграцией проверить stable version. [Channels guide](https://docs.openzeppelin.com/relayer/guides/stellar-channels-guide)

Ссылка из HackMeridian на официальный `stellar/ecosystem-resources` ведёт к готовому **agentic payments guide**: `@x402/stellar`, `@x402/fetch`, `@x402/express`, `@stellar/mpp`; там же listed Built on Stellar / OZ x402 facilitator на testnet и mainnet с sponsored fees. Внешний budget и on-chain wallet spending cap следует согласовать. MPP sessions потенциально подходят частым вызовам, но это отдельная ветка после простого x402 MVP. [Официальный payment guide](https://github.com/stellar/ecosystem-resources/tree/main/agentic-payments)

**Рекомендация:** основной короткий путь — один testnet settlement adapter с готовым facilitator; policy вынести в явный acceptance criterion: разрешённый token/recipient, лимит, expiry, отказ до оплаты. Не собирать custom wallet/relayer с нуля.

## 4. Scaffold и инструменты разработки

Scaffold Stellar даёт Rust contracts, React/Vite frontend, typed clients, deployment/version lifecycle и registry. Это существующий OSS toolkit, не sponsor credits. Registry хранит reusable/versioned WASM и named instances. Aha имеет отдельный воркшоп «Scaffold. Registry.». [Scaffold README](https://github.com/stellar-scaffold/cli), [расписание](https://www.hackmeridian.com/schedule)

Дополнительный policy-tool **Perch** из Stellar Registry не стоит ставить на critical path: README помечает его design phase, ограничения stateless и не выражают cumulative spend cap без stateful OZ sibling policy. [Perch](https://github.com/stellar-registry/perch)

**BlockSmith** от 57Blocks: Rust-native local node/testing/deployment/resource analysis; сайт предлагает private beta. Mainnet forking и AI/pre-audit функции находятся в будущем разделе. Не обещать доступ или готовность этих функций на сегодня. [BlockSmith](https://www.blocksmith.co/)

Для AI-assisted разработки официальный linked ресурс рекомендует Raven, Stellar Docs MCP и skills. Raven объединяет docs и live ecosystem context; Docs MCP легче и не требует входа. Эти инструменты помогают собрать MVP, но не являются источником данных, которые наш пользователь обязательно должен покупать. [Building with AI](https://github.com/stellar/ecosystem-resources/tree/main/building-with-ai)

## 5. К кому подойти на площадке

Статусы ниже — публичные mentor/speaker roles и expertise tags, а не обещание выделенного времени нашей команде. Никаких сообщений не отправляли. [Mentor profiles](https://www.hackmeridian.com/mentors), [смены](https://www.hackmeridian.com/schedule/mentors)

| Приоритет | Человек / организация | Предмет разговора |
|---|---|---|
| 1 | Leo Meng / 57Blocks | AgentSmith integration, готовые seller examples, главное отличие нашего MVP |
| 1 | Tyler van der Hoeven / SDF Frontier Lab | Agentic wallet/payment архитектура, подходящий минимальный end-to-end flow |
| 1 | Willem Wyndham, Pam/Pamela Selle / Aha | Scaffold, Registry, typed clients и быстрый понятный demo |
| 1 | Boyan Barakov / OpenZeppelin, speaker | Stable policy/account release и готовый spend-limit integration |
| 2 | Shawn Yu / Rozo | Payment UX и cross-chain payer path; roster также называет Shawn Muggle, identity следует уточнить |
| 2 | Doris Hernandez / Altana | Session permissions, caps, revocation UX; опубликованный SDK по умолчанию BNB, Stellar support не подтверждён |
| 2 | Jason Efstathiou / Drips | OSS follow-up и применимость repo к Waves |
| 2 | Pablo Mora / GrantFox | Product/UX testers, bounty eligibility после прототипа |
| 2 | Joel Vargas / Trustless Work | Только если нужен asynchronous paid-job escrow |
| 3 | Nicole Adair, Elizabeth Li, Gemma Dobbs / SDF | Экосистемная поддержка, правильный funding path и владельцы следующего шага |

Вопросы в таблице — наши рекомендации. Связь Aha со Scaffold подтверждает сайт Aha; профиль Tyler показывает Director Frontier Lab. Altana публично описывает scoped agent authority, SDK/MCP и BNB-default setup; портирование на Stellar из этих материалов не следует. [Aha](https://www.theaha.co/), [Altana docs](https://docs.altana.network/)

У Rozo есть полезная конкретика: x402 payer принимает top-up USDC в том числе со Stellar, но seller payment leg поддерживает **USDC Base exact**. Это не native Stellar seller settlement. Публичная pricing: $5 minimum top-up, 1% top-up fee; отдельного free-credit пакета нет. [Rozo x402](https://checkout.rozo.ai/x402)

## 6. Сессии, которые реально помогают

Воскресенье **25 октября**, Lisbon local: 13:30 Kaan Kaçar (AI tooling), 14:00 Briana Wylde (RAVEN 101), 15:30 Boyan Barakov (Confidentiality), 16:10 Leo Meng (From Build to Earn on Soroban), 16:35 Pamela Selle + Willem Wyndham (Scaffold. Registry.). Понедельник **26 октября 12:05–12:30** — Pathways Post Hackathon, Becca Creamer (Drips) и Pablo Mora (GrantFox). Это последняя сессия **после** submission deadline 12:00; помощь по funding не должна отвлекать от сдачи. [Официальное расписание](https://www.hackmeridian.com/schedule)

Mentor schedule дополнительно публикует дневные, вечерние и overnight shifts, в отличие от обобщённого «11:00–23:00» на schedule. Имена/состав слегка менялись между получениями страницы; на месте сверить актуальную смену. [Смены](https://www.hackmeridian.com/schedule/mentors)

## 7. Деньги, бесплатное использование и продолжение

| Возможность | Что подтверждено | Чего не обещает |
|---|---|---|
| HackMeridian prizes | Общий pool $30k, 6 winners, XLM equivalent | Не зарплата команде и не набор partner bounties. [Главная](https://www.hackmeridian.com/) |
| OZ Channels | Free infrastructure с fair use; sponsored network fees | Не оплачивает покупку provider data. [Guide](https://docs.openzeppelin.com/relayer/guides/stellar-channels-guide) |
| AgentSmith testnet | Facilitator без API key, sponsored fees; опубликован demo | Не подтверждён unlimited SLA или free mainnet data. [AgentSmith](https://agentsmith.xyz/), [demo](https://github.com/57blocks/weather-x402) |
| Testnet XLM/USDC | Официальный payments guide ведёт на Stellar Lab/Friendbot и Circle faucet | Это тестовые активы, не денежный грант/production credit. [Guide](https://github.com/stellar/ecosystem-resources/tree/main/agentic-payments) |
| Drips Stellar Wave | Monthly contribution/rewards; Wave 10 закрылась 22 октября с budget $75k; при проверке active/upcoming Waves отсутствовали | Не действующий bounty на наш hackathon submission и не гарантированное включение repo. [Stellar Wave](https://www.drips.network/wave/stellar) |
| GrantFox Bounties | Product UX feedback и opportunities/rewards platform; contact `team@grantfox.xyz` | Публичная landing page не доказывает конкретную доступную награду для нашей команды. [Bounties](https://grantfox.xyz/bounties) |
| SCF Build | До $150k equivalent XLM; Open, Integration, RFP tracks; текущая страница показывает SCF #46 deadline **8 ноября 2026** и interest form/отбор | Не автоматическое продолжение приза; требуется eligibility, review и milestones. [SCF Awards](https://communityfund.stellar.org/awards) |
| Post-hackathon | FAQ обещает top projects funding pathways, mentorship, partnerships; founders day — invitation-based | Не гарантированная инвестиция/доступ всем. [FAQ](https://www.hackmeridian.com/faq) |

Partner-program travel grants — отдельная предхакатонная логистика, не бюджет разработки MVP; FAQ сообщает закрытие заявок 15 октября. Даже суммы на двух partner pages расходятся ($150–$1000 против $250–$300 + hostel), поэтому применять нужно персональное подтверждение Guava. [FAQ](https://www.hackmeridian.com/faq), [program](https://www.hackmeridian.com/yourway-partner), [guide](https://www.hackmeridian.com/yourway-partner/resources)

## 8. Предлагаемая композиция MVP

Это вывод из исследования, а не опубликованный sponsor requirement:

1. **Один пользовательский сценарий:** агент ищет конкретные данные в небольшом курируемом каталоге и покупает один подходящий результат в заданном бюджете.
2. **AgentSmith Bazaar/MCP discovery** или простой заранее известный каталог для первой демонстрации; **готовый Stellar x402 facilitator** для оплаты.
3. **OZ smart account/policy** либо явно ограниченная тестовая agent identity; budget/allowlist/expiry должны быть видимы в интерфейсе и проверяться до оплаты.
4. **Aha Scaffold** для onboarding, баланса, истории, transaction receipt и читабельного результата.
5. Собственная работа: MCP aggregator interface, provider adapters, единые result/error формы, correlation/idempotency и понятное представление «что купили и почему».
6. На демо показать успешную покупку и отказ из-за лимита; отдельно показать provider error и фактическое поведение оплаты, не обещая семантическую гарантию без реализации.

Такая композиция подходит формулировке **Stellar Composed**: в official build ideas прямо предложены agent wallet, OZ policies, stablecoin API payments через x402/MPP. Track alignment есть, но sponsor logo не заменяет показ работающего integration и user value. [Build](https://www.hackmeridian.com/build)

## 9. Что ещё получить от организаторов/менторов

- Есть ли непубличный participant perks sheet с LLM/cloud/API credits; в публичных просмотренных источниках его нет.
- Есть ли отдельные partner bounties и каковы точные eligibility/deadline; общий pool нельзя раскладывать по партнёрам самостоятельно.
- AgentSmith: какие hosted endpoints/SDK версии реально доступны сегодня, сколько живых sellers, поддержка smart-account auth и правила mainnet seller key.
- OZ: совместимые audited account/policy versions, quotas facilitator/Channels и совместимость x402 payer со smart account signature.
- Aha: актуальный путь Scaffold/Registry, namespaced testnet deployment и поддерживаемые wallet integration templates.
- SCF: соответствует ли scope aggregator/developer infra конкретному Integration/RFP track; отдельного допуска из участия в HackMeridian нет.
- GrantFox/Drips: требования к принятому OSS repo и следующая открытая Wave; не рассчитывать на funding до подтверждения.

Общий опубликованный контакт HackMeridian: **meridian@growwithguava.com**; FAQ также ведёт на developer Discord и portal. Это адрес для уточнений, сообщение не отправлялось. [FAQ](https://www.hackmeridian.com/faq)

## 10. Источники и ограничения

Рабочие organizer entrypoints: [главная](https://www.hackmeridian.com/), [Build](https://www.hackmeridian.com/build), [Schedule](https://www.hackmeridian.com/schedule), [Mentors](https://www.hackmeridian.com/mentors), [Mentor shifts](https://www.hackmeridian.com/schedule/mentors), [FAQ](https://www.hackmeridian.com/faq), [Partner program](https://www.hackmeridian.com/yourway-partner), [Partner guide](https://www.hackmeridian.com/yourway-partner/resources), [Contribute](https://www.hackmeridian.com/contribute), [Events](https://www.hackmeridian.com/events).

Events при проверке отдавал только общую страницу activations/livestreams, без полного расписания региональных мероприятий. `/mentors` и AgentSmith пришлось читать через публичный HTML GET, поскольку веб-парсер timeout; эти файлы сохранены в `work/`. XOXNO homepage вернул 403, но собственные docs доступны. Подтверждение партнёрства взято у организатора; технические возможности — у владельца инструмента; реальная работоспособность SDK и production service не проверялась в этом исследовании.
