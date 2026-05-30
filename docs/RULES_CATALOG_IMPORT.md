# Rules catalog import

Система не включает полный текст правил из wod.su или книг World of Darkness.

Причина простая: это чужой текст. Его можно импортировать в свою приватную игру, если у вас есть право или вы используете собственные заметки, но публичный пакет не должен распространять чужой контент. Юридические охотники, в отличие от обычных, не требуют броска инициативы.

## Поддерживаемый JSON

```json
{
  "source": "https://wod.su/vampire",
  "folderName": "VtM Rules",
  "disciplines": [
    {
      "name": "Присутствие",
      "slug": "presence",
      "sourceUrl": "https://wod.su/vampire/disciplines/presence",
      "description": "Короткая авторская заметка или разрешённый текст",
      "roll": {
        "firstTrait": "attribute.social.manipulation",
        "secondTrait": "ability.talents.expression",
        "difficulty": 7
      },
      "cost": {
        "resource": "blood",
        "amount": 1,
        "text": "1 пункт крови"
      }
    }
  ]
}
```

Поддерживаемые массивы:

- `clans`
- `sects`
- `disciplines`
- `disciplinePowers` / `powers`
- `disciplinePaths` / `paths`
- `rituals`
- `merits`
- `flaws`
- `backgrounds`
- `equipment`
- `rules` / `ruleEntries`

## Импорт

В консоли:

```js
game.vtmRevised.importRulesText(jsonText)
```

Или кнопкой в Item Directory: **Импорт справочника правил JSON**.
