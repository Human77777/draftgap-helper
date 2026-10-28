(() => {
  const id = 'draftgap-prefill-panel';
  const previous = document.getElementById(id);
  const savedInputs = previous?.shadowRoot ? {
    ally: previous.shadowRoot.getElementById('ally')?.value,
    opponent: previous.shadowRoot.getElementById('opponent')?.value,
  } : null;
  if (previous) previous.remove();
  const host = document.createElement('div'); host.id = id;
  Object.assign(host.style, { position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647' });
  const shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = `<style>
  *{box-sizing:border-box}section{width:360px;background:#17212c;color:#e7edf5;border:1px solid #526375;border-radius:12px;padding:17px;box-shadow:0 12px 45px #0009;font:14px/1.5 'Microsoft YaHei',sans-serif}
  header{display:flex;justify-content:space-between;align-items:center;font-size:17px;font-weight:bold}p{color:#a7b5c6;font-size:12px;margin:8px 0}label{display:block;margin-top:12px}textarea{display:block;width:100%;min-height:64px;background:#0e151d;color:#f2f5fa;border:1px solid #45586c;border-radius:6px;margin-top:5px;padding:9px;resize:vertical;font:14px/1.6 'Microsoft YaHei',sans-serif}
  button{border:0;border-radius:6px;padding:8px 12px;background:#304356;color:#e7edf5;cursor:pointer}#apply{background:#51cbb1;color:#05251e;font-weight:bold}.buttons{display:flex;gap:8px;margin-top:13px}#status{white-space:pre-wrap;margin-top:10px;font-size:12px;color:#b9cbdc;max-height:170px;overflow:auto}#toggle{padding:3px 9px} .tiny{font-size:11px;color:#8fa2b6}section.collapsed #body{display:none}section.collapsed{width:220px}
  </style><section><header>DraftGap 阵容助手<button id="toggle" title="折叠">−</button></header><div id="body">
  <p>顺序：上单 → 打野 → 中单 → ADC → 辅助<br>用逗号分隔，空位写 -。填入后请核对左右阵营。</p>
  <label>我方<textarea id="ally" spellcheck="false">安蓓萨，盲僧，辛德拉，霞，泰坦</textarea></label>
  <label>对方<textarea id="opponent" spellcheck="false">纳尔，奇亚娜，阿卡丽，卡莎，牛头</textarea></label>
  <div class="buttons"><button id="preview">检查</button><button id="swap">交换双方</button><button id="apply">手动填入</button></div>
  <div id="status">已预置示例阵容，尚未填入。</div>
  <div class="buttons"><button id="readMatch" style="background:#51cbb1;color:#05251e;font-weight:bold;width:100%">读取当前比赛并填入</button></div>
  <div id="liveStatus" style="font-size:12px;margin-top:8px;white-space:pre-wrap">按需读取模式：点击才获取，空闲时不检测。</div>
  <p class="tiny">读取当前世界赛已公布的英雄，未选位置留空。蓝方在左，红方在右。十人齐全后自动打开 Draft Analysis。统计补丁沿用 DraftGap 当前数据。</p>
  </div></section>`;
  const $ = id => shadow.getElementById(id);
  if (savedInputs) {
    if (typeof savedInputs.ally === 'string') $('ally').value = savedInputs.ally;
    if (typeof savedInputs.opponent === 'string') $('opponent').value = savedInputs.opponent;
  }
  const api = globalThis.DraftGapPrefill;
  let extra = globalThis.__DRAFTGAP_EXTRA_CHAMPIONS || [];
  try {
    const data = window.DRAFTGAP_DEBUG?.dataset?.()?.championData;
    if(data) extra = extra.concat(Object.entries(data).map(([key,c]) => [key,c.name,'']));
  } catch {}
  const cat = api.catalog(extra);
  const read = () => api.parseDraft($('ally').value,$('opponent').value,cat);
  const describe = d => ['ally','opponent'].map(t => `${t==='ally'?'我方':'对方'}：${d[t].map(c=>c?.chinese || '空').join(' / ')}`).join('\n');
  const report = (msg, fail=false) => { $('status').textContent=msg; $('status').style.color=fail?'#ffaaa5':'#b9cbdc'; };
  globalThis.__DRAFTGAP_LIVE ||= {};
  const live=globalThis.__DRAFTGAP_LIVE;
  live.paused=true;
  $('readMatch').onclick=()=>{
    if(typeof window.__DRAFTGAP_READ_MATCH!=='function'){
      $('liveStatus').textContent='本地连接尚未就绪，请重新双击启动助手。';return;
    }
    window.__DRAFTGAP_READ_MATCH('read');
  };
  $('preview').onclick = () => {try{report(describe(read()));}catch(e){report(e.message,true);}};
  $('swap').onclick = () => { const a=$('ally').value; $('ally').value=$('opponent').value; $('opponent').value=a; report('已交换输入内容，点击“手动填入”后生效。'); };
  $('apply').onclick = () => {
    try {const d=read(); api.applyDraft(window.DRAFTGAP_DEBUG,d); report('已填入并核对英雄 ID 和分路。\n'+describe(d));}
    catch(e){report(e.message,true);}
  };
  $('toggle').onclick = () => { const collapsed=shadow.querySelector('section').classList.toggle('collapsed'); $('toggle').textContent=collapsed?'+':'−'; };
  document.documentElement.appendChild(host);
  globalThis.__DRAFTGAP_HELPER = {
    apply(ally,opponent){const d=api.parseDraft(ally,opponent,cat);const result=api.applyDraft(window.DRAFTGAP_DEBUG,d);$('ally').value=ally;$('opponent').value=opponent;report('已填入并核对。\n'+describe(d));return result;},
    applyLive(d){
      const draft=api.parseDraft(d.ally,d.opponent,cat);
      const result=api.applyDraft(window.DRAFTGAP_DEBUG,draft);
      $('ally').value=draft.ally.map(c=>c?.chinese||'-').join('，');
      $('opponent').value=draft.opponent.map(c=>c?.chinese||'-').join('，');
      report(`本次填入：${d.blueTeam}（蓝） vs ${d.redTeam}（红）· 第 ${d.game} 局\n`+describe(draft));
      live.lastApplied={matchId:d.matchId,game:d.game};
      return result;
    },
    readStatus(message,error=false){$('liveStatus').textContent=message;$('liveStatus').style.color=error?'#ffaaa5':'#b9cbdc';},
    readBusy(busy){for(const name of ['readMatch','preview','swap','apply','ally','opponent'])$(name).disabled=busy;$('readMatch').textContent=busy?'正在读取……':'读取当前比赛并填入';}
  };
  return 'installed';
})();
