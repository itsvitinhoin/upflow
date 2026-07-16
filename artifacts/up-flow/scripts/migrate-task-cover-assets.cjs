const { PrismaClient } = require("@prisma/client");

const bucket = process.env.TASK_ASSETS_BUCKET || "task-assets";
const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

function isStoragePath(value) {
  const segments = value.split("/");
  return (
    segments.length === 3 &&
    segments.every((segment) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(segment))
  );
}

function legacyPublicAssetPath(value) {
  if (typeof value !== "string" || !value.startsWith("http")) return null;
  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${encodeURIComponent(bucket)}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    const encodedPath = url.pathname.slice(markerIndex + marker.length);
    const path = encodedPath.split("/").map(decodeURIComponent).join("/");
    return isStoragePath(path) ? path : null;
  } catch {
    return null;
  }
}

async function main() {
  let cursor;
  let scanned = 0;
  let candidates = 0;
  let migrated = 0;

  do {
    const rows = await prisma.task.findMany({
      where: { cover_image_url: { not: null } },
      select: { id: true, cover_image_url: true },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    cursor = rows.at(-1)?.id;
    scanned += rows.length;

    for (const task of rows) {
      const path = legacyPublicAssetPath(task.cover_image_url);
      if (!path) continue;
      candidates += 1;
      if (!apply) continue;
      await prisma.task.update({
        where: { id: task.id },
        data: { cover_image_url: `task-asset://${path}` },
      });
      migrated += 1;
    }
  } while (cursor);

  console.log(
    apply
      ? `Migrated ${migrated} of ${candidates} legacy public task-cover references after scanning ${scanned} tasks.`
      : `Dry run found ${candidates} legacy public task-cover references after scanning ${scanned} tasks. Re-run with --apply to migrate them.`,
  );
}

main()
  .catch((error) => {
    console.error("Task-cover migration failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
