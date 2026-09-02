export type ScanRowRecord = {
  id: string;
  name: string;
  target: string;
  profile: string;
  status: string;
  progress: number;
  findings: number;
  started: string;
  scanner?: string;
  result?: unknown;
};

/**
 * Active-scanner (Acunetix/mock) scans shared by the Active Scanner overview and the
 * centralized Scans (/scans) list so a finished scan shows up in both places.
 */
export const activeScanRecords: ScanRowRecord[] = [
  { id: "acu_2b71", name: "Staging full scan", target: "Northstar Customer Portal", profile: "Full scan", status: "running", progress: 61, findings: 8, started: "—" },
  { id: "acu_1ec4", name: "API high-risk checks", target: "Atlas Partner API", profile: "High risk", status: "completed", progress: 100, findings: 5, started: "—" },
];

const SCANNER_KEY = "pan_scanner_records";

function readAll(): ScanRowRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(SCANNER_KEY);
    return value ? (JSON.parse(value) as ScanRowRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: ScanRowRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SCANNER_KEY, JSON.stringify(records));
  } catch {
    // ignore storage failures in demo mode
  }
}

export function getScannerScanRecords(): ScanRowRecord[] {
  return readAll();
}

export function getScannerScan(id: string): ScanRowRecord | null {
  return readAll().find((record) => record.id === id) ?? null;
}

export function upsertScannerScan(record: ScanRowRecord): ScanRowRecord[] {
  const records = readAll();
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.unshift(record);
  writeAll(records);
  return records;
}

export function removeScanRecord(id: string): void {
  writeAll(readAll().filter((record) => record.id !== id));
}

export function startScannerScan(input: { scanner: string; target: string; name?: string }): ScanRowRecord {
  const id = `${input.scanner}_${Date.now()}`;
  const now = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const record: ScanRowRecord = {
    id,
    name: input.name ?? `${input.scanner[0].toUpperCase()}${input.scanner.slice(1)} scan · ${input.target}`,
    target: input.target,
    profile: input.scanner,
    status: "running",
    progress: 3,
    findings: 0,
    started: now,
    scanner: input.scanner,
  };
  upsertScannerScan(record);
  return record;
}

export function completeScannerScan(id: string, patch: Partial<Pick<ScanRowRecord, "progress" | "findings" | "status" | "result">>): ScanRowRecord | null {
  const record = getScannerScan(id);
  if (!record) return null;
  const updated: ScanRowRecord = { ...record, status: "completed", progress: 100, ...patch };
  upsertScannerScan(updated);
  return updated;
}

/** Backward-compatible aliases used by the passive scanner. */
export const addPassiveScanRecord = upsertScannerScan;
export const getPassiveScanRecords = getScannerScanRecords;