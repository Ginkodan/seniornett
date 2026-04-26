"use client";

function metadataRows(item, t, formatDate, localeTag, translateCollectionName) {
  const rows = [];
  const warmLabels = item.labels.filter((label) => !/^(pdf|docx?|odt|png|jpe?g|gif|webp)$/i.test(label));

  if (item.sourcePersonName) {
    rows.push([t("media.detail.from"), item.sourcePersonName]);
  } else {
    rows.push([t("media.detail.from"), t("media.card.unassigned")]);
  }

  if (item.receivedAt) {
    rows.push([t("media.detail.received"), formatDate(item.receivedAt, localeTag)]);
  }

  if (item.collections.length) {
    rows.push([t("media.detail.where"), item.collections.map((name) => translateCollectionName(name, t)).join(" · ")]);
  }

  if (warmLabels.length) {
    rows.push([t("media.detail.labels"), warmLabels.join(" · ")]);
  }

  return rows;
}

export function ReaderMetadataAside({ item, t, localeTag, formatDate, translateCollectionName }) {
  const rows = metadataRows(item, t, formatDate, localeTag, translateCollectionName);
  const note = item.plainDescription || item.plainSummary || "";

  return (
    <aside className="reader-metadata-aside" aria-label={t("media.detail.info")}>
      {note ? (
        <section className="reader-metadata-note">
          <h3>{t("media.detail.noteFromNina")}</h3>
          <p>{note}</p>
        </section>
      ) : null}

      <dl className="reader-metadata-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
