"use client";

export function DeleteEventButton({ id, action }: { id: number; action: (fd: FormData) => void }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Delete this event? This also removes all its bouts.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-red-400 underline">
        Delete event
      </button>
    </form>
  );
}
