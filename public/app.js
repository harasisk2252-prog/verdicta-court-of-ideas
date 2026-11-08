/* VERDICTA — A dependency-free interactive frontend. Server endpoints are optional for static demo previews. */
(() => {
  'use strict';
  const $ = (selector,root=document)=>root.querySelector(selector);
  const $$ = (selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const text = (selector,value)=>{const node=typeof selector==='string'?$(selector):selector; if(node)node.textContent=value;};
  const el=(tag,cls,content)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;};
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const getJSON=async(path,options={})=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);try{const response=await fetch(path,{...options,signal:controller.signal,headers:{'Content-Type':'application/json',...(options.headers||{})}});const json=await response.json();if(!response.ok)throw new Error(json.error||'Request failed');return json;}finally{clearTimeout(timer);}};
  const post=(path,payload)=>getJSON(path,{method:'POST',body:JSON.stringify(payload)});
  const safe=(v,limit=1200)=>String(v||'').trim().slice(0,limit);
  const today=new Date();
  const state={mode:'ai-ai',topic:'',trial:null,index:-1,voice:false,voices:[],loading:false,room:null,roomTimer:null,sharedStorage:false,juryVote:null,filter:'All',gallery:[],toastTimer:null};
  const sampleGallery=[
    {id:'sample-1',category:'Education',topic:'Should AI replace traditional classrooms?',author:'The Verdicta Court'},
    {id:'sample-2',category:'Society',topic:'Is a four-day workweek the future?',author:'The Verdicta Court'},
    {id:'sample-3',category:'Technology',topic:'Should social media require age verification?',author:'The Verdicta Court'},
    {id:'sample-4',category:'Environment',topic:'Can a city ever be truly car-free?',author:'The Verdicta Court'},
    {id:'sample-5',category:'Education',topic:'Should exams be replaced by project-based assessments?',author:'The Verdicta Court'},
    {id:'sample-6',category:'Work',topic:'Is remote work better for creativity?',author:'The Verdicta Court'}
  ];
  function toast(message){const n=$('#toast');n.textContent=message;n.classList.add('is-visible');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>n.classList.remove('is-visible'),4300);}
  function scrollToCourt(){const n=$('#court');n.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  function setMode(mode,{scroll=false}={}){
    if(!['ai-ai','human-ai','human-human'].includes(mode))return;
    state.mode=mode;$('#mode-select').value=mode;
    $$('.mode-card').forEach(n=>n.classList.toggle('is-selected',n.dataset.mode===mode));
    $('#human-input-wrap').hidden=mode!=='human-ai';$('#human-room-setup').hidden=mode!=='human-human';
    text('#mode-note',mode==='ai-ai'?'✦ Two AI advocates will test the proposal before a reasoned verdict.':mode==='human-ai'?'✦ Make your case, respond to counterarguments, and challenge your own reasoning.':'✦ Invite a friend to a private room. The judge will moderate both positions.');
    text('#start-debate',mode==='human-human'?'Create or join a room ↗':'Open this case ↗');
    if(scroll)scrollToCourt();
  }
  $$('.mode-card').forEach(n=>n.addEventListener('click',()=>setMode(n.dataset.mode,{scroll:true})));
  $('#mode-select').addEventListener('change',e=>setMode(e.target.value));
  $$('.topic-chip').forEach(n=>n.addEventListener('click',()=>{$('#topic-input').value=n.dataset.topic;toast('A new question is ready for the court.');}));
  $('#mobile-menu').addEventListener('click',()=>{const nav=$('.header-links');const open=!nav.classList.contains('is-open');nav.classList.toggle('is-open',open);$('#mobile-menu').setAttribute('aria-expanded',String(open));});
  $$('.header-links a').forEach(n=>n.addEventListener('click',()=>{$('.header-links').classList.remove('is-open');$('#mobile-menu').setAttribute('aria-expanded','false');}));
  async function loadStatus(){
    let status={liveAI:false,sharedStorage:false};
    try{status=await getJSON('/api/status');}catch{}
    state.sharedStorage=status.sharedStorage===true;
    text('#status-label',status.liveAI?'Live AI ready':'Demo court open');
    text('#deployment-note',(status.liveAI?'Live AI responses.':'Guided demo — scripted responses, not live AI.')+(state.sharedStorage?' Shared rooms are available.':' Shared rooms and gallery publishing are unavailable; the gallery contains sample questions.'));
    ['#create-room','#join-room','#share-case','#publish-topic'].forEach(id=>{$(id).disabled=!state.sharedStorage;});
  }

  function fallbackTrial(topic,argument='',mode='ai-ai'){
    const t=safe(topic,180);
    const e=[
      {role:'judge',tag:'OPENING STATEMENT',text:`The court is now in session. Today's question: ${t} The court invites both sides to think beyond certainty.`},
      {role:'advocate',tag:'THE CASE FOR',text:`Those supporting this proposal see potential benefits in giving people more options and testing new approaches. We should examine where this might help, and under which conditions.`},
      {role:'opponent',tag:'THE CASE AGAINST',text:argument?`You argued: “${safe(argument,130)}”. But what evidence supports that claim beyond individual experience? What risks or exceptions might change your conclusion?`:'An attractive idea can still have hidden costs. What happens to people who face the greatest risks, and how do we measure those trade-offs?'},
      {role:'advocate',tag:'REBUTTAL',text:'A cautious pilot could help distinguish potential benefits from exaggerated promises. Clear standards and independent testing matter more than slogans.'},
      {role:'opponent',tag:'CROSS-EXAMINATION',text:'A pilot also requires meaningful consent, transparent results and a willingness to stop if harms outweigh benefits.'},
      {role:'witness',tag:'SURPRISE WITNESS',text:'In this fictional witness perspective, I would ask both sides to consider the people affected most directly, including those whose voices are often overlooked.'},
      {role:'judge',tag:'THE VERDICT',text:'The question deserves careful testing, not a simplistic yes or no. The court advises evidence gathering, practical safeguards and an openness to changing course.',verdict:true}
    ];
    const events=mode==='human-ai' ? [e[0],{role:'human',tag:'YOUR OPENING ARGUMENT',text:argument||'I support the proposal.'},e[2],e[5],e[6]] : e;
    return {topic:t,source:'demo',events,verdict:{decision:'Conditional / inconclusive',support:70,challenge:70,evidence:38,reason:e[6].text,caution:'Guided demo only: claims have not been verified.'}};
  }
  function stopVoice(){if('speechSynthesis' in window)try{window.speechSynthesis.cancel();}catch{}}
  function voices(){if('speechSynthesis' in window)state.voices=window.speechSynthesis.getVoices().filter(v=>/en[-_]/i.test(v.lang));}
  if('speechSynthesis' in window){voices();window.speechSynthesis.onvoiceschanged=voices;}
  const voiceMap={judge:{index:2,pitch:.75,rate:.91},advocate:{index:0,pitch:1.06,rate:1.02},opponent:{index:1,pitch:.87,rate:.99},witness:{index:3,pitch:1.1,rate:.96},human:{index:0,pitch:1.0,rate:1.0}};
  function speak(event){stopVoice();if(!state.voice||!('speechSynthesis' in window))return;
    const o=voiceMap[event.role]||voiceMap.judge;
    const u=new SpeechSynthesisUtterance(event.text);u.rate=o.rate;u.pitch=o.pitch;u.volume=.95;
    if(state.voices.length)u.voice=state.voices[o.index%state.voices.length];
    u.onboundary=e=>{if(state.trial&&state.trial.events[state.index]===event && typeof e.charIndex==='number'){
      const i=e.charIndex;const begin=Math.max(0,i-45),end=Math.min(event.text.length,i+125);
      text('#stage-subtitle',(begin?'…':'“')+event.text.slice(begin,end)+(end<event.text.length?'…':'”'));
    }};
    u.onend=()=>{if(state.trial&&state.trial.events[state.index]===event)text('#stage-subtitle',`“${event.text}”`);};
    try{window.speechSynthesis.speak(u);}catch{toast('Voice playback is not supported by this browser.');}
  }
  $('#voice-toggle').addEventListener('click',()=>{if(!('speechSynthesis' in window)){toast('This browser does not support spoken dialogue.');return;}state.voice=!state.voice;$('#voice-toggle').setAttribute('aria-pressed',String(state.voice));text('#voice-label',state.voice?'Voice on':'Voice off');if(state.voice&&state.trial&&state.index>=0)speak(state.trial.events[state.index]);else stopVoice();toast(state.voice?'Courtroom voices enabled.':'Voices muted.');});

  async function openCase(){
    const topic=safe($('#topic-input').value,180);if(topic.length<8){toast('Give the court a question of at least eight characters.');$('#topic-input').focus();return;}
    state.topic=topic;
    if(state.mode==='human-human'){openRoomDialog();return;}
    if(state.mode==='human-ai'&&safe($('#human-argument').value).length<7){toast('Write your opening argument first.');$('#human-argument').focus();return;}
    if(state.loading)return;
    state.loading=true;const submit=$('#start-debate');submit.disabled=true;text(submit,'The court is assembling…');
    let trial;
    try{trial=await post('/api/debate',{topic,mode:state.mode,argument:$('#human-argument').value});if(trial.notice)toast(trial.notice);else if(trial.source==='ai')toast('Your AI courtroom is in session.');}
    catch{trial=fallbackTrial(topic,$('#human-argument').value,state.mode);toast('Live responses are unavailable. Showing the guided demo.');}
    state.trial=trial;state.index=-1;state.juryVote=null;state.loading=false;submit.disabled=false;text(submit,'Open another case ↗');
    $('#jury-ballot').hidden=false;$$('.jury-votes button').forEach(b=>{b.classList.remove('is-selected');b.setAttribute('aria-pressed','false');});text('#jury-feedback','The jury is listening. Make your choice at any point during the case.');
    $('#dossier-action').disabled=false;$('#objection-action').disabled=false;
    $('#verdict-panel').hidden=true;$('#replay-card').hidden=true;$('#rebuttal-card').hidden=true;
    $('#transcript-feed').replaceChildren();$('#trial-stage').classList.remove('has-witness');
    text('#case-number','NO. '+String(Math.floor(Math.random()*899)+101));
    text('#evidence-summary',`The court is examining: ${trial.topic}`);text('#court-state-label','HEARING IN PROGRESS');
    $('#next-scene').disabled=false;$('#witness-action').disabled=false;$('#verdict-action').disabled=true;$('#replay-action').disabled=true;
    showScene(0);$('#trial-stage').scrollIntoView({behavior:'smooth',block:'center'});
  }
  $('#start-debate').addEventListener('click',openCase);
  const roleLabel={judge:'THE JUDGE',advocate:'THE ADVOCATE',opponent:'THE OPPONENT',witness:'THE WITNESS',human:'YOUR ARGUMENT'};
  const actionStatus={judge:'The bench is speaking',advocate:'The affirmative takes the floor',opponent:'The opposition responds',witness:'A new perspective enters',human:'Your statement is heard'};
  function showScene(i){
    if(!state.trial||i<0||i>=state.trial.events.length)return;
    state.index=i;const event=state.trial.events[i];const last=i===state.trial.events.length-1;
    $('#trial-stage').dataset.speaker=event.role;
    $('#trial-stage').classList.toggle('has-witness',state.trial.events.slice(0,i+1).some(e=>e.role==='witness'));
    text('#speaking-badge','◉ '+roleLabel[event.role]+' · '+event.tag);
    text('.advocate-character .character-label',state.mode==='human-ai'?'YOU / THE CHALLENGER':'THE ADVOCATE');
    text('#stage-pill',event.verdict?'◆ VERDICT RENDERED':'● LIVE TESTIMONY');
    text('#stage-subtitle',`“${event.text}”`);
    text('#scene-progress',`${String(i+1).padStart(2,'0')} / ${String(state.trial.events.length).padStart(2,'0')} — ${event.tag.toLowerCase()}`);
    text('#court-state-label',last?'VERDICT ISSUED':'HEARING IN PROGRESS');
    $('#scene-rail span').style.width=String((i+1)/state.trial.events.length*100)+'%';
    $('#next-scene').disabled=last;$('#witness-action').disabled=last||i<2||event.role==='witness'||i>=state.trial.events.findIndex(e=>e.role==='witness');$('#verdict-action').disabled=last||i<2;$('#replay-action').disabled=i<1;
    text('#next-scene',last?'Hearing complete ✓':'Next testimony →');
    $('#rebuttal-card').hidden=state.mode!=='human-ai'||last||i<2||i>=state.trial.events.findIndex(e=>e.role==='witness');
    renderTranscript(i);speak(event);
    if(last)renderVerdict();else $('#verdict-panel').hidden=true;
  }
  function renderTranscript(index){
    const feed=$('#transcript-feed');feed.replaceChildren();
    state.trial.events.slice(0,index+1).forEach((e,i)=>{
      const card=el('article','transcript-card'+(i===index?' is-current':''));card.dataset.role=e.role;
      const heading=el('div','transcript-label');heading.append(el('span','',roleLabel[e.role]),el('span','',String(i+1).padStart(2,'0')));
      const paragraph=el('p','',e.text);const btn=el('button','','Examine reasoning ↗');btn.type='button';btn.addEventListener('click',()=>openAnalysis(e.text));
      card.append(heading,paragraph);if(e.role!=='judge')card.append(btn);feed.append(card);
    });
    text('#testimony-count',String(index+1).padStart(2,'0'));feed.scrollTop=feed.scrollHeight;
  }
  $('#next-scene').addEventListener('click',()=>{if(state.trial)showScene(state.index+1);});
  $('#witness-action').addEventListener('click',()=>{if(!state.trial)return;const idx=state.trial.events.findIndex((e,i)=>e.role==='witness'&&i>state.index);if(idx>=0){showScene(idx);toast('The court calls an unexpected witness.');}});
  async function deliverVerdict(){if(!state.trial||state.index<2||state.loading)return;
    state.loading=true;$('#verdict-action').disabled=true;
    const existing=state.trial.verdict;
    if(state.mode==='human-ai'&&state.trial.events.some(e=>e.role==='human')){
      try{const data=await post('/api/verdict',{topic:state.trial.topic,events:state.trial.events.filter(e=>!e.verdict).map(e=>({role:e.role,text:e.text}))});state.trial.verdict=data.verdict;}
      catch{state.trial.verdict={...existing,decision:'Conditional / inconclusive',reason:'The court has heard your rebuttals. A definitive conclusion would require verifying the evidence presented by both sides.'};}
    }
    const last=state.trial.events.length-1;state.trial.events[last].text=state.trial.verdict.reason;state.loading=false;showScene(last);
  }
  $('#verdict-action').addEventListener('click',deliverVerdict);
  function renderVerdict(){const v=state.trial?.verdict;if(!v)return;
    $('#verdict-panel').hidden=false;updateJuryFeedback();text('#verdict-heading',v.decision||'A nuanced verdict');text('#verdict-reason',v.reason);text('#verdict-caution',(v.caution||'Review important factual claims independently.')+' Meters are illustrative argument assessments, not confidence probabilities.');
    const scores=[['Affirmative case',v.support],['Opposing case',v.challenge],['Evidence depth',v.evidence]],root=$('#verdict-score');root.replaceChildren();
    scores.forEach(([label,val])=>{const bar=el('div','score');const head=el('div','score-label'),num=Number.isFinite(Number(val))?Math.min(100,Math.max(0,Number(val))):0;head.append(el('span','',label),el('span','',String(Math.round(num))+'/100'));const track=el('div','score-bar'),fill=el('span');fill.style.width=num+'%';track.append(fill);bar.append(head,track);root.append(bar);});
    $('#verdict-panel').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  $('#replay-action').addEventListener('click',()=>{if(!state.trial)return;const area=$('#replay-card');area.hidden=!area.hidden;if(!area.hidden){$('#replay-slider').max=state.trial.events.length-1;$('#replay-slider').value=state.index;refreshReplay();}});
  function refreshReplay(){text('#replay-time',String(state.index+1).padStart(2,'0')+' / '+String(state.trial.events.length).padStart(2,'0'));$('#replay-slider').value=state.index;}
  $('#replay-slider').addEventListener('input',e=>{showScene(Number(e.target.value));refreshReplay();});
  $('#replay-prev').addEventListener('click',()=>{showScene(Math.max(0,state.index-1));refreshReplay();});
  $('#replay-next').addEventListener('click',()=>{showScene(Math.min(state.trial.events.length-1,state.index+1));refreshReplay();});
  $('#reset-case').addEventListener('click',()=>{stopVoice();state.trial=null;state.index=-1;state.juryVote=null;$('#jury-ballot').hidden=true;$('#objection-action').disabled=true;$('#dossier-action').disabled=true;$('#verdict-panel').hidden=true;$('#replay-card').hidden=true;$('#rebuttal-card').hidden=true;$('#trial-stage').dataset.speaker='none';$('#trial-stage').classList.remove('has-witness');text('#stage-pill','● COURT READY');text('#speaking-badge','◉ THE COURT AWAITS A CASE');text('#stage-subtitle','“Justice begins when we hear the other side.”');text('#scene-progress','Awaiting opening statement');text('#court-state-label','AWAITING TESTIMONY');$('#scene-rail span').style.width='0%';$('#transcript-feed').replaceChildren();text('#testimony-count','00');text('#evidence-summary','A good case has two sides. Open a trial to hear them both.');$('#next-scene').disabled=$('#witness-action').disabled=$('#verdict-action').disabled=$('#replay-action').disabled=true;text('#start-debate','Open this case ↗');scrollToCourt();});
  $('#submit-rebuttal').addEventListener('click',async()=>{
    const arg=safe($('#rebuttal-text').value);if(arg.length<5){toast('Give the opposing lawyer something substantial to respond to.');return;}
    if(!state.trial)return;const btn=$('#submit-rebuttal');btn.disabled=true;text(btn,'Considering your argument…');
    let aiResponse;try{const data=await post('/api/rebuttal',{topic:state.trial.topic,argument:arg});aiResponse=data.response;}catch{aiResponse=`You raise a point, but what evidence could verify it? Which counterexample would make you reconsider your position?`}
    const insert=state.index+1;
    state.trial.events.splice(insert,0,{role:'human',tag:'YOUR REBUTTAL',text:arg},{role:'opponent',tag:'AI COUNTERARGUMENT',text:aiResponse});
    $('#replay-slider').max=state.trial.events.length-1;$('#rebuttal-text').value='';btn.disabled=false;text(btn,'Present rebuttal ↗');showScene(insert);toast('Your rebuttal has entered the record.');
  });

  // Extra jury experience: this is one person's private vote, not a simulated crowd poll.
  function updateJuryFeedback(){
    if(!state.trial)return;
    const labels={for:'support the motion',against:'oppose the motion',undecided:'remain undecided'};
    if(!state.juryVote){text('#jury-feedback','Your personal ballot is optional. No votes are collected from other users.');return;}
    const verdictShown=!$('#verdict-panel').hidden;
    text('#jury-feedback',verdictShown?`You chose to ${labels[state.juryVote]}. The AI judge concluded: ${state.trial.verdict?.decision||'No verdict yet'}. Different perspectives can coexist.`:`Your private ballot: you ${labels[state.juryVote]}. The judge has not announced a verdict yet.`);
  }
  $$('.jury-votes button').forEach(button=>button.addEventListener('click',()=>{
    if(!state.trial)return;
    state.juryVote=button.dataset.vote;
    $$('.jury-votes button').forEach(b=>{const active=b===button;b.classList.toggle('is-selected',active);b.setAttribute('aria-pressed',String(active));});
    updateJuryFeedback();
  }));

  // A cinematic objection examines a recorded argument; it never claims a court-verified error.
  $('#objection-action').addEventListener('click',()=>{
    if(!state.trial||state.index<0)return;
    const candidate=state.trial.events.slice(0,state.index+1).reverse().find(e=>e.role!=='judge'&&e.role!=='witness');
    if(!candidate){toast('Wait until a lawyer has presented an argument to object.');return;}
    const stage=$('#trial-stage');stage.classList.remove('objection-flash');void stage.offsetWidth;stage.classList.add('objection-flash');
    setTimeout(()=>stage.classList.remove('objection-flash'),1400);
    openAnalysis(candidate.text);toast('Objection noted. Examine the latest argument for possible weaknesses.');
  });

  // Download a self-contained transcript locally. No personal data is uploaded to export it.
  $('#dossier-action').addEventListener('click',()=>{
    const trial=state.trial;if(!trial){toast('Open a case first.');return;}
    const lines=['VERDICTA — CASE DOSSIER','THE COURT OF IDEAS','',`Case: ${trial.topic}`,`Saved: ${new Date().toLocaleString()}`,`Source: ${trial.source==='ai'?'Live AI-generated responses':'Guided demo / locally simulated'}`,`Mode: ${state.mode}`,'','TESTIMONY'];
    trial.events.forEach((ev,i)=>{lines.push('',`${i+1}. ${roleLabel[ev.role]||ev.role} — ${ev.tag}`,ev.text);});
    if(trial.verdict){lines.push('',"JUDGE\'S REPORT",trial.verdict.decision||'Undetermined',trial.verdict.reason||'');}
    if(state.juryVote)lines.push('','YOUR PRIVATE JURY BALLOT',state.juryVote);
    lines.push('','Important: AI-generated statements and the court verdict are not independently verified facts.');
    const file=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download='Verdicta_Case_'+new Date().toISOString().slice(0,10)+'.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
    toast('Your case dossier has been saved.');
  });

  // Debate reasoning coach: actual LLM when configured, transparent heuristic fallback otherwise.
  function openAnalysis(value=''){$('#analysis-text').value=value||$('#human-argument').value||'';$('#analysis-results').replaceChildren();$('#analysis-dialog').hidden=false;$('#analysis-text').focus();}
  $('#analyze-own').addEventListener('click',()=>openAnalysis($('#human-argument').value));
  function closeDialog(selector){$(selector).hidden=true;if(selector==='#room-dialog')clearInterval(state.roomTimer);}
  $('#analysis-close').addEventListener('click',()=>closeDialog('#analysis-dialog'));
  $('#run-analysis').addEventListener('click',async()=>{
    const s=safe($('#analysis-text').value);if(s.length<4){toast('Enter a complete argument first.');return;}
    const button=$('#run-analysis');button.disabled=true;text(button,'Examining reasoning…');
    let result;try{result=await post('/api/analyze',{text:s});}catch{result={flags:[{name:'Possible unsupported claim',reason:'A claim needs supporting evidence, not just confidence.',tip:'What source or observable example would strengthen this argument?'}],evidenceHint:'Check original sources and possible exceptions.',note:'Offline illustrative feedback.'};}
    const root=$('#analysis-results');root.replaceChildren();result.flags.forEach(flag=>{const b=el('div','analysis-result');b.append(el('strong','',flag.name),el('p','',flag.reason),el('small','',flag.tip));root.append(b);});const last=el('div','analysis-result');last.append(el('p','',result.evidenceHint),el('small','',result.note));root.append(last);
    button.disabled=false;text(button,'Analyze my argument ✳');
  });

  // Public cases, including publishing new question prompts (not user verification).
  async function loadGallery(){try{const result=await getJSON('/api/gallery');state.gallery=result.items;}catch{state.gallery=sampleGallery;}renderGallery();}
  function renderGallery(){const root=$('#gallery-grid');root.replaceChildren();const items=state.filter==='All'?state.gallery:state.gallery.filter(item=>item.category===state.filter);
    text('#gallery-count',String(items.length).padStart(2,'0')+' CASES IN THE ARCHIVE');
    if(!items.length){root.append(el('p','gallery-empty','No cases in this category yet. Why not start the conversation?'));return;}
    items.forEach((item,i)=>{
      const card=el('article','gallery-card');const head=el('div','gallery-card-top');head.append(el('span','gallery-tag',(item.category||'Community').toUpperCase()),el('span','gallery-id','#'+String(i+1).padStart(3,'0')));
      const title=el('h3','',item.topic);const foot=el('div','gallery-card-footer');foot.append(el('span','gallery-author','BY '+(item.author||'Anonymous thinker')),el('span','gallery-open','↗'));
      const actions=el('div','gallery-actions');
      const hear=el('button','','Hear case ↗'),challenge=el('button','','Challenge ↗'),invite=el('button','','Invite friend ↗');
      [hear,challenge,invite].forEach(n=>n.type='button');
      function selectCase(mode){$('#topic-input').value=item.topic;setMode(mode);scrollToCourt();toast(mode==='human-ai'?'Your challenge awaits an opening argument.':mode==='human-human'?'Ready to invite a friend into the courtroom.':'Case selected. Open it to begin the hearing.');}
      hear.addEventListener('click',()=>selectCase('ai-ai'));challenge.addEventListener('click',()=>selectCase('human-ai'));invite.addEventListener('click',()=>{selectCase('human-human');openRoomDialog();});
      actions.append(hear,challenge,invite);card.append(head,title,foot,actions);root.append(card);
    });
  }
  $$('.filter').forEach(n=>n.addEventListener('click',()=>{state.filter=n.dataset.filter;$$('.filter').forEach(b=>b.classList.toggle('is-active',b===n));renderGallery();}));
  async function publishTopic(){if(!state.sharedStorage){toast('Gallery publishing is unavailable in this demo.');return;}const topic=safe(state.trial?.topic||$('#topic-input').value,180);if(topic.length<8){toast('Add a topic to publish first.');return;}
    const author=prompt('Display name for the public gallery (optional):','Curious thinker');if(author===null)return;
    try{await post('/api/gallery',{topic,author:safe(author,35)||'Anonymous thinker'});toast('The question is now in the public gallery.');await loadGallery();}
    catch{toast('Publishing failed. Your question was not saved.');}
    $('#gallery').scrollIntoView({behavior:'smooth'});
  }
  $('#share-case').addEventListener('click',publishTopic);$('#publish-topic').addEventListener('click',publishTopic);

  // Human vs Human: invite by room code, poll JSON endpoint for near-live transcript.
  function openRoomDialog(){state.topic=safe($('#topic-input').value,180);$('#room-dialog').hidden=false;$('#room-create-area').hidden=false;$('#room-live-area').hidden=true;text('#room-description',state.sharedStorage?'Create a private debate room and invite a friend to defend the other side. The room link opens the same shared hearing.':'Shared multiplayer rooms are unavailable in this demo. A hosted database must be connected first.');}
  $('#room-close').addEventListener('click',()=>closeDialog('#room-dialog'));
  function roomLink(room){const url=new URL(window.location.href);url.hash='room='+room.id;return url.toString();}
  function roomSide(){return $('#room-message-side').value;}
  async function enterRoom(code){if(!state.sharedStorage){openRoomDialog();toast('Shared rooms are unavailable in this demo.');return;}const id=safe(code,8).toUpperCase();if(!/^[A-F0-9]{8}$/.test(id)){toast('Please enter a valid 8-character room code.');return;}
    try{const {room}=await getJSON('/api/rooms/'+id);state.room=room;$('#room-dialog').hidden=false;$('#room-create-area').hidden=true;$('#room-live-area').hidden=false;$('#room-link').value=roomLink(room);$('#room-message-side').value=$('#room-side').value;text('#room-description',room.topic);renderRoom();clearInterval(state.roomTimer);state.roomTimer=setInterval(pollRoom,3000);window.history.replaceState(null,'','#room='+id);toast('You are now in the courtroom.');}
    catch(error){toast(error.message||'Could not join this room. Start the Node server first.');}
  }
  $('#create-room').addEventListener('click',async()=>{
    const topic=safe($('#topic-input').value,180);if(topic.length<8){toast('Add a case topic before creating a room.');return;}
    const button=$('#create-room');button.disabled=true;text(button,'Preparing chamber…');
    try{const data=await post('/api/rooms',{topic});await enterRoom(data.room.id);}catch(error){toast(error.message||'Run the Node server to create rooms.');}finally{button.disabled=false;text(button,'Create a private room ↗');}
  });
  $('#join-room').addEventListener('click',()=>enterRoom($('#room-code-input').value));
  $('#room-code-input').addEventListener('keydown',e=>{if(e.key==='Enter')enterRoom(e.target.value);});
  $('#copy-room').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#room-link').value);toast('Invite link copied.');}catch{$('#room-link').select();toast('Select and copy the invite link.');}});
  async function pollRoom(){if(!state.room||$('#room-dialog').hidden)return;try{const {room}=await getJSON('/api/rooms/'+state.room.id);if(room.messages.length!==state.room.messages.length||JSON.stringify(room.verdict)!==JSON.stringify(state.room.verdict)){state.room=room;renderRoom();}else state.room=room;}catch{}}
  function renderRoom(){const room=state.room;if(!room)return;const feed=$('#room-feed');feed.replaceChildren();if(!room.messages.length)feed.append(el('p','room-empty','The room is ready. Share the link and submit the first argument.'));
    room.messages.forEach(m=>{const item=el('div','room-entry');const side=el('strong',m.side==='against'?'against':'for',`${m.name} · ${m.side==='for'?'FOR':'AGAINST'}`);item.append(side,el('p','',m.text),el('small','',new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})));feed.append(item);});
    feed.scrollTop=feed.scrollHeight;
    $('#room-verdict-button').disabled=room.messages.length<2||new Set(room.messages.map(m=>m.side)).size<2;
    const output=$('#room-verdict-output');output.replaceChildren();if(room.verdict){const b=el('div','room-verdict');b.append(el('strong','',room.verdict.decision),el('p','',room.verdict.reason));output.append(b);}
  }
  $('#send-room').addEventListener('click',async()=>{
    if(!state.room)return;const input=$('#room-message'),argument=safe(input.value),name=safe($('#screen-name').value,35)||'Guest thinker';
    if(argument.length<3){toast('Write your argument before submitting.');return;}
    const btn=$('#send-room');btn.disabled=true;
    try{await post('/api/rooms/'+state.room.id+'/messages',{text:argument,side:roomSide(),name});input.value='';await pollRoom();toast('Your argument is on the record.');}
    catch(err){toast(err.message||'Could not submit argument.');}finally{btn.disabled=false;}
  });
  $('#room-verdict-button').addEventListener('click',async()=>{if(!state.room)return;const btn=$('#room-verdict-button');btn.disabled=true;text(btn,'The judge is deliberating…');try{await post('/api/rooms/'+state.room.id+'/verdict',{});await pollRoom();toast('The moderator has delivered a verdict.');}catch(e){toast(e.message||'Verdict unavailable.');}finally{text(btn,'Ask the judge for a verdict ⚖');btn.disabled=false;}});

  $$('.dialog-backdrop').forEach(backdrop=>backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeDialog('#'+backdrop.id);}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$$('.dialog-backdrop').forEach(n=>n.hidden=true);clearInterval(state.roomTimer);stopVoice();}});
  const observer='IntersectionObserver' in window?new IntersectionObserver(items=>{items.forEach(item=>{if(item.isIntersecting){item.target.classList.add('is-visible');observer.unobserve(item.target);}})},{threshold:.12}):null;
  $$('.manifesto h2,.manifesto-side,.principles>div,.mode-card,.feature-card,.gallery-heading,.closing-section h2').forEach(n=>{if(observer){n.classList.add('reveal');observer.observe(n);}});
  async function boot(){await Promise.all([loadStatus(),loadGallery()]);const match=location.hash.match(/^#room=([A-Fa-f0-9]{8})$/);if(match){setMode('human-human');await enterRoom(match[1]);} }
  boot();
})();
