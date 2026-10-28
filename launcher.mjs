import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { connectCDP, getTarget } from './cdp.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const runtime=path.join(root,'.runtime');
const sessionFile=path.join(runtime,'session.json');
const args=process.argv.slice(2);
function argument(name){const i=args.indexOf(name);if(i<0)return undefined;if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`${name} 缺少参数`);return args[i+1];}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const server=net.createServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});const p=server.address().port;await new Promise(r=>server.close(r));return p;}
async function existing(){
  let client;
  try{
    const s=JSON.parse(await fs.readFile(sessionFile,'utf8'));
    const target=await getTarget(s.port);client=await connectCDP(target.webSocketDebuggerUrl);
    const valid=await client.evaluate(`typeof window.DRAFTGAP_DEBUG?.pickChampion === 'function'`);
    if(!valid){client.close();return null;}return {client,port:s.port};
  }catch{client?.close();return null;}
}
async function openDedicated(){
  const exe=argument('--exe')||path.join(process.env.ProgramFiles||'C:\\Program Files','DraftGap','DraftGap.exe');
  await fs.access(exe);
  const port=await freePort();
  const child=spawn(exe,[],{
    cwd:path.dirname(exe),detached:true,stdio:'ignore',windowsHide:true,
    env:{...process.env,
      WEBVIEW2_USER_DATA_FOLDER:path.join(runtime,'webview-profile'),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-address=127.0.0.1 --remote-debugging-port=${port}`,
    },
  });
  let spawnError;child.on('error',e=>{spawnError=e;});child.unref();
  console.log('正在打开带阵容助手的专用 DraftGap 窗口……');
  let lastError;
  for(let n=0;n<60;n++){
    if(spawnError)throw spawnError;
    let client;
    try{
      const target=await getTarget(port);client=await connectCDP(target.webSocketDebuggerUrl);
      const ready=await client.evaluate(`typeof window.DRAFTGAP_DEBUG?.pickChampion === 'function' && Array.isArray(window.DRAFTGAP_DEBUG?.allyTeam)`);
      if(ready){await fs.writeFile(sessionFile,JSON.stringify({port,pid:child.pid},null,2));return {port};}
    }catch(e){lastError=e;}finally{if(client)client.close();}
    await delay(700);
  }
  throw Error(`DraftGap 未就绪：${lastError?.message||'数据可能尚未加载，请稍后重试'}。已打开的窗口可手动关闭。`);
}
async function run(){
  await fs.mkdir(runtime,{recursive:true});
  const applyFile=argument('--apply');
  // 在打开或连接应用之前验证输入文件。
  let input;
  if(applyFile){input=JSON.parse(await fs.readFile(path.resolve(applyFile),'utf8'));if(typeof input.ally!=='string'||typeof input.opponent!=='string')throw Error('阵容 JSON 需要 ally、opponent 两个字符串。');}
  let session=await existing();
  if(!session){if(applyFile)throw Error('助手尚未运行，请先双击“启动助手.cmd”。');session=await openDedicated();session.client=await connectCDP((await getTarget(session.port)).webSocketDebuggerUrl);}
  const client=session.client;
  try{
    const engine=await fs.readFile(path.join(root,'engine.js'),'utf8');
    const panel=await fs.readFile(path.join(root,'panel.js'),'utf8');
    await client.evaluate(engine);
    const champions=JSON.parse(await fs.readFile(path.join(root,'champions.json'),'utf8')).data;
    const extra=Object.values(champions).map(c=>[c.key,c.id,c.name]);
    await client.evaluate(`globalThis.__DRAFTGAP_EXTRA_CHAMPIONS=${JSON.stringify(extra)}`);
    const result=await client.evaluate(panel);
    if(input){
      const result=await client.evaluate(`window.__DRAFTGAP_HELPER.apply(${JSON.stringify(input.ally)},${JSON.stringify(input.opponent)})`);
      console.log('已填入，实际阵容：\n'+JSON.stringify(result,null,2));
    }else {
      await client.evaluate('if(window.__DRAFTGAP_LIVE)window.__DRAFTGAP_LIVE.paused=true');
      const bridgeReady=async()=>{
        try {
          const saved=JSON.parse(await fs.readFile(path.join(runtime,'bridge-status.json'),'utf8'));
          if(saved.port!==session.port||!Number.isInteger(saved.pid)||saved.pid<=0)return false;
          if(saved.id!==await client.evaluate('window.__DRAFTGAP_BRIDGE_ID'))return false;
          process.kill(saved.pid,0);return true;
        }catch{return false;}
      };
      const bridgeRunning=await bridgeReady();
      const output=await fs.open(path.join(runtime,'manual-read.log'),'a');
      try {
        if(!bridgeRunning){
          const worker=spawn(process.execPath,[path.join(root,'manual-bridge.mjs')],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',output.fd,output.fd]});
          await new Promise((resolve,reject)=>{worker.once('spawn',resolve);worker.once('error',reject);});
          worker.unref();
        }
      }finally{await output.close();}
      let ready=bridgeRunning;
      // 仅启动时等待连接就绪，空闲阶段不轮询。
      for(let i=0;!ready&&i<60;i++){await delay(100);ready=await bridgeReady();}
      if(!ready)throw Error('按钮连接未就绪，请查看 .runtime/manual-read.log 后重试。');
      console.log(`助手已就绪（${result}）。点击“读取当前比赛并填入”才会获取一次阵容；空闲时不轮询。`);
    }
  }finally{client.close();}
}
run().catch(async e=>{const msg=`${new Date().toISOString()} ${e.stack||e}\n`;console.error(e.message);await fs.appendFile(path.join(runtime,'error.log'),msg).catch(()=>{});process.exitCode=1;});
