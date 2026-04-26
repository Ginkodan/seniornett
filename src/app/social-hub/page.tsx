import { SocialHubScreen } from "../../components/social-hub-screen.jsx";

export default async function SocialHubPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<{ area?: string | string[]; contact?: string | string[] }>;
}>) {
  const params = (await searchParams) || {};
  const contactId = Array.isArray(params.contact) ? params.contact[0] : params.contact || "";
  const area = Array.isArray(params.area) ? params.area[0] : params.area || "";

  return <SocialHubScreen initialArea={area} initialContactId={contactId} />;
}
