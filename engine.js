(function (root) {
  'use strict';
  const entries = [
    ['799', 'Ambessa', '安蓓萨|安贝萨|铁血狼母'],
    ['897', "K'Sante", '奎桑提|奎桑堤|黑哥'], ['64', 'Lee Sin', '盲僧|瞎子|李青'],
    ['517', 'Sylas', '塞拉斯|偷男'], ['498', 'Xayah', '霞'], ['111', 'Nautilus', '泰坦|诺提勒斯|深海泰坦'],
    ['150', 'Gnar', '纳尔'], ['5', 'Xin Zhao', '赵信|信爷'], ['84', 'Akali', '阿卡丽'],
    ['145', "Kai'Sa", '卡莎|卡萨'], ['12', 'Alistar', '阿利斯塔|牛头|老牛'],
    ['523', 'Aphelios', '厄斐琉斯|月男'], ['61', 'Orianna', '奥莉安娜|发条'],
    ['103', 'Ahri', '阿狸|狐狸'], ['910', 'Hwei', '彗'], ['134', 'Syndra', '辛德拉|球女'],
    ['13', 'Ryze', '瑞兹|流浪'], ['1', 'Annie', '安妮'], ['126', 'Jayce', '杰斯'],
    ['58', 'Renekton', '雷克顿|鳄鱼'], ['266', 'Aatrox', '亚托克斯|剑魔'],
    ['57', 'Maokai', '茂凯|大树'], ['78', 'Poppy', '波比'], ['80', 'Pantheon', '潘森'],
    ['234', 'Viego', '佛耶戈|破败王'], ['113', 'Sejuani', '瑟庄妮|猪妹'],
    ['59', 'Jarvan IV', '嘉文四世|皇子'], ['62', 'Wukong', '孙悟空|猴子'],
    ['60', 'Elise', '伊莉丝|蜘蛛'], ['203', 'Kindred', '千珏'], ['143', 'Zyra', '婕拉'],
    ['429', 'Kalista', '卡莉丝塔|滑板鞋'], ['222', 'Jinx', '金克丝'], ['22', 'Ashe', '艾希|寒冰'],
    ['81', 'Ezreal', '伊泽瑞尔|EZ'], ['202', 'Jhin', '烬'], ['15', 'Sivir', '希维尔|轮子妈'],
    ['21', 'Miss Fortune', '厄运小姐|女枪'], ['236', 'Lucian', '卢锡安'], ['221', 'Zeri', '泽丽'],
    ['18', 'Tristana', '崔丝塔娜|小炮'], ['110', 'Varus', '韦鲁斯'], ['235', 'Senna', '赛娜'],
    ['497', 'Rakan', '洛'], ['89', 'Leona', '蕾欧娜|日女'], ['412', 'Thresh', '锤石'],
    ['526', 'Rell', '芮尔'], ['201', 'Braum', '布隆'], ['117', 'Lulu', '璐璐'],
    ['267', 'Nami', '娜美'], ['432', 'Bard', '巴德'], ['43', 'Karma', '卡尔玛'],
    ['30', 'Karthus', '卡尔萨斯|死歌'], ['246', 'Qiyana', '奇亚娜|琪亚娜'],
  ];
  const normalize = s => String(s).toLowerCase().replace(/[\s'’‘.\-]/g, '');
  function catalog(extra = []) {
    const byName = new Map(), byId = new Map();
    for (const [id, name, aliases] of [...entries, ...extra]) {
      const c = { id: String(id), name, chinese: (aliases || name).split('|')[0] };
      byId.set(c.id, c);
      for (const alias of [id, name, ...(aliases || '').split('|')]) if (alias) byName.set(normalize(alias), c);
    }
    return { byName, byId };
  }
  function parseTeam(text, cat) {
    const value = String(text).trim();
    if (!value) throw Error('请填写五个位置，空位请写 -。');
    let parts = value.split(/[,，、;；\n]+/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 1) parts = value.split(/\s+/).filter(Boolean);
    if (parts.length !== 5) throw Error(`需要五个位置，当前识别到 ${parts.length} 个；请用逗号分隔。`);
    return parts.map((part, role) => {
      const name = part.replace(/^(上单|打野|中单|下路|射手|辅助|ADC|TOP|JUNGLE|MID|SUPPORT)\s*[:：]\s*/i, '').trim();
      if (/^(-|空|未知|\?)$/.test(name)) return null;
      const c = cat.byName.get(normalize(name));
      if (c) return { ...c, role };
      if (/^[1-9]\d{0,4}$/.test(name)) return { id: name, name: `ID ${name}`, chinese: `ID ${name}`, role };
      throw Error(`无法识别“${name}”：可用英文全名或英雄数字 ID。`);
    });
  }
  function parseDraft(ally, opponent, cat = catalog()) {
    const draft = { ally: parseTeam(ally, cat), opponent: parseTeam(opponent, cat) };
    const ids = [...draft.ally, ...draft.opponent].filter(Boolean).map(c => c.id);
    if (new Set(ids).size !== ids.length) throw Error('双方阵容有重复英雄，请检查。');
    return draft;
  }
  function requireHooks(ctx) {
    for (const key of ['pickChampion', 'resetAll']) if (typeof ctx?.[key] !== 'function') throw Error('当前 DraftGap 未提供填入接口，请确认应用已加载完成。');
    for (const key of ['allyTeam', 'opponentTeam']) if (!Array.isArray(ctx[key]) || ctx[key].length !== 5) throw Error('DraftGap 阵容格式发生变化，已停止。');
  }
  function applyDraft(ctx, draft) {
    requireHooks(ctx);
    const saved = { ally: ctx.allyTeam.map(p => ({ ...p })), opponent: ctx.opponentTeam.map(p => ({ ...p })) };
    const options = { updateSelection: false, resetFilters: false, reportEvent: false, updateView: false };
    const total=[...draft.ally,...draft.opponent].filter(Boolean).length;
    let applied=0;
    try {
      ctx.resetAll();
      for (const team of ['ally', 'opponent']) {
        for (const [i, c] of draft[team].entries()) {
          if (!c) continue;
          // 仅第十个英雄开启界面更新，使用 DraftGap 自带的完成阵容 → analysis 行为。
          ctx.pickChampion(team, i, c.id, c.role, {...options,updateView:total===10&&++applied===10});
          const actual = (team === 'ally' ? ctx.allyTeam : ctx.opponentTeam)[i];
          if (actual.championKey !== c.id || actual.role !== c.role) throw Error(`应用未接受 ${c.chinese}（${c.id}），请检查数据是否加载。`);
        }
      }
    } catch (error) {
      try {
        ctx.resetAll();
        for (const team of ['ally', 'opponent']) saved[team].forEach((p, i) => {
          if (p.championKey) ctx.pickChampion(team, i, p.championKey, p.role, options);
          else if (p.hoverKey && typeof ctx.hoverChampion === 'function') ctx.hoverChampion(team, i, p.hoverKey, p.role);
        });
      } catch { throw Error(`${error.message} 原阵容恢复失败，请手动检查。`); }
      throw Error(`${error.message} 已恢复原阵容。`);
    }
    return { ally: ctx.allyTeam.map(p => ({ ...p })), opponent: ctx.opponentTeam.map(p => ({ ...p })) };
  }
  root.DraftGapPrefill = { entries, catalog, parseDraft, applyDraft, requireHooks };
})(globalThis);
