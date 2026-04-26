import { getProfileAction } from "../actions/profile";
import { NotfallScreen } from "../../components/notfall-screen.jsx";
import { createEmptyProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function NotfallPage() {
  let initialProfile = createEmptyProfile();
  let initialProfileError = "";

  try {
    initialProfile = await getProfileAction();
  } catch (error) {
    initialProfileError =
      error instanceof Error ? error.message : "Profil konnte nicht geladen werden.";
  }

  return (
    <NotfallScreen
      initialProfile={initialProfile}
      initialProfileError={initialProfileError}
    />
  );
}
