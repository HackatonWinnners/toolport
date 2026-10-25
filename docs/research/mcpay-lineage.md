# MCPay → Frames: преемственность и смысл для Stellar

Проверено 25 октября 2026. Только первичные источники; платных вызовов не делали.

## Что подтверждено про связь

**Гипотеза пользователя хорошо подтверждается на уровне автора и продуктовой преемственности. Тождество backend-кода не доказано.**

1. Главный домен MCPay сейчас отдаёт HTTP 307 с `Location: https://frames.ag/`. Проверено и веб-инструментом (он фиксирует redirect), и публичным HEAD-запросом. Это прямое доказательство перенаправления прежнего продукта на Frames. [mcpay.tech](https://mcpay.tech/)
2. Владелец репозитория `microchipgnu/MCPay` в собственном GitHub-профиле назван **Luís Freitas**, профиль ссылается на **@frames-engineering**. [Профиль автора](https://github.com/microchipgnu)
3. Luís Freitas — соавтор официального анонса FRAMES-F1 вместе с Marcelo Kunze. В тексте Frames описывает предыдущий AgentWallet, registry и последующий pivot к F1. Сам текст не утверждает буквально «MCPay переименован во Frames». [Анонс F1](https://frames.ag/blog/introducing-frames-f1)
4. Старый интерфейс MCPay доступен на `v2.mcpay.tech`; docs также сохранились. GitHub-репозиторий продолжает называться MCPay. Поэтому корректнее говорить о развитии/повороте продукта той же команды, а не о доказанном простом rename репозитория. [Старый продукт](https://v2.mcpay.tech/), [документация](https://docs.mcpay.tech/), [репозиторий](https://github.com/microchipgnu/MCPay)

## Доступная история

Официальная документация называет первичным прототипом проект на ETHGlobal Prague, а soft launch датирует **25 августа 2025**. Страница проекта ETHGlobal подтверждает статус Prague 2025 Finalist и исходную идею: pay-per-use API с x402 и MCP. Октябрьско-ноябрьский roadmap 2025 включал MCP monetization wrapper, OAuth hooks и улучшенное индексирование. История коммитов через веб-инструмент не загрузилась; точная дата ребрендинга не установлена. [История](https://docs.mcpay.tech/more-about), [roadmap](https://docs.mcpay.tech/more-about/roadmap), [первичный showcase](https://ethglobal.com/showcase/mcpay-fun-y16d3)

## Что MCPay делает на самом деле

MCPay — платёжная инфраструктура для продавцов MCP/API и агентов-покупателей: registry, no-code monetization proxy и TypeScript SDK/CLI. Продавец подключает существующий MCP/OpenAPI endpoint, выбирает инструменты/маршруты и задаёт цену, asset и сеть. SDK позволяет объявлять `paidTool`. Клиент узнаёт требования оплаты, подписывает платёж, повторяет вызов с proof. Это уже включало discovery и общий пользовательский доступ, поэтому называть MCPay «только middleware без каталога» неверно. [README](https://github.com/microchipgnu/MCPay), [monetization flow](https://docs.mcpay.tech/quickstart/monetize)

| Аспект | MCPay | Frames |
|---|---|---|
| Что предлагают | Монетизировать/потреблять платные MCP и API | Получить нужные платные данные через единый доступ |
| Ключевая механика | Pricing → payment proof → verify → execution → settlement | Discovery/ranking → execution/payment → delivery verification → billing |
| Модель клиента | Wallet либо hosted account/API key; proxy/SDK | OAuth/API key, кредиты, бюджет и receipt |
| Управляемое исследование | В исследованных материалах не заявлено | F1: планирование, выбор источников, проверка и ответ |
| Экономика | Старый интерфейс заявляет отсутствие platform fees | Платные планы/кредиты; fee поверх provider/model costs |

Сравнение синтезировано из [MCPay docs](https://docs.mcpay.tech/), [старого интерфейса](https://v2.mcpay.tech/), [Frames introduction](https://frames.ag/docs/introduction), [Frames F1](https://frames.ag/docs/f1). Нынешний Frames заметно ближе к data broker/research agent, MCPay — к payment gateway/marketplace инфраструктуре.

## Детали кода, существенные для Stellar

Прочитан публичный исходник, а не только marketing docs:

- Клиентский wrapper использует signer `{evm, svm}` и поддерживаемые сети из зависимости `x402`. Платёжный challenge передаётся в MCP `result._meta['x402/error']`; повторный callTool содержит `_meta['x402/payment']`. По умолчанию x402 version 1 и cap 0.1 USDC. [with-x402-client.ts](https://raw.githubusercontent.com/microchipgnu/MCPay/main/packages/js-sdk/src/client/with-x402-client.ts)
- Server plugin поддерживает EVM/SVM recipients, проверяет proof через facilitator, выполняет callback, затем делает settle только если callback не бросил исключение и не вернул `isError`. Это проверка технической успешности callback; семантическая достоверность ответа из этого кода не следует. [with-x402.ts](https://raw.githubusercontent.com/microchipgnu/MCPay/main/packages/js-sdk/src/handler/server/plugins/with-x402.ts)
- В прочитанном SDK manifest: version `0.1.17`, `x402 ^0.6.5`, `x402-fetch ^0.6.0`, MCP SDK `1.18.2`. Нельзя автоматически считать это современным x402 v2 стеком. [package.json](https://raw.githubusercontent.com/microchipgnu/MCPay/main/packages/js-sdk/package.json)
- Официальный список SDK перечисляет EVM и Solana; Stellar там нет. Это отсутствие в исследованном MCPay, а не доказательство отсутствия Stellar/x402 во всей экосистеме. [SDK](https://docs.mcpay.tech/quickstart/sdk)

**Вывод для переноса:** замены названия сети будет мало: нужно адаптировать signer, payment scheme/requirements, facilitator verification/settlement и transport metadata. Это инженерный вывод из кода; размер необходимой работы зависит от готовых Stellar x402 реализаций.

MCPay также документирует facilitator passthrough с failover/retries и опциональные vlayer zkTLS proofs. Поэтому proof-of-request и надёжность payment infrastructure не являются полностью новым слоем относительно исходного проекта. zkTLS proof фиксирует запрос/ответ, но сам по себе не доказывает, что ответ решает задачу пользователя. [Facilitator](https://docs.mcpay.tech/x402/facilitator), [vlayer](https://docs.mcpay.tech/partners/vlayer)

Лицензионные metadata расходятся: корневой LICENSE — Apache 2.0, SDK package.json содержит MIT. Перед использованием кода нужно сверить применимые файлы и package distribution; здесь зафиксировано наблюдение, не правовое заключение. [LICENSE](https://raw.githubusercontent.com/microchipgnu/MCPay/main/LICENSE), [SDK manifest](https://raw.githubusercontent.com/microchipgnu/MCPay/main/packages/js-sdk/package.json)

## Что говорить в оценке идеи

Подтверждённая эволюция показывает, что payment plumbing и registry были исходным продуктом, а нынешнее позиционирование сместилось к выбору полезных данных и проверке результата. Это сигнал о возможной ценности слоя выше платежей, но не доказательство коммерческого успеха или причины pivot. Клон с единственным отличием «на Stellar» следует оценивать как chain adapter; самостоятельный продукт должен иметь конкретного покупателя и сценарий, ради которого продавцы/агенты выберут этот слой. Это аналитический вывод по сравнению публичных продуктов.
