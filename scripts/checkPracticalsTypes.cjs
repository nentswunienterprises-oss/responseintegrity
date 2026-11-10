// Scoped assessment type gate. The legacy whole-repository tsconfig currently has
// unrelated errors in shared/schema and abandoned Next API routes. Do not hide
// errors in the updated Practicals subsystem behind that existing debt.
const ts=require("typescript");
const path=require("node:path");
const root=process.cwd();
const config=ts.readConfigFile("tsconfig.json",ts.sys.readFile);
if(config.error)throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,"\n"));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
if(parsed.errors.length)throw new Error("Invalid root TypeScript configuration.");
const touched=new Set([
 "server/practicalCasePlans.ts",
 "server/practicalCaseWork.ts",
 "server/privatePracticalBenchmarkBank.ts",
 "server/practicalRecordingRecovery.ts",
 "server/practicalBenchmarkBank.ts",
 "server/practicalBenchmarkRuns.ts",
 "server/routes/capabilityPracticalEvidence.ts",
 "server/capabilityPracticalEvidence.ts",
 "shared/practicalBenchmarkPolicy.ts",
 "shared/capabilityPracticalEvidence.ts",
 "shared/practicalExecuteChallenge.ts",
 "shared/practicalPrivateBankIntegrity.ts",
 "shared/practicalRepObservation.ts",
 "shared/practicalBenchmarkPolicy.test.ts",
 "shared/practicalPrivateBankIntegrity.test.ts",
 "shared/practicalRepObservation.test.ts",
 "server/practicalBenchmarkBank.test.ts",
 "server/practicalCasePlans.test.ts",
 "server/privatePracticalBankSourceBoundary.test.ts",
 "client/src/components/practicals/PracticalCaseWorkbench.tsx",
 "client/src/components/practicals/PracticalBenchmarkRun.tsx",
 "client/src/components/practicals/PracticalRecordingRecoveryControls.tsx",
 "client/src/components/practicals/PracticalRecordingRecoveryQueue.tsx",
 "client/src/components/practicals/ResponsiveExecuteChallenge.tsx",
 "client/src/pages/operational/tutor/practicals.tsx",
 "client/src/pages/operational/td/practicals-review.tsx",
]);
const roots=[...touched].map(file=>path.resolve(root,file));
const program=ts.createProgram(roots,{...parsed.options,noEmit:true,incremental:false,tsBuildInfoFile:undefined});
const local=ts.getPreEmitDiagnostics(program);
if(local.length){
 console.error(ts.formatDiagnosticsWithColorAndContext(local,{
   getCurrentDirectory:()=>root,
   getCanonicalFileName:x=>x,
   getNewLine:()=>ts.sys.newLine,
 }));
 console.error("Practicals scoped typecheck failed with",local.length,"error(s).");
 process.exit(1);
}
console.log("Practicals scoped TypeScript contract: PASS ("+touched.size+" touched files).");
