# Vampire: The Masquerade Revised - Foundry VTT System

Текущая версия: v9.5.0.

# Vampire: The Masquerade Revised - Unofficial System v9.2

Эталонная версия Foundry VTT системы для **Vampire: The Masquerade Revised**.

Эта сборка зафиксирована как базовая контрольная точка **v9.2**. От неё стоит вести дальнейшую разработку, делать git-теги и новые feature-ветки. Потому что zip-архивы без версий, как известно, размножаются в темноте и портят людям жизнь.

## Статус

- Package ID: `vtm-revised`
- Version in `system.json`: `9.5.0`
- Foundry compatibility: minimum `13.347`, verified `14`
- Назначение: dev/домашняя система для VtM Revised

## Основные возможности

- Лист персонажа-вампира.
- Портрет персонажа через Foundry File Picker.
- Ограничения поколения: максимум Черт, запас крови, трата крови за ход.
- Натура и Маска с карточками описания.
- Справочник кланов и карточки кланов.
- Одиночные и комбинированные броски d10.
- Ручная сложность броска.
- Штрафы от здоровья к пулу.
- `10 = 2 успеха`, `1 = -1 успех`.
- Здоровье через чекбоксы со штрафами.
- Дисциплины, силы дисциплин и карточки дисциплин.
- Базовые дисциплины 1-5 и расширение 6+.
- Магия крови и пути:
  - Тауматургия;
  - Колдовство;
  - Некромантия;
  - Темная Тауматургия;
  - Чародейство Ассамитов;
  - Чародейство Сеттитов.
- Ритуалы отдельным блоком на всю ширину листа.
- Каталог ритуалов Тауматургии 1-10 уровней.
- Оружие и урон.
- Достоинства, Недостатки и Дополнения с карточками, описаниями и эффектами.
- Пошаговый мастер создания персонажа.
- Визуальные d10 dice effects, экспериментально.

## Установка

Скопируй папку `vtm-revised` в каталог систем Foundry:

```text
FoundryUserData/Data/systems/vtm-revised
```

После этого полностью перезапусти Foundry VTT и создай мир на системе:

```text
Vampire: The Masquerade Revised - Unofficial System
```

## Импорт встроенных каталогов

После установки в мире можно выполнить в консоли Foundry:

```js
game.vtmRevised.importBuiltInClanCatalog()
game.vtmRevised.importBuiltInDisciplineCatalog()
game.vtmRevised.importBuiltInBloodMagicCatalog()
game.vtmRevised.importBuiltInRitualCatalog()
game.vtmRevised.importBuiltInWeaponCatalog()
game.vtmRevised.importBuiltInBackgroundCatalog()
game.vtmRevised.importBuiltInMeritsFlawsCatalog()
```

## Полезные команды

```js
// Импорт персонажа из JSON-чарника
game.vtmRevised.importJsonText(jsonText)

// Синхронизация уже добавленных ритуалов первого персонажа из каталога
game.vtmRevised.syncFirstActorRitualsFromCatalog()

// Применить ограничения поколения к первому персонажу
game.vtmRevised.applyFirstActorGenerationCaps()

// Тест визуальных кубов
game.vtmRevised.showDiceTest()

// Стиль кубов
game.vtmRevised.setDiceStyle("camarilla")
game.vtmRevised.setDiceStyle("sabbat")
game.vtmRevised.setDiceStyle("none")
```

## Структура проекта

```text
vtm-revised/
├─ system.json
├─ vtm-revised.mjs
├─ vtm-revised.css
├─ data/
├─ docs/
├─ lang/
├─ packs/
├─ scripts/
├─ styles/
├─ templates/
└─ ui/
```

## Git-рекомендация

```powershell
git init
git add .
git commit -m "Release v9.2 baseline"
git branch -M main
git tag v9.2
git remote add origin https://github.com/<OWNER>/vtm-revised-foundry-system.git
git push -u origin main
git push origin v9.2
```

Дальше новые задачи лучше делать в отдельных ветках:

```text
feature/dice-so-nice-integration
feature/combat-soak-armor
feature/creation-wizard-polish
feature/rules-catalog-polish
```

## Правовая оговорка

Это неофициальная fan-made система для Foundry VTT. Она не связана с White Wolf, Paradox Interactive или Foundry Gaming LLC. Тексты справочников внутри системы являются игровыми выжимками и техническими карточками для домашнего использования, а не официальной публикацией правил.


## v9.2.0

Патч автоматического списания стоимости дисциплин, путей и ритуалов: кровь и Сила Воли теперь списываются из ресурсов персонажа при использовании verified-карточек. Поддерживаются явные поля `resource/amount`, `blood`, `willpower`, а также fallback-разбор текстовой стоимости.


## v9.2.0: Пути Просветления и Дороги

Добавлен встроенный справочник моральных шкал:

- современные Пути Просветления;
- Человечность;
- Дороги Dark Ages;
- выбор Пути/Дороги в трекере персонажа;
- кнопка-книжка рядом с выбором;
- карточка с литературным описанием, этическим кодексом, иерархией грехов, аурой, добродетелями и механическими пояснениями.

Команда импорта:

```js
game.vtmRevised.importBuiltInMoralityCatalog()
```


## v9.4.0 - v9.5.32 Общее улучшение UI и мелкие правки.

