import "./capabilityBlueprint";

declare module "./capabilityBlueprint" {
  export type CapabilityBlueprintEvidenceCell =
    ReturnType<typeof getRequiredCapabilityEvidenceCells>[number];
}
