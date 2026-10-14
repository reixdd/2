// Zero-dependency ESM module bundler for the small server-only graph.
// Each source is isolated in its own closure so identical local variable names cannot collide.
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const graph = new Map();
function collect(file) {
  file = path.resolve(file);
  if (graph.has(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  const imports = [];
  const withoutImports = source.replace(/^import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"];?\s*$/gm, (_, spec, rel) => {
    const dep = path.resolve(path.dirname(file), rel);
    imports.push({ spec, dep });
    return '';
  });
  if (/^import\b/m.test(withoutImports)) throw Error('Unsupported import in ' + file);
  graph.set(file, { source: withoutImports, imports });
  for (const {dep} of imports) collect(dep);
}
collect(path.join(root, 'server/api.js'));
let bundled = `// Generated DIT Worker bundle. Do not edit.\nconst __modules = Object.create(null);\n`;
const ordered=[];const visited=new Set(); function visit(f){if(visited.has(f))return;visited.add(f);for(const i of graph.get(f).imports)visit(i.dep);ordered.push([f,graph.get(f)]);} visit(path.join(root,'server/api.js'));
for (const [file, { source, imports }] of ordered) {
  const id = path.relative(root, file).replaceAll('\\', '/');
  const vars = [];
  let code = source;
  for (const [_,name] of code.matchAll(/\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)/g)) vars.push(name);
  code = code.replace(/\bexport\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/g, '');
  code = code.replace(/^export\s*\{([^}]+)\};?\s*$/gm, (_, items) => { for (const v of items.split(',')) vars.push(v.trim()); return ''; });
  const binds = imports.map(({spec,dep}) => {
    const f = path.relative(root, dep).replaceAll('\\', '/');
    const kv = spec.split(',').map(x => x.trim().replace(/\s+as\s+/, ': ')).join(', ');
    return `const {${kv}} = __modules[${JSON.stringify(f)}];`;
  }).join('\n');
  bundled += `\n__modules[${JSON.stringify(id)}] = (()=>{\n${binds}\n${code}\nreturn {${[...new Set(vars)].join(',')}};\n})();\n`;
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2','.glb':'model/gltf-binary'};
const assets={};
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else if(!/^operator(?:\.html|\.css|\.js)$/.test(item.name)) assets['/'+path.relative(path.join(root,'dist'),p).replaceAll('\\','/')]={body:fs.readFileSync(p).toString('base64'),type:mime[path.extname(p)]||'application/octet-stream'};}}
walk(path.join(root,'dist'));
fs.mkdirSync('build/server',{recursive:true});fs.mkdirSync('build/.openai',{recursive:true});fs.copyFileSync('.openai/hosting.json','build/.openai/hosting.json');
bundled+=`\nconst {handleApi} = __modules['server/api.js'];\nconst ASSETS = ${JSON.stringify(assets)};\nexport default { async fetch(request, env) { const url=new URL(request.url); if(url.pathname.startsWith('/api/')) return handleApi(request,env); const a=ASSETS[url.pathname==='/'?'/index.html':url.pathname];if(!a) return new Response('Not found',{status:404});return new Response(Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)),{headers:{'content-type':a.type,'cache-control':'public, max-age=300','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}}); } };\n`;
fs.writeFileSync('build/server/index.js',bundled);
console.log('DIT Worker built:',graph.size,'modules;',Object.keys(assets).length,'assets');
