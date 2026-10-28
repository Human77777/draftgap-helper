export const SOURCE = 'https://lolworlds2026.com/';
const decode = s => s.replace(/&(?:amp|quot|apos|#39|#x27|lt|gt);/gi, x => ({'&amp;':'&','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'",'&lt;':'<','&gt;':'>'}[x.toLowerCase()] || x));
export class LineupRequiredError extends Error {
  constructor(matchId) { super('部分英雄缺少位置，需要读取选手分路表。');this.matchId=matchId; }
}
export function parseLineups(html) {
  const section=html.match(/<section\b[^>]*class="[^"]*\blu-sec\b[^"]*"[^>]*>([\s\S]*?)<\/section>/i)?.[1];
  if(section===undefined)throw Error('比赛页未提供选手分路表，暂时无法定位未选满的英雄。');
  const team=side=>decode(section.match(new RegExp(`<a\\b[^>]*class="lt ${side}"[^>]*>[\\s\\S]*?<b\\b[^>]*>([^<]+)<\\/b>`,'i'))?.[1]||'').trim();
  const left=team('l'),right=team('r');
  if(!left||!right||left===right)throw Error('选手分路表未提供明确的双方队名。');
  const lineups={[left]:Array(5).fill(null),[right]:Array(5).fill(null)};
  const roles={top:0,jungle:1,mid:2,middle:2,bot:3,bottom:3,adc:3,support:4};
  for(const [,row] of section.matchAll(/<div\b[^>]*class="lr rise-i"[^>]*>([\s\S]*?)<\/div>/gi)){
    const label=row.match(/<span\b[^>]*class="mono lrole"[^>]*>([^<]+)<\/span>/i)?.[1]?.trim().toLowerCase();
    const role=roles[label];if(role===undefined)continue;
    for(const [side,name] of [['l',left],['r',right]]){
      const player=decode(row.match(new RegExp(`<a\\b[^>]*class="lp ${side}"[^>]*>[\\s\\S]*?<b\\b[^>]*>([^<]+)<\\/b>`,'i'))?.[1]||'').trim();
      if(!player||lineups[name][role])throw Error('选手分路表缺少位置或位置重复。');
      lineups[name][role]=player;
    }
  }
  if(Object.values(lineups).some(players=>players.some(p=>!p)||new Set(players.map(p=>p.toLowerCase())).size!==5))throw Error('选手分路表不完整，无法安全定位英雄。');
  return lineups;
}
export function parseLivePage(html,lineups=null) {
  // 仅查看当前直播区，避免把推荐英雄或上一局战报当作本局阵容。
  const section = html.match(/<section\b[^>]*aria-labelledby="feat-h"[^>]*>([\s\S]*?)<\/section>/i)?.[1];
  if (!section || !/<h2\b[^>]*id="feat-h"[^>]*>\s*Live now\s*<\/h2>/i.test(section)) return null;
  const game = section.match(/Game\s+(\d+)\s*·\s*(?:in progress|draft(?:ing)?|champion select)/i)?.[1];
  const matchId = section.match(/href="\/match\/(\d+)"/i)?.[1];
  if (!game || !matchId) return null;
  const teamName = side => decode(section.match(new RegExp(`<span\\b[^>]*class="ft ${side}"[^>]*>([\\s\\S]*?)<b\\b[^>]*>([^<]+)<\\/b>`, 'i'))?.[2] || '').trim();
  let blueTeam = teamName('l'), redTeam = teamName('r');
  if (!blueTeam || !redTeam || blueTeam === redTeam) throw Error('实时源未提供明确的双方队名，等待更新。');
  const rows = [...section.matchAll(/<span\b[^>]*class="lpr"[^>]*>([\s\S]*?)<\/span>/gi)].map(m=>m[1]);
  if (rows.length>2) throw Error('实时源红蓝方格式改变，已停止填入。');
  const rowBySide={};
  for(const row of rows){
    const side=row.match(/class="sd (blue|red)"/)?.[1];
    if(!side||rowBySide[side])throw Error('实时源红蓝方格式改变，已停止填入。');
    rowBySide[side]=row;
  }
  const inferredTeams={};
  const parseRow = (row, side) => {
    if(!row)return Array(5).fill(null);
    if (!new RegExp(`class="sd ${side}"`).test(row)) throw Error('实时源红蓝方格式改变，已停止填入。');
    const picks = [...row.matchAll(/<img\b[^>]*>/gi)].map(m => {
      const tag=m[0], title=decode(tag.match(/\btitle="([^"]+)"/i)?.[1]||'');
      const src=decode(tag.match(/\bsrc="([^"]+)"/i)?.[1]||'');
      let full;try{full=decodeURIComponent(src);}catch{throw Error('英雄图片地址格式错误，已停止填入。');}
      const champion=full.match(/\/champion\/([A-Za-z0-9]+)\/square/)?.[1];
      const split=title.indexOf(' · ');
      const label=(split>=0?title.slice(split+3):title).trim();
      if(!champion&&(!title||/^(?:-|\?|TBD|Unknown|Not picked|待选)$/i.test(label)))return null;
      if(!champion||split<1) throw Error('英雄文字数据不完整，等待更新。');
      return {player:title.slice(0,split),champion,name:title.slice(split+3)};
    });
    if(picks.length>5)throw Error('单方英雄数量超过五个，已停止填入。');
    if(lineups){
      const slots=Array(5).fill(null);
      for(const pick of picks.filter(Boolean)){
        const found=Object.entries(lineups).flatMap(([team,players])=>players.flatMap((p,role)=>p.toLowerCase()===pick.player.toLowerCase()?[{team,role}]:[]));
        if(found.length!==1)throw Error(`无法确认 ${pick.player} 的分路，已停止填入。`);
        const {team,role}=found[0];
        if(inferredTeams[side]&&inferredTeams[side]!==team)throw Error('同一方英雄对应不同队伍，已停止填入。');
        if(slots[role])throw Error('同一位置出现多个英雄，已停止填入。');
        inferredTeams[side]=team;slots[role]=pick;
      }
      return slots;
    }
    // 五个明确槽位可以直接保留空位；省略了未选位置的紧凑列表需补充选手表。
    if(picks.length===5)return picks;
    if(!picks.some(Boolean))return Array(5).fill(null);
    throw new LineupRequiredError(matchId);
  };
  const blue=parseRow(rowBySide.blue,'blue'), red=parseRow(rowBySide.red,'red');
  if(lineups){
    const teams=[blueTeam,redTeam];
    if(Object.values(inferredTeams).some(t=>!teams.includes(t)))throw Error('选手分路表与当前比赛队伍不一致。');
    if(inferredTeams.blue&&inferredTeams.red&&inferredTeams.blue===inferredTeams.red)throw Error('红蓝双方对应相同队伍，已停止填入。');
    blueTeam=inferredTeams.blue||teams.find(t=>t!==inferredTeams.red)||blueTeam;
    redTeam=inferredTeams.red||teams.find(t=>t!==blueTeam);
  }
  const ids=[...blue,...red].filter(Boolean).map(c=>c.champion.toLowerCase());
  if(new Set(ids).size!==ids.length) throw Error('实时源出现重复英雄，等待更新。');
  return {matchId,game:Number(game),blueTeam,redTeam,blue,red,pickedCount:ids.length,complete:ids.length===10,source:SOURCE};
}
export function draftFromLive(live, dictionary) {
  const id = c => {
    if(!c)return '-';
    const entry=dictionary[c.champion] || Object.values(dictionary).find(x=>x.id?.toLowerCase()===c.champion.toLowerCase());
    if(!entry?.key || !/^\d+$/.test(entry.key)) throw Error(`缺少英雄 ${c.name} 的 ID，请更新英雄字典。`);
    return String(entry.key);
  };
  const ally=live.blue.map(id).join(','), opponent=live.red.map(id).join(',');
  return {ally,opponent,fingerprint:JSON.stringify([live.matchId,live.game,live.blueTeam,live.redTeam,ally,opponent])};
}
