import type { Patient, ClinicalNoteRecord, ResidentProfile } from '../types/clinical.ts';
import { seedPatients, seedNotes, defaultResidentProfile } from '../data/seedPatients.ts';
import { generateAuditHash, purgeExpiredDischargedPatients } from './clinicalLogic.ts';

const ACTIVE_NAMESPACE_KEY = 'resimed_active_account_ns_v2';
const PIN_KEY = 'resimed_pin_hash_v1';

export const UNAUTHENTICATED_NAMESPACE = 'unauthenticated';

/**
 * Normalizes a raw identifier into a deterministic namespace string.
 * - 'unauthenticated' when no user or mode is active
 * - 'local' for explicit local offline mode
 * - 'demo' for explicit demo mode
 * - 'uid:<firebase_uid>' for authenticated users (preferred canonical identity)
 */
export function normalizeNamespaceId(rawNamespace?: string | null): string {
  const clean = (rawNamespace || '').trim();
  if (!clean || clean === UNAUTHENTICATED_NAMESPACE) {
    return UNAUTHENTICATED_NAMESPACE;
  }
  const lower = clean.toLowerCase();
  if (lower === 'local' || lower === 'demo') {
    return lower;
  }
  if (lower.startsWith('uid:')) {
    const uidPart = clean.slice(4).trim();
    return uidPart ? `uid:${uidPart}` : UNAUTHENTICATED_NAMESPACE;
  }
  return lower;
}

export function buildUidNamespace(uid: string): string {
  const cleanUid = (uid || '').trim();
  if (!cleanUid) return UNAUTHENTICATED_NAMESPACE;
  return `uid:${cleanUid}`;
}

export function getActiveAccountNamespace(): string {
  try {
    const stored = localStorage.getItem(ACTIVE_NAMESPACE_KEY);
    return normalizeNamespaceId(stored);
  } catch {
    return UNAUTHENTICATED_NAMESPACE;
  }
}

export function setActiveAccountNamespace(accountUidOrMode: string | null): void {
  try {
    const normalized = normalizeNamespaceId(accountUidOrMode);
    localStorage.setItem(ACTIVE_NAMESPACE_KEY, normalized);
  } catch (e) {
    console.error('Error setting account namespace:', e);
  }
}

export function getScopedKey(base: string, namespaceOverride?: string): string {
  const ns =
    namespaceOverride !== undefined
      ? normalizeNamespaceId(namespaceOverride)
      : getActiveAccountNamespace();

  if (ns === UNAUTHENTICATED_NAMESPACE) {
    return `resimed_unauth_${base}_v2`;
  }
  if (ns === 'demo') {
    return `resimed_demo_${base}_v2`;
  }
  if (ns === 'local') {
    return `resimed_local_${base}_v2`;
  }
  if (ns.startsWith('uid:')) {
    const rawUid = ns.slice(4);
    const safeUid = rawUid.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `resimed_uid_${safeUid}_${base}_v2`;
  }
  const safeNs = ns.replace(/[^a-z0-9@._-]/gi, '_');
  return `resimed_acct_${safeNs}_${base}_v2`;
}

/**
 * Safely migrates existing local data stored under a legacy email-based key
 * (`resimed_acct_<email>_*_v2`) into the stable `uid:<uid>` namespace
 * (`resimed_uid_<uid>_*_v2`) for the SAME user without deleting or overwriting
 * existing UID-scoped data.
 */
export function migrateLegacyEmailNamespaceToUid(uid: string, email?: string | null): string {
  const targetNs = buildUidNamespace(uid);
  if (targetNs === UNAUTHENTICATED_NAMESPACE) {
    return UNAUTHENTICATED_NAMESPACE;
  }

  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail) {
      const legacySafeEmail = cleanEmail.replace(/[^a-z0-9@._-]/gi, '_');
      const dataKeys = [
        'patients',
        'notes',
        'profile',
        'deleted_patients',
        'offline_mutations',
        'last_sync_timestamp',
      ];

      for (const base of dataKeys) {
        const uidScopedKey = getScopedKey(base, targetNs);
        const legacyEmailKey = `resimed_acct_${legacySafeEmail}_${base}_v2`;
        const existingUidVal = localStorage.getItem(uidScopedKey);
        const legacyVal = localStorage.getItem(legacyEmailKey);

        // Only copy from legacy email key if UID key has not been initialized yet (or is an empty array '[]')
        if (legacyVal !== null && (existingUidVal === null || existingUidVal === '[]')) {
          localStorage.setItem(uidScopedKey, legacyVal);
        }
      }
    }
  } catch (e) {
    console.warn('Warning during legacy namespace migration:', e);
  }

  return targetNs;
}

/**
 * Activates the canonical `uid:<uid>` namespace for an authenticated user
 * after migrating any legacy email-keyed data belonging to that same user.
 */
export function activateAuthenticatedUserNamespace(uid: string, email?: string | null): string {
  const cleanUid = (uid || '').trim();
  if (!cleanUid) {
    const fallback = (email || '').trim().toLowerCase();
    if (!fallback) {
      setActiveAccountNamespace(UNAUTHENTICATED_NAMESPACE);
      return UNAUTHENTICATED_NAMESPACE;
    }
    setActiveAccountNamespace(fallback);
    return getActiveAccountNamespace();
  }

  const uidNs = migrateLegacyEmailNamespaceToUid(cleanUid, email);
  setActiveAccountNamespace(uidNs);
  return uidNs;
}

export function loadDeletedPatients(namespaceOverride?: string): Record<string, string> {
  try {
    const ns =
      namespaceOverride !== undefined
        ? normalizeNamespaceId(namespaceOverride)
        : getActiveAccountNamespace();
    if (ns === UNAUTHENTICATED_NAMESPACE) return {};

    const raw = localStorage.getItem(getScopedKey('deleted_patients', ns));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDeletedPatients(
  deletedMap: Record<string, string>,
  namespaceOverride?: string
): void {
  try {
    const ns =
      namespaceOverride !== undefined
        ? normalizeNamespaceId(namespaceOverride)
        : getActiveAccountNamespace();
    if (ns === UNAUTHENTICATED_NAMESPACE) return;

    localStorage.setItem(getScopedKey('deleted_patients', ns), JSON.stringify(deletedMap));
  } catch (e) {
    console.error('Error saving deleted patients tombstones:', e);
  }
}

export function recordDeletedPatient(
  patientId: string,
  recordNumber?: string,
  deletedAt: string = new Date().toISOString(),
  namespaceOverride?: string
): Record<string, string> {
  const current = loadDeletedPatients(namespaceOverride);
  if (patientId) {
    current[patientId] = deletedAt;
  }
  if (recordNumber && recordNumber.trim()) {
    current[`rec:${recordNumber.trim().toLowerCase()}`] = deletedAt;
  }
  saveDeletedPatients(current, namespaceOverride);
  return current;
}

export function unmarkDeletedPatient(
  patientId: string,
  recordNumber?: string,
  namespaceOverride?: string
): void {
  const current = loadDeletedPatients(namespaceOverride);
  let changed = false;
  if (patientId && current[patientId]) {
    delete current[patientId];
    changed = true;
  }
  if (recordNumber && recordNumber.trim()) {
    const recKey = `rec:${recordNumber.trim().toLowerCase()}`;
    if (current[recKey]) {
      delete current[recKey];
      changed = true;
    }
  }
  if (changed) {
    saveDeletedPatients(current, namespaceOverride);
  }
}

export function isPatientDeletedByTombstone(
  pt: Pick<Patient, 'id' | 'recordNumber' | 'lastUpdated'>,
  tombstones: Record<string, string>
): boolean {
  const delById = pt.id ? tombstones[pt.id] : undefined;
  const recKey = pt.recordNumber ? `rec:${pt.recordNumber.trim().toLowerCase()}` : undefined;
  const delByRec = recKey ? tombstones[recKey] : undefined;
  const deletedAtStr = delById || delByRec;
  if (!deletedAtStr) return false;

  const deletedTime = new Date(deletedAtStr).getTime();
  if (isNaN(deletedTime)) return true;

  if (pt.lastUpdated) {
    const updatedTime = new Date(pt.lastUpdated).getTime();
    // Only allow a patient to survive a tombstone if it was explicitly re-admitted AFTER the deletion timestamp
    if (!isNaN(updatedTime) && updatedTime > deletedTime + 2000) {
      return false;
    }
  }
  return true;
}

const SEED_PATIENT_BY_ID = new Map<string, Patient>(seedPatients.map((sp) => [sp.id, sp]));

export function normalizePatientRecord(pt: Patient): Patient {
  const normalizedNursingOrders = Array.isArray(pt.nursingOrders)
    ? pt.nursingOrders
    : typeof pt.nursingOrders === 'string'
    ? (pt.nursingOrders as string)
        .split('\n')
        .map((s) => s.replace(/^[•\-*\d.)\s]+/, '').trim())
        .filter(Boolean)
    : undefined;
  const normalizedDiagnoses = Array.isArray(pt.diagnoses)
    ? pt.diagnoses
    : typeof pt.diagnoses === 'string'
    ? (pt.diagnoses as string)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['1. Protocolo de estudio Medicina Interna'];
  const normalizedInitialDiagnoses = Array.isArray(pt.initialDiagnoses)
    ? pt.initialDiagnoses
    : typeof pt.initialDiagnoses === 'string'
    ? (pt.initialDiagnoses as string)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : normalizedDiagnoses;

  // Backfill longitudinal multi-panel lab values for seed patients if their stored labs predated the multi-panel upgrade
  const seedRef = SEED_PATIENT_BY_ID.get(pt.id);
  let normalizedLabs = Array.isArray(pt.labs) ? pt.labs : [];
  if (seedRef && seedRef.labs && seedRef.labs.length > 0) {
    const seedLabById = new Map(seedRef.labs.map((l) => [l.id, l]));
    normalizedLabs = normalizedLabs.map((l) => {
      const seedLab = seedLabById.get(l.id);
      if (!seedLab) return l;
      return {
        ...seedLab,
        ...Object.fromEntries(
          Object.entries(l).filter(([, v]) => v !== undefined && v !== null && v !== '')
        ),
      };
    });
    if (
      pt.id === 'p-104' &&
      normalizedLabs.length === 1 &&
      normalizedLabs[0].id === 'lab-401' &&
      seedRef.labs.length >= 2
    ) {
      normalizedLabs = seedRef.labs;
    }
  }

  return {
    ...pt,
    diagnoses: normalizedDiagnoses,
    initialDiagnoses: normalizedInitialDiagnoses,
    nursingOrders: normalizedNursingOrders,
    labs: normalizedLabs,
    medications: (pt.medications || []).map((m) =>
      m.id === 'm-203' && m.isLimitedCourse === undefined
        ? {
            ...m,
            isLimitedCourse: true,
            plannedDays: m.plannedDays || 5,
            indication: m.indication || 'Curso corto esteroide por EPOC agudizado',
          }
        : m
    ),
  };
}

export function loadPatients(namespaceOverride?: string): Patient[] {
  try {
    const ns =
      namespaceOverride !== undefined
        ? normalizeNamespaceId(namespaceOverride)
        : getActiveAccountNamespace();

    // Never return or persist patient data when unauthenticated
    if (ns === UNAUTHENTICATED_NAMESPACE) {
      return [];
    }

    const key = getScopedKey('patients', ns);
    const raw = localStorage.getItem(key);
    const tombstones = loadDeletedPatients(ns);

    if (!raw) {
      // ONLY populate seedPatients if the user explicitly chose 'demo' mode.
      // Institutional Google Drive accounts and clean local workspaces start with 0 patients ([]).
      if (ns === 'demo') {
        const initialDemo = seedPatients.filter(
          (pt) => !isPatientDeletedByTombstone(pt, tombstones)
        );
        savePatients(initialDemo, ns);
        return initialDemo;
      }
      savePatients([], ns);
      return [];
    }

    const parsed = JSON.parse(raw);
    const rawList: Patient[] = Array.isArray(parsed) ? parsed : [];
    const filteredList = rawList.filter((pt) => !isPatientDeletedByTombstone(pt, tombstones));
    const list: Patient[] = filteredList.map(normalizePatientRecord);

    // Auto-purge discharged patients older than 5 days to optimize storage
    const notesKey = getScopedKey('notes', ns);
    const rawNotes = localStorage.getItem(notesKey);
    const parsedNotes: ClinicalNoteRecord[] = rawNotes ? JSON.parse(rawNotes) : [];
    const { keptPatients, keptNotes, purgedPatientCount } = purgeExpiredDischargedPatients(
      list,
      Array.isArray(parsedNotes) ? parsedNotes : [],
      5
    );
    if (purgedPatientCount > 0) {
      savePatients(keptPatients, ns);
      saveNotes(keptNotes, ns);
    }
    return keptPatients;
  } catch (e) {
    console.error('Error loading patients from storage:', e);
    return [];
  }
}

export function savePatients(patients: Patient[], namespaceOverride?: string): void {
  try {
    const ns =
      namespaceOverride !== undefined
        ? normalizeNamespaceId(namespaceOverride)
        : getActiveAccountNamespace();
    if (ns === UNAUTHENTICATED_NAMESPACE) return;

    localStorage.setItem(getScopedKey('patients', ns), JSON.stringify(patients));
  } catch (e) {
    console.error('Error saving patients to storage:', e);
  }
}

export function loadNotes(namespaceOverride?: string): ClinicalNoteRecord[] {
  try {
    const ns =
      namespaceOverride !== undefined
        ? normalizeNamespaceId(namespaceOverride)
        : getActiveAccountNamespace();
    if (ns === UNAUTHENTICATED_NAMESPACE) {
      return [];
    }

    const key = getScopedKey('notes', ns);
    const raw = localStorage.getItem(key);
    if (!raw) {
      if (ns === 'demo') {
        saveNotes(seedNotes, ns);
        return seedNotes;
      }
      saveNotes([], ns);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading notes from storage:', e);
    return [];
  }
}

export function saveNotes(notes: ClinicalNoteRecord[], namespaceOverride?: string): void {
  try {
    const ns =
      namespaceOverride !== undefined
        ? normalizeNamespaceId(namespaceOverride)
        : getActiveAccountNamespace();
    if (ns === UNAUTHENTICATED_NAMESPACE) return;

    localStorage.setItem(getScopedKey('notes', ns), JSON.stringify(notes));
  } catch (e) {
    console.error('Error saving notes to storage:', e);
  }
}

export function loadProfile(namespaceOverride?: string): ResidentProfile {
  try {
    const ns =
      namespaceOverride !== undefined
        ? normalizeNamespaceId(namespaceOverride)
        : getActiveAccountNamespace();
    if (ns === UNAUTHENTICATED_NAMESPACE) {
      return defaultResidentProfile;
    }

    const raw = localStorage.getItem(getScopedKey('profile', ns));
    if (!raw) {
      saveProfile(defaultResidentProfile, ns);
      return defaultResidentProfile;
    }
    return JSON.parse(raw);
  } catch {
    return defaultResidentProfile;
  }
}

export function saveProfile(profile: ResidentProfile, namespaceOverride?: string): void {
  try {
    const ns =
      namespaceOverride !== undefined
        ? normalizeNamespaceId(namespaceOverride)
        : getActiveAccountNamespace();
    if (ns === UNAUTHENTICATED_NAMESPACE) return;

    localStorage.setItem(getScopedKey('profile', ns), JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving profile:', e);
  }
}

export function resetDemoDataInCurrentNamespace(): void {
  saveDeletedPatients({});
  savePatients(seedPatients);
  saveNotes(seedNotes);
}

export function resetBasicDemoDataInCurrentNamespace(): void {
  saveDeletedPatients({});
  const basicThree = seedPatients.slice(0, 3);
  savePatients(basicThree);
  saveNotes(seedNotes);
}

export function clearAllPatientsInCurrentNamespace(): Record<string, string> {
  const currentPatients = loadPatients();
  const now = new Date().toISOString();
  const tombstones = loadDeletedPatients();
  for (const p of currentPatients) {
    if (p.id) tombstones[p.id] = now;
    if (p.recordNumber) tombstones[`rec:${p.recordNumber.trim().toLowerCase()}`] = now;
  }
  saveDeletedPatients(tombstones);
  savePatients([]);
  return tombstones;
}

const DEV_PIN_KEY = 'resimed_dev_pin_hash_v1';

export function getStoredDeveloperPinHash(): string | null {
  try {
    return localStorage.getItem(DEV_PIN_KEY);
  } catch {
    return null;
  }
}

export function setStoredDeveloperPin(pin: string): void {
  if (!pin) {
    localStorage.removeItem(DEV_PIN_KEY);
    return;
  }
  const hash = generateAuditHash('DEVELOPER-PIN', 'DEV-SALT', pin);
  localStorage.setItem(DEV_PIN_KEY, hash);
}

export function verifyDeveloperPin(enteredPin: string): boolean {
  const currentHash = getStoredDeveloperPinHash();
  if (!currentHash) {
    return enteredPin === '2580' || enteredPin === '9999';
  }
  const testHash = generateAuditHash('DEVELOPER-PIN', 'DEV-SALT', enteredPin);
  return currentHash === testHash;
}

export function getStoredPinHash(): string | null {
  return localStorage.getItem(PIN_KEY);
}

export function setStoredPin(pin: string): void {
  if (!pin) {
    localStorage.removeItem(PIN_KEY);
    return;
  }
  const hash = generateAuditHash('RESIDENT-PIN', 'LOCK-SALT', pin);
  localStorage.setItem(PIN_KEY, hash);
}

export function verifyStoredPin(enteredPin: string): boolean {
  const currentHash = getStoredPinHash();
  if (!currentHash) {
    return enteredPin === '1234';
  }
  const testHash = generateAuditHash('RESIDENT-PIN', 'LOCK-SALT', enteredPin);
  return currentHash === testHash;
}

export interface BackupPackage {
  version: string;
  exportDate: string;
  residentAuthor: string;
  accountUid?: string;
  accountEmail?: string;
  patients: Patient[];
  notes: ClinicalNoteRecord[];
  deletedPatientIds?: Record<string, string>;
  profile?: ResidentProfile;
  integrityHash: string;
}

export function exportFullBackup(): string {
  const patients = loadPatients();
  const notes = loadNotes();
  const profile = loadProfile();
  const deletedPatientIds = loadDeletedPatients();
  const now = new Date().toISOString();

  const updatedProfile: ResidentProfile = {
    ...profile,
    lastBackupTimestamp: Date.now(),
  };
  saveProfile(updatedProfile);

  const backupData: BackupPackage = {
    version: '2.0.0',
    exportDate: now,
    residentAuthor: profile.name,
    patients,
    notes,
    deletedPatientIds,
    profile: updatedProfile,
    integrityHash: generateAuditHash('BACKUP-VAULT', now, `${patients.length}:${notes.length}`),
  };

  return JSON.stringify(backupData, null, 2);
}

export function importFullBackup(jsonString: string): {
  success: boolean;
  message: string;
  patientsCount?: number;
  notesCount?: number;
} {
  try {
    const data: BackupPackage = JSON.parse(jsonString);
    if (!data.patients || !Array.isArray(data.patients)) {
      return {
        success: false,
        message: 'El archivo de respaldo no contiene datos de pacientes válidos.',
      };
    }

    if (data.deletedPatientIds && typeof data.deletedPatientIds === 'object') {
      const mergedTombstones = { ...loadDeletedPatients(), ...data.deletedPatientIds };
      saveDeletedPatients(mergedTombstones);
    }

    const activeTombstones = loadDeletedPatients();
    const nonDeletedPatients = data.patients
      .filter((pt) => !isPatientDeletedByTombstone(pt, activeTombstones))
      .map(normalizePatientRecord);

    const { keptPatients, keptNotes } = purgeExpiredDischargedPatients(
      nonDeletedPatients,
      Array.isArray(data.notes) ? data.notes : [],
      5
    );

    savePatients(keptPatients);
    if (keptNotes && Array.isArray(keptNotes)) {
      saveNotes(keptNotes);
    }

    const prof = data.profile ? { ...loadProfile(), ...data.profile } : loadProfile();
    saveProfile({ ...prof, lastBackupTimestamp: Date.now() });

    return {
      success: true,
      message: `Respaldo restaurado exitosamente: ${keptPatients.length} pacientes y ${(keptNotes || []).length} notas históricas recuperadas.`,
      patientsCount: keptPatients.length,
      notesCount: (keptNotes || []).length,
    };
  } catch (e: any) {
    return { success: false, message: `Error al procesar el archivo JSON: ${e.message}` };
  }
}
