const API_BASE = '';

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text}`);
  }
  return res.json();
}

export async function fetchHealth() {
  return getJson('/api/bw/health');
}

export async function fetchWorkbench() {
  return getJson('/api/bw/workbench');
}

export async function fetchDisplayData(objectName, limit = 100) {
  const q = new URLSearchParams({ object: objectName, limit: String(limit) });
  return getJson(`/api/bw/display-data?${q}`);
}

export async function fetchDtpMonitor(objectName) {
  const q = new URLSearchParams({ object: objectName });
  return getJson(`/api/bw/dtp-monitor?${q}`);
}
