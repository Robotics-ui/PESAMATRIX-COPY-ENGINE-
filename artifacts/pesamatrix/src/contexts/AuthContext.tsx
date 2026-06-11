import { createContext, useContext, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import type { UserProfile } from "@workspace/api-client-react";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("accessToken"));

  const { data, isLoading, error } = useGetMe({
    query: {
      queryKey: ["getMe", token],
      enabled: !!token,
      retry: false,
    },
  });

  const user = data?.user ?? null;

  const login = (newToken: string, _user: UserProfile) => {
    localStorage.setItem("accessToken", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    setToken(null);
  };

  if (error && token) {
    logout();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isLoading && !!token,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
