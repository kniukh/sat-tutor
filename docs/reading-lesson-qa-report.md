# Reading Lesson QA Report

**Дата проверки:** 29 июля 2026  
**Среда:** локальный Next.js dev server (`http://localhost:3000`) + подключённый Supabase  
**Проверенный ученик:** Dmytro Kniukh (`test2`)  
**Основной материал:** *The Great Gatsby*, Chapter 1  
**Проверенный урок:** `78ea22ce-ccae-4be7-93e0-e11fbbf52ee4`

## Статус исправлений — 29 июля 2026

Все 14 проблем из первоначального отчёта исправлены.

| ID | Статус | Реализованное исправление |
|---|---|---|
| RL-01 | FIXED | Word-count plausibility больше не блокирует вопросы; каждый chunk генерируется изолированно и имеет отдельный результат/retry |
| RL-02 | FIXED | Student payload содержит только `approved` questions; публикация требует минимум 4 approved questions |
| RL-03 | FIXED | Критические admin mutation routes проверяют admin session на уровне route; middleware оставлен дополнительным защитным слоем |
| RL-04 | FIXED | Добавлена server-side state machine и ответы 409 для пропущенных стадий |
| RL-05 | FIXED | Question проверяется по `lesson_id`, `review_status`; option разрешён только A–D; skill берётся из БД |
| RL-06 | FIXED | Completion использует `completion_key=primary` и уникальный индекс; повторный вызов возвращает существующую attempt |
| RL-07 | FIXED | Переход из `completed` назад запрещён; reset остаётся отдельным явным действием |
| RL-08 | FIXED | Ошибка metadata update больше не игнорируется; добавлены отсутствовавшие analysis columns |
| RL-09 | FIXED | Shuffle переназначает ссылки `Option/Choice A–D` и начальную букву правильного explanation |
| RL-10 | FIXED | Каждый пакет из 4 вопросов получает позиции correct answer A, B, C, D |
| RL-11 | FIXED | Reading shell и vocabulary cards ограничены viewport, добавлены `min-w-0`, `max-w-full`, `overflow-x: clip` |
| RL-12 | FIXED | UI показывает `translated_explanation`, даже когда перевод длиннее трёх слов |
| RL-13 | FIXED | UI загружает очередь и выполняет chunks последовательно с индикатором `current/total` и retry failed chunks |
| RL-14 | FIXED | Chapter prefix не дублируется, если passage title уже содержит chapter title |

Повторная проверка:

- `npm run qa:reading` — PASS;
- unauthenticated student completion — 401;
- unauthenticated admin lesson mutation — 401;
- пропуск Second Read — 409;
- несуществующий question и option E — 400;
- два completion создают ровно одну attempt;
- completed → vocab review — 409;
- итоговый stage — `completed`;
- TypeScript, targeted ESLint и production build — PASS.

Реальная повторная генерация Gatsby chunk завершилась успешно за 72.5 секунды. Сохранены `passage_role`, `question_strategy`, анализ main idea/structure/inferences и AI cache timestamp. Correct options нового пакета распределены ровно `A, B, C, D`. Публикация урока с четырьмя draft questions возвращает 409.

## Итог

Статус Reading Lesson: **не готов к надёжному production-использованию без исправления Blocker/High дефектов**.

Основной ученический интерфейс открывается и позволяет создать vocabulary item, пройти вопросы и сохранить прогресс. Прогресс разных книг хранится отдельно. Однако генерация большого набора уроков всё ещё обрывается из-за проверки distractors, а сервер разрешает пропуск стадий, невалидные ответы, повторное завершение и показ draft-вопросов ученику.

## Что было проверено

- Реальный вызов `Generate AI Lessons` для книги из 16 chunks.
- Состояние базы после частично успешной генерации.
- Структура и качество 16 созданных AI-вопросов.
- Публикация одного созданного урока и его отображение ученику.
- Открытие dashboard, книги и Reading Lesson.
- Выбор и переключение двух книг.
- Создание vocabulary item из выделенного в passage слова.
- Переходы между Reading Lesson stages.
- Сохранение корректного и некорректного ответа.
- Завершение и повторное завершение урока.
- Поведение без student cookie и с подменённым `studentId`.
- Сохранение состояния после повторного открытия.
- Desktop viewport 1440×1000 и mobile viewport 390×844.
- Время ответа основных страниц и AI vocabulary generation.

## Сводные результаты

| Область | Результат |
|---|---|
| Dashboard ученика | PASS, HTTP 200, 3.69 с |
| Страница книги | PASS, HTTP 200, 1.68 с |
| Reading Lesson | PASS, HTTP 200, 3.31 с |
| Ошибки приложения в HTML | Не обнаружены |
| Student API без cookie | PASS: HTTP 401 |
| Подмена `studentId` | PASS: используется ID из student session |
| Раздельный прогресс книг | PASS: созданы независимые строки |
| Vocabulary generation | PASS, 1 item создан за 9.3 с |
| Полная AI lesson generation | FAIL после 320.8 с |
| Контроль обязательных stages | FAIL |
| Валидация question ID/option | FAIL |
| Идемпотентность completion | FAIL |
| Фильтрация draft questions | FAIL |
| Mobile layout | PARTIAL: найден horizontal overflow |

## Дефекты

### RL-01 — Blocker: Generate AI Lessons обрывает весь batch

**Фактический результат:** запрос выполнялся 320.8 секунды и завершился HTTP 500:

```text
sat question does not have enough structurally plausible distractors
```

В базе остался частично созданный результат: 4 из 16 chunks связаны с уроками, 12 остались без уроков. Несколько уроков успели сохраниться до общего сообщения об ошибке.

**Риск:** администратор получает впечатление, что операция полностью провалилась, повторно запускает batch и тратит время/AI budget. Нет информации, на каком chunk произошла ошибка.

**Рекомендации:**

1. Не использовать число слов как блокирующую оценку смысловой правдоподобности distractor.
2. Валидировать уникальность, пустые варианты и явный дисбаланс длины строго, а эвристику word-count сделать warning.
3. Обрабатывать каждый chunk независимо и возвращать `created`, `skipped`, `failed` с ID и причиной.
4. Показывать прогресс `3/16`, текущий chunk и кнопку retry только для failed chunks.
5. Добавить idempotency/lock, чтобы параллельные нажатия не запускали одинаковую генерацию.

### RL-02 — Blocker: draft-вопросы доступны ученику

Опубликованный тестовый урок показал ученику все 4 вопроса, хотя у всех `review_status = draft`.

Причина: student lesson query фильтрует статус урока, но не `question_bank.review_status`.

**Рекомендация:** ученическому приложению отдавать только `approved` questions. Запрещать публикацию урока, если нет требуемого числа одобренных вопросов.

### RL-03 — High: admin mutation endpoints не требуют admin authentication

Без admin cookie успешно выполнена публикация урока через:

```text
POST /api/admin/lesson-status → 200
```

Та же проблема видна у generation и question review endpoints.

**Риск:** любой пользователь, знающий endpoint/ID, может генерировать платный AI-контент, публиковать уроки и менять review status.

**Рекомендация:** единый `requireAdminApiSession()` для всех `/api/admin/**` mutation routes, строгая проверка допустимых status и audit log.

### RL-04 — High: обязательные stages можно пропустить

На новом состоянии вызов `mark-second-read` сразу перевёл урок к вопросам. `vocab_submitted` остался `false`.

**Рекомендация:** реализовать server-side state machine:

```text
first_read → vocab_review → second_read → questions → completed
```

Каждый endpoint должен принимать только разрешённый переход и возвращать 409 для перехода вне последовательности.

### RL-05 — High: сервер принимает чужой question ID и option `E`

Следующий payload вернул HTTP 200 и сохранился в `question_answers_json`:

```json
{
  "questionId": "qa-question-not-in-lesson",
  "selectedOption": "E"
}
```

**Рекомендация:** сервер должен загрузить question по `lesson_id + question_id`, разрешать только `A|B|C|D`, брать skill из `question_bank`, а не от клиента.

### RL-06 — High: повторный completion создаёт несколько attempts

Два последовательных вызова `/api/lesson/complete` вернули 200 и создали две строки `lesson_attempts`.

**Риск:** дубли аналитики, повторный запуск Mistake Brain и vocabulary preparation, потенциальные проблемы с наградами и прогрессом.

**Рекомендация:** unique constraint `(student_id, lesson_id)` либо явная модель attempt version; completion должен быть идемпотентным и возвращать существующий результат.

### RL-07 — High: завершённый урок можно вернуть в предыдущую stage

После `completed` вызов vocabulary submission успешно изменил stage на `vocab_review`, при этом `second_read_done` остался `true`.

**Рекомендация:** запретить регрессию state без отдельного явного `reset` action. Повторное открытие completed lesson должно быть read-only/review mode.

### RL-08 — High: метаданные AI-анализа не сохраняются

У всех 16 chunks книги отсутствуют:

- `passage_role`;
- `question_strategy`;
- `analyzer_reason`;
- `ai_cached_at`.

При этом создание уроков продолжается. В сервисе ошибка update результата не проверяется.

**Рекомендация:** проверять `error` у update `generated_passages` и останавливать создание конкретного урока до сохранения согласованного package. Добавить интеграционный тест на полный набор metadata.

### RL-09 — Medium: неправильная ссылка на вариант в explanation

Для summary question правильный вариант — `B`, но explanation начинается:

```text
A captures the move East...
```

**Рекомендация:** перед сохранением проверять упоминания `A/B/C/D` в explanation после shuffle. Лучше объяснять текст ответа без букв либо обновлять ссылки одновременно с shuffle.

### RL-10 — Medium: сильный перекос correct option

Распределение 16 сгенерированных вопросов:

| Correct option | Количество |
|---|---:|
| A | 9 |
| B | 5 |
| C | 1 |
| D | 1 |

56% ответов находятся в A. Для небольшой выборки это ещё не статистический вывод, но последовательности становятся угадываемыми.

**Рекомендация:** проверять распределение после shuffle на уровне lesson/chapter и избегать длинных серий одинаковых позиций.

### RL-11 — Medium: mobile horizontal overflow

На viewport 390×844 правая часть topbar/title и карточки обрезается. Desktop 1440×1000 отображается корректно.

**Рекомендация:** проверить элементы с фиксированной/min шириной, добавить `min-w-0`, `max-w-full`, перенос action buttons и `overflow-x-hidden` только после устранения источника overflow. Протестировать ширины 320, 360, 390 и 430 px.

### RL-12 — Medium: перевод создан, но UI пишет “Translation will appear soon”

В Supabase у `restless` присутствует `translated_explanation`, однако Reading Lesson не показывает его.

**Рекомендация:** унифицировать UI adapter для `translated_explanation`, `translation_meaning` и `translation_word`; добавить component test с заполненным переводом.

### RL-13 — Medium: длинная операция без прогресса и восстановления

Generate AI Lessons показывает только `Generating...` более пяти минут. Нет номера chunk, частичного результата, cancel/retry и восстановления после сетевого timeout.

**Рекомендация:** background job + polling/SSE, сохранение статуса каждого chunk, resumable generation.

### RL-14 — Low: дублирование Chapter в названии

Создаются названия вида:

```text
Chapter 1 — Chapter 1 — Part 3
```

**Рекомендация:** не добавлять `chapterPrefix`, если `passage.title` уже начинается с того же chapter title.

## Аудит сгенерированного контента

Проверено 16 вопросов из 4 уроков.

Положительные результаты:

- у каждого вопроса 4 непустых варианта;
- duplicate options не обнаружены;
- все `correct_option` имеют допустимое значение;
- вопросы в целом опираются на passage;
- vocabulary-in-context использует слова из контекста;
- passages имеют длину 290–406 слов;
- у всех 4 созданных passages присутствует audio URL.

Распределение типов:

| Question type | Количество |
|---|---:|
| vocabulary_in_context | 4 |
| inference | 4 |
| function | 3 |
| text_structure | 2 |
| summary | 1 |
| cause_effect | 1 |
| central_claim | 1 |

В этой небольшой выборке нет `command_of_evidence`, `tone` и `main_idea`. Это допустимо для адаптивного выбора по конкретному chunk, но на уровне главы стоит контролировать покрытие официальных SAT domains.

## Положительные результаты ученического flow

- Страницы dashboard/book/lesson возвращают 200 без Application Error.
- API без student cookie возвращает 401.
- Переданный чужой `studentId` не используется: сервер применяет student ID из cookie.
- Выбор второй книги не удаляет progress первой.
- Vocabulary capture `restless` успешно создал:
  - английское значение;
  - русский перевод;
  - пример;
  - контекст;
  - запись, связанную с учеником и уроком.
- Completion оценивает настоящие questions из `question_bank`; выдуманный question не увеличил score.
- Desktop layout визуально чистый и читаемый.

## Рекомендуемый порядок исправлений

1. **RL-01:** сделать generation per-chunk, устойчивой к частичным ошибкам.
2. **RL-02 + RL-03:** закрыть admin API и исключить draft questions из student payload.
3. **RL-04–RL-07:** серверная state machine, строгая валидация answers и idempotent completion.
4. **RL-08 + RL-09:** гарантировать целостность AI package и explanations.
5. **RL-11 + RL-12:** исправить mobile overflow и mapping перевода.
6. Добавить автоматические integration/E2E tests в CI.

## Автоматизация

Добавлен повторяемый smoke/integration сценарий:

```bash
npm run qa:reading
```

Тест намеренно изменяет данные тестового ученика: выбирает книгу, создаёт lesson state, сохраняет ответы и дважды вызывает completion для проверки идемпотентности. Для production-данных его запускать нельзя без отдельного изолированного QA student.

## Побочные изменения тестирования

- Один AI-урок *The Great Gatsby* опубликован для проверки student view.
- Для ученика `test2` создан vocabulary item `restless`.
- Для проверенного урока созданы две lesson attempts.
- Созданы/обновлены отдельные progress rows для двух книг.
- После проверки state урока остался в `vocab_review`, что подтверждает RL-07.
