import { useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard, FolderKanban, Target, ListChecks, BarChart3, Users, LogOut, Menu, SquareKanban,
  MessageSquareText, Import, Database, Radar, UserCog, ClipboardCheck, Settings, Workflow, // Layers,
  ChevronDown, ChevronRight, MessagesSquare, Compass, Scale, Contact, ScanText, FileSpreadsheet,
  BriefcaseBusiness, FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { NotificadorPendientes } from "./NotificadorPendientes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ChatbotWidget } from "./ChatbotWidget"

// Usamos tu URL fija para asegurar compatibilidad
const API_BASE = "http://localhost/planificacion/api-backend";

// --- 1. CONFIGURACIÓN VISUAL DE MÓDULOS ---
const MODULE_CONFIG: any = {
    'PLANIFICACION': {
        icon: Compass,
        routes: [
            { href: "/organigrama", label: "Explorar Organigrama", icon: Import },
            { href: "/tablero", label: "Tablero de Control", icon: LayoutDashboard },
            { href: "/proyectos", label: "Proyectos", icon: FolderKanban },
            { href: "/objetivos-especificos", label: "Obj. Específicos", icon: Target },
            { href: "/actividades", label: "Actividades", icon: ListChecks },
            { href: "/indicadores", label: "Indicadores", icon: BarChart3 },
            { href: "/categorias", label: "Proyectos Integrados", icon: Workflow },
            { href: "/monitoreo", label: "Métricas", icon: Radar },
            { href: "/revisiones", label: "Revisiones", icon: MessageSquareText },
            { href: "/importar", label: "Importar Planificación", icon: Import },
        ]
    },
    'COMUNICACION': { 
      icon: MessagesSquare, 
      routes: [
        { href: "/comu_dashboard", label: "Tablero de Seguimiento", icon: LayoutDashboard },
        { href: "/comu_actividades", label: "Gestionar Actividades", icon: SquareKanban },
        { href: "/comu_indicadores", label: "Gestionar Indicadores", icon: BarChart3 },
    ] },
    'COMPRAS':      { icon: BriefcaseBusiness, routes: [] },
    'DESPACHO':     { icon: Scale, routes: [] },
    'RRHH':         { 
      icon: Contact,
      routes: [
        { href: "/procesar-hhee", label: "Procesar HH.EE.", icon: FileSpreadsheet },
        { href: "/gestion-1109", label: "Gestionar Contratos", icon: ClipboardCheck },
        { href: "/certificacion-servicios", label: "Certificación de Servicios", icon: FileText },
      ] },
    'CONFIG':     {
      icon: Settings, 
      routes: [
        { href: "/maestras", label: "Tablas Maestras", icon: Database },
        { href: "/usuarios", label: "Usuarios", icon: Users },
      ] },
    'ENTREV': {
      icon: ScanText,
      routes: [
          { href: "/entrevistas", label: "Análisis de Desgrabaciones", icon: ScanText },
      ]
    },
}

interface DashboardLayoutProps {
  children: React.ReactNode
  currentSection?: string
}

export function DashboardLayout({ children, currentSection }: DashboardLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  // Usuario
  const [userName, setUserName] = useState("Cargando...")
  const [userRol, setUserRol] = useState("") // Mantenemos el legacy por las dudas
  const [userInitials, setUserInitials] = useState("U")
  
  // --- 2. ESTADOS PARA MÓDULOS Y SEGURIDAD ---
  const [systemModules, setSystemModules] = useState<any[]>([])
  const [userPermisos, setUserPermisos] = useState<any>({}) // CIRUGÍA: Diccionario de roles por módulo
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  // Perfil
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileData, setProfileData] = useState({
      usuario: "", cuil: "", nombre: "", apellido: "", email: "", 
      rol: "", sigla: "", password_nueva: "", password_confirm: ""
  })

  // --- EFECTO PARA AUTO-EXPANDIR EL MENÚ SEGÚN LA URL ACTUAL ---
  useEffect(() => {
    const currentPath = location.pathname;
    const activeModuleKey = Object.keys(MODULE_CONFIG).find(key => {
        const module = MODULE_CONFIG[key];
        if (module.routes && module.routes.length > 0) {
            return module.routes.some((route: any) => currentPath.includes(route.href));
        }
        return false;
    });

    if (activeModuleKey) {
        setExpandedModule(activeModuleKey);
    }
  }, [location.pathname]);

  // --- CARGA INICIAL ---
  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
      try {
          const resUser = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' })
          if (resUser.ok) {
              const u = await resUser.json()
              const fullName = `${u.nombre} ${u.apellido}`.trim() || "Usuario" // <--- NUEVO
              setUserName(fullName)
              setUserRol(u.rol || "")
              setUserPermisos(u.permisos || {}) 

              const iniciales = fullName.split(" ").map((n:string)=>n[0]).join("").substring(0,2).toUpperCase() // <--- NUEVO
              setUserInitials(iniciales)
          } else {
              navigate("/login")
              return
          }

          const resMods = await fetch(`${API_BASE}/lista_maestras.php?tabla=modulo`, { credentials: 'include' })
          if (resMods.ok) {
              const mods = await resMods.json()
              const validMods = Array.isArray(mods) ? mods.filter((m:any) => MODULE_CONFIG[m.clave]) : []
              setSystemModules(validMods)
          }

      } catch (e) {
          console.error("Error inicializando dashboard", e)
      }
  }

  const toggleSection = (key: string) => {
      setExpandedModule(prev => prev === key ? null : key)
  }

  const handleLogout = async () => {
    try { 
        await fetch(`${API_BASE}/logout.php`, { credentials: 'include' })
        sessionStorage.removeItem("aviso_pendientes_visto")
        navigate("/login") 
    } catch (e) { 
        navigate("/login") 
    }
  }

  // --- LÓGICA PERFIL ---
  const abrirPerfil = async () => { try { const res = await fetch(`${API_BASE}/perfil_usuario.php`, { credentials: 'include' }); if (res.ok) { setProfileData({ ...(await res.json()), password_nueva: "", password_confirm: "" }); setIsProfileOpen(true) } } catch(e){} }
  const guardarPerfil = async () => { 
      if (!profileData.nombre || !profileData.apellido || !profileData.email) { toast({ title: "Error", description: "Datos incompletos", variant: "destructive" }); return; }
      if (profileData.password_nueva && profileData.password_nueva !== profileData.password_confirm) { toast({ title: "Error", description: "Contraseñas no coinciden", variant: "destructive" }); return; }
      setIsSavingProfile(true); 
      try { 
          const res = await fetch(`${API_BASE}/perfil_usuario.php`, { method:"POST", headers:{"Content-Type":"application/json"}, credentials:'include', body:JSON.stringify(profileData)}); 
          if(res.ok){ toast({title:"Guardado"}); setIsProfileOpen(false); setUserName(`${profileData.nombre} ${profileData.apellido}`) } else throw new Error((await res.json()).error) 
      } catch(e:any){ toast({title:"Error", description:e.message, variant:"destructive"}) } finally { setIsSavingProfile(false) } 
  }

  // --- RENDERIZADO DEL MENÚ LATERAL ---
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const collapsed = isMobile ? false : isCollapsed;

    return (
      <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
        {/* HEADER SIDEBAR */}
        <div className={`h-[72px] border-b border-slate-800 flex items-center transition-all duration-300 ${collapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {!collapsed && (
            <div className="flex items-center gap-3 overflow-hidden animate-in fade-in duration-300">
              <img src="/logo-msal.png" alt="Logo SSRSyA" className="h-8 w-auto shrink-0 object-contain" />
              <div className="flex flex-col">
                <h1 className="text-xl font-bold leading-tight">SSRSyA</h1>
                <p className="text-[10px] text-slate-400 whitespace-nowrap">Gestión y Planificación</p>
              </div>
            </div>
          )}
          
          {!isMobile && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className="text-slate-400 hover:text-white shrink-0"
              title={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* NAVEGACIÓN MÓDULOS */}
        <nav className="flex-1 p-4 overflow-y-auto space-y-4 overflow-x-hidden custom-scrollbar">
          {systemModules.map((mod: any) => {
              // CIRUGÍA DE SEGURIDAD: Validamos si tiene permiso específico para ESTE módulo
              const rolEspecifico = userPermisos[mod.clave];
              
              // Si no tiene rol específico, no mostramos el módulo
              if (!rolEspecifico) return null;

              const config = MODULE_CONFIG[mod.clave];
              if (!config) return null;

              // CIRUGÍA: Lógica de filtrado de sub-rutas basada en su ROL ESPECÍFICO
              const visibleRoutes = config.routes.filter((route: any) => {
                  
                  // Ejemplo Configuración: Si es 'carga' en CONFIG, no puede ver Usuarios
                  if (mod.clave === 'CONFIG' && (rolEspecifico === 'carga' || (!rolEspecifico && userRol === 'carga'))) {
                      return route.href !== '/usuarios';
                  }
                  
                  // Ejemplo Planificación: Si es 'autorizante' en PLANIFICACION, solo ve tablero y revisiones
                  if (mod.clave === 'PLANIFICACION' && (rolEspecifico === 'autorizante' || (!rolEspecifico && userRol === 'autorizante'))) {
                      return route.href === '/tablero' || route.href === '/revisiones';
                  }

                  // Ocultar importar si no es admin
                  if (route.href === '/importar' && rolEspecifico !== 'admin' && userRol !== 'admin') {
                      return false;
                  }

                  return true;
              });

              const Icon = config.icon;
              const isOpen = expandedModule === mod.clave;

              return (
                  <div key={mod.id_modulo}>
                      <div 
                          onClick={() => {
                              if (collapsed) {
                                  if (!isMobile) setIsCollapsed(false);
                                  setExpandedModule(mod.clave);
                              } else {
                                  toggleSection(mod.clave);
                              }
                          }}
                          className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-2 mb-2 cursor-pointer group select-none hover:bg-slate-800 rounded py-2 transition-colors`}
                          title={collapsed ? mod.descripcion : ""}
                      >
                          <div className="flex items-center gap-3">
                              {Icon && <Icon className="h-5 w-5 text-slate-400 group-hover:text-blue-400 shrink-0" />}
                              {!collapsed && (
                                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-white transition-colors whitespace-nowrap">
                                      {mod.descripcion}
                                  </h3>
                              )}
                          </div>
                          {!collapsed && (isOpen ? <ChevronDown className="h-3 w-3 text-slate-500 shrink-0"/> : <ChevronRight className="h-3 w-3 text-slate-500 shrink-0"/>)}
                      </div>

                      {/* SUB-RUTAS */}
                      {isOpen && !collapsed && (
                          <div className="space-y-1 animate-in slide-in-from-top-1 duration-200 pl-2 border-l border-slate-800 ml-4 mb-4">
                              {visibleRoutes.length > 0 ? (
                                  visibleRoutes.map((route: any) => {
                                      const isActive = location.pathname === route.href
                                      return (
                                          <Link key={route.href} to={route.href}>
                                              <Button
                                                  variant="ghost"
                                                  className={`w-full justify-start gap-3 h-9 text-sm ${
                                                      isActive 
                                                      ? "bg-blue-600 text-white hover:bg-blue-700" 
                                                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                                                  }`}
                                              >
                                                  <route.icon className="h-4 w-4 shrink-0" />
                                                  <span className="truncate">{route.label}</span>
                                              </Button>
                                          </Link>
                                      )
                                  })
                              ) : (
                                  <div className="px-4 py-2 text-xs text-slate-500 italic flex gap-2">
                                      En desarrollo
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              )
          })}
        </nav>

        {/* FOOTER SIDEBAR */}
        <div className="p-4 border-t border-slate-800 space-y-4">
          <div className={`flex items-center gap-3 rounded-lg bg-slate-800/50 ${collapsed ? 'justify-center p-2' : 'px-2 py-2'}`}>
            <Avatar className="h-9 w-9 border border-slate-600 shrink-0 cursor-pointer hover:ring-2 ring-blue-500 transition-all" onClick={abrirPerfil} title="Mi Perfil">
              <AvatarImage src="" />
              <AvatarFallback className="bg-blue-900 text-blue-100 font-bold text-xs">{userInitials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-slate-400 truncate capitalize">{userRol}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400 shrink-0" onClick={handleLogout} title="Cerrar Sesión">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-slate-950">
      
      <aside className={`hidden lg:block fixed inset-y-0 z-50 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <SidebarContent />
      </aside>
      
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r-0 bg-slate-900 text-white">
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>

      <main className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <NotificadorPendientes />
        
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b px-6 h-16 flex items-center justify-between shadow-sm transition-all">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground">{currentSection || "Panel de Control"}</h2>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full"><Avatar className="h-9 w-9"><AvatarImage src="" /><AvatarFallback className="bg-primary/10 text-primary font-bold">{userInitials}</AvatarFallback></Avatar></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal"><div className="flex flex-col space-y-1"><p className="text-sm font-medium leading-none">{userName}</p><p className="text-xs leading-none text-muted-foreground capitalize">{userRol}</p></div></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={abrirPerfil} className="cursor-pointer"><UserCog className="mr-2 h-4 w-4" /><span>Mi Perfil</span></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer"><LogOut className="mr-2 h-4 w-4" /><span>Cerrar Sesión</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </div>
      </main>
      
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Mi Perfil de Usuario</DialogTitle><DialogDescription>Datos de cuenta</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border rounded"><div><Label className="text-xs text-muted-foreground">Usuario</Label><div className="text-sm font-bold">{profileData.usuario}</div></div><div><Label className="text-xs text-muted-foreground">Rol</Label><div className="text-sm font-bold capitalize">{profileData.rol}</div></div></div>
                <div className="space-y-1"><Label>Nombre</Label><Input value={profileData.nombre} onChange={e=>setProfileData({...profileData, nombre:e.target.value})}/></div>
                <div className="space-y-1"><Label>Apellido</Label><Input value={profileData.apellido} onChange={e=>setProfileData({...profileData, apellido:e.target.value})}/></div>
                <div className="space-y-1"><Label>Email</Label><Input value={profileData.email} onChange={e=>setProfileData({...profileData, email:e.target.value})}/></div>
                <div className="border-t pt-2 mt-2"><Label className="mb-2 block font-bold text-yellow-700">Cambiar Clave (Opcional)</Label><div className="grid grid-cols-2 gap-2"><Input type="password" placeholder="Nueva" value={profileData.password_nueva} onChange={e=>setProfileData({...profileData, password_nueva:e.target.value})}/><Input type="password" placeholder="Confirmar" value={profileData.password_confirm} onChange={e=>setProfileData({...profileData, password_confirm:e.target.value})}/></div></div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={()=>setIsProfileOpen(false)}>Cancelar</Button><Button onClick={guardarPerfil} disabled={isSavingProfile}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ChatbotWidget />
    </div>
  )
}