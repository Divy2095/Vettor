import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminRoute from "./components/AdminRoute";
import ResumeUploadCard from "./components/ResumeUploadCard";
import QuestionsDisplay from "./components/QuestionsDisplay";
import { clearAuthSession, ensureSession } from "./lib/auth";
import { Navigate } from "react-router-dom";

function UserRoute({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const valid = await ensureSession();
      setIsAllowed(valid);
      setIsChecking(false);
    };

    check();
  }, []);

  if (isChecking) {
    return null;
  }

  if (!isAllowed) {
    clearAuthSession();
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage type="login" />} />
          <Route path="/signup" element={<AuthPage type="signup" />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/dashboard"
            element={
              <UserRoute>
                <Dashboard />
              </UserRoute>
            }
          />
          <Route
            path="/dashboard/upload"
            element={
              <UserRoute>
                <ResumeUploadCard />
              </UserRoute>
            }
          />
          <Route
            path="/dashboard/questions/:sessionId"
            element={
              <UserRoute>
                <QuestionsDisplay />
              </UserRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            }
          />
          {/* Further routes will be added here */}
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
