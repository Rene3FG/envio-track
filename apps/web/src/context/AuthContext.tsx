import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserDto } from '../types/auth';

interface AuthContextType {
  user: UserDto | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (accessToken: string, refreshToken: string, user: UserDto) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(() => {
    const saved = localStorage.getItem('et_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (accessToken: string, refreshToken: string, userData: UserDto) => {
    localStorage.setItem('et_access_token', accessToken);
    localStorage.setItem('et_refresh_token', refreshToken);
    localStorage.setItem('et_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('et_access_token');
    localStorage.removeItem('et_refresh_token');
    localStorage.removeItem('et_user');
    setUser(null);
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('et_user');
      setUser(saved ? JSON.parse(saved) : null);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.rol === 'ADMIN',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
