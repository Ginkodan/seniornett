"use client";

import React from "react";
import { FileImage, FileText, LoaderCircle, Users, Image as ImageIcon } from "lucide-react";

import { getMediaBootstrap, searchMediaItemsAction, uploadMediaItemAction } from "@/app/actions/media";
import { useAppState } from "./app-provider.jsx";

const EMPTY_ARRAY = [];
const COLLECTION_NAME_KEYS = {
  "Eingangskorb": "inbox",
  "Fotoalbum": "photoAlbum",
  "Papiermappe": "paperBinder",
  "Gesundheit": "health",
  "Versicherung": "insurance",
  "Geld & Rechnungen": "moneyBills",
  "Wohnen": "housing",
  "Reisen": "travel",
  "Notfall": "emergency",
};

function translateCollectionName(name, t) {
  const key = COLLECTION_NAME_KEYS[name];
  return key ? t(`media.collections.${key}`) : name;
}

function translateCollectionNames(names, t) {
  return names.map((name) => translateCollectionName(name, t));
}

function formatDate(value, localeTag) {
  if (!value) return "";
  return new Intl.DateTimeFormat(localeTag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function Preview({ item }) {
  if (!item) {
    return (
      <div className="media-detail-preview">
        <div className="media-card-placeholder">
          <FileImage size={42} strokeWidth={1.8} />
        </div>
      </div>
    );
  }

  if (item.previewDataUrl && item.kind === "photo") {
    return (
      <div className="media-detail-preview">
        <img src={item.previewDataUrl} alt={item.title} />
      </div>
    );
  }

  if (item.previewDataUrl && item.mimeType === "application/pdf") {
    return (
      <div className="media-detail-preview">
        <object data={item.previewDataUrl} type={item.mimeType} aria-label={item.title}>
          <div className="media-document-fallback">{item.title}</div>
        </object>
      </div>
    );
  }

  return (
    <div className="media-detail-preview">
      <div className="media-card-placeholder">
        <FileText size={42} strokeWidth={1.8} />
      </div>
    </div>
  );
}

function MediaCard({ item, active, onClick, t, localeTag }) {
  const translatedCollections = translateCollectionNames(item.collections, t);
  const meta = [item.sourcePersonName ? `${t("media.card.from")} ${item.sourcePersonName}` : "", formatDate(item.receivedAt, localeTag)]
    .filter(Boolean)
    .join(" · ");

  return (
    <button type="button" className={`media-card-item ${active ? "active" : ""}`} onClick={onClick}>
      <div className="media-card-preview">
        {item.previewDataUrl && item.kind === "photo" ? (
          <img src={item.previewDataUrl} alt={item.title} />
        ) : (
          <div className="media-card-placeholder">{item.kind === "document" ? <FileText size={30} /> : <ImageIcon size={30} />}</div>
        )}
      </div>
      <div className="media-card-body">
        <div className="media-card-title">{item.title}</div>
        <div className="media-card-meta">{meta}</div>
        {translatedCollections.length ? <div className="media-card-meta">{translatedCollections.join(" · ")}</div> : null}
      </div>
    </button>
  );
}

export function FotosPapiereScreen() {
  const { t, localeTag } = useAppState();
  const [bootstrap, setBootstrap] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedOwnerId, setSelectedOwnerId] = React.useState("");
  const [selectedCollectionId, setSelectedCollectionId] = React.useState("all");
  const [selectedItemId, setSelectedItemId] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");
  const [searchResults, setSearchResults] = React.useState(null);
  const [status, setStatus] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [uploadOverlayOpen, setUploadOverlayOpen] = React.useState(false);

  const owners = bootstrap?.owners ?? EMPTY_ARRAY;
  const collections = bootstrap?.collections ?? EMPTY_ARRAY;
  const items = bootstrap?.items ?? EMPTY_ARRAY;
  const canChooseOwners = bootstrap?.user?.role === "caregiver" || bootstrap?.user?.role === "admin";
  const selectedOwner = owners.find((owner) => owner.id === selectedOwnerId) || owners[0] || null;

  const selectedCollection =
    selectedCollectionId === "all" ? null : collections.find((collection) => collection.id === selectedCollectionId) || null;
  const selectedCollectionLabel = selectedCollection ? translateCollectionName(selectedCollection.name, t) : "";

  const filteredItems = React.useMemo(() => {
    let nextItems = searchResults || items;

    if (selectedCollectionId !== "all") {
      const activeCollection = collections.find((collection) => collection.id === selectedCollectionId);
      const activeCollectionName = activeCollection?.name || selectedCollectionId;
      nextItems = nextItems.filter((item) => item.collections.includes(activeCollectionName));
    }

    return nextItems;
  }, [collections, items, searchResults, selectedCollectionId]);

  const selectedItem = filteredItems.find((item) => item.id === selectedItemId) || filteredItems[0] || null;

  const reloadBootstrap = React.useCallback(async (ownerId) => {
    setLoading(true);
    try {
      const payload = await getMediaBootstrap(ownerId || undefined);
      setBootstrap(payload);
      setSelectedOwnerId(payload.selectedOwnerId || "");
      setSelectedCollectionId("all");
      setSelectedItemId(payload.items[0]?.id || "");
      setSearchResults(null);
      setStatus("");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;

    void (async () => {
      const payload = await getMediaBootstrap();
      if (!active) return;

      setBootstrap(payload);
      setSelectedOwnerId(payload.selectedOwnerId || "");
      setSelectedCollectionId("all");
      setSelectedItemId(payload.items[0]?.id || "");
      setSearchResults(null);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleOwnerSelect(ownerId) {
    if (ownerId === selectedOwnerId) return;
    await reloadBootstrap(ownerId);
  }

  function openUploadOverlay() {
    setUploadOverlayOpen(true);
  }

  function closeUploadOverlay() {
    if (uploading) {
      return;
    }

    setUploadOverlayOpen(false);
  }

  async function handleSearchSubmit(event) {
    event.preventDefault();
    const trimmed = searchInput.trim();

    if (!trimmed) {
      setSearchResults(null);
      setStatus("");
      setSelectedItemId(items[0]?.id || "");
      return;
    }

    try {
      const matches = await searchMediaItemsAction(selectedOwnerId, trimmed);
      if (!matches.length) {
        setSearchResults([]);
        setStatus(t("media.search.error"));
        return;
      }

      setSearchResults(matches);
      setSelectedItemId(matches[0].id);
      setStatus(`Ich habe ${matches.length} passende Sachen gefunden.`);
    } catch {
      setSearchResults([]);
      setStatus(t("media.search.error"));
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("ownerUserId", selectedOwnerId || bootstrap?.selectedOwnerId || "");

    setUploading(true);
    setStatus("");

    try {
      await uploadMediaItemAction(formData);
      form.reset();
      setSearchInput("");
      setSearchResults(null);
      await reloadBootstrap(selectedOwnerId || bootstrap?.selectedOwnerId || undefined);
      setStatus("Etwas Neues ist angekommen.");
      setUploadOverlayOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("media.upload.error"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="app">
      <div className="app-header media-header">
        <div className="media-header-copy">
          <h1 className="app-title">{t("media.title")}</h1>
        </div>
      </div>

      <div className="app-body">
        <div className="media-shell">
          <section className="media-hero">
            <form className="media-hero-actions media-searchbox" onSubmit={handleSearchSubmit}>
              <label className="sr-only" htmlFor="media-helper-search">
                {t("media.search.placeholder")}
              </label>
              <input
                id="media-helper-search"
                className="field media-helper-input"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("media.search.placeholder")}
              />
              <button type="submit" className="btn btn-primary media-helper-submit">
                {t("media.search.submit")}
              </button>
            </form>
          </section>

          {canChooseOwners ? (
            <section className="media-filter-block" aria-label={t("media.upload.owner")}>
              <div className="media-filter-row">
                <div className="media-filter-label">{t("media.upload.owner")}</div>
                <button type="button" className="btn media-upload-launch" onClick={openUploadOverlay}>
                  {t("media.upload.submit")}
                </button>
              </div>
              <div className="media-collections">
                {owners.map((owner) => (
                  <button
                    key={owner.id}
                    type="button"
                    className={`media-collection-chip ${owner.id === selectedOwnerId ? "active" : ""}`}
                    onClick={() => void handleOwnerSelect(owner.id)}
                  >
                    <Users size={18} />
                    <span>{owner.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {status ? <div className="media-warning" role="status">{status}</div> : null}

          <div className="media-main">
            <section className="media-list">
              <div className="media-filter-block">
                <div className="media-filter-label">{t("media.filters.collections")}</div>
                <div className="media-collections">
                  <button
                    type="button"
                    className={`media-collection-chip ${selectedCollectionId === "all" ? "active" : ""}`}
                    onClick={() => setSelectedCollectionId("all")}
                  >
                    <span>{t("media.filters.all")}</span>
                    <strong>{items.length}</strong>
                  </button>
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      type="button"
                      className={`media-collection-chip ${selectedCollectionId === collection.id ? "active" : ""}`}
                      onClick={() => setSelectedCollectionId(collection.id)}
                    >
                      <span>{translateCollectionName(collection.name, t)}</span>
                      <strong>{collection.count}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <div className="media-search-summary">
                {filteredItems.length
                  ? `${filteredItems.length} ${
                      selectedCollectionId === "all" ? t("media.filters.allSummary") : selectedCollectionLabel || "Treffer"
                    }`
                  : t("media.list.empty")}
              </div>

              {loading ? (
                <div className="media-empty">
                  <LoaderCircle size={18} className="spin" /> {t("common.loading")}
                </div>
              ) : filteredItems.length ? (
                <div className="media-grid">
                  {filteredItems.map((item) => (
                    <MediaCard
                      key={item.id}
                      item={item}
                      active={selectedItem?.id === item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      t={t}
                      localeTag={localeTag}
                    />
                  ))}
                </div>
              ) : (
                <div className="media-empty">{t("media.list.empty")}</div>
              )}
            </section>

            <section className="media-detail">
              <div className="media-upload-head">
                <div>
                  <div className="tile-sub">{t("media.detail.eyebrow")}</div>
                  <h2 className="app-title">{selectedItem ? selectedItem.title : t("media.detail.empty")}</h2>
                </div>
              </div>

              <Preview item={selectedItem} />

              <div className="media-detail-body">
                {selectedItem ? (
                  <>
                    <p className="media-detail-copy">
                      {selectedItem.kind === "photo" ? t("media.detail.photoNote") : t("media.detail.documentNote")}
                    </p>
                    <dl className="media-detail-list">
                      <div>
                        <dt>{t("media.detail.from")}</dt>
                        <dd>{selectedItem.sourcePersonName || t("media.card.unknownSender")}</dd>
                      </div>
                      <div>
                        <dt>{t("media.detail.received")}</dt>
                        <dd>{formatDate(selectedItem.receivedAt, localeTag)}</dd>
                      </div>
                      <div>
                        <dt>{t("media.detail.where")}</dt>
                        <dd>{selectedItem.collections.join(" · ") || "-"}</dd>
                      </div>
                      <div>
                        <dt>{t("media.detail.labels")}</dt>
                        <dd>{selectedItem.labels.join(" · ") || "-"}</dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <div className="media-empty">{t("media.detail.empty")}</div>
                )}
              </div>
            </section>
          </div>

          {canChooseOwners && uploadOverlayOpen ? (
            <div className="media-upload-overlay" role="dialog" aria-modal="true" aria-label={t("media.upload.title")}>
              <div className="media-upload-overlay-backdrop" onClick={closeUploadOverlay} aria-hidden="true" />
              <section className="media-upload media-upload-panel">
                <div className="media-upload-head">
                  <div>
                    <div className="tile-sub">{t("media.upload.eyebrow")}</div>
                    <h2 className="app-title">{t("media.upload.title")}</h2>
                    {selectedOwner ? <div className="media-upload-owner">{selectedOwner.name}</div> : null}
                  </div>
                  <button type="button" className="btn" onClick={closeUploadOverlay} disabled={uploading}>
                    {t("common.close")}
                  </button>
                </div>

                <form className="media-upload-grid" onSubmit={handleUpload}>
                  <input type="hidden" name="ownerUserId" value={selectedOwnerId} />

                  <label className="media-field">
                    <span>{t("media.upload.titleField")}</span>
                    <input className="field" name="title" placeholder={t("media.upload.titlePlaceholder")} />
                  </label>

                  <label className="media-field">
                    <span>{t("media.upload.category")}</span>
                    <select className="field" name="collectionId" defaultValue="">
                      <option value="">{t("media.upload.categoryEmpty")}</option>
                      {collections.map((collection) => (
                        <option key={collection.id} value={collection.id}>
                          {translateCollectionName(collection.name, t)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="media-field">
                    <span>{t("media.upload.labels")}</span>
                    <input className="field" name="labels" placeholder={t("media.upload.labelsPlaceholder")} />
                  </label>

                  <label className="media-field">
                    <span>{t("media.upload.summary")}</span>
                    <input className="field" name="summary" placeholder={t("media.upload.summaryPlaceholder")} />
                  </label>

                  <label className="media-field media-field-file">
                    <span>{t("media.upload.file")}</span>
                    <input className="field media-file-input" name="file" type="file" accept="image/*,application/pdf,.doc,.docx,.gif" />
                  </label>

                  <label className="media-field media-field-file">
                    <span>{t("media.upload.description")}</span>
                    <textarea className="field" name="description" placeholder={t("media.upload.descriptionPlaceholder")} rows={3} />
                  </label>

                  <div className="media-upload-actions media-field-file">
                    <button type="submit" className="btn btn-primary" disabled={uploading}>
                      {uploading ? (
                        <>
                          <LoaderCircle size={18} className="spin" />
                          {t("media.upload.saving")}
                        </>
                      ) : (
                        t("media.upload.submit")
                      )}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
