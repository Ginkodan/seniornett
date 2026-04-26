export type SeniorRoute = {
  path: string;
  name: string;
};

export const seniorFacingRoutes: SeniorRoute[] = [
  { path: "/", name: "Startseite" },
  { path: "/social-hub", name: "Treffpunkt" },
  { path: "/fotos-papiere", name: "Fotos und Papiere" },
  { path: "/lotti-live", name: "Lotti fragen" },
  { path: "/lexikon", name: "Lexikon" },
  { path: "/audio", name: "Audio und Musik" },
  { path: "/news", name: "Zeitung" },
  { path: "/wetter", name: "Wetter" },
  { path: "/notfall", name: "Notfall" },
  { path: "/karte", name: "Karte" },
  { path: "/video", name: "Fernsehen" },
];

export const auditViewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 1024, height: 768 },
] as const;

