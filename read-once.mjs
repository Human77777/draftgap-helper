// 区分“尚未写入”“写入结果未确认”和“已写入但记录失败”。
// 日志失败不应把已经成功填入的阵容报告为“没有变化”。
export class ReadStageError extends Error {
  constructor(stage, cause) { super(cause.message, {cause}); this.stage=stage; }
}
export async function readAndApply({read,apply,record}) {
  let data;
  try { data=await read(); } catch(e) { throw new ReadStageError('read',e); }
  try { await apply(data); } catch(e) { throw new ReadStageError('apply',e); }
  try { await record(data); return {data}; }
  catch(e) { return {data,warning:e.message}; }
}
