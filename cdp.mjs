export async function connectCDP(url) {
  const ws = new WebSocket(url);
  const pending = new Map(); let seq = 0;
  await new Promise((resolve,reject) => {
    const timer=setTimeout(()=>{ws.close();reject(Error('调试连接超时'));},6000);
    ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('无法连接 DraftGap 调试窗口'));},{once:true});
  });
  ws.addEventListener('message', e => {
    let msg; try { msg=JSON.parse(e.data); } catch{return;}
    const p=pending.get(msg.id); if(!p) return;
    pending.delete(msg.id);clearTimeout(p.timer);
    if(msg.error) p.reject(Error(msg.error.message)); else p.resolve(msg.result);
  });
  ws.addEventListener('close',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('DraftGap 窗口已关闭'));}pending.clear();});
  const call = (method,params={}) => new Promise((resolve,reject)=>{
    const id=++seq;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error(`${method} 超时`));},12000);
    pending.set(id,{resolve,reject,timer});
    try{ws.send(JSON.stringify({id,method,params}));}catch(e){clearTimeout(timer);pending.delete(id);reject(e);}
  });
  return {
    async bind(name, handler) {
      const listener=e=>{
        let msg;try{msg=JSON.parse(e.data);}catch{return;}
        if(msg.method==='Runtime.bindingCalled'&&msg.params?.name===name) Promise.resolve(handler(msg.params.payload)).catch(()=>{});
      };
      ws.addEventListener('message',listener);
      await call('Runtime.enable');
      await call('Runtime.addBinding',{name});
      return ()=>ws.removeEventListener('message',listener);
    },
    onClose(handler){ws.addEventListener('close',handler,{once:true});},
    async evaluate(expression) {
      const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
      if(r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result?.value;
    },
    close(){ws.close();},
  };
}
export async function getTarget(port) {
  if(!Number.isInteger(port)||port<1024||port>65535) throw Error('无效调试端口');
  const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(2000)});
  if(!response.ok) throw Error('无法读取调试窗口');
  const list=await response.json();
  const targets=list.filter(t=>t.type==='page' && /^https?:\/\/(tauri\.localhost|localhost)(\/|$)/.test(t.url) && /DraftGap/i.test(t.title||''));
  if(targets.length!==1) throw Error(`需要唯一 DraftGap 页面，找到 ${targets.length} 个`);
  const target=targets[0];
  const u=new URL(target.webSocketDebuggerUrl);
  if(!['127.0.0.1','localhost'].includes(u.hostname)||Number(u.port)!==port||u.protocol!=='ws:') throw Error('调试连接不是指定的本地端口');
  return target;
}
