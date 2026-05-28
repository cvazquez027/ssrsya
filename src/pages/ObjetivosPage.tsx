import { useState, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Search, ArrowRight, FolderKanban, X, Plus, Save, MessageSquare, ShieldAlert } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ComentariosModal } from "@/components/ComentariosModal"

const API_BASE = "http://localhost/planificacion/api-backend";
const ESTADO = { EDICION: 1, PARA_AUTORIZAR: 2, APROBADO: 3 };

export default function ObjetivosPage() {
  const { toast } = useToast()
  
  // --- CIRUGÍA DE SEGURIDAD ---
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams()
  const siglaFilter = searchParams.get("sigla")
  const idProyectoFilter = searchParams.get("id_proyecto")

  // Estados derivados para los filtros anidados
  const filterDependencia = siglaFilter || "todas";
  const filterProyecto = idProyectoFilter || "todos";

  const [objetivos, setObjetivos] = useState<any[]>([])
  const [proyectosMaster, setProyectosMaster] = useState<any[]>([]) // Master list para los filtros y validaciones
  const [opciones, setOpciones] = useState<{ dependencias: any[] }>({ dependencias: [] })

  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const [userRol, setUserRol] = useState("")
  const [userSigla, setUserSigla] = useState("")
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [formData, setFormData] = useState({ 
    id_oe: 0, descripcion: "", id_proyecto_seleccionado: "" 
  })

  const [commentOpen, setCommentOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState({ id: 0, title: "" })

  useEffect(() => {
    fetchUser()
    fetchOpciones()
    fetchProyectosMaster()
  }, [])

  useEffect(() => {
    fetchObjetivos()
  }, [siglaFilter, idProyectoFilter])

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' })
      const data = await res.json()
      
      // CIRUGÍA: Validamos permisos de módulo
      const rolPlanificacion = data.permisos?.['PLANIFICACION'];
      if (!rolPlanificacion) {
          setAccesoDenegado(true);
          return;
      }

      setUserRol(rolPlanificacion)
      setUserSigla(data.sigla || "")
    } catch (e) { console.error(e) }
  }

  const fetchOpciones = async () => {
    try {
        const res = await fetch(`${API_BASE}/opciones_proyecto.php`)
        const data = await res.json()
        setOpciones({ dependencias: data.dependencias || [] })
    } catch (e) { console.error(e) }
  }

  const fetchProyectosMaster = async () => {
    try {
        const res = await fetch(`${API_BASE}/lista_proyectos.php`, { credentials: 'include' })
        const data = await res.json()
        setProyectosMaster(data)
    } catch (e) { console.error(e) }
  }

  const fetchObjetivos = async () => {
    try {
      setLoading(true)
      let url = `${API_BASE}/lista_objetivos.php`; 
      const params = new URLSearchParams();
      if (idProyectoFilter) params.append("id_proyecto", idProyectoFilter);
      else if (siglaFilter) params.append("sigla", siglaFilter);
      if ([...params].length > 0) url += `?${params.toString()}`;

      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error("Error de conexión")
      const data = await res.json()
      setObjetivos(data)
    } catch (error) { toast({ title: "Error", description: "No se pudieron cargar los datos", variant: "destructive" }) } 
    finally { setLoading(false) }
  }

  const proyectosParaCrear = proyectosMaster.filter(p => 
      Number(p.estado_proyecto) === ESTADO.EDICION && 
      (['admin', 'cargafull'].includes(userRol) || (userRol === 'carga' && p.sigla_dependencia === userSigla))
  );

  const puedeCrear = () => {
      if (!userRol || userRol === 'autorizante' || userRol === 'consulta') return false;
      if (idProyectoFilter) {
          return proyectosParaCrear.some(p => String(p.id_proyecto) === idProyectoFilter);
      }
      return proyectosParaCrear.length > 0;
  }

  const puedeEditar = (oe: any) => {
    const estado = Number(oe.estado_proyecto);
    if (estado !== ESTADO.EDICION) return false;

    const esAdmin = userRol === 'admin';
    const esMiDep = userSigla === oe.sigla_dependencia;
    const enEdicion = estado === ESTADO.EDICION;

    if (esAdmin) return true; 
    if (userRol === 'cargafull' && enEdicion) return true; 
    if (userRol === 'carga' && esMiDep && enEdicion) return true; 
    
    return false;
  }

  const proyectosDisponibles = proyectosMaster.filter(p => filterDependencia === "todas" || p.sigla_dependencia === filterDependencia);

  const handleDependenciaChange = (val: string) => {
      if (val === "todas") searchParams.delete("sigla");
      else searchParams.set("sigla", val);
      searchParams.delete("id_proyecto"); 
      setSearchParams(searchParams);
  }

  const handleProyectoChange = (val: string) => {
      if (val === "todos") searchParams.delete("id_proyecto");
      else searchParams.set("id_proyecto", val);
      setSearchParams(searchParams);
  }

  const limpiarFiltro = () => setSearchParams({})

  const handleAbrirCrear = () => {
    setModalMode("create");
    setFormData({ 
        id_oe: 0, 
        descripcion: "", 
        id_proyecto_seleccionado: idProyectoFilter || "" 
    });
    setIsModalOpen(true);
  }

  const handleAbrirEditar = (oe: any) => {
    setModalMode("edit");
    setFormData({ id_oe: oe.id_oe, descripcion: oe.descripcion, id_proyecto_seleccionado: String(oe.id_proyecto) });
    setIsModalOpen(true);
  }

  const abrirComentarios = (oe: any) => {
    setSelectedEntity({ id: oe.id_oe, title: oe.descripcion })
    setCommentOpen(true)
  }

  const handleGuardar = async () => {
    try {
      const metodo = modalMode === "edit" ? "PUT" : "POST";
      const body: any = { descripcion: formData.descripcion };

      if (modalMode === "edit") {
        body.id_oe = formData.id_oe;
      } else {
        body.id_proyecto = idProyectoFilter || formData.id_proyecto_seleccionado;
        if (!body.id_proyecto) { toast({ title: "Error", description: "Debe seleccionar un proyecto", variant: "destructive" }); return; }
      }

      const res = await fetch(`${API_BASE}/abm_objetivos.php`, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        toast({ title: "Éxito", description: data.mensaje });
        setIsModalOpen(false);
        fetchObjetivos();
      } else {
        throw new Error(data.error || "Error al guardar");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }

  const handleBorrar = async (id_oe: number) => {
    if (!confirm("¿Seguro que deseas eliminar este objetivo?")) return;
    try {
      const res = await fetch(`${API_BASE}/abm_objetivos.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ id_oe })
      });
      if (res.ok) {
        toast({ title: "Eliminado", description: "Objetivo borrado" });
        fetchObjetivos();
      } else {
        const data = await res.json();
        throw new Error(data.error);
      }
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }) }
  }

  const filtered = objetivos.filter(oe => 
    (oe.descripcion || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (oe.proyecto_nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  let tituloPagina = "Listado de Objetivos Específicos";
  if (idProyectoFilter && objetivos.length > 0) tituloPagina = `Objetivos del Proyecto: ${objetivos[0].proyecto_nombre}`;
  else if (siglaFilter) tituloPagina = `Objetivos de ${siglaFilter}`;

  if (loading) return <DashboardLayout currentSection="Objetivos"><div className="p-8 text-center">Cargando datos...</div></DashboardLayout>

  // PANTALLA DE ACCESO DENEGADO
  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Objetivos Específicos">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>No tenés permisos para visualizar el módulo de Planificación.</p>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout currentSection="Objetivos Específicos">
      <div className="space-y-6">
        
        <div className="flex flex-col xl:flex-row justify-between gap-4 items-start xl:items-center">
          <div className="flex flex-col w-full xl:w-auto">
             <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold tracking-tight">{tituloPagina}</h2>
                {(siglaFilter || idProyectoFilter) && (
                  <Button variant="outline" size="sm" onClick={limpiarFiltro} className="h-8 text-muted-foreground">
                    <X className="h-3 w-3 mr-1" /> Limpiar Filtros
                  </Button>
                )}
             </div>
             {puedeCrear() && (
                 <div className="mt-2">
                     <Button size="sm" onClick={handleAbrirCrear} className="bg-blue-600 hover:bg-blue-700">
                         <Plus className="h-4 w-4 mr-2" /> Nuevo Objetivo
                     </Button>
                 </div>
             )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
              <Select value={filterDependencia} onValueChange={handleDependenciaChange}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-white"><SelectValue placeholder="Dependencia" /></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="todas">Todas las Dep.</SelectItem>
                      {opciones.dependencias.map(d => (
                          <SelectItem key={d.sigla} value={d.sigla}>{d.sigla}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>

              <Select value={filterProyecto} onValueChange={handleProyectoChange}>
                  <SelectTrigger className="w-full sm:w-[250px] bg-white"><SelectValue placeholder="Proyecto" /></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="todos">Todos los Proyectos</SelectItem>
                      {proyectosDisponibles.map(p => (
                          <SelectItem key={p.id_proyecto} value={String(p.id_proyecto)} title={p.proyecto_descripcion}>
                              {p.proyecto_descripcion.length > 35 ? p.proyecto_descripcion.substring(0, 35) + '...' : p.proyecto_descripcion}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>

              <div className="relative w-full sm:w-[200px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-8 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Resultados ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 w-1/2">Objetivo Específico</th>
                    <th className="px-6 py-3 w-1/4">Dependencia/Proyecto</th>
                    <th className="px-6 py-3 w-1/6">Estado</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No se encontraron resultados</td></tr>
                  ) : (
                    filtered.map((oe) => (
                      <tr key={oe.id_oe} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900 align-top">{oe.descripcion}</td>
                        <td className="px-6 py-4 text-muted-foreground align-top">
                            <div className="flex flex-col gap-1">
                                <span className="font-semibold text-xs text-blue-600">{oe.sigla_dependencia}</span>
                                <div className="flex items-center gap-2">
                                    <FolderKanban className="h-3 w-3" />
                                    {oe.proyecto_nombre}
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                           <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap
                             ${oe.estado_proyecto == 1 ? 'bg-blue-100 text-blue-800' : 
                               oe.estado_proyecto == 3 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' }
                           `}>
                             {oe.estado_descripcion}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap align-top">

                            <Link to={`/proyecto-detalle/${oe.id_proyecto}`}>
                                <Button variant="ghost" size="sm" title="Ir al Proyecto"><ArrowRight className="h-4 w-4 text-gray-500" /></Button>
                            </Link>
                            
                            <Button variant="ghost" size="sm" onClick={() => abrirComentarios(oe)} title="Revisiones">
                                <MessageSquare className="h-4 w-4 text-slate-500" />
                            </Button>

                            {puedeEditar(oe) && (
                                <>
                                    <Button variant="ghost" size="sm" onClick={() => handleAbrirEditar(oe)}>
                                        <Pencil className="h-4 w-4 text-blue-600" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleBorrar(oe.id_oe)}>
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                </>
                            )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
             </div>
          </CardContent>
        </Card>

        {/* MODAL CREAR/EDITAR - Modificación para responsividad en nombres largos */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px] w-[95vw]">
            <DialogHeader>
              <DialogTitle>{modalMode === 'create' ? 'Nuevo Objetivo' : 'Editar Objetivo'}</DialogTitle>
              {modalMode === 'create' && !idProyectoFilter && 
                <DialogDescription>Selecciona primero el proyecto al que pertenecerá este objetivo.</DialogDescription>
              }
            </DialogHeader>
            <div className="space-y-4 py-4">
               {!idProyectoFilter && modalMode === 'create' && (
                   <div className="space-y-2">
                       <Label>Seleccionar Proyecto</Label>
                       <Select value={formData.id_proyecto_seleccionado} onValueChange={(val) => setFormData({...formData, id_proyecto_seleccionado: val})}>
                            <SelectTrigger className="h-auto min-h-10 whitespace-normal text-left break-words [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:break-words">
                                <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent className="max-w-[90vw] sm:max-w-[550px]">
                                {proyectosParaCrear.map(p => (
                                    <SelectItem key={p.id_proyecto} value={String(p.id_proyecto)} className="whitespace-normal break-words py-2 pr-8">
                                        {p.proyecto_descripcion}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                       </Select>
                   </div>
               )}
               <div className="space-y-2">
                   <Label>Descripción del Objetivo Específico</Label>
                   <Input value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} />
               </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleGuardar}><Save className="h-4 w-4 mr-2" /> Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {commentOpen && (
            <ComentariosModal 
                isOpen={commentOpen}
                onClose={() => setCommentOpen(false)}
                entityType="objetivo_especifico"
                entityId={selectedEntity.id}
                entityTitle={selectedEntity.title}
            />
        )}
      </div>
    </DashboardLayout>
  )
}