// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import { LoaderCircle } from "lucide-react";

import { getMediaImageDataUrlAction } from "@/app/actions/media";
import { AppImage } from "../ui";

export function ImageReader({ item }) {
  const [state, setState] = React.useState(() => ({
    loading: !item.previewDataUrl,
    dataUrl: item.previewDataUrl || "",
    failed: false,
  }));

  React.useEffect(() => {
    let active = true;

    if (item.previewDataUrl) {
      return () => {
        active = false;
      };
    }

    getMediaImageDataUrlAction(item.id)
      .then((payload) => {
        if (active) setState({ loading: false, dataUrl: payload.dataUrl, failed: false });
      })
      .catch(() => {
        if (active) setState({ loading: false, dataUrl: "", failed: true });
      });

    return () => {
      active = false;
    };
  }, [item.id, item.previewDataUrl]);

  if (state.loading) {
    return (
      <div className="focus-reader-loading">
        <LoaderCircle size={24} className="spin" />
      </div>
    );
  }

  if (state.failed || !state.dataUrl) {
    return <div className="focus-reader-fallback">Dieses Bild kann gerade nicht angezeigt werden.</div>;
  }

  return (
    <div className="focus-image-reader" aria-label={item.title}>
      <AppImage src={state.dataUrl} alt={item.title} className="focus-image-reader-image" width={1400} height={1000} />
    </div>
  );
}
