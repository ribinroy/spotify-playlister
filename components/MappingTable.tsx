"use client";

import type { MatchResult } from "@/types";
import TrackRow from "./TrackRow";

interface MappingTableProps {
  matches: MatchResult[];
  onEdit: (match: MatchResult) => void;
}

export default function MappingTable({ matches, onEdit }: MappingTableProps) {
  const greenCount = matches.filter((m) => m.confidence === "green").length;
  const yellowCount = matches.filter((m) => m.confidence === "yellow").length;
  const redCount = matches.filter((m) => m.confidence === "red").length;

  return (
    <div className="w-full">
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-green-400">🟢 {greenCount} matched</span>
        <span className="text-yellow-400">🟡 {yellowCount} review</span>
        <span className="text-red-400">🔴 {redCount} unmatched</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left">
          <thead className="bg-zinc-900">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Local File
              </th>
              <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Spotify Match
              </th>
              <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider text-center">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <TrackRow
                key={match.trackEntry.id}
                match={match}
                onEdit={onEdit}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
