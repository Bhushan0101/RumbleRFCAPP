"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateCoachProfile, type ClubFlowState } from "@/app/actions/club";

const initial: ClubFlowState = { ok: false, message: "" };

export type CoachInitial = {
  coachName: string;
  coachRank: string;
  coachYearsTraining: number | null;
  coachStyle: string;
  coachLastGradeYear: number | null;
  coachPhone: string;
  coachEmail: string;
  coachQualifications: string;
  coachYearsCoaching: number | null;
  coachCertifications: string;
  coachFirstAidExpiry: string;
  coachSafeguarding: string;
  coachGardaVetting: string;
  coachPhotoUrl: string | null;
};

export function ClubCoachForm({ initialValues }: { initialValues: CoachInitial }) {
  const [state, action, pending] = useActionState(updateCoachProfile, initial);
  const [preview, setPreview] = React.useState<string>(initialValues.coachPhotoUrl ?? "");
  const [fileName, setFileName] = React.useState<string>("");

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result ?? ""));
    reader.readAsDataURL(f);
  }

  return (
    <form
      action={action}
      className="space-y-5"
    >
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="w-32 h-32 object-cover rounded-xl border border-border bg-black/30"
            />
          ) : (
            <div className="w-32 h-32 rounded-xl border border-dashed border-border bg-black/30 grid place-items-center text-muted text-[10px] font-display tracking-wider uppercase">
              No photo
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <label className="block">
            <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
              Coach photo
            </span>
            <input
              name="coach_photo"
              type="file"
              accept="image/*"
              onChange={onPick}
              className="block w-full text-xs text-muted
                file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0
                file:text-xs file:font-display file:tracking-wider file:uppercase
                file:bg-gold file:text-bg hover:file:bg-gold-hi cursor-pointer"
            />
          </label>
          <p className="text-[11px] text-muted">
            {fileName ? `Selected: ${fileName}` : "JPG, PNG, WEBP or GIF — up to 5 MB."}
          </p>
          {initialValues.coachPhotoUrl && (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                name="remove_photo"
                value="1"
                className="accent-gold"
              />
              Remove current coach photo
            </label>
          )}
        </div>
      </div>

      <Row>
        <Field name="coach_name" label="Full name" def={initialValues.coachName} />
        <Field name="coach_rank" label="Rank / belt" def={initialValues.coachRank} />
      </Row>
      <Row>
        <Field
          name="coach_years_training"
          label="Years training"
          type="number"
          def={nnString(initialValues.coachYearsTraining)}
          min={0}
          max={100}
        />
        <Field name="coach_style" label="Style of martial arts" def={initialValues.coachStyle} />
      </Row>
      <Row>
        <Field
          name="coach_last_grade_year"
          label="Year of last grade"
          type="number"
          def={nnString(initialValues.coachLastGradeYear)}
          min={1800}
          max={new Date().getFullYear()}
        />
        <Field name="coach_phone" label="Contact number" type="tel" def={initialValues.coachPhone} />
      </Row>
      <Field name="coach_email" label="Email address" type="email" def={initialValues.coachEmail} />
      <Field
        name="coach_qualifications"
        label="Martial arts qualifications & grades"
        def={initialValues.coachQualifications}
        textarea
      />
      <Field
        name="coach_years_coaching"
        label="Years of coaching experience"
        type="number"
        def={nnString(initialValues.coachYearsCoaching)}
        min={0}
        max={100}
      />
      <Field
        name="coach_certifications"
        label="Coaching certifications"
        def={initialValues.coachCertifications}
        textarea
      />
      <Row>
        <Field
          name="coach_first_aid_expiry"
          label="First aid qualification — expiry date"
          type="date"
          def={initialValues.coachFirstAidExpiry}
        />
        <Field
          name="coach_safeguarding"
          label="Safeguarding certification"
          def={initialValues.coachSafeguarding}
        />
      </Row>
      <Field
        name="coach_garda_vetting"
        label="Garda vetting status and date (if applicable)"
        def={initialValues.coachGardaVetting}
      />

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
        {pending ? "Saving…" : "Save coach profile"}
      </button>
    </form>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  name,
  label,
  def = "",
  textarea,
  type = "text",
  min,
  max,
}: {
  name: string;
  label: string;
  def?: string;
  textarea?: boolean;
  type?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="block font-display text-[10px] tracking-wider text-gold uppercase mb-1.5">
        {label}
      </span>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={def}
          rows={3}
          className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded focus:border-gold outline-none"
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={def}
          min={min}
          max={max}
          className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded focus:border-gold outline-none"
        />
      )}
    </label>
  );
}

function nnString(n: number | null): string {
  return n == null ? "" : String(n);
}
