# 项目与第三方来源

此工具是独立的本地伴随工具，没有由 Riot Games、DraftGap 或赛事数据网站提供官方背书。它不包含 DraftGap 安装程序、游戏客户端或远程 API 密钥。

## DraftGap

- 项目：https://github.com/vigovlugt/draftgap
- 本工具调用已安装程序中的内部 `DRAFTGAP_DEBUG` 接口，未提供其稳定性承诺。上游更新可能要求调整适配。
- 原项目的许可证、商标和资产以原项目说明为准。本文件不改变原项目的授权。

## 英雄字典

- 来源：Riot Games Data Dragon
- 原始地址：https://ddragon.leagueoflegends.com/cdn/16.21.1/data/zh_CN/champion.json
- 本地 `champions.json` 仅保留英雄标识、数字 ID 和中文名称/称号，不包含头像或其他图片。
- 字典版本只用于英雄 ID 映射，不代表 DraftGap 统计补丁或职业比赛补丁。

## 实时赛事源

- 网站：https://lolworlds2026.com/
- 读取方式：用户主动点击后请求当前公开直播区，没有定时抓取、登录或官方 API 可用性保证。
- `fixtures/live.html` 是 2026-10-28 调试时保留的该站直播区样本，仅用于验证解析器；并非当前实时结果。
- 数据可用性、发布时间、页面结构、使用规则由原网站决定。

## 本项目许可证

原创代码沿用本仓库已有的 MIT 许可证，详见 `LICENSE`。第三方数据、商标及上游项目的授权不因本仓库的代码许可证而改变，来源分别列于上文。
