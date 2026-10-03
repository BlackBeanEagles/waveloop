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

export function abVariant(): "A" | "B" {
  try {
    const forced = new URLSearchParams(location.search).get("v");
    if (forced === "A" || forced === "B") return forced;
    let v = localStorage.getItem("wl_variant");
    if (v !== "A" && v !== "B") {
      v = Math.random() < 0.5 ? "A" : "B";
      localStorage.setItem("wl_variant", v);
    }
    return v as "A" | "B";
  } catch {
    return "A";
  }
}

export async function post<T = unknown>(url: string, data: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return r.json() as Promise<T>;
}
