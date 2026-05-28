import { useState, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Search, ArrowRight, FolderKanban, ListChecks, X, Plus, Save, MessageSquare, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ComentariosModal } from "@/components/ComentariosModal"

const API_BASE = "http://localhost/planificacion/api-backend";
const ESTADO_PROYECTO = { EDICION: 1, PARA_AUTORIZAR: 2, APROBADO: 3, RECHAZADO: 4, CERRADO: 5 };

export default function ActividadesPage() {
  const { toast } = useToast()
  
  // --- CIRUGÍA DE SEGURIDAD ---
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams()
  const siglaFilter = searchParams.get("sigla")
  const idProyectoFilter = searchParams.get("id_proyecto")
  // NUEVO: Filtro por Objetivo Específico
  const idOeFilter = searchParams.get("id_oe")

  const filterDependencia = siglaFilter || "todas";
  const filterProyecto = idProyectoFilter || "todos";
  const filterOE = idOeFilter || "todos";

  const [actividades, setActividades] = useState<any[]>([])
  const [proyectosMaster, setProyectosMaster] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [userRol, setUserRol] = useState("")
  const [userSigla, setUserSigla] = useState("")

  const [opciones, setOpciones] = useState<{tipos: any[], estados: any[], dependencias: any[]}>({ tipos: [], estados: [], dependencias: [] })
  
  // Listas de OEs separadas (una para el filtro visual, otra para el modal ABM)
  const [filterOEs, setFilterOEs] = useState<any[]>([])
  const [modalOEs, setModalOEs] = useState<any[]>([])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editData, setEditData] = useState({ 
    id_actividad: 0, descripcion: "", id_oe: "", id_tipo: "", id_estado: "", id_proyecto_temp: "" 
  })

  const [commentOpen, setCommentOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState({ id: 0, title: "" })

  // He agregado estados de paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(30)

  useEffect(() => {
    fetchUser()
    fetchOpciones()
    fetchProyectosMaster()
  }, [])

  useEffect(() => {
    fetchActividades()
  }, [siglaFilter, idProyectoFilter, idOeFilter])

  // Disparadores para actualizar los listados de Objetivos Específicos
  useEffect(() => { 
      if (idProyectoFilter) fetchOEsForFilter(idProyectoFilter) 
      else setFilterOEs([])
  }, [idProyectoFilter])

  useEffect(() => { 
      const proyId = editData.id_proyecto_temp || idProyectoFilter;
      if (proyId) fetchOEsForModal(proyId) 
      else setModalOEs([])
  }, [editData.id_proyecto_temp, idProyectoFilter])

  // He agregado este efecto para resetear la página cuando cambian los filtros o la búsqueda
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, siglaFilter, idProyectoFilter, idOeFilter, rowsPerPage])

  const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' });
        const data = await res.json();
        
        // CIRUGÍA: Validamos permisos de módulo
        const rolPlanificacion = data.permisos?.['PLANIFICACION'];
        if (!rolPlanificacion) {
            setAccesoDenegado(true);
            return;
        }

        setUserRol(rolPlanificacion); 
        setUserSigla(data.sigla || "");
      } catch (e) { console.error(e) }
  }

  const fetchOpciones = async () => {
    try {
        const resAct = await fetch(`${API_BASE}/opciones_actividad.php`)
        const dataAct = await resAct.json()
        
        // MODIFICACIÓN QUIRÚRGICA: Traemos también las dependencias para los filtros
        const resProy = await fetch(`${API_BASE}/opciones_proyecto.php`)
        const dataProy = await resProy.json()

        setOpciones({
            tipos: dataAct.tipos || [],
            estados: dataAct.estados || [],
            dependencias: dataProy.dependencias || []
        })
    } catch (e) { console.error(e) }
  }

  const fetchProyectosMaster = async () => {
    try {
        const res = await fetch(`${API_BASE}/lista_proyectos.php`, { credentials: 'include' })
        setProyectosMaster(await res.json())
    } catch (e) { console.error(e) }
  }

  const fetchOEsForFilter = async (idProy: string) => {
    try {
        const res = await fetch(`${API_BASE}/opciones_jerarquia.php?tipo=oes&id=${idProy}`, { credentials: 'include' })
        setFilterOEs(await res.json())
    } catch (e) { console.error(e) }
  }

  const fetchOEsForModal = async (idProy: string) => {
    try {
        const res = await fetch(`${API_BASE}/opciones_jerarquia.php?tipo=oes&id=${idProy}`, { credentials: 'include' })
        setModalOEs(await res.json())
    } catch (e) { console.error(e) }
  }

  const fetchActividades = async () => {
    setLoading(true)
    let url = `${API_BASE}/lista_actividades.php`;
    const params = new URLSearchParams();
    if (idProyectoFilter) params.append("id_proyecto", idProyectoFilter);
    else if (siglaFilter) params.append("sigla", siglaFilter);
    if ([...params].length > 0) url += `?${params.toString()}`;
    
    try {
        const res = await fetch(url, { credentials: 'include' })
        const result = await res.json()
        
        // --- CIRUGÍA A PRUEBA DE BALAS ---
        if (Array.isArray(result)) {
            // Caso 1: El PHP devuelve el array de actividades directamente [ {...}, {...} ]
            setActividades(result)
        } else if (result.success && Array.isArray(result.data)) {
            // Caso 2: El PHP devuelve un objeto envuelto { success: true, data: [...] }
            setActividades(result.data)
        } else {
            console.error("Respuesta inesperada del servidor:", result)
            setActividades([]) 
        }
    } catch (e) { 
        toast({ title: "Error", description: "Error cargando datos", variant: "destructive" }) 
        setActividades([])
    } finally { 
        setLoading(false) 
    }
  }

  const proyectosParaCrear = proyectosMaster.filter(p => 
      Number(p.estado_proyecto) === ESTADO_PROYECTO.EDICION && 
      (['admin', 'cargafull'].includes(userRol) || (userRol === 'carga' && p.sigla_dependencia === userSigla))
  );

  const puedeCrear = () => {
      if (!userRol || userRol === 'autorizante' || userRol === 'consulta') return false;
      if (idProyectoFilter) {
          return proyectosParaCrear.some(p => String(p.id_proyecto) === idProyectoFilter);
      }
      return proyectosParaCrear.length > 0;
  }

  const puedeEditar = (act: any) => {
    const estado = Number(act.estado_proyecto);
    if (estado !== ESTADO_PROYECTO.EDICION) return false;

    const esAdmin = userRol === 'admin';
    const esMiDep = userSigla === act.sigla_dependencia;
    const enEdicion = estado === ESTADO_PROYECTO.EDICION;

    if (esAdmin) return true;
    if (userRol === 'cargafull' && enEdicion) return true;
    if (userRol === 'carga' && esMiDep && enEdicion) return true;
    
    return false;
  }

  // --- MANEJO DE FILTROS ANIDADOS ---
  const proyectosDisponibles = proyectosMaster.filter(p => filterDependencia === "todas" || p.sigla_dependencia === filterDependencia);

  const handleDependenciaChange = (val: string) => {
      if (val === "todas") searchParams.delete("sigla");
      else searchParams.set("sigla", val);
      searchParams.delete("id_proyecto"); 
      searchParams.delete("id_oe"); 
      setSearchParams(searchParams);
  }

  const handleProyectoChange = (val: string) => {
      if (val === "todos") searchParams.delete("id_proyecto");
      else searchParams.set("id_proyecto", val);
      searchParams.delete("id_oe"); 
      setSearchParams(searchParams);
  }

  const handleOEChange = (val: string) => {
      if (val === "todos") searchParams.delete("id_oe");
      else searchParams.set("id_oe", val);
      setSearchParams(searchParams);
  }

  const limpiarFiltro = () => setSearchParams({})

  const abrirCrear = () => {
    setEditData({ id_actividad: 0, descripcion: "", id_oe: "", id_tipo: "", id_estado: "", id_proyecto_temp: idProyectoFilter || "" })
    setIsModalOpen(true)
  }

  const abrirEditar = (act: any) => {
    setEditData({
      id_actividad: act.id_actividad,
      descripcion: act.actividad_descripcion,
      id_oe: String(act.id_oe),
      id_tipo: act.id_tipo_actividad_prioritaria ? String(act.id_tipo_actividad_prioritaria) : "",
      id_estado: act.id_estado ? String(act.id_estado) : "",
      id_proyecto_temp: String(act.id_proyecto) // FIX: Aseguramos que se carguen los OEs de este proyecto
    })
    setIsModalOpen(true)
  }

  const abrirComentarios = (act: any) => {
    setSelectedEntity({ id: act.id_actividad, title: act.actividad_descripcion })
    setCommentOpen(true)
  }

  const handleGuardar = async () => {
      if (editData.id_actividad === 0) {
          if (!idProyectoFilter && !editData.id_proyecto_temp) { toast({title:"Error", description: "Selecciona un Proyecto", variant:"destructive"}); return; }
          if (!editData.id_oe) { toast({title:"Error", description: "Selecciona un Objetivo", variant:"destructive"}); return; }
      }
      if (!editData.descripcion) { toast({title:"Error", description: "Falta descripción", variant:"destructive"}); return; }
      
      const body = {
        id_actividad: editData.id_actividad,
        descripcion: editData.descripcion,
        id_oe: editData.id_oe,
        id_tipo_actividad_prioritaria: editData.id_tipo || null,
        id_estado: editData.id_estado || null
      };

      try {
          const res = await fetch(`${API_BASE}/abm_actividades.php`, {
              method: editData.id_actividad === 0 ? "POST" : "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: 'include',
              body: JSON.stringify(body)
          });
          if (res.ok) {
              toast({title: "Guardado"}); setIsModalOpen(false); fetchActividades();
          } else {
              throw new Error("Error al guardar");
          }
      } catch (e: any) { toast({title: "Error", description: e.message, variant: "destructive"}) }
  }

  const handleBorrar = async (id_actividad: number) => {
    if (!confirm("¿Seguro que deseas eliminar esta actividad?")) return;
    try {
      const res = await fetch(`${API_BASE}/abm_actividades.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ id_actividad })
      });
      if (res.ok) { toast({ title: "Eliminado" }); fetchActividades(); } 
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }) }
  }

  // Filtrado Frontend robusto (incluye el OE seleccionado)
  const filtered = actividades.filter(a => {
    const matchSearch = (a.actividad_descripcion || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (a.oe_descripcion || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchOe = idOeFilter ? String(a.id_oe) === idOeFilter : true;
    return matchSearch && matchOe;
  })

  // Lógica de paginación
  const totalPages = Math.ceil(filtered.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedData = filtered.slice(startIndex, endIndex)

  // He cambiado el título a uno fijo según lo solicitado
  const tituloPagina = "Actividades Prioritarias"

  if (loading) return <DashboardLayout currentSection="Actividades Prioritarias"><div className="p-8 text-center">Cargando...</div></DashboardLayout>

  // PANTALLA DE ACCESO DENEGADO
  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Actividades Prioritarias">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>No tenés permisos para visualizar el módulo de Planificación.</p>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout currentSection="Actividades Prioritarias">
      <div className="space-y-6">
        
        {/* BARRA DE HERRAMIENTAS CON FILTROS ANIDADOS */}
        <div className="flex flex-col xl:flex-row justify-between gap-4 items-start xl:items-center">
            <div className="flex flex-col w-full xl:w-auto">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-tight">{tituloPagina}</h2>
                    {(siglaFilter || idProyectoFilter || idOeFilter) && (
                        <Button variant="outline" size="sm" onClick={limpiarFiltro} className="h-8 text-muted-foreground"><X className="h-3 w-3 mr-1" /> Ver todos</Button>
                    )}
                </div>
                {puedeCrear() && (
                    <div className="mt-2">
                        <Button size="sm" onClick={abrirCrear} className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="mr-2 h-4 w-4"/> Nueva Actividad
                        </Button>
                    </div>
                )}
            </div>
            
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full xl:w-auto items-center">
                <Select value={filterDependencia} onValueChange={handleDependenciaChange}>
                    <SelectTrigger className="w-full sm:w-[150px] bg-white"><SelectValue placeholder="Dependencia" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todas">Todas las Dep.</SelectItem>
                        {opciones.dependencias.map(d => (
                            <SelectItem key={d.sigla} value={d.sigla}>{d.sigla}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* He agregado scroll al SelectContent del filtro de proyectos */}
                <Select value={filterProyecto} onValueChange={handleProyectoChange}>
                    <SelectTrigger className="w-full sm:w-[220px] bg-white truncate"><SelectValue placeholder="Proyecto" /></SelectTrigger>
                    <SelectContent className="max-w-[90vw] sm:max-w-[400px] max-h-[300px] overflow-y-auto">
                        <SelectItem value="todos">Todos los Proyectos</SelectItem>
                        {proyectosDisponibles.map(p => (
                            <SelectItem key={p.id_proyecto} value={String(p.id_proyecto)} className="whitespace-normal break-words py-2 pr-8" title={p.proyecto_descripcion}>
                                {p.proyecto_descripcion}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={filterOE} onValueChange={handleOEChange} disabled={!idProyectoFilter}>
                    <SelectTrigger className="w-full sm:w-[220px] bg-white truncate">
                        <SelectValue placeholder="Objetivo Esp." />
                    </SelectTrigger>
                    <SelectContent className="max-w-[90vw] sm:max-w-[400px] max-h-[300px] overflow-y-auto">
                        <SelectItem value="todos">Todos los O.E.</SelectItem>
                        {filterOEs.map(oe => (
                            <SelectItem key={oe.id_oe} value={String(oe.id_oe)} className="whitespace-normal break-words py-2 pr-8" title={oe.descripcion}>
                                {oe.descripcion}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative w-full sm:w-[180px]">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." className="pl-8 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Actividades ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 w-[30%]">Descripción / Contexto</th>
                    <th className="px-6 py-3 w-[20%]">Tipo y Estado</th>
                    <th className="px-6 py-3 w-[20%]">Dependencia / Proyecto</th>
                    <th className="px-6 py-3 w-[15%]">Est. Proyecto</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No se encontraron resultados</td></tr>
                  ) : (
                    paginatedData.map((act) => (
                      <tr key={act.id_actividad} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900 align-top">
                          <div className="flex items-start gap-2">
                            <ListChecks className="h-4 w-4 text-green-600 mt-1 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold">{act.actividad_descripcion}</p>
                                <p className="text-xs text-muted-foreground mt-1"><span className="font-bold">OE:</span> {act.oe_descripcion}</p>
                            </div>
                          </div>
                         </td>
                        <td className="px-6 py-4 align-top text-xs space-y-2">
                            <div className="flex flex-col"><span className="text-muted-foreground text-[10px]">Tipo:</span><span className="font-medium">{act.tipo_descripcion || "-"}</span></div>
                            <div className="flex flex-col"><span className="text-muted-foreground text-[10px]">Estado:</span><span className="font-medium text-blue-700">{act.estado_actividad_descripcion || "-"}</span></div>
                         </td>
                        <td className="px-6 py-4 text-muted-foreground align-top text-xs">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-blue-600">{act.sigla_dependencia}</span>
                                <div className="flex items-center gap-1"><FolderKanban className="h-3 w-3" /> {act.proyecto_descripcion}</div>
                            </div>
                         </td>
                        <td className="px-6 py-4 align-top">
                           <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap
                             ${act.estado_proyecto == 1 ? 'bg-blue-100 text-blue-800' : 
                               act.estado_proyecto == 3 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' }
                           `}>{act.proyecto_estado_descripcion}</span>
                         </td>
                        <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap align-top">

                            <Link to={`/proyecto-detalle/${act.id_proyecto}`}>
                                <Button variant="ghost" size="sm" title="Ir al Proyecto"><ArrowRight className="h-4 w-4 text-gray-500" /></Button>
                            </Link>
                            
                            <Button variant="ghost" size="sm" onClick={() => abrirComentarios(act)} title="Revisiones">
                                <MessageSquare className="h-4 w-4 text-slate-500" />
                            </Button>

                            {puedeEditar(act) && (
                                <>
                                    <Button variant="ghost" size="sm" onClick={() => abrirEditar(act)}><Pencil className="h-4 w-4 text-blue-600" /></Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleBorrar(act.id_actividad)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                </>
                            )}
                         </td>
                       </tr>
                    ))
                  )}
                </tbody>
              </table>
             </div>

             {/* He agregado el panel de paginación con selector de filas por página */}
             {filtered.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 py-4 border-t bg-gray-50">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filtered.length)} de {filtered.length} resultados
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm px-2">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Filas por página:</span>
                    <Select value={String(rowsPerPage)} onValueChange={(val) => setRowsPerPage(Number(val))}>
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
             )}
          </CardContent>
        </Card>

        {/* --- MODAL ABM (ALTA/EDICIÓN) - Diseño Responsivo y Ajuste de Línea --- */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px] w-[95vw]">
            <DialogHeader>
              <DialogTitle>{editData.id_actividad === 0 ? "Nueva Actividad" : "Editar Actividad"}</DialogTitle>
              <DialogDescription>{editData.id_actividad === 0 ? "Define el proyecto, el objetivo y crea la actividad." : "Modifica los datos."}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
               {editData.id_actividad === 0 && !idProyectoFilter && (
                   <div className="space-y-2">
                       <Label>1. Seleccionar Proyecto</Label>
                       <Select value={editData.id_proyecto_temp} onValueChange={(val) => setEditData({...editData, id_proyecto_temp: val, id_oe: ""})}>
                            <SelectTrigger className="h-auto min-h-10 whitespace-normal text-left break-words [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:break-words">
                                <SelectValue placeholder="Proyecto..." />
                            </SelectTrigger>
                            <SelectContent className="max-w-[90vw] sm:max-w-[550px] max-h-[300px] overflow-y-auto">
                                {proyectosParaCrear.map(p => (
                                    <SelectItem key={p.id_proyecto} value={String(p.id_proyecto)} className="whitespace-normal break-words py-2 pr-8">
                                        {p.proyecto_descripcion}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                       </Select>
                   </div>
               )}
               {(idProyectoFilter || editData.id_proyecto_temp) && (
                   <div className="space-y-2">
                       <Label>2. Objetivo Específico</Label>
                       <Select value={editData.id_oe} onValueChange={(val) => setEditData({...editData, id_oe: val})}>
                            <SelectTrigger className="h-auto min-h-10 whitespace-normal text-left break-words [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:break-words">
                                <SelectValue placeholder="Seleccionar objetivo..." />
                            </SelectTrigger>
                            <SelectContent className="max-w-[90vw] sm:max-w-[550px] max-h-[300px] overflow-y-auto">
                                {modalOEs.length === 0 ? (
                                    <SelectItem value="0" disabled>Sin objetivos</SelectItem>
                                ) : (
                                    modalOEs.map(oe => (
                                        <SelectItem key={oe.id_oe} value={String(oe.id_oe)} className="whitespace-normal break-words py-2 pr-8">
                                            {oe.descripcion}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                       </Select>
                   </div>
               )}

               <div className="space-y-2">
                   <Label>Descripción</Label>
                   <Input value={editData.descripcion} onChange={(e) => setEditData({...editData, descripcion: e.target.value})} />
               </div>
               
               {/* MODIFICACIÓN: Columnas responsivas para Tipo y Estado */}
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-2">
                       <Label>Tipo</Label>
                       <Select value={editData.id_tipo} onValueChange={(val) => setEditData({...editData, id_tipo: val})}>
                           <SelectTrigger className="h-auto min-h-10 whitespace-normal text-left break-words [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:break-words">
                               <SelectValue/>
                           </SelectTrigger>
                           <SelectContent className="max-w-[90vw] sm:max-w-[300px] max-h-[300px] overflow-y-auto">
                               {opciones.tipos.map(t => (
                                   <SelectItem key={t.id} value={String(t.id)} className="whitespace-normal break-words py-2 pr-8">
                                       {t.descripcion}
                                   </SelectItem>
                               ))}
                           </SelectContent>
                       </Select>
                   </div>
                   <div className="space-y-2">
                       <Label>Estado</Label>
                       <Select value={editData.id_estado} onValueChange={(val) => setEditData({...editData, id_estado: val})}>
                           <SelectTrigger className="h-auto min-h-10 whitespace-normal text-left break-words [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:break-words">
                               <SelectValue/>
                           </SelectTrigger>
                           <SelectContent className="max-w-[90vw] sm:max-w-[300px] max-h-[300px] overflow-y-auto">
                               {opciones.estados.map(e => (
                                   <SelectItem key={e.id} value={String(e.id)} className="whitespace-normal break-words py-2 pr-8">
                                       {e.descripcion}
                                   </SelectItem>
                               ))}
                           </SelectContent>
                       </Select>
                   </div>
               </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleGuardar}><Save className="mr-2 h-4 w-4"/> Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- MODAL COMENTARIOS --- */}
        {commentOpen && (
            <ComentariosModal 
                isOpen={commentOpen}
                onClose={() => setCommentOpen(false)}
                entityType="actividad_prioritaria"
                entityId={selectedEntity.id}
                entityTitle={selectedEntity.title}
            />
        )}
      </div>
    </DashboardLayout>
  )
}