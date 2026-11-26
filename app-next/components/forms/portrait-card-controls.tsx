"use client";

import * as React from "react";
import { useActionState } from "react";
import { updatePortraitUrl, removePortrait, type ProfileState } from "@/app/actions/profile";

const initial: ProfileState = { ok: false, message: "" };

export function PortraitCardControls({ hasPortrait }: { hasPortrait: boolean }) {
  const [state, action, pending] = useActionState(updatePortraitUrl, initial);
  const [removeState, removeAction, removePending] = useActionState(
    removePortrait,
    initial,
  );
  const [open, setOpen] = React.useState(false);
  const [fileName, setFileName] = React.useState<string>("");
  const [confirming, setConfirming] = React.useState(false);

  // Close the panel once the server reports success.
  React.useEffect(() => {
    if (state.ok || removeState.ok) setOpen(false);
  }, [state.ok, removeState.ok]);

  if (!hasPortrait && !open) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full bg-gold text-bg px-4 py-2.5 font-display font-bold text-[11px] tracking-wider uppercase rounded-full hover:bg-gold-hi"
        >
          + Add profile photo
        </button>
      </div>
    );
  }

  if (hasPortrait && !open) {
    return (
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-1 border border-gold/60 text-gold px-3 py-2 font-display text-[11px] tracking-wider uppercase rounded-full hover:bg-gold hover:text-bg"
        >
          Change photo
        </button>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="border border-red-500/60 text-red-200 px-3 py-2 font-display text-[11px] tracking-wider uppercase rounded-full hover:bg-red-500 hover:text-white"
          >
            Remove
          </button>
        ) : (
          <form action={removeAction} className="flex gap-1">
            <button
              type="submit"
              disabled={removePending}
              className="bg-red-500 text-white px-3 py-2 font-display text-[11px] tracking-wider uppercase rounded-full disabled:opacity-50"
            >
              {removePending ? "…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="border border-border text-white px-2 py-2 font-display text-[11px] tracking-wider uppercase rounded-full"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    );
  }

  // Open — uploader panel.
  return (
    <div className="mt-3 border border-gold/30 bg-black/30 rounded-xl p-3 space-y-2">
      <form action={action} className="space-y-2">
        <label className="block">
          <span className="sr-only">Choose a photo</span>
          <input
            name="portrait"
            type="file"
            accept="image/*"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            className="block w-full text-[11px] text-muted
              file:mr-2 file:py-2 file:px-3 file:rounded-full file:border-0
              file:text-[11px] file:font-display file:tracking-wider file:uppercase
              file:bg-gold file:text-bg hover:file:bg-gold-hi cursor-pointer"
          />
        </label>
        <p className="text-[10px] text-muted">
          {fileName || "JPG, PNG, WEBP or GIF — up to 5 MB."}
        </p>
        {state.message && (
          <p
            className={`text-[11px] ${state.ok ? "text-emerald-300" : "text-red-300"}`}
          >
            {state.message}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-emerald text-white px-4 py-2 font-display text-[11px] tracking-wider rounded-full disabled:opacity-50"
          >
            {pending ? "Uploading…" : hasPortrait ? "Replace photo" : "Upload photo"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="border border-border text-white px-3 py-2 font-display text-[11px] tracking-wider uppercase rounded-full"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
