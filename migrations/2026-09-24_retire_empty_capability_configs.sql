-- Historical Capability Proof environments may contain configuration rows marked
-- active even though no private items were ever imported. Such rows must not make
-- a Capability Check appear available.
UPDATE private.specialist_capability_assessment_configs AS config
   SET active = false,
       retired_at = COALESCE(config.retired_at, now())
 WHERE config.active = true
   AND NOT EXISTS (
     SELECT 1
       FROM private.specialist_capability_assessment_items AS item
      WHERE item.assessment_key = config.assessment_key
        AND item.bank_version = config.bank_version
        AND item.active = true
   );
