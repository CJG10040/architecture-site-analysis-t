import { Toaster } from "@/components/ui/sonner";
import { useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Settings from "./pages/Settings";

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { const update = () => setHash(window.location.hash); window.addEventListener("hashchange", update); return () => window.removeEventListener("hashchange", update); }, []);
  return <ErrorBoundary>{hash === "#settings" ? <Settings /> : <Home />}<Toaster /></ErrorBoundary>;
}
