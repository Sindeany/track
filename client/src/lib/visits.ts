export const purposeLabels = {
  quote: "عرض أسعار",
  follow_up: "متابعة زيارة",
  complaint_follow_up: "متابعة شكوى",
  other: "أخرى",
} as const;

export function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatShortDate(value: Date | string) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function mapUrl(latitude: string | number, longitude: string | number) {
  return `https://www.google.com/maps?q=${Number(latitude)},${Number(longitude)}`;
}

export function initials(name?: string | null) {
  return name?.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("") || "م";
}
