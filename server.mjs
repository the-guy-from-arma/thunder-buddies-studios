import http from 'node:http';
import {readFile, mkdir, open, readdir, rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {randomUUID, timingSafeEqual} from 'node:crypto';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const services = ['Game development','Website or platform','Development support','Something else'];
const engines = ['Roblox','Unreal Engine','Unity','Godot','Enfusion','Web','Not sure yet'];
const budgets = ['Under $1,000','$1,000–$5,000','$5,000–$15,000','$15,000+','Let’s discuss'];
const timelines = ['As soon as possible','1–3 months','3–6 months','Flexible'];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function clean(value, max) { return typeof value === 'string' && value.trim().length <= max ? value.trim() : ''; }
export function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Please provide your project details.');
  const data = {name:clean(body.name,100),email:clean(body.email,254),company:clean(body.company,160),service:clean(body.service,80),engine:clean(body.engine,50),brief:clean(body.brief,5000),budget:clean(body.budget,50),timeline:clean(body.timeline,50),reference:clean(body.reference,1000)};
  if (data.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error('Please enter a name and valid email address.');
  if (!services.includes(data.service) || !engines.includes(data.engine)) throw new Error('Please choose a project type and platform.');
  if (data.brief.length < 30) throw new Error('Please describe your project in 30–5,000 characters.');
  if (!budgets.includes(data.budget) || !timelines.includes(data.timeline)) throw new Error('Please choose a budget and timeline.');
  if (body.consent !== true) throw new Error('Please agree to be contacted about your request.');
  if ((body.company && !data.company) || (body.reference && !data.reference)) throw new Error('An optional field is too long.');
  if(data.reference) { try { const url = new URL(data.reference); if(!['https:','http:'].includes(url.protocol))throw new Error(); } catch { throw new Error('Please provide a valid http or https reference link.'); } }
  return {...data, consent:true};
}
function secureEqual(a,b) { const x=Buffer.from(a || ''),y=Buffer.from(b || ''); return x.length===y.length && timingSafeEqual(x,y); }
async function readBody(req) {
  const chunks=[];let size=0;
  for await (const chunk of req) { size+=chunk.length;if(size>24000)throw Object.assign(new Error('Your request is too large.'),{status:413});chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Invalid request format.'),{status:400}); }
}
export function createStudioServer(config = {}) {
  const production = config.production ?? process.env.NODE_ENV === 'production';
  const dataDir = config.dataDir ?? process.env.REQUEST_DATA_DIR ?? '';
  const adminToken = config.adminToken ?? process.env.ADMIN_TOKEN ?? '';
  const publicOrigin = config.publicOrigin ?? process.env.PUBLIC_ORIGIN ?? '';
  const ready = !!dataDir && adminToken.length >= 32 && (!production || /^https:\/\//.test(publicOrigin));
  const limits = new Map();
  const pending = new Map();
  function allowed(key,max) {
    const now=Date.now();
    if(limits.size>5000)for(const [k,v] of limits)if(v.until<now)limits.delete(k);
    if(limits.size>10000&&!limits.has(key))return false;
    const bucket=limits.get(key);if(!bucket||bucket.until<now){limits.set(key,{count:1,until:now+3600000});return true;}return ++bucket.count<=max;
  }
  async function persist(key,record) {
    if(pending.has(key))return pending.get(key);
    const task=(async()=>{
      await mkdir(dataDir,{recursive:true,mode:0o700});
      const filename=path.join(dataDir,`${key}.json`);
      try {return JSON.parse(await readFile(filename,'utf8'));} catch(error){if(error.code!=='ENOENT')throw error;}
      const temporary=path.join(dataDir,`${key}.${randomUUID()}.tmp`);
      const handle=await open(temporary,'wx',0o600);
      try { await handle.writeFile(JSON.stringify(record));await handle.sync(); } finally { await handle.close(); }
      await rename(temporary,filename);
      return record;
    })();
    pending.set(key,task);
    try {return await task;} finally {pending.delete(key);}
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/health')return json(200,{status:'ok'});
      if(url.pathname==='/api/requests' && req.method==='POST') {
        const origin=req.headers.origin;
        const expected=publicOrigin || `http://${req.headers.host}`;
        if(origin!==expected)return json(403,{error:'Please send your request from the studio website.'});
        if(!ready)return json(503,{error:'The studio’s request inbox is not connected yet. Your brief is still here; please contact us through the Discord link below for now.'});
        if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'Please submit a JSON request.'});
        // Socket address is deliberately used rather than trusting spoofable forwarded headers.
        // On a reverse proxy this also supplies an aggregate limit; email has its own limit.
        if(!allowed(`ip:${req.socket.remoteAddress}`,120))return json(429,{error:'Too many requests. Please try again later.'});
        const body=await readBody(req);
        if(body?.website)return json(400,{error:'Unable to accept this request.'});
        let data;
        try {data=validateRequest(body);}catch(error){return json(400,{error:error.message});}
        const key=req.headers['idempotency-key'];
        if(typeof key!=='string'||!uuid.test(key))return json(400,{error:'Please refresh the page before submitting.'});
        const filename=path.join(dataDir,`${key}.json`);
        // Return a receipt only when both the idempotency key and the original details match.
        const match = record => JSON.stringify(record.details) === JSON.stringify(data);
        try {const existing=JSON.parse(await readFile(filename,'utf8'));if(!match(existing))return json(409,{error:'This request changed. Please refresh and submit again.'});return json(200,{id:existing.id});}catch(error){if(error.code!=='ENOENT')throw error;}
        if(!allowed(`email:${data.email.toLowerCase()}`,5))return json(429,{error:'You have sent several requests. Please try again later.'});
        const record=await persist(key,{id:`TBS-${randomUUID().slice(0,8).toUpperCase()}`,createdAt:new Date().toISOString(),details:data});
        if(!match(record))return json(409,{error:'This request changed. Please refresh and submit again.'});
        return json(201,{id:record.id});
      }
      if(url.pathname==='/api/admin/requests') {
        if(req.method!=='GET')return json(405,{error:'Method not allowed.'});
        if(!allowed(`admin:${req.socket.remoteAddress}`,120))return json(429,{error:'Too many attempts. Try again later.'});
        if(!ready || !secureEqual(req.headers.authorization,`Bearer ${adminToken}`))return json(401,{error:'A valid studio access token is required.'});
        await mkdir(dataDir,{recursive:true,mode:0o700});
        const names=(await readdir(dataDir)).filter(n=>uuid.test(n.replace(/\.json$/,''))&&n.endsWith('.json'));
        const records=await Promise.all(names.map(async n=>JSON.parse(await readFile(path.join(dataDir,n),'utf8'))));
        return json(200,{requests:records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
      }
      if(url.pathname.startsWith('/api/'))return json(404,{error:'Not found.'});
      if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Method not allowed.'});
      let pathname;
      try {pathname=decodeURIComponent(url.pathname);}catch{return json(400,{error:'Invalid path.'});}
      const route=pathname==='/'?'/index.html':pathname==='/admin'||pathname==='/admin/'?'/admin.html':pathname;
      const filename=path.resolve(root,`.${route}`);
      if(!filename.startsWith(root+path.sep)||route.includes('\\')||route.includes('\0'))return json(404,{error:'Not found.'});
      try {
        const contents=await readFile(filename);
        res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':route.startsWith('/admin')?'no-store':route==='/sw.js'?'no-cache':'public, max-age=0, must-revalidate'});
        res.end(req.method==='HEAD'?undefined:contents);
      } catch(error){if(['ENOENT','EISDIR'].includes(error.code))return json(404,{error:'Not found.'});throw error;}
    } catch(error) {if(!res.headersSent)json(error.status || 500,{error:error.status ? error.message : 'We couldn’t save or load that request. Please try again.'});else res.end();}
  });
  server.requestTimeout=30000;
  server.headersTimeout=15000;
  return server;
}
if(process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port=Number(process.env.PORT||8080);
  const server=createStudioServer();
  server.listen(port,'0.0.0.0',()=>console.log(`Thunder Buddies Studios listening on port ${port}`));
  process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
}
