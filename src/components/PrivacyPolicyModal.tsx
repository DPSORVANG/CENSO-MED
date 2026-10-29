import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FileText,
  X,
  Lock,
  Cloud,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export type LegalDocTab = 'privacy' | 'terms';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  initialTab?: LegalDocTab;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  initialTab = 'privacy',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalDocTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-5 overflow-hidden overscroll-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950/70 to-slate-900 text-white p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-2xl shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-extrabold text-white">
                  {activeTab === 'privacy'
                    ? 'Política de Privacidad — ResiMed MI'
                    : 'Condiciones del Servicio — ResiMed MI'}
                </h2>
                <span className="bg-teal-950 text-teal-300 border border-teal-800 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  Google API Limited Use & NOM-004
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                Información oficial sobre el tratamiento de datos clínicos, sincronización en Google Drive y confidencialidad médica.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar política de privacidad"
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Cerrar</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Política de Privacidad</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'terms'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Condiciones del Servicio</span>
            </button>
          </div>

          <a
            href={activeTab === 'privacy' ? '/privacidad.html' : '/terminos.html'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
          >
            <span>
              Abrir versión independiente ({activeTab === 'privacy' ? '/privacidad.html' : '/terminos.html'})
            </span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Document Body */}
        <div className="flex-1 min-h-0 p-4 sm:p-7 overflow-y-auto overscroll-contain touch-pan-y space-y-5 text-xs sm:text-sm leading-relaxed">
          {activeTab === 'privacy' ? (
            <>
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/70 space-y-2">
                <div className="flex items-center gap-2 font-bold text-teal-900 dark:text-teal-300 text-xs sm:text-sm">
                  <Cloud className="w-4 h-4 shrink-0" />
                  <span>Resumen Ejecutivo de Privacidad</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                  <strong>ResiMed MI</strong> funciona bajo una arquitectura de <strong>propiedad exclusiva de datos por el usuario o institución médica</strong>. La aplicación no almacena información de pacientes en servidores propios de terceros: todos los registros residen únicamente en tu navegador local y en el archivo privado <code className="font-mono text-teal-700 dark:text-teal-300">ResiMed-Censo-MI.json</code> dentro de tu propia cuenta de <strong>Google Drive</strong>.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  1. Identidad y Finalidad de la Aplicación
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-[13px]">
                  <strong>ResiMed MI</strong> es un sistema clínico de gestión de censo hospitalario, seguimiento longitudinal de laboratorios multipanel, control de días de antibiótico, calculadoras médicas y generación estructurada de notas de evolución conforme a la <strong>NOM-004-SSA3-2012</strong> para servicios de Medicina Interna.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  2. Datos Recopilados y Permisos de Google OAuth 2.0
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-[13px]">
                  Cuando decides iniciar sesión con tu cuenta de Google, ResiMed MI solicita únicamente los permisos mínimos indispensables para sincronizar el censo clínico de tu servicio:
                </p>
                <ul className="space-y-2 pl-1 text-xs sm:text-[13px] text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Datos básicos de cuenta (<code>email</code>, <code>profile</code>, <code>openid</code>):</strong> Utilizados exclusivamente para identificar la sesión activa en la barra superior de la aplicación y aislar los datos locales por cada cuenta institucional.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Acceso a Google Drive para el archivo del censo (<code>drive.file</code> / archivo de aplicación):</strong> Utilizado única y exclusivamente para buscar, crear, leer y actualizar el archivo <code className="font-mono text-teal-600 dark:text-teal-400">ResiMed-Censo-MI.json</code> en tu unidad de Google Drive. La aplicación no abre, modifica ni elimina ningún otro archivo o carpeta de tu Google Drive.
                    </span>
                  </li>
                </ul>
              </section>

              <section className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 space-y-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                  3. Cumplimiento con la Política de Datos de Usuario de Google API (Limited Use)
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                  El uso y la transferencia que realiza <strong>ResiMed MI</strong> de la información recibida de las APIs de Google cumplen estrictamente con la{' '}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 dark:text-teal-400 font-bold underline"
                  >
                    Política de Datos de Usuario de los Servicios API de Google (Google API Services User Data Policy)
                  </a>
                  , incluidos los requisitos de <strong>Uso Limitado (Limited Use)</strong>:
                </p>
                <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <li>Los datos sincronizados desde Google Drive se utilizan únicamente para mostrar y actualizar el censo clínico frente al usuario autenticado.</li>
                  <li>Nunca vendemos, alquilamos ni transferimos datos de Google Drive a terceros o intermediarios de datos.</li>
                  <li>Nunca utilizamos datos de usuarios ni información médica para publicidad personalizada ni para entrenar modelos de inteligencia artificial.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  4. Almacenamiento Local, Seguridad y Bloqueo por PIN
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-[13px]">
                  Para permitir el trabajo ininterrumpido en áreas hospitalarias sin conexión a internet (Offline PWA), una copia sincronizada del censo activo se guarda en el almacenamiento local del navegador del dispositivo. La aplicación provee:
                </p>
                <ul className="list-disc list-inside text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 space-y-1">
                  <li><strong>Bloqueo de Sesión por PIN:</strong> Impide el acceso visual en computadoras hospitalarias compartidas cuando el médico se ausenta de la estación.</li>
                  <li><strong>Autorización de Administrador por PIN:</strong> Protege las acciones críticas como bajas definitivas y egresos hospitalarios.</li>
                  <li><strong>Sellos de Integridad (Audit Hash):</strong> Cada nota clínica archivada en la bóveda genera una huella verificable de fecha, hora y autor.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  5. Conservación, Eliminación de Datos y Revocación de Acceso
                </h3>
                <ul className="list-disc list-inside text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 space-y-1.5">
                  <li><strong>Depuración automática de egresos:</strong> Los pacientes dados de alta se conservan durante 5 días en el historial reciente y posteriormente se depuran automáticamente del censo activo para minimizar el almacenamiento de datos.</li>
                  <li><strong>Eliminación inmediata:</strong> Cuando un usuario autorizado elimina un paciente o vacía su censo, la baja se replica de forma inmediata tanto en el dispositivo local como en el archivo de Google Drive.</li>
                  <li><strong>Revocación de permisos OAuth:</strong> Puedes desconectar tu cuenta en cualquier momento desde el botón <em>&ldquo;Cambiar Cuenta / Salir&rdquo;</em> o revocar el acceso directamente en{' '}
                    <a
                      href="https://myaccount.google.com/permissions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 dark:text-teal-400 font-bold underline"
                    >
                      myaccount.google.com/permissions
                    </a>.
                  </li>
                </ul>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  1. Uso Exclusivo por Profesionales de la Salud
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-[13px]">
                  <strong>ResiMed MI</strong> es una herramienta de apoyo clínico y administrativo diseñada para médicos residentes, médicos adscritos, médicos internos de pregrado y personal de salud autorizado. El usuario se compromete a utilizar la plataforma en estricto apego a la ética médica, el secreto profesional y la normativa vigente de su institución de salud.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  2. Alcance de las Calculadoras y Alertas Clínicas
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-[13px]">
                  Las calculadoras médicas integradas (incluyendo CKD-EPI, Cockcroft-Gault, CURB-65, qSOFA, MELD-Na, Escala de Wells, CHA₂DS₂-VASc, Sodio corregido y Calcio corregido), así como los indicadores de tendencia de laboratorio y conteo de días de antimicrobianos, constituyen herramientas auxiliares de consulta rápida y no reemplazan el juicio clínico ni la verificación directa por parte del médico tratante.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  3. Custodia de Credenciales y Dispositivos Compartidos
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-[13px]">
                  Cuando un servicio médico opta por sincronizar su censo mediante una cuenta institucional de Google Drive, es responsabilidad de los usuarios autorizados resguardar el acceso a dicha cuenta, activar el bloqueo por PIN en computadoras compartidas y realizar respaldos periódicos cuando su normativa hospitalaria así lo requiera.
                </p>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500">
            ResiMed MI • Vigente a partir de octubre de 2026
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
          >
            Entendido y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
