import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const all=walk('app'),pages=all.filter(f=>/\/page\.tsx$/.test(f)).map(f=>'/'+path.dirname(f).slice(4).replace(/\([^/]+\)\//g,'')).map(p=>p==='/'?p:p.replace(/\/$/,''));
const apis=all.filter(f=>/\/route\.ts$/.test(f)).map(f=>'/'+path.dirname(f).slice(4));
const pattern=p=>new RegExp('^'+p.replace(/\[\.\.\.[^\]]+\]/g,'[^?]+').replace(/\[[^\]]+\]/g,'[^/]+')+'/?$');
const routes=[...pages,...apis].map(pattern),bad=[],links=[];
for(const f of [...all,...walk('components'),...walk('lib')].filter(f=>/\.(ts|tsx)$/.test(f))){
 const text=fs.readFileSync(f,'utf8'),ast=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true);
 function visit(n){if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateExpression(n)){
 let v=ts.isTemplateExpression(n)?n.head.text+n.templateSpans.map(s=>'__DYNAMIC__'+s.literal.text).join(''):n.text;
 if(/^\/(?!\/)/.test(v)&&!v.includes(' ')&&!v.includes('\n')){
 const clean=v.split(/[?#]/)[0];
 if(clean&&!(clean.startsWith('/_next/')||/\.(svg|png|jpg|webp|mp3|pdf|zip|js|css)$/.test(clean))){
 const probe=clean.replace(/__DYNAMIC__/g,'123');
 const row={file:f,line:ast.getLineAndCharacterOfPosition(n.getStart()).line+1,value:v};links.push(row);
 if(!routes.some(r=>r.test(probe))&&!fs.existsSync('public'+clean))bad.push(row);
 }
 }}ts.forEachChild(n,visit)}visit(ast);
}
console.log(JSON.stringify({ pages: pages.length, apiRoutes: apis.length, references: links.length, unresolved: bad }, null, 2));
if (bad.length) process.exitCode = 1;
