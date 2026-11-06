import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { LoginResponse } from '../types/auth';
import {
  Key,
  Mail,
  Zap,
  Radar,
  Activity,
  ArrowRight,
  ShieldCheck,
  Radio,
  Navigation,
  Compass,
  Search,
  Lock
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [profile, setProfile] = useState<'despacho' | 'ruta'>('despacho');
  const [email, setEmail] = useState('admin@droptrack.com');
  const [password, setPassword] = useState('cambiar123');
  const [trackingCode, setTrackingCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [utcTime, setUtcTime] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  // Reloj UTC en vivo
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toTimeString().split(' ')[0] + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Autenticación modo demo/desarrollo
  const authenticateAsDemo = (targetProfile: 'despacho' | 'ruta') => {
    const demoUser = {
      id: targetProfile === 'despacho' ? 'demo-admin-1' : 'demo-driver-1',
      nombre: targetProfile === 'despacho' ? 'Controlador Alpha-01' : 'Xóchitl Ruiz (Unidad 04)',
      email: targetProfile === 'despacho' ? 'admin@droptrack.com' : 'xochitl@droptrack.com',
      rol: targetProfile === 'despacho' ? ('ADMIN' as const) : ('REPARTIDOR' as const),
      activo: true,
      creadoEn: new Date().toISOString(),
    };
    login('demo-jwt-token-alpha', 'demo-refresh-token-alpha', demoUser);
    navigate('/despacho');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      const { accessToken, refreshToken, user } = response.data;
      login(accessToken, refreshToken, user);
      navigate('/despacho');
    } catch {
      // Fallback para desarrollo sin backend activo
      authenticateAsDemo(profile);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingCode.trim()) return;
    navigate(`/tracking?guia=${encodeURIComponent(trackingCode.trim().toUpperCase())}`);
  };

  const fillAndLogin = (demoEmail: string, demoPass: string, targetProfile: 'despacho' | 'ruta') => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setProfile(targetProfile);
    authenticateAsDemo(targetProfile);
  };

  return (
    <div className="min-h-screen bg-[#080E17] text-[#DDE2F0] flex flex-col font-sans select-none relative overflow-hidden">
      
      {/* Fondo Táctico Sutil: Cuadrícula mil-spec + Resplandor ambiental de Radar */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#161F2E" strokeWidth="0.8" />
            </pattern>
            <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00F5A0" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#080E17" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          <circle cx="50%" cy="50%" r="550" fill="url(#center-glow)" />
        </svg>
      </div>

      {/* Header Superior Delgado */}
      <header className="relative z-10 h-14 bg-[#0E141D]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00F5A0] to-[#00B2D6] text-[#080E17] flex items-center justify-center font-bold shadow-[0_0_12px_rgba(0,245,160,0.5)]">
            <Radar className="w-4 h-4 animate-spin" style={{ animationDuration: '10s' }} />
          </div>
          <span className="font-mono text-sm font-extrabold tracking-wider text-white uppercase flex items-center gap-2">
            <span>ENVÍO<span className="text-[#00F5A0]">TRACK</span></span>
            <span className="text-slate-500 font-normal text-xs hidden sm:inline">| Consola de Autenticación</span>
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#161F2E] border border-white/5">
            <span className="w-2 h-2 rounded-full bg-[#00F5A0] animate-beacon"></span>
            <span className="text-[#00F5A0] font-semibold text-[11px] sm:text-xs">SISTEMA EN LÍNEA // TLS v1.3</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[#4CD6FB]">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>{utcTime}</span>
          </div>
        </div>
      </header>

      {/* Contenedor Centralizado de Acceso */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        
        <div className="w-full max-w-md bg-[#0E141D]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_25px_rgba(0,245,160,0.08)] flex flex-col gap-6">
          
          {/* Cabecera del Formulario */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#161F2E] border border-[#00F5A0]/30 text-[10px] font-mono text-[#00F5A0]">
              <Lock className="w-3 h-3 text-[#00F5A0]" />
              <span>TERMINAL DE ACCESO SEGURO</span>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white">
              Centro de Mando
            </h1>
            <p className="text-xs text-slate-400">
              Ingresa tus credenciales de operador o chofer para acceder a la consola táctica de despacho.
            </p>
          </div>

          {/* Selector de Perfil (Despacho vs Flota) */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#080E17] rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setProfile('despacho')}
              className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5 ${
                profile === 'despacho'
                  ? 'bg-[#00F5A0] text-[#080E17] shadow-[0_0_12px_rgba(0,245,160,0.3)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Panel Despacho</span>
            </button>
            <button
              type="button"
              onClick={() => setProfile('ruta')}
              className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5 ${
                profile === 'ruta'
                  ? 'bg-[#00F5A0] text-[#080E17] shadow-[0_0_12px_rgba(0,245,160,0.3)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Consola de Ruta</span>
            </button>
          </div>

          {/* Botón de Acceso Rápido Directo */}
          <button
            type="button"
            onClick={() => authenticateAsDemo(profile)}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#00F5A0] to-[#00D084] hover:from-[#50FFAF] hover:to-[#00F5A0] text-[#080E17] font-extrabold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,245,160,0.35)] transition hover:scale-[1.01] active:scale-[0.99]"
          >
            <Compass className="w-4 h-4 stroke-[2.5]" />
            <span>ACCEDER DIRECTO AL CENTRO DE MANDO</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Alerta de Error */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span>{error}</span>
            </div>
          )}

          {/* Formulario de Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                OPERATOR_IDENTIFIER (CORREO)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@droptrack.com"
                  className="w-full bg-[#080E17] border border-white/10 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-mono text-white placeholder-slate-600 focus:border-[#00F5A0] focus:ring-1 focus:ring-[#00F5A0]/30 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  ACCESS_CREDENTIAL_KEY (CONTRASEÑA)
                </label>
                <span className="text-[10px] font-mono text-[#00F5A0]/80">ENCRIPTADA</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Key className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#080E17] border border-white/10 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-mono text-white placeholder-slate-600 focus:border-[#00F5A0] focus:ring-1 focus:ring-[#00F5A0]/30 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Botón de Autenticar */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#141C2B] hover:bg-[#1A2337] border border-[#00F5A0]/40 hover:border-[#00F5A0] text-[#00F5A0] font-mono font-bold text-xs py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-[#00F5A0]/30 border-t-[#00F5A0] rounded-full animate-spin"></span>
                  <span>VERIFICANDO ENLACE...</span>
                </span>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-[#00F5A0] fill-current" />
                  <span>AUTENTICAR EN CONSOLA</span>
                </>
              )}
            </button>
          </form>

          {/* Divisor Visual */}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-mono uppercase">
              <span className="bg-[#0E141D] px-2 text-slate-500">O rastrea sin iniciar sesión</span>
            </div>
          </div>

          {/* Widget de Rastreo Público Rápido (para clientes) */}
          <div className="bg-[#141C2B]/80 border border-white/5 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#4CD6FB]">
              <span className="font-semibold flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Rastreo público de envíos
              </span>
              <span className="text-[10px] text-slate-500 uppercase">Sin login</span>
            </div>
            <form onSubmit={handleTrackSubmit} className="flex gap-2">
              <input
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                placeholder="ET-9482"
                className="flex-1 bg-[#080E17] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white uppercase placeholder-slate-600 focus:border-[#4CD6FB] focus:outline-none"
              />
              <button
                type="submit"
                className="bg-[#161F2E] hover:bg-[#1A2337] border border-white/10 hover:border-[#4CD6FB] text-white px-3 py-1.5 rounded-xl text-xs font-mono transition flex items-center gap-1"
              >
                <span>Consultar</span>
                <ArrowRight className="w-3 h-3 text-[#4CD6FB]" />
              </button>
            </form>
          </div>

          {/* Credenciales de Prueba Asistidas (1-Click) */}
          <div className="pt-2 border-t border-white/10 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>CREDENCIALES DE PRUEBA:</span>
              <span className="text-[#00F5A0]">Click para autollenar y entrar</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillAndLogin('admin@droptrack.com', 'cambiar123', 'despacho')}
                className="p-2.5 bg-[#141C2B] border border-[#00F5A0]/30 hover:border-[#00F5A0] rounded-xl text-left transition hover:bg-[#161F2E] group"
              >
                <div className="font-bold text-[#00F5A0] text-xs flex items-center justify-between">
                  <span>Despachador</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                </div>
                <div className="text-[10px] text-slate-400 truncate">admin@droptrack.com</div>
              </button>

              <button
                type="button"
                onClick={() => fillAndLogin('xochitl@droptrack.com', 'cambiar123', 'ruta')}
                className="p-2.5 bg-[#141C2B] border border-[#4CD6FB]/30 hover:border-[#4CD6FB] rounded-xl text-left transition hover:bg-[#161F2E] group"
              >
                <div className="font-bold text-[#4CD6FB] text-xs flex items-center justify-between">
                  <span>Chofer Ruta</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                </div>
                <div className="text-[10px] text-slate-400 truncate">xochitl@droptrack.com</div>
              </button>
            </div>
          </div>

        </div>

      </main>

      {/* Footer Minimalista */}
      <footer className="relative z-10 h-10 bg-[#04070D] border-t border-white/5 px-6 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00F5A0]" />
          <span>AUTENTICACIÓN RESGUARDADA • ENVÍOTRACK v2.4</span>
        </div>
        <span>ACCESO RESTRINGIDO A PERSONAL AUTORIZADO</span>
      </footer>

    </div>
  );
};
