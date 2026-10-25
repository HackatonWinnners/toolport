# HackMeridian 2026: материалы для хакеров, правила подачи и практический план

Проверено 25 октября 2026. Только первоисточники; публичные страницы, без входа, регистрации и отправки сообщений. Ниже отделены опубликованные требования, рекомендации и неизвестные сведения.

## 1. Главное для нашего paid-MCP router

**С нуля строить не требуется.** Genesis допускает новую идею/ранний прототип, Scale — существующий продукт/продвинутый прототип. Stellar Composed прямо про сочетание двух и более существующих инструментов; среди примеров — агент с кошельком Stellar CLI, ограничениями OpenZeppelin и оплатой API по x402/MPP. Для свежего MVP наш естественный выбор — Genesis → Stellar Composed; это рекомендация по описанию проекта, а не решение организаторов. [Build](https://www.hackmeridian.com/build), [FAQ](https://www.hackmeridian.com/faq).

Использование правильно лицензированных готовых компонентов предусмотрено правилами IP. Запрещены плагиат и ложное представление своей работы. Поэтому в README стоит отдельно указать готовые библиотеки/форки и то, что реализовано именно во время мероприятия. [Terms: participation, submissions](https://www.hackmeridian.com/terms.html#submissions).

Для judging нужен не только код: опубликован набор **demo video + pitch deck + GitHub repo + ответы заявки**. README с объяснением работы и спецификацией особо выделен организаторами. [FAQ, What to submit](https://www.hackmeridian.com/faq).

## 2. Дедлайны и формат

Все часы — локальное время Лиссабона. Главный дедлайн: **понедельник 26 октября, 12:00; опоздания не принимаются**. Официальный интервал hacking: воскресенье 25 октября 09:00 → понедельник 26 октября 12:00. На сайте маркетинговое «28 hours», но указанные часы составляют **27 часов**; это арифметическое расхождение, а не основание добавлять час. [Build](https://www.hackmeridian.com/build), [Schedule](https://www.hackmeridian.com/schedule).

| Когда | Что |
|---|---|
| 25 октября, 09:00 | Открытие check-in |
| 25 октября, 11:00–11:15 | Opening ceremony |
| 25 октября, 11:15–11:30 | Partner showcase |
| 25 октября, 11:45–12:00 | Team formation + track orientation |
| 25 октября, 11:00–23:00 | Mentor support |
| 26 октября, 08:00–12:00 | Mentor support |
| 26 октября, 09:00–09:15 | Morning briefing |
| 26 октября, 09:15–12:00 | Final build sprint |
| **26 октября, 12:00** | **Submission закрывается** |
| 26 октября, 12:05–12:30 | Pathways Post Hackathon: Becca Creamer (Drips), Pablo Mora (Grantfox) |
| 26 октября, 13:00–14:45 | Judging |
| 26 октября, 14:45–15:30 | Deliberation + finalist selection |
| 26 октября, 15:30–16:00 | Closing ceremony |

Источник таблицы: [текущее публичное расписание](https://www.hackmeridian.com/schedule). Питчи финалистов — отдельный этап на Meridian, не обязательный live pitch каждого участника в понедельник. FAQ указывает **28 октября 13:50**. [FAQ](https://www.hackmeridian.com/faq).

## 3. Submission: что подтверждено, что нет

Подтверждено, что жюри асинхронно смотрит видео, презентацию, GitHub и ответы заявки. Рекомендован понятный README, описывающий устройство и спецификации проекта. [Build](https://www.hackmeridian.com/build).

**Не удалось подтвердить по открытым страницам:** точные названия обязательных полей формы, лимиты символов, длительность demo video, число слайдов, обязательный шаблон pitch deck, допустимые видеохостинги, необходимость public repo вместо private-with-access, обязательность mainnet вместо testnet, необходимость отдельного задеплоенного frontend. Отсутствие требований на публичной странице не означает, что их нет в закрытом портале или объявлении организаторов. Публичный портал сам отсылает к входу за подробным timetable/объявлениями. [Portal](https://app.hackmeridian.com/), [FAQ](https://www.hackmeridian.com/faq).

Практическая рекомендация для нас, **не дополнительное правило хакатона**:

- README: проблема, пользователь, workflow, схема интеграций, запуск, env без секретов, что готово, ограничения, демо-сценарий, какие части появились во время хакатона, используемые OSS/AI.
- Видео: один понятный успешный проход «поиск → цена → оплата → полезный результат», затем ограничение бюджета и повтор без двойной оплаты.
- Deck: пользовательская боль, решение, пользователь, почему Stellar, демонстрация, отличие и следующий шаг.
- Testnet-доказательства: explorer-ссылки и объяснение тестового токена; готовность mainnet не выдавать за выполненную.

## 4. Eligibility, existing code, AI и IP

Можно одному или командой **до пяти человек**; опыт Stellar не обязателен. Мероприятие **только очное**, удалённого формата нет. [FAQ](https://www.hackmeridian.com/faq).

Возраст — 18+ либо более высокий возраст совершеннолетия в юрисдикции участника. Регистрация сама по себе не гарантирует допуск. Собственность на созданное остаётся команде; организаторам/партнёрам даётся неисключительная всемирная безвозмездная лицензия на запись, показ, воспроизведение и распространение submission/названия команды/описания для проведения, judging и продвижения мероприятия. Работа должна быть оригинальной **или правильно лицензированной**; права и лицензии сторонних компонентов сохраняются. Секретные материалы в submission не включать. Это краткое изложение правил, не юридическая интерпретация. [Terms, §§3–6](https://www.hackmeridian.com/terms.html).

AI copilot/agent tools прямо разрешены. [FAQ](https://www.hackmeridian.com/faq). Публичный builder portal добавляет условие атрибуции: «AI tools are encouraged — just attribute them». Значит, для нас уместна короткая AI-attribution в README; конкретный формат не опубликован. [Portal](https://app.hackmeridian.com/).

## 5. Tracks, judging и призы

Genesis: Idea → MVP; Scale: Prototype → Product. У Genesis можно участвовать сразу в **Unlocked и Composed**; у Scale тематический track не выбирается. Unlocked — новое использование базовых возможностей протокола; Composed — сочетание существующих инструментов/проектов. [Build](https://www.hackmeridian.com/build).

Один rubric, каждый критерий оценивается от 1 до 5:

| Критерий | Вес |
|---|---:|
| Track Alignment (Genesis) / Ecosystem Alignment (Scale) | 20% |
| User Value & Problem | 20% |
| Technical Execution | 15% |
| Innovation | 15% |
| Hackathon Progress | 10% |
| Market & Ecosystem Potential | 10% |
| Product Design & UX | 10% |

Приоритет judging: Adoption → Discovery → Continuation. Genesis дополнительно описан через ясность проблемы, MVP, Stellar integration и потенциал продолжения; Scale — выполнение заранее согласованных milestone, SCF eligibility, production readiness и ecosystem impact. [Build, judging](https://www.hackmeridian.com/build#judging).

**Призовой фонд $30,000 на шесть победителей**, суммы в USD, выплата эквивалентом XLM. [Home](https://www.hackmeridian.com/). FAQ говорит, что финальный breakdown объявляют перед событием; конкретного распределения по местам/трекам на проверенных открытых страницах не нашлось. Не следует автоматически делить $30k поровну на шесть. [FAQ](https://www.hackmeridian.com/faq). Условия призов и eligibility могут дополняться event communications; решения жюри окончательны, налоги/сборы — ответственность получателя. [Terms, §7](https://www.hackmeridian.com/terms.html).

## 6. Официальные входы в материалы

На Build даны пять главных ресурсов:

| Ресурс | Что проверено |
|---|---|
| [Platform Onboarding](https://www.youtube.com/watch?v=dQjfykaP1G4) | Видео Guava Global, 6:49, название «HackMeridian Builder Platform Onboarding» |
| [Judging Insights](https://www.youtube.com/watch?v=oR-7PZwBevo) | Фактическое название YouTube: «Stellar Developers Meeting - 10/22/2026», SDF, 55:44 |
| [Ecosystem Resources](https://github.com/stellar/ecosystem-resources) | Официальный набор tutorials, reusable code и reference guides |
| [Raven](https://raven.stellar.org/) | Официально указанный Stellar MCP для research |
| [Stellar Build](https://github.com/kaankacar/stellar-build) | Пакет AI skills и ecosystem data, от идеи до запуска/SCF |

Источник официального списка: [Build resources](https://www.hackmeridian.com/build). Продолжительность видео подтверждена публичными YouTube player metadata, **это продолжительность обучающих роликов, не лимит submission-video**.

FAQ содержит ещё [Builder Portal Onboarding](https://www.youtube.com/watch?v=N6uBEiq9nR8), Guava Global, тоже 6:49. Это другой ID и немного другое название по сравнению с Build; нельзя утверждать, что содержимое побайтно одинаково. [FAQ](https://www.hackmeridian.com/faq).

**Содержимое видео не выдумывал:** YouTube web fetch throttled; watch/oEmbed metadata доступны; public ASR caption tracks обнаружены, но timedtext возвращает пустой ответ, get_transcript — HTTP 400. Поэтому нет подтверждённого транскрипта, точных таймкодов judging-сегмента и дополнительных требований из этих видео.

### Что уже лежит в ecosystem-resources

README прямо предлагает комбинировать и модифицировать ресурсы вместо повторного изобретения. Есть Core Toolchain, AI-tools/skills, Agentic Payments, OpenZeppelin, wallet integration, cross-chain, privacy/ZK, indexing, security и tutorials. Из готовых стартов: Scaffold Stellar (контракты + React), official soroban-examples; готовые smart accounts и relayer. Для нашего MVP сначала нужны Agentic Payments + wallet/policies, а не самостоятельное переписывание платёжного протокола. [Ecosystem Resources](https://github.com/stellar/ecosystem-resources).

### Найденные готовые workshop materials

Это **переиспользуемые материалы из официального resource repo**, не обязательно записи сегодняшних выступлений.

| Пакет | Готовые материалы и оговорки |
|---|---|
| [Connect Wallet](https://github.com/stellar/ecosystem-resources/tree/main/connect-wallet) | Script, slides; Svelte/Astro, React и vanilla JS примеры, devcontainer template; [slides](https://docs.google.com/presentation/d/1rV7jxIssbFNM8Mc60BzDrylKifl9Hz0Cl4GsOUXJY0I/edit). Исторический Launchtube помечен legacy, replacement — OpenZeppelin Relayer Channels. |
| [Guestbook](https://github.com/stellar/ecosystem-resources/tree/main/guestbook) | Полный dapp, [код](https://github.com/elliotfriend/ye-olde-guestbook), [starter](https://github.com/ElliotFriend/stellar-template-sveltekit-passkeys), [slides](https://docs.google.com/presentation/d/1FoY7_LjBVXV_sBXCd_DlBM2iHrP9P7a3xe3jFhoWF28/edit), [видео](https://youtu.be/Zl-w8e3iidU), script. README предупреждает: slides/video показывают старый passkey-kit/Launchtube/Mercury Zephyr; актуальные docs используют Smart Account Kit/OpenZeppelin Smart Account/Relayer Channels. |
| [KALE](https://github.com/stellar/ecosystem-resources/tree/main/kale) | Instructions, script, [контракт](https://github.com/kalepail/KALE-sc), [запись 14 марта 2025](https://youtu.be/v43sLBWDumA); пример asset + mining contract/smart wallet. |
| [KaleFail](https://github.com/stellar/ecosystem-resources/tree/main/kalefail) | Instructions, script, [код](https://github.com/elliotfriend/project-kalefail), [dev meeting](https://youtu.be/2XVt87tG5LI), [recording](https://youtu.be/Qmpg_aQfKGE); композиция KALE и asset SAC admin. |
| [Stellar Quest](https://github.com/stellar/ecosystem-resources/tree/main/stellar-quest) | Instructions, [Learn](https://quest.stellar.org/learn), [Side Quests](https://quest.stellar.org/side-quests). Учебный ресурс, не шаблон submission. |

### Stellar Build: полезно, но это toolkit, не работающий платный агрегатор

README заявляет 46 skills, шесть DevRel-персон, Raven, ecosystem database, стадии idea/PRD/architecture/implementation/deploy/SCF. Поддерживаются Claude Code и Codex CLI. Это ускоряет исследование и разработку; само по себе не даёт готовый Frames. Установщик меняет skills/hooks и включает локальный learning loop; в рамках этого read-only research ничего не устанавливалось. [Stellar Build](https://github.com/kaankacar/stellar-build).

В его README Raven указан как `raven.stellar.buzz`, тогда как текущий event/resource repo указывает `raven.stellar.org`; брать адрес из текущего официального ресурса и проверять docs перед настройкой. [Stellar Build](https://github.com/kaankacar/stellar-build), [official ecosystem AI references](https://github.com/stellar/ecosystem-resources#ai-tools--skills).

## 7. Воркшопы 25 октября

| Лиссабон | Тема / автор |
|---|---|
| 13:30–13:50 | Kaan I level up your AI? — Kaan Kaçar, SDF |
| 14:00–14:20 | RAVEN 101 — Briana Wylde, SDF |
| 14:30–14:50 | Speedrun: Win a Hackathon in 20 min — Wlademyr Mendes, SDF |
| 15:00–15:20 | How to prepare to go live on Mainnet — Elliot Voris, SDF |
| 15:30–16:00 | Confidentiality on Stellar — Boyan Barakov, OpenZeppelin |
| 16:10–16:25 | From Build to Earn on Soroban — Leo Meng, 57 Blocks |
| 16:35–17:05 | Scaffold. Registry. — Pamela Selle & Willem Wyndham, Aha Company |
| 17:00 | The hardest part isn't Building Anymore — Blake, Myosin; Scale Hub |

Источник: [Schedule](https://www.hackmeridian.com/schedule), свежая проверка. Воркшопы Scaffold/Registry и Myosin частично перекрываются. Публичная schedule page **не даёт отдельных replay/slides URL для этих сегодняшних сессий**. Ссылки на старые workshop assets выше не являются подтверждением replay сегодняшних выступлений.

## 8. Предварительные мероприятия и расхождения

Есть first-party [Road To HackMeridian: From Idea To Pitch от H.E.R. DAO](https://luma.com/6kjcra2t): validation, value proposition, структура трёхминутного pitch. Также [Workshop Stellar #3 от DeVinci Blockchain](https://luma.com/po151xsp): трёхминутные team demos и подготовка pitch. **Это описание подготовительных занятий; оно не доказывает официальный трёхминутный лимит видео/финального pitch.**

Обнаруженные несогласованности, которые важно не замазывать:

1. Главный сайт/FAQ публикуют дедлайн 26 октября 12:00, а публичный портал всё ещё пишет «Submission deadlines will be announced». Для планирования ориентироваться на конкретный опубликованный дедлайн. [FAQ](https://www.hackmeridian.com/faq), [Portal](https://app.hackmeridian.com/).
2. FAQ адресует ONE16 как Rua Pereira Henriques 1, портал — как R. Pereira Henriques 5. Главная сама предупреждает искать **Warehouse ONE16** по названию, а не адресу. [FAQ](https://www.hackmeridian.com/faq), [Portal](https://app.hackmeridian.com/), [Home](https://www.hackmeridian.com/).
3. «28 hours» против интервала в 27 часов — выше.
4. FAQ даёт finale 28 октября 13:50. Поисковый индекс **официального Meridian schedule** показывает Stellar Shark Tank 14:50–15:20, Tejo Stage, top HackMeridian projects + audience People's Choice. Прямое чтение Meridian schedule в этой проверке блокировалось/таймаутилось; поэтому расхождение нужно подтвердить по live schedule/организаторам, не выбирать час произвольно. [FAQ](https://www.hackmeridian.com/faq), [Meridian schedule](https://meridian.stellar.org/schedule?speaker=jaya-baloo).
5. Build и FAQ ссылаются на разные onboarding-video IDs — выше.

## 9. Короткий план применения к MVP

Рекомендации исследователя, не правила: выбрать Genesis/Composed; отметить минимум две содержательные экосистемные интеграции; использовать готовые x402/MPP и smart account/policy SDK; показать реальный полезный API за платёж; оставить search/router/каталог и удобство вызова собственной продуктовой частью; явно показать testnet status, OSS/AI attribution и hackathon delta. Сначала сверить закрытую submission form, затем записывать видео под её реальные ограничения.

## 10. Дополнительные условия из публичного Code of Conduct портала

Страница [Participant Code of Conduct, Terms & Liability Waiver](https://app.hackmeridian.com/code-of-conduct) открывается без входа (прямое HTTP-чтение; web-парсер её не прочитал). Важные дополнения:

- §10 **прямо требует credit стороннего кода, инструментов и assets**; build/demo разрешены для собственной работы или работы, которую команда имеет право использовать. Это более конкретное подтверждение необходимости атрибуции готового стека.
- §13 сохраняет владение проектом за командой и даёт организатору/спонсорам разрешение показывать и публично описывать submission. Правила eligibility/judging/payout обещают сообщить участникам отдельно; победителям могут понадобиться identity details и sanctions screening. Налоги — на победителе.
- §3: на check-in проверяют photo ID, одна регистрация на человека; передать регистрацию без письменного согласия нельзя.
- Overnight optional, first come first served; алкоголь запрещён на всей площадке, включая ночёвку.
- В тексте есть условный §9 про minors **если** мероприятие их допускает; это не отменяет публично опубликованное 18+.
- Здесь §19 указывает **право Португалии / суды Лиссабона**, тогда как основной [Terms §16](https://www.hackmeridian.com/terms.html) — Delaware. Это два разных документа с различающимися формулировками; юридический приоритет не установлен в исследовании.

Все пункты этого раздела: [Code of Conduct](https://app.hackmeridian.com/code-of-conduct). Закрытые ресурсы/perks и authenticated submission form **не осмотрены**, поскольку пользователь не авторизовывал вход/регистрацию. Конкретные детали из них не приписываются публичному сайту.

## Индекс первоисточников

- H1: https://www.hackmeridian.com/ — главное, 6 winners, валюта призов, venue warning.
- H2: https://www.hackmeridian.com/build — пути/треки, judging, resources, submission checklist.
- H3: https://www.hackmeridian.com/faq — eligibility, AI, deadline, deliverables, finale.
- H4: https://www.hackmeridian.com/schedule — свежие времена воркшопов и judging.
- H5: https://www.hackmeridian.com/terms.html — §§3–7, participation, IP, prize policy.
- H6: https://app.hackmeridian.com/ — публичная страница portal, AI attribution, общая информация.
- H7: https://app.hackmeridian.com/code-of-conduct — участнический CoC/waiver; third-party attribution, prize identity details, overnight и venue policy.
- V1: https://www.youtube.com/watch?v=dQjfykaP1G4 — Platform Onboarding, metadata only.
- V2: https://www.youtube.com/watch?v=oR-7PZwBevo — Judging Insights link / actual Developers Meeting title, metadata only.
- V3: https://www.youtube.com/watch?v=N6uBEiq9nR8 — FAQ onboarding, metadata only.
- R1: https://github.com/stellar/ecosystem-resources — официальный hub готовых материалов.
- R2: https://raw.githubusercontent.com/stellar/ecosystem-resources/main/connect-wallet/README.md
- R3: https://raw.githubusercontent.com/stellar/ecosystem-resources/main/guestbook/README.md
- R4: https://raw.githubusercontent.com/stellar/ecosystem-resources/main/kale/README.md
- R5: https://raw.githubusercontent.com/stellar/ecosystem-resources/main/kalefail/README.md
- R6: https://raw.githubusercontent.com/stellar/ecosystem-resources/main/stellar-quest/README.md
- R7: https://github.com/kaankacar/stellar-build
- P1: https://luma.com/6kjcra2t — H.E.R. DAO first-party preparatory workshop.
- P2: https://luma.com/po151xsp — DeVinci Blockchain first-party preparatory workshop.
- M1: https://meridian.stellar.org/schedule?speaker=jaya-baloo — только поисковый индекс; прямое чтение не удалось.
