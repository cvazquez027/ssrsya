import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
// CIRUGÍA: Importamos el ícono Eye para la nueva sección
import { Plus, Pencil, Trash2, UserCog, Search, ShieldAlert, Layers, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const API_BASE = "http://localhost/planificacion/api-backend";

const ROLES = [
    { value: "admin", label: "Administrador" },
    { value: "cargafull", label: "Carga Full" },
    { value: "carga", label: "Carga (Dependencia)" },
    { value: "autorizante", label: "Autorizante" },
];

export default function UsuariosPage() {
  const { toast } = useToast()
  
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  const [usuarios, setUsuarios] = useState<any[]>([])
  const [dependencias, setDependencias] = useState<any[]>([])
  const [modulosDisponibles, setModulosDisponibles] = useState<any[]>([])
  const [referentes, setReferentes] = useState<any[]>([]) 
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // CIRUGÍA: Agregamos dependencias_permitidas al estado base
  const [formData, setFormData] = useState({
      id_usuario: 0, usuario: "", clave: "", cuil: "", 
      nombre: "", apellido: "", email: "", rol: "", sigla: "", activo: 1,
      modulos: [] as number[],
      dependencias_permitidas: [] as string[],
      id_referente: "" as string | number
  })

  useEffect(() => {
    fetchSession().then(tieneAcceso => {
        if (tieneAcceso) {
            fetchDependencias()
            fetchModulos() 
            fetchReferentes() 
            fetchUsuarios()
        }
    })
  }, [])

  const fetchSession = async () => { 
      try { 
          const res = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' }); 
          const data = await res.json(); 
          
          const rolConfig = data.permisos?.['CONFIG'];
          if (!rolConfig || rolConfig !== 'admin') {
              setAccesoDenegado(true);
              setLoading(false);
              return false;
          }
          return true;
      } catch (e) {
          console.error("Error validando sesión:", e);
          return false;
      } 
  }
  
  const fetchDependencias = async () => { try { const res = await fetch(`${API_BASE}/lista_maestras.php?tabla=dependencia`, { credentials: 'include' }); if (res.ok) { const data = await res.json(); setDependencias(Array.isArray(data) ? data : []) } } catch (e) {} }
  const fetchModulos = async () => { try { const res = await fetch(`${API_BASE}/lista_maestras.php?tabla=modulo`, { credentials: 'include' }); if (res.ok) { const data = await res.json(); setModulosDisponibles(Array.isArray(data) ? data : []) } } catch (e) {} }
  const fetchReferentes = async () => { try { const res = await fetch(`${API_BASE}/lista_maestras.php?tabla=referente`, { credentials: 'include' }); if (res.ok) { const data = await res.json(); setReferentes(Array.isArray(data) ? data : []) } } catch (e) {} }

  const fetchUsuarios = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/lista_usuarios.php`, { credentials: 'include' })
      if (!res.ok) throw new Error("No autorizado")
      const data = await res.json()
      setUsuarios(Array.isArray(data) ? data : [])
    } catch (e) {} finally { setLoading(false) }
  }

  const handleSave = async () => {
      if (!formData.usuario || !formData.rol) { toast({ title: "Error", description: "Usuario y Rol obligatorios", variant: "destructive" }); return }
      if (formData.id_usuario === 0 && !formData.clave) { toast({ title: "Error", description: "Contraseña requerida", variant: "destructive" }); return }

      try {
          const res = await fetch(`${API_BASE}/abm_usuarios.php`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: 'include',
              body: JSON.stringify(formData)
          })
          const data = await res.json()
          if (res.ok) {
              toast({ title: "Guardado", description: "Usuario actualizado" })
              setIsModalOpen(false)
              fetchUsuarios()
          } else {
              throw new Error(data.error)
          }
      } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }) }
  }

  const handleDelete = async (id: number) => {
      if (!confirm("¿Eliminar usuario?")) return
      try {
          const res = await fetch(`${API_BASE}/abm_usuarios.php`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: 'include', body: JSON.stringify({ id_usuario: id }) })
          if (res.ok) { toast({ title: "Eliminado" }); fetchUsuarios() } 
          else { const data = await res.json(); throw new Error(data.error) }
      } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }) }
  }

  const openNew = () => {
      setFormData({
          id_usuario: 0, usuario: "", clave: "", cuil: "", 
          nombre: "", apellido: "", email: "", rol: "consulta", sigla: "", activo: 1, 
          modulos: [],
          dependencias_permitidas: [], // Limpiamos para el nuevo
          id_referente: "" 
      })
      setIsModalOpen(true)
  }

  const openEdit = async (u: any) => {
      try {
          const res = await fetch(`${API_BASE}/abm_usuarios.php?id=${u.id_usuario}`, { credentials: 'include' });
          if (res.ok) {
              const fullData = await res.json();
              setFormData({
                  id_usuario: fullData.id_usuario,
                  usuario: fullData.usuario,
                  clave: "", 
                  cuil: fullData.cuil || "",
                  nombre: fullData.nombre || "",
                  apellido: fullData.apellido || "",
                  email: fullData.email || "",
                  rol: fullData.rol || "",
                  sigla: fullData.sigla || "",
                  activo: Number(fullData.activo),
                  modulos: fullData.modulos || [],
                  dependencias_permitidas: fullData.dependencias_permitidas || [], // Cargamos las permitidas
                  id_referente: fullData.id_referente || "" 
              })
              setIsModalOpen(true)
          }
      } catch (e) {
          toast({title: "Error cargando detalles", variant: "destructive"})
      }
  }

  const toggleModulo = (idMod: number, checked: boolean) => {
      setFormData(prev => {
          const newMods = checked 
              ? [...prev.modulos, idMod]
              : prev.modulos.filter(mId => mId !== idMod);
          return { ...prev, modulos: newMods };
      })
  }

  // CIRUGÍA: Función para alternar áreas visuales permitidas
  const toggleDependenciaPermitida = (sigla: string, checked: boolean) => {
      setFormData(prev => {
          const newDeps = checked 
              ? [...prev.dependencias_permitidas, sigla]
              : prev.dependencias_permitidas.filter(s => s !== sigla);
          return { ...prev, dependencias_permitidas: newDeps };
      })
  }

  const filtered = usuarios.filter(u => u.usuario.toLowerCase().includes(searchTerm.toLowerCase()) || u.apellido.toLowerCase().includes(searchTerm.toLowerCase()))

  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Usuarios">
              <div className="flex flex-col items-center justify-center h-[60vh] text-center text-muted-foreground">
                  <ShieldAlert className="h-16 w-16 mb-4 text-red-500"/>
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>Solo los Administradores Globales pueden gestionar el ABM de Usuarios y sus Permisos.</p>
              </div>
          </DashboardLayout>
      )
  }

  return (
    <DashboardLayout currentSection="Gestión de Usuarios">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold tracking-tight">Usuarios del Sistema</h2>
            <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4"/> Nuevo Usuario</Button>
        </div>
        <div className="relative w-full md:w-1/3">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 text-xs uppercase tracking-wider">Usuario</TableHead>
                  <TableHead className="py-2 text-xs uppercase tracking-wider">Nombre</TableHead>
                  <TableHead className="py-2 text-xs uppercase tracking-wider">Rol Global</TableHead>
                  <TableHead className="py-2 text-xs uppercase tracking-wider">Dep</TableHead>
                  <TableHead className="py-2 text-xs uppercase tracking-wider">Estado</TableHead>
                  <TableHead className="text-right py-2 text-xs uppercase tracking-wider">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground italic">Cargando usuarios...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground italic">No se encontraron usuarios</TableCell></TableRow>
                ) : filtered.map((u) => (
                  <TableRow key={u.id_usuario} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium py-1">
                      <div className="flex items-center gap-2">
                        <UserCog className="h-3 w-3 text-slate-400"/>
                        <span className="text-sm">{u.usuario}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 ml-5 leading-none">{u.email}</div>
                    </TableCell>
                    <TableCell className="py-1 text-sm">{u.apellido}, {u.nombre}</TableCell>
                    <TableCell className="py-1">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border border-slate-200">{u.rol}</span>
                    </TableCell>
                    <TableCell className="py-1 text-sm font-mono text-blue-600">{u.sigla || "-"}</TableCell>
                    <TableCell className="py-1">
                      {Number(u.activo)===1 ? <span className="text-green-600 text-[10px] font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-100">ACTIVO</span> : <span className="text-red-500 text-[10px] font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">INACTIVO</span>}
                    </TableCell>
                    <TableCell className="text-right space-x-1 py-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-blue-50" onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5 text-blue-600"/></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50" onClick={() => handleDelete(u.id_usuario)}><Trash2 className="h-3.5 w-3.5 text-red-600"/></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-[600px] lg:max-w-[850px] w-full p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 border-b bg-white">
                    <DialogTitle className="text-lg font-bold">{formData.id_usuario === 0 ? "Crear Nuevo Usuario" : "Editar Datos de Usuario"}</DialogTitle>
                </DialogHeader>
                
                <div className="p-4 grid gap-3 max-h-[70vh] overflow-y-auto bg-slate-50/30 custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-xs font-semibold">Nombre de Usuario</Label><Input className="h-8 text-sm" value={formData.usuario} onChange={e => setFormData({...formData, usuario: e.target.value})} /></div>
                        <div className="space-y-1"><Label className="text-xs font-semibold">Contraseña</Label><Input className="h-8 text-sm" type="password" value={formData.clave} onChange={e => setFormData({...formData, clave: e.target.value})} placeholder={formData.id_usuario===0?"Requerida":"(Sin cambios)"} /></div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1"><Label className="text-xs font-semibold">Nombre</Label><Input className="h-8 text-sm" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} /></div>
                        <div className="space-y-1"><Label className="text-xs font-semibold">Apellido</Label><Input className="h-8 text-sm" value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} /></div>
                        <div className="space-y-1"><Label className="text-xs font-semibold">CUIL</Label><Input className="h-8 text-sm" value={formData.cuil} onChange={e => setFormData({...formData, cuil: e.target.value})} /></div>
                    </div>
                    
                    <div className="space-y-1"><Label className="text-xs font-semibold">Correo Electrónico</Label><Input className="h-8 text-sm" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1 min-w-0">
                            <Label className="text-xs font-semibold text-slate-700">Rol Global (Base)</Label>
                            <Select value={formData.rol} onValueChange={v => setFormData({...formData, rol: v})}>
                                <SelectTrigger className="h-8 text-sm w-full [&>span]:truncate">
                                    <SelectValue placeholder="Seleccionar rol..." />
                                </SelectTrigger>
                                <SelectContent>{ROLES.map(r=><SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1 min-w-0">
                            <Label className="text-xs font-semibold text-slate-700">Dependencia (Base)</Label>
                            <Select value={formData.sigla || "ninguna"} onValueChange={v => setFormData({...formData, sigla: v==="ninguna"?"":v})}>
                                <SelectTrigger className="h-8 text-sm w-full [&>span]:truncate">
                                    <SelectValue placeholder="Seleccionar dependencia" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ninguna">-- Ninguna / Global --</SelectItem>
                                    {dependencias.map(d=><SelectItem key={d.sigla} value={d.sigla} className="truncate">{d.sigla} - {d.descripcion}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1 min-w-0">
                            <Label className="text-xs font-semibold text-slate-700 block truncate" title="Vincular a este usuario con un Referente existente para notificaciones.">
                                Vincular Referente (Opcional)
                            </Label>
                            <Select value={String(formData.id_referente) || "ninguno"} onValueChange={v => setFormData({...formData, id_referente: v==="ninguno"?"":v})}>
                                <SelectTrigger className="h-8 text-sm w-full [&>span]:truncate">
                                    <SelectValue placeholder="Seleccionar referente" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ninguno">-- No vincular --</SelectItem>
                                    {referentes.map((ref: any) => (
                                        <SelectItem key={ref.id_referente} value={String(ref.id_referente)} className="truncate">
                                            {ref.nombre} {ref.apellido}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 py-1">
                        <Checkbox id="activo" checked={formData.activo === 1} onCheckedChange={(c) => setFormData({...formData, activo: c ? 1 : 0})} />
                        <Label htmlFor="activo" className="text-xs font-bold cursor-pointer">Cuenta de usuario activa</Label>
                    </div>
                    
                    {/* CIRUGÍA: NUEVA SECCIÓN DE SEGURIDAD RLS */}
                    <div className="border-t pt-3 mt-1">
                        <Label className="flex items-center gap-2 mb-1 text-xs font-bold text-blue-700 uppercase tracking-wider"><Eye className="h-3.5 w-3.5"/> Ámbito de Visualización (Dependencias Extra)</Label>
                        <p className="text-[10px] text-slate-500 mb-2 leading-tight">Si no seleccionás ninguna, el usuario solo verá su dependencia base. Al seleccionar áreas aquí, le permitís gestionar datos de esas áreas específicas.</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 bg-slate-50 p-2 rounded border border-slate-200 shadow-inner max-h-[140px] overflow-y-auto custom-scrollbar">
                            {dependencias.length === 0 && <span className="text-[10px] text-muted-foreground col-span-2 italic">No hay dependencias cargadas.</span>}
                            {dependencias.map((dep: any) => (
                                <div key={dep.sigla} className="flex items-center space-x-2 hover:bg-slate-100/50 p-1 rounded transition-colors">
                                    <Checkbox 
                                        id={`dep-${dep.sigla}`} 
                                        checked={formData.dependencias_permitidas.includes(dep.sigla)}
                                        onCheckedChange={(c) => toggleDependenciaPermitida(dep.sigla, !!c)}
                                    />
                                    <Label htmlFor={`dep-${dep.sigla}`} className="text-[11px] cursor-pointer select-none leading-tight truncate" title={dep.descripcion}>
                                        <span className="font-bold">{dep.sigla}</span> - {dep.descripcion}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t pt-3 mt-1">
                        <Label className="flex items-center gap-2 mb-2 text-xs font-bold text-blue-700 uppercase tracking-wider"><Layers className="h-3.5 w-3.5"/> Acceso a Módulos</Label>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-slate-50 p-2 rounded border border-slate-200 shadow-inner">
                            {modulosDisponibles.length === 0 && <span className="text-[10px] text-muted-foreground col-span-2 italic">No hay módulos definidos.</span>}
                            {modulosDisponibles.map((mod: any) => (
                                <div key={mod.id_modulo} className="flex items-center space-x-2 hover:bg-slate-100/50 p-1 rounded transition-colors">
                                    <Checkbox 
                                        id={`mod-${mod.id_modulo}`} 
                                        checked={formData.modulos.includes(Number(mod.id_modulo))}
                                        onCheckedChange={(c) => toggleModulo(Number(mod.id_modulo), !!c)}
                                    />
                                    <Label htmlFor={`mod-${mod.id_modulo}`} className="text-[11px] cursor-pointer select-none leading-tight">
                                        {mod.descripcion} <span className="text-[9px] text-slate-400 font-mono">[{mod.clave}]</span>
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                <DialogFooter className="p-4 border-t bg-white flex flex-col-reverse sm:flex-row gap-2">
                    <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="h-9 text-sm font-semibold">Cancelar</Button>
                    <Button onClick={handleSave} className="h-9 text-sm bg-blue-600 hover:bg-blue-700 font-bold px-6">Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}