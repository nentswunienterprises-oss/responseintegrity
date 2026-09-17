from pathlib import Path

p = Path('shared/responseIntegrityCorrectionReplay.ts')
s = p.read_text()
old = '''    const corrected = applyCorrectionsForEvent(event);
    if (!corrected.ok) {
      throw new Error(`Correction replay failed for ${event.sourceDrillId}: ${corrected.error}`);
    }
    const sets = corrected.sets as LedgerEvidenceSet[];'''
new = '''    const corrected = applyCorrectionsForEvent(event);
    if ("error" in corrected) {
      throw new Error(`Correction replay failed for ${event.sourceDrillId}: ${corrected.error}`);
    }
    const sets = corrected.sets as LedgerEvidenceSet[];'''
if old not in s:
    raise RuntimeError('correction result narrowing block not found')
s = s.replace(old, new, 1)
old = '''    inheritedHold = "inheritedVerificationHold" in inheritedGated
      ? (inheritedGated.inheritedVerificationHold || null)
      : null;'''
new = '''    const gatedInheritedHold = "inheritedVerificationHold" in inheritedGated
      ? inheritedGated.inheritedVerificationHold
      : null;
    inheritedHold = gatedInheritedHold && typeof gatedInheritedHold === "object"
      ? gatedInheritedHold as InheritedVerificationHold
      : null;'''
if old not in s:
    raise RuntimeError('inherited hold narrowing block not found')
s = s.replace(old, new, 1)
p.write_text(s)
