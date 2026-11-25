"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  addClubPhoto,
  deleteClubPhoto,
  type ClubFlowState,
} from "@/app/actions/club";

const initial: ClubFlowState = { ok: false, message: "" };

export type ExistingClubPhoto = {
  id: number;
  url: string;
  caption: string;
};

export function ClubGalleryForm({
  initialPhotos,
}: {
  initialPhotos: ExistingClubPhoto[];
}) {
  const [state, action, pending] = useActionState(addClubPhoto, initial);
  const [preview, setPreview] = React.useState<string>("");
  const [fileName, setFileName] = React.useState<string>("");
  const formRef = React.useRef<HTMLFormElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setFileName("");
      setPreview("");
      return;
    }
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result ?? ""));
    reader.readAsDataURL(f);
  }

  React.useEffect(() => {
    if (state.ok) {
      setPreview("");
      setFileName("");
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <div className="space-y-5">
      {initialPhotos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {initialPhotos.map((p) => (
            <div
              key={p.id}
              className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-black/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption || "Club photo"}
                className="w-full h-full object-cover"
              />
              {p.caption && (
                <p className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[11px] px-2 py-1 line-clamp-2">
                  {p.caption}
                </p>
              )}
              <form action={deleteClubPhoto} className="absolute top-1 right-1">
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  aria-label="Delete photo"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 bg-red-500/90 text-white text-[10px] px-2 py-1 rounded font-display tracking-wider"
                >
                  DELETE
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
      <form ref={formRef} action={action} className="space-y-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="w-32 h-32 object-cover rounded-lg border border-border"
          />
        )}
        <label className="block">
          <span className="sr-only">Choose a photo</span>
          <input
            name="photo"
            type="file"
            accept="image/*"
            required
            onChange={onPick}
            className="block w-full text-xs text-muted
              file:mr-3 file:py-2.5 file:px-4 file:rounded-full file:border-0
              file:text-xs file:font-display file:tracking-wider file:uppercase
              file:bg-gold file:text-bg hover:file:bg-gold-hi cursor-pointer"
          />
        </label>
        <p className="text-xs text-muted">
          {fileName
            ? `Selected: ${fileName}`
            : "JPG, PNG, WEBP or GIF — up to 5 MB each. Up to 40 photos."}
        </p>
        <label className="block">
          <span className="font-display text-[10px] tracking-wider text-gold uppercase">
            Caption (optional)
          </span>
          <input
            name="caption"
            type="text"
            maxLength={240}
            placeholder="Event, class, open day…"
            className="w-full mt-1 px-3 py-2 bg-bg border border-border text-white text-sm rounded-lg"
          />
        </label>
        {state.message && (
          <p className={`text-xs ${state.ok ? "text-emerald-300" : "text-red-400"}`}>
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="bg-emerald text-white px-5 py-2.5 font-display text-xs tracking-wider rounded-full disabled:opacity-50"
        >
          {pending ? "Uploading…" : "Add photo"}
        </button>
      </form>
    </div>
  );
}
