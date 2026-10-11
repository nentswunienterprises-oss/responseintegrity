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
 "server/practicalBenchmarkBank.ts",
 "server/practicalBenchmarkRuns.ts",
 "server/routes/capabilityPracticalEvidence.ts",
 "server/capabilityPracticalEvidence.ts",
 "shared/practicalBenchmarkPolicy.ts",
 "client/src/components/practicals/PracticalCaseWorkbench.tsx",
 "client/src/components/practicals/PracticalBenchmarkRun.tsx",
 "client/src/components/practicals/ResponsiveExecuteChallenge.tsx",
 "client/src/pages/operational/tutor/practicals.tsx",
 "client/src/pages/operational/td/practicals-review.tsx",
]);
const program=ts.createProgram(parsed.fileNames,{...parsed.options,noEmit:true,incremental:false,tsBuildInfoFile:undefined});
const all=ts.getPreEmitDiagnostics(program);
const local=all.filter(diag=>diag.file&&touched.has(path.relative(root,diag.file.fileName).replaceAll("\\","/")));
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
const other=all.length-local.length;
if(other)console.log("Existing unrelated repository TypeScript diagnostics outside scope:",other,"(not silently changed).");
