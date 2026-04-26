"use client";

import React from "react";
import { PhoneCall } from "lucide-react";
import { PROFILE_FIELDS, normalizeProfile } from "@/lib/profile";
import { useAppState } from "./app-provider.jsx";

const EMERGENCY_NUMBERS = [
  { number: "117", key: "police" },
  { number: "118", key: "fire" },
  { number: "144", key: "ambulance" },
];

const PROFILE_SUMMARY_FIELDS = [
  "geburtsdatum",
  "blutgruppe",
  "notfallkontakt",
];

const PROFILE_PRIORITY_FIELDS = new Set(PROFILE_SUMMARY_FIELDS);

function EmergencyCard({ entry }) {
  const { t } = useAppState();
  return (
    <a
      href={`tel:${entry.number}`}
      className="notfall-quick-card"
      aria-label={t(`emergency.quick.${entry.key}.call`, { label: entry.label, number: entry.number })}
    >
      <div className="notfall-quick-label">{entry.label}</div>
      <div className="notfall-quick-bottom">
        <div className="notfall-quick-number">{entry.number}</div>
        <div className="notfall-quick-icon" aria-hidden="true">
          <PhoneCall size={30} strokeWidth={2.25} />
        </div>
      </div>
    </a>
  );
}

function ProfileCard({ initialProfile, initialProfileError }) {
  const { t } = useAppState();
  const profile = normalizeProfile(initialProfile);
  const hasData = PROFILE_FIELDS.some(f => profile[f.key]);
  const displayName = [profile.vorname, profile.nachname].filter(Boolean).join(" ");
  const detailFields = PROFILE_FIELDS.filter(
    (field) => profile[field.key] && !PROFILE_PRIORITY_FIELDS.has(field.key)
  );

  return (
    <div className="notfall-profile-card">
      <div className="notfall-profile-header">
        <div>
          <div className="notfall-profile-eyebrow">{t("emergency.profile.eyebrow")}</div>
          <h2 className="notfall-profile-title">{displayName || t("emergency.profile.fallbackTitle")}</h2>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="notfall-profile-summary" aria-label={t("emergency.profile.summaryLabel")}>
            {PROFILE_SUMMARY_FIELDS.filter((key) => profile[key] && key !== "notfallkontakt").map((key) => (
              <div key={key} className="notfall-profile-pill">
                <span className="notfall-profile-pill-label">{t(`emergency.fields.${key}`)}</span>
                <span className="notfall-profile-pill-value">{profile[key]}</span>
              </div>
            ))}
          </div>

          {profile.notfallkontakt ? (
            <div className="notfall-profile-contact">
              <div className="notfall-profile-contact-label">{t("emergency.profile.contactLabel")}</div>
              <div className="notfall-profile-contact-value">{profile.notfallkontakt}</div>
            </div>
          ) : null}
        </>
      ) : null}

      {initialProfileError ? (
        <p className="notfall-profile-status" role="status" aria-live="polite">
          {initialProfileError}
        </p>
      ) : null}

      {hasData ? (
        detailFields.length ? (
          <dl className="notfall-profile-list">
            {detailFields.map((f) => (
              <div key={f.key} className="notfall-profile-row">
                <dt className="notfall-profile-dt">{t(`emergency.fields.${f.key}`)}</dt>
                <dd className="notfall-profile-dd">{profile[f.key]}</dd>
              </div>
            ))}
          </dl>
        ) : null
      ) : (
        <p className="notfall-profile-empty">
          {t("emergency.profile.empty")}
        </p>
      )}
    </div>
  );
}

export function NotfallScreen(props) {
  const { t } = useAppState();
  const emergencyNumbers = EMERGENCY_NUMBERS.map((entry) => ({
    ...entry,
    label: t(`emergency.quick.${entry.key}.label`),
    description: t(`emergency.quick.${entry.key}.description`),
  }));

  return (
    <div className="app">
      <div className="app-header">
        <h1 className="app-title">{t("emergency.title")}</h1>
      </div>

      <div className="app-body">
        <div className="notfall-shell">
          <div className="notfall-stack">
            <section className="notfall-quick-section" aria-labelledby="notfall-sofort">

              <div className="notfall-quick-grid">
                {emergencyNumbers.map((entry) => (
                  <EmergencyCard key={entry.number} entry={entry} />
                ))}
              </div>
            </section>

            <section className="notfall-info-section" aria-labelledby="notfall-karte">
              <ProfileCard {...props} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
