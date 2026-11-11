# Проверка контрактов Telegram

Запрошенные страницы `https://core.telegram.org/bots/widgets` и `https://core.telegram.org/bots/api` вернули 403; диагностический запрос показал запрет CONNECT прокси. Содержимое этих страниц прочитать не удалось. API не придуман: использованы доступные официальные исходники и документация Telegram.

Источники:

- [telegram-bot-api Client.cpp](https://github.com/tdlib/telegram-bot-api/blob/7232881b39dfcd048a0d569f1983c5184249ee05/telegram-bot-api/Client.cpp): `process_send_widget_query`, `JsonWidgetQuery`, `process_answer_widget_query_query`, `process_edit_message_widget_data_query`.
- [Widget SDK v1](https://github.com/TelegramMessenger/widget-sandbox/blob/1cde0068daba8437f53eac0b61c395d29b8f89e3/docs/sdk-v1.md): §2, особенно request и state.
- [Руководство авторов виджетов](https://github.com/TelegramMessenger/widget-sandbox/blob/1cde0068daba8437f53eac0b61c395d29b8f89e3/docs/widget-runtime-profile.md): HTML, CSS, DOM, пределы и тема.
- Официальный Telegram Desktop ссылается на `TelegramMessenger/widget-sandbox` и `TelegramMessenger/twidget` в `.gitmodules` (коммит `1924801c147371267b4cb8696767bc0d4d8f39c7`).

Используемый контракт:

| Вызов / объект | Поля |
| --- | --- |
| sendWidget | chat_id, html, width, height, allow_queries, chat_data, caption |
| widget_query | id, from, chat, message_id, type: {type: "data"}, data |
| TelegramWidget.request(data) | строка 1–64 байта, Promise → {result: string или null} |
| answerWidgetQuery | widget_query_id, data (JSON, до 1024 байт) |
| editMessageWidgetData | chat_id, message_id, chat_data (JSON, до 1024 байт) |
| Состояние | TelegramWidget.chatData; onEvent('chatDataChanged', handler), обработчик без аргументов |
| Готовность | TelegramWidget.ready() |

Тема: --tg-theme-bg-color, --tg-theme-text-color, --tg-theme-hint-color, --tg-theme-secondary-bg-color, --tg-theme-button-color, --tg-theme-button-text-color, --tg-theme-section-separator-color. Используются обычные DOM-методы, inline SVG, flex, Promise, TextEncoder; они перечислены в поддерживаемом профиле.

Бот не использует Mini Apps, WebApp, inline-клавиатуры или HTML-ссылку вместо виджета. Проверка контракта по исходникам не доказывает доступность функций на конкретном сервере/клиенте Telegram. Живая проверка без токена не выполнялась.
