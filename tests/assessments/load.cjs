const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname,'../..',file);
  const js = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const module={exports:{}};
  const resolve=name=> Object.hasOwn(mocks,name)?mocks[name]:name==='server-only'?{}:name.startsWith('@/')?load(name.slice(2)+'.ts',mocks):require(name);
  new Function('require','module','exports',js)(resolve,module,module.exports);
  return module.exports;
}
module.exports={load};
