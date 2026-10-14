import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function sources(dir:string):string[]{
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(dir,entry.name);
    return entry.isDirectory()?sources(file):file.endsWith(".tsx")?[file]:[];
  });
}

test("every current lesson and imported infrastructure formative source excludes retired fictional incidents",()=>{
  const pages=sources("client/src/pages/responseconditioningsystem");
  assert.equal(pages.filter(p=>!p.endsWith("introduction.tsx")).length,21);
  // Vite explicitly prefers .tsx/.ts; archived .jsx sources are not current lesson authority.
  assert.match(fs.readFileSync("vite.config.ts","utf8"),/extensions:\s*\["\.tsx", "\.ts", "\.jsx"/);
  const files=[...pages,"client/src/lib/sessionInfrastructureTeaching.ts"];
  const retired=[
    /\b(?:camera|phone|video) (?:freezes|glitches)\b/i,
    /\b(?:audio drops out|microphone cuts out|display refreshes|screen glitch)\b/i,
    /\b(?:failed to elicit|forgot to watch|never elicited the explanation)\b/i,
    /\bworking surface (?:leaves|moves out of) (?:the )?(?:camera|view|frame)\b/i,
    /\bcamera (?:angle|view) (?:hides|misses|lost)\b/i,
    /\bchanges the required step order\b/i,
  ];
  for(const file of files){
    const copy=fs.readFileSync(file,"utf8");
    for(const pattern of retired)assert.doesNotMatch(copy,pattern,file);
  }
});
