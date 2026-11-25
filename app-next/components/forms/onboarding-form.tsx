"use client";

import * as React from "react";
import { useActionState } from "react";
import { submitOnboarding } from "@/app/actions/onboarding";
import type { FormState } from "@/app/actions/public";

const initial: FormState = { ok: false, message: "" };

export function OnboardingForm({
  token,
  gymName,
  city,
  contactEmail,
}: {
  token: string;
  gymName: string;
  city: string;
  contactEmail: string;
}) {
  const [state, action, pending] = useActionState(submitOnboarding, initial);

  if (state.ok) {
    return (
      <div className="p-6 border border-emerald/60 bg-emerald/10 text-emerald-200 rounded-xl max-w-2xl">
        <p className="font-display text-lg text-white tracking-wider mb-2">
          Thanks — your club onboarding is in.
        </p>
        <p className="text-sm">{state.message}</p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="space-y-10 bg-surface border border-border p-6 md:p-8 rounded-xl"
    >
      {state.message && (
        <p className="p-3 border text-sm border-red-500 bg-red-500/10 text-red-200 rounded">
          {state.message}
        </p>
      )}
      <input type="hidden" name="token" value={token} />

      <Section
        title="Club information"
        subtitle="Tell us about the club you're registering."
      >
        <Row>
          <Field name="name" label="Official club name" defaultValue={gymName} required />
          <FileField name="logo" label="Club logo" hint="Up to 5 MB (JPG, PNG, WEBP, GIF, SVG)" />
        </Row>
        <Row>
          <Field name="address_line_1" label="Club address" />
          <Field name="eircode" label="Eircode" placeholder="e.g. D01 F5P2" />
        </Row>
        <Row>
          <Field name="city" label="City / town" defaultValue={city} />
          <Field name="county" label="County" />
        </Row>
        <Row>
          <Field name="year_established" label="Year established" type="number" min={1800} max={new Date().getFullYear()} />
          <Field name="phone" label="Club telephone number" type="tel" />
        </Row>
        <Field name="contact_email_display" label="Club email address" defaultValue={contactEmail} placeholder="(we use the email you enquired with)" readOnly />
        <Field name="website" label="Website" placeholder="https://" />
        <Field
          name="social_links"
          label="Social media links"
          hint="One per line — Instagram, Facebook, TikTok, etc."
          textarea
        />
        <Row>
          <Field name="members_total" label="Number of registered members" type="number" min={0} />
          <Field name="members_under18" label="Number of members under 18" type="number" min={0} />
        </Row>
        <Field
          name="disciplines"
          label="Martial arts and combat sports taught"
          hint="Comma-separated, e.g. Kickboxing, Muay Thai, Boxing"
        />
        <Field
          name="governing_body"
          label="Previous or current governing body affiliations"
          hint="List any federations or sanctioning bodies"
          textarea
        />
        <Field name="about" label="About your club" textarea />
        <Field
          name="revolut_handle"
          label="Revolut handle or URL (for class bookings)"
          placeholder="revolut.me/yourclub"
        />
      </Section>

      <Section
        title="Head coach information"
        subtitle="Primary coach of record — this will appear on the public club page."
      >
        <Row>
          <Field name="coach_name" label="Full name" />
          <Field name="coach_rank" label="Rank / belt" />
        </Row>
        <Row>
          <Field name="coach_years_training" label="Number of years training" type="number" min={0} max={100} />
          <Field name="coach_style" label="Style of martial arts" />
        </Row>
        <Row>
          <Field name="coach_last_grade_year" label="Year of last grade" type="number" min={1800} max={new Date().getFullYear()} />
          <Field name="coach_phone" label="Contact number" type="tel" />
        </Row>
        <Field name="coach_email" label="Email address" type="email" />
        <Field
          name="coach_qualifications"
          label="Martial arts qualifications and grades"
          textarea
        />
        <Field name="coach_years_coaching" label="Years of coaching experience" type="number" min={0} max={100} />
        <Field name="coach_certifications" label="Coaching certifications" textarea />
        <Row>
          <Field
            name="coach_first_aid_expiry"
            label="First aid qualification — expiry date"
            type="date"
          />
          <Field
            name="coach_safeguarding"
            label="Safeguarding certification"
            placeholder="e.g. Sport Ireland Safeguarding 1, dated 2024-05-12"
          />
        </Row>
        <Field
          name="coach_garda_vetting"
          label="Garda vetting status and date (if applicable)"
          placeholder="e.g. Vetted 2024-02-01 (NVB1 reference 12345)"
        />
      </Section>

      <button
        type="submit"
        disabled={pending}
        className="bg-gold text-bg px-7 py-3.5 font-display font-bold text-xs tracking-wider uppercase hover:bg-gold-hi disabled:opacity-50 rounded-full"
      >
        {pending ? "Submitting…" : "Submit club application →"}
      </button>
    </form>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <legend className="font-display text-lg text-white tracking-wider">
        {title}
      </legend>
      {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      {children}
    </fieldset>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  name,
  label,
  defaultValue = "",
  placeholder,
  hint,
  required,
  textarea,
  type = "text",
  min,
  max,
  readOnly,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  textarea?: boolean;
  type?: string;
  min?: number;
  max?: number;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-display text-[10px] tracking-wider text-gold uppercase mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      {textarea ? (
        <textarea
          name={readOnly ? undefined : name}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          readOnly={readOnly}
          rows={3}
          className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded focus:border-gold outline-none"
        />
      ) : (
        <input
          name={readOnly ? undefined : name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          min={min}
          max={max}
          readOnly={readOnly}
          className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded focus:border-gold outline-none"
        />
      )}
      {hint && <span className="block text-[11px] text-muted mt-1">{hint}</span>}
    </label>
  );
}

function FileField({
  name,
  label,
  hint,
}: {
  name: string;
  label: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block font-display text-[10px] tracking-wider text-gold uppercase mb-1.5">
        {label}
      </span>
      <input
        name={name}
        type="file"
        accept="image/*"
        className="block w-full text-xs text-muted
          file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0
          file:text-xs file:font-display file:tracking-wider file:uppercase
          file:bg-gold file:text-bg hover:file:bg-gold-hi cursor-pointer"
      />
      {hint && <span className="block text-[11px] text-muted mt-1">{hint}</span>}
    </label>
  );
}
