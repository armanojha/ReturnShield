const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
 const res = await fetch(`${BASE_URL}${path}`, {
 headers: { "Content-Type": "application/json" },
 ...options,
 });

 if (!res.ok) {
 const body = await res.text().catch(() => "");
 throw new Error(`Request to ${path} failed (${res.status}) ${body}`);
 }

 if (res.status === 204) return null;
 return res.json();
}

export function get(path) {
 return request(path, { method: "GET" });
}

export function post(path, data) {
 return request(path, {
 method: "POST",
 body: JSON.stringify(data),
 });
}
