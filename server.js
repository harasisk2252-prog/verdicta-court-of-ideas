import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const localServer = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const publicDir = path.join(root, 'public');
const dataDir = process.env.VERDICTA_DATA_DIR || path.join(root, 'data');
if (localServer) fs.mkdirSync(dataDir, { recursive: true });
const envPath = path.join(root, '.env');
if (localServer && fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const galleryFile = path.join(dataDir, 'gallery.json');
const roomsFile = path.join(dataDir, 'rooms.json');

const seedGallery = [
  {id:'featured-1',topic:'Should AI replace traditional classrooms?',category:'Education',author:'The Verdicta Court',side:'balanced',count:128,views:2300,featured:true,createdAt:'2026-10-18T09:00:00.000Z'},
  {id:'featured-2',topic:'Is a four-day workweek the future?',category:'Society',author:'The Verdicta Court',side:'mixed',count:94,views:1800,featured:false,createdAt:'2026-10-21T09:00:00.000Z'},
  {id:'featured-3',topic:'Should social media require age verification?',category:'Technology',author:'The Verdicta Court',side:'balanced',count:76,views:1200,featured:false,createdAt:'2026-10-25T09:00:00.000Z'},
  {id:'featured-4',topic:'Can a city ever be truly car-free?',category:'Environment',author:'The Verdicta Court',side:'mixed',count:52,views:940,featured:false,createdAt:'2026-11-01T09:00:00.000Z'},
  {id:'featured-5',topic:'Should exams be replaced by project-based assessments?',category:'Education',author:'The Verdicta Court',side:'balanced',count:113,views:1560,featured:false,createdAt:'2026-11-03T09:00:00.000Z'},
  {id:'featured-6',topic:'Is remote work better for creativity?',category:'Work',author:'The Verdicta Court',side:'mixed',count:67,views:900,featured:false,createdAt:'2026-11-04T09:00:00.000Z'}
];
const loadJSON = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch {return fallback;} };
const saveJSON = (file, value) => fs.writeFileSync(file, JSON.stringify(value,null,2));
if (localServer && !fs.existsSync(galleryFile)) saveJSON(galleryFile, seedGallery);
if (localServer && !fs.existsSync(roomsFile)) saveJSON(roomsFile, {});
let gallery = localServer ? loadJSON(galleryFile, seedGallery) : seedGallery;
let rooms = localServer ? loadJSON(roomsFile, {}) : {};
const send = (res, code, payload) => {res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(payload));};
const clamp = (v, length=500) => String(v??'').trim().slice(0,length);
const safeTopic = t => clamp(t,180).replace(/[<>]/g,'');
const safeText = t => clamp(t,1200).replace(/[<>]/g,'');
const body = async req => {let chunks = [], bytes = 0; for await (const chunk of req) {bytes += chunk.length; if(bytes > 12000) throw new Error('Request too large'); chunks.push(chunk);} return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');};
const delay = (ms) => new Promise(resolve=>setTimeout(resolve,ms));

const detectFallacy = input => {
  const s = safeText(input), l = s.toLowerCase();
  const rules = [
    {re:/\b(everyone|everybody|all my friends|most people|sab log|har koi)\b/,name:'Bandwagon reasoning',reason:'Popularity alone is not evidence that a claim is true.',tip:'Add verifiable evidence beyond how many people agree.'},
    {re:/\b(always|never|everyone|nobody|all people|no one)\b/,name:'Overgeneralization',reason:'Absolute language may overlook important exceptions.',tip:'Explain the scope of your claim and acknowledge exceptions.'},
    {re:/\b(stupid|idiot|dumb|moron|fool)\b/,name:'Possible ad hominem',reason:'Criticizing a person does not refute their argument.',tip:'Focus on the reasoning and evidence instead of the speaker.'},
    {re:/\b(if we allow|will inevitably|then everyone will|next thing you know)\b/,name:'Possible slippery slope',reason:'The chain of predicted consequences needs support.',tip:'Provide evidence for each important causal step.'},
    {re:/\b(obviously|clearly|everyone knows|undeniably)\b/,name:'Unsupported certainty',reason:'A confident tone is not a substitute for evidence.',tip:'Cite an example, study, or concrete observation.'}
  ];
  const matches=rules.filter(r=>r.re.test(l)).map(({name,reason,tip})=>({name,reason,tip}));
  if (!matches.length) matches.push({name:'No clear fallacy flagged',reason:'The quick scan did not find a common wording pattern. That does not prove the reasoning is sound.',tip:'Check factual claims, assumptions, and counterexamples.'});
  const evidenceHints = /\b(study|data|research|according to|survey|report|source|percent|%)\b/i.test(s);
  return {flags:matches.slice(0,3),evidenceHint:evidenceHints?'Evidence was mentioned; verify the original source.':'Add a trustworthy source to strengthen factual claims.',note:'Heuristic feedback, not a factual or logical guarantee.'};
};

const demoRounds = (topic, mode='ai-ai', userArgument='') => {
  const t = safeTopic(topic) || 'Should AI replace human teachers?';
  const p = t.replace(/[?.!]+$/,'');
  const human = safeText(userArgument);
  const focus = /teach|school|educat|exam|student|college/i.test(t) ? 'learning outcomes, access and human relationships' : /ai|technolog|robot|automat/i.test(t) ? 'efficiency, accountability and human control' : /climate|environment|car-free/i.test(t) ? 'health, fairness and practical implementation' : /work|office|remote/i.test(t) ? 'productivity, wellbeing and flexibility' : 'practical impact, fairness and long-term consequences';
  const advocate = `The case for ${p.toLowerCase()} deserves a fair hearing. Supporters argue it could create meaningful benefits if designed carefully. We should weigh the potential gains against ${focus}, instead of dismissing the idea outright.`;
  const opponent = human ? `You make a point: “${human.slice(0,120)}${human.length>120?'…':''}” But what evidence would show that it works across different circumstances? A good policy should also protect people who might be left behind.` : `I challenge the assumption that promising results automatically justify a broad change. We must examine ${focus}, unintended effects, and who bears the costs before treating this as the right answer.`;
  const advocate2 = `That is a fair challenge. A carefully tested, limited approach could provide benefits while preserving safeguards. The stronger argument is not that every objection disappears, but that measured trials can tell us when the idea works.`;
  const opponent2 = `A pilot still needs transparent success criteria and independent review. If the evidence is weak or the risks are unevenly distributed, the court should resist a sweeping conclusion.`;
  const witness = `Speaking as an affected community member in this fictional scenario: both sides touch on real concerns. I would want clear choices, access for different people, and a way to raise problems before any major change becomes permanent.`;
  const verdict = `The court finds plausible arguments on both sides. There is not enough independently verified evidence in this demo to declare the proposal universally right or wrong. A limited, transparent trial—with measurable outcomes, safeguards, and regular review—is the most defensible next step.`;
  const openingEvents=[
      {role:'judge',tag:'OPENING STATEMENT',text:`The court is now in session. Today's question: ${t} Both sides will be heard. Claims will be examined, not merely applauded.`},
      {role:'advocate',tag:'THE CASE FOR',text:advocate},
      {role:'opponent',tag:'THE CASE AGAINST',text:opponent},
      {role:'advocate',tag:'REBUTTAL',text:advocate2},
      {role:'opponent',tag:'CROSS-EXAMINATION',text:opponent2},
      {role:'witness',tag:'SURPRISE WITNESS',text:witness},
      {role:'judge',tag:'THE VERDICT',text:verdict,verdict:true}
    ];
  const events=mode==='human-ai' ? [openingEvents[0],{role:'human',tag:'YOUR OPENING ARGUMENT',text:human||'I support the proposal.'},openingEvents[2],openingEvents[5],openingEvents[6]] : openingEvents;
  return {topic:t,source:'demo',focus,events,verdict:{decision:'Conditional / inconclusive',support:73,challenge:68,evidence:42,reason:verdict,caution:'Illustrative demo — no independent sources were verified.'}};
};
const extractJSON = raw => {const t = raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''); const a=t.indexOf('{'), b=t.lastIndexOf('}');if(a<0||b<a)throw new Error('Invalid AI response');return JSON.parse(t.slice(a,b+1));};
const gemini = async (instruction, text, timeout=19000) => {
  const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(),timeout);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_API_KEY},signal:controller.signal,
      body:JSON.stringify({systemInstruction:{parts:[{text:instruction}]},contents:[{role:'user',parts:[{text}]}],generationConfig:{temperature:0.65,responseMimeType:'application/json'}})
    });
    if(!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const result = await response.json();
    return extractJSON(result.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'');
  } finally { clearTimeout(timer); }
};
const chooseText = (v, fallback) => typeof v==='string'&&v.trim() ? safeText(v) : fallback;
const makeLiveDebate = async (topic, mode, userArgument) => {
  const skeleton=demoRounds(topic,mode,userArgument);
  const safety='You are a fictional debate agent. Avoid definitive assertions without evidence, label uncertain facts, and avoid invented citations. No HTML/Markdown. Output JSON only. Stay respectful and balanced. Limit text to 110 words.';
  try {
    // These two advocate calls run independently: neither receives the other's reasoning.
    const [forRes,againstRes] = await Promise.all([
      gemini(`${safety} You are the affirmative advocate. Argue the strongest defensible case FOR the proposal. Respond {"opening":"...","rebuttal":"..."}.`,topic),
      gemini(`${safety} You are the opposing advocate. Argue the strongest defensible case AGAINST the proposal. If a human argument is provided, address it. Respond {"opening":"...","rebuttal":"..."}.`,JSON.stringify({topic,userArgument}))
    ]);
    const e=skeleton.events;
    e[1].text=chooseText(forRes.opening,e[1].text);e[3].text=chooseText(forRes.rebuttal,e[3].text);
    e[2].text=chooseText(againstRes.opening,e[2].text);e[4].text=chooseText(againstRes.rebuttal,e[4].text);
    const judgeRes=await gemini(`${safety} You are an impartial judge. Independently compare two arguments, separate fact from speculation, identify one missing perspective, and write a cautious verdict. Do not call unverified statements proven facts. Respond {"witness":"first-person fictional witness perspective, explicitly illustrative","verdict":"...","decision":"Conditional / inconclusive or Supported with caveats or Not supported on available arguments","support":0,"challenge":0,"evidence":0}. Integers 0-100 are illustrative argument-quality indicators, NOT probabilities.`,JSON.stringify({topic,affirmative:[e[1].text,e[3].text],negative:[e[2].text,e[4].text]}));
    e[5].text=chooseText(judgeRes.witness,e[5].text);e[6].text=chooseText(judgeRes.verdict,e[6].text);
    return {...skeleton,source:'ai',events:e,verdict:{decision:chooseText(judgeRes.decision,'Conditional / inconclusive'),support:Math.min(100,Math.max(0,Number(judgeRes.support)||70)),challenge:Math.min(100,Math.max(0,Number(judgeRes.challenge)||70)),evidence:Math.min(100,Math.max(0,Number(judgeRes.evidence)||45)),reason:e[6].text,caution:'AI-generated reasoning; review sources and factual claims independently.'}};
  } catch(err) {return {...skeleton,source:'demo-fallback',notice:`Live AI was unavailable (${err.message}). Showing a guided demo instead.`};}
};

const makeLiveHumanDebate = async (topic, userArgument) => {
  const result=demoRounds(topic,'human-ai',userArgument);
  const e=result.events;
  try{
    const against=await gemini('You are a critical but respectful opposing advocate debating a real person. Challenge the exact human opening argument, ask a pointed question, avoid fabricated citations and state uncertainty. Output JSON {"response":"..."}, max 100 words.',JSON.stringify({topic,argument:userArgument}));
    e[2].text=chooseText(against.response,e[2].text);
    const judgment=await gemini('You are a fair courtroom judge. Consider the human position and the AI challenge. Generate one illustrative third-party witness perspective (clearly fictional) and a nuanced verdict; do not pretend unsupported claims were fact-checked. Output JSON {"witness":"...","verdict":"...","decision":"...","support":65,"challenge":65,"evidence":40}. Scores are illustrative quality meters, not fact-check confidence.',JSON.stringify({topic,human:userArgument,opponent:e[2].text}));
    e[3].text=chooseText(judgment.witness,e[3].text);
    e[4].text=chooseText(judgment.verdict,e[4].text);
    const bounded=v=>Math.min(100,Math.max(0,Number(v)||50));
    return {...result,source:'ai',events:e,verdict:{decision:chooseText(judgment.decision,'Conditional / inconclusive'),support:bounded(judgment.support),challenge:bounded(judgment.challenge),evidence:bounded(judgment.evidence),reason:e[4].text,caution:'AI reasoning is fallible. Check important factual claims independently.'}};
  } catch(err){return {...result,source:'demo-fallback',notice:`Live AI was unavailable (${err.message}). Showing a guided demo instead.`};}
};

export const api = async (req,res,url) => {
  const pathname=url.pathname;
  if (pathname==='/api/status'&&req.method==='GET') return send(res,200,{liveAI:!!GEMINI_API_KEY,sharedStorage:localServer,model: GEMINI_API_KEY?GEMINI_MODEL:null,version:'1.1'});
  if (!localServer && (pathname.startsWith('/api/rooms') || (pathname==='/api/gallery' && req.method!=='GET'))) return send(res,503,{error:'Shared rooms and gallery publishing are unavailable in this demo. A hosted database must be configured first.'});
  if (pathname==='/api/debate'&&req.method==='POST'){
    const b=await body(req), topic=safeTopic(b.topic);
    if(topic.length<8) return send(res,400,{error:'Enter a topic of at least 8 characters.'});
    const mode=['ai-ai','human-ai','human-human'].includes(b.mode)?b.mode:'ai-ai';
    return send(res,200, GEMINI_API_KEY ? (mode==='human-ai' ? await makeLiveHumanDebate(topic,b.argument) : await makeLiveDebate(topic,mode,b.argument)) : demoRounds(topic,mode,b.argument));
  }
  if(pathname==='/api/rebuttal'&&req.method==='POST'){
    const b=await body(req), topic=safeTopic(b.topic), argument=safeText(b.argument);
    if(topic.length<8||argument.length<4)return send(res,400,{error:'Enter a topic and a substantive argument.'});
    let response=`Your response raises an interesting point: “${argument.slice(0,115)}${argument.length>115?'…':''}” But how would you test that claim, and what would change your mind? A persuasive argument needs specific, verifiable evidence and consideration of exceptions.`;
    let source='demo';
    if(GEMINI_API_KEY)try{const a=await gemini('You are an opposing courtroom advocate. Critically but respectfully counter the user argument; use clear reasoning, no invented facts or citations. Respond JSON {"response":"..."}, max 90 words.',JSON.stringify({topic,argument}));response=chooseText(a.response,response);source='ai';}catch{}
    return send(res,200,{response,source});
  }
  if(pathname==='/api/verdict'&&req.method==='POST'){
    const b=await body(req), topic=safeTopic(b.topic), events=Array.isArray(b.events)?b.events.slice(0,30).map(e=>({role:clamp(e.role,20),text:safeText(e.text)})):[];
    if(topic.length<8)return send(res,400,{error:'Enter a valid topic.'});
    let verdict={decision:'Conditional / inconclusive',reason:'Both sides raise considerations worth testing. The most careful next step is to gather independently verified evidence, define clear standards and acknowledge unresolved uncertainties.',support:70,challenge:70,evidence:40,caution:'Demo reasoning; facts were not independently checked.'};
    if(GEMINI_API_KEY)try{const a=await gemini('You are an impartial judge. Compare the actual statements, including any human rebuttals. Do not invent fact checks. Write a cautious and fair verdict. Return JSON {"decision":"...","reason":"...","support":65,"challenge":65,"evidence":40}. Values are illustrative reasoning-quality meters, not probabilities. 90 words maximum.',JSON.stringify({topic,events}));verdict={decision:clamp(a.decision,90)||verdict.decision,reason:clamp(a.reason,1100)||verdict.reason,support:Math.min(100,Math.max(0,Number(a.support)||70)),challenge:Math.min(100,Math.max(0,Number(a.challenge)||70)),evidence:Math.min(100,Math.max(0,Number(a.evidence)||40)),caution:'AI reasoning may be mistaken; important claims need independent fact-checking.'};}catch{}
    return send(res,200,{verdict});
  }
  if(pathname==='/api/analyze'&&req.method==='POST'){
    const b=await body(req), input=safeText(b.text);
    if(!input) return send(res,400,{error:'Enter an argument to analyze.'});
    const simple=detectFallacy(input);
    if(GEMINI_API_KEY){try {const ai=await gemini('You are a careful reasoning coach. Provide possible fallacies, not definitive accusations, avoid fictitious facts. Output JSON {"flags":[{"name":"...","reason":"...","tip":"..."}],"evidenceHint":"...","note":"AI feedback is fallible; verify claims."}. Max 2 flags and 45 words each.',input);return send(res,200,{flags:Array.isArray(ai.flags)?ai.flags.slice(0,2).map(f=>({name:clamp(f.name,80),reason:clamp(f.reason,300),tip:clamp(f.tip,300)})):simple.flags,evidenceHint:clamp(ai.evidenceHint,220)||simple.evidenceHint,note:'AI feedback is fallible; verify claims.'});}catch{}}
    return send(res,200,simple);
  }
  if(pathname==='/api/gallery'&&req.method==='GET') return send(res,200,{items:gallery.slice(0,50)});
  if(pathname==='/api/gallery'&&req.method==='POST'){
    const b=await body(req), topic=safeTopic(b.topic), author=clamp(b.author||'Anonymous thinker',35);
    if(topic.length<8) return send(res,400,{error:'A public case needs a meaningful topic.'});
    const item={id:crypto.randomUUID(),topic,category:'Community',author,count:0,views:0,featured:false,createdAt:new Date().toISOString()};
    gallery.unshift(item);gallery=gallery.slice(0,100);saveJSON(galleryFile,gallery);return send(res,201,{item});
  }
  if(pathname==='/api/rooms'&&req.method==='POST'){
    const b=await body(req), topic=safeTopic(b.topic);
    if(topic.length<8)return send(res,400,{error:'Enter a topic first.'});
    const id=crypto.randomBytes(4).toString('hex').toUpperCase();
    const room={id,topic,createdAt:new Date().toISOString(),messages:[],verdict:null};
    rooms[id]=room;saveJSON(roomsFile,rooms);return send(res,201,{room});
  }
  const roomMatch=pathname.match(/^\/api\/rooms\/([A-F0-9]{8})(?:\/(messages|verdict))?$/);
  if(roomMatch){const id=roomMatch[1],action=roomMatch[2],room=rooms[id];
    if(!room)return send(res,404,{error:'Room not found. Double-check your invite code.'});
    if(!action&&req.method==='GET')return send(res,200,{room});
    if(action==='messages'&&req.method==='POST'){
      const b=await body(req), text=safeText(b.text), side=b.side==='against'?'against':'for', name=clamp(b.name||'Guest',35);
      if(text.length<3)return send(res,400,{error:'Please write a longer argument.'});
      if(room.messages.length>=100) return send(res,400,{error:'This courtroom has reached its message limit.'});
      const message={id:crypto.randomUUID(),text,side,name,createdAt:new Date().toISOString(),analysis:detectFallacy(text)};
      room.messages.push(message);saveJSON(roomsFile,rooms);return send(res,201,{message});
    }
    if(action==='verdict'&&req.method==='POST'){
      if(room.messages.length<2 || new Set(room.messages.map(m=>m.side)).size<2)return send(res,400,{error:'Both sides must submit at least one argument.'});
      const all=room.messages.slice(-12);
      let verdict={decision:'No definitive winner',reason:'Both sides presented arguments. An impartial outcome requires checking the actual evidence, not merely counting statements. Consider further fact-checking and counterexamples.',source:'demo'};
      if(GEMINI_API_KEY) try{const a=await gemini('You are an impartial debate moderator. Assess arguments respectfully, do not invent sources or declare factual certainty without evidence. Respond JSON {"decision":"...","reason":"..."}. Max 90 words.',JSON.stringify({topic:room.topic,arguments:all.map(m=>({side:m.side,text:m.text}))}));verdict={decision:clamp(a.decision,100),reason:clamp(a.reason,1100),source:'ai'};}catch{}
      room.verdict=verdict;saveJSON(roomsFile,rooms);return send(res,200,{verdict});
    }
  }
  return send(res,404,{error:'Not found'});
};

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json; charset=utf-8'};
const server = http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(url.pathname.startsWith('/api/')) return await api(req,res,url);
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Method not allowed'});
    const file=path.resolve(publicDir,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(publicDir+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return send(res,404,{error:'Page not found'});
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':file.endsWith('.html')?'no-store':'public, max-age=300'});
    if(req.method==='HEAD')return res.end();
    fs.createReadStream(file).pipe(res);
  } catch(err){console.error('[verdicta]',err.message);if(!res.headersSent)send(res,err.message==='Request too large'?413:500,{error:err.message==='Request too large'?'Request too large':'Something went wrong. Please try again.'});else res.end();}
});
if (localServer) server.listen(PORT,'0.0.0.0',()=>console.log(`Verdicta listening at http://localhost:${PORT} | ${GEMINI_API_KEY?'Gemini enabled':'Guided demo mode'}`));
