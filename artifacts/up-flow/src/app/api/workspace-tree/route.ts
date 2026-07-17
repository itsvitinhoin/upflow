export const dynamic = "force-dynamic";

// A neutral alias for the workspace tree. Browser content blockers can reject
// requests whose URL contains "sidebar" or "navigation" before they reach the app.
export { GET } from "@/app/api/sidebar/route";
