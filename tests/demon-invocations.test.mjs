import assert from "node:assert/strict";
import { getDemonInvocation, parseDemonInvocationMechanics } from "../scripts/data/demon/demon-invocations.mjs";

const opposed = parseDemonInvocationMechanics("Манипулирование + Хитрость против Силы Воли цели со сложностью 7. Контроль длится сцену.");
assert.equal(opposed.firstTrait, "attribute.social.manipulation");
assert.equal(opposed.secondTrait, "ability.talents.subterfuge");
assert.equal(opposed.resistanceTrait, "resource.willpower");
assert.equal(opposed.resistanceDifficulty, 7);
assert.equal(opposed.duration, "сцену");

const faith = parseDemonInvocationMechanics("Потратить 1 Веру; Выносливость + Медицина. Действует один день.");
assert.equal(faith.faithCost, 1);
assert.equal(faith.duration, "один день");

assert.equal(getDemonInvocation("awakening", 4).name, "Оживление");
assert.equal(getDemonInvocation("awakening", 4).faithCost, 1);

console.log("✓ demon invocation mechanics tests passed");
