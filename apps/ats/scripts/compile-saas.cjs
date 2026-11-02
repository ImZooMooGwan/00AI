const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
fs.mkdirSync('.saas-build',{recursive:true});
fs.writeFileSync('.saas-build/package.json','{"type":"commonjs"}\n');
execFileSync(process.platform==='win32'?'npx.cmd':'npx',['tsc','-p','tsconfig.saas-build.json'],{stdio:'inherit'});
