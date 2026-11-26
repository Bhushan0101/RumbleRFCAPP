"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  registerEventInterest,
  respondToBoutOffer,
  respondToClubInterest,
  type EventFlowState,
} from "@/app/actions/event-flow";

const initial: EventFlowState = { ok: false, message: "" };

export function EventInterestBlock({
  eventId,
  status,
  offer,
  eventPast,
  clubName = null,
}: {
  eventId: number;
  /** 'none' | 'interested' | 'offered' | 'accepted' | 'declined' | 'confirmed' | 'cancelled' | 'pending_fighter' */
  status: string;
  offer: {
    opponent: string;
    division: string;
    section: string;
    note: string;
  };
  eventPast: boolean;
  /** Name of the club that raised the interest, when status==='pending_fighter'. */
  clubName?: string | null;
}) {
  const [state, action, pending] = useActionState(registerEventInterest, initial);

  // Club raised interest on the fighter's behalf — needs the fighter to agree
  // before admin even sees it.
  if (status === "pending_fighter") {
    return (
      <div
        className="rounded-2xl border-2 border-gold/60 p-5 md:p-6"
        style={{ background: "linear-gradient(90deg, rgba(200,164,90,0.1), rgba(11,61,46,0.4))" }}
      >
        <p className="font-display text-xs tracking-widest text-gold uppercase mb-1">
          Your club wants to put you on this card
        </p>
        <p className="text-sm text-white mb-4">
          {clubName
            ? `${clubName} has raised interest on your behalf.`
            : "Your club has raised interest on your behalf."}{" "}
          Confirm to let the W.U.C.O admin know, or decline to hold off.
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={respondToClubInterest}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="decision" value="accept" />
            <button
              type="submit"
              className="bg-emerald text-white px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-emerald-hi"
            >
              Confirm interest
            </button>
          </form>
          <form action={respondToClubInterest}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="decision" value="decline" />
            <button
              type="submit"
              className="border border-red-500 text-red-200 px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-red-500 hover:text-white"
            >
              Not this one
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Admin-sent offer — accept/decline UI.
  if (status === "offered") {
    return (
      <div
        className="rounded-2xl border-2 border-gold/60 p-5 md:p-6"
        style={{ background: "linear-gradient(90deg, rgba(200,164,90,0.1), rgba(11,61,46,0.4))" }}
      >
        <p className="font-display text-xs tracking-widest text-gold uppercase mb-1">
          Bout offered for this event
        </p>
        <p className="text-sm text-white mb-4">
          A W.U.C.O admin has offered you a bout. The bout is only{" "}
          <strong>confirmed once both fighters accept</strong>.
        </p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-5">
          <DT label="Opponent">{offer.opponent || "—"}</DT>
          <DT label="Division">{offer.division || "—"}</DT>
          <DT label="Card section">{offer.section || "—"}</DT>
          <DT label="Note">
            {offer.note ? (
              <span className="whitespace-pre-wrap">{offer.note}</span>
            ) : (
              "—"
            )}
          </DT>
        </dl>
        <div className="flex flex-wrap gap-2">
          <form action={respondToBoutOffer}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="decision" value="accept" />
            <button
              type="submit"
              className="bg-emerald text-white px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-emerald-hi"
            >
              Accept bout
            </button>
          </form>
          <form action={respondToBoutOffer}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="decision" value="decline" />
            <button
              type="submit"
              className="border border-red-500 text-red-200 px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-red-500 hover:text-white"
            >
              Decline
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <div className="rounded-2xl border border-emerald/60 bg-emerald/10 p-4 md:p-5">
        <p className="font-display text-xs tracking-widest text-emerald uppercase mb-1">
          Bout confirmed
        </p>
        <p className="text-sm text-white">
          Both fighters have accepted — your bout is confirmed. You&apos;ll be
          contacted with the final fight details ahead of the event.
        </p>
      </div>
    );
  }

  if (status === "accepted") {
    return (
      <div className="rounded-2xl border border-emerald/60 bg-emerald/10 p-4 md:p-5">
        <p className="font-display text-xs tracking-widest text-emerald uppercase mb-1">
          You&apos;ve accepted
        </p>
        <p className="text-sm text-white">
          You&apos;ve accepted the bout offer. Waiting on your opponent to
          accept too — once they do, the bout is confirmed.
        </p>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="rounded-2xl border border-border p-4 md:p-5">
        <p className="font-display text-xs tracking-widest text-muted uppercase mb-1">
          Offer declined
        </p>
        <p className="text-sm text-white">
          You declined this bout offer. A W.U.C.O admin has been notified.
        </p>
      </div>
    );
  }

  if (status === "interested") {
    return (
      <div className="rounded-2xl border border-gold/40 bg-gold/5 p-4 md:p-5">
        <p className="font-display text-xs tracking-widest text-gold uppercase mb-1">
          Interest registered
        </p>
        <p className="text-sm text-white">
          Thanks — the W.U.C.O admin team has been notified. If a bout is
          offered, you&apos;ll see it here and in your notifications.
        </p>
      </div>
    );
  }

  // status === "none"  →  the "register interest" CTA
  if (eventPast) return null;

  return (
    <form
      action={action}
      className="rounded-2xl border border-gold/40 bg-gold/5 p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <div>
        <p className="font-display text-sm text-white tracking-wider">
          Interested in fighting on this card?
        </p>
        <p className="text-xs text-muted mt-0.5">
          Register your interest and the W.U.C.O admin will review and offer a
          bout if suitable. You&apos;ll get an email + in-app notification.
        </p>
        {state.message && (
          <p
            className={`text-xs mt-2 ${
              state.ok ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-gold text-bg px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-gold-hi whitespace-nowrap disabled:opacity-60"
      >
        {pending ? "Sending…" : "Register interest"}
      </button>
    </form>
  );
}

function DT({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-white">{children}</dd>
    </div>
  );
}
