'use strict';
class AutoMixer {
 constructor(callbacks){this.callbacks=callbacks;this.settings={enabled:false,hold_seconds:12,fade_seconds:4,pool:'all',rotate_blends:false};this.phase='hold';this.elapsed=0;this.position=0;this.from=0;this.to=0;}
 configure(patch,position=this.position){
  for(const [key,value] of Object.entries(patch)){
   if(!(key in this.settings))throw Error('Unknown Auto setting: '+key);
   if(['enabled','rotate_blends'].includes(key)&&typeof value!=='boolean')throw Error(key+' must be boolean');
   if(key==='pool'&&!['all','original'].includes(value))throw Error('Invalid shader pool');
   if(['hold_seconds','fade_seconds'].includes(key)&&(!Number.isFinite(value)||value<(key==='hold_seconds'?2:.5)||value>(key==='hold_seconds'?300:60)))throw Error('Invalid '+key);
  }
  const starting=patch.enabled===true&&!this.settings.enabled;Object.assign(this.settings,patch);
  if(starting){this.position=position;this.from=position;this.to=position<.5?0:1;this.phase='fade';this.elapsed=0;}
  this.callbacks.changed?.();return this.snapshot();
 }
 snapshot(){return {...this.settings,phase:this.phase,crossfade:this.position};}
 next(position=this.position){
  if(!this.settings.enabled)this.configure({enabled:true},position);
  if(this.phase==='fade'){this.position=this.to;this.callbacks.setFade(this.position);}
  this.phase='hold';this.elapsed=this.settings.hold_seconds;
  this.callbacks.changed?.();return this.snapshot();
 }
 tick(dt){
  if(!this.settings.enabled)return;
  this.elapsed+=Math.max(0,Math.min(.25,dt));
  if(this.phase==='hold'){
   if(this.elapsed<this.settings.hold_seconds)return;
   const hidden=this.position<.5?1:0;
   this.callbacks.prepare(hidden,this.settings);
   this.from=this.position;this.to=this.position<.5?1:0;this.phase='fade';this.elapsed=0;
  }else{
   const progress=Math.min(1,this.elapsed/this.settings.fade_seconds),smooth=progress*progress*(3-2*progress);
   this.position=this.from+(this.to-this.from)*smooth;this.callbacks.setFade(this.position);
   if(progress===1){this.phase='hold';this.elapsed=0;}
  }
 }
}
if(typeof module!=='undefined')module.exports=AutoMixer;
