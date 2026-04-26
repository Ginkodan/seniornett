// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import { LoaderCircle } from "lucide-react";

import { getMediaPdfPageDataUrlAction, getMediaReaderDescriptorAction } from "@/app/actions/media";
import { AppImage } from "../ui";

function PdfPageImage({ itemId, pageNumber, pageCount, t }) {
  const [state, setState] = React.useState({ loading: true, dataUrl: "", failed: false });

  React.useEffect(() => {
    let active = true;

    getMediaPdfPageDataUrlAction(itemId, pageNumber)
      .then((payload) => {
        if (active) setState({ loading: false, dataUrl: payload.dataUrl, failed: false });
      })
      .catch(() => {
        if (active) setState({ loading: false, dataUrl: "", failed: true });
      });

    return () => {
      active = false;
    };
  }, [itemId, pageNumber]);

  if (state.loading) {
    return <div className="focus-reader-page-loading" />;
  }

  if (state.failed || !state.dataUrl) {
    return <div className="focus-reader-fallback">{t("media.reader.pdfError")}</div>;
  }

  return (
    <section className="focus-pdf-page">
      <div className="focus-pdf-page-label">{t("media.reader.pageIndicator", { page: pageNumber, count: pageCount })}</div>
      <AppImage
        src={state.dataUrl}
        alt={t("media.reader.pageIndicator", { page: pageNumber, count: pageCount })}
        className="focus-pdf-page-image"
        width={1200}
        height={1600}
      />
    </section>
  );
}

export function PdfReader({ item, t }) {
  const [state, setState] = React.useState({ loading: true, pageCount: 0, failed: false });

  React.useEffect(() => {
    let active = true;

    getMediaReaderDescriptorAction(item.id)
      .then((payload) => {
        if (!active) return;
        if (payload.readerKind !== "pdf" || !payload.pageCount) {
          setState({ loading: false, pageCount: 0, failed: true });
          return;
        }
        setState({ loading: false, pageCount: payload.pageCount, failed: false });
      })
      .catch(() => {
        if (active) setState({ loading: false, pageCount: 0, failed: true });
      });

    return () => {
      active = false;
    };
  }, [item.id]);

  const pages = Array.from({ length: state.pageCount }, (_, index) => ({
    key: `${item.id}-${index + 1}`,
    pageNumber: index + 1,
  }));

  if (state.loading) {
    return (
      <div className="focus-reader-loading">
        <LoaderCircle size={24} className="spin" />
      </div>
    );
  }

  if (state.failed || !pages.length) {
    return <div className="focus-reader-fallback">{t("media.reader.pdfError")}</div>;
  }

  return (
    <div className="focus-pdf-scroll-reader" aria-label={item.title}>
      {pages.map((page) => (
        <PdfPageImage key={page.key} itemId={item.id} pageNumber={page.pageNumber} pageCount={state.pageCount} t={t} />
      ))}
    </div>
  );
}
