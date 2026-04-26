// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import { Eye, FileImage, FileText, LoaderCircle, Users } from "lucide-react";

import { getMediaBootstrap, searchMediaItemsAction, uploadMediaItemAction } from "@/app/actions/media";
import { AppImage, ModalOverlay } from "./ui";
import { MediaFocusViewer } from "./media-readers/media-focus-viewer";
import { useAppState } from "./app-provider";
import styles from "./fotos-papiere-screen.module.css";

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

function formatDate(value, localeTag) {
  if (!value) return "";
  return new Intl.DateTimeFormat(localeTag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getCardSenderLabel(item, localeTag, t) {
  if (item.sourcePersonName) {
    return `${t("media.card.from")} ${item.sourcePersonName}`;
  }

  return formatDate(item.receivedAt, localeTag);
}

function getCardPurposeLabel(item, t) {
  if (item.kind === "photo") {
    const warmLabels = item.labels.filter((label) => !/^(pdf|docx?|odt|png|jpe?g|gif|webp)$/i.test(label));
    const label = warmLabels.slice(0, 2).join(" · ") || item.collections.find((name) => name !== "Eingangskorb" && name !== "Fotoalbum");
    return label ? translateCollectionName(label, t) : t("media.collections.photoAlbum");
  }

  const category = item.collections.find((name) => ["Notfall", "Gesundheit", "Versicherung", "Geld & Rechnungen", "Wohnen", "Reisen"].includes(name));
  if (category) {
    if (category === "Notfall") {
      return `${translateCollectionName(category, t)}-Papier`;
    }
    return `${translateCollectionName(category, t)}-Papier`;
  }

  return t("media.collections.paperBinder");
}

function DocumentVisual({ item, variant }) {
  const isPdf = item.mimeType === "application/pdf";
  const badge = "Papier";
  const summary = item.plainSummary || item.plainDescription || "Papier";
  const previewText = item.previewText || item.plainDescription || summary;

  if (variant === "compact") {
    return (
      <div className="media-card-document-compact">
        {item.previewDataUrl ? (
          <AppImage src={item.previewDataUrl} alt={item.title} className="media-card-document-compact-preview" width={240} height={240} />
        ) : (
          <div className="media-card-document-compact-preview media-card-document-compact-icon">
            <FileText size={30} strokeWidth={1.8} />
          </div>
        )}
      </div>
    );
  }

  if (isPdf) {
    return item.previewDataUrl ? (
      <div className="media-pdf-sheet">
        <AppImage src={item.previewDataUrl} alt={item.title} className="media-pdf-image" width={900} height={1200} />
      </div>
    ) : (
      <div className="media-pdf-sheet">
        <div className="media-pdf-fallback">
          <FileText size={40} strokeWidth={1.8} />
          <div>{item.title}</div>
          <div>{summary}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="media-document-sheet">
      <div className="media-document-sheet-head">
        <div className="media-document-badge">{badge}</div>
        <div>
          <div className="media-document-title">{item.title}</div>
          <div className="media-document-summary">{summary}</div>
        </div>
      </div>
      <div className="media-document-sheet-body">
        <div className="media-document-paper">
          <div className="media-document-paper-title">{item.title}</div>
          <div className="media-document-paper-text">{previewText}</div>
          {item.labels.length ? <div className="media-document-tags">{item.labels.join(" · ")}</div> : null}
        </div>
      </div>
    </div>
  );
}

function MediaPreview({ item, variant = "viewer" }) {
  if (!item) {
    return <div className="media-card-placeholder"><FileImage size={42} strokeWidth={1.8} /></div>;
  }

  if (item.previewDataUrl && item.kind === "photo") {
    return <AppImage src={item.previewDataUrl} alt={item.title} width={900} height={675} />;
  }

  if (item.mimeType === "application/pdf") {
    return <DocumentVisual item={item} variant={variant === "card" ? "card" : "viewer"} />;
  }

  if (item.kind === "document") {
    return <DocumentVisual item={item} variant={variant === "card" ? "card" : "viewer"} />;
  }

  return <div className="media-card-placeholder"><FileImage size={42} strokeWidth={1.8} /></div>;
}

function MediaCard({ item, active, onSelect, onOpen, t, localeTag }) {
  const cardSender = getCardSenderLabel(item, localeTag, t);
  const cardPurpose = getCardPurposeLabel(item, t);

  return (
    <article className={`media-card-item ${item.kind === "photo" ? "media-card-photo" : "media-card-document-card"} ${active ? "active" : ""}`}>
      <button type="button" className="media-card-main" onClick={onSelect}>
        {item.kind === "photo" ? (
          <>
            <div className="media-card-photo-preview">
              <MediaPreview item={item} variant="card" />
            </div>
            <div className="media-card-body media-card-photo-body">
              <div className="media-card-title">{item.title}</div>
              <div className="media-card-meta">{cardSender}</div>
              <div className="media-card-purpose">{cardPurpose}</div>
            </div>
          </>
        ) : (
          <div className="media-card-document-main">
            <div className="media-card-document-left">
              <DocumentVisual item={item} variant="compact" />
            </div>
            <div className="media-card-document-right">
              <div className="media-card-title">{item.title}</div>
              <div className="media-card-meta">{cardSender}</div>
              <div className="media-card-purpose">{cardPurpose}</div>
            </div>
          </div>
        )}
      </button>
      <div className="media-card-actions">
        <button type="button" className="btn btn-primary media-card-action media-card-action-card" onClick={onOpen}>
          <Eye size={18} />
          {t("media.actions.view")}
        </button>
      </div>
    </article>
  );
}

export function FotosPapiereScreen() {
  const { t, localeTag } = useAppState();
  const [bootstrap, setBootstrap] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedOwnerId, setSelectedOwnerId] = React.useState("");
  const [selectedCollectionId, setSelectedCollectionId] = React.useState("all");
  const [selectedItemId, setSelectedItemId] = React.useState("");
  const [viewerItemId, setViewerItemId] = React.useState("");
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
  const viewerItem = items.find((item) => item.id === viewerItemId) || null;

  const selectedCollection =
    selectedCollectionId === "all" ? null : collections.find((collection) => collection.id === selectedCollectionId) || null;
  const selectedCollectionLabel = selectedCollection ? translateCollectionName(selectedCollection.name, t) : "";
  const photoAlbumCollection = collections.find((collection) => collection.name === "Fotoalbum") || null;
  const paperBinderCollection = collections.find((collection) => collection.name === "Papiermappe") || null;
  const emergencyCollection = collections.find((collection) => collection.name === "Notfall") || null;
  const paperBinderCount = items.filter((item) => item.kind === "document" || item.collections.includes("Papiermappe")).length;
  const photoCount = items.filter((item) => item.kind === "photo" || item.collections.includes("Fotoalbum")).length;
  const emergencyCount = items.filter((item) => item.collections.includes("Notfall")).length;

  const filteredItems = React.useMemo(() => {
    let nextItems = searchResults || items;

    if (selectedCollectionId !== "all") {
      const activeCollection = collections.find((collection) => collection.id === selectedCollectionId);
      const activeCollectionName = activeCollection?.name || selectedCollectionId;

      if (activeCollectionName === "Papiermappe") {
        nextItems = nextItems.filter((item) => item.kind === "document" || item.collections.includes("Papiermappe"));
      } else if (activeCollectionName === "Fotoalbum") {
        nextItems = nextItems.filter((item) => item.kind === "photo" || item.collections.includes("Fotoalbum"));
      } else if (activeCollectionName === "Notfall") {
        nextItems = nextItems.filter((item) => item.collections.includes("Notfall"));
      } else {
        nextItems = nextItems.filter((item) => item.collections.includes(activeCollectionName));
      }
    }

    return nextItems;
  }, [collections, items, searchResults, selectedCollectionId]);

  const reloadBootstrap = React.useCallback(async (ownerId) => {
    setLoading(true);
    try {
      const payload = await getMediaBootstrap(ownerId || undefined);
      setBootstrap(payload);
      setSelectedOwnerId(payload.selectedOwnerId || "");
      setSelectedCollectionId("all");
      setSelectedItemId(payload.items[0]?.id || "");
      setViewerItemId("");
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
      setViewerItemId("");
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

  function openViewer(item) {
    setSelectedItemId(item.id);
    setViewerItemId(item.id);
  }

  function closeViewer() {
    setViewerItemId("");
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
    <div className={`${styles.scope} app`}>
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
                  <button
                    type="button"
                    className={`media-collection-chip ${selectedCollectionId === photoAlbumCollection?.id ? "active" : ""}`}
                    onClick={() => {
                      if (photoAlbumCollection) setSelectedCollectionId(photoAlbumCollection.id);
                    }}
                  >
                    <span>{t("media.collections.photoAlbum")}</span>
                    <strong>{photoCount}</strong>
                  </button>
                  <button
                    type="button"
                    className={`media-collection-chip ${selectedCollectionId === paperBinderCollection?.id ? "active" : ""}`}
                    onClick={() => {
                      if (paperBinderCollection) setSelectedCollectionId(paperBinderCollection.id);
                    }}
                  >
                    <span>{t("media.collections.paperBinder")}</span>
                    <strong>{paperBinderCount}</strong>
                  </button>
                  <button
                    type="button"
                    className={`media-collection-chip ${selectedCollectionId === emergencyCollection?.id ? "active" : ""}`}
                    onClick={() => {
                      if (emergencyCollection) setSelectedCollectionId(emergencyCollection.id);
                    }}
                  >
                    <span>{t("media.collections.emergency")}</span>
                    <strong>{emergencyCount}</strong>
                  </button>
                </div>
              </div>

              <div className="media-list-heading">
                {selectedCollectionId === "all"
                  ? "Alle Fotos und Papiere"
                  : selectedCollectionLabel || t("media.list.title")}
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
                      active={selectedItemId === item.id}
                      onSelect={() => setSelectedItemId(item.id)}
                      onOpen={() => openViewer(item)}
                      t={t}
                      localeTag={localeTag}
                    />
                  ))}
                </div>
              ) : (
                <div className="media-empty">{t("media.list.empty")}</div>
              )}
            </section>
          </div>

          <ModalOverlay
            open={canChooseOwners && uploadOverlayOpen}
            eyebrow={t("media.upload.eyebrow")}
            title={t("media.upload.title")}
            closeLabel={t("common.close")}
            onClose={closeUploadOverlay}
            className="media-upload-panel"
          >
            <div className="media-upload-owner-wrap">{selectedOwner ? <div className="media-upload-owner">{selectedOwner.name}</div> : null}</div>
            <p className="media-upload-help">{t("media.upload.help")}</p>

            <form className="media-upload-grid" onSubmit={handleUpload}>
              <input type="hidden" name="ownerUserId" value={selectedOwnerId} />

              <label className="media-field">
                <span>{t("media.upload.titleField")}</span>
                <input className="field" name="title" placeholder={t("media.upload.titlePlaceholder")} />
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
                <input className="field media-file-input" name="file" type="file" accept="image/*,application/pdf,.doc,.docx,.odt,.gif,.webp" />
              </label>

              <label className="media-field media-field-file">
                <span>{t("media.upload.description")}</span>
                <textarea className="field" name="description" placeholder={t("media.upload.descriptionPlaceholder")} rows={3} />
              </label>

              <label className="media-field media-field-check">
                <input className="media-checkbox" name="isEmergency" type="checkbox" value="1" />
                <span>{t("media.upload.emergency")}</span>
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
          </ModalOverlay>

          <MediaFocusViewer
            open={Boolean(viewerItem)}
            item={viewerItem}
            closeLabel={t("common.close")}
            onClose={closeViewer}
            t={t}
            localeTag={localeTag}
            formatDate={formatDate}
            translateCollectionName={translateCollectionName}
          />
        </div>
      </div>
    </div>
  );
}
