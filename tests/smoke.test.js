import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
const port=35000+Math.floor(Math.random()*5000);
const base=`http://127.0.0.1:${port}`;
const testData=mkdtempSync(path.join(tmpdir(),'verdicta-test-'));
const server=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),GEMINI_API_KEY:'',VERDICTA_DATA_DIR:testData},stdio:'ignore'});
async function request(path,value){const response=await fetch(base+path,{method:value===undefined?'GET':'POST',headers:{'content-type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});return {status:response.status,data:await response.json()};}
async function ready(){for(let i=0;i<40;i++){try{const r=await request('/api/status');if(r.status===200)return;}catch{}await pause(100);}throw Error('Server did not start');}
test('verdicta end-to-end API smoke test',async(t)=>{
  try{
    await ready();
    await t.test('serves HTML and static art',async()=>{const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(await page.text(),/Every idea deserves/);const js=await fetch(base+'/app.js');assert.equal(js.status,200);assert.match(await js.text(),/dossier-action/);const art=await fetch(base+'/courtroom.svg');assert.equal(art.status,200);assert.match(await art.text(),/<svg/);});
    await t.test('AI-vs-AI demo has two lawyers, witness and judge',async()=>{const r=await request('/api/debate',{topic:'Should artificial intelligence replace teachers?',mode:'ai-ai'});assert.equal(r.status,200);assert.equal(r.data.events.length,7);assert.deepEqual(r.data.events.map(x=>x.role),['judge','advocate','opponent','advocate','opponent','witness','judge']);assert.equal(r.data.source,'demo');});
    await t.test('Human-vs-AI displays actual human argument',async()=>{const statement='Teaching should preserve real human mentorship.';const r=await request('/api/debate',{topic:'Should AI replace teachers?',mode:'human-ai',argument:statement});assert.equal(r.status,200);assert.equal(r.data.events[1].role,'human');assert.equal(r.data.events[1].text,statement);const r2=await request('/api/rebuttal',{topic:'Should AI replace teachers?',argument:'AI can improve tutoring access.'});assert.equal(r2.status,200);assert.ok(r2.data.response.length>30);});
    await t.test('Reasoning lens returns flagged reasoning cautiously',async()=>{const r=await request('/api/analyze',{text:'Everyone is using AI so it must always be correct.'});assert.equal(r.status,200);assert.ok(r.data.flags.length);assert.match(r.data.flags[0].name,/bandwagon/i);});
    await t.test('Gallery returns published prompts',async()=>{const r=await request('/api/gallery');assert.equal(r.status,200);assert.ok(r.data.items.length>=6);});
    await t.test('Human-versus-human room accepts both sides and renders judge verdict',async()=>{const creation=await request('/api/rooms',{topic:'Should cities have fewer cars?'});assert.equal(creation.status,201);const id=creation.data.room.id;const first=await request(`/api/rooms/${id}/messages`,{name:'A',side:'for',text:'Reducing car traffic may improve air quality.'});assert.equal(first.status,201);const second=await request(`/api/rooms/${id}/messages`,{name:'B',side:'against',text:'People need viable transport alternatives first.'});assert.equal(second.status,201);const verdict=await request(`/api/rooms/${id}/verdict`,{});assert.equal(verdict.status,200);assert.ok(verdict.data.verdict.reason);const room=await request(`/api/rooms/${id}`);assert.equal(room.data.room.messages.length,2);});
    await t.test('Rejects short invalid topics',async()=>{const r=await request('/api/debate',{topic:'hmm',mode:'ai-ai'});assert.equal(r.status,400);});
  } finally {server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));rmSync(testData,{recursive:true,force:true});}
});
