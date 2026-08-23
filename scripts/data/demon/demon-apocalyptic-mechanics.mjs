import { activeDemonHighTormentIndexes } from "../../combat/combat-math.mjs";
import { DEMON_APOCALYPTIC_FORMS } from "./demon-apocalyptic-forms.mjs";

export const DEMON_APOCALYPTIC_MECHANICS = {
  "celestials": {
    "low": [
      {
        "id": "low-0",
        "label": "Крылья"
      },
      {
        "id": "low-1",
        "label": "Величественный облик",
        "roll": {
          "attribute.social.charisma": {
            "difficulty": -2
          },
          "attribute.social.manipulation": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-2",
        "label": "Улучшенное восприятие",
        "roll": {
          "attribute.mental.perception": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Повышенная осведомленность",
        "roll": {
          "ability.talents.awareness": {
            "difficulty": -2
          }
        }
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Когти / Зубы"
      },
      {
        "id": "high-1",
        "label": "Чешуя",
        "armor": {
          "dice": 4,
          "aggravated": false
        }
      },
      {
        "id": "high-2",
        "label": "Увеличение размеров",
        "roll": {
          "attribute.physical.strength": {
            "dice": 1
          },
          "attribute.physical.dexterity": {
            "dice": 2
          },
          "attribute.physical.stamina": {
            "dice": 1
          }
        }
      },
      {
        "id": "high-3",
        "label": "Ужасный взгляд"
      }
    ]
  },
  "flame": {
    "low": [
      {
        "id": "low-0",
        "label": "Покров Пламени"
      },
      {
        "id": "low-1",
        "label": "Устойчивость к огню"
      },
      {
        "id": "low-2",
        "label": "Дополнительные действия"
      },
      {
        "id": "low-3",
        "label": "Улучшенная инициатива"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Когти / Зубы"
      },
      {
        "id": "high-1",
        "label": "Хвост-кнут"
      },
      {
        "id": "high-2",
        "label": "Увеличение размеров",
        "roll": {
          "attribute.physical.strength": {
            "dice": 2
          },
          "attribute.physical.dexterity": {
            "dice": 1
          },
          "attribute.physical.stamina": {
            "dice": 1
          }
        }
      },
      {
        "id": "high-3",
        "label": "Горящая кровь"
      }
    ]
  },
  "radiance": {
    "low": [
      {
        "id": "low-0",
        "label": "Крылья"
      },
      {
        "id": "low-1",
        "label": "Сверхъестественное обаяние",
        "roll": {
          "attribute.social.charisma": {
            "dice": 2
          },
          "attribute.social.manipulation": {
            "dice": 1
          },
          "attribute.social.appearance": {
            "dice": 1
          }
        }
      },
      {
        "id": "low-2",
        "label": "Сияющая аура"
      },
      {
        "id": "low-3",
        "label": "Нахождение сокрытого",
        "roll": {
          "attribute.mental.perception": {
            "difficulty": -2
          }
        }
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Голос Проклятых",
        "roll": {
          "ability.talents.intimidation": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "high-1",
        "label": "Без отражения"
      },
      {
        "id": "high-2",
        "label": "Разрушающий плевок"
      },
      {
        "id": "high-3",
        "label": "Рога"
      }
    ]
  },
  "awakening": {
    "low": [
      {
        "id": "low-0",
        "label": "Аура жизни"
      },
      {
        "id": "low-1",
        "label": "Без следов",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-2",
        "label": "Улучшенные физические способности",
        "roll": {
          "attribute.physical.strength": {
            "dice": 1
          },
          "attribute.physical.dexterity": {
            "dice": 1
          },
          "attribute.physical.stamina": {
            "dice": 1
          }
        }
      },
      {
        "id": "low-3",
        "label": "Крылья"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Миазмы"
      },
      {
        "id": "high-1",
        "label": "Дополнительные уровни здоровья"
      },
      {
        "id": "high-2",
        "label": "Вязкая плоть"
      },
      {
        "id": "high-3",
        "label": "Дополнительные конечности"
      }
    ]
  },
  "firmament": {
    "low": [
      {
        "id": "low-0",
        "label": "Обостренные чувства",
        "roll": {
          "attribute.mental.perception": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-1",
        "label": "Крылья"
      },
      {
        "id": "low-2",
        "label": "Повышенная интуиция",
        "roll": {
          "ability.talents.intuition": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Улучшенный уворот",
        "roll": {
          "ability.talents.dodge": {
            "difficulty": -2
          }
        }
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Плащ теней",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "high-1",
        "label": "Много глаз"
      },
      {
        "id": "high-2",
        "label": "Улучшенная Инициатива"
      },
      {
        "id": "high-3",
        "label": "Когти"
      }
    ]
  },
  "winds": {
    "low": [
      {
        "id": "low-0",
        "label": "Сверхъестественное зрение",
        "roll": {
          "attribute.mental.perception": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-1",
        "label": "Крылья"
      },
      {
        "id": "low-2",
        "label": "Хорошее равновесие",
        "roll": {
          "ability.talents.athletics": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Невосприимчивость к падениям"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Когти"
      },
      {
        "id": "high-1",
        "label": "Дополнительные действия"
      },
      {
        "id": "high-2",
        "label": "Перья"
      },
      {
        "id": "high-3",
        "label": "Ядовитая желчь"
      }
    ]
  },
  "earth": {
    "low": [
      {
        "id": "low-0",
        "label": "Увеличенный размер",
        "roll": {
          "attribute.physical.strength": {
            "dice": 2
          },
          "attribute.physical.dexterity": {
            "dice": 1
          },
          "attribute.physical.stamina": {
            "dice": 1
          }
        }
      },
      {
        "id": "low-1",
        "label": "Невосприимчивость к поверхностным повреждениям"
      },
      {
        "id": "low-2",
        "label": "Неодолимая сила",
        "roll": {
          "attribute.physical.strength": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Ночное зрение"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Дополнительные конечности"
      },
      {
        "id": "high-1",
        "label": "Бездонное чрево"
      },
      {
        "id": "high-2",
        "label": "Шипы"
      },
      {
        "id": "high-3",
        "label": "Ихор"
      }
    ]
  },
  "paths": {
    "low": [
      {
        "id": "low-0",
        "label": "Знание координат"
      },
      {
        "id": "low-1",
        "label": "Улучшенное Восприятие",
        "roll": {
          "attribute.mental.perception": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-2",
        "label": "Улучшенная Инициатива"
      },
      {
        "id": "low-3",
        "label": "Ловкие пальцы"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Без следов",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "high-1",
        "label": "Изменение размеров"
      },
      {
        "id": "high-2",
        "label": "Мираж"
      },
      {
        "id": "high-3",
        "label": "Неутомимость"
      }
    ]
  },
  "forge": {
    "low": [
      {
        "id": "low-0",
        "label": "Великий мастер",
        "roll": {
          "ability.skills.crafts": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-1",
        "label": "Увеличенный размер",
        "roll": {
          "attribute.physical.strength": {
            "dice": 2
          },
          "attribute.physical.dexterity": {
            "dice": 1
          },
          "attribute.physical.stamina": {
            "dice": 1
          }
        }
      },
      {
        "id": "low-2",
        "label": "Громовой голос"
      },
      {
        "id": "low-3",
        "label": "Невосприимчивость к огню"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Лезвия"
      },
      {
        "id": "high-1",
        "label": "Дополнительные конечности"
      },
      {
        "id": "high-2",
        "label": "Магнитное поле"
      },
      {
        "id": "high-3",
        "label": "Железная шкура"
      }
    ]
  },
  "patterns": {
    "low": [
      {
        "id": "low-0",
        "label": "Крылья"
      },
      {
        "id": "low-1",
        "label": "Улучшенная инициатива"
      },
      {
        "id": "low-2",
        "label": "Повышенная интуиция",
        "roll": {
          "ability.talents.intuition": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Острота ума",
        "roll": {
          "attribute.mental.perception": {
            "dice": 2
          },
          "attribute.mental.intelligence": {
            "dice": 1
          },
          "attribute.mental.wits": {
            "dice": 1
          }
        }
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Аура неудачи"
      },
      {
        "id": "high-1",
        "label": "Дополнительные действия"
      },
      {
        "id": "high-2",
        "label": "Дополнительные конечности"
      },
      {
        "id": "high-3",
        "label": "Тонкие намеки",
        "roll": {
          "ability.talents.subterfuge": {
            "difficulty": -2
          }
        }
      }
    ]
  },
  "portals": {
    "low": [
      {
        "id": "low-0",
        "label": "Без следов",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-1",
        "label": "Улучшенное восприятие",
        "roll": {
          "attribute.mental.perception": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-2",
        "label": "Повышенная осведомленность",
        "roll": {
          "ability.talents.awareness": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Крылья"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Плащ теней",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "high-1",
        "label": "Улучшенная инициатива"
      },
      {
        "id": "high-2",
        "label": "Улучшенный уворот",
        "roll": {
          "ability.talents.dodge": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "high-3",
        "label": "Без отражения"
      }
    ]
  },
  "light": {
    "low": [
      {
        "id": "low-0",
        "label": "Острота ума",
        "roll": {
          "attribute.mental.perception": {
            "dice": 1
          },
          "attribute.mental.intelligence": {
            "dice": 2
          },
          "attribute.mental.wits": {
            "dice": 1
          }
        }
      },
      {
        "id": "low-1",
        "label": "Ночное зрение"
      },
      {
        "id": "low-2",
        "label": "Изменчивая аура",
        "roll": {
          "ability.talents.dodge": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Неземное великолепие",
        "roll": {
          "attribute.social.manipulation": {
            "difficulty": -2
          }
        }
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Сумеречные видения"
      },
      {
        "id": "high-1",
        "label": "Грозный вид",
        "roll": {
          "ability.talents.intimidation": {
            "difficulty": -2
          },
          "ability.talents.leadership": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "high-2",
        "label": "Атака призраков"
      },
      {
        "id": "high-3",
        "label": "Без отражения"
      }
    ]
  },
  "longing": {
    "low": [
      {
        "id": "low-0",
        "label": "Улучшенные социальные характеристики",
        "roll": {
          "attribute.social.charisma": {
            "dice": 2
          },
          "attribute.social.manipulation": {
            "dice": 1
          },
          "attribute.social.appearance": {
            "dice": 2
          }
        }
      },
      {
        "id": "low-1",
        "label": "Музыкальный голос",
        "roll": {
          "ability.talents.leadership": {
            "difficulty": -2
          },
          "ability.talents.subterfuge": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-2",
        "label": "Повышенная чувствительность",
        "roll": {
          "attribute.mental.perception": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Повышенная интуиция",
        "roll": {
          "ability.talents.intuition": {
            "difficulty": -2
          }
        }
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Когти"
      },
      {
        "id": "high-1",
        "label": "Яд"
      },
      {
        "id": "high-2",
        "label": "Дополнительные конечности"
      },
      {
        "id": "high-3",
        "label": "Без отражения"
      }
    ]
  },
  "storms": {
    "low": [
      {
        "id": "low-0",
        "label": "Чувствовать погоду"
      },
      {
        "id": "low-1",
        "label": "Невосприимчивость к электричеству"
      },
      {
        "id": "low-2",
        "label": "Улучшенная Инициатива"
      },
      {
        "id": "low-3",
        "label": "Удар током"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Зубы"
      },
      {
        "id": "high-1",
        "label": "Шипы"
      },
      {
        "id": "high-2",
        "label": "Акулья кожа"
      },
      {
        "id": "high-3",
        "label": "Чернильное облако"
      }
    ]
  },
  "transfiguration": {
    "low": [
      {
        "id": "low-0",
        "label": "Повышенная Эмпатия",
        "roll": {
          "ability.talents.empathy": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-1",
        "label": "Без отражения"
      },
      {
        "id": "low-2",
        "label": "Без следов",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Улучшенная Ловкость",
        "roll": {
          "attribute.physical.dexterity": {
            "dice": 2
          }
        }
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Когти/ Зубы"
      },
      {
        "id": "high-1",
        "label": "Улучшенная инициатива"
      },
      {
        "id": "high-2",
        "label": "Яд"
      },
      {
        "id": "high-3",
        "label": "Дополнительные действия"
      }
    ]
  },
  "beast": {
    "low": [
      {
        "id": "low-0",
        "label": "Увеличение размеров",
        "roll": {
          "attribute.physical.strength": {
            "dice": 2
          },
          "attribute.physical.dexterity": {
            "dice": 2
          },
          "attribute.physical.stamina": {
            "dice": 1
          }
        }
      },
      {
        "id": "low-1",
        "label": "Повышенная чувствительность",
        "roll": {
          "attribute.mental.perception": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-2",
        "label": "Когти/ Зубы"
      },
      {
        "id": "low-3",
        "label": "Дополнительные действия"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Железная шкура"
      },
      {
        "id": "high-1",
        "label": "Бездонное чрево"
      },
      {
        "id": "high-2",
        "label": "Дополнительные конечности"
      },
      {
        "id": "high-3",
        "label": "Кожа хамелеона",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      }
    ]
  },
  "wild": {
    "low": [
      {
        "id": "low-0",
        "label": "Повышенная чувствительность",
        "roll": {
          "attribute.mental.perception": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-1",
        "label": "Кожа хамелеона",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-2",
        "label": "Без следов",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Дополнительные уровни здоровья"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Шипы"
      },
      {
        "id": "high-1",
        "label": "Увеличение размеров",
        "roll": {
          "attribute.physical.strength": {
            "dice": 1
          },
          "attribute.physical.dexterity": {
            "dice": 2
          },
          "attribute.physical.stamina": {
            "dice": 1
          }
        }
      },
      {
        "id": "high-2",
        "label": "Дополнительные конечности"
      },
      {
        "id": "high-3",
        "label": "Яд"
      }
    ]
  },
  "flesh": {
    "low": [
      {
        "id": "low-0",
        "label": "Увеличенные Социальные характеристики",
        "roll": {
          "attribute.social.charisma": {
            "dice": 1
          },
          "attribute.social.manipulation": {
            "dice": 1
          },
          "attribute.social.appearance": {
            "dice": 2
          }
        }
      },
      {
        "id": "low-1",
        "label": "Невосприимчивость к ядам"
      },
      {
        "id": "low-2",
        "label": "Улучшенная инициатива"
      },
      {
        "id": "low-3",
        "label": "Без отражения"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Дополнительные уровни здоровья"
      },
      {
        "id": "high-1",
        "label": "Броня"
      },
      {
        "id": "high-2",
        "label": "Бездонное чрево"
      },
      {
        "id": "high-3",
        "label": "Регенерация"
      }
    ]
  },
  "death": {
    "low": [
      {
        "id": "low-0",
        "label": "Крылья"
      },
      {
        "id": "low-1",
        "label": "Улучшенная инициатива"
      },
      {
        "id": "low-2",
        "label": "Без следов",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Без отражения"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Плащ теней",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "high-1",
        "label": "Смертельная хватка"
      },
      {
        "id": "high-2",
        "label": "Аура энтропии"
      },
      {
        "id": "high-3",
        "label": "Сопротивление повреждениям"
      }
    ]
  },
  "spirit": {
    "low": [
      {
        "id": "low-0",
        "label": "Видеть призраков"
      },
      {
        "id": "low-1",
        "label": "Улучшенные Социальные характеристики",
        "roll": {
          "attribute.social.charisma": {
            "dice": 2
          },
          "attribute.social.manipulation": {
            "dice": 1
          },
          "attribute.social.appearance": {
            "dice": 1
          }
        }
      },
      {
        "id": "low-2",
        "label": "Без следов",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Крылья"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Плащ теней",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "high-1",
        "label": "Голос проклятых",
        "roll": {
          "ability.talents.intimidation": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "high-2",
        "label": "Аура страха"
      },
      {
        "id": "high-3",
        "label": "Сопротивление повреждениям"
      }
    ]
  },
  "realms": {
    "low": [
      {
        "id": "low-0",
        "label": "Точный расчет"
      },
      {
        "id": "low-1",
        "label": "Без следов",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-2",
        "label": "Повышенная Осведомленность",
        "roll": {
          "ability.talents.awareness": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "low-3",
        "label": "Ловкие пальцы"
      }
    ],
    "high": [
      {
        "id": "high-0",
        "label": "Плащ теней",
        "roll": {
          "ability.skills.stealth": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "high-1",
        "label": "Неутомимость"
      },
      {
        "id": "high-2",
        "label": "Глас из могилы",
        "roll": {
          "ability.talents.intimidation": {
            "difficulty": -2
          }
        }
      },
      {
        "id": "high-3",
        "label": "Ужасный взгляд"
      }
    ]
  }
};

const SHARED_ABILITY_MECHANICS = {
  "улучшенная инициатива": { initiative: 2 },
  "дополнительные действия": { extraActions: { resource: "faith", costPerAction: 1 } },
  "дополнительные уровни здоровья": { healthLevels: 3 },
  "железная шкура": { armor: { dice: 4, aggravated: true } },
  "акулья кожа": { armor: { dice: 4, aggravated: true } },
  "броня": { armor: { dice: 4, aggravated: true } },
  "невосприимчивость к огню": { immunities: ["fire"] },
  "устойчивость к огню": { immunities: ["fire"] },
  "невосприимчивость к электричеству": { immunities: ["electricity"] },
  "невосприимчивость к ядам": { immunities: ["poison"] },
  "невосприимчивость к падениям": { immunities: ["falling"] },
  "невосприимчивость к поверхностным повреждениям": { immunities: ["bashing"] },
  "крылья": { movement: { glideRunMultiplier: 3 } },
  "когти / зубы": { naturalAttack: { usesStrength: true, damageBonus: 2, damageType: "aggravated", difficulty: 6 } },
  "когти/ зубы": { naturalAttack: { usesStrength: true, damageBonus: 2, damageType: "aggravated", difficulty: 6 } },
  "когти": { naturalAttack: { usesStrength: true, damageBonus: 2, damageType: "aggravated", difficulty: 6 } },
  "зубы": { naturalAttack: { usesStrength: true, damageBonus: 2, damageType: "aggravated", difficulty: 6 } },
  "хвост-кнут": { naturalAttack: { usesStrength: true, damageBonus: -1, damageType: "aggravated", difficulty: 6 } },
  "рога": { naturalAttack: { usesStrength: true, damageBonus: -1, damageType: "aggravated", difficulty: 6 } }
};

const normalizeLabel = value => String(value ?? "").trim().toLowerCase().replaceAll("ё", "е");

export function getDemonFormAbilityMechanic(loreKey, tier, index) {
  const mechanic = DEMON_APOCALYPTIC_MECHANICS?.[String(loreKey)]?.[tier]?.[Number(index)] ?? null;
  if (!mechanic) return null;
  const shared = SHARED_ABILITY_MECHANICS[normalizeLabel(mechanic.label)] ?? {};
  return { ...shared, ...mechanic, armor: mechanic.armor ?? shared.armor };
}

export function getActiveDemonFormAbilities(actor) {
  if (!actor?.system?.apocalypticForm?.active) return [];
  const loreKey = String(actor.system?.creation?.primaryLore ?? "").trim();
  const form = DEMON_APOCALYPTIC_FORMS[loreKey];
  if (!form) return [];
  const selectedHigh = new Set(activeDemonHighTormentIndexes(actor.system?.resources?.torment?.max, actor.system?.apocalypticForm?.highTormentSelected));
  return [
    ...(form.abilities ?? []).map((description, index) => ({ loreKey, formName: form.name, tier: "low", index, description, mechanic: getDemonFormAbilityMechanic(loreKey, "low", index) })),
    ...(form.highTormentAbilities ?? []).map((description, index) => selectedHigh.has(String(index)) ? ({ loreKey, formName: form.name, tier: "high", index, description, mechanic: getDemonFormAbilityMechanic(loreKey, "high", index) }) : null).filter(Boolean)
  ];
}

export function getActiveDemonFormSummary(actor) {
  const abilities = getActiveDemonFormAbilities(actor);
  const summary = { abilities, initiative: 0, healthLevels: 0, armor: 0, aggravatedArmor: 0, immunities: [], extraActions: false, naturalAttacks: [] };
  for (const ability of abilities) {
    const mechanic = ability.mechanic ?? {};
    summary.initiative += Number(mechanic.initiative || 0);
    summary.healthLevels += Number(mechanic.healthLevels || 0);
    summary.armor += Number(mechanic.armor?.dice || 0);
    if (mechanic.armor?.aggravated) summary.aggravatedArmor += Number(mechanic.armor.dice || 0);
    summary.immunities.push(...(mechanic.immunities ?? []));
    if (mechanic.extraActions) summary.extraActions = true;
    if (mechanic.naturalAttack) summary.naturalAttacks.push(ability);
  }
  summary.immunities = [...new Set(summary.immunities)];
  return summary;
}
