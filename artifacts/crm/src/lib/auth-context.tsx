import { createContext, useContext, ReactNode, useEffect } from "react";
import { useGetMe, getGetMeQueryKey, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsTeam: boolean;
  activeTeamId: number | null;
  papel: string | null;
  checkAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, refetch, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
    }
  });

  const needsTeam = user ? (user.needs_team ?? false) : false;
  const activeTeamId = user?.active_team_id ?? null;
  const papel = user?.papel ?? null;

  useEffect(() => {
    if (isLoading) return;
    if (isError && location !== "/login") {
      setLocation("/login");
    }
    if (user && needsTeam && location !== "/seletor-time") {
      setLocation("/seletor-time");
    }
  }, [isLoading, isError, user, needsTeam, location, setLocation]);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated: !!user,
        needsTeam,
        activeTeamId,
        papel,
        checkAuth: () => refetch(),
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
