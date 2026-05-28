import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Link } from "react-router-dom";
import { BellRing } from "lucide-react";

const API_BASE = "http://localhost/planificacion/api-backend";

export function NotificadorPendientes() {
  const { toast } = useToast();

  useEffect(() => {
    // 1. CHEQUEO: Si ya existe la marca en esta sesión, no hacemos nada (silencio)
    if (sessionStorage.getItem("aviso_pendientes_visto")) {
        return;
    }

    const checkPendientes = async () => {
      try {
        const res = await fetch(`${API_BASE}/check_pendientes.php`, { credentials: "include" });
        const data = await res.json();

        if (data.pendientes > 0) {
          
          // 2. MARCAR COMO VISTO: Guardamos la marca para que no vuelva a salir al recargar
          sessionStorage.setItem("aviso_pendientes_visto", "true");
          
          toast({
            title: "¡Atención!",
            description: `Tienes ${data.pendientes} revisiones o respuestas pendientes de lectura.`,
            action: (
              <ToastAction altText="Ver">
                <Link to="/revisiones" className="flex items-center gap-2">
                   <BellRing className="h-4 w-4" /> Ir a Revisiones
                </Link>
              </ToastAction>
            ),
            duration: 10000, 
            className: "bg-blue-50 border-blue-200"
          });
        }
      } catch (e) {
        console.error("Error al verificar notificaciones", e);
      }
    };

    checkPendientes();
  }, [toast]);

  return null;
}