/**
 * Practicals uses the same per-dimension observation status as Sandbox.
 * An unobserved/confounded dimension is a genuine evidence absence, not a
 * fabricated choice from the registry that happens to accompany a label.
 */
export type PracticalDimensionEvidenceStatus="observed"|"not_observed"|"confounded";
export type PracticalDimensionObservation={
  optionId:string|null;
  evidenceStatus:PracticalDimensionEvidenceStatus;
};
export type PracticalObservationField={
  fieldKey:string;
  options:readonly {optionId:string;label:string}[];
};
export function normalizePracticalDimensionObservations(
  fields:readonly PracticalObservationField[],input:unknown,
):Record<string,PracticalDimensionObservation>{
 if(!input || typeof input!=="object"||Array.isArray(input))
   throw new Error("Complete the issued per-dimension RI-OS evidence record.");
 const entries=input as Record<string,unknown>;
 if(Object.keys(entries).length!==fields.length)
   throw new Error("Every exact issued observation field must have an explicit evidence status.");
 const result:Record<string,PracticalDimensionObservation>={};
 for(const field of fields){
   const source=entries[field.fieldKey];
   if(!source||typeof source!=="object"||Array.isArray(source))
     throw new Error("Missing structured observation for "+field.fieldKey);
   const raw=source as Record<string,unknown>;
   if(!["observed","not_observed","confounded"].includes(String(raw.evidenceStatus)))
     throw new Error("Invalid evidence status for "+field.fieldKey);
   const evidenceStatus=raw.evidenceStatus as PracticalDimensionEvidenceStatus;
   if(evidenceStatus==="observed"){
     if(typeof raw.optionId!=="string" ||
        !field.options.some(o=>o.optionId===raw.optionId))
       throw new Error("Observed evidence must match the actual issued drill choices for "+field.fieldKey);
     result[field.fieldKey]={optionId:raw.optionId,evidenceStatus};
   }else{
     if(raw.optionId!==undefined && raw.optionId!==null)
       throw new Error("Unobserved or confounded work must not invent an option for "+field.fieldKey);
     result[field.fieldKey]={optionId:null,evidenceStatus};
   }
 }
 return result;
}
