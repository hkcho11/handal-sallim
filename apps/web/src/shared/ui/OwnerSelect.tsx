import type { OwnerOptions } from "@/shared/api/owners";

export default function OwnerSelect({
  label,
  options,
  value,
  previousName,
  className,
  onChange,
}: {
  label: string;
  options: OwnerOptions;
  value: string;
  previousName?: string;
  className?: string;
  onChange: (id: string) => void;
}) {
  const selected = value || options.currentUserId;
  return (
    <label className={className}>
      {label}
      <select value={selected} onChange={(e) => onChange(e.target.value)}>
        {!options.members.some((item) => item.id === selected) && (
          <option value={selected}>
            {previousName ?? "이전 멤버"} (이전 멤버)
          </option>
        )}
        {options.members.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
            {item.id === options.currentUserId ? " (나)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
