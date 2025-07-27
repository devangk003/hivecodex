import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User, authAPI, activityAPI } from "@/lib/api";
import socketService from "@/lib/socket";

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  token: string | null;
  activityStatus: string;
  setActivityStatus: (status: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activityStatus, setActivityStatusState] = useState<string>("Online");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (storedToken && storedUser && storedUser !== "undefined") {
        try {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
          if (parsedUser.activityStatus)
            setActivityStatusState(parsedUser.activityStatus);

          // Connect socket only if not already connected
          if (!socketService.isConnected()) {
            socketService.connect(storedToken);
          }

          // Verify token is still valid
          const userData = await authAPI.getCurrentUser();
          setUser(userData);
          if (userData.activityStatus)
            setActivityStatusState(userData.activityStatus);
          console.log("Token verified successfully, user:", userData);
        } catch (error) {
          console.error("Token verification failed:", error);
          console.log("Stored token:", storedToken ? "Present" : "Missing");
          console.log("Stored user:", storedUser ? "Present" : "Missing");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setToken(null);
          setUser(null);
        }
      } else {
        // Clean up invalid localStorage entries
        if (storedUser === "undefined") {
          localStorage.removeItem("user");
        }
      }
      setIsLoading(false);
    };

    initAuth();

    // Cleanup function to disconnect socket when component unmounts
    return () => {
      socketService.disconnect();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password);
    const { token: newToken, user: userData } = response;

    setToken(newToken);
    setUser(userData);
    if (userData.activityStatus)
      setActivityStatusState(userData.activityStatus);

    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(userData));

    // Connect socket
    socketService.connect(newToken);
  };

  const register = async (name: string, email: string, password: string) => {
    await authAPI.register(name, email, password);
    // After successful registration, automatically log in the user
    await login(email, password);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Disconnect socket
    socketService.disconnect();
  };

  // Sitewide activity status setter
  const setActivityStatus = async (status: string) => {
    await activityAPI.setStatus(status);
    setActivityStatusState(status);
    // Optionally update user object in state/localStorage
    setUser((prev) => (prev ? { ...prev, activityStatus: status } : prev));
    const storedUser = localStorage.getItem("user");
    if (storedUser && storedUser !== "undefined") {
      const parsed = JSON.parse(storedUser);
      parsed.activityStatus = status;
      localStorage.setItem("user", JSON.stringify(parsed));
    }
  };

  const value: AuthContextType = {
    user,
    setUser,
    token,
    activityStatus,
    setActivityStatus,
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
