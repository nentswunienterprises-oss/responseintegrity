import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {activateReviewedBanks} from './exceptionBankActivation.mjs';

assert.equal(process.env.EXCEPTION_BANK_ACTIVATION_CONFIRM,'THE_HUB_ACTIVATE_EXCEPTIONS');
const deployedSha=String(process.env.EXCEPTION_DEPLOYED_SHA||'');
assert.match(deployedSha,/^[a-f0-9]{40}$/,'Require the independently verified READY Production deployment SHA');
const accepted='612ae8d34f19e38f072328bb104e1e73a050b294';
// Production deployment identity is independently verified through Vercel before dispatch.
// Refuse any checkout or supplied deployment with unaccepted application-source drift.
const sources=['client','server','shared','api','package.json','package-lock.json','vite.config.ts','tsconfig.json'];
execFileSync('git',['merge-base','--is-ancestor',accepted,deployedSha]);
execFileSync('git',['diff','--exit-code',accepted,deployedSha,'--',...sources]);
execFileSync('git',['diff','--exit-code',deployedSha,'HEAD','--',...sources]);
const url=String(process.env.RI_PRODUCTION_DATABASE_URL||'');
assert.ok(url.includes('yzcnavucvwgmulcxgxvw'),'Database URL must identify The Hub');
const banks=JSON.parse(fs.readFileSync(new URL('../docs/qualification-content/20261014_evidence_exception_promotion_hashes.json',import.meta.url),'utf8'));
assert.equal(banks.length,9); assert.equal(banks.reduce((sum,b)=>sum+b.itemCount,0),443);
const db=new pg.Client({connectionString:url,ssl:{rejectUnauthorized:true}});
await db.connect();
try {
  const after=await activateReviewedBanks(db,banks);
  console.log('EXCEPTION_BANK_ACTIVATION_PASS='+JSON.stringify({deployedSha,productionProject:'yzcnavucvwgmulcxgxvw',banks:after,historicalEvidenceModified:false}));
}finally {await db.end();}
