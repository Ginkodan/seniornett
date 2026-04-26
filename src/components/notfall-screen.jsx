"use client";

import React from "react";
import { PhoneCall } from "lucide-react";
import { PROFILE_FIELDS, normalizeProfile } from "@/lib/profile";

const EMERGENCY_NUMBERS = [
  {
    number: "117",
    label: "Polizei",
    description: "Sicherheit",
  },
  {
    number: "118",
    label: "Feuerwehr",
    description: "Brand & Rettung",
  },
  {
    number: "144",
    label: "Ambulanz / Sanität",
    description: "Medizin",
  },
];

const PROFILE_SUMMARY_FIELDS = [
  { key: "geburtsdatum", label: "Geboren" },
  { key: "blutgruppe", label: "Blutgruppe" },
  { key: "notfallkontakt", label: "Kontakt" },
];

const PROFILE_PRIORITY_FIELDS = new Set(PROFILE_SUMMARY_FIELDS.map((field) => field.key));

function EmergencyCard({ entry }) {
  return (
    <a
      href={`tel:${entry.number}`}
      className="notfall-quick-card"
      aria-label={`${entry.label} anrufen – ${entry.number}`}
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
          <div className="notfall-profile-eyebrow">Medizinische Angaben</div>
          <h2 className="notfall-profile-title">{displayName || "Notfallkarte"}</h2>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="notfall-profile-summary" aria-label="Wichtige Eckdaten">
            {PROFILE_SUMMARY_FIELDS.filter((field) => profile[field.key] && field.key !== "notfallkontakt").map((field) => (
              <div key={field.key} className="notfall-profile-pill">
                <span className="notfall-profile-pill-label">{field.label}</span>
                <span className="notfall-profile-pill-value">{profile[field.key]}</span>
              </div>
            ))}
          </div>

          {profile.notfallkontakt ? (
            <div className="notfall-profile-contact">
              <div className="notfall-profile-contact-label">Notfallkontakt</div>
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
                <dt className="notfall-profile-dt">{f.label}</dt>
                <dd className="notfall-profile-dd">{profile[f.key]}</dd>
              </div>
            ))}
          </dl>
        ) : null
      ) : (
        <p className="notfall-profile-empty">
          Für diese Person sind im Moment keine medizinischen Angaben hinterlegt.
        </p>
      )}
    </div>
  );
}

export function NotfallScreen(props) {
  return (
    <div className="app">
      <div className="app-header">
        <h1 className="app-title">Notfall</h1>
      </div>

      <div className="app-body">
        <div className="notfall-shell">
          <div className="notfall-stack">
            <section className="notfall-quick-section" aria-labelledby="notfall-sofort">

              <div className="notfall-quick-grid">
                {EMERGENCY_NUMBERS.map((entry) => (
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
