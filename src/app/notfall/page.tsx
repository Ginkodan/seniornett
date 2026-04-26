import { getProfileAction } from "../actions/profile";
import { NotfallScreen } from "../../components/notfall-screen.jsx";
import { createEmptyProfile } from "@/lib/profile";
import { headers } from "next/headers";
import { createTranslator, normalizeLanguage } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function NotfallPage() {
  const requestHeaders = await headers();
  const t = createTranslator(normalizeLanguage(requestHeaders.get("x-user-language")));
  let initialProfile = createEmptyProfile();
  let initialProfileError = "";

  try {
    initialProfile = await getProfileAction();
  } catch {
    initialProfileError = t("emergency.profile.loadingError");
  }

  return (
    <NotfallScreen
      initialProfile={initialProfile}
      initialProfileError={initialProfileError}
    />
  );
}
