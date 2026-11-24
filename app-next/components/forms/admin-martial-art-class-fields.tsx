"use client";

import * as React from "react";
import {
  MARTIAL_ARTS,
  classesForMartialArt,
  martialArtRequiresClass,
  martialArtName,
} from "@/lib/martial-arts";
import { GENDERS, divisionsFor } from "@/lib/divisions";

export type InitialDiscipline = {
  martialArt: string;
  classCode: string | null;
  wins: number;
  losses: number;
  draws: number;
  isPrimary: number;
};

type Row = {
  martialArt: string;
  classCode: string;
  wins: number;
  losses: number;
  draws: number;
};

export function AdminMartialArtClassFields({
  initialGender,
  initialDivision,
  initialDisciplines,
}: {
  initialGender: string;
  initialDivision: string;
  initialDisciplines: InitialDiscipline[];
}) {
  const [gender, setGender] = React.useState<string>(initialGender);
  const [rows, setRows] = React.useState<Record<string, Row>>(() => {
    const out: Record<string, Row> = {};
    for (const d of initialDisciplines) {
      out[d.martialArt] = {
        martialArt: d.martialArt,
        classCode: d.classCode ?? "",
        wins: d.wins,
        losses: d.losses,
        draws: d.draws,
      };
    }
    return out;
  });
  const [primary, setPrimary] = React.useState<string>(() => {
    const p = initialDisciplines.find((d) => d.isPrimary === 1);
    return p?.martialArt ?? initialDisciplines[0]?.martialArt ?? "";
  });

  const selected = Object.keys(rows);
  const effectivePrimary = primary || selected[0] || "";
  const divisions = divisionsFor(gender, effectivePrimary);
  const divisionReady = divisions.length > 0;

  const disciplinesJson = React.useMemo(
    () =>
      JSON.stringify(
        selected.map((id) => ({
          martial_art: id,
          class_code: rows[id].classCode,
          wins: rows[id].wins,
          losses: rows[id].losses,
          draws: rows[id].draws,
          is_primary: id === effectivePrimary,
        })),
      ),
    [rows, selected, effectivePrimary],
  );

  function toggle(id: string, on: boolean) {
    setRows((prev) => {
      const next = { ...prev };
      if (on) {
        if (!next[id]) next[id] = { martialArt: id, classCode: "", wins: 0, losses: 0, draws: 0 };
      } else {
        delete next[id];
      }
      return next;
    });
    if (!on && primary === id) setPrimary("");
  }

  function update<K extends keyof Row>(id: string, k: K, v: Row[K]) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [k]: v } }));
  }

  return (
    <>
      <label className="block">
        <span className="font-display text-[10px] tracking-wider text-gold uppercase">
          Gender
        </span>
        <select
          name="gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="w-full mt-1 px-3 py-2 bg-bg border border-border text-white text-sm"
        >
          <option value="">—</option>
          {GENDERS.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-display text-[10px] tracking-wider text-gold uppercase">
          Division (primary discipline)
        </span>
        <select
          name="division"
          defaultValue={initialDivision}
          disabled={!divisionReady}
          key={`${gender}:${effectivePrimary}`}
          className="w-full mt-1 px-3 py-2 bg-bg border border-border text-white text-sm disabled:opacity-50"
        >
          <option value="">
            {divisionReady ? "— choose —" : "pick gender + primary"}
          </option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>

      <div className="col-span-full">
        <p className="font-display text-[10px] tracking-wider text-gold uppercase mb-2">
          Disciplines (tick each, pick primary, declare W-L-D)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MARTIAL_ARTS.map((m) => {
            const on = !!rows[m.id];
            const classes = classesForMartialArt(m.id);
            const classReq = martialArtRequiresClass(m.id);
            return (
              <div
                key={m.id}
                className={`border rounded p-3 ${on ? "border-gold bg-gold/5" : "border-border"}`}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => toggle(m.id, e.target.checked)}
                    className="accent-gold"
                  />
                  <span className="text-xs text-white font-display tracking-wider">
                    {martialArtName(m.id)}
                  </span>
                  {on && (
                    <label className="ml-auto flex items-center gap-1 text-[10px] text-gold">
                      <input
                        type="radio"
                        checked={effectivePrimary === m.id}
                        onChange={() => setPrimary(m.id)}
                        className="accent-gold"
                      />
                      Primary
                    </label>
                  )}
                </label>
                {on && classReq && (
                  <select
                    value={rows[m.id].classCode}
                    onChange={(e) => update(m.id, "classCode", e.target.value)}
                    className="w-full mt-2 px-2 py-1.5 bg-bg border border-border text-white text-xs"
                  >
                    <option value="">— class —</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                {on && (
                  <div className="grid grid-cols-3 gap-1 mt-2">
                    {(["wins", "losses", "draws"] as const).map((k) => (
                      <label key={k} className="block">
                        <span className="text-[9px] text-gold uppercase">{k}</span>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={rows[m.id][k]}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            update(m.id, k, Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
                          }}
                          className="w-full px-2 py-1 bg-bg border border-border text-white text-xs"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <input type="hidden" name="disciplines" value={disciplinesJson} />
    </>
  );
}
