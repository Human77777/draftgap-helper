import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseLivePage,draftFromLive} from './live-source.mjs';
const html=await fs.readFile(new URL('./fixtures/live.html',import.meta.url),'utf8');
const dictionary=JSON.parse(await fs.readFile(new URL('./champions.json',import.meta.url),'utf8')).data;
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
test('缺人、重复英雄和红蓝方结构变化时拒绝录入',()=>{
 assert.throws(()=>parseLivePage(html.replace(/<img[^>]*title="Faker · Syndra"[^>]*>/,'')),/只有 4/);
 assert.throws(()=>parseLivePage(html.replace(/champion%2FGnar%2F/g,'champion%2FAmbessa%2F')),/重复英雄/);
 assert.throws(()=>parseLivePage(html.replace('class="sd red"','class="sd blue"')),/红蓝方格式/);
});
test('跨局数和阵容变动时生成新指纹，同一局不随经济数据重复填入',()=>{
 const a=draftFromLive(parseLivePage(html),dictionary);
 assert.equal(a.fingerprint,draftFromLive(parseLivePage(html.replace('19.1k','21.1k')),dictionary).fingerprint);
 assert.notEqual(a.fingerprint,draftFromLive(parseLivePage(html.replace('Game 1','Game 2')),dictionary).fingerprint);
});
test('英雄字典缺失时明确报错，不猜 ID',()=>{assert.throws(()=>draftFromLive(parseLivePage(html),{}),/缺少英雄/);});
