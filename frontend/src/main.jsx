import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "./index.css";
import Dashboard from "./Dashboard.jsx";
import ServicePage from "./pages/Services.jsx";
import LoginPage from "./pages/Login.jsx";
import SignupPage from "./pages/SIgnup.jsx";
import VerifyEmailPage from "./pages/EmailVerifcation.jsx";
import "./lib/firebase.js"
import ForgotPasswordPage from "./pages/ForgotPassword.jsx";
import App from "./App.jsx";
import VerifyAadhaarPage from "./pages/AdhaarVerification.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
  },
  {
    path: "/verify-email",
    element: <VerifyEmailPage />,
  },
  {
    path: "/verify-aadhaar",
    element: <VerifyAadhaarPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/services",
    element: <ServicePage />,
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
