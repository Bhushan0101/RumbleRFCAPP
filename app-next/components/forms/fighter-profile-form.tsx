"use client";

import { useActionState } from "react";
import { updateOwnProfile, type ProfileState } from "@/app/actions/profile";

const initial: ProfileState = { ok: false, message: "" };

export function FighterProfileForm({
  initialName,
  initialNickname,
  initialCountry,
  initialBio,
  initialInstagram,
  initialFacebook,
  initialTiktok,
}: {
  initialName: string;
  initialNickname: string;
  initialCountry: string;
  initialBio: string;
  initialInstagram: string;
  initialFacebook: string;
  initialTiktok: string;
}) {
  const [state, action, pending] = useActionState(updateOwnProfile, initial);
  return (
    <form action={action} className="space-y-4">
      {state.message && (
        <p
          className={`p-3 border text-sm rounded-lg ${
            state.ok
              ? "border-emerald bg-emerald/15 text-white"
              : "border-red-500 bg-red-500/10 text-red-200"
          }`}
        >
          {state.message}
        </p>
      )}
      <F name="name" label="Full name" defaultValue={initialName} required />
      <F name="nickname" label="Nickname" defaultValue={initialNickname} />
      <F name="country" label="Country" defaultValue={initialCountry} />
      <label className="block">
        <span className="font-display text-xs tracking-wider text-gold uppercase mb-1.5 block">
          Biography
        </span>
        <textarea
          name="biography"
          defaultValue={initialBio}
          rows={5}
          maxLength={4000}
          placeholder="Tell your story — training, gyms, defining moments."
          className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-white focus:border-gold outline-none"
        />
      </label>

      <fieldset className="border border-border rounded-xl p-4 space-y-3">
        <legend className="font-display text-xs tracking-wider text-gold uppercase px-2">
          Social links
        </legend>
        <p className="text-xs text-muted">
          Handles or full profile URLs — shown as icon links on your public
          fighter profile. Leave blank to hide.
        </p>
        <F
          name="instagram_handle"
          label="Instagram handle or URL"
          defaultValue={initialInstagram}
          placeholder="wucoireland"
        />
        <F
          name="tiktok_handle"
          label="TikTok handle or URL"
          defaultValue={initialTiktok}
          placeholder="wucoireland"
        />
        <F
          name="facebook_url"
          label="Facebook page or URL"
          defaultValue={initialFacebook}
          placeholder="wucoireland or https://www.facebook.com/…"
        />
      </fieldset>

      <p className="text-xs text-muted">
        Record (W-L-D), class and division are maintained by W.U.C.O admins. If
        they need updating, use Get Support in the user menu.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="bg-gold text-bg px-6 py-3 font-display font-bold text-xs tracking-wider uppercase hover:bg-gold-hi disabled:opacity-50 rounded-full"
      >
        {pending ? "Saving…" : "Save profile →"}
      </button>
    </form>
  );
}

function F({
  name,
  label,
  defaultValue = "",
  required,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-display text-xs tracking-wider text-gold uppercase mb-1.5 block">
        {label} {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-white focus:border-gold outline-none"
      />
    </label>
  );
}
