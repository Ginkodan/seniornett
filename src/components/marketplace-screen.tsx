"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, MessageCircleMore, PackageOpen, PlusCircle } from "lucide-react";

import {
  createMarketplaceListingAction,
  deleteMarketplaceListingAction,
  getMarketplaceBootstrapAction,
  startMarketplaceConversationAction,
} from "@/app/actions/marketplace";
import type { MarketplaceBootstrap } from "@/lib/marketplace";
import { useAppState } from "./app-provider";
import { AppImage, Button, Card, EmptyState, LoadingState, ModalOverlay, SeniorNetPage, StatusPanel, TextAreaField, TextField } from "./ui";
import styles from "./marketplace-screen.module.css";

type StatusTone = "neutral" | "success" | "warning" | "error";

const CONDITIONS = ["Wie neu", "Gut erhalten", "Leicht gebraucht", "Bereit zum Mitnehmen"] as const;

function formatDate(value: string, localeTag: string) {
  return new Intl.DateTimeFormat(localeTag, {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

export function MarketplaceScreen() {
  const router = useRouter();
  const { t, localeTag } = useAppState();
  const [bootstrap, setBootstrap] = React.useState<MarketplaceBootstrap | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [contactingListingId, setContactingListingId] = React.useState("");
  const [deletingListingId, setDeletingListingId] = React.useState("");
  const [confirmDeleteListingId, setConfirmDeleteListingId] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("Alle");
  const [status, setStatus] = React.useState<{ tone: StatusTone; message: string } | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("Haushalt");
  const [conditionLabel, setConditionLabel] = React.useState<string>(CONDITIONS[1]);
  const [pickupArea, setPickupArea] = React.useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setStatus(null);

      try {
        const payload = await getMarketplaceBootstrapAction();

        if (!active) {
          return;
        }

        setBootstrap(payload);
        setCategory(payload.categories[1] || "Haushalt");
      } catch {
        if (!active) {
          return;
        }

        setStatus({
          tone: "error",
          message: t("marketplace.messages.loadError"),
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [t]);

  const categories = bootstrap?.categories ?? ["Alle"];
  const photoChoices = bootstrap?.photoChoices ?? [];

  const visibleListings = React.useMemo(() => {
    const sourceListings = bootstrap?.listings ?? [];

    if (activeCategory === "Alle") {
      return sourceListings;
    }

    return sourceListings.filter((listing) => listing.category === activeCategory);
  }, [activeCategory, bootstrap?.listings]);

  function resetCreateForm(nextCategory: string) {
    setTitle("");
    setDescription("");
    setCategory(nextCategory);
    setConditionLabel(CONDITIONS[1]);
    setPickupArea("");
    setSelectedPhotoIds([]);
  }

  function openCreate() {
    resetCreateForm(bootstrap?.categories[1] || "Haushalt");
    setStatus(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    if (!creating) {
      setCreateOpen(false);
    }
  }

  function togglePhoto(mediaItemId: string) {
    setSelectedPhotoIds((current) => {
      if (current.includes(mediaItemId)) {
        return current.filter((itemId) => itemId !== mediaItemId);
      }

      if (current.length >= 3) {
        return [...current.slice(1), mediaItemId];
      }

      return [...current, mediaItemId];
    });
  }

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setStatus(null);

    try {
      const payload = await createMarketplaceListingAction({
        title,
        description,
        category,
        conditionLabel,
        pickupArea,
        selectedPhotoIds,
      });

      setBootstrap(payload);
      setCreateOpen(false);
      setActiveCategory("Alle");
      setStatus({
        tone: "success",
        message: t("marketplace.messages.created"),
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : t("marketplace.messages.createError"),
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleContact(listingId: string) {
    setContactingListingId(listingId);
    setStatus(null);

    try {
      const target = await startMarketplaceConversationAction(listingId);
      router.push(`/social-hub?area=${target.area}&contact=${target.contactUserId}`);
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : t("marketplace.messages.contactError"),
      });
    } finally {
      setContactingListingId("");
    }
  }

  function openDeleteConfirm(listingId: string) {
    setConfirmDeleteListingId(listingId);
    setStatus(null);
  }

  function closeDeleteConfirm() {
    if (!deletingListingId) {
      setConfirmDeleteListingId("");
    }
  }

  async function handleDelete() {
    if (!confirmDeleteListingId) {
      return;
    }

    setDeletingListingId(confirmDeleteListingId);
    setStatus(null);

    try {
      const payload = await deleteMarketplaceListingAction(confirmDeleteListingId);
      setBootstrap(payload);
      setConfirmDeleteListingId("");
      setStatus({
        tone: "success",
        message: t("marketplace.messages.deleted"),
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : t("marketplace.messages.deleteError"),
      });
    } finally {
      setDeletingListingId("");
    }
  }

  return (
    <div className={styles.scope}>
      <SeniorNetPage
        title={t("marketplace.title")}
        subtitle={t("marketplace.subtitle")}
        primaryAction={
          <Button variant="primary" size="lg" icon={<PlusCircle size={22} strokeWidth={2.25} />} onClick={openCreate}>
            {t("marketplace.actions.create")}
          </Button>
        }
      >
        <div className={styles.introCard}>
          <Card as="section">
            <p className={styles.introText}>{t("marketplace.intro")}</p>
          </Card>
        </div>

        {status ? (
          <StatusPanel title={status.tone === "error" ? t("marketplace.messages.attention") : t("marketplace.messages.good")} tone={status.tone}>
            {status.message}
          </StatusPanel>
        ) : null}

        <div className={styles.filters} aria-label={t("marketplace.filters.aria")}>
          {categories.map((categoryName) => (
            <Button
              key={categoryName}
              variant={activeCategory === categoryName ? "selected" : "secondary"}
              onClick={() => setActiveCategory(categoryName)}
            >
              {categoryName === "Alle" ? t("marketplace.filters.all") : categoryName}
            </Button>
          ))}
        </div>

        {loading ? (
          <LoadingState title={t("marketplace.loading.title")}>{t("marketplace.loading.body")}</LoadingState>
        ) : visibleListings.length ? (
          <div className={styles.list}>
            {visibleListings.map((listing) => (
              <Card key={listing.id} as="article">
                <div className={styles.listingCard}>
                  <div className={styles.listingMedia}>
                    {listing.imagePreviews[0] ? (
                      <AppImage
                        src={listing.imagePreviews[0]}
                        alt={listing.title}
                        fill
                        className={styles.listingImage}
                        sizes="(max-width: 980px) 100vw, 50vw"
                      />
                    ) : (
                      <div className={styles.listingPlaceholder}>
                        <PackageOpen size={44} strokeWidth={2.1} />
                      </div>
                    )}
                  </div>

                  <div className={styles.listingBody}>
                    <div className={styles.listingMeta}>
                      <div className={styles.listingBadge}>{listing.category}</div>
                      <div className={styles.listingBadge}>{listing.conditionLabel}</div>
                      {listing.isOwn ? <div className={`${styles.listingBadge} ${styles.listingOwnBadge}`}>{t("marketplace.labels.own")}</div> : null}
                    </div>

                    <div>
                      <h2 className={styles.listingTitle}>{listing.title}</h2>
                      <p className={styles.listingDescription}>{listing.description}</p>
                    </div>

                    <div className={styles.listingDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>{t("marketplace.labels.from")}</span>
                        <span>{listing.ownerName}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>{t("marketplace.labels.place")}</span>
                        <span>{listing.pickupArea}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>{t("marketplace.labels.published")}</span>
                        <span>{formatDate(listing.createdAt, localeTag)}</span>
                      </div>
                    </div>

                    <div className={styles.listingActions}>
                      {listing.isOwn ? (
                        <>
                          <Button variant="quiet" icon={<Gift size={18} strokeWidth={2.2} />} disabled>
                            {t("marketplace.actions.ownListing")}
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => openDeleteConfirm(listing.id)}
                            disabled={deletingListingId === listing.id}
                          >
                            {deletingListingId === listing.id ? t("marketplace.actions.deleting") : t("marketplace.actions.delete")}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="primary"
                          icon={<MessageCircleMore size={20} strokeWidth={2.2} />}
                          onClick={() => handleContact(listing.id)}
                          disabled={contactingListingId === listing.id}
                        >
                          {contactingListingId === listing.id ? t("marketplace.actions.connecting") : t("marketplace.actions.contact")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title={t("marketplace.empty.title")}>{t("marketplace.empty.body")}</EmptyState>
        )}

        <ModalOverlay
          open={createOpen}
          title={t("marketplace.create.title")}
          eyebrow={t("marketplace.create.eyebrow")}
          closeLabel={t("common.close")}
          onClose={closeCreate}
        >
          <form className={styles.formBody} onSubmit={handleCreateSubmit}>
            <StatusPanel title={t("marketplace.create.helpTitle")}>
              {t("marketplace.create.helpBody")}
            </StatusPanel>

            <div className={styles.photoChooserHeader}>
              <h3 className={styles.chooserTitle}>{t("marketplace.create.photosTitle")}</h3>
              <p className={styles.chooserHint}>{t("marketplace.create.photosHint")}</p>
            </div>

            {photoChoices.length ? (
              <div className={styles.photoGrid}>
                {photoChoices.map((choice) => {
                  const selected = selectedPhotoIds.includes(choice.mediaItemId);

                  return (
                    <button
                      key={choice.mediaItemId}
                      type="button"
                      className={styles.photoButton}
                      onClick={() => togglePhoto(choice.mediaItemId)}
                      aria-pressed={selected}
                    >
                      <Card selected={selected} selectedLabel={t("common.selected")}>
                        <div className={styles.photoCard}>
                          <div className={styles.photoPreview}>
                            <AppImage src={choice.previewDataUrl} alt={choice.title} fill className={styles.photoPreviewImage} sizes="200px" />
                          </div>
                          <div className={styles.photoCaption}>{choice.title}</div>
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState title={t("marketplace.create.noPhotosTitle")}>
                {t("marketplace.create.noPhotosBody")}
                <div>
                  <Link className={styles.emptyLink} href="/fotos-papiere">
                    {t("marketplace.create.goToFiles")}
                  </Link>
                </div>
              </EmptyState>
            )}

            <div className={styles.fieldGrid}>
              <TextField label={t("marketplace.fields.title")} value={title} onChange={(event) => setTitle(event.target.value)} />
              <TextField label={t("marketplace.fields.pickupArea")} value={pickupArea} onChange={(event) => setPickupArea(event.target.value)} />
            </div>

            <TextAreaField
              label={t("marketplace.fields.description")}
              value={description}
              rows={4}
              onChange={(event) => setDescription(event.target.value)}
            />

            <div className={styles.filters} aria-label={t("marketplace.fields.category")}>
              {categories.filter((entry) => entry !== "Alle").map((categoryName) => (
                <Button
                  key={categoryName}
                  variant={category === categoryName ? "selected" : "secondary"}
                  onClick={() => setCategory(categoryName)}
                >
                  {categoryName}
                </Button>
              ))}
            </div>

            <div className={styles.filters} aria-label={t("marketplace.fields.condition")}>
              {CONDITIONS.map((entry) => (
                <Button
                  key={entry}
                  variant={conditionLabel === entry ? "selected" : "secondary"}
                  onClick={() => setConditionLabel(entry)}
                >
                  {entry}
                </Button>
              ))}
            </div>

            <div className={styles.modalActions}>
              <Button variant="quiet" onClick={closeCreate} disabled={creating}>
                {t("marketplace.actions.cancel")}
              </Button>
              <Button type="submit" variant="primary" icon={<Gift size={20} strokeWidth={2.25} />} disabled={creating}>
                {creating ? t("marketplace.actions.publishing") : t("marketplace.actions.publish")}
              </Button>
            </div>
          </form>
        </ModalOverlay>

        <ModalOverlay
          open={Boolean(confirmDeleteListingId)}
          title={t("marketplace.delete.title")}
          eyebrow={t("marketplace.delete.eyebrow")}
          closeLabel={t("common.close")}
          onClose={closeDeleteConfirm}
        >
          <div className={styles.formBody}>
            <StatusPanel title={t("marketplace.delete.helpTitle")} tone="warning">
              {t("marketplace.delete.helpBody")}
            </StatusPanel>
            <div className={styles.modalActions}>
              <Button variant="quiet" onClick={closeDeleteConfirm} disabled={Boolean(deletingListingId)}>
                {t("marketplace.actions.cancel")}
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={Boolean(deletingListingId)}>
                {deletingListingId ? t("marketplace.actions.deleting") : t("marketplace.actions.deleteNow")}
              </Button>
            </div>
          </div>
        </ModalOverlay>
      </SeniorNetPage>
    </div>
  );
}
