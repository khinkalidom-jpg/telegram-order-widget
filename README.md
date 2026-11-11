# BLOOM — Flower Delivery

Рабочая демоверсия бота с **Telegram HTML Widget** внутри сообщения: четыре товара, локальная корзина, заказ в SQLite, подтверждение и уведомление администратора. **Demo store — no payment or delivery.** Оплаты и доставки нет.

Нужен **Node.js 24.10+** (проверено на 24.22.1). В production нет внешних npm-зависимостей: SQLite входит в Node. Playwright нужен только для браузерной проверки.

Для первого живого теста: [пошаговая инструкция для Codex и Railway](docs/first-telegram-test.md).

## Запуск превью без токена

```sh
cd /workspace/telegram-order-widget
npm ci --cache /tmp/bloom-npm-cache
npm run preview
```

На своей машине откройте локальный порт 3000 в браузере. В облачной среде это внутренний адрес, не публичная ссылка. Сервер слушает только loopback. Превью помечено **Preview — simulated Telegram**, использует тот же HTML и отдельный тестовый адаптер, не открывает базу и не отправляет сообщения. Есть переключение темы и New demo. Перезагрузка сбрасывает имитацию заказа.

```sh
npm test
npm run check:sizes
# При работающем npm run preview и установленном Chromium:
npm run test:browser
# Другой путь браузера: CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

## Подключение Telegram

1. Создайте бота через официальный **@BotFather** командой `/newbot`. Сохраните полученный токен приватно.
2. Скопируйте `.env.example` в `.env`, заполните `BOT_TOKEN`. Не добавляйте `.env` в Git, не передавайте токен в чат или логи.
3. Запустите `npm start`. Без `BOT_TOKEN` бот завершится с понятной ошибкой. Используется прямой HTTPS Bot API и long polling; webhook у этого бота должен быть отключён. Запускайте один экземпляр процесса на одну базу/токен.
4. **Администратор должен сначала начать переписку с ботом**, отправить `/start`, затем `/id`. Полученный числовой Chat ID впишите в `ADMIN_CHAT_ID` и перезапустите бота. `/id` показывает ID текущего чата; для уведомлений в группу можно использовать ID группы, куда добавлен бот.
5. `DATABASE_PATH` по умолчанию `./data/bloom.sqlite`. Каталог создаётся автоматически. Без `ADMIN_CHAT_ID` заказы работают, уведомления ожидают в базе до настройки и перезапуска.
6. В актуальном клиенте Telegram в личной переписке отправьте `/start` или `/catalog`. Выберите товары, нажмите **Place demo order**. Проверьте состав, сумму, номер и сообщение **DEMO** администратору. Откройте виджет повторно: он должен восстановить заказ из `chatData`. Новый заказ начинается через `/catalog`.

Название, каталог, цены в целых тетри и основные тексты: `src/config.js`. После изменения каталога проверяйте тесты и размеры. Цены считываются сервером из конфигурации, а не из запроса клиента; после изменения цен старые неоформленные каталоги следует заменить новыми.

## Надёжность и ограничения

- Payload — JSON вида `[["r",2],["t",1]]`, до 64 байт UTF-8. Кнопки количества работают локально, запрос вызывается непосредственно в обработчике нажатия.
- `widget_query.from` — источник идентичности; сервер сопоставляет пользователя, чат и ID сообщения с выданным каталогом. Каталоги выдаются только в личной переписке. Чужие/пересланные сообщения не создают заказы.
- `BEGIN IMMEDIATE` и `UNIQUE(chat,message)` гарантируют один заказ на каталог. Заказ и задания обновления виджета/уведомления фиксируются одной транзакцией. Повторное оформление возвращает исходный заказ даже с изменённой корзиной.
- Ответ `answerWidgetQuery` отправляется до уведомления; сетевой бюджет ответа ограничен 11 секундами после начала обработки (с короткой повторной попыткой). Отсутствие сети и уже просроченные Telegram-запросы не позволяют гарантировать доставку за 15 секунд. Сохранённый заказ можно безопасно запросить повторным нажатием.
- Отдельный обработчик обновляет `chat_data` через `editMessageWidgetData` и отправляет уведомление. Статусы и попытки хранятся в SQLite, повторы учитывают `retry_after`, задержка растёт до 5 минут. Неудачная доставка сохраняется и переживает перезапуск. Постоянную ошибку (например, блокировку бота) нужно устранить.
- Доставка уведомлений — **at least once**: если Telegram принял сообщение, но соединение оборвалось до ответа, повтор может продублировать уведомление с тем же номером. Сам заказ не дублируется. Bot API не даёт ключа идемпотентности для `sendMessage`.
- HTML отправляется обычной строкой; проверяются лимиты 32768 байт и 4096 байт zlib level 9. Весь JS/CSS встроен, без внешних ресурсов, сетевых вызовов и полей ввода. Подтверждение хранится в приватном `chat_data`, не в пересылаемом `public_data`.

## Что проверено

23 автоматических теста: суммы, неверные корзины/количества, чужой пользователь, SQLite и восстановление после открытия базы, уникальность заказа, отложенные уведомления и ошибки, ограничения HTML/payload/состояния, безопасные ошибки HTTPS. Браузер Chromium: ширина рамки 320 px, светлая/тёмная тема, выбор, сумма, подтверждение, новый заказ, предел количества; ошибок JavaScript нет. Скриншоты — `artifacts/preview-*-320.png`.

**Это не проверка совместимости с Telegram.** Страницы core.telegram.org были недоступны из-за сетевой политики; контракты сверены по официальному исходному коду и документации SDK в репозиториях Telegram, ссылки и версии — [docs/telegram-api.md](docs/telegram-api.md). Настоящий Telegram ещё не проверен: отсутствуют `BOT_TOKEN` и `ADMIN_CHAT_ID`. Перед показом клиенту выполните сценарий выше на актуальных клиентах Telegram, включая повторное открытие, быстрое повторное нажатие и уведомления.

Для облачной среды в черновик сетевых настроек добавлены `core.telegram.org` и `api.telegram.org`. Их сохранение в черновике не означает применения к текущей машине: проверьте и сохраните настройки среды. Публичного развёртывания нет.

## Storefront and owner studio (November 2026)

`/start` opens Home; `/catalog`, `/cart`, `/help` and the Commands menu are available.
The new HTML widget provides navigation, a paginated bouquet catalogue, a persistent
cart, review/confirmation and Shop again. Old widget messages retain their old HTML;
use Start to receive the new storefront. SQLite migrations preserve old orders and
notification jobs. New sessions use negative internal order message keys, so a new
order does not collide with a previous order in the same widget. Query revisions
prevent repeated quantity changes and duplicate checkout. Price snapshots are
confirmed again when current prices change. Hidden products cannot be ordered,
including through old catalogue messages.

Set `ADMIN_USER_ID` to the owner's numeric Telegram **user** ID. `/id` reports both
user and chat IDs. Set `ADMIN_CHAT_ID` separately for queued order notifications.
The administrator must first open the bot. Without ADMIN_USER_ID the studio is
closed; without ADMIN_CHAT_ID notifications remain queued. Neither was configured
during this implementation, so live owner access and notification delivery have
not been verified.

Owner: send `/admin`, choose **Add bouquet**, send name, description, GEL price
(e.g. `120.00`), then a normal Telegram photo. Review the photo and choose **Publish**
or **Cancel**. `/cancel` discards an unfinished draft. `/admin` also lists bouquets:
choose one to edit its name, description, price or photograph, or hide/show it.
All admin messages and callbacks check `from.id`, never usernames. Uploaded photos
must be at least 100×100; names are limited to 48 characters, descriptions to 120,
and prices to 1–100000 GEL. Only upload photographs you have permission to use.
Products and photo file IDs are stored in SQLite and require no restart.

### Photography: explicitly incomplete

No stock photographs have been imported or licensed in this change. A request to
`https://commons.wikimedia.org/w/api.php?action=query` returned HTTP 403 under the
current network policy. Wikimedia discovery and original files need
`commons.wikimedia.org` and `upload.wikimedia.org`. No network settings were changed.
Consequently there are **no photo sources or license grants to claim**. The four
seed bouquets keep IDs r/t/w/b and prices 120/85/110/180 GEL, with neutral descriptions
and an explicit Photography pending label. There is no fake photo or external URL
inside the widget. Complete photography using the owner upload flow, or obtain
network access and document the source URL, author and license for each chosen image.

Photo delivery uses sendPhoto and existing Telegram file IDs; navigation uses
editMessageMedia and editMessageWidgetData, with persistent session/message links.
The photo transport has mock coverage but has not been tested with a real uploaded
bouquet photo. With no configured photo the bot sends only the widget. A new view
with a configured photo sends the photo before its widget. A photo added to an
already-open photo-less view appears as a new photo message; subsequent navigation
edits that photo. Missing-photo transitions remove only that view's photo to avoid
showing a photograph of the wrong bouquet; chat history is not bulk-deleted.

`npm test` covers legacy ordering plus sessions, permissions, editing, availability,
price changes, replay and limits. `npm run preview` is a local composition preview
with the same server session logic in an in-memory database. Its photo slot is
explicitly empty, not a simulated real photo. `npm run test:browser` checks Chromium
at widths 320 and 430, both themes, checkout and Shop again. This is not an iPhone test.
The storefront is 5622 bytes raw / about 2396 bytes zlib level 9; screen data is
checked against 1024 bytes, requests against 64 bytes. Catalogue size is independent
of HTML size. Full carts/orders remain server-side and are paginated on screen.

API references checked: https://core.telegram.org/bots/widgets,
https://core.telegram.org/bots/api, https://core.telegram.org/bots/features.
No payments, addresses, Mini App, external storefront or hosting changes were added.
