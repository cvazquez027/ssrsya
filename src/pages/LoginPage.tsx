import type React from "react"
import { useState, useEffect } from "react" // Agregamos useEffect
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Eye, EyeOff, UserPlus, Loader2, Info } from "lucide-react" // Agregamos UserPlus, Loader2, Info

// --- MERGE: Imports para el Modal ---
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// ------------------------------------

// ⚠️ URL BASE
const API_URL = "http://localhost/planificacion/api-backend/login.php";
const API_REGISTER = "http://localhost/planificacion/api-backend/solicitar_acceso.php"; // --- MERGE: Nueva URL

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // --- MERGE: Estados para Solicitud ---
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [dependencias, setDependencias] = useState<any[]>([])
  const [regData, setRegData] = useState({
      nombre: "", apellido: "", cuil: "", usuario: "", 
      password: "", confirmPassword: "", sigla: "", rol: ""
  })
  // -------------------------------------

  const navigate = useNavigate()
  const { toast } = useToast()

  // --- MERGE: Lógica de Solicitud ---
  useEffect(() => {
      if (isRegisterOpen) {
          fetchDependencias()
      }
  }, [isRegisterOpen])

  const fetchDependencias = async () => {
      try {
          const res = await fetch(API_REGISTER)
          if (res.ok) {
              const data = await res.json()
              setDependencias(Array.isArray(data) ? data : [])
          }
      } catch (e) {
          console.error("Error cargando dependencias", e)
      }
  }

  const handleRegister = async () => {
      if(!regData.nombre || !regData.apellido || !regData.cuil || !regData.usuario || 
         !regData.password || !regData.sigla || !regData.rol) {
          toast({ title: "Atención", description: "Todos los campos son obligatorios", variant: "destructive" });
          return;
      }
      if (!regData.usuario.endsWith("@msal.gov.ar")) {
          toast({ title: "Error", description: "El usuario debe ser @msal.gov.ar", variant: "destructive" });
          return;
      }
      if(regData.password !== regData.confirmPassword) {
          toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" });
          return;
      }
      const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
      if (!passRegex.test(regData.password)) {
          toast({ title: "Contraseña Débil", description: "Revise los requisitos de seguridad.", variant: "destructive" });
          return;
      }

      setRegisterLoading(true);
      try {
          const res = await fetch(API_REGISTER, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  nombre: regData.nombre,
                  apellido: regData.apellido,
                  cuil: regData.cuil,
                  usuario: regData.usuario,
                  password: regData.password,
                  sigla: regData.sigla,
                  rol: regData.rol
              })
          });
          const data = await res.json();

          if(res.ok && data.success) {
              toast({ 
                  title: "Solicitud Enviada", 
                  description: "Su solicitud ha sido enviada con éxito. Recibirá un correo cuando sea aprobada.",
                  className: "bg-green-100 border-green-600 text-green-800"
              });
              setIsRegisterOpen(false);
              setRegData({ nombre: "", apellido: "", cuil: "", usuario: "", password: "", confirmPassword: "", sigla: "", rol: "" }); 
          } else {
              throw new Error(data.error || "Error al procesar solicitud");
          }
      } catch (e: any) {
          toast({ title: "Error", description: e.message, variant: "destructive" });
      } finally {
          setRegisterLoading(false);
      }
  }
  // -------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", 
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Inicio de sesión exitoso",
          description: `Bienvenido, ${data.user.nombre}`,
        })
        
        setTimeout(() => {
          navigate("/inicio")
        }, 800)
      } else {
        throw new Error(data.error || "Datos incorrectos")
      }
    } catch (error: any) {
      toast({
        title: "Error de autenticación",
        description: error.message || "Error al conectar con el servidor",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md animate-in fade-in zoom-in duration-300">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 shadow-sm">
            <img 
              src="/logo-msal.png" 
              alt="MSAL Logo" 
              className="h-16 w-16 object-contain" 
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">Sistema de Gestión Integral y Planificación</CardTitle>
            <CardDescription className="mt-2 text-balance">Subsecretaría de Relaciones Sectoriales y Articulación</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingrese su usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-background/50 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full font-semibold shadow-sm" disabled={loading}>
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>

            <div className="text-right">
                <Link to="/recuperar" className="text-xs text-blue-600 hover:text-blue-800 hover:underline"> ¿Olvidaste tu contraseña?</Link>
            </div>

            {/* --- MERGE: Separador y Botón Solicitar Acceso --- */}
            <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">O</span></div>
            </div>
            <Button 
                type="button" 
                variant="outline" 
                className="w-full" 
                onClick={() => setIsRegisterOpen(true)}
                disabled={loading}
            >
                Solicitar Acceso
            </Button>
            {/* ------------------------------------------------ */}

          </form>
        </CardContent>
      </Card>

      {/* --- MERGE: Modal Completo --- */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5"/> Solicitar Acceso</DialogTitle>
                  <DialogDescription>
                      Complete todos los campos. Su usuario requerirá aprobación.
                  </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label className="text-xs font-semibold">Nombre</Label>
                          <Input value={regData.nombre} onChange={e => setRegData({...regData, nombre: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                          <Label className="text-xs font-semibold">Apellido</Label>
                          <Input value={regData.apellido} onChange={e => setRegData({...regData, apellido: e.target.value})} />
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label className="text-xs font-semibold">CUIL</Label>
                          <Input value={regData.cuil} onChange={e => setRegData({...regData, cuil: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                           <Label className="text-xs font-semibold">Rol Solicitado</Label>
                           <Select value={regData.rol} onValueChange={(val) => setRegData({...regData, rol: val})}>
                               <SelectTrigger>
                                   <SelectValue placeholder="Seleccionar..." />
                               </SelectTrigger>
                               <SelectContent>
                                   <SelectItem value="carga">Carga</SelectItem>
                                   <SelectItem value="cargafull">Carga Full</SelectItem>
                                   <SelectItem value="autorizante">Autorizante</SelectItem>
                               </SelectContent>
                           </Select>
                      </div>
                  </div>

                  <div className="space-y-2">
                       <Label className="text-xs font-semibold">Dependencia</Label>
                       <Select value={regData.sigla} onValueChange={(val) => setRegData({...regData, sigla: val})}>
                           <SelectTrigger>
                               <SelectValue placeholder={dependencias.length > 0 ? "Seleccionar..." : "Cargando..."} />
                           </SelectTrigger>
                           <SelectContent className="max-h-[200px]">
                               {dependencias.map((dep) => (
                                   <SelectItem key={dep.sigla} value={dep.sigla}>
                                       <span className="font-bold mr-2">{dep.sigla}</span>
                                       <span className="text-xs text-muted-foreground truncate">{dep.descripcion}</span>
                                   </SelectItem>
                               ))}
                           </SelectContent>
                       </Select>
                  </div>

                  <hr className="border-dashed my-2" />

                  <div className="space-y-2">
                      <Label className="text-xs font-semibold">Usuario (Email Institucional)</Label>
                      <div className="relative">
                        <Input 
                            value={regData.usuario} 
                            onChange={e => setRegData({...regData, usuario: e.target.value})} 
                            placeholder="nombre.apellido@msal.gov.ar" 
                            className={regData.usuario && !regData.usuario.endsWith("@msal.gov.ar") ? "border-red-300 focus-visible:ring-red-300" : ""}
                        />
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-2 bg-yellow-50 p-3 rounded border border-yellow-100">
                      <div className="col-span-2 flex items-start gap-2">
                          <Info className="h-4 w-4 text-yellow-600 mt-0.5" />
                          <p className="text-[10px] text-yellow-800 leading-tight">
                              Mín. 8 caracteres, mayúsculas, minúsculas, números y símbolos.
                          </p>
                      </div>
                      <div className="space-y-2">
                          <Label className="text-xs font-semibold">Contraseña</Label>
                          <Input type="password" value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} className="bg-white h-8" />
                      </div>
                      <div className="space-y-2">
                          <Label className="text-xs font-semibold">Repetir</Label>
                          <Input type="password" value={regData.confirmPassword} onChange={e => setRegData({...regData, confirmPassword: e.target.value})} className="bg-white h-8" />
                      </div>
                  </div>
              </div>

              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsRegisterOpen(false)}>Cancelar</Button>
                  <Button onClick={handleRegister} disabled={registerLoading} className="bg-green-600 hover:bg-green-700 text-white">
                      {registerLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Enviar Solicitud"}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      {/* ----------------------------- */}

    </div>
  )
}