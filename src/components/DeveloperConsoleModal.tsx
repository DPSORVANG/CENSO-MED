import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Lock,
  X,
  FlaskConical,
  Trash2,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Users,
  KeyRound,
} from 'lucide-react';
import {
  verifyDeveloperPin,
  setStoredDeveloperPin,
  getStoredDeveloperPinHash,
} from '../utils/storage.ts';
import { getFirebaseProjectId } from '../utils/googleDriveSync.ts';
import {
  RECAPTCHA_SITE_KEY,
  RECAPTCHA_PROJECT_ID,
  executeAndVerifyRecaptcha,
  RecaptchaVerificationSummary,
} from '../utils/recaptchaEnterprise.ts';

interface DeveloperConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad100Patients: () => void;
  onLoad3DemoPatients: () => void;
  onClearAllPatients: () => void;
  currentPatientCount?: number;
  showToast?: (msg: string) => void;
}

export const DeveloperConsoleModal: React.FC<DeveloperConsoleModalProps> = ({
  isOpen,
  onClose,
  onLoad100Patients,
  onLoad3DemoPatients,
  onClearAllPatients,
  currentPatientCount = 0,
  showToast,
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [newDevPin, setNewDevPin] = useState('');
  const [pinSavedMsg, setPinSavedMsg] = useState(false);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [recaptchaResult, setRecaptchaResult] = useState<RecaptchaVerificationSummary | null>(null);
  const [isVerifyingRecaptcha, setIsVerifyingRecaptcha] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsUnlocked(false);
      setPin('');
      setPinError(false);
      setConfirmClear(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentDomain =
    typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
  const currentHttpsOrigin =
    typeof window !== 'undefined' && window.location.origin.startsWith('http')
      ? window.location.origin.replace(/^http:\/\//i, 'https://')
      : `https://${currentDomain}`;
  const privacyHttpsUrl = `${currentHttpsOrigin}/privacidad.html`;
  const termsHttpsUrl = `${currentHttpsOrigin}/terminos.html`;
  const firebaseProjectId = getFirebaseProjectId() || RECAPTCHA_PROJECT_ID;

  const copyTextValue = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setPinError(false);
      if (nextPin.length === 4) {
        if (verifyDeveloperPin(nextPin)) {
          setTimeout(() => {
            setPin('');
            setIsUnlocked(true);
          }, 120);
        } else {
          setPinError(true);
          setTimeout(() => setPin(''), 450);
        }
      }
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyDeveloperPin(pin)) {
      setPinError(false);
      setPin('');
      setIsUnlocked(true);
    } else {
      setPinError(true);
      setPin('');
    }
  };

  const handleSaveNewDevPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newDevPin.trim();
    if (cleaned.length < 4) return;
    setStoredDeveloperPin(cleaned);
    setNewDevPin('');
    setPinSavedMsg(true);
    setTimeout(() => setPinSavedMsg(false), 2500);
    showToast?.('PIN Especial de Desarrollador actualizado.');
  };

  const handleManualRecaptchaVerify = async () => {
    setIsVerifyingRecaptcha(true);
    try {
      const res = await executeAndVerifyRecaptcha('LOGIN');
      setRecaptchaResult(res);
      showToast?.(res.statusMessage);
    } finally {
      setIsVerifyingRecaptcha(false);
    }
  };

  // Locked View: Special Developer PIN Gate
  if (!isUnlocked) {
    return (
      <div className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-slate-100 animate-in fade-in zoom-in-95">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 mx-auto flex items-center justify-center">
              <Terminal className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white">Acceso de Desarrollador</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ingresa el PIN Especial de Desarrollador para acceder a las herramientas de simulación clínica, vaciado de censo y configuración de OAuth / reCAPTCHA.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4 pt-2">
              <div className="flex justify-center gap-3 my-2">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                      pin.length > idx
                        ? 'bg-purple-500 border-purple-500 scale-110 shadow-sm'
                        : 'border-slate-700 bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-semibold bg-rose-500/10 py-1.5 px-3 rounded-lg border border-rose-500/20">
                  <AlertCircle className="w-4 h-4" />
                  <span>PIN de desarrollador incorrecto.</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleDigit(digit)}
                    className="h-10 text-base font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 active:scale-95 transition-transform cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPin('')}
                  className="h-10 text-xs font-semibold rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Borrar
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('0')}
                  className="h-10 text-base font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 active:scale-95 transition-transform cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPin((prev) => prev.slice(0, -1))}
                  className="h-10 text-xs font-semibold rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  ⌫
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Unlocked Developer Console View
  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-hidden overscroll-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-purple-950/60 to-slate-900 p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-2xl shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Consola Oculta de Desarrollador y Pruebas (QA)
                </h2>
                <span className="bg-purple-950 text-purple-300 border border-purple-700 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  PIN Verificado
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                Panel privado para simulación de pacientes, limpieza de base de datos y configuración de Google Cloud OAuth / reCAPTCHA.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Cerrar</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-5 overflow-y-auto overscroll-contain touch-pan-y text-xs">
          {/* Section 1: Stress Test & Database Simulation */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-purple-300 text-sm">
                <FlaskConical className="w-4 h-4" />
                <h3>1. Simulación Clínica y Pruebas de Estrés (Censo)</h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                {currentPatientCount} pac. actuales
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11.5px]">
              Estas herramientas son exclusivas para pruebas de rendimiento y validación del sistema. No son visibles para los usuarios normales.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  onLoad100Patients();
                  onClose();
                }}
                className="p-3 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/40 text-left space-y-1 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-purple-200">
                  <FlaskConical className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Cargar 100 Pacientes</span>
                </div>
                <p className="text-[10.5px] text-purple-300/80 leading-snug">
                  Puebla el censo con 100 pacientes completos (labs multipanel, antibióticos y notas).
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  onLoad3DemoPatients();
                  onClose();
                }}
                className="p-3 rounded-xl bg-teal-950/40 hover:bg-teal-900/50 border border-teal-500/40 text-left space-y-1 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-teal-200">
                  <Users className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Cargar 3 Pacientes Demo</span>
                </div>
                <p className="text-[10.5px] text-teal-300/80 leading-snug">
                  Carga únicamente 3 pacientes de ejemplo clínico para demostración rápida.
                </p>
              </button>

              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="p-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 text-left space-y-1 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-bold text-rose-200">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Vaciar Censo (0)</span>
                  </div>
                  <p className="text-[10.5px] text-rose-300/80 leading-snug">
                    Elimina todos los pacientes actuales y deja el censo limpio en 0.
                  </p>
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-rose-950 border border-rose-500 space-y-2 flex flex-col justify-between">
                  <span className="text-[10.5px] font-bold text-rose-200">
                    ¿Confirmas vaciar el censo a 0 pacientes?
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllPatients();
                        setConfirmClear(false);
                        onClose();
                      }}
                      className="flex-1 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[10.5px] cursor-pointer"
                    >
                      Sí, Vaciar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[10.5px] cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Google Cloud OAuth & Vercel URLs */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
              <KeyRound className="w-4 h-4" />
              <h3>2. Configuración Google OAuth & Vercel (Desbloqueo y Vínculos)</h3>
            </div>
            <p className="text-slate-400 text-[11.5px] leading-relaxed">
              Usa estos accesos directos y copiadores con formato exacto para publicar tu aplicación en Google Cloud (<code className="text-teal-300 font-mono">{firebaseProjectId}</code>) y evitar el aviso de &ldquo;Acceso bloqueado: la app se está probando&rdquo;.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://console.cloud.google.com/apis/credentials/consent?project=${firebaseProjectId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] transition-colors"
              >
                <span>1. Abrir OAuth Consent Screen (Publicar App)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] transition-colors"
              >
                <span>2. Abrir Dominios Autorizados en Firebase</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-[11px] font-bold text-teal-300">
                A) Vínculos para &ldquo;Dominio de la aplicación&rdquo; en Google OAuth (DEBEN llevar <code>https://</code>):
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-400 text-[11px]">Página Principal:</span>
                <div className="flex items-center gap-1.5">
                  <code className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-emerald-300 text-[10.5px]">
                    {currentHttpsOrigin}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyTextValue('home', currentHttpsOrigin)}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'home' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedField === 'home' ? '¡Copiado!' : 'Copiar https://'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-400 text-[11px]">Política de Privacidad:</span>
                <div className="flex items-center gap-1.5">
                  <code className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-emerald-300 text-[10.5px]">
                    {privacyHttpsUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyTextValue('privacy', privacyHttpsUrl)}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'privacy' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedField === 'privacy' ? '¡Copiado!' : 'Copiar https://'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-400 text-[11px]">Condiciones del Servicio:</span>
                <div className="flex items-center gap-1.5">
                  <code className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-emerald-300 text-[10.5px]">
                    {termsHttpsUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyTextValue('terms', termsHttpsUrl)}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'terms' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedField === 'terms' ? '¡Copiado!' : 'Copiar https://'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-amber-300 font-bold text-[11px]">
                  B) Dominios Autorizados (va SIN <code>https://</code>):
                </span>
                <div className="flex items-center gap-1.5">
                  <code className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-teal-300 text-[10.5px]">
                    {currentDomain}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyTextValue('domain', currentDomain)}
                    className="px-2 py-0.5 bg-teal-600 hover:bg-teal-500 text-white rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'domain' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedField === 'domain' ? '¡Copiado!' : 'Copiar dominio'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: reCAPTCHA Enterprise Verification */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-teal-500/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-teal-300 text-sm">
                <ShieldCheck className="w-4 h-4" />
                <h3>3. Verificación Google reCAPTCHA Enterprise</h3>
              </div>
              <button
                type="button"
                onClick={handleManualRecaptchaVerify}
                disabled={isVerifyingRecaptcha}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingRecaptcha ? 'animate-spin' : ''}`} />
                <span>
                  {isVerifyingRecaptcha
                    ? 'Ejecutando evaluación...'
                    : 'Disparar Evento reCAPTCHA (LOGIN)'}
                </span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1">
              <div>
                Clave del Sitio:{' '}
                <code className="text-slate-200 font-mono">{RECAPTCHA_SITE_KEY}</code>
              </div>
              <div>
                Proyecto Google Cloud:{' '}
                <code className="text-slate-200 font-mono">{RECAPTCHA_PROJECT_ID}</code>
              </div>
              {recaptchaResult && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-900 border border-emerald-800/60 text-emerald-300 font-mono text-[10.5px] space-y-1">
                  <div>
                    ✓ Estado: {recaptchaResult.statusMessage} (Score:{' '}
                    {(recaptchaResult.score ?? 0.9).toFixed(2)})
                  </div>
                  <div className="truncate text-slate-400">
                    Endpoint: {recaptchaResult.endpointUrl}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Update Developer PIN */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-200 text-xs">
                <Lock className="w-4 h-4 text-purple-400" />
                <span>PIN Especial de Desarrollador</span>
              </div>
              <span className="text-[10.5px] text-slate-400">
                {getStoredDeveloperPinHash() ? 'PIN personalizado activo' : 'PIN por defecto: 2580'}
              </span>
            </div>
            <form onSubmit={handleSaveNewDevPin} className="flex items-center gap-2">
              <input
                type="password"
                maxLength={6}
                value={newDevPin}
                onChange={(e) => setNewDevPin(e.target.value)}
                placeholder="Nuevo PIN Desarrollador (4 dígitos)"
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl font-mono text-center tracking-widest text-white text-xs"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                {pinSavedMsg ? '¡Guardado!' : 'Cambiar PIN Dev'}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3.5 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            ResiMed MI • Developer & QA Console
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
          >
            Cerrar Consola
          </button>
        </div>
      </div>
    </div>
  );
};
