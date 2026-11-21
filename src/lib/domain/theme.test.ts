import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const css=readFileSync("src/app/globals.css","utf8");
function luminance(hex:string) { const a=hex.match(/../g)!.map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722; }
function contrast(a:string,b:string) {const [x,y]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return(y+.05)/(x+.05);}
describe("Lab Gold theme contrast",()=>{
 it("keeps primary white labels and dark semantic text at AA",()=>{
  for(const [a,b] of [["eadbb9","101010"],["17140e","b39a62"],["78623b","ffffff"],["e6e2d8","101010"],["ffffff","8c6239"],["f2eee7","23211e"],["c5bdb1","23211e"],["e2bd87","382f22"],["efaaaa","3a2828"],["8ad3b0","20362c"]]) expect(contrast(a,b)).toBeGreaterThanOrEqual(4.5);
 });
 it("defines every theme variable referenced by the stylesheet",()=>{
  const defined=new Set([...css.matchAll(/(--[\w-]+):/g)].map(m=>m[1]));
  for(const match of css.matchAll(/var\((--[\w-]+)\)/g)) if(!match[1].startsWith("--font-")) expect(defined.has(match[1]),match[1]).toBe(true);
 });
});
