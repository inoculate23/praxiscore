'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/player/player.js','utf8');
const fn=code.match(/function crossfadeAmount\([^]*?\n}/)[0];
const crossfade=vm.runInNewContext('('+fn+')');
for(const depth of [0,.25,1])for(const energy of [0,.5,1]){
 assert.equal(crossfade(0,depth,energy),0);
 assert.equal(crossfade(1,depth,energy),1);
 for(let i=0;i<=100;i++){const v=crossfade(i/100,depth,energy);assert(v>=0&&v<=1);}
}
assert.equal(crossfade(.3,0,1),.3);
assert.notEqual(crossfade(.5,1,1),crossfade(.5,1,0));
console.log('Crossfade endpoint isolation, modulation and range checks passed.');
