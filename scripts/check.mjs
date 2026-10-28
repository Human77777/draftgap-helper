import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files=(await fs.readdir(root)).filter(f=>/\.(?:m?js)$/.test(f));
for(const file of files){
  const result=spawnSync(process.execPath,['--check',path.join(root,file)],{stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
console.log(`Syntax checked: ${files.length} files`);
