"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  updateTimetableImage,
  removeTimetableImage,
} from "@/app/actions/club";
import type { ClubFlowState } from "@/app/actions/club";

const initial: ClubFlowState = { ok: false, message: "" };

export function ClubTimetableImageForm({ initialUrl }: { initialUrl: string }) {
  const [state, action, pending] = useActionState(updateTimetableImage, initial);
  const [fileName, setFileName] = React.useState<string>("");
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  return (
    <div className="space-y-3">
      {initialUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={initialUrl}
          alt="Current timetable"
          className="w-full max-w-xl rounded-xl border border-border"
        />
      ) : (
        <div className="w-full max-w-xl aspect-[16/9] bg-black/40 border border-dashed border-border rounded-xl grid place-items-center">
          <span className="text-xs text-muted">No timetable image yet.</span>
        </div>
      )}

      <form action={action} className="space-y-2">
        <label className="block">
          <span className="sr-only">Choose a timetable image</span>
          <input
            name="timetable"
            type="file"
            accept="image/*"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            className="block w-full text-xs text-muted
              file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0
              file:text-xs file:font-display file:tracking-wider file:uppercase
              file:bg-gold file:text-bg hover:file:bg-gold-hi cursor-pointer"
          />
        </label>
        <p className="text-[11px] text-muted">
          {fileName || "JPG, PNG, WEBP or GIF — up to 5 MB."}
        </p>
        {state.message && (
          <p
            className={`text-xs ${state.ok ? "text-emerald-300" : "text-red-300"}`}
          >
            {state.message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-emerald text-white px-4 py-2 font-display text-xs tracking-wider rounded-full disabled:opacity-50"
          >
            {pending ? "Uploading…" : initialUrl ? "Replace timetable" : "Upload timetable"}
          </button>
          {initialUrl && (
            <>
              {!confirmRemove ? (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="border border-red-500/60 text-red-200 px-3 py-2 font-display text-xs tracking-wider uppercase rounded-full hover:bg-red-500 hover:text-white"
                >
                  Remove
                </button>
              ) : (
                <>
                  <form action={removeTimetableImage}>
                    <button
                      type="submit"
                      className="bg-red-500 text-white px-3 py-2 font-display text-xs tracking-wider uppercase rounded-full"
                    >
                      Confirm remove
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="border border-border text-white px-3 py-2 font-display text-xs tracking-wider uppercase rounded-full"
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  );
}
