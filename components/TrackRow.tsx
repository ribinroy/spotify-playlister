"use client";

import type { MatchResult } from "@/types";

interface TrackRowProps {
  match: MatchResult;
  onEdit: (match: MatchResult) => void;
}

const statusConfig = {
  green: { icon: "🟢", label: "Matched" },
  yellow: { icon: "🟡", label: "Review" },
  red: { icon: "🔴", label: "No Match" },
};

export default function TrackRow({ match, onEdit }: TrackRowProps) {
  const { trackEntry, spotifyTrack, confidence, score } = match;
  const status = statusConfig[confidence];

  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-900/50 transition">
      <td className="px-4 py-3">
        <div className="font-medium text-sm">
          {trackEntry.artist
            ? `${trackEntry.artist} - ${trackEntry.title}`
            : trackEntry.title || trackEntry.filename}
        </div>
        <div className="text-xs text-zinc-500">{trackEntry.playlistName}</div>
      </td>

      <td className="px-4 py-3">
        {spotifyTrack ? (
          <div>
            <div className="text-sm">{spotifyTrack.name}</div>
            <div className="text-xs text-zinc-500">
              {spotifyTrack.artists.join(", ")}
            </div>
          </div>
        ) : (
          <span className="text-sm text-zinc-600">--</span>
        )}
      </td>

      <td className="px-4 py-3 text-center">
        <span title={`${score}% match`}>
          {status.icon}
        </span>
        <div className="text-xs text-zinc-500">{score}%</div>
      </td>

      <td className="px-4 py-3">
        <button
          onClick={() => onEdit(match)}
          className="px-3 py-1 text-xs rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition"
        >
          {confidence === "red" ? "Search" : "Edit"}
        </button>
      </td>
    </tr>
  );
}
