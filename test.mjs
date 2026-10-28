import test from 'node:test';
import assert from 'node:assert/strict';
import './engine.js';
const api=globalThis.DraftGapPrefill;
const ally='奎桑提，盲僧，塞拉斯，霞，泰坦';
const opponent='纳尔，赵信，阿卡丽，卡莎，牛头';
function context(rejectId){
  const ctx={allyTeam:Array.from({length:5},()=>({})),opponentTeam:Array.from({length:5},()=>({}))};
  ctx.resetAll=()=>{for(const t of [ctx.allyTeam,ctx.opponentTeam]) for(let i=0;i<5;i++) t[i]={};};
  ctx.pickChampion=(team,i,id,role)=>{if(id!==rejectId)(team==='ally'?ctx.allyTeam:ctx.opponentTeam)[i]={championKey:id,role};};
  ctx.hoverChampion=(team,i,id,role)=>{(team==='ally'?ctx.allyTeam:ctx.opponentTeam)[i]={hoverKey:id,role};};
  return ctx;
}
test('截图十英雄及分路 ID 正确',()=>{
  const d=api.parseDraft(ally,opponent);
  assert.deepEqual(d.ally.map(c=>[c.id,c.role]),[['897',0],['64',1],['517',2],['498',3],['111',4]]);
  assert.deepEqual(d.opponent.map(c=>c.id),['150','5','84','145','12']);
});
test('英文多词、中文分路前缀和空位',()=>{
  const d=api.parseDraft("上单：K’Sante,打野：Lee Sin,中单：Sylas,ADC：Xayah,辅助：Nautilus",'-, -, -, Kai\'Sa, Alistar');
  assert.equal(d.ally[1].id,'64');assert.equal(d.opponent[0],null);
});
test('拒绝错误数量、未知名字与双方重复英雄',()=>{
  assert.throws(()=>api.parseDraft('霞，泰坦',opponent),/五个/);
  assert.throws(()=>api.parseDraft('我不知道，盲僧，塞拉斯，霞，泰坦',opponent),/无法识别/);
  assert.throws(()=>api.parseDraft(ally,'纳尔，赵信，阿卡丽，霞，牛头'),/重复/);
});
test('全部填入后与真实上下文逐项核对',()=>{
  const c=context();const result=api.applyDraft(c,api.parseDraft(ally,opponent));
  assert.equal(result.ally[4].championKey,'111');assert.equal(result.opponent[2].role,2);
});
test('上游静默拒绝英雄时恢复旧阵容及预选',()=>{
  const c=context('84');c.allyTeam[0]={championKey:'57',role:0};c.opponentTeam[1]={hoverKey:'64',role:1};
  assert.throws(()=>api.applyDraft(c,api.parseDraft(ally,opponent)),/已恢复原阵容/);
  assert.deepEqual(c.allyTeam[0],{championKey:'57',role:0});assert.deepEqual(c.opponentTeam[1],{hoverKey:'64',role:1});
  assert.deepEqual(c.allyTeam[4],{});
});
test('不兼容客户端在修改前报错',()=>{assert.throws(()=>api.applyDraft({},api.parseDraft(ally,opponent)),/未提供填入接口/);});
test('联网核对后的 T1 对 MKOI 实时阵容',()=>{
  const d=api.parseDraft('安蓓萨，盲僧，辛德拉，霞，泰坦','纳尔，奇亚娜，阿卡丽，卡莎，牛头');
  assert.deepEqual(d.ally.map(c=>c.id),['799','64','134','498','111']);
  assert.deepEqual(d.opponent.map(c=>c.id),['150','246','84','145','12']);
});
