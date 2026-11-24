"use client";

import * as React from "react";
import { useActionState } from "react";
import { updatePortraitUrl, type ProfileState } from "@/app/actions/profile";

const initial: ProfileState = { ok: false, message: "" };

export function PortraitForm({ initialUrl }: { initialUrl: string }) {
  const [state, action, pending] = useActionState(updatePortraitUrl, initial);
  const [preview, setPreview] = React.useState<string>(initialUrl);
  const [fileName, setFileName] = React.useState<string>("");

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setFileName("");
      return;
    }
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result ?? ""));
    reader.readAsDataURL(f);
  }

  return (
    <form action={action} className="space-y-3">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="w-32 h-40 object-cover rounded-xl border border-border"
        />
      )}

      <label className="block">
        <span className="sr-only">Choose a photo</span>
        <input
          name="portrait"
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
          : "JPG, PNG, WEBP or GIF — up to 5 MB. Tap to open camera on mobile."}
      </p>

      {state.message && (
        <p
          className={`text-xs ${state.ok ? "text-emerald-300" : "text-red-400"}`}
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-emerald text-white px-5 py-2.5 font-display text-xs tracking-wider rounded-full disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload photo"}
      </button>
    </form>
  );
}
