const NUMBER_WORDS = new Map([["один",1],["одна",1],["единицу",1],["два",2],["две",2],["три",3],["четыре",4],["пять",5]]);
const TRAIT_TERMS = {
  "attribute.physical.strength":["силы","силу","сила"], "attribute.physical.dexterity":["ловкости","ловкость"],
  "attribute.physical.stamina":["выносливости","выносливость","поглощен","поглощать"], "attribute.social.charisma":["обаяния","обаяние"],
  "attribute.social.manipulation":["манипулирования","манипулирование"], "attribute.social.appearance":["внешности","внешность"],
  "attribute.mental.perception":["восприятия","восприятие","зрением","слухом"], "attribute.mental.intelligence":["интеллекта","интеллект"],
  "attribute.mental.wits":["сообразительности","сообразительность"], "ability.talents.alertness":["бдительности","бдительность"],
  "ability.talents.athletics":["атлетики","атлетика","атлетизма","атлетизм"], "ability.talents.brawl":["драки","драка","рукопаш"],
  "ability.talents.dodge":["уклонения","уклонение","уворота","уворот"], "ability.talents.empathy":["эмпатии","эмпатия"],
  "ability.talents.expression":["выразительности","выразительность"], "ability.talents.intimidation":["запугивания","запугивание"],
  "ability.talents.leadership":["лидерства","лидерство"], "ability.talents.streetwise":["знания улиц","знание улиц","знания улицы"],
  "ability.talents.subterfuge":["хитрости","хитрость"], "ability.skills.animalken":["знания животных","знание животных"],
  "ability.skills.crafts":["ремесла","ремесло"], "ability.skills.drive":["вождения","вождение"], "ability.skills.etiquette":["этикета","этикет"],
  "ability.skills.firearms":["огнестрельного оружия","огнестрельное оружие"], "ability.skills.melee":["фехтования","фехтование","холодного оружия"],
  "ability.skills.performance":["исполнения","актерства","актёрства"], "ability.skills.security":["безопасности","безопасность"],
  "ability.skills.stealth":["скрытности","скрытность","маскировки","маскировка"], "ability.skills.survival":["выживания","выживание"],
  "ability.knowledges.academics":["академических наук","гуманитарных наук"], "ability.knowledges.computer":["компьютера","компьютеры"],
  "ability.knowledges.finance":["финансов","финансы"], "ability.knowledges.investigation":["расследования","расследование"],
  "ability.knowledges.law":["правоведения"], "ability.knowledges.linguistics":["лингвистики","лингвистика","языков","языка"],
  "ability.knowledges.medicine":["медицины","медицина"], "ability.knowledges.occult":["оккультизма","оккультизм"],
  "ability.knowledges.politics":["политики","политика"], "ability.knowledges.science":["естественных наук"], "resource.willpower":["силы воли","сила воли"]
};
const NAME_OVERRIDES = {
  "кошачья грация": { selectors:["attribute.physical.dexterity","ability.talents.athletics"], matchAll:true, difficulty:-2, note:"Только для бросков Ловкость + Атлетика, связанных с равновесием." },
  "кошачье равновесие": { selectors:["attribute.physical.dexterity","ability.talents.athletics"], matchAll:true, difficulty:-2, note:"Только для бросков Ловкость + Атлетика, связанных с равновесием." },
  "холодная логика": { selectors:["attribute.mental.perception","ability.talents.empathy"], difficulty:-1, note:"Только для определения обмана." },
  "компьютерная одаренность": { selectors:["ability.knowledges.computer"], difficulty:-2, note:"Для бросков, требующих работы с компьютером." },
  "умение обращаться с компьютером": { selectors:["ability.knowledges.computer"], difficulty:-2, note:"Для бросков, требующих работы с компьютером." },
  "толстокожий": { applicable:false, selectors:[], note:"Модифицирует входящий бросок Присутствия, а не собственный бросок персонажа." },
  "изучающий врагов": { selectors:["ability.knowledges.*"], difficulty:-2, note:"Только знания о выбранном враге Камарильи; для других врагов применяется +1 вручную." },
  "знаток врагов": { selectors:["ability.knowledges.*"], difficulty:-2, note:"Только небоевые знания о выбранном враге Секты." },
  "бывший гуль": { selectors:["ability.knowledges.occult"], difficulty:-2, note:"Только сведения о сообществе каинитов и силах Крови." },
  "друг подземелий": { selectors:["ability.talents.streetwise","ability.skills.stealth","ability.knowledges.investigation"], difficulty:-1, note:"Только ориентация и действия в подземных коммуникациях родного города." },
  "чарующий голос": { selectors:["attribute.social.*"], difficulty:-2, note:"Только убеждение, очарование или командование посредством голоса." },
  "нарушение речи": { selectors:["attribute.social.*"], difficulty:2, note:"Только вербальное общение." },
  "робость": { selectors:["attribute.social.*"], difficulty:2, note:"Социальное взаимодействие с незнакомцами; в центре большой группы штраф может стать +3." },
  "зловещее присутствие": { selectors:["attribute.social.*"], difficulty:2, note:"Только социальное взаимодействие со смертными." },
  "могильный запах": { selectors:["attribute.social.*"], difficulty:1, note:"Только социальные действия со смертными рядом с персонажем." },
  "запах могилы": { selectors:["attribute.social.*"], difficulty:1, note:"Только социальные действия со смертными рядом с персонажем." },
  "уродство": { selectors:["attribute.social.*"], difficulty:2, note:"Только социальное взаимодействие." },
  "плохое зрение": { selectors:["attribute.mental.perception","ability.talents.alertness"], difficulty:2, note:"Только действия, зависящие от зрения." },
  "тугоухость": { selectors:["attribute.mental.perception","ability.talents.alertness"], difficulty:2, note:"Только действия, зависящие от слуха." },
  "заражение паразитами": { selectors:["resource.willpower"], difficulty:1, note:"Только броски Самоконтроля; ночная потеря крови обрабатывается отдельно." },
  "вспыльчивость": { selectors:["resource.willpower"], difficulty:2, note:"Только сопротивление Безумию." },
  "миролюбивость": { selectors:["resource.willpower"], dice:2, note:"Только сопротивление Безумию." },
  "холодное сердце": { selectors:["resource.willpower"], dice:2, note:"Только сопротивление Безумию." },
  "железная воля": { selectors:["resource.willpower"], dice:3, note:"Только сопротивление магии, влияющей на разум." },
  "обостренное чувство": { selectors:["attribute.mental.perception","ability.talents.alertness"], difficulty:-2, note:"Только для выбранного при покупке обострённого чувства." },
  "иссохшая нога": { selectors:["attribute.physical.dexterity","ability.talents.athletics","ability.talents.dodge"], dice:-3, note:"Только действия, требующие движения." },
  "сорвиголова": { selectors:["*"], dice:3, note:"Только особенно рискованные действия по решению Рассказчика." },
  "глубокий сон": { selectors:["resource.willpower"], difficulty:2, note:"Только попытка проснуться днём." },
  "крепкий сон": { selectors:["resource.willpower"], difficulty:2, note:"Только попытка проснуться днём." },
  "зов посейдона": { selectors:["resource.willpower"], note:"Только сопротивление Безумию; модификатор зависит от погоды и выбирается вручную." },
  "свирепый изувер": { selectors:["resource.willpower"], difficulty:2, note:"Только сопротивление Безумию рядом с ненавидимой группой смертных." },
  "атрофированное сердце": { applicable:false, selectors:[], note:"Изменяет проверки дегенерации, а не обычные броски листа." },
  "холодный ветер": { selectors:["attribute.social.*"], difficulty:1, note:"Только соответствующие социальные броски со смертными." },
  "конкурирующий сир": { applicable:false, selectors:[], note:"Усложняет сопротивление Безумию другого персонажа, а не владельца Недостатка." },
  "стукач": { selectors:["attribute.social.*"], difficulty:1, note:"Только социальные броски с теми, кто знает репутацию персонажа." },
  "одаренный": { applicable:false, selectors:[], note:"Требуется указать выбранную при покупке Способность." },
  "одаренный в дисциплине": { applicable:false, selectors:[], note:"Применяется в карточке выбранной Дисциплины, а не к любому броску." },
  "естественная податливость": { applicable:false, selectors:[], note:"Применяется при использовании Изменчивости на себе." },
  "магическая сопротивляемость": { applicable:false, selectors:[], note:"Изменяет входящий бросок магии, направленной на персонажа." },
  "сопротивляемость магии": { applicable:false, selectors:[], note:"Изменяет входящий бросок выбранной магической практики." },
  "обоерукость": { selectors:["attribute.physical.dexterity","ability.skills.melee","ability.skills.firearms"], note:"Убирает ситуационный штраф за неправильную руку; числовой штраф задаёт Рассказчик." }
  ,"одержимый ученый": { selectors:["ability.knowledges.*","ability.skills.*","attribute.social.*"], note:"Для выбранной специализации сложность −3; для большинства социальных бросков при свидетелях увлечения сложность +1. Выбери применимое значение вручную." }
};
const stripHtml = value => String(value ?? "").replace(/<[^>]*>/g," ").replace(/&quot;/g,'"').replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
const normalize = value => stripHtml(value).toLocaleLowerCase("ru-RU").replaceAll("ё","е").replace(/т\.\s*е\./gu,"то есть").replace(/т\.\s*к\./gu,"так как");
const selectorMatches = (selector, trait) => selector === "*" || (selector.endsWith(".*") ? trait.startsWith(selector.slice(0,-1)) : selector === trait);
function numberValue(raw="") { const value=normalize(raw); const digit=value.match(/\d+/)?.[0]; if(digit) return Number(digit); for(const [word,n] of NUMBER_WORDS) if(new RegExp(`(?:^|[^а-я])${word}(?:$|[^а-я])`,`u`).test(value)) return n; return 0; }
function signedDifficulty(text) {
  const forward=[...text.matchAll(/сложност[^.!?]{0,100}?(сниж|пониж|уменьш|повыш|увелич|возраст)[^.!?]{0,45}?(\d+|один|одна|единицу|два|две|три|четыре|пять)/giu)];
  const reverse=[...text.matchAll(/(сниж|пониж|уменьш|повыш|увелич|возраст)[^.!?]{0,45}?сложност[^.!?]{0,35}?(\d+|один|одна|единицу|два|две|три|четыре|пять)/giu)];
  const values=[...forward,...reverse].map(m=>(/(сниж|пониж|уменьш)/i.test(m[1])?-1:1)*numberValue(m[2])).filter(Boolean); return new Set(values).size===1?values[0]:0;
}
function signedDice(text) {
  const plus=[...text.matchAll(/(?:добав|получ|дает|даёт)[^.!?]{0,55}?(\d+|один|одна|единицу|два|две|три|четыре|пять)[^.!?]{0,24}?куб/giu)].map(m=>numberValue(m[1]));
  const minus=[...text.matchAll(/(?:теря|вычит|штраф)[^.!?]{0,45}?(\d+|один|одна|единицу|два|две|три|четыре|пять)[^.!?]{0,24}?куб/giu)].map(m=>-numberValue(m[1]));
  const values=[...plus,...minus].filter(Boolean); return new Set(values).size===1?values[0]:0;
}
function inferSelectors(text) {
  const selectors=[]; for(const [selector,terms] of Object.entries(TRAIT_TERMS)) if(terms.some(term=>text.includes(normalize(term)))) selectors.push(selector);
  if(/социальн\w* брос|социальн\w* действ|социальн\w* взаимодейств/u.test(text)) selectors.push("attribute.social.*");
  if(/физическ\w* брос|физическ\w* действ/u.test(text)) selectors.push("attribute.physical.*");
  if(/ментальн\w* брос|умственн\w* брос/u.test(text)) selectors.push("attribute.mental.*");
  if(/боев\w* брос/u.test(text)) selectors.push("attribute.physical.*","ability.talents.brawl","ability.talents.dodge","ability.skills.melee","ability.skills.firearms");
  if(!selectors.length&&/люб\w* брос|всех брос|все брос|кажд\w* брос|любой запас куб/u.test(text)) selectors.push("*"); return [...new Set(selectors)];
}
function mechanicText(text) {
  const sentences=text.split(/(?<=[.!?])\s+/u);
  const relevant=sentences.filter(sentence=>/брос|куб|сложност/u.test(sentence));
  return relevant.join(" ")||text;
}
function requiresAllSelectors(text, selectors) {
  if(selectors.length<2) return false;
  return /[а-я]+\s*\+\s*[а-я]+/u.test(text);
}
export function deriveVampireRollEffect(item) {
  const system=item?.system&&typeof item.system==="object"?item.system:(item??{}); const source=stripHtml(system.description?.system||system.description?.value||system.description||system.system||""); const text=normalize(source); const mechanical=mechanicText(text); const stored=system.effect??{};
  const override=NAME_OVERRIDES[normalize(item?.name||system.name||"")];
  if(override) return { applicable:override.applicable!==false,dice:Number(override.dice||0),difficulty:Number(override.difficulty||0),automatic:false,conditional:true,matchAll:false,...override };
  const catalogEffect=VAMPIRE_ROLL_EFFECTS_BY_NAME[normalize(item?.name||system.name||"")];
  if(!source&&catalogEffect) return { automatic:false,conditional:true,matchAll:false,dice:0,difficulty:0,...catalogEffect };
  const inferredSelectors=inferSelectors(mechanical); const storedSelectors=Array.isArray(stored.selectors)?stored.selectors.filter(Boolean):[];
  const storedIsBroad=storedSelectors.includes("*")&&inferredSelectors.some(selector=>selector!=="*");
  const selectors=storedSelectors.length&&!storedIsBroad?storedSelectors:inferredSelectors;
  const dice=Number(stored.diceModifier||0)||signedDice(mechanical); const difficulty=Number(stored.difficultyModifier||0)||signedDifficulty(mechanical);
  const inferredApplicable=Boolean(/брос|куб|сложност/u.test(text)&&(selectors.length||dice||difficulty));
  const applicable=Boolean(stored.appliesToRoll||inferredApplicable);
  const storedNote=stripHtml(stored.notes); const note=storedNote&&!/автоматический эффект не задан/i.test(storedNote)?storedNote:source;
  const matchAll=Boolean(stored.matchAll||requiresAllSelectors(mechanical,selectors));
  return { applicable,selectors,matchAll,dice,difficulty,automatic:Boolean(stored.automatic),conditional:Boolean(stored.conditional??true),note };
}
export function getVampireRollEffects(actor,traitKeys=[]) {
  const traits=traitKeys.filter(Boolean); return Array.from(actor?.items??[]).filter(item=>["merit","flaw"].includes(item.type)).flatMap(item=>{ const effect=deriveVampireRollEffect(item); const matches=effect.matchAll?effect.selectors.every(selector=>traits.some(trait=>selectorMatches(selector,trait))):effect.selectors.some(selector=>traits.some(trait=>selectorMatches(selector,trait))); if(!effect.applicable||!matches) return []; return [{type:item.type,key:item.id,label:item.name,mechanics:effect.note,...effect}]; });
}
import { VAMPIRE_ROLL_EFFECTS_BY_NAME } from "./vampire-roll-effects.generated.mjs";
