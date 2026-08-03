import {
  getRosterPresenceBadgeClass,
  getRosterPresenceLabel,
  type RosterPresenceStatus
} from "@/lib/server/rosters/roster-presence";

type RosterPresenceBadgeProps = {
  status: RosterPresenceStatus;
  /** Optional player count suffix, e.g. "12/25". */
  countLabel?: string;
};

export function RosterPresenceBadge({
  status,
  countLabel
}: RosterPresenceBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${getRosterPresenceBadgeClass(
        status
      )}`}
    >
      {getRosterPresenceLabel(status)}
      {countLabel ? (
        <span className="font-medium opacity-80">({countLabel})</span>
      ) : null}
    </span>
  );
}
