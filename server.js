const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, '.data'));
const DB_FILE = path.join(DATA_DIR, 'database.json');
const oauthStates = new Map();
let googleKeysCache = { expires: 0, keys: [] };
const random = (n = 24) => crypto.randomBytes(n).toString('base64url');
const blank = () => ({ users: [], follows: [], rooms: [], members: [], queue: [], votes: [], messages: [], authSessions: [] });
fs.mkdirSync(DATA_DIR, { recursive: true });
function normalizeDb(value) {
  const state=value&&typeof value==='object'&&!Array.isArray(value)?value:blank();
  for (const key of ['users','follows','rooms','members','queue','votes','messages','sessions','sessionMessages','listenerSessions','closeFriends','sessionRequests','authSessions']) if (!Array.isArray(state[key])) state[key] = [];
  const closeFriendKeys=new Set();state.closeFriends=state.closeFriends.filter(f=>{const key=`${f.hostId}:${f.userId}`;if(!f.hostId||!f.userId||f.hostId===f.userId||closeFriendKeys.has(key)||!state.follows.some(r=>r.from===f.hostId&&r.to===f.userId))return false;closeFriendKeys.add(key);return true;});
  state.authSessions=state.authSessions.filter(s=>s&&typeof s.tokenHash==='string'&&s.userId&&Number(s.expires)>Date.now());
  return state;
}
function readDbFile() { try { return normalizeDb(JSON.parse(fs.readFileSync(DB_FILE,'utf8'))); } catch (error) { if(error.code==='ENOENT')return blank(); throw error; } }
let db=readDbFile();
let saveChain = Promise.resolve();
function save() {
  saveChain = saveChain.then(() => fs.promises.writeFile(DB_FILE + '.tmp', JSON.stringify(db), { mode: 0o600 }).then(() => fs.promises.rename(DB_FILE + '.tmp', DB_FILE)));
  return saveChain;
}
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function acquireDbLock() {
  const lockPath=DB_FILE+'.lock';
  while(true){
    const nonce=random(8);
    try {
      const handle=await fs.promises.open(lockPath,'wx',0o600);
      await handle.writeFile(JSON.stringify({pid:process.pid,nonce,createdAt:Date.now()}));
      return async()=>{await handle.close().catch(()=>{});try{const lock=JSON.parse(await fs.promises.readFile(lockPath,'utf8'));if(lock.nonce===nonce)await fs.promises.unlink(lockPath);}catch{}};
    } catch(error) {
      if(error.code!=='EEXIST')throw error;
      try {
        const [raw,stat]=await Promise.all([fs.promises.readFile(lockPath,'utf8'),fs.promises.stat(lockPath)]);
        let lock=null;try{lock=JSON.parse(raw)}catch{}
        let ownerAlive=!!lock?.pid;
        if(ownerAlive){try{process.kill(lock.pid,0)}catch(e){if(e.code==='ESRCH')ownerAlive=false}}
        if(!ownerAlive&&Date.now()-stat.mtimeMs>1000)await fs.promises.unlink(lockPath).catch(()=>{});
      } catch(e) { if(e.code!=='ENOENT')throw e; }
      await wait(10);
    }
  }
}
async function withFreshDb(fn,res) {
  let release;
  try { release=await acquireDbLock();db=readDbFile();await fn(); }
  catch(error) { if(!res.headersSent)send(res,error.status||500,{error:error.status?error.message:'Could not read or update shared application data.'}); }
  finally { if(release)await release(); }
}
function send(res, status, value, extra = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
  res.end(JSON.stringify(value));
}
function cookieFor(req, sid) { const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''; return `sn_session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`; }
function sessionTokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function createSession(userId) { const token=random(32);db.authSessions.push({tokenHash:sessionTokenHash(token),userId,expires:Date.now()+30*86400000});return token; }
function safeUser(u) { return { id: u.id, username: u.username, name: u.name, bio: u.bio || '', avatar: u.avatar || '', visibility: u.visibility || 'everyone', createdAt: u.createdAt }; }
async function verifyGoogleIdToken(token, nonce) {
  const parts=String(token).split('.');if(parts.length!==3)throw new Error('Malformed identity token');
  const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(header.alg!=='RS256'||!header.kid)throw new Error('Unsupported identity token signature');
  if(googleKeysCache.expires<Date.now()) {const response=await fetch('https://www.googleapis.com/oauth2/v3/certs');if(!response.ok)throw new Error('Could not retrieve Google signing keys');const keys=await response.json();googleKeysCache={keys:keys.keys||[],expires:Date.now()+Math.min(Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||3600),3600)*1000};}
  const jwk=googleKeysCache.keys.find(key=>key.kid===header.kid);if(!jwk)throw new Error('Unknown Google signing key');
  const publicKey=crypto.createPublicKey({key:jwk,format:'jwk'});const valid=crypto.verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),publicKey,Buffer.from(parts[2],'base64url'));if(!valid)throw new Error('Invalid identity token signature');
  const now=Math.floor(Date.now()/1000),aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(!aud.includes(process.env.GOOGLE_CLIENT_ID)||claims.azp&&claims.azp!==process.env.GOOGLE_CLIENT_ID||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||Number(claims.exp)<=now||Number(claims.iat)>now+60||claims.nonce!==nonce||!(claims.email_verified===true||claims.email_verified==='true')||!claims.sub)throw new Error('Google identity did not pass validation');
  return claims;
}
function member(roomId, userId) { return db.members.find(m => m.roomId === roomId && m.userId === userId); }
function roomFor(id) { return db.rooms.find(r => r.id === id); }
function canSeeActivity(owner, viewer) {
  if (!owner) return false;
  if (owner.id === viewer?.id || owner.visibility === 'everyone') return true;
  if (owner.visibility === 'followers') return db.follows.some(f => f.from === viewer?.id && f.to === owner.id);
  return false;
}
function roomView(r, viewer) {
  const host = member(r.id, viewer.id)?.role === 'host';
  const nowPlaying = db.queue.find(q => q.id === r.currentQueueId) || null;
  return { id:r.id, name:r.name, isPrivate:r.isPrivate, code:r.isPrivate ? undefined : undefined,
    ownerId:r.ownerId, createdAt:r.createdAt, status:r.status || 'active', currentQueueId:r.currentQueueId || null,
    playback:r.playback || 'paused', playbackPosition:Number(r.playbackPosition)||0, playbackUpdatedAt:Number(r.playbackUpdatedAt)||Date.now(), members:db.members.filter(m=>m.roomId===r.id).map(m=>({user:safeUser(db.users.find(u=>u.id===m.userId)),role:m.role})),
    queue:db.queue.filter(q=>q.roomId===r.id).map(q=>({...q, votes:db.votes.filter(v=>v.queueId===q.id).reduce((n,v)=>n+v.value,0), myVote:db.votes.find(v=>v.queueId===q.id&&v.userId===viewer.id)?.value||0})),
    messages:db.messages.filter(m=>m.roomId===r.id).slice(-100), host, nowPlaying };
}
async function body(req) {
  let raw=''; for await (const c of req) { raw += c; if (raw.length > 20000) throw Object.assign(new Error('Request too large'), { status:413 }); }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('Invalid JSON'), { status:400 }); }
}
function auth(req) {
  const sid = (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('sn_session='))?.slice(11);
  const session = sid && db.authSessions.find(s=>s.tokenHash===sessionTokenHash(sid));
  if (!session || session.expires < Date.now()) throw Object.assign(new Error('Please sign in to continue.'), { status:401 });
  const user=db.users.find(u=>u.id===session.userId);
  if(!user)throw Object.assign(new Error('Please sign in to continue.'), { status:401 });
  return user;
}
function requireRoom(id, user) {
  const r = roomFor(id); if (!r) throw Object.assign(new Error('Room not found.'), {status:404});
  if (!member(id,user.id)) throw Object.assign(new Error('Join this room to view its content.'), {status:403});
  return r;
}
function requireActiveRoom(id, user) {
  const r=requireRoom(id,user);
  if((r.status||'active')!=='active')throw Object.assign(new Error('This room is closed. The host must start it before it can be used.'),{status:409});
  return r;
}
function activeSessionFor(userId) { return db.sessions.find(s=>s.hostId===userId&&s.status==='active')||null; }
function audienceAllows(s, viewer) { return s.audience==='everyone'||s.audience==='followers'&&db.follows.some(f=>f.from===viewer.id&&f.to===s.hostId)||s.audience==='close-friends'&&db.closeFriends.some(f=>f.hostId===s.hostId&&f.userId===viewer.id)&&db.follows.some(f=>f.from===s.hostId&&f.to===viewer.id); }
function sessionCanView(s,user) { return !!s&&(s.hostId===user.id||s.participants?.includes(user.id)); }
function sessionView(s,user) { if(!sessionCanView(s,user))throw Object.assign(new Error('Session not found.'),{status:404});const host=db.users.find(u=>u.id===s.hostId);const corner=host?.corner||{};return {id:s.id,hostId:s.hostId,host:safeUser(host),videoId:s.videoId,title:s.title,playback:s.playback,position:Number(s.position)||0,updatedAt:s.updatedAt,audience:s.audience,status:s.status,hostActive:s.status==='active'&&Date.now()-s.hostSeenAt<45000,participants:(s.participants||[]).map(id=>db.users.find(u=>u.id===id)).filter(Boolean).map(safeUser),queue:(corner.queue||[]).map(q=>({id:q.id,videoId:q.videoId,title:q.title})),isHost:s.hostId===user.id,messages:db.sessionMessages.filter(x=>x.sessionId===s.id).slice(-100)}; }
function expireSessions(){let changed=false;for(const s of db.sessions)if(s.status==='active'&&Date.now()-Number(s.hostSeenAt||0)>45000){s.status='ended';s.endedAt=Date.now();changed=true;}if(changed)save().catch(()=>{});}
async function route(req,res) {
  const url = new URL(req.url, 'http://localhost'); const p=url.pathname; const method=req.method;
  try {
    if (p === '/auth/google' && method === 'GET') {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.APP_URL) return send(res, 503, {error:'Google sign-in is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_URL.'});
      const state=random(32),nonce=random(32);oauthStates.set(state,{nonce,expires:Date.now()+10*60*1000});
      const redirectUri=new URL('/auth/google/callback',process.env.APP_URL).toString();
      const authUrl=new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.search=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state,nonce,prompt:'select_account'}).toString();
      res.writeHead(302,{location:authUrl.toString(),'cache-control':'no-store'});return res.end();
    }
    if (p === '/auth/google/callback' && method === 'GET') {
      const state=url.searchParams.get('state');const saved=state&&oauthStates.get(state);if(state)oauthStates.delete(state);
      if(!saved||saved.expires<Date.now()||!url.searchParams.get('code')){res.writeHead(302,{location:'/?oauth_error=state'});return res.end();}
      if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET||!process.env.APP_URL){res.writeHead(302,{location:'/?oauth_error=configuration'});return res.end();}
      try {
        const redirectUri=new URL('/auth/google/callback',process.env.APP_URL).toString();
        const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:url.searchParams.get('code'),client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code'})});
        if(!tokenResponse.ok)throw new Error('Token exchange failed');const tokens=await tokenResponse.json();if(!tokens.id_token||!tokens.access_token)throw new Error('Missing identity tokens');
        const claims=await verifyGoogleIdToken(tokens.id_token,saved.nonce);
        const infoResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{authorization:`Bearer ${tokens.access_token}`}});if(!infoResponse.ok)throw new Error('Could not load Google profile');const info=await infoResponse.json();
        if(info.sub!==claims.sub||!info.email)throw new Error('Google profile did not match identity');
        let user=db.users.find(u=>u.googleSub===info.sub);
        if(!user){const stem=String(info.email).split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,16)||'listener';let username=stem,n=1;while(db.users.some(u=>u.username===username))username=`${stem.slice(0,Math.max(3,19-String(n).length))}_${n++}`;user={id:random(12),username,name:String(info.name||stem).slice(0,50),bio:'',avatar:String(info.picture||'').slice(0,500),visibility:'everyone',googleSub:info.sub,createdAt:new Date().toISOString()};db.users.push(user);await save();}
        const sid=createSession(user.id);await save();res.writeHead(302,{location:'/#home','set-cookie':cookieFor(req,sid),'cache-control':'no-store'});return res.end();
      }catch(e){console.error('Google sign-in failed:',e.message);res.writeHead(302,{location:'/?oauth_error=google'});return res.end();}
    }
    if (p.startsWith('/api/')) {
      const data = ['POST','PUT','PATCH'].includes(method) ? await body(req) : {};
      if (p==='/api/auth/providers'&&method==='GET') return send(res,200,{google:!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.APP_URL)});
      if (p==='/api/auth/signup' && method==='POST') {
        const username=String(data.username||'').trim().toLowerCase(); const name=String(data.name||'').trim(); const password=String(data.password||'');
        if (!/^[a-z0-9_]{3,20}$/.test(username) || !name || name.length>50 || password.length<8 || password.length>128) throw Object.assign(new Error('Use a 3–20 character username, display name, and password of at least 8 characters.'),{status:400});
        if (db.users.some(u=>u.username===username)) throw Object.assign(new Error('That username is already taken.'),{status:409});
        const salt=crypto.randomBytes(16).toString('hex');
        const user={id:random(12),username,name,bio:'',visibility:'everyone',password:salt+':'+(await scrypt(password,salt,64)).toString('hex'),createdAt:new Date().toISOString()}; db.users.push(user); await save();
        const sid=createSession(user.id);await save(); return send(res,201,{user:safeUser(user)},{'set-cookie':cookieFor(req,sid)});
      }
      if (p==='/api/auth/login' && method==='POST') {
        const u=db.users.find(x=>x.username===String(data.username||'').trim().toLowerCase());
        let ok=false; if (u?.password?.includes(':')) { const [salt,expected]=u.password.split(':'); const actual=await scrypt(String(data.password||''),salt,64); ok=crypto.timingSafeEqual(Buffer.from(expected,'hex'),actual); }
        if (!ok) throw Object.assign(new Error('Username or password is incorrect.'),{status:401});
        const sid=createSession(u.id);await save(); return send(res,200,{user:safeUser(u)},{'set-cookie':cookieFor(req,sid)});
      }
      if (p==='/api/auth/logout' && method==='POST') { const sid=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sn_session='))?.slice(11); if(sid){const hash=sessionTokenHash(sid);db.authSessions=db.authSessions.filter(s=>s.tokenHash!==hash);await save();}return send(res,200,{ok:true},{'set-cookie':'sn_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'}); }
      const user=auth(req);
      if(p==='/api/me'&&method==='GET'){const active=activeSessionFor(user.id);return send(res,200,{user:safeUser(user),following:db.follows.filter(f=>f.from===user.id).map(f=>f.to),followingUsers:db.follows.filter(f=>f.from===user.id).map(f=>db.users.find(u=>u.id===f.to)).filter(Boolean).map(safeUser),followers:db.follows.filter(f=>f.to===user.id).length,activity:active&&active.audience!=='off'?{sessionId:active.id,videoId:active.videoId,title:active.title,playback:active.playback,audience:active.audience}:null});}
      if(p==='/api/profile'&&method==='PATCH') {
        if(data.name!==undefined){const n=String(data.name).trim();if(!n||n.length>50)throw Object.assign(new Error('Display name must be 1–50 characters.'),{status:400});user.name=n;}
        if(data.bio!==undefined){if(String(data.bio).length>180)throw Object.assign(new Error('Bio must be 180 characters or fewer.'),{status:400});user.bio=String(data.bio);}
        if(data.visibility!==undefined){if(!['everyone','followers','nobody'].includes(data.visibility))throw Object.assign(new Error('Choose a valid visibility setting.'),{status:400});user.visibility=data.visibility;}
        await save();return send(res,200,{user:safeUser(user)});
      }
      if(p==='/api/corner'&&method==='GET'){expireSessions();return send(res,200,{corner:user.corner||{videoId:null,title:'',playback:'paused',position:0,updatedAt:Date.now(),queue:[]},session:activeSessionFor(user.id),closeFriends:db.closeFriends.filter(f=>f.hostId===user.id).map(f=>f.userId)});}
      if(p==='/api/corner'&&method==='PUT'){const videoId=String(data.videoId||'').trim();if(videoId&&!/^[A-Za-z0-9_-]{11}$/.test(videoId))throw Object.assign(new Error('Enter a valid YouTube video ID.'),{status:400});user.corner={...(user.corner||{}),videoId:videoId||null,title:String(data.title||'').trim().slice(0,100),updatedAt:Date.now(),position:0,playback:'paused',queue:user.corner?.queue||[]};if(videoId&&!user.corner.queue.some(q=>q.videoId===videoId))user.corner.queue.push({id:random(8),videoId,title:user.corner.title||`YouTube video ${videoId}`});const s=activeSessionFor(user.id);if(s&&videoId){s.videoId=videoId;s.title=user.corner.title;s.position=0;s.updatedAt=Date.now();s.playback='paused';}await save();return send(res,200,{corner:user.corner});}
      if(p==='/api/corner/queue'&&method==='POST'){const videoId=String(data.videoId||'').trim();if(!/^[A-Za-z0-9_-]{11}$/.test(videoId))throw Object.assign(new Error('Enter a valid YouTube video ID.'),{status:400});const c=user.corner||(user.corner={videoId:null,title:'',playback:'paused',position:0,updatedAt:Date.now(),queue:[]});c.queue=c.queue||[];const item={id:random(8),videoId,title:String(data.title||'').trim().slice(0,100)||`YouTube video ${videoId}`};c.queue.push(item);if(!c.videoId){c.videoId=videoId;c.title=item.title;c.position=0;c.playback='paused';}c.updatedAt=Date.now();await save();return send(res,201,{corner:c});}
      if(p==='/api/corner/next'&&method==='POST'){const c=user.corner||{};const queue=c.queue||[];if(!queue.length)throw Object.assign(new Error('Add a video to your queue first.'),{status:400});const index=queue.findIndex(q=>q.videoId===c.videoId);const next=queue[(index+1+queue.length)%queue.length];c.videoId=next.videoId;c.title=next.title;c.position=0;c.playback='playing';c.updatedAt=Date.now();user.corner=c;const s=activeSessionFor(user.id);if(s){s.videoId=c.videoId;s.title=c.title;s.position=0;s.playback='playing';s.updatedAt=c.updatedAt;s.hostSeenAt=Date.now();}await save();return send(res,200,{corner:c});}
      if(p==='/api/corner/play'&&method==='POST'){const c=user.corner||(user.corner={videoId:null,title:'',playback:'paused',position:0});if(data.status!==undefined){if(!['playing','paused'].includes(data.status))throw Object.assign(new Error('Playback state must be playing or paused.'),{status:400});c.playback=data.status;}if(data.position!==undefined){const position=Number(data.position);if(!Number.isFinite(position)||position<0||position>86400)throw Object.assign(new Error('Invalid playback position.'),{status:400});c.position=position;}c.updatedAt=Date.now();const s=activeSessionFor(user.id);if(s){s.videoId=c.videoId;s.title=c.title;s.playback=c.playback;s.position=c.position;s.updatedAt=c.updatedAt;s.hostSeenAt=Date.now();}await save();return send(res,200,{corner:c,session:s?sessionView(s,user):null});}
      if(p==='/api/share'&&method==='POST'){const audience=String(data.audience||'off');if(!['everyone','followers','close-friends','off'].includes(audience))throw Object.assign(new Error('Choose a valid sharing audience.'),{status:400});const c=user.corner||{};if(audience!=='off'&&!c.videoId)throw Object.assign(new Error('Load a YouTube video in Your Corner before sharing.'),{status:400});let s=activeSessionFor(user.id);if(!s&&audience!=='off'){s={id:random(12),hostId:user.id,videoId:c.videoId,title:c.title||'',playback:c.playback||'paused',position:Number(c.position)||0,updatedAt:Date.now(),hostSeenAt:Date.now(),audience,status:'active',participants:[],createdAt:Date.now()};db.sessions.push(s);}if(s){s.audience=audience;s.updatedAt=Date.now();s.hostSeenAt=Date.now();}user.shareAudience=audience;await save();return send(res,200,{audience,session:s?{id:s.id,status:s.status}:null});}
      if(p==='/api/close-friends'&&method==='GET')return send(res,200,{people:db.users.filter(u=>db.follows.some(f=>f.from===user.id&&f.to===u.id)).map(u=>({...safeUser(u),selected:db.closeFriends.some(f=>f.hostId===user.id&&f.userId===u.id)}))});
      if(p==='/api/close-friends'&&method==='PUT'){if(!Array.isArray(data.userIds)||data.userIds.length>200)throw Object.assign(new Error('Provide a valid close friends list.'),{status:400});const ids=[...new Set(data.userIds.map(String))];if(ids.some(id=>id===user.id||!db.follows.some(f=>f.from===user.id&&f.to===id)))throw Object.assign(new Error('Close Friends can only include accounts you follow.'),{status:403});db.closeFriends=db.closeFriends.filter(f=>f.hostId!==user.id);for(const userId of ids)db.closeFriends.push({hostId:user.id,userId});await save();return send(res,200,{userIds:ids});}
      if(p==='/api/peoples'&&method==='GET'){expireSessions();const people=db.users.map(person=>{const following=db.follows.some(f=>f.from===user.id&&f.to===person.id);const active=person.id===user.id?null:db.sessions.find(s=>s.hostId===person.id&&s.status==='active');const visible=active&&active.audience!=='off'&&audienceAllows(active,user);const activity=visible?{sessionId:active.id,videoId:active.videoId,title:active.title,playback:active.playback,updatedAt:active.updatedAt,audience:active.audience,participants:(active.participants||[]).length,thumbnail:`https://i.ytimg.com/vi/${encodeURIComponent(active.videoId)}/hqdefault.jpg`}:null;return{...safeUser(person),following,isSelf:person.id===user.id,activity,sharing:!!visible};});return send(res,200,{people});}
      if((m=p.match(/^\/api\/sessions\/([^/]+)\/join$/))&&method==='POST'){expireSessions();const s=db.sessions.find(x=>x.id===m[1]);if(!s||s.status!=='active'||s.audience==='off'||!audienceAllows(s,user))throw Object.assign(new Error('This listening session is unavailable to you.'),{status:403});if(s.hostId===user.id)throw Object.assign(new Error('You are already hosting this session.'),{status:400});const oldId=db.listenerSessions.find(x=>x.userId===user.id)?.sessionId;if(oldId){const old=db.sessions.find(x=>x.id===oldId);if(old)old.participants=old.participants.filter(id=>id!==user.id);db.listenerSessions=db.listenerSessions.filter(x=>x.userId!==user.id);}if(!s.participants.includes(user.id))s.participants.push(user.id);db.listenerSessions.push({userId:user.id,sessionId:s.id,joinedAt:Date.now(),lastSeenAt:Date.now()});await save();return send(res,200,{session:sessionView(s,user)});}
      if((m=p.match(/^\/api\/sessions\/([^/]+)$/))&&method==='GET'){expireSessions();const s=db.sessions.find(x=>x.id===m[1]);return send(res,200,{session:sessionView(s,user)});}
      if((m=p.match(/^\/api\/sessions\/([^/]+)\/heartbeat$/))&&method==='POST'){expireSessions();const s=db.sessions.find(x=>x.id===m[1]);if(!sessionCanView(s,user))throw Object.assign(new Error('Session not found.'),{status:404});if(s.hostId===user.id){s.hostSeenAt=Date.now();const c=user.corner||{};s.videoId=c.videoId;s.title=c.title;s.playback=c.playback||'paused';s.position=Number(c.position)||0;s.updatedAt=Number(c.updatedAt)||Date.now();}else{const lm=db.listenerSessions.find(x=>x.userId===user.id&&x.sessionId===s.id);if(!lm)throw Object.assign(new Error('You have left this session.'),{status:403});lm.lastSeenAt=Date.now();}await save();return send(res,200,{session:sessionView(s,user)});}
      if((m=p.match(/^\/api\/sessions\/([^/]+)\/leave$/))&&method==='POST'){const s=db.sessions.find(x=>x.id===m[1]);if(!sessionCanView(s,user)||s.hostId===user.id)throw Object.assign(new Error('Session not found.'),{status:404});s.participants=s.participants.filter(id=>id!==user.id);db.listenerSessions=db.listenerSessions.filter(x=>!(x.userId===user.id&&x.sessionId===s.id));await save();return send(res,200,{ok:true});}
      if((m=p.match(/^\/api\/sessions\/([^/]+)\/play$/))&&method==='POST'){const s=db.sessions.find(x=>x.id===m[1]);if(!sessionCanView(s,user)||s.hostId!==user.id||s.status!=='active')throw Object.assign(new Error('Only the active host can control shared playback.'),{status:403});const c=user.corner||{};if(data.status!==undefined){if(!['playing','paused'].includes(data.status))throw Object.assign(new Error('Invalid playback state.'),{status:400});c.playback=data.status;}if(data.position!==undefined){const position=Number(data.position);if(!Number.isFinite(position)||position<0||position>86400)throw Object.assign(new Error('Invalid playback position.'),{status:400});c.position=position;}c.updatedAt=Date.now();user.corner=c;s.videoId=c.videoId;s.title=c.title;s.playback=c.playback;s.position=c.position;s.updatedAt=c.updatedAt;s.hostSeenAt=Date.now();await save();return send(res,200,{session:sessionView(s,user)});}
      if((m=p.match(/^\/api\/sessions\/([^/]+)\/requests$/))&&['GET','POST'].includes(method)){const s=db.sessions.find(x=>x.id===m[1]);if(!s||!sessionCanView(s,user))throw Object.assign(new Error('Session not found.'),{status:404});if(method==='GET'){if(s.hostId!==user.id&&!(s.participants||[]).includes(user.id))throw Object.assign(new Error('Session requests are unavailable.'),{status:403});const requests=db.sessionRequests.filter(x=>x.sessionId===s.id&&(s.hostId===user.id||x.requesterId===user.id)).map(x=>({...x,requester:safeUser(db.users.find(u=>u.id===x.requesterId))}));return send(res,200,{requests});}if(s.status!=='active'||s.hostId===user.id||!(s.participants||[]).includes(user.id))throw Object.assign(new Error('Only current listeners can request songs.'),{status:403});const videoId=String(data.videoId||'').trim();if(!/^[A-Za-z0-9_-]{11}$/.test(videoId))throw Object.assign(new Error('Enter a valid YouTube video ID.'),{status:400});const duplicate=db.sessionRequests.find(x=>x.sessionId===s.id&&x.requesterId===user.id&&x.videoId===videoId&&x.status==='pending');if(duplicate)return send(res,200,{request:duplicate,duplicate:true});const request={id:random(10),sessionId:s.id,hostId:s.hostId,requesterId:user.id,videoId,title:String(data.title||'').trim().slice(0,100)||`YouTube video ${videoId}`,status:'pending',createdAt:new Date().toISOString(),queueItemId:null};db.sessionRequests.push(request);await save();return send(res,201,{request});}
      if((m=p.match(/^\/api\/sessions\/([^/]+)\/requests\/([^/]+)$/))&&method==='POST'){const s=db.sessions.find(x=>x.id===m[1]),request=db.sessionRequests.find(x=>x.id===m[2]&&x.sessionId===m[1]);if(!s||!request)throw Object.assign(new Error('Song request not found.'),{status:404});if(s.hostId!==user.id)throw Object.assign(new Error('Only the session host can review song requests.'),{status:403});const decision=String(data.status||'');if(!['approved','rejected'].includes(decision))throw Object.assign(new Error('Choose approve or reject.'),{status:400});if(request.status===decision)return send(res,200,{request,queue: user.corner?.queue||[]});if(request.status!=='pending')throw Object.assign(new Error('This request has already been reviewed.'),{status:409});if(s.status!=='active')throw Object.assign(new Error('This session has ended; its requests cannot be approved.'),{status:410});request.status=decision;request.reviewedAt=new Date().toISOString();if(decision==='approved'){const c=user.corner||(user.corner={videoId:s.videoId,title:s.title,playback:s.playback,position:s.position,updatedAt:Date.now(),queue:[]});c.queue=c.queue||[];let item=c.queue.find(q=>q.videoId===request.videoId);if(!item){item={id:random(8),videoId:request.videoId,title:request.title};c.queue.push(item);}request.queueItemId=item.id;request.addedToQueue=true;}await save();return send(res,200,{request,queue:user.corner?.queue||[]});}
      if((m=p.match(/^\/api\/sessions\/([^/]+)\/messages$/))&&['GET','POST'].includes(method)){const s=db.sessions.find(x=>x.id===m[1]);if(!sessionCanView(s,user)||!((s.participants||[]).includes(user.id)||s.hostId===user.id))throw Object.assign(new Error('Session chat is unavailable.'),{status:403});if(method==='GET')return send(res,200,{messages:db.sessionMessages.filter(x=>x.sessionId===s.id).slice(-100)});if(s.status!=='active')throw Object.assign(new Error('This session chat is read-only because the host has left.'),{status:410});const text=String(data.text||'').trim();if(!text||text.length>500)throw Object.assign(new Error('Message must be 1–500 characters.'),{status:400});const msg={id:random(8),sessionId:s.id,user:safeUser(user),text,createdAt:new Date().toISOString()};db.sessionMessages.push(msg);await save();return send(res,201,{message:msg});}
      if(p==='/api/corner/end'&&method==='POST'){const s=activeSessionFor(user.id);if(s){s.status='ended';s.endedAt=Date.now();s.audience='off';s.updatedAt=Date.now();}user.shareAudience='off';await save();return send(res,200,{ok:true});}
      if(p==='/api/people'&&method==='GET') return send(res,200,{people:db.users.filter(u=>u.id!==user.id).map(u=>{const can=canSeeActivity(u,user);const active=db.rooms.find(r=>member(r.id,u.id)&&r.playback==='playing');return {...safeUser(u),following:db.follows.some(f=>f.from===user.id&&f.to===u.id),activity:can&&active?{room:active.name,track:db.queue.find(q=>q.id===active.currentQueueId)?.title||null}:null};})});
      if((m=p.match(/^\/api\/people\/([^/]+)$/))&&method==='GET'){const u=db.users.find(x=>x.username===m[1]||x.id===m[1]);if(!u)throw Object.assign(new Error('Profile not found.'),{status:404});const active=activeSessionFor(u.id),visible=active&&active.audience!=='off'&&(u.id===user.id||audienceAllows(active,user));const activity=visible?{sessionId:active.id,videoId:active.videoId,title:active.title,playback:active.playback,audience:active.audience,participants:(active.participants||[]).length}:null;return send(res,200,{user:safeUser(u),following:u.id!==user.id&&db.follows.some(f=>f.from===user.id&&f.to===u.id),followingUsers:db.follows.filter(f=>f.from===u.id).map(f=>db.users.find(x=>x.id===f.to)).filter(Boolean).map(safeUser),activity});}
      if((m=p.match(/^\/api\/people\/([^/]+)\/follow$/))&&method==='POST'){const to=db.users.find(u=>u.id===m[1]||u.username===m[1]);if(!to)throw Object.assign(new Error('Account not found.'),{status:404});if(to.id===user.id)throw Object.assign(new Error('You cannot follow yourself.'),{status:400});const matches=db.follows.filter(f=>f.from===user.id&&f.to===to.id);if(matches.length){db.follows=db.follows.filter(f=>!(f.from===user.id&&f.to===to.id));db.closeFriends=db.closeFriends.filter(f=>!(f.hostId===user.id&&f.userId===to.id));}else db.follows.push({from:user.id,to:to.id});await save();return send(res,200,{following:!matches.length,userId:to.id});}
      if(p==='/api/rooms'&&method==='GET')return send(res,200,{rooms:db.rooms.filter(r=>!r.isPrivate||!!member(r.id,user.id)).map(r=>({id:r.id,name:r.name,isPrivate:!!r.isPrivate,status:r.status||'active',isHost:member(r.id,user.id)?.role==='host',isMember:!!member(r.id,user.id),members:db.members.filter(m=>m.roomId===r.id).length,track:db.queue.find(q=>q.id===r.currentQueueId)?.title||null}))});
      if(p==='/api/rooms'&&method==='POST'){const name=String(data.name||'').trim();if(!name||name.length>60)throw Object.assign(new Error('Room name must be 1–60 characters.'),{status:400});const r={id:random(12),name,isPrivate:!!data.isPrivate,ownerId:user.id,code:random(6).toUpperCase().slice(0,8),createdAt:new Date().toISOString(),status:'active',playback:'paused'};db.rooms.push(r);db.members.push({roomId:r.id,userId:user.id,role:'host'});await save();return send(res,201,{room:roomView(r,user),inviteCode:r.isPrivate?r.code:null});}
      if(p==='/api/rooms/join'&&method==='POST'){const code=String(data.code||'').trim().toUpperCase();const r=db.rooms.find(x=>x.code===code);if(!r)throw Object.assign(new Error('Invitation code is invalid.'),{status:404});if((r.status||'active')!=='active')throw Object.assign(new Error('This room is closed. The host must start it before anyone can join.'),{status:409});if(!member(r.id,user.id))db.members.push({roomId:r.id,userId:user.id,role:'member'});await save();return send(res,200,{room:roomView(r,user)});}
      if((m=p.match(/^\/api\/rooms\/([^/]+)\/status$/))&&method==='POST'){const r=requireRoom(m[1],user);if(member(r.id,user.id)?.role!=='host')throw Object.assign(new Error('Only the room host can close or start this room.'),{status:403});const status=String(data.status||'');if(!['active','closed'].includes(status))throw Object.assign(new Error('Room status must be active or closed.'),{status:400});if(status==='closed'&&(r.status||'active')==='active'){if(r.playback==='playing')r.playbackPosition=(Number(r.playbackPosition)||0)+Math.max(0,(Date.now()-Number(r.playbackUpdatedAt||Date.now()))/1000);r.playback='paused';r.playbackUpdatedAt=Date.now();}r.status=status;await save();return send(res,200,{room:roomView(r,user)});}
      if((m=p.match(/^\/api\/rooms\/([^/]+)$/))&&method==='GET'){const r=requireRoom(m[1],user);return send(res,200,{room:roomView(r,user)});}
      if((m=p.match(/^\/api\/rooms\/([^/]+)\/join$/))&&method==='POST'){const r=roomFor(m[1]);if(!r)throw Object.assign(new Error('Room not found.'),{status:404});if(r.isPrivate)throw Object.assign(new Error('Private rooms require an invitation code.'),{status:403});if((r.status||'active')!=='active')throw Object.assign(new Error('This room is closed. The host must start it before anyone can join.'),{status:409});if(!member(r.id,user.id))db.members.push({roomId:r.id,userId:user.id,role:'member'});await save();return send(res,200,{room:roomView(r,user)});}
      if((m=p.match(/^\/api\/rooms\/([^/]+)\/leave$/))&&method==='POST'){const r=requireRoom(m[1],user);const role=member(r.id,user.id)?.role;if(role==='host'&&(r.status||'active')==='closed'){await save();return send(res,200,{ok:true,roomRetained:true});}const wasHost=role==='host';db.members=db.members.filter(x=>!(x.roomId===r.id&&x.userId===user.id));if(!db.members.some(x=>x.roomId===r.id)){if((r.status||'active')==='active')db.rooms=db.rooms.filter(x=>x.id!==r.id);}else if(wasHost){const successor=db.members.find(x=>x.roomId===r.id);successor.role='host';r.ownerId=successor.userId;}await save();return send(res,200,{ok:true});}
      if((m=p.match(/^\/api\/rooms\/([^/]+)\/queue$/))&&method==='POST'){const r=requireActiveRoom(m[1],user);const type=data.type==='playlist'?'playlist':'video';const id=String(type==='playlist'?data.playlistId:data.videoId||'').trim();if(type==='video'&&!/^[A-Za-z0-9_-]{11}$/.test(id))throw Object.assign(new Error('Enter a valid YouTube video URL or 11-character video ID.'),{status:400});if(type==='playlist'&&!/^[A-Za-z0-9_-]{10,100}$/.test(id))throw Object.assign(new Error('Enter a valid YouTube playlist URL or playlist ID.'),{status:400});const title=String(data.title||'').trim().slice(0,100)||(type==='playlist'?'YouTube playlist':`YouTube video ${id}`);const q={id:random(10),roomId:r.id,type,videoId:type==='video'?id:null,playlistId:type==='playlist'?id:null,title,by:safeUser(user),createdAt:new Date().toISOString()};db.queue.push(q);if(!r.currentQueueId)r.currentQueueId=q.id;await save();return send(res,201,{room:roomView(r,user)});}
      if((m=p.match(/^\/api\/rooms\/([^/]+)\/play$/))&&method==='POST'){const r=requireActiveRoom(m[1],user);if(member(r.id,user.id)?.role!=='host')throw Object.assign(new Error('Only the room host can change shared playback.'),{status:403});if(data.queueId!==undefined&&!db.queue.some(q=>q.id===data.queueId&&q.roomId===r.id))throw Object.assign(new Error('Track not found in this room.'),{status:404});if(data.queueId!==undefined){r.currentQueueId=data.queueId;r.playbackPosition=0;}if(data.position!==undefined){const position=Number(data.position);if(!Number.isFinite(position)||position<0||position>86400)throw Object.assign(new Error('Invalid playback position.'),{status:400});r.playbackPosition=position;}if(data.status!==undefined){if(!['playing','paused'].includes(data.status))throw Object.assign(new Error('Playback state must be playing or paused.'),{status:400});r.playback=data.status;}r.playbackUpdatedAt=Date.now();await save();return send(res,200,{room:roomView(r,user)});}
      if((m=p.match(/^\/api\/rooms\/([^/]+)\/queue\/([^/]+)\/vote$/))&&method==='POST'){const r=requireActiveRoom(m[1],user),qid=m[2];if(!db.queue.some(q=>q.id===qid&&q.roomId===r.id))throw Object.assign(new Error('Track not found.'),{status:404});const value=Number(data.value);if(![-1,0,1].includes(value))throw Object.assign(new Error('Vote must be up, down, or removed.'),{status:400});db.votes=db.votes.filter(v=>!(v.queueId===qid&&v.userId===user.id));if(value)db.votes.push({queueId:qid,userId:user.id,value});await save();return send(res,200,{room:roomView(r,user)});}
      if((m=p.match(/^\/api\/rooms\/([^/]+)\/queue\/([^/]+)$/))&&method==='DELETE'){const r=requireActiveRoom(m[1],user);if(member(r.id,user.id)?.role!=='host')throw Object.assign(new Error('Only the host can remove tracks.'),{status:403});const qid=m[2];db.queue=db.queue.filter(q=>q.id!==qid);db.votes=db.votes.filter(v=>v.queueId!==qid);if(r.currentQueueId===qid){r.currentQueueId=db.queue.find(q=>q.roomId===r.id)?.id||null;r.playback='paused';}await save();return send(res,200,{room:roomView(r,user)});}
      if((m=p.match(/^\/api\/rooms\/([^/]+)\/messages$/))&&method==='POST'){const r=requireActiveRoom(m[1],user),text=String(data.text||'').trim();if(!text||text.length>500)throw Object.assign(new Error('Message must be 1–500 characters.'),{status:400});const msg={id:random(8),roomId:r.id,user:safeUser(user),text,createdAt:new Date().toISOString()};db.messages.push(msg);await save();return send(res,201,{message:msg});}
      throw Object.assign(new Error('Not found.'),{status:404});
    }
    let file = p==='/' ? 'index.html' : p.slice(1); file=path.resolve(ROOT,'public',file);if(!file.startsWith(path.resolve(ROOT,'public')+path.sep))return send(res,403,{error:'Forbidden'});
    const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};fs.readFile(file,(e,b)=>{if(e)return send(res,404,{error:'Not found'});res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-cache','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://www.youtube-nocookie.com; style-src 'self' 'unsafe-inline'; frame-src https://www.youtube-nocookie.com https://www.youtube.com; img-src 'self' https: data:; connect-src 'self'"});res.end(b);});
  } catch(e) { if (e.code==='ENOENT')return send(res,404,{error:'Not found'});send(res,e.status||500,{error:e.status?e.message:'Something went wrong.'}); }
}
let m;
http.createServer((req,res)=>{if(req.method==='GET'&&req.url==='/health'){res.writeHead(200,{'content-type':'text/plain'});return res.end('ok');}const pathname=new URL(req.url,'http://localhost').pathname;if(pathname.startsWith('/api/')||pathname==='/auth/google/callback')return withFreshDb(()=>route(req,res),res);route(req,res);}).listen(PORT,'0.0.0.0',()=>console.log(`Sync & Share listening on http://localhost:${PORT}`));
