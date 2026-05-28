import { useState, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Search, ArrowRight, FolderKanban, Plus, X, Save, MessageSquare, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ComentariosModal } from "@/components/ComentariosModal"

const API_BASE = "http://localhost/planificacion/api-backend";
const ESTADO_PROYECTO = { EDICION: 1, PARA_AUTORIZAR: 2, APROBADO: 3, RECHAZADO: 4, CERRADO: 5 };

export default function IndicadoresPage() {
  const { toast } = useToast()
  
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams()
  
  const siglaFilter = searchParams.get("sigla")
  const idProyectoFilter = searchParams.get("id_proyecto")
  const idOeFilter = searchParams.get("id_oe")
  const idActividadFilter = searchParams.get("id_actividad")

  const filterDependencia = siglaFilter || "todas";
  const filterProyecto = idProyectoFilter || "todos";
  const filterOE = idOeFilter || "todos";
  const filterActividad = idActividadFilter || "todos";

  const [indicadores, setIndicadores] = useState<any[]>([])
  const [proyectosMaster, setProyectosMaster] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  // --- CIRUGÍA DE SEGURIDAD RLS ---
  const [userRol, setUserRol] = useState("")
  const [userSigla, setUserSigla] = useState("")
  const [userDependencias, setUserDependencias] = useState<string[]>([]) 

  const [filterOEs, setFilterOEs] = useState<any[]>([])
  const [filterActividades, setFilterActividades] = useState<any[]>([])
  const [modalOEs, setModalOEs] = useState<any[]>([])
  const [modalActividades, setModalActividades] = useState<any[]>([])
  const [opciones, setOpciones] = useState<{ dependencias: any[] }>({ dependencias: [] })
  
  const [opcionesInd, setOpcionesInd] = useState<{ tipos: any[] }>({ tipos: [] })
  const [opcionesSistemas, setOpcionesSistemas] = useState<{ sistemas: any[] }>({ sistemas: [] })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editData, setEditData] = useState({ 
    id_indicador: 0, nombre: "", construccion: "", meta_anio1: "", meta_anio2: "", 
    id_actividad: "", id_proyecto_temp: "", id_oe_temp: "", tipo_meta: "cantidad", id_tipo_indicador: "", id_otro_sistema: "",
    fuente: "", linea_base: "" 
  })

  const [commentOpen, setCommentOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState({ id: 0, title: "" })

  // He agregado estados de paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(30)

  useEffect(() => {
    fetchUser(); fetchProyectosMaster(); fetchOpciones(); fetchOpcionesInd(); fetchOpcionesSistemas();
  }, [])

  useEffect(() => {
    fetchIndicadores()
  }, [siglaFilter, idProyectoFilter, idOeFilter, idActividadFilter])

  useEffect(() => {
    if (idProyectoFilter && idProyectoFilter !== "todos") fetchJerarquia('oes', idProyectoFilter, setFilterOEs);
    else { setFilterOEs([]); setFilterActividades([]); }
  }, [idProyectoFilter])

  useEffect(() => {
    if (idOeFilter && idOeFilter !== "todos") fetchJerarquia('actividades', idOeFilter, setFilterActividades);
    else setFilterActividades([]);
  }, [idOeFilter])

  useEffect(() => {
    const proyId = editData.id_proyecto_temp || idProyectoFilter;
    if (isModalOpen && proyId && proyId !== "todos") fetchJerarquia('oes', proyId, setModalOEs);
  }, [editData.id_proyecto_temp, idProyectoFilter, isModalOpen])

  useEffect(() => {
    if (isModalOpen && editData.id_oe_temp) fetchJerarquia('actividades', editData.id_oe_temp, setModalActividades);
  }, [editData.id_oe_temp, isModalOpen])

  // He agregado este efecto para resetear la página cuando cambian los filtros o la búsqueda
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, siglaFilter, idProyectoFilter, idOeFilter, idActividadFilter, rowsPerPage])

  const fetchJerarquia = async (tipo: string, id: string, setter: any) => {
    try {
        const res = await fetch(`${API_BASE}/opciones_jerarquia.php?tipo=${tipo}&id=${id}`, { credentials: 'include' });
        setter(await res.json() || []);
    } catch (e) { console.error(e); }
  }

  const fetchUser = async () => {
    try {
        const res = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' })
        const data = await res.json()
        
        const rolPlanificacion = data.permisos?.['PLANIFICACION'];
        if (!rolPlanificacion) {
            setAccesoDenegado(true);
            return;
        }

        setUserRol(rolPlanificacion); 
        setUserSigla(data.sigla || "");
        // CIRUGÍA: Obtenemos las dependencias múltiples
        setUserDependencias(data.dependencias_permitidas || []); 
    } catch (e) { console.error(e) }
  }

  const fetchOpciones = async () => {
    try {
        const res = await fetch(`${API_BASE}/opciones_proyecto.php`)
        const data = await res.json()
        setOpciones({ dependencias: data.dependencias || [] })
    } catch (e) { console.error(e) }
  }

  const fetchOpcionesInd = async () => {
    try {
        const res = await fetch(`${API_BASE}/opciones_indicador.php`)
        const data = await res.json()
        setOpcionesInd({ tipos: data.tipos || [] })
    } catch (e) { console.error(e) }
  }

  const fetchOpcionesSistemas = async () => {
    try {
        const res = await fetch(`${API_BASE}/opciones_otros_sistemas.php`)
        const data = await res.json()
        setOpcionesSistemas({ sistemas: data.sistemas || [] })
    } catch (e) { console.error(e) }
  }

  const fetchProyectosMaster = async () => {
    try {
        const res = await fetch(`${API_BASE}/lista_proyectos.php`, { credentials: 'include' })
        setProyectosMaster(await res.json())
    } catch (e) { console.error(e) }
  }

  const fetchIndicadores = async () => {
      setLoading(true)
      const params = new URLSearchParams();
      if (idProyectoFilter && idProyectoFilter !== "todos") params.append("id_proyecto", idProyectoFilter);
      if (siglaFilter && siglaFilter !== "todas") params.append("sigla", siglaFilter);
      if (idOeFilter && idOeFilter !== "todos") params.append("id_oe", idOeFilter);
      if (idActividadFilter && idActividadFilter !== "todos") params.append("id_actividad", idActividadFilter);
      
      try {
          const res = await fetch(`${API_BASE}/lista_indicadores.php?${params.toString()}`, { credentials: 'include' })
          setIndicadores(await res.json())
      } catch (e) { toast({ title: "Error", description: "Error cargando indicadores", variant: "destructive" }) } 
      finally { setLoading(false) }
  }

  // --- CIRUGÍA: Función puedeCrear Actualizada ---
  const puedeCrear = () => {
      const rolNormalizado = String(userRol).trim().toLowerCase();
      if (!rolNormalizado || rolNormalizado === 'autorizante' || rolNormalizado === 'consulta') return false;
      
      const proyectosValidos = proyectosMaster.filter(p => {
          const estado = Number(p.estado_proyecto);
          if (estado !== ESTADO_PROYECTO.EDICION) return false;
          if (['admin', 'administrador', 'cargafull'].includes(rolNormalizado)) return true;
          
          const siglaProy = String(p.sigla_dependencia).trim().toLowerCase();
          const siglaBase = String(userSigla).trim().toLowerCase();
          const esMiDep = (siglaBase === siglaProy) || userDependencias.map(d => String(d).trim().toLowerCase()).includes(siglaProy);
          
          return rolNormalizado === 'carga' && esMiDep;
      });

      if (idProyectoFilter && idProyectoFilter !== "todos") {
          return proyectosValidos.some(p => String(p.id_proyecto) === idProyectoFilter);
      }
      return proyectosValidos.length > 0;
  }

  // --- CIRUGÍA: Función puedeEditar Actualizada ---
  const puedeEditar = (ind: any) => {
    const estado = Number(ind.estado_proyecto);
    if (estado !== ESTADO_PROYECTO.EDICION) return false;
    
    const rolNormalizado = String(userRol).trim().toLowerCase();
    if (['admin', 'administrador', 'cargafull'].includes(rolNormalizado)) return true;
    
    const siglaInd = String(ind.sigla_dependencia).trim().toLowerCase();
    const siglaBase = String(userSigla).trim().toLowerCase();
    const esMiDep = (siglaBase === siglaInd) || userDependencias.map(d => String(d).trim().toLowerCase()).includes(siglaInd);
    
    return rolNormalizado === 'carga' && esMiDep;
  }

  const handleBorrar = async (id: number) => {
    if (!confirm("¿Eliminar indicador?")) return;
    try {
        const res = await fetch(`${API_BASE}/abm_indicadores.php`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify({ id_indicador: id })
        });
        if (res.ok) { toast({ title: "Eliminado" }); fetchIndicadores(); }
        else throw new Error("Error al borrar");
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }) }
  }

  const abrirCrear = () => {
    setEditData({ 
        id_indicador: 0, nombre: "", construccion: "", meta_anio1: "", meta_anio2: "", 
        id_actividad: "", id_proyecto_temp: idProyectoFilter || "", id_oe_temp: idOeFilter || "", 
        tipo_meta: "cantidad", id_tipo_indicador: "", id_otro_sistema: "", fuente: "", linea_base: "" 
    })
    setIsModalOpen(true)
  }

  const abrirEditar = (ind: any) => {
    setEditData({
      id_indicador: ind.id_indicador,
      nombre: ind.nombre,
      construccion: ind.construccion || "",
      meta_anio1: ind.meta_anio1 || "",
      meta_anio2: ind.meta_anio2 || "",
      tipo_meta: ind.tipo_meta || "cantidad",
      id_tipo_indicador: String(ind.id_tipo_indicador || ""),
      id_otro_sistema: String(ind.id_otro_sistema || ""),
      fuente: ind.fuente || "",          
      linea_base: ind.linea_base || "",  
      id_actividad: String(ind.id_actividad),
      id_proyecto_temp: String(ind.id_proyecto),
      id_oe_temp: String(ind.id_oe)
    })
    setIsModalOpen(true)
  }

  const handleGuardar = async () => {
      if (!editData.id_actividad || editData.id_actividad === "0") { toast({title:"Error", description: "Seleccione una actividad", variant:"destructive"}); return; }
      if (!editData.id_tipo_indicador) { toast({title:"Error", description: "Seleccione el tipo de indicador", variant:"destructive"}); return; }
      if (!editData.id_otro_sistema) { toast({title:"Error", description: "Seleccione el sistema de origen", variant:"destructive"}); return; }
      if (!editData.nombre) { toast({title:"Error", description: "Falta nombre", variant:"destructive"}); return; }
      
      try {
        const res = await fetch(`${API_BASE}/abm_indicadores.php`, {
            method: editData.id_indicador === 0 ? "POST" : "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify(editData)
        });
        if (res.ok) { toast({ title: "Guardado" }); setIsModalOpen(false); fetchIndicadores(); } 
        else throw new Error("Error al guardar");
      } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  }

  const filtered = indicadores.filter(i => 
    (i.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.actividad_descripcion || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Lógica de paginación
  const totalPages = Math.ceil(filtered.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedData = filtered.slice(startIndex, endIndex)

  if (loading) return <DashboardLayout currentSection="Indicadores"><div className="p-8 text-center">Cargando...</div></DashboardLayout>

  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Indicadores">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>No tenés permisos para visualizar el módulo de Planificación.</p>
              </div>
          </DashboardLayout>
      );
  }

  // Armamos la lista de proyectos válidos para el Modal de Crear
  const rolNormalizadoCrear = String(userRol).trim().toLowerCase();
  const proyectosParaCrear = proyectosMaster.filter(p => {
      if (Number(p.estado_proyecto) !== ESTADO_PROYECTO.EDICION) return false;
      if (['admin', 'administrador', 'cargafull'].includes(rolNormalizadoCrear)) return true;
      
      const siglaProy = String(p.sigla_dependencia).trim().toLowerCase();
      const siglaBase = String(userSigla).trim().toLowerCase();
      const esMiDep = (siglaBase === siglaProy) || userDependencias.map(d => String(d).trim().toLowerCase()).includes(siglaProy);
      
      return rolNormalizadoCrear === 'carga' && esMiDep;
  });

  return (
    <DashboardLayout currentSection="Indicadores">
      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row justify-between gap-4 items-start xl:items-center">
            <div className="flex flex-col w-full xl:w-auto">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-tight">Gestión de Indicadores</h2>
                    {(siglaFilter || idProyectoFilter || idOeFilter || idActividadFilter) && (
                        <Button variant="outline" size="sm" onClick={() => setSearchParams({})} className="h-8 text-muted-foreground"><X className="h-3 w-3 mr-1" /> Limpiar</Button>
                    )}
                </div>
                {puedeCrear() && (
                    <div className="mt-2">
                        <Button size="sm" onClick={abrirCrear} className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4"/> Nuevo Indicador</Button>
                    </div>
                )}
            </div>
            
            <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                <Select value={filterDependencia} onValueChange={(v) => { if(v === "todas") searchParams.delete("sigla"); else searchParams.set("sigla", v); searchParams.delete("id_proyecto"); searchParams.delete("id_oe"); searchParams.delete("id_actividad"); setSearchParams(searchParams); }}>
                    <SelectTrigger className="w-full sm:w-[130px] bg-white">
                        <SelectValue placeholder="Todas las Dep." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todas">Todas las Dep.</SelectItem>
                        {opciones.dependencias.map(d => <SelectItem key={d.sigla} value={d.sigla}>{d.sigla}</SelectItem>)}
                    </SelectContent>
                </Select>

                {/* He agregado scroll al SelectContent del filtro de proyectos */}
                <Select value={filterProyecto} onValueChange={(v) => { if(v === "todos") searchParams.delete("id_proyecto"); else searchParams.set("id_proyecto", v); searchParams.delete("id_oe"); searchParams.delete("id_actividad"); setSearchParams(searchParams); }}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white truncate text-left">
                        <SelectValue placeholder="Todos los Proyectos" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[90vw] sm:max-w-[400px] max-h-[300px] overflow-y-auto">
                        <SelectItem value="todos">Todos los Proyectos</SelectItem>
                        {proyectosMaster.filter(p => filterDependencia === "todas" || p.sigla_dependencia === filterDependencia).map(p => <SelectItem key={p.id_proyecto} value={String(p.id_proyecto)} className="whitespace-normal py-2">{p.proyecto_descripcion}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={filterOE} onValueChange={(v) => { if(v === "todos") searchParams.delete("id_oe"); else searchParams.set("id_oe", v); searchParams.delete("id_actividad"); setSearchParams(searchParams); }} disabled={filterProyecto === "todos"}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white truncate text-left">
                        <SelectValue placeholder="Todos los O.E." />
                    </SelectTrigger>
                    <SelectContent className="max-w-[90vw] sm:max-w-[400px] max-h-[300px] overflow-y-auto">
                        <SelectItem value="todos">Todos los O.E.</SelectItem>
                        {filterOEs.map(oe => <SelectItem key={oe.id_oe} value={String(oe.id_oe)} className="whitespace-normal py-2">{oe.descripcion}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={filterActividad} onValueChange={(v) => { if(v === "todos") searchParams.delete("id_actividad"); else searchParams.set("id_actividad", v); setSearchParams(searchParams); }} disabled={filterOE === "todos"}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white truncate text-left">
                        <SelectValue placeholder="Todas las Actividades" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[90vw] sm:max-w-[400px] max-h-[300px] overflow-y-auto">
                        <SelectItem value="todos">Todas las Actividades</SelectItem>
                        {filterActividades.map(a => <SelectItem key={a.id_actividad} value={String(a.id_actividad)} className="whitespace-normal py-2">{a.descripcion}</SelectItem>)}
                    </SelectContent>
                </Select>

                <div className="relative w-full sm:w-[160px]">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." className="pl-8 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>
        </div>

        <Card>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 w-[25%]">Nombre / Fórmula</th>
                    <th className="px-6 py-3 w-[10%] text-center">Metas</th>
                    <th className="px-6 py-3 w-[30%]">Actividad</th>
                    <th className="px-6 py-3 w-[20%]">Proyecto / Dep</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No se encontraron resultados</td></tr>
                  ) : (
                    paginatedData.map((ind) => (
                      <tr key={ind.id_indicador} className="bg-white border-b hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 align-top">
                           <div className="font-medium text-gray-900 leading-tight">{ind.nombre}</div>
                           
                           {ind.id_tipo_indicador ? (
                               <div 
                                   className="text-[10px] bg-slate-100 text-slate-600 inline-block px-2 py-0.5 rounded mt-1 font-semibold uppercase cursor-help"
                                   title={ind.tipo_indicador_desc || "Sin descripción"}
                               >
                                   {ind.tipo_indicador_nombre || ind.tipo_indicador_desc || `TIPO ID: ${ind.id_tipo_indicador}`}
                               </div>
                           ) : (
                               <div className="text-[10px] bg-orange-100 text-orange-600 inline-block px-2 py-0.5 rounded mt-1 font-semibold uppercase" title="Falta asignar tipo de indicador">
                                   NO ASIGNADO
                               </div>
                           )}

                           <div className="text-[11px] text-muted-foreground mt-1 italic break-words">{ind.construccion}</div>
                          </td>
                        <td className="px-6 py-4 align-top text-xs text-center">
                            <div className="bg-slate-50 p-1 rounded border">
                                <div><span className="font-bold text-slate-500">2026:</span> {ind.meta_anio1 || "0"}{ind.tipo_meta === 'porcentaje' ? '%' : ''}</div>
                                <div className="mt-1"><span className="font-bold text-slate-500">2027:</span> {ind.meta_anio2 || "0"}{ind.tipo_meta === 'porcentaje' ? '%' : ''}</div>
                            </div>
                         </td>
                        <td className="px-6 py-4 align-top text-xs text-muted-foreground italic leading-relaxed">{ind.actividad_descripcion}</td>
                        <td className="px-6 py-4 align-top text-xs">
                            <div className="font-bold text-blue-600 mb-1 uppercase">{ind.sigla_dependencia}</div>
                            <div className="flex items-center gap-1 leading-tight"><FolderKanban className="h-3 w-3 shrink-0" /> {ind.proyecto_nombre}</div>
                         </td>
                        <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap align-top">
                            <Link to={`/proyecto-detalle/${ind.id_proyecto}`}>
                                <Button variant="ghost" size="sm" title="Ver Detalle"><ArrowRight className="h-4 w-4 text-gray-500" /></Button>
                            </Link>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedEntity({id: ind.id_indicador, title: ind.nombre}); setCommentOpen(true); }} title="Revisiones"><MessageSquare className="h-4 w-4 text-slate-500" /></Button>
                            {puedeEditar(ind) && (
                                <>
                                    <Button variant="ghost" size="sm" onClick={() => abrirEditar(ind)} title="Editar"><Pencil className="h-4 w-4 text-blue-600" /></Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleBorrar(ind.id_indicador)} title="Borrar"><Trash2 className="h-4 w-4 text-red-600" /></Button>
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

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px] w-[95vw]">
            <DialogHeader><DialogTitle>{editData.id_indicador === 0 ? "Nuevo Indicador" : "Editar Indicador"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
               {editData.id_indicador === 0 && !idProyectoFilter && (
                   <div className="space-y-2">
                       <Label>1. Proyecto</Label>
                       <Select value={editData.id_proyecto_temp} onValueChange={(val) => setEditData({...editData, id_proyecto_temp: val, id_oe_temp: "", id_actividad: ""})}>
                            <SelectTrigger className="h-auto min-h-10 whitespace-normal text-left break-words [&>span]:line-clamp-none"><SelectValue placeholder="Proyecto..." /></SelectTrigger>
                            <SelectContent className="max-w-[90vw] sm:max-w-[550px] max-h-[300px] overflow-y-auto">
                                {proyectosParaCrear.map(p => <SelectItem key={p.id_proyecto} value={String(p.id_proyecto)} className="whitespace-normal py-2">{p.proyecto_descripcion}</SelectItem>)}
                            </SelectContent>
                       </Select>
                   </div>
               )}
               {(idProyectoFilter || editData.id_proyecto_temp) && (
                   <div className="space-y-2">
                       <Label>2. Objetivo</Label>
                       <Select value={editData.id_oe_temp} onValueChange={(val) => setEditData({...editData, id_oe_temp: val, id_actividad: ""})}>
                            <SelectTrigger className="h-auto min-h-10 whitespace-normal text-left break-words [&>span]:line-clamp-none"><SelectValue placeholder="Objetivo..." /></SelectTrigger>
                            <SelectContent className="max-w-[90vw] sm:max-w-[550px] max-h-[300px] overflow-y-auto">
                                {modalOEs.map(oe => <SelectItem key={oe.id_oe} value={String(oe.id_oe)} className="whitespace-normal py-2">{oe.descripcion}</SelectItem>)}
                            </SelectContent>
                       </Select>
                   </div>
               )}
               {(editData.id_oe_temp) && (
                   <div className="space-y-2">
                       <Label>3. Actividad</Label>
                       <Select value={editData.id_actividad} onValueChange={(val) => setEditData({...editData, id_actividad: val})}>
                            <SelectTrigger className="h-auto min-h-10 whitespace-normal text-left break-words [&>span]:line-clamp-none"><SelectValue placeholder="Actividad..." /></SelectTrigger>
                            <SelectContent className="max-w-[90vw] sm:max-w-[550px] max-h-[300px] overflow-y-auto">
                                {modalActividades.map(a => <SelectItem key={a.id_actividad} value={String(a.id_actividad)} className="whitespace-normal py-2">{a.descripcion}</SelectItem>)}
                            </SelectContent>
                       </Select>
                   </div>
               )}
               <div className="space-y-2"><Label>Nombre</Label><Input value={editData.nombre} onChange={(e) => setEditData({...editData, nombre: e.target.value})} /></div>
               <div className="space-y-2"><Label>Fórmula</Label><textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editData.construccion} onChange={(e) => setEditData({...editData, construccion: e.target.value})} /></div>
               
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <div className="space-y-2">
                       <Label>Tipo de Indicador</Label>
                       <Select value={editData.id_tipo_indicador} onValueChange={(val) => setEditData({...editData, id_tipo_indicador: val})}>
                           <SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger>
                           <SelectContent className="max-h-[300px] overflow-y-auto">
                               {opcionesInd.tipos.map(t => (
                                   <SelectItem key={t.id} value={String(t.id)} title={t.descripcion || t.nombre}>
                                       {t.nombre || t.descripcion || `Opción ${t.id}`}
                                   </SelectItem>
                               ))}
                           </SelectContent>
                       </Select>
                   </div>
                   <div className="space-y-2">
                       <Label>Tipo de Meta</Label>
                       <Select value={editData.tipo_meta} onValueChange={(val) => setEditData({...editData, tipo_meta: val})}>
                           <SelectTrigger><SelectValue/></SelectTrigger>
                           <SelectContent>
                               <SelectItem value="cantidad">Cantidad (#)</SelectItem>
                               <SelectItem value="porcentaje">Porcentaje (%)</SelectItem>
                           </SelectContent>
                       </Select>
                   </div>
                   <div className="space-y-2">
                       <Label>Sistema Origen</Label>
                       <Select value={editData.id_otro_sistema} onValueChange={(val) => setEditData({...editData, id_otro_sistema: val})}>
                           <SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger>
                           <SelectContent className="max-h-[300px] overflow-y-auto">
                               {opcionesSistemas.sistemas.map(s => (
                                   <SelectItem key={s.id} value={String(s.id)}>
                                       {s.descripcion}
                                   </SelectItem>
                               ))}
                           </SelectContent>
                       </Select>
                   </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-2"><Label>Fuente de Datos</Label><Input value={editData.fuente} onChange={(e) => setEditData({...editData, fuente: e.target.value})} placeholder="Ej: Reporte Anual..." /></div>
                   <div className="space-y-2"><Label>Línea de Base</Label><Input value={editData.linea_base} onChange={(e) => setEditData({...editData, linea_base: e.target.value})} placeholder="Ej: 50 en el año 2023..." /></div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2"><Label>Meta 2026</Label><Input type="number" value={editData.meta_anio1} onChange={(e) => setEditData({...editData, meta_anio1: e.target.value})} /></div>
                   <div className="space-y-2"><Label>Meta 2027</Label><Input type="number" value={editData.meta_anio2} onChange={(e) => setEditData({...editData, meta_anio2: e.target.value})} /></div>
               </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleGuardar} className="bg-blue-600 hover:bg-blue-700"><Save className="mr-2 h-4 w-4"/> Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {commentOpen && (
            <ComentariosModal 
                isOpen={commentOpen}
                onClose={() => setCommentOpen(false)}
                entityType="indicador"
                entityId={selectedEntity.id}
                entityTitle={selectedEntity.title}
            />
        )}
      </div>
    </DashboardLayout>
  )
}