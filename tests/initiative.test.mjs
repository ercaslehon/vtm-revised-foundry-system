import assert from 'node:assert/strict';
const hooks = new Map(), notices = [], messages = [];
globalThis.Hooks = { on(name, fn) { const list=hooks.get(name)??[]; list.push(fn); hooks.set(name,list); }, once() {} };
globalThis.foundry = {utils:{escapeHTML:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')}};
globalThis.ui = { notifications:{warn:s=>notices.push(s)} };
class Collection extends Map { get contents(){return [...this.values()];} [Symbol.iterator](){return this.values();} find(fn){return this.contents.find(fn);} }
const gm={id:'gm',isGM:true,active:true,name:'GM'}, player={id:'player',isGM:false,active:true,name:'Player'}, other={id:'other',isGM:false,active:true};
globalThis.game={user:gm, users:new Collection([[gm.id,gm],[player.id,player],[other.id,other]]),actors:new Collection(),combats:new Collection(),combat:null,settings:{get(){return [];}},modules:new Map()};
function actor(id,owner,type='vampire') {
 const a={id,uuid:`Actor.${id}`,type,documentName:'Actor',name:id,img:'icons/svg/mystery-man.svg',system:{attributes:{physical:{dexterity:{value:3}},mental:{wits:4}}},testUserPermission:u=>u.isGM||u.id===owner};
 Object.defineProperty(a,'isOwner',{get(){return a.testUserPermission(game.user)}});game.actors.set(id,a);return a;
}
const a=actor('a','player'),b=actor('b','other'),d=actor('d','player','demon');
d.system.creation={primaryLore:'flame'}; d.system.apocalypticForm={active:true};
let created=0, rolled=0;
class Combatant { constructor(data,parent) {Object.assign(this,data);this.parent=parent;this.initiative=null;this.visible=true;}get actor(){return game.actors.get(this.actorId);}get isOwner(){return this.actor.isOwner;} }
class Combat {
 constructor(data){Object.assign(this,data);this.id=`combat${++created}`;this.combatants=new Collection();this.round=0;this.turn=null;}
 static async create(data){const c=new this(data);game.combats.set(c.id,c);game.combat=c;await Promise.resolve();return c;}
 get turns(){return this.combatants.contents.sort((a,b)=>(b.initiative??-Infinity)-(a.initiative??-Infinity)||a.id.localeCompare(b.id));}
 get combatant(){return this.turns[this.turn]??null;}
 get started(){return this.round>0;}
 async setFlag(scope,key,value){this.flags??={};this.flags[scope]??={};this.flags[scope][key]=value;}
 async createEmbeddedDocuments(type,rows){assert.equal(type,'Combatant'); await Promise.resolve();for(const row of rows){assert.equal(row.tokenId,null);assert.equal(row.sceneId,null);const c=new CONFIG.Combatant.documentClass({...row,id:`c-${row.actorId}`},this);this.combatants.set(c.id,c);} }
 async rollInitiative(ids){for(const id of ids){const c=this.combatants.get(id);const formula=c._getInitiativeFormula();const parts=formula.split(' + ').slice(1).map(Number);c.initiative=10+parts.reduce((a,b)=>a+b,0);rolled++;}return this;}
 async rollAll(){return this.rollInitiative(this.combatants.contents.filter(c=>c.initiative===null).map(c=>c.id));}
 async startCombat(){this.round=1;this.turn=0;return this;}
 async nextTurn(){if(++this.turn>=this.turns.length){this.turn=0;this.round++;}return this;}
 async previousTurn(){this.turn=Math.max(0,this.turn-1);return this;}
 async deleteEmbeddedDocuments(type,ids){for(const id of ids)this.combatants.delete(id);}
 async delete(){game.combats.delete(this.id);if(game.combat===this)game.combat=null;}
}
globalThis.CONFIG={Combatant:{documentClass:Combatant},Combat:{documentClass:Combat}};
globalThis.ChatMessage={create:async data=>{messages.push(data);return data;}};
const {initiativeFormula,registerInitiative}=await import('../scripts/combat/initiative.mjs');registerInitiative();
const {executeInitiativeCommand,submitInitiativeCommand,rollActorInitiative,enqueueInitiativeRequest}=await import('../scripts/combat/tokenless-combat.mjs');
const {initiativeDockMarkup}=await import('../scripts/combat/initiative-dock.mjs');
assert.equal(initiativeFormula(a),'1d10 + 3 + 4');
assert.equal(initiativeFormula(d),'1d10 + 3 + 4 + 2');
d.system.apocalypticForm.active=false;assert.equal(initiativeFormula(d),'1d10 + 3 + 4');
assert.equal(initiativeFormula(null),'1d10 + 0 + 0');
// No canvas/token globals exist; simultaneous actions create one combat and one actor entry.
await Promise.all([submitInitiativeCommand({action:'add',actorIds:['a','b','a']}),rollActorInitiative(a),rollActorInitiative(a)]);
assert.equal(created,1);assert.equal(game.combat.scene,null);assert.equal(game.combat.combatants.size,2);assert.equal(game.combat.combatants.get('c-a').initiative,17,'10 is a numeric initiative die, not two successes');
const combat=game.combat;
await assert.rejects(()=>executeInitiativeCommand({action:'roll',actorId:'b',total:999},player),/своего/);
await assert.rejects(()=>executeInitiativeCommand({action:'end',combatId:combat.id},player),/Рассказчику/);
await executeInitiativeCommand({action:'roll',actorId:'a',total:999},player);assert.equal(combat.combatants.get('c-a').initiative,17);
await executeInitiativeCommand({action:'start',combatId:combat.id},gm);assert.equal(combat.round,1);assert.equal(combat.turn,0);
const pass={action:'next',combatId:combat.id,combatantId:'c-a',round:1,turn:0};
await assert.rejects(()=>executeInitiativeCommand(pass,other),/другого/);
await executeInitiativeCommand(pass,player);assert.equal(combat.turn,1);
await assert.rejects(()=>executeInitiativeCommand(pass,player),/изменилась/);assert.equal(combat.turn,1);
await executeInitiativeCommand({action:'next',combatId:combat.id,combatantId:'c-b',round:1,turn:1},other);assert.equal(combat.round,2);assert.equal(combat.turn,0);
// Request author comes from ChatMessage, even if the command forges a GM userId.
function request(id,author,command){return{id,author,flags:{'vtm-revised':{type:'initiativeRequest',state:'pending',command}},async update(patch){for(const [k,v]of Object.entries(patch)){if(k==='flags.vtm-revised.state')this.flags['vtm-revised'].state=v;else this[k]=v;}}};}
let req=request('bad',player,{action:'roll',actorId:'b',userId:gm.id});await enqueueInitiativeRequest(req);assert.equal(req.flags['vtm-revised'].state,'failed');
req=request('ok',player,{action:'roll',actorId:'a'});const before=rolled;await Promise.all([enqueueInitiativeRequest(req),enqueueInitiativeRequest(req)]);assert.equal(req.flags['vtm-revised'].state,'completed');assert.equal(rolled,before+1);await enqueueInitiativeRequest(req);assert.equal(rolled,before+1);
req=request('partial',player,{action:'roll',actorId:'a'});req.flags['vtm-revised'].state='processing';await enqueueInitiativeRequest(req);assert.equal(rolled,before+1);
await assert.rejects(()=>executeInitiativeCommand({action:'roll',actorId:'a',combatId:'deleted'},player),/удалён/);
await assert.rejects(()=>executeInitiativeCommand({action:'add',actorIds:['deleted']},gm),/недоступен/);
// Players get their own controls, no hidden opponents and no unescaped names.
game.user=player;combat.combatants.get('c-b').visible=false;combat.combatants.get('c-a').name='<img onerror="bad">';
const html=initiativeDockMarkup(combat);assert.ok(!html.includes('data-action="end"'));assert.ok(!html.includes('data-action="participants"'));assert.ok(!html.includes('data-combatant-id="c-b"'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('data-action="next"'));
await rollActorInitiative(a);assert.equal(messages.at(-1).flags['vtm-revised'].command.actorId,'a');assert.ok(messages.at(-1).whisper.includes('gm'));
gm.active=false;const messageCount=messages.length;await rollActorInitiative(a);assert.equal(messages.length,messageCount);assert.match(notices.at(-1),/Рассказчик/);gm.active=true;
game.user=gm;await executeInitiativeCommand({action:'remove',combatId:combat.id,combatantId:'c-b'},gm);assert.equal(combat.combatants.size,1);await executeInitiativeCommand({action:'end',combatId:combat.id},gm);assert.equal(game.combat,null);assert.equal(game.actors.size,3);
console.log('✓ tokenless combat, formula/form bonus, numeric d10, concurrent additions, ownership, canonical author, duplicate requests, stale turns, round advance, visibility, no-GM and cleanup');
