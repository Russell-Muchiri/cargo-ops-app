import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import AdminTrip from "@/pages/AdminTrip";
import FarmView from "@/pages/FarmView";
import NairobiView from "@/pages/NairobiView";
import Settings from "@/pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/trip/:tripId" element={<AdminTrip />} />
        <Route path="/trip/:tripId/farm" element={<FarmView />} />
        <Route path="/trip/:tripId/nairobi" element={<NairobiView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
