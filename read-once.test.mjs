import test from 'node:test';
import assert from 'node:assert/strict';
import {readAndApply,ReadStageError} from './read-once.mjs';
test('抓取失败时不写入、不记录',async()=>{
  let writes=0;
  await assert.rejects(readAndApply({read:async()=>{throw Error('offline');},apply:async()=>writes++,record:async()=>writes++}),e=>e instanceof ReadStageError&&e.stage==='read');
  assert.equal(writes,0);
});
test('填入未确认时不写成功日志',async()=>{
  let recorded=false;
  await assert.rejects(readAndApply({read:async()=>({game:1}),apply:async()=>{throw Error('disconnected');},record:async()=>{recorded=true;}}),e=>e.stage==='apply');
  assert.equal(recorded,false);
});
test('日志写入失败仍保留成功结果且不重填阵容',async()=>{
  let applied=0;
  const data={game:1};
  const result=await readAndApply({read:async()=>data,apply:async()=>{applied++;},record:async()=>{throw Error('disk full');}});
  assert.equal(applied,1);assert.equal(result.data,data);assert.equal(result.warning,'disk full');
});
