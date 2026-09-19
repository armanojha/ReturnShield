// Turns snake_case keys into readable labels.
export function humanize(key) {
 return String(key).replace(/_/g, " ");
}

// Turns any API value into readable text. Used by the detail views so they
// render whatever fields the backend returns, without guessing field names.
export function formatValue(value) {
 if (value === null || value === undefined || value === "") return "-";
 if (typeof value === "boolean") return value ? "Yes" : "No";
 if (Array.isArray(value)) {
 return value.length ? value.map(formatValue).join(", ") : "-";
 }
 if (typeof value === "object") {
 return Object.entries(value)
 .map(([k, v]) => `${humanize(k)}: ${formatValue(v)}`)
 .join(", ");
 }
 return String(value);
}
