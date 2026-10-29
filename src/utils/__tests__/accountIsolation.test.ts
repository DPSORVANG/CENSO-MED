import test from 'node:test';
import assert from 'node:assert/strict';

// Set up a mock browser localStorage & window environment before importing storage/sync modules
class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = {
  localStorage: mockStorage,
  location: { pathname: '/', search: '', hash: '' },
};

import {
  UNAUTHENTICATED_NAMESPACE,
  getActiveAccountNamespace,
  setActiveAccountNamespace,
  activateAuthenticatedUserNamespace,
  getScopedKey,
  loadPatients,
  savePatients,
  loadNotes,
  saveNotes,
  loadDeletedPatients,
  recordDeletedPatient,
} from '../storage.ts';
import {
  recordOfflineMutation,
  getPendingMutations,
  clearPendingMutations,
  getLastSyncTime,
  setLastSyncTime,
} from '../syncEngine.ts';
import {
  findDriveCensusFile,
  getAccessToken,
  getSavedDriveUser,
} from '../googleDriveSync.ts';
import { Patient, ClinicalNoteRecord } from '../../types/clinical.ts';

function createDummyPatient(id: string, name: string, bed: string): Patient {
  return {
    id,
    bed,
    name,
    age: 54,
    gender: 'Masculino',
    recordNumber: `EXP-${id}`,
    service: 'Medicina Interna',
    admissionDate: '2025-02-20',
    status: 'active',
    severity: 'Estable',
    codeStatus: 'RCP 1 (Reanimación Completa / Todo esfuerzo)',
    allergies: 'Negadas',
    diagnoses: [`Diagnóstico de prueba ${id}`],
    vitals: {
      bp: '120/80',
      hr: '76',
      rr: '18',
      temp: '36.6',
      spo2: '96',
    },
    medications: [],
    labs: [],
    studies: [],
    pendings: [],
    clinicalTags: [],
    lastUpdated: '2025-02-20T10:00:00.000Z',
  };
}

function createDummyNote(id: string, patientId: string, patientName: string): ClinicalNoteRecord {
  return {
    id,
    patientId,
    patientName,
    bed: '301',
    service: 'Medicina Interna',
    date: '2025-02-20',
    time: '10:00',
    noteType: 'Nota de Evolución',
    content: `Evolución de ${patientName}`,
    auditHash: `HASH-${id}`,
    residentAuthor: 'Dr. Prueba',
    createdAtTimestamp: 1740045600000,
  };
}

test('Flujo completo de aislamiento multi-cuenta (Cuenta A -> Logout -> Cuenta B -> Cuenta A -> Cuenta B)', () => {
  mockStorage.clear();

  // 1. Estado inicial sin autenticar: no debe mostrar ningún paciente ni mutar almacenamiento
  setActiveAccountNamespace(UNAUTHENTICATED_NAMESPACE);
  assert.equal(getActiveAccountNamespace(), UNAUTHENTICATED_NAMESPACE);
  assert.deepEqual(loadPatients(), []);
  assert.deepEqual(loadNotes(), []);

  // 2. Cuenta A inicia sesión y crea pacientes ficticios A1 y A2
  const uidA = 'uid-google-user-AAA111';
  const emailA = 'cuenta.a@hospital.mx';
  const nsA = activateAuthenticatedUserNamespace(uidA, emailA);
  assert.equal(nsA, `uid:${uidA}`);
  assert.equal(getActiveAccountNamespace(), `uid:${uidA}`);
  assert.deepEqual(loadPatients(), []);

  const patientA1 = createDummyPatient('A1', 'Paciente Ficticio A1', 'Cama 101');
  const patientA2 = createDummyPatient('A2', 'Paciente Ficticio A2', 'Cama 102');
  const noteA1 = createDummyNote('N-A1', 'A1', 'Paciente Ficticio A1');

  savePatients([patientA1, patientA2]);
  saveNotes([noteA1]);
  recordDeletedPatient('A-DEL', 'EXP-ADEL', '2025-02-20T11:00:00.000Z');
  recordOfflineMutation('patient_created', 'A1', 'Creado A1');
  setLastSyncTime('2025-02-20T11:05:00.000Z');

  assert.deepEqual(
    loadPatients().map((p) => p.id),
    ['A1', 'A2']
  );
  assert.equal(loadNotes().length, 1);
  assert.equal(getPendingMutations().length, 1);

  // 3. Cuenta A cierra sesión: una sesión sin autenticar NO muestra datos privados de A
  setActiveAccountNamespace(UNAUTHENTICATED_NAMESPACE);
  assert.deepEqual(loadPatients(), []);
  assert.deepEqual(loadNotes(), []);
  assert.deepEqual(loadDeletedPatients(), {});

  // 4. Cuenta B inicia sesión en el mismo navegador y dominio: NO ve A1 ni A2, ni las mutaciones de A
  const uidB = 'uid-google-user-BBB222';
  const emailB = 'cuenta.b@hospital.mx';
  const nsB = activateAuthenticatedUserNamespace(uidB, emailB);
  assert.equal(nsB, `uid:${uidB}`);
  assert.equal(getActiveAccountNamespace(), `uid:${uidB}`);

  assert.deepEqual(loadPatients(), [], 'Cuenta B no debe ver pacientes de Cuenta A');
  assert.deepEqual(loadNotes(), [], 'Cuenta B no debe ver notas de Cuenta A');
  assert.deepEqual(loadDeletedPatients(), {}, 'Cuenta B no debe ver registros de borrado de Cuenta A');
  assert.deepEqual(getPendingMutations(), [], 'Cuenta B no debe heredar cola de mutaciones offline de Cuenta A');
  assert.equal(getLastSyncTime(), null, 'Cuenta B no debe heredar marca de tiempo de sincronización de Cuenta A');

  // 5. Cuenta B crea el paciente B1
  const patientB1 = createDummyPatient('B1', 'Paciente Ficticio B1', 'Cama 201');
  savePatients([patientB1]);
  recordOfflineMutation('patient_created', 'B1', 'Creado B1');
  assert.deepEqual(
    loadPatients().map((p) => p.id),
    ['B1']
  );

  // 6. Al regresar a la Cuenta A, solo aparecen A1 y A2
  activateAuthenticatedUserNamespace(uidA, emailA);
  assert.deepEqual(
    loadPatients().map((p) => p.id),
    ['A1', 'A2'],
    'Al volver a Cuenta A, solo deben aparecer A1 y A2'
  );
  assert.equal(loadNotes().length, 1);
  assert.equal(loadNotes()[0].id, 'N-A1');
  assert.ok(loadDeletedPatients()['A-DEL']);

  // 7. Al volver a la Cuenta B, aparece B1 y no aparecen los pacientes de A
  activateAuthenticatedUserNamespace(uidB, emailB);
  assert.deepEqual(
    loadPatients().map((p) => p.id),
    ['B1'],
    'Al volver a Cuenta B, solo debe aparecer B1'
  );
  assert.deepEqual(loadNotes(), []);

  // 8. Simulación de recarga de página y cierre/reapertura de sesión
  setActiveAccountNamespace(UNAUTHENTICATED_NAMESPACE);
  assert.deepEqual(loadPatients(), []);

  activateAuthenticatedUserNamespace(uidA, emailA);
  assert.deepEqual(
    loadPatients().map((p) => p.id),
    ['A1', 'A2']
  );

  activateAuthenticatedUserNamespace(uidB, emailB);
  assert.deepEqual(
    loadPatients().map((p) => p.id),
    ['B1']
  );
});

test('Migración segura de datos heredados por correo electrónico al espacio basado en UID sin pérdida ni sobrescritura', () => {
  mockStorage.clear();

  const legacyEmail = 'residente.antiguo@hospital.mx';
  const uidLegacy = 'uid-legacy-999';

  // Simulamos datos preexistentes guardados bajo el esquema antiguo basado solo en correo
  setActiveAccountNamespace(legacyEmail);
  const legacyKey = getScopedKey('patients', legacyEmail);
  assert.equal(legacyKey, 'resimed_acct_residente.antiguo@hospital.mx_patients_v2');

  const legacyPatient = createDummyPatient('LEG-1', 'Paciente Heredado', 'Cama 305');
  savePatients([legacyPatient], legacyEmail);

  // Al iniciar sesión con Firebase Auth que provee uid + email, se migra automáticamente al namespace UID
  const newUidNs = activateAuthenticatedUserNamespace(uidLegacy, legacyEmail);
  assert.equal(newUidNs, `uid:${uidLegacy}`);

  const migratedPatients = loadPatients();
  assert.equal(migratedPatients.length, 1);
  assert.equal(migratedPatients[0].id, 'LEG-1');

  // El respaldo original en la clave legacy no se borra destructivamente
  assert.ok(mockStorage.getItem(legacyKey), 'La clave legacy original se conserva de forma segura');
});

test('Manejo de error 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT en Google Drive sin pérdida de datos ni contaminación', async () => {
  mockStorage.clear();

  const uidB = 'uid-user-403-test';
  const emailB = 'usuario403@hospital.mx';
  activateAuthenticatedUserNamespace(uidB, emailB);

  const localPatientB = createDummyPatient('B-LOCAL', 'Paciente Local Seguro', 'Cama 401');
  savePatients([localPatientB]);

  // Simulamos usuario y token guardados donde Google devuelve 403 por falta de scope drive.file
  mockStorage.setItem(
    'resimed_gdrive_user_info_v2',
    JSON.stringify({
      uid: uidB,
      email: emailB,
      displayName: 'Usuario B',
      hasDriveScope: true,
    })
  );
  mockStorage.setItem('resimed_gdrive_access_token_v2', 'token-sin-scope-drive');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: 403,
          message: 'Request had insufficient authentication scopes.',
          status: 'PERMISSION_DENIED',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
              reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
            },
          ],
        },
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );

  try {
    await assert.rejects(
      async () => {
        await findDriveCensusFile('token-sin-scope-drive');
      },
      (err: any) => err?.message === 'DRIVE_SCOPE_INSUFFICIENT',
      'Debe lanzar DRIVE_SCOPE_INSUFFICIENT ante un error HTTP 403 de scopes'
    );

    // El token insuficiente debe haberse limpiado para evitar bucles infinitos de error 403
    const tokenAfter403 = await getAccessToken();
    assert.equal(tokenAfter403, null, 'El token sin permisos debe invalidarse inmediatamente');

    // El estado del usuario debe reflejar hasDriveScope: false
    const updatedUser = getSavedDriveUser();
    assert.equal(updatedUser?.hasDriveScope, false);

    // El censo local de la cuenta B permanece intacto
    assert.deepEqual(
      loadPatients().map((p) => p.id),
      ['B-LOCAL']
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
