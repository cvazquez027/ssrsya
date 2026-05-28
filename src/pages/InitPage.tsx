import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { DashboardLayout } from "@/components/dashboard-layout"
import { FolderKanban, LayoutDashboard, ArrowRight, Network } from "lucide-react"
import { API_BASE } from "@/config" 

export default function InitPage() {
    const navigate = useNavigate()
    const [userName, setUserName] = useState("Usuario")

    useEffect(() => {
        fetch(`${API_BASE}/usuario.php`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if(data.nombre) setUserName(data.nombre);
            })
            .catch(() => {})
    }, [])

    return (
        <DashboardLayout currentSection="Bienvenida">
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] animate-in fade-in zoom-in duration-500">
                
                <div className="text-center space-y-6 max-w-2xl px-4">
                    <div className="mx-auto rounded-full shadow-sm w-24 h-24 flex items-center justify-center">
                        <img 
                            src="/logo.png" 
                            alt="Sistema SSRSyA" 
                            className="w-full h-full object-contain opacity-90"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 2H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M2 10h20"/></svg>';
                            }} 
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <h1 className="text-4xl font-extrabold tracking-tight text-stone-900">
                            Secretaría de Gestión Sanitaria
                        </h1>
                        <p className="text-xl text-stone-500">
                            Hola, <span className="font-semibold text-primary">{userName}</span>.
                        </p>
                        <p className="text-muted-foreground">
                            Bienvenido al sistema integral de gestión y planificación estratégica.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 w-full max-w-4xl px-4">
                    <div onClick={() => navigate('/tablero')} className="cursor-pointer group relative overflow-hidden rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                <LayoutDashboard className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-stone-900">Tablero de Control</h3>
                                <p className="text-sm text-stone-500">Visualice métricas y avance.</p>
                            </div>
                        </div>
                    </div>

                    <div onClick={() => navigate('/organigrama')} className="cursor-pointer group relative overflow-hidden rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                <Network className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-stone-900">Organigrama</h3>
                                <p className="text-sm text-stone-500">Navegue la estructura.</p>
                            </div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-stone-100 rounded-lg group-hover:bg-stone-200 transition-colors">
                                <FolderKanban className="h-6 w-6 text-stone-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-stone-900">Módulos Operativos</h3>
                                <p className="text-sm text-stone-500">Acceda desde el menú lateral.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 flex items-center text-sm text-stone-400 gap-2">
                    <ArrowRight className="h-4 w-4 animate-pulse" />
                    <span>Seleccione una opción para comenzar</span>
                </div>

            </div>
        </DashboardLayout>
    )
}