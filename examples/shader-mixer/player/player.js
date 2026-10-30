'use strict';
const $ = id => document.getElementById(id);
const canvas = $('screen');
const gl = canvas.getContext('webgl', {alpha:false, antialias:false, preserveDrawingBuffer:true});
const state = {source:'demo', envelope:0, blackout:false, frames:0, noise:false, noiseTime:0, format:'dome', targetFps:60, actualFps:0};
const decks = [{preset:0,speed:.4,zoom:1,reaction:.55,freeze:false,time:0,projection:0,fov:150,video:null,videoUrl:null,videoTexture:null},
               {preset:Math.min(2,SHADER_LIBRARY.length-1),speed:.4,zoom:1,reaction:.55,freeze:false,time:0,projection:0,fov:150,video:null,videoUrl:null,videoTexture:null}];
let context, analyser, stream, fileNode, micNode, audioUrl, recordingDestination, previous=0, programs=[], targets=[], previousTargets=[];
const vs = 'attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
const mixSource = `precision highp float;
varying vec2 uv;
uniform sampler2D a;
uniform sampler2D b;
uniform float amount;
uniform int mode;
uniform bool noiseEnabled;
uniform bool uRect;
uniform bool blackout;
uniform float noiseTime;
uniform float noiseGrain;
uniform float noiseWarp;
uniform float noiseScale;
uniform float noiseAudio;
uniform float energy;
vec3 overlay(vec3 base,vec3 blend){return mix(2.*base*blend,1.-2.*(1.-base)*(1.-blend),step(.5,base));}
vec3 softLight(vec3 base,vec3 blend){
 vec3 d=mix(((16.*base-12.)*base+4.)*base,sqrt(base),step(.25,base));
 return mix(base-(1.-2.*blend)*base*(1.-base),base+(2.*blend-1.)*(d-base),step(.5,blend));
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float field(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
void main(){
 if(blackout){gl_FragColor=vec4(0.,0.,0.,1.);return;}
 vec2 sampleUV=uv;
 float modulation=1.+noiseAudio*energy*3.;
 if(noiseEnabled){
  vec2 p=uv*noiseScale+vec2(noiseTime*.35,-noiseTime*.23);
  vec2 displacement=vec2(field(p),field(p+vec2(17.3,42.1)))-.5;
  sampleUV=clamp(uv+displacement*noiseWarp*.12*modulation,0.,1.);
 }
 vec3 x=texture2D(a,sampleUV).rgb,y=texture2D(b,sampleUV).rgb,c=y;
 if(mode==1)c=min(x+y,1.);
 else if(mode==2)c=1.-(1.-x)*(1.-y);
 else if(mode==3)c=abs(x-y);
 else if(mode==4)c=x*y;
 else if(mode==5)c=overlay(x,y);
 else if(mode==6)c=softLight(x,y);
 else if(mode==7)c=overlay(y,x);
 else if(mode==8)c=min(x,y);
 else if(mode==9)c=max(x,y);
 else if(mode==10)c=x+y-2.*x*y;
 else if(mode==11)c=min(x/max(vec3(.001),1.-y),1.);
 else if(mode==12)c=1.-min((1.-x)/max(vec3(.001),y),1.);
 // All modes isolate A/B at the endpoints; the chosen blend peaks at center.
 vec3 base=mix(x,y,amount);
 c=mode==0?base:mix(base,c,4.*amount*(1.-amount));
 if(noiseEnabled){
  float grain=hash(floor(gl_FragCoord.xy/max(1.,32./noiseScale))+floor(noiseTime*30.))-0.5;
  c+=grain*noiseGrain*modulation*.5;
  if(!uRect)c*=1.-smoothstep(.985,1.,length(uv*2.-1.));
 }
 gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;
function compile(source,type){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(message);}return s;}
function program(source){const p=gl.createProgram();const v=compile(vs,gl.VERTEX_SHADER),f=compile(source,gl.FRAGMENT_SHADER);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
function uniform(p,name,...v){const loc=gl.getUniformLocation(p,name);if(loc!==null)(v.length===2?gl.uniform2f(loc,...v):gl.uniform1f(loc,v[0]));}
function use(p){gl.useProgram(p);const pos=gl.getAttribLocation(p,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);}
function target(width=canvas.width,height=canvas.height){const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('GPU render target unavailable');return {texture,framebuffer};}
function shaderFor(index){
 if(!programs[index])programs[index]=program(SHADER_LIBRARY[index].source);
 return programs[index];
}
function report(message){$('status').textContent=message;}
const videoSource=`precision highp float; uniform sampler2D clip; uniform float aspect; uniform vec2 resolution;
uniform bool uRect; uniform float uZoom; uniform float uBrightness; uniform float uEnergy; uniform float uReaction;
${DOME_PROJECTION}
void main(){vec2 p=(2.*gl_FragCoord.xy-resolution)/min(resolution.x,resolution.y);float r=length(p);
if(!uRect&&r>=1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}
float zoom=max(.1,uZoom*(uGrid?1.:(1.+uEnergy*uReaction*.25)));
vec2 uv=sourceUV(gl_FragCoord.xy,resolution,uRect,zoom);
if(uRect){float ratio=aspect/(resolution.x/resolution.y);if(ratio>1.)uv.x=(uv.x-.5)/ratio+.5;else uv.y=(uv.y-.5)*ratio+.5;}
if(!validUV(uv)){gl_FragColor=vec4(0.,0.,0.,1.);return;}
vec3 c=(uGrid?calibrationGrid(uv):texture2D(clip,uv).rgb)*uBrightness*(uGrid?1.:(1.+uEnergy*uReaction*.7));
if(!uRect)c*=1.-smoothstep(.985,1.,r);gl_FragColor=vec4(clamp(c,0.,1.),1.);}`;
for(let i=0;i<2;i++){
 const element=document.createElement('section');element.className='deck'+(i?' b':'');
 element.innerHTML=`<h2>Deck ${i?'B':'A'}</h2><input class="shader-search" type="search" placeholder="Search shaders…" aria-label="Search deck ${i?'B':'A'} shaders"><select aria-label="Deck ${i?'B':'A'} source"></select><label>Source projection</label><select class="projection"><option value="0">Flat / perspective plane</option><option value="1">360° equirectangular (2:1)</option><option value="2">Already 180° fisheye</option></select><label>Perspective horizontal FOV <output class="fov-value">150°</output></label><input class="source-fov" type="range" min="30" max="175" step="1" value="150"><div class="buttons" style="margin-top:10px"><label class="file">Load video<input type="file" accept="video/*" hidden></label></div><video controls muted loop playsinline hidden style="width:100%;max-height:140px;margin-top:10px"></video><p class="clip-name" style="font-size:11px;color:#91a2ba"></p>${[['speed','Speed',0,3,.01],['zoom','Zoom',.3,3,.01],['reaction','Audio reaction',0,1,.01]].map(([key,label,min,max,step])=>`<label>${label}<output>${decks[i][key].toFixed(2)}</output></label><input type="range" aria-label="Deck ${i?'B':'A'} ${label}" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${decks[i][key]}">`).join('')}<button aria-pressed="false">Freeze deck ${i?'B':'A'}</button>`;
 element.querySelector('.projection').onchange=e=>decks[i].projection=+e.target.value;
 element.querySelector('.source-fov').oninput=e=>{decks[i].fov=+e.target.value;element.querySelector('.fov-value').value=e.target.value+'°';};
 const select=element.querySelector('select');
 const videoOption=new Option('Uploaded video', '-1');videoOption.disabled=true;select.add(videoOption);
 for(const group of ['Original','Magic pack']){
  const options=document.createElement('optgroup');options.label=group;
  SHADER_LIBRARY.forEach((entry,j)=>{if(entry.group===group)options.append(new Option(entry.name,String(j)));});select.append(options);
 }
 select.value=String(decks[i].preset);
 element.querySelector('input[type=file]').setAttribute('aria-label','Load video deck '+(i?'B':'A'));
 element.querySelector('.shader-search').oninput=e=>{
  const term=e.target.value.toLowerCase();select.querySelectorAll('option').forEach(option=>option.hidden=!option.text.toLowerCase().includes(term));
 };
 select.onchange=e=>{const index=+e.target.value;try{
  if(index>=0)shaderFor(index);
  if(decks[i].video){if(index<0&&!decks[i].freeze)decks[i].video.play().catch(err=>report(err.message));else decks[i].video.pause();}
  decks[i].preset=index;
  report('Deck '+(i?'B':'A')+': '+(index<0?'uploaded video':SHADER_LIBRARY[index].name));
 }catch(err){select.value=String(decks[i].preset);report('Cannot use '+SHADER_LIBRARY[index].name+': '+err.message);}};
 const video=element.querySelector('video');decks[i].video=video;
 video.onerror=()=>report('This video cannot be decoded by your browser. Try H.264 MP4 or WebM.');
 element.querySelector('input[type=file]').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{video.pause();if(decks[i].videoUrl)URL.revokeObjectURL(decks[i].videoUrl);
   decks[i].videoUrl=URL.createObjectURL(file);video.src=decks[i].videoUrl;video.hidden=false;video.muted=true;
   video.playbackRate=Math.max(.25,decks[i].speed/.4);await video.play();
   decks[i].preset=-1;decks[i].freeze=false;videoOption.disabled=false;select.value='-1';
   element.querySelector('button').setAttribute('aria-pressed','false');
   element.querySelector('.clip-name').textContent=file.name+' · looping · muted';
   report('Video loaded on deck '+(i?'B':'A')+'. Crossfade to mix it with the other deck.');
  }catch(err){report('Video playback failed: '+err.message);}
 };
 element.querySelectorAll('input[data-key]').forEach(input=>input.oninput=()=>{
  decks[i][input.dataset.key]=+input.value;input.previousElementSibling.querySelector('output').value=(+input.value).toFixed(2);
  if(input.dataset.key==='speed'&&video.src){video.playbackRate=Math.max(.25,+input.value/.4);if(+input.value===0)video.pause();else if(decks[i].preset<0&&!decks[i].freeze)video.play().catch(err=>report(err.message));}
 });
 element.querySelector('button').onclick=e=>{decks[i].freeze=!decks[i].freeze;e.target.setAttribute('aria-pressed',String(decks[i].freeze));
  if(decks[i].preset<0){if(decks[i].freeze)video.pause();else video.play().catch(err=>report(err.message));}
 };
 $('decks').append(element);
}
for(const id of ['sensitivity','crossfade','depth','brightness'])$(id).oninput=()=>$(id+'-value').value=id==='sensitivity'?(+$(id).value).toFixed(1):Math.round(+$(id).value*100)+'%';
function source(name){state.source=name;$('demo').setAttribute('aria-pressed',String(name==='demo'));$('mic').setAttribute('aria-pressed',String(name==='mic'));}
function stopMic(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if(micNode)micNode.disconnect();micNode=null;}
async function setupAudio(){context??=new AudioContext();await context.resume();analyser??=context.createAnalyser();analyser.fftSize=2048;recordingDestination??=context.createMediaStreamDestination();}
function connectTrack(){if(!fileNode){fileNode=context.createMediaElementSource($('audio'));fileNode.connect(analyser);fileNode.connect(context.destination);fileNode.connect(recordingDestination);}}
async function playTrack(){await setupAudio();stopMic();connectTrack();source('file');await $('audio').play();}
$('track').onclick=async()=>{try{$('audio').pause();if(audioUrl){URL.revokeObjectURL(audioUrl);audioUrl=null;}$('audio').src='audio/Thrillseeker.mp3';$('audio').hidden=false;await playTrack();$('status').textContent='Playing Thrillseeker · the music drives both shader decks.';}catch(e){$('status').textContent='Playback error: '+e.message;}};
$('demo').onclick=()=>{stopMic();$('audio').pause();source('demo');$('status').textContent='Demo pulse is active. This generates visual motion without sound.';};
$('mic').onclick=async()=>{try{await setupAudio();if(!stream)stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});micNode=context.createMediaStreamSource(stream);micNode.connect(analyser);micNode.connect(recordingDestination);$('audio').pause();source('mic');$('status').textContent='Microphone active. Speaker monitoring is muted.';}catch(e){$('status').textContent='Microphone unavailable: '+e.message+'. Demo remains available.';}};
$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{$('audio').pause();if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(file);$('audio').src=audioUrl;$('audio').hidden=false;await playTrack();$('status').textContent='Playing '+file.name+' · the music drives both shader decks.';}catch(e){$('status').textContent='Playback error: '+e.message;}};
$('audio').onplay=async()=>{try{await setupAudio();connectTrack();stopMic();source('file');}catch(e){$('status').textContent='Audio analysis error: '+e.message;}};
$('noise-toggle').onclick=()=>{state.noise=!state.noise;$('noise-toggle').setAttribute('aria-pressed',String(state.noise));$('noise-toggle').textContent=state.noise?'Noise filter · ON':'Noise filter · OFF';};
for(const id of ['noise-grain','noise-warp','noise-scale','noise-speed','noise-audio'])$(id).oninput=()=>$(id+'-value').value=id==='noise-scale'?$(id).value:(+$(id).value).toFixed(2);
$('blackout').onclick=()=>{state.blackout=!state.blackout;$('blackout').setAttribute('aria-pressed',String(state.blackout));};
$('fullscreen').onclick=()=>canvas.requestFullscreen().catch(e=>$('status').textContent=e.message);
$('snapshot').onclick=()=>{canvas.toBlob(blob=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='praxis-program.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});};
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('error').textContent='GPU context lost. Reload this page to resume.';});
window.addEventListener('pagehide',()=>{if(recorder&&recorder.state!=='inactive')recorder.stop();if(programStream)programStream.getTracks().forEach(track=>track.stop());if(programWindow&&!programWindow.closed)programWindow.close();stopMic();decks.forEach(deck=>{deck.video.pause();if(deck.videoUrl)URL.revokeObjectURL(deck.videoUrl);});if(audioUrl)URL.revokeObjectURL(audioUrl);});
$('output-format').onchange=()=>{
 const format=$('output-format').value;
 if(recorder&&recorder.state!=='inactive'){$('output-format').value=state.format;report('Stop recording before changing output format.');return;}
 state.format=format;canvas.width=format==='rectangle'?3840:4096;canvas.height=format==='rectangle'?2160:4096;
 canvas.style.aspectRatio=format==='rectangle'?'16 / 9':'1';
 canvas.setAttribute('aria-label',format==='rectangle'?'Live 16:9 program output':'Live dome program output');
 $('output-label').textContent=format==='rectangle'?'RECTANGLE 16:9 · 3840 × 2160 · 60 FPS target':'180° DOME · 4096 × 4096 · 60 FPS target';
 for(const item of [...targets,...previousTargets,previewTarget])if(item){gl.deleteTexture(item.texture);gl.deleteFramebuffer(item.framebuffer);}
 targets=[target(),target()];previousTargets=[target(),target()];
 previewCanvas.height=format==='rectangle'?144:256;previewCanvas.style.aspectRatio=format==='rectangle'?'16 / 9':'1';
 previewPixels=new Uint8Array(256*previewCanvas.height*4);previewImage=previewContext.createImageData(256,previewCanvas.height);
 previewTarget=target(256,previewCanvas.height);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
};
function crossfadeAmount(manual,depth,energy) {
 const offset=depth*(energy*2-1)*4*manual*(1-manual);
 return Math.max(0,Math.min(1,manual+offset));
}
let previewDeck=0;
const previewCanvas=$('preview'),previewContext=previewCanvas.getContext('2d');
let previewPixels=new Uint8Array(256*256*4);
let previewImage=previewContext.createImageData(256,256);
for(const [id,deck] of [['preview-a',0],['preview-b',1]])$(id).onclick=()=>{
 previewDeck=deck;$('preview-a').setAttribute('aria-pressed',String(deck===0));$('preview-b').setAttribute('aria-pressed',String(deck===1));
};
function drawPreview(){
 gl.bindFramebuffer(gl.FRAMEBUFFER,previewTarget.framebuffer);gl.viewport(0,0,previewCanvas.width,previewCanvas.height);use(previewProgram);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,targets[previewDeck].texture);
 gl.uniform1i(gl.getUniformLocation(previewProgram,'image'),0);gl.drawArrays(gl.TRIANGLES,0,6);
 gl.readPixels(0,0,previewCanvas.width,previewCanvas.height,gl.RGBA,gl.UNSIGNED_BYTE,previewPixels);
 previewImage.data.set(previewPixels);previewContext.putImageData(previewImage,0,0);
}
let programStream,programWindow,recorder,recordedStream,recordTimer,recordStarted;
function getProgramStream(){if(!canvas.captureStream)throw Error('Program capture is unavailable in this browser.');return programStream??=canvas.captureStream(60);}
$('popout').onclick=()=>{
 try{
  const output=getProgramStream();
  if(programWindow&&!programWindow.closed){programWindow.focus();return;}
  programWindow=window.open('program.html','praxisProgram','popup,width=900,height=940');
  if(!programWindow)throw Error('Allow popups for this localhost page to open the program window.');
  const attach=()=>{const video=programWindow.document.getElementById('program');if(video){video.srcObject=output;video.play().catch(err=>report(err.message));}};
  programWindow.addEventListener('load',attach,{once:true});
  if(programWindow.document.readyState==='complete')attach();
 }catch(err){report(err.message);}
};
function finishRecording(){
 clearInterval(recordTimer);if(recordedStream)recordedStream.getTracks().forEach(track=>track.stop());
 recordedStream=null;$('record').disabled=false;$('record').textContent='● Record program';$('record').setAttribute('aria-pressed','false');
}
$('record').onclick=async()=>{
 if(recorder&&recorder.state!=='inactive'){$('record').disabled=true;recorder.stop();return;}
 $('record').disabled=true;
 try{
  if(!window.MediaRecorder)throw Error('Recording is unavailable in this browser.');
  await setupAudio();
  const tracks=[...getProgramStream().getVideoTracks(),...recordingDestination.stream.getAudioTracks()].map(track=>track.clone());
  recordedStream=new MediaStream(tracks);
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
  recorder=new MediaRecorder(recordedStream,mime?{mimeType:mime,videoBitsPerSecond:100000000,audioBitsPerSecond:192000}:undefined);
  const chunks=[];let total=0,failed=false;
  recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);total+=e.data.size;if(total>1024*1024*1024&&recorder.state!=='inactive'){report('Recording reached 1 GB and was stopped for download.');recorder.stop();}}};
  recorder.onerror=e=>{failed=true;report('Recording failed: '+(e.error?.message||'unknown error'));finishRecording();};
  recorder.onstop=()=>{
   const type=recorder.mimeType;finishRecording();
   if(!failed&&chunks.length){const blob=new Blob(chunks,{type});const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='praxis-program-'+new Date().toISOString().replace(/[:.]/g,'-')+(type.includes('mp4')?'.mp4':'.webm');link.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);$('record-status').textContent='Recording saved · '+(blob.size/1024/1024).toFixed(1)+' MB';
   }
  };
  recorder.start(1000);$('record').disabled=false;recordStarted=performance.now();$('record').textContent='■ Stop recording';$('record').setAttribute('aria-pressed','true');
  $('record-status').textContent='REC · 0:00';
  recordTimer=setInterval(()=>{const seconds=Math.floor((performance.now()-recordStarted)/1000);$('record-status').textContent='REC · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');},500);
 }catch(err){finishRecording();report(err.message);}
};
function setAutoFade(value){$('crossfade').value=value;$('crossfade').oninput();}
function autoStatus(){return {format:state.format,resolution:[canvas.width,canvas.height],target_fps:state.targetFps,actual_fps:state.actualFps,auto:automatic.snapshot(),crossfade:+$('crossfade').value,
 decks:decks.map(deck=>({source:deck.preset<0?'video':SHADER_LIBRARY[deck.preset].name,freeze:deck.freeze})),
 audio_source:state.source,recording:!!recorder&&recorder.state!=='inactive',frames:state.frames};}
function updateAutoUI(){
 const settings=automatic.settings;
 $('auto-toggle').setAttribute('aria-pressed',String(settings.enabled));$('auto-toggle').textContent=settings.enabled?'Auto · ON':'Auto · OFF';
 $('auto-hold').value=settings.hold_seconds;$('auto-fade').value=settings.fade_seconds;$('auto-pool').value=settings.pool;$('auto-blends').checked=settings.rotate_blends;
}
const automatic=new AutoMixer({
 setFade:setAutoFade,changed:()=>updateAutoUI(),
 prepare:(hidden,settings)=>{
  // Uploaded video decks are preserved; Auto still fades between them.
  if(decks[hidden].preset>=0){
   const choices=SHADER_LIBRARY.map((entry,index)=>({entry,index})).filter(x=>settings.pool==='all'||x.entry.group==='Original');
   for(let attempt=0;attempt<10;attempt++){
    const choice=choices[Math.floor(Math.random()*choices.length)];
    if(choice.index===decks[1-hidden].preset)continue;
    try{shaderFor(choice.index);decks[hidden].preset=choice.index;
     const select=$('decks').children[hidden].querySelector('select');select.value=String(choice.index);break;
    }catch(error){report('Auto skipped '+choice.entry.name+': '+error.message);}
   }
  }
  if(settings.rotate_blends)$('blend').value=String(Math.floor(Math.random()*13));
 }
});
$('auto-toggle').onclick=()=>automatic.configure({enabled:!automatic.settings.enabled},+$('crossfade').value);
$('auto-next').onclick=()=>automatic.next(+$('crossfade').value);
for(const id of ['auto-hold','auto-fade','auto-pool','auto-blends'])$(id).onchange=()=>{
 try{automatic.configure({hold_seconds:+$('auto-hold').value,fade_seconds:+$('auto-fade').value,pool:$('auto-pool').value,rotate_blends:$('auto-blends').checked});}
 catch(error){report(error.message);updateAutoUI();}
};
// Moving the manual crossfader hands control back to the performer.
$('crossfade').addEventListener('input',event=>{if(event.isTrusted&&automatic.settings.enabled)automatic.configure({enabled:false},+$('crossfade').value);});
let bridgeClient;
try{bridgeClient=crypto.randomUUID();}
catch(_){bridgeClient='mixer-'+Math.random().toString(36).slice(2);}
let bridgeAcks=[];
const appliedCommands=new Map();
async function syncBridge(){
 try{
  const response=await fetch('/api/mixer/sync',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({client_id:bridgeClient,state:autoStatus(),acks:bridgeAcks})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Bridge unavailable');
  bridgeAcks=[];$('mcp-status').textContent='MCP bridge · connected';
  for(const command of data.commands){
   if(appliedCommands.has(command.id)){bridgeAcks.push(appliedCommands.get(command.id));continue;}
   let ack;
   try{
    if((command.action==='next'||command.args?.enabled===true)&&state.frames===0)throw Error('The GPU program is not rendering. Check the player error before enabling Auto.');
    if(command.action==='auto')automatic.configure(command.args,+$('crossfade').value);
    else if(command.action==='next')automatic.next(+$('crossfade').value);
    else throw Error('Unknown mixer command');
    ack={id:command.id,ok:true,state:autoStatus()};
   }catch(error){ack={id:command.id,ok:false,error:error.message};}
   appliedCommands.set(command.id,ack);bridgeAcks.push(ack);
   if(appliedCommands.size>100)appliedCommands.delete(appliedCommands.keys().next().value);
  }
 }catch(error){$('mcp-status').textContent='MCP bridge · '+error.message;}
 setTimeout(syncBridge,500);
}
syncBridge();
let lastFrameMs=-Infinity,fpsEpoch=performance.now(),fpsFrames=0;
const buffer=new Float32Array(2048);
function frame(ms){try{
 if(ms-lastFrameMs<1000/state.targetFps-.5){requestAnimationFrame(frame);return;}
 lastFrameMs=ms;fpsFrames++;
 if(ms-fpsEpoch>=1000){state.actualFps=Math.round(fpsFrames*1000/(ms-fpsEpoch));fpsFrames=0;fpsEpoch=ms;$('fps-status').textContent=state.actualFps+' FPS actual / 60 target';}
 const t=ms/1000,dt=previous?Math.min(.1,t-previous):1/60;previous=t;automatic.tick(dt);
 let rms=0;if(state.source==='demo')rms=.08*Math.pow(.5+.5*Math.sin(t*Math.PI*4),4);else if(analyser){analyser.getFloatTimeDomainData(buffer);rms=Math.sqrt(buffer.reduce((a,x)=>a+x*x,0)/buffer.length);}
 const desired=Math.min(1,rms*+$('sensitivity').value);state.envelope+=(desired-state.envelope)*(1-Math.exp(-dt/(desired>state.envelope?.04:.3)));$('level').style.width=(state.envelope*100)+'%';state.noiseTime+=dt*+$('noise-speed').value;
 for(let i=0;i<2;i++){
  const deck=decks[i],p=deck.preset<0?videoProgram:shaderFor(deck.preset);
  if(!deck.freeze)deck.time+=dt*deck.speed*(1+state.envelope*deck.reaction*2);
  // Ping-pong allows legacy backbuffer shaders to sample their previous frame.
  [targets[i],previousTargets[i]]=[previousTargets[i],targets[i]];
  gl.bindFramebuffer(gl.FRAMEBUFFER,targets[i].framebuffer);use(p);
  uniform(p,'resolution',canvas.width,canvas.height);gl.uniform1i(gl.getUniformLocation(p,'uRect'),state.format==='rectangle'?1:0);uniform(p,'time',deck.time);uniform(p,'mouse',.5+state.envelope*.3,.5);
  gl.uniform1i(gl.getUniformLocation(p,'uProjection'),deck.projection);uniform(p,'uSourceFov',deck.fov);uniform(p,'uSourceAspect',deck.preset<0?(deck.video.videoWidth||1)/(deck.video.videoHeight||1):1);uniform(p,'uYaw',+$('dome-yaw').value);uniform(p,'uTilt',+$('dome-tilt').value);gl.uniform1i(gl.getUniformLocation(p,'uGrid'),$('projection-grid').checked?1:0);uniform(p,'uEnergy',state.envelope);uniform(p,'uBrightness',state.blackout?0:+$('brightness').value);uniform(p,'uZoom',deck.zoom);uniform(p,'uReaction',deck.reaction);
  uniform(p,'bin0',state.envelope);uniform(p,'bin1',state.envelope);uniform(p,'x',.5);uniform(p,'y',.5);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,previousTargets[i].texture);
  const feedback=gl.getUniformLocation(p,'backbuffer');if(feedback!==null)gl.uniform1i(feedback,0);
  if(deck.preset<0){
   gl.activeTexture(gl.TEXTURE1);
   if(!deck.videoTexture){deck.videoTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,deck.videoTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
   gl.bindTexture(gl.TEXTURE_2D,deck.videoTexture);
   if(deck.video.readyState>=2){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,deck.video);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);}
   gl.uniform1i(gl.getUniformLocation(p,'clip'),1);uniform(p,'aspect',(deck.video.videoWidth||1)/(deck.video.videoHeight||1));
  }
  gl.drawArrays(gl.TRIANGLES,0,6);
 }
 if(state.frames%6===0)drawPreview();
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);use(mixProgram);targets.forEach((target,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,target.texture);gl.uniform1i(gl.getUniformLocation(mixProgram,i?'b':'a'),i);});const amount=crossfadeAmount(+$('crossfade').value,+$('depth').value,state.envelope);uniform(mixProgram,'amount',amount);gl.uniform1i(gl.getUniformLocation(mixProgram,'uRect'),state.format==='rectangle'?1:0);gl.uniform1i(gl.getUniformLocation(mixProgram,'mode'),+$('blend').value);gl.uniform1i(gl.getUniformLocation(mixProgram,'noiseEnabled'),state.noise?1:0);gl.uniform1i(gl.getUniformLocation(mixProgram,'blackout'),state.blackout?1:0);uniform(mixProgram,'noiseTime',state.noiseTime);uniform(mixProgram,'noiseGrain',+$('noise-grain').value * +$('brightness').value);uniform(mixProgram,'noiseWarp',+$('noise-warp').value);uniform(mixProgram,'noiseScale',+$('noise-scale').value);uniform(mixProgram,'noiseAudio',+$('noise-audio').value);uniform(mixProgram,'energy',state.envelope);gl.drawArrays(gl.TRIANGLES,0,6);state.frames++;window.mixer={state,decks,gl,canvas};requestAnimationFrame(frame);
 }catch(e){$('error').textContent=e.stack||e.message;}}
let mixProgram,videoProgram,previewProgram,previewTarget;
try{if(!gl)throw Error('WebGL is unavailable in this browser. Enable hardware graphics support.');if(gl.getParameter(gl.MAX_TEXTURE_SIZE)<4096||gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)<4096)throw Error('This GPU cannot allocate the 4096-pixel 4K dome output.');const geometry=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,geometry);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);gl.viewport(0,0,canvas.width,canvas.height);shaderFor(decks[0].preset);shaderFor(decks[1].preset);mixProgram=program(mixSource);videoProgram=program(videoSource);previewProgram=program('precision highp float;varying vec2 uv;uniform sampler2D image;void main(){gl_FragColor=texture2D(image,vec2(uv.x,1.-uv.y));}');previewTarget=target(256,256);targets=[target(),target()];previousTargets=[target(),target()];$('live').textContent='GPU · LIVE · '+SHADER_LIBRARY.length+' SHADERS';requestAnimationFrame(frame);}catch(e){$('live').textContent='GPU · ERROR';$('error').textContent=e.stack||e.message;}
