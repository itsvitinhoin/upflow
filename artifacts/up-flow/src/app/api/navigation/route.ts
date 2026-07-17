export const dynamic = "force-dynamic";

// Keep the navigation payload separate from the legacy sidebar URL. Some
// browser extensions block requests containing "sidebar" before they reach
// the application.
export { GET } from "@/app/api/sidebar/route";
