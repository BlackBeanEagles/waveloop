"use client";

export function visitorId() {
  try {
    let id = localStorage.getItem("wl_vid");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("wl_vid", id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

export async function post<T = unknown>(url: string, data: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return r.json() as Promise<T>;
}
