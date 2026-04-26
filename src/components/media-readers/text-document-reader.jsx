"use client";

import React from "react";
import { LoaderCircle } from "lucide-react";

import { getMediaReaderDescriptorAction } from "@/app/actions/media";

export function TextDocumentReader({ item, t }) {
  const [state, setState] = React.useState({ loading: true, pages: [], failed: false });

  React.useEffect(() => {
    let active = true;

    getMediaReaderDescriptorAction(item.id)
      .then((payload) => {
        if (!active) return;
        if (payload.readerKind !== "text" || !Array.isArray(payload.textPages) || !payload.textPages.length) {
          setState({ loading: false, pages: [], failed: true });
          return;
        }
        setState({ loading: false, pages: payload.textPages, failed: false });
      })
      .catch(() => {
        if (active) setState({ loading: false, pages: [], failed: true });
      });

    return () => {
      active = false;
    };
  }, [item.id]);

  const text = state.pages.join("\n\n");

  if (state.loading) {
    return (
      <div className="focus-reader-loading">
        <LoaderCircle size={24} className="spin" />
      </div>
    );
  }

  if (state.failed || !text) {
    return <div className="focus-reader-fallback">{t("media.reader.textError")}</div>;
  }

  return (
    <article className="focus-text-document-reader">
      <h3>{item.title}</h3>
      <div>{text}</div>
    </article>
  );
}
