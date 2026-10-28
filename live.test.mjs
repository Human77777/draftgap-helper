import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseLivePage,parseLineups,LineupRequiredError,draftFromLive} from './live-source.mjs';
const html=await fs.readFile(new URL('./fixtures/live.html',import.meta.url),'utf8');
const dictionary=JSON.parse(await fs.readFile(new URL('./champions.json',import.meta.url),'utf8')).data;
const lineups=parseLineups(await fs.readFile(new URL('./fixtures/lineups.html',import.meta.url),'utf8'));
test('从真实直播区提取双方十人和当前局数',()=>{
 const live=parseLivePage(html);
 assert.equal(live.matchId,'115660540726095061');assert.equal(live.game,1);
 assert.equal(live.blueTeam,'T1');assert.equal(live.redTeam,'MKOI');
 assert.deepEqual(live.blue.map(x=>x.champion),['Ambessa','LeeSin','Syndra','Xayah','Nautilus']);
 const d=draftFromLive(live,dictionary);
 assert.equal(d.ally,'799,64,134,498,111');assert.equal(d.opponent,'150,246,84,145,12');
});
test('没有正在进行的当前局时不采用旧阵容',()=>{
 assert.equal(parseLivePage(html.replace('Live now','Latest match')),null);
 assert.equal(parseLivePage(html.replace('in progress','completed')),null);
 assert.equal(parseLivePage('<p>Game 1 · in progress</p>'),null);
});
test('重复英雄和红蓝方结构变化时拒绝录入',()=>{
 assert.throws(()=>parseLivePage(html.replace(/champion%2FGnar%2F/g,'champion%2FAmbessa%2F')),/重复英雄/);
 assert.throws(()=>parseLivePage(html.replace('class="sd red"','class="sd blue"')),/红蓝方格式/);
});
test('跨局数和阵容变动时生成新指纹，同一局不随经济数据重复填入',()=>{
 const a=draftFromLive(parseLivePage(html),dictionary);
 assert.equal(a.fingerprint,draftFromLive(parseLivePage(html.replace('19.1k','21.1k')),dictionary).fingerprint);
 assert.notEqual(a.fingerprint,draftFromLive(parseLivePage(html.replace('Game 1','Game 2')),dictionary).fingerprint);
});
test('英雄字典缺失时明确报错，不猜 ID',()=>{assert.throws(()=>draftFromLive(parseLivePage(html),{}),/缺少英雄/);});
test('九人阵容保留缺失的中单位，不把 ADC 往前挤',()=>{
 const partial=html.replace(/<img[^>]*title="Faker · Syndra"[^>]*>/,'');
 assert.throws(()=>parseLivePage(partial),e=>e instanceof LineupRequiredError&&e.matchId==='115660540726095061');
 const live=parseLivePage(partial,lineups);
 assert.equal(live.pickedCount,9);assert.equal(live.complete,false);
 assert.equal(live.blue[2],null);assert.equal(live.blue[3].player,'Peyz');
 assert.equal(draftFromLive(live,dictionary).ally,'799,64,-,498,111');
});
test('五槽位内的未选占位保持原位，无需另读分路表',()=>{
 const partial=html.replace(/<img[^>]*title="Faker · Syndra"[^>]*>/,'<img title="Faker · -" src="/placeholder.svg">');
 const live=parseLivePage(partial);assert.equal(live.blue[2],null);assert.equal(live.pickedCount,9);
});
test('一方尚未选英雄时可录入另一方',()=>{
 const partial=html.replace(/<span\b[^>]*class="lpr"[^>]*><i class="sd red"[\s\S]*?<\/span>/,'');
 const live=parseLivePage(partial);
 assert.equal(live.pickedCount,5);assert.deepEqual(live.red,[null,null,null,null,null]);
 assert.equal(draftFromLive(live,dictionary).opponent,'-,-,-,-,-');
});
test('一个英雄也未公布时返回零人信息，不冒充完整阵容',()=>{
 const empty=html.replace(/<span\b[^>]*class="lpr"[^>]*>[\s\S]*?<\/span>/g,'');
 const live=parseLivePage(empty);assert.equal(live.pickedCount,0);assert.equal(live.complete,false);
});
test('仅一个英雄、选人阶段和交换红蓝方时仍按选手定位',()=>{
 let one=html.replace(/<img\b[^>]*title="(?!Jojopyun · Akali)[^"]*"[^>]*>/g,'').replace('in progress','drafting');
 const live=parseLivePage(one,lineups);assert.equal(live.pickedCount,1);assert.equal(live.red[2].champion,'Akali');
 assert.equal(draftFromLive(live,dictionary).opponent,'-,-,84,-,-');
 const reversed=html.replace('class="sd blue"','class="sd temporary"').replace('class="sd red"','class="sd blue"').replace('class="sd temporary"','class="sd red"');
 const flipped=parseLivePage(reversed,lineups);assert.equal(flipped.blueTeam,'MKOI');assert.equal(flipped.redTeam,'T1');
});
test('分路表不完整或选手对不上时不猜位置',()=>{
 assert.throws(()=>parseLineups('<section class="lu-sec"></section>'),/双方队名/);
 const partial=html.replace(/<img[^>]*title="Faker · Syndra"[^>]*>/,'').replace('title="Oner · Lee Sin"','title="UnknownPlayer · Lee Sin"');
 assert.throws(()=>parseLivePage(partial,lineups),/无法确认/);
});
