import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Search, ArrowRight, Plus, Save, MessageSquare, Send, ShieldAlert } from "lucide-react" 
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ComentariosModal } from "@/components/ComentariosModal"

const API_BASE = "http://localhost/planificacion/api-backend";
const ESTADO_PROYECTO = { EDICION: 1, PARA_AUTORIZAR: 2, APROBADO: 3, RECHAZADO: 4, CERRADO: 5 };

export default function ProyectosPage() {
  const { toast } = useToast()
  
  // --- CIRUGÍA ---
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  const [proyectos, setProyectos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [filterDependencia, setFilterDependencia] = useState("todas")
  const [filterEstado, setFilterEstado] = useState("todos")
  
  const [userRol, setUserRol] = useState("")
  const [userSigla, setUserSigla] = useState("")

  const [opciones, setOpciones] = useState<{ dependencias: any[], prioridades: any[], estados: any[], referentes: any[] }>({ dependencias: [], prioridades: [], estados: [], referentes: [] })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editData, setEditData] = useState({ 
    id_proyecto: 0, descripcion: "", og_descripcion: "", sigla_dependencia: "", 
    id_prioridad: "", id_estado: "", id_referentes: [] as string[]
  })

  const [commentOpen, setCommentOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState({ id: 0, title: "" })

  useEffect(() => {
    fetchUser()
    fetchOpciones()
    fetchProyectos()
  }, [])

  const fetchUser = async () => {
    try {
        const res = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' })
        const data = await res.json()
        
        const rolPlanificacion = data.permisos?.['PLANIFICACION'];
        if (!rolPlanificacion) {
            setAccesoDenegado(true);
            return;
        }

        // CIRUGÍA: Guardamos el rol del módulo como si fuera el global
        setUserRol(rolPlanificacion)
        setUserSigla(data.sigla || "")
    } catch (e) { console.error(e) }
  }

  const fetchOpciones = async () => {
    try {
        const res = await fetch(`${API_BASE}/opciones_proyecto.php`)
        setOpciones(await res.json())
    } catch (e) { console.error("Error opciones", e) }
  }

  const fetchProyectos = async () => {
    setLoading(true)
    try {
        const res = await fetch(`${API_BASE}/lista_proyectos.php`, { credentials: 'include' })
        const data = await res.json()
        setProyectos(data)
    } catch (e) { 
        toast({ title: "Error", description: "No se pudieron cargar los proyectos", variant: "destructive" }) 
    } finally { 
        setLoading(false) 
    }
  }

  const puedeCrear = ['admin', 'cargafull', 'carga'].includes(userRol);

  const puedeEditar = (proy: any) => {
    const estado = Number(proy.estado_proyecto);
    if (estado !== ESTADO_PROYECTO.EDICION) return false;

    const esAdmin = userRol === 'admin';
    const enEdicion = estado === ESTADO_PROYECTO.EDICION;
    const esMiDep = userSigla === proy.sigla_dependencia;

    if (esAdmin) return true;
    if (userRol === 'cargafull' && enEdicion) return true;
    if (userRol === 'carga' && esMiDep && enEdicion) return true;
    
    return false;
  }

  const puedeElegirDependencia = ['admin', 'cargafull'].includes(userRol);

  const abrirCrear = () => {
    setEditData({ 
        id_proyecto: 0, descripcion: "", og_descripcion: "",
        sigla_dependencia: puedeElegirDependencia ? "" : userSigla,
        id_prioridad: "", id_estado: "", id_referentes: []
    })
    setIsModalOpen(true)
  }

  const abrirEditar = (proy: any) => {
    setEditData({
        id_proyecto: proy.id_proyecto,
        descripcion: proy.proyecto_descripcion,
        og_descripcion: proy.og_descripcion || "",
        sigla_dependencia: proy.sigla_dependencia,
        id_prioridad: proy.id_prioridad ? String(proy.id_prioridad) : "",
        id_estado: proy.id_estado ? String(proy.id_estado) : "",
        id_referentes: proy.referentes ? proy.referentes.map((r:any) => String(r.id_referente)) : []
    })
    setIsModalOpen(true)
  }

  const abrirComentarios = (proy: any) => {
      setSelectedEntity({ id: proy.id_proyecto, title: proy.proyecto_descripcion })
      setCommentOpen(true)
  }

  const handleEnviarAutorizar = async (proy: any) => {
      if (!confirm("¿Enviar proyecto para autorización? Asegúrese de que no haya revisiones pendientes.")) return;

      try {
          const res = await fetch(`${API_BASE}/proyecto_estado.php`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: 'include',
              body: JSON.stringify({
                  id_proyecto: proy.id_proyecto,
                  estado: ESTADO_PROYECTO.PARA_AUTORIZAR
              })
          });

          const rawText = await res.text();
          let data;
          try { 
              data = JSON.parse(rawText); 
          } catch (e) { 
              throw new Error("Respuesta inválida del servidor."); 
          }

          if (res.ok) {
              toast({ title: "Enviado", description: "El proyecto está ahora pendiente de autorización.", className: "bg-green-100 border-green-500" });
              fetchProyectos();
          } else {
              toast({ title: "No se pudo enviar", description: data.error || "Error desconocido", variant: "destructive" });
          }
      } catch (e: any) {
          toast({ title: "Error", description: e.message, variant: "destructive" });
      }
  }

  const handleGuardar = async () => {
      if (!editData.descripcion) { toast({title:"Falta Nombre", variant:"destructive"}); return; }
      if (!editData.og_descripcion) { toast({title:"Falta Objetivo Gral", variant:"destructive"}); return; }
      if (puedeElegirDependencia && !editData.sigla_dependencia) {
          toast({title:"Seleccione una dependencia", variant:"destructive"}); return;
      }

      try {
        const res = await fetch(`${API_BASE}/abm_proyectos.php`, {
            method: editData.id_proyecto === 0 ? "POST" : "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify(editData)
        });
        
        if (res.ok) {
            toast({ title: "Guardado exitoso" }); 
            setIsModalOpen(false); 
            fetchProyectos();
        } else {
            const data = await res.json();
            throw new Error(data.error || "Error al guardar");
        }
      } catch (e: any) {
         toast({ title: "Error", description: e.message, variant: "destructive" });
      }
  }

  const handleBorrar = async (id: number) => {
    if (!confirm("¿Eliminar Proyecto?")) return;
    try {
        const res = await fetch(`${API_BASE}/abm_proyectos.php`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify({ id_proyecto: id })
        });
        if (res.ok) {
            toast({ title: "Eliminado" });
            fetchProyectos();
        } else {
            const data = await res.json();
            throw new Error(data.error);
        }
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }) }
  }

  const filtered = proyectos.filter(p => {
    const matchSearch = (p.proyecto_descripcion || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (p.sigla_dependencia || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchDependencia = filterDependencia === "todas" || p.sigla_dependencia === filterDependencia;
    const matchEstado = filterEstado === "todos" || String(p.estado_proyecto) === filterEstado;

    return matchSearch && matchDependencia && matchEstado;
  })

  if (loading) return <DashboardLayout currentSection="Proyectos"><div className="p-8 text-center">Cargando...</div></DashboardLayout>

  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Proyectos">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>No tenés permisos para visualizar el módulo de Planificación.</p>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout currentSection="Proyectos">
      <div className="space-y-6 max-w-full overflow-hidden">
        <div className="flex flex-col xl:flex-row justify-between gap-4 items-start xl:items-center">
            <div className="flex flex-col w-full xl:w-auto">
                <h2 className="text-2xl font-bold tracking-tight">Gestión de Proyectos</h2>
                {puedeCrear && (
                    <div className="mt-2">
                        <Button size="sm" onClick={abrirCrear} className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="mr-2 h-4 w-4"/> Nuevo Proyecto
                        </Button>
                    </div>
                )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                <Select value={filterDependencia} onValueChange={setFilterDependencia}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white"><SelectValue placeholder="Dependencia" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todas">Todas las Dep.</SelectItem>
                        {opciones.dependencias.map(d => (
                            <SelectItem key={d.sigla} value={d.sigla}>{d.sigla}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={filterEstado} onValueChange={setFilterEstado}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white"><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos los Estados</SelectItem>
                        <SelectItem value="1">En Edición</SelectItem>
                        <SelectItem value="2">Para Autorizar</SelectItem>
                        <SelectItem value="3">Aprobado</SelectItem>
                        <SelectItem value="4">Rechazado</SelectItem>
                        <SelectItem value="5">Cerrado</SelectItem>
                    </SelectContent>
                </Select>

                <div className="relative w-full sm:w-[250px]">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8 bg-white" placeholder="Buscar proyecto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left table-fixed min-w-[950px]">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 w-[25%]">Proyecto</th>
                    <th className="px-6 py-3 w-[10%]">Dependencia</th>
                    <th className="px-6 py-3 w-[22%]">Objetivo General</th>
                    <th className="px-6 py-3 w-[15%]">Prioridad / Estado</th>
                    <th className="px-6 py-3 w-[15%]">Referente(s)</th>
                    <th className="px-6 py-3 w-[13%] text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No se encontraron resultados</td></tr>
                  ) : (
                    filtered.map((proy) => (
                      <tr key={proy.id_proyecto} className="bg-white hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 align-top">
                           <div className="font-bold text-sm text-blue-800 break-words leading-tight">{proy.proyecto_descripcion}</div>
                        </td>
                        <td className="px-6 py-4 align-top">
                           <div className="text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded font-bold inline-block uppercase">
                               {proy.sigla_dependencia}
                           </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                           <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                                {proy.og_descripcion || <span className="italic text-gray-400 text-[11px]">Sin definir</span>}
                           </p>
                        </td>
                        <td className="px-6 py-4 align-top text-[11px] space-y-1">
                           <div className="truncate"><span className="font-semibold text-gray-500">Prio:</span> {proy.prioridad_desc || "-"}</div>
                           <div>
                               <span className="font-semibold text-gray-500">Est:</span> {proy.estado_desc || "-"}
                               <div className={`mt-0.5 font-bold ${proy.estado_proyecto == 1 ? 'text-blue-600' : 'text-green-600'}`}>
                                   [{proy.estado_workflow_desc}]
                               </div>
                           </div>
                        </td>
                        <td className="px-6 py-4 align-top text-[11px] font-medium break-words leading-tight">
                            {proy.referentes && proy.referentes.length > 0 ? proy.referentes.map((r:any) => r.nombre).join(" | ") : <span className="italic text-slate-400">Sin asignar</span>}
                        </td>
                        <td className="px-6 py-4 text-right align-top">
                            <div className="grid grid-cols-3 gap-1 justify-items-end">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirComentarios(proy)} title="Revisiones">
                                    <MessageSquare className="h-4 w-4 text-slate-400" />
                                </Button>
                                
                                <Link to={`/proyecto-detalle/${proy.id_proyecto}`}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Ir al Detalle"><ArrowRight className="h-4 w-4 text-gray-400" /></Button>
                                </Link>

                                {puedeEditar(proy) && (
                                    <>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEditar(proy)} title="Editar"><Pencil className="h-4 w-4 text-blue-600" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleBorrar(proy.id_proyecto)} title="Borrar"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                        
                                        {Number(proy.estado_proyecto) === ESTADO_PROYECTO.EDICION && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleEnviarAutorizar(proy)} title="Enviar a Autorizar">
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
             </div>
          </CardContent>
        </Card>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[600px] lg:max-w-[850px] w-full p-0 gap-0 overflow-hidden shadow-2xl border-none">
            <DialogHeader className="p-6 border-b bg-white">
                <DialogTitle className="text-xl font-bold text-slate-800">{editData.id_proyecto === 0 ? "Nuevo Proyecto" : "Editar Proyecto"}</DialogTitle>
                <DialogDescription className="text-slate-500">Defina los parámetros generales del proyecto institucional.</DialogDescription>
            </DialogHeader>
            
            <div className="p-6 max-h-[75vh] overflow-y-auto bg-slate-50/30 custom-scrollbar">
               <div className="grid grid-cols-1 gap-5">
                   <div className="space-y-2">
                       <Label className="text-xs uppercase tracking-wider font-bold text-slate-500">Nombre del Proyecto</Label>
                       <Input 
                            value={editData.descripcion} 
                            onChange={(e) => setEditData({...editData, descripcion: e.target.value})} 
                            placeholder="Ej: Plan Estratégico de Modernización..." 
                            className="bg-white border-slate-200"
                       />
                   </div>
                   
                   <div className="space-y-2">
                       <Label className="text-xs uppercase tracking-wider font-bold text-blue-600">Objetivo General</Label>
                       <textarea 
                          className="flex min-h-[140px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                          value={editData.og_descripcion} 
                          onChange={(e) => setEditData({...editData, og_descripcion: e.target.value})} 
                          placeholder="Describa el impacto esperado..." 
                       />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="space-y-2">
                           <Label className="text-xs uppercase tracking-wider font-bold text-slate-500">Prioridad</Label>
                           <Select value={editData.id_prioridad} onValueChange={(val) => setEditData({...editData, id_prioridad: val})}>
                                <SelectTrigger className="bg-white border-slate-200"><SelectValue placeholder="Seleccionar prioridad..." /></SelectTrigger>
                                <SelectContent>
                                    {opciones.prioridades.map(p => <SelectItem key={p.id_prioridad} value={String(p.id_prioridad)}>{p.descripcion}</SelectItem>)}
                                </SelectContent>
                           </Select>
                       </div>

                       <div className="space-y-2">
                           <Label className="text-xs uppercase tracking-wider font-bold text-slate-500">Estado Original</Label>
                           <Select value={editData.id_estado} onValueChange={(val) => setEditData({...editData, id_estado: val})}>
                                <SelectTrigger className="bg-white border-slate-200"><SelectValue placeholder="Estado inicial..." /></SelectTrigger>
                                <SelectContent>
                                    {opciones.estados.map(e => <SelectItem key={e.id_estado} value={String(e.id_estado)}>{e.descripcion}</SelectItem>)}
                                </SelectContent>
                           </Select>
                       </div>
                       
                       <div className="space-y-2">
                           <Label className="text-xs uppercase tracking-wider font-bold text-slate-500">Dependencia</Label>
                           {puedeElegirDependencia ? (
                               <Select value={editData.sigla_dependencia} onValueChange={(val) => setEditData({...editData, sigla_dependencia: val})}>
                                    <SelectTrigger className="bg-white border-slate-200"><SelectValue placeholder="Dependencia asignada..." /></SelectTrigger>
                                    <SelectContent>
                                        {opciones.dependencias.map(d => <SelectItem key={d.sigla} value={d.sigla}>{d.sigla} - {d.descripcion}</SelectItem>)}
                                    </SelectContent>
                               </Select>
                           ) : (
                               <Input value={userSigla} disabled className="bg-slate-100 border-slate-200 text-slate-500 font-bold" />
                           )}
                       </div>
                   </div>
                   
                   <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider font-bold text-slate-500">Referentes Responsables</Label>
                        <div className="border rounded-md p-3 h-32 overflow-y-auto bg-white border-slate-200 custom-scrollbar">
                            {opciones.referentes.map(ref => (
                                <div key={ref.id_referente} className="flex items-center space-x-2 mb-2 hover:bg-slate-50 p-1 rounded">
                                    <input 
                                        type="checkbox" 
                                        id={`ref-${ref.id_referente}`}
                                        className="accent-blue-600 h-4 w-4 cursor-pointer"
                                        checked={editData.id_referentes.includes(String(ref.id_referente))}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const val = String(ref.id_referente);
                                            setEditData(prev => ({
                                                ...prev,
                                                id_referentes: checked 
                                                    ? [...prev.id_referentes, val]
                                                    : prev.id_referentes.filter(id => id !== val)
                                            }));
                                        }}
                                    />
                                    <label htmlFor={`ref-${ref.id_referente}`} className="text-sm cursor-pointer flex-1 font-medium text-slate-700">
                                        {ref.apellido}, {ref.nombre}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
               </div>
            </div>

            <DialogFooter className="p-4 border-t bg-white flex flex-col-reverse sm:flex-row gap-2">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto font-semibold">Cancelar</Button>
                <Button onClick={handleGuardar} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-8 shadow-lg shadow-blue-200 font-bold">
                    <Save className="mr-2 h-4 w-4" /> Guardar Proyecto
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {commentOpen && (
            <ComentariosModal 
                isOpen={commentOpen}
                onClose={() => setCommentOpen(false)}
                entityType="proyecto"
                entityId={selectedEntity.id}
                entityTitle={selectedEntity.title}
            />
        )}
      </div>
    </DashboardLayout>
  )
}