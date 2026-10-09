"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { UPLOAD_ID } from "@/lib/upload-rules";

export function ShopImageUpload({
  imageId,
  productName,
  disabled,
  onChange,
  onBusyChange,
}: {
  imageId: string;
  productName: string;
  disabled: boolean;
  onChange: (id: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    setNotice("");
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setError("Välj en JPG-, PNG- eller WebP-bild.");
      return;
    }
    if (!file.size || file.size > 2 * 1024 * 1024) {
      setError("Produktbilden får vara högst 2 MB.");
      return;
    }
    setBusy(true);
    onBusyChange(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/shop/images", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Bilden kunde inte laddas upp.");
      if (typeof body.id !== "string" || !UPLOAD_ID.test(body.id))
        throw new Error("Uppladdningen saknar en giltig bildreferens.");
      onChange(body.id);
      setNotice("Bilden är uppladdad. Spara produkten för att använda den.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Bilden kunde inte laddas upp. Försök igen.",
      );
    } finally {
      setBusy(false);
      onBusyChange(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="shop-image-upload">
      <input type="hidden" name="imageId" value={imageId} />
      <div className="shop-image-upload-heading">
        <h3>Produktbild</h3>
        <span className="muted small">Valfri</span>
      </div>
      {imageId && (
        <div className="shop-image-preview">
          <img
            src={`/api/shop/images/${imageId}`}
            alt={`Produktbild för ${productName || "produkten"}`}
            width={180}
            height={180}
          />
          <button
            type="button"
            className="button button-secondary button-small"
            disabled={disabled || busy}
            onClick={() => {
              onChange("");
              setNotice("Bilden tas bort från produkten när du sparar.");
            }}
          >
            <X size={16} aria-hidden="true" /> Ta bort bild
          </button>
        </div>
      )}
      <label htmlFor={id} className="text-link">
        <ImagePlus size={18} aria-hidden="true" />
        {imageId ? "Byt produktbild" : "Välj produktbild"}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        disabled={disabled || busy}
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <p className="small muted">
        JPG, PNG eller WebP · högst 2 MB. Bilden visas efter att produkten
        sparats. Utkastets bild kan bara ses av administratörer.
      </p>
      {busy && (
        <p role="status" className="small">
          <LoaderCircle
            size={16}
            className="admin-submit-spinner"
            aria-hidden="true"
          />{" "}
          Laddar upp bilden…
        </p>
      )}
      {notice && (
        <p role="status" className="small muted">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="notice notice-error">
          {error}
        </p>
      )}
    </div>
  );
}
