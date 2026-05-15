/**
 * One-off scan: walks every CustomFieldValue and runs it through the same
 * validator the API uses. Logs anything that doesn't pass so we know whether
 * a data backfill is required before deploying the stricter write paths.
 *
 * Usage: `pnpm tsx scripts/validate-custom-fields.ts`
 */
import { prisma } from "../src/lib/prisma";
import { validateCustomFieldValue } from "../src/lib/custom-field-validator";

async function main() {
  const defs = await prisma.customFieldDefinition.findMany({
    select: { id: true, name: true, type: true, options: true },
  });
  const byId = new Map(defs.map((d) => [d.id, d]));

  const values = await prisma.customFieldValue.findMany({
    select: { task_id: true, definition_id: true, value: true },
  });

  let bad = 0;
  let missingDef = 0;
  for (const v of values) {
    const def = byId.get(v.definition_id);
    if (!def) {
      missingDef++;
      console.log(`[orphan]    task=${v.task_id} definition_id=${v.definition_id}`);
      continue;
    }
    const r = validateCustomFieldValue(def, v.value);
    if (!r.ok) {
      bad++;
      console.log(
        `[invalid]   task=${v.task_id} field="${def.name}" (${def.type}): ${r.error} — value=${JSON.stringify(v.value)}`,
      );
    }
  }

  console.log(
    `\nScanned ${values.length} value rows: ${bad} failed validation, ${missingDef} orphaned (no definition).`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
