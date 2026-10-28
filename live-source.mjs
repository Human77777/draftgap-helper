export const SOURCE = 'https://lolworlds2026.com/';
const decode = s => s.replace(/&(?:amp|quot|apos|#39|#x27|lt|gt);/gi, x => ({'&amp;':'&','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'",'&lt;':'<','&gt;':'>'}[x.toLowerCase()] || x));
export function parseLivePage(html) {
  // 仅查看当前直播区，避免把推荐英雄或上一局战报当作本局阵容。
  const section = html.match(/<section\b[^>]*aria-labelledby="feat-h"[^>]*>([\s\S]*?)<\/section>/i)?.[1];
  if (!section || !/<h2\b[^>]*id="feat-h"[^>]*>\s*Live now\s*<\/h2>/i.test(section)) return null;
  const game = section.match(/Game\s+(\d+)\s*·\s*in progress/i)?.[1];
  const matchId = section.match(/href="\/match\/(\d+)"/i)?.[1];
  if (!game || !matchId) return null;
  const teamName = side => decode(section.match(new RegExp(`<span\\b[^>]*class="ft ${side}"[^>]*>([\\s\\S]*?)<b\\b[^>]*>([^<]+)<\\/b>`, 'i'))?.[2] || '').trim();
  const blueTeam = teamName('l'), redTeam = teamName('r');
  if (!blueTeam || !redTeam || blueTeam === redTeam) throw Error('实时源未提供明确的双方队名，等待更新。');
  const rows = [...section.matchAll(/<span\b[^>]*class="lpr"[^>]*>([\s\S]*?)<\/span>/gi)].map(m=>m[1]);
  if (rows.length !== 2) throw Error('当前局阵容尚未齐全，等待更新。');
  const parseRow = (row, side) => {
    if (!new RegExp(`class="sd ${side}"`).test(row)) throw Error('实时源红蓝方格式改变，已停止填入。');
    const picks = [...row.matchAll(/<img\b[^>]*>/gi)].map(m => {
      const tag=m[0], title=decode(tag.match(/\btitle="([^"]+)"/i)?.[1]||'');
      const src=decode(tag.match(/\bsrc="([^"]+)"/i)?.[1]||'');
      const full=decodeURIComponent(src);
      const champion=full.match(/\/champion\/([A-Za-z0-9]+)\/square/)?.[1];
      const split=title.indexOf(' · ');
      if(!champion||split<1) throw Error('英雄文字数据不完整，等待更新。');
      return {player:title.slice(0,split),champion,name:title.slice(split+3)};
    });
    if(picks.length!==5) throw Error(`当前 ${side==='blue'?'蓝':'红'}方只有 ${picks.length} 个英雄，等待补全。`);
    return picks;
  };
  const blue=parseRow(rows[0],'blue'), red=parseRow(rows[1],'red');
  const ids=[...blue,...red].map(c=>c.champion.toLowerCase());
  if(new Set(ids).size!==10) throw Error('实时源出现重复英雄，等待更新。');
  return {matchId,game:Number(game),blueTeam,redTeam,blue,red,source:SOURCE};
}
export function draftFromLive(live, dictionary) {
  const id = c => {
    const entry=dictionary[c.champion] || Object.values(dictionary).find(x=>x.id?.toLowerCase()===c.champion.toLowerCase());
    if(!entry?.key || !/^\d+$/.test(entry.key)) throw Error(`缺少英雄 ${c.name} 的 ID，请更新英雄字典。`);
    return String(entry.key);
  };
  const ally=live.blue.map(id).join(','), opponent=live.red.map(id).join(',');
  return {ally,opponent,fingerprint:JSON.stringify([live.matchId,live.game,live.blueTeam,live.redTeam,ally,opponent])};
}
