import type { Metadata } from "next";
import ResetConfirmationPage from "./confirm-page";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <ResetConfirmationPage />;
}
