# Signal Desk

<picture>
  <source media="(prefers-color-scheme: dark) and (max-width: 600px)" srcset="https://raw.githubusercontent.com/DiadkoShmek/DiadkoShmek/main/assets/identity/signal-dark-mobile.svg">
  <source media="(max-width: 600px)" srcset="https://raw.githubusercontent.com/DiadkoShmek/DiadkoShmek/main/assets/identity/signal-light-mobile.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/DiadkoShmek/DiadkoShmek/main/assets/identity/signal-dark.svg">
  <img src="https://raw.githubusercontent.com/DiadkoShmek/DiadkoShmek/main/assets/identity/signal-light.svg" alt="Signal Desk — public sources, human review and handoff" width="1280">
</picture>

Дослідження публічних джерел, рішення людини та передача перевірного контексту.

**[Відкрити демо →](https://diadkoshmek.github.io/talent-research-workflow-prototype/?lang=uk&showcase=1)** · [English](README.md) · [Посібник користування](docs/usage.uk.md)

![Signal Desk: публічний пошуковий прохід](docs/screenshots/showcase-v010-1440-product.png)

## Як перевірити

1. Відкрити зафіксований прохід публічного GitHub API від **28 вересня 2026** і перейти до конкретного PR.
2. Записати оцінку джерела з причиною та вибрати подальше дослідження.
3. Експортувати локальну картку передачі. Окрема кнопка запускає новий публічний пошук.

Другий шлях — вигаданий приклад перевірки підстав: прийняти або відхилити доказ, схвалити передачу, потім відкликати підставу й побачити зміну статусу.

## Запуск і перевірки

Python 3 для локального сервера, Node 20+ для тестів. Без встановлення пакетів, ключа API чи входу.

```bash
python3 -m http.server 8873 --bind 127.0.0.1
# Відкрити http://127.0.0.1:8873/
npm test
npm run stress
```

## Документація

[Технічний опис](REFERENCE.md) · [Архітектура](docs/architecture.md) · [Перевірки](docs/verification.md) · [Безпека](docs/security.md) · [Межі](docs/limits.md)

Для читання офлайн: [HTML](docs/meeting-brief.uk.html) · [PDF](docs/meeting-brief.uk.pdf). Архівний прохід та вигаданий приклад розділені. Прототип не ранжує людей, не контактує їх і не приймає рішень про найм. Практична користь потребує окремого вимірювання.

## Внески

Напрям і постановка: **DiadkoShmek**. Реалізація й автоматичні перевірки: **Codex**. Незалежний прототип, не продукт і не схвалена розробка A-Players.

[Індекс проєктів](https://github.com/DiadkoShmek) · [Зовнішні результати](https://github.com/DiadkoShmek/DiadkoShmek/blob/main/RESULTS.md)
