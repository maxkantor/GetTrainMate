export const discoverExpandedRu = {
  no_photo: 'Нет фото',
  skip: 'Пропустить',
  skip_this_profile: 'Пропустить профиль',
  view_profile: 'Профиль',
  interest_sent: 'Интерес отправлен. Уведомим, если ответят.',
  skipped_toast: 'Пропущено',
  preview_profile_hint:
    'Предпросмотр — откройте «Поиск», чтобы отправить интерес реальным пользователям.',
  match: 'Совпадение! Можно перейти в чат с',
  filters: 'Фильтры',
  no_matches: 'Рядом никого по фильтрам. Измените настройки.',
  no_matches_sub: 'Попробуйте увеличить дистанцию или цели.',
  caught_up_title: 'Вы всё просмотрели по текущим настройкам.',
  caught_up_sub:
    'Измените дистанцию, режим, фильтры или загляните в «Отправленные» и вернитесь позже.',
  retry: 'Повторить',
  load_demo: 'Загрузить демо-профили',
  edit_profile: 'Редактировать профиль',
  refresh: 'Обновить',
  loading: 'Загрузка…',
  rewind_aria: 'Вернуть последний пропуск',
  rewind_label: 'Откатить пропуск',
  sign_in_to_view_profile: 'Войдите, чтобы посмотреть профиль',
  could_not_load_profile: 'Не удалось загрузить профиль',
  could_not_skip: 'Не удалось пропустить. Попробуйте снова.',
} as const;

export const appMessagesRu = {
  sign_in_again: 'Войдите в аккаунт снова.',
  session_expired: 'Сессия истекла. Войдите снова.',
  daily_limit_midnight:
    'Использованы бесплатные совпадения на сегодня ({limit}). Купите кредиты для безлимита или попробуйте после полуночи UTC.',
  daily_limit:
    'Использованы бесплатные совпадения на сегодня ({limit}). Купите кредиты для безлимита.',
  not_enough_credits: 'Недостаточно кредитов. Купите на странице «Цены».',
  could_not_send_interest: 'Не удалось отправить интерес',
  could_not_save_pass: 'Не удалось сохранить пропуск. Попробуйте снова.',
  could_not_undo_skip: 'Не удалось отменить пропуск.',
  demo_dev_only: 'Демо-профили доступны только в разработке или для админов.',
  insight_unlocked: 'Инсайт открыт',
  chat_unlocked: 'Чат открыт',
  not_authenticated: 'Не авторизован',
  api_connect_error: 'Нет связи с сервером. Проверьте подключение.',
  failed_load_chats: 'Не удалось загрузить чаты',
  failed_unlock_chat: 'Не удалось открыть чат',
  failed_send_message: 'Не удалось отправить сообщение',
  auth_required: 'Требуется авторизация. Войдите снова.',
  api_backend_unreachable: 'Нет связи с API. Возможно, бэкенд не развёрнут или не настроен CORS.',
  failed_load_demo: 'Не удалось загрузить демо-профили',
} as const;

export const chatUiRu = {
  unlock_title: 'Открыть чат',
  unlock_desc: 'Откройте чат для сообщений — {cost}. Ваши кредиты: {credits}',
  unlocking: 'Открытие…',
  unlock_cta: 'Открыть чат — {cost}',
  generating: 'Генерация…',
  ai_icebreaker_cta: 'ИИ для первого сообщения ({cost})',
  empty_state: 'Пока нет чатов. Лайкните кого-то в «Поиске» — при взаимности будет мэтч.',
  go_discover: 'К поиску',
  new_message_from: 'Новое сообщение от {name}',
  ask_ai: 'Спросить ИИ',
} as const;
