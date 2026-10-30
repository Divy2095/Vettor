import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { clearAuthSession, ensureSession } from "@/lib/auth";

export default function AdminRoute({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [status, setStatus] = useState("unauthorized");

  useEffect(() => {
    const verify = async () => {
      const valid = await ensureSession();
      if (!valid) {
        setStatus("unauthorized");
        setIsChecking(false);
        return;
      }

      const rawUser = localStorage.getItem("authUser");
      try {
        const user = rawUser ? JSON.parse(rawUser) : null;
        setStatus(user?.role === "admin" ? "admin" : "user");
      } catch (_error) {
        clearAuthSession();
        setStatus("unauthorized");
      }

      setIsChecking(false);
    };

    verify();
  }, []);

  if (isChecking) {
    return null;
  }

  if (status === "unauthorized") {
    clearAuthSession();
    return <Navigate to="/login" replace />;
  }

  if (status !== "admin") {
    return (
      <Navigate
        to="/dashboard"
        replace
        state={{
          adminAccessDenied: true,
          message: "Only the admin account can access the admin dashboard.",
        }}
      />
    );
  }

  return children;
}
