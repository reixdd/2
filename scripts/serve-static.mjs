import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../public-dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
http.createServer((req,res)=>{let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return}let file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return}if(file===root)file=path.join(root,'index.html');if(!fs.existsSync(file))file+='.html';if(fs.existsSync(file)&&fs.statSync(file).isDirectory()){const index=path.join(file,'index.html');file=fs.existsSync(index)?index:file+'.html';}if(!fs.existsSync(file)){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res)}).listen(8791,'127.0.0.1',()=>console.log('Static validation server started.'));
