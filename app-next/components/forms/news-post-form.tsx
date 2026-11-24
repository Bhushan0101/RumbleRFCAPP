"use client";

import * as React from "react";
import { useActionState } from "react";
import { createNewsPost, updateNewsPost, type NewsState } from "@/app/actions/news";

const initial: NewsState = { ok: false, message: "" };

export function NewsPostForm({
  mode,
  initial: initialPost,
}: {
  mode: "create" | "edit";
  initial?: {
    id: number;
    title: string;
    summary: string;
    body: string;
    coverUrl: string;
    publishedAt: string | null;
  };
}) {
  const [state, action, pending] = useActionState(
    mode === "create" ? createNewsPost : updateNewsPost,
    initial,
  );
  const published = Boolean(initialPost?.publishedAt);

  return (
    <form action={action} className="space-y-4 bg-surface border border-border rounded-2xl p-6">
      {initialPost && <input type="hidden" name="id" value={initialPost.id} />}
      <Field
        name="title"
        label="Title"
        required
        defaultValue={initialPost?.title}
      />
      <Field
        name="summary"
        label="One-line summary"
        hint="Shown in the post listing. Optional."
        defaultValue={initialPost?.summary}
      />
      <Field
        name="cover_url"
        label="Cover image URL"
        placeholder="https://… or /uploads/..."
        hint="Optional. Shows at top of the public post."
        defaultValue={initialPost?.coverUrl}
      />
      <label className="block">
        <span className="text-xs text-gold tracking-wider uppercase mb-1.5 block">
          Body <span className="text-red-400">*</span>
        </span>
        <textarea
          name="body"
          rows={12}
          required
          maxLength={50000}
          defaultValue={initialPost?.body}
          placeholder="Write your story here. Line breaks are preserved."
          className="w-full px-4 py-3 bg-bg border border-border text-white rounded-lg focus:border-gold outline-none"
        />
      </label>
      <fieldset>
        <legend className="text-xs text-gold tracking-wider uppercase mb-2">
          Visibility
        </legend>
        <div className="grid grid-cols-2 gap-2 max-w-md">
          {(["draft", "published"] as const).map((v) => (
            <label
              key={v}
              className="flex items-center gap-2 px-4 py-3 border border-border rounded-lg has-[input:checked]:border-gold has-[input:checked]:bg-gold/10 cursor-pointer"
            >
              <input
                type="radio"
                name="publish"
                value={v}
                defaultChecked={
                  mode === "edit" ? (published ? v === "published" : v === "draft") : v === "draft"
                }
                className="accent-gold"
              />
              <span className="text-sm text-white uppercase tracking-wider">{v}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.message && (
        <p className={`text-xs ${state.ok ? "text-emerald-300" : "text-red-400"}`}>
          {state.message}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-emerald text-white px-6 py-3 font-display font-bold text-xs tracking-wider rounded-full disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "create" ? "Create post" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
  placeholder,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gold tracking-wider uppercase mb-1.5 block">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      <input
        name={name}
        type="text"
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-bg border border-border text-white rounded-lg focus:border-gold outline-none"
      />
      {hint && <span className="text-xs text-muted mt-1 block">{hint}</span>}
    </label>
  );
}
