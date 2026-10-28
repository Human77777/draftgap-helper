import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {getTarget,connectCDP} from './cdp.mjs';
import {SOURCE,parseLivePage,parseLineups,LineupRequiredError,draftFromLive} from './live-source.mjs';
import {readAndApply} from './read-once.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const runtime=path.join(root,'.runtime');
async function run(){
  const session=JSON.parse(await fs.readFile(path.join(runtime,'session.json'),'utf8'));
  const client=await connectCDP((await getTarget(session.port)).webSocketDebuggerUrl);
  const id=randomUUID();
  let busy=false;
  const report=async(message,error=false)=>client.evaluate(`window.__DRAFTGAP_HELPER?.readStatus(${JSON.stringify(message)},${error})`);
  const read=async()=>{
    if(busy)return;
    busy=true;
    try{
      await client.evaluate('window.__DRAFTGAP_HELPER?.readBusy(true)');
      await report('正在读取当前比赛……');
      const result=await readAndApply({
        async read(){
          const response=await fetch(SOURCE,{headers:{'Cache-Control':'no-cache'},cache:'no-store',signal:AbortSignal.timeout(8000)});
          if(!response.ok)throw Error(`赛事网站返回 HTTP ${response.status}`);
          const html=await response.text();
          let live;
          try{live=parseLivePage(html);}catch(e){
            if(!(e instanceof LineupRequiredError))throw e;
            const rosterResponse=await fetch(new URL('/match/'+e.matchId,SOURCE),{headers:{'Cache-Control':'no-cache'},cache:'no-store',signal:AbortSignal.timeout(8000)});
            if(!rosterResponse.ok)throw Error(`选手分路表读取失败：HTTP ${rosterResponse.status}`);
            live=parseLivePage(html,parseLineups(await rosterResponse.text()));
          }
          if(!live||live.pickedCount===0)throw Error('当前比赛尚未公布任何英雄，请稍后再点一次。');
          const dictionary=JSON.parse(await fs.readFile(path.join(root,'champions.json'),'utf8')).data;
          return {live,draft:draftFromLive(live,dictionary),checkedAt:new Date().toISOString()};
        },
        async apply({live,draft}){
          const actual=await client.evaluate(`window.__DRAFTGAP_HELPER.applyLive(${JSON.stringify({ally:draft.ally,opponent:draft.opponent,blueTeam:live.blueTeam,redTeam:live.redTeam,game:live.game,matchId:live.matchId})})`);
          if(!actual)throw Error('应用没有返回填入结果。');
        },
        async record({live,draft,checkedAt}){
          await fs.writeFile(path.join(runtime,'live-status.json'),JSON.stringify({state:'synced',mode:'manual',checkedAt,...live,ally:draft.ally,opponent:draft.opponent},null,2));
        },
      });
      const {live,checkedAt}=result.data;
      await report(`已读取并填入 ${live.blueTeam} vs ${live.redTeam} · 第 ${live.game} 局 · ${live.pickedCount}/10 英雄\n`+(live.complete?'十人已齐，已切换 Draft Analysis。':'未选位置留空，需要更新时再点击。')+(result.warning?'\n阵容已生效，但本地记录保存失败：'+result.warning:''));
      console.log(`${checkedAt} 点击读取并填入 ${live.blueTeam} vs ${live.redTeam} 第 ${live.game} 局`);
    }catch(e){
      const detail=e.stage==='read'?'尚未改动阵容；需要时请再次点击。':'请核对 DraftGap 界面后重试；填入结果或状态提示未能确认。';
      await report(`${e.message}\n${detail}`,true).catch(()=>{});
    }
    finally{busy=false;await client.evaluate('window.__DRAFTGAP_HELPER?.readBusy(false)').catch(()=>{});}
  };
  await client.bind('__DRAFTGAP_READ_MATCH',payload=>{
    if(payload==='read')return read();
  });
  await client.evaluate(`window.__DRAFTGAP_BRIDGE_ID=${JSON.stringify(id)}`);
  await fs.writeFile(path.join(runtime,'bridge-status.json'),JSON.stringify({pid:process.pid,port:session.port,id,mode:'manual',startedAt:new Date().toISOString()},null,2));
  await report('点击“读取当前比赛并填入”获取一次；空闲时不检测。');
  console.log('按需读取已就绪，无轮询。');
  // 没有周期定时器、后台网页抓取或空闲 CDP 检查；只响应按钮事件。
  await new Promise(resolve=>client.onClose(resolve));
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
