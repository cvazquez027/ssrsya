import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster"

import LoginPage from './pages/LoginPage';
import InitPage from './pages/InitPage';
import DashboardPage from './pages/DashboardPage';
import ProyectoDetallePage from './pages/ProyectoDetallePage';
import ObjetivosPage from './pages/ObjetivosPage';
import ActividadesPage from './pages/ActividadesPage';
import IndicadoresPage from './pages/IndicadoresPage';
import NuevoProyectoPage from './pages/NuevoProyectoPage';
import ProyectosPage from './pages/ProyectosPage';
import MonitoreoPage from './pages/MonitoreoPage';
import RevisionesPage from './pages/RevisionesPage';
import MaestrasPage from './pages/MaestrasPage';
import UsuariosPage from './pages/UsuariosPage';
import ImportarPage from './pages/ImportarPage';
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ModulosPage from "./pages/ModulosPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProcesarHHEEPage from "./pages/ProcesarHHEEPage";
import HonorariosPage from "./pages/HonorariosPage";
import CategoriasPage from "./pages/CategoriasPage";
import AnalisisEntrevistasPage from "./pages/AnalisisEntrevistasPage";
import ComuActividadesPage from "./pages/ComuActividadesPage";
import ComuIndicadoresPage from "./pages/ComuIndicadoresPage";
import ComuDashboardPage from "./pages/ComuDashboardPage";
import CertificacionServiciosPage from "./pages/CertificacionServiciosPage";
import OrganigramaPage from "./pages/OrganigramaPage";

function App() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/inicio" element={<InitPage />} />
        <Route path="/tablero" element={<DashboardPage />} />
        <Route path="/organigrama" element={<OrganigramaPage />} />
        <Route path="/proyecto-detalle/:id" element={<ProyectoDetallePage />} />
        <Route path="/objetivos-especificos" element={<ObjetivosPage />} />
        <Route path="/actividades" element={<ActividadesPage />} />
        <Route path="/indicadores" element={<IndicadoresPage />} />
        <Route path="/nuevo-proyecto" element={<NuevoProyectoPage />} />
        <Route path="/proyectos" element={<ProyectosPage />} />
        <Route path="/monitoreo" element={<MonitoreoPage />} />
        <Route path="/revisiones" element={<RevisionesPage />} />
        <Route path="/importar" element={<ImportarPage />} />
        <Route path="/maestras" element={<MaestrasPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/modulos" element={<ModulosPage />} />
        <Route path="/recuperar" element={<ForgotPasswordPage />} />
        <Route path="/restablecer" element={<ResetPasswordPage />} />
        <Route path="/procesar-hhee" element={<ProcesarHHEEPage />} />
        <Route path="/gestion-1109" element={<HonorariosPage />} />
        <Route path="/categorias" element={<CategoriasPage />} />
        <Route path="/entrevistas" element={<AnalisisEntrevistasPage />} />
        <Route path="/comu_actividades" element={<ComuActividadesPage />} />
        <Route path="/comu_indicadores" element={<ComuIndicadoresPage />} />
        <Route path="/comu_dashboard" element={<ComuDashboardPage />} />
        <Route path="/certificacion-servicios" element={<CertificacionServiciosPage />} />

        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;