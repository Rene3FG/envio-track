import React, { useState } from 'react';
import { X, UserPlus, Pencil, AlertTriangle, Save } from 'lucide-react';
import { DriverItem } from '../types/dispatch';
import { OAXACA_ZONES } from './PackageFormModal';

export interface DriverFormValues {
  nombre: string;
  email: string;
  password: string;
  telefono: string;
  unidad: string;
  tipo: DriverItem['tipo'];
  capacidadMaxima: number;
  zona: string;
}

interface DriverFormModalProps {
  mode: 'create' | 'edit';
  initialDriver?: DriverItem | null;
  existingEmails: string[];
  onClose: () => void;
  onSubmit: (values: DriverFormValues) => Promise<void> | void;
}

const DEFAULT_CAPACITY_BY_TYPE: Record<DriverItem['tipo'], number> = {
  MOTO: 5,
  EV: 15,
  VAN: 18,
  CAMION: 30,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DriverFormModal: React.FC<DriverFormModalProps> = ({
  mode,
  initialDriver,
  existingEmails,
  onClose,
  onSubmit,
}) => {
  const isEdit = mode === 'edit' && Boolean(initialDriver);

  const [nombre, setNombre] = useState(initialDriver?.nombre ?? '');
  const [email, setEmail] = useState(initialDriver?.email ?? '');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState(initialDriver?.telefono ?? '');
  const [unidad, setUnidad] = useState(initialDriver?.unidad ?? '');
  const [tipo, setTipo] = useState<DriverItem['tipo']>(initialDriver?.tipo ?? 'VAN');
  const [capacidadMaxima, setCapacidadMaxima] = useState<number>(
    initialDriver?.capacidadMaxima ?? DEFAULT_CAPACITY_BY_TYPE.VAN
  );
  const [zona, setZona] = useState(initialDriver?.zona ?? OAXACA_ZONES[0].nombre);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTipoChange = (nextTipo: DriverItem['tipo']) => {
    setTipo(nextTipo);
    if (!isEdit) {
      setCapacidadMaxima(DEFAULT_CAPACITY_BY_TYPE[nextTipo]);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedNombre = nombre.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedUnidad = unidad.trim();

    if (trimmedNombre.length < 2) {
      setValidationError('El nombre debe tener al menos 2 caracteres.');
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setValidationError('El correo electrónico no tiene un formato válido.');
      return;
    }

    const originalEmail = initialDriver?.email.trim().toLowerCase();
    const isDuplicateEmail = existingEmails.some(
      (existing) => existing.toLowerCase() === normalizedEmail && existing.toLowerCase() !== originalEmail
    );
    if (isDuplicateEmail) {
      setValidationError('Ya existe un chofer registrado con ese correo electrónico.');
      return;
    }

    if (!isEdit && password.length < 6) {
      setValidationError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (isEdit && password.length > 0 && password.length < 6) {
      setValidationError('Si deseas cambiar la contraseña, debe tener al menos 6 caracteres.');
      return;
    }

    if (!Number.isFinite(capacidadMaxima) || capacidadMaxima < 1 || capacidadMaxima > 200) {
      setValidationError('La capacidad máxima debe estar entre 1 y 200 paquetes.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        nombre: trimmedNombre,
        email: normalizedEmail,
        password,
        telefono: telefono.trim() || '+52 951 000 0000',
        unidad: trimmedUnidad || `${tipo === 'MOTO' ? 'Moto' : tipo === 'CAMION' ? 'Camión' : 'Van'} Asignada`,
        tipo,
        capacidadMaxima: Math.round(capacidadMaxima),
        zona: zona.trim() || OAXACA_ZONES[0].nombre,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0B111E] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Cabecera */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#0B111E] shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isEdit
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
              }`}
            >
              {isEdit ? <Pencil className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {isEdit ? `Editar Chofer — ${initialDriver?.nombre}` : 'Alta de Nuevo Chofer'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEdit
                  ? 'Actualiza los datos del repartidor y su unidad asignada.'
                  : 'Registra una cuenta con rol REPARTIDOR y asigna su vehículo.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-mono">
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 mb-1">Nombre Completo *</label>
            <input
              type="text"
              required
              minLength={2}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Luis Hernández López"
              className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Correo Electrónico *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chofer@enviotrack.com"
                className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">
                {isEdit ? 'Nueva Contraseña (opcional)' : 'Contraseña *'}
              </label>
              <input
                type="password"
                required={!isEdit}
                minLength={isEdit ? undefined : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? 'Dejar vacío para mantener' : 'Mínimo 6 caracteres'}
                className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Teléfono</label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+52 951 500 1234"
                className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Zona Base (Oaxaca)</label>
              <select
                value={zona}
                onChange={(e) => setZona(e.target.value)}
                className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white cursor-pointer"
              >
                {OAXACA_ZONES.map((z) => (
                  <option key={z.nombre} value={z.nombre} className="bg-[#0B111E]">
                    {z.nombre}
                  </option>
                ))}
                {!OAXACA_ZONES.some((z) => z.nombre === zona) && zona && (
                  <option value={zona} className="bg-[#0B111E]">
                    {zona}
                  </option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-slate-300 mb-1">Tipo Vehículo</label>
              <select
                value={tipo}
                onChange={(e) => handleTipoChange(e.target.value as DriverItem['tipo'])}
                className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white cursor-pointer"
              >
                <option value="EV" className="bg-[#0B111E]">🚐 Van EV</option>
                <option value="VAN" className="bg-[#0B111E]">🚐 Van</option>
                <option value="MOTO" className="bg-[#0B111E]">🏍️ Moto</option>
                <option value="CAMION" className="bg-[#0B111E]">🚚 Camión</option>
              </select>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-slate-300 mb-1">Unidad</label>
              <input
                type="text"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="Van #05"
                className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-slate-300 mb-1">Capacidad Máx.</label>
              <input
                type="number"
                min={1}
                max={200}
                required
                value={capacidadMaxima}
                onChange={(e) => setCapacidadMaxima(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#070B14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 rounded-xl text-white font-bold flex items-center gap-1.5 transition disabled:opacity-50 ${
                isEdit ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {isEdit ? <Save className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>
                {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Registrar Chofer'}
              </span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
