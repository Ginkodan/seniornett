"use client";

import { ModalOverlay } from "../modal-overlay.jsx";
import { ImageReader } from "./image-reader.jsx";
import { PdfReader } from "./pdf-reader.jsx";
import { ReaderMetadataAside } from "./reader-metadata-aside.jsx";
import { TextDocumentReader } from "./text-document-reader.jsx";

function isTextDocument(item) {
  return [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text",
  ].includes(item.mimeType);
}

function ReaderForItem({ item, t }) {
  if (item.kind === "photo" || item.mimeType.startsWith("image/")) {
    return <ImageReader item={item} />;
  }

  if (item.mimeType === "application/pdf") {
    return <PdfReader item={item} t={t} />;
  }

  if (isTextDocument(item)) {
    return <TextDocumentReader item={item} t={t} />;
  }

  return (
    <div className="focus-reader-fallback">
      {t("media.reader.unsupported")}
    </div>
  );
}

export function MediaFocusViewer({ open, item, closeLabel, onClose, t, localeTag, formatDate, translateCollectionName }) {
  return (
    <ModalOverlay
      open={open}
      eyebrow={null}
      title={item?.title || t("media.detail.empty")}
      closeLabel={closeLabel}
      onClose={onClose}
      className="media-focus-panel"
    >
      {item ? (
        <div className="media-focus-layout">
          <main className="media-focus-reader-region">
            <ReaderForItem key={item.id} item={item} t={t} />
          </main>
          <ReaderMetadataAside
            item={item}
            t={t}
            localeTag={localeTag}
            formatDate={formatDate}
            translateCollectionName={translateCollectionName}
          />
        </div>
      ) : null}
    </ModalOverlay>
  );
}
