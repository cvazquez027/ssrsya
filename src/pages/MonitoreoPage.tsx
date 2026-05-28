import { useState, useEffect, useMemo } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { 
    Save, AlertCircle, CheckCircle2, Circle, Search, Lock, 
    FilterX, ShieldAlert, Link2, Trash2, ExternalLink 
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const API_BASE = "http://localhost/planificacion/api-backend";
const ESTADO_EDICION = 1;
const ESTADO_APROBADO = 3;

export default function MonitoreoPage() {
  const { toast } = useToast()
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  const [monitoreos, setMonitoreos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [userRol, setUserRol] = useState("")
  const [userSigla, setUserSigla] = useState("")
  const [cambios, setCambios] = useState<{[key: number]: any}>({})

  // Estados para Paginación y Guardado en Lote
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [guardandoTodos, setGuardandoTodos] = useState(false);

  const [filtroProyecto, setFiltroProyecto] = useState("todos");
  const [filtroOE, setFiltroOE] = useState("todos");
  const [filtroActividad, setFiltroActividad] = useState("todos");

  // Estado jerárquico del Modal
  const [urlModal, setUrlModal] = useState({ 
      isOpen: false, 
      rowData: null as any, 
      entidad_tipo: 'monitoreo', 
      id_entidad: 0, 
      urls: [] as any[] 
  });
  const [newUrl, setNewUrl] = useState({ etiqueta: '', url: '' });
  const [loadingUrls, setLoadingUrls] = useState(false);

  useEffect(() => { fetchUser() }, [])

  // Resetear paginación al cambiar cualquier filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filtroProyecto, filtroOE, filtroActividad]);

  const fetchUser = async () => {
    try {
        const res = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' })
        const data = await res.json()
        const rolPlanificacion = data.permisos?.['PLANIFICACION'];
        if (!rolPlanificacion) {
            setAccesoDenegado(true);
            setLoading(false);
            return;
        }
        setUserRol(rolPlanificacion)
        setUserSigla(data.sigla || "")
        fetchMonitoreos()
    } catch (e) { console.error(e) }
  }

  const fetchMonitoreos = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/lista_monitoreos.php`, { credentials: 'include' })
      const data = await res.json()
      setMonitoreos(Array.isArray(data) ? data : [])
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los monitoreos", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fetchUrls = async (tipo: string, id: number) => {
      setLoadingUrls(true);
      try {
          const res = await fetch(`${API_BASE}/planificacion_url.php?entidad_tipo=${tipo}&id_entidad=${id}`, { credentials: 'include' });
          const data = await res.json();
          if(data.success) {
              setUrlModal(prev => ({...prev, urls: data.data}));
          }
      } catch(e) { }
      setLoadingUrls(false);
  }

  const openUrlModal = (mon: any) => {
      setUrlModal({ isOpen: true, rowData: mon, entidad_tipo: 'monitoreo', id_entidad: mon.id_monitoreo, urls: [] });
      fetchUrls('monitoreo', mon.id_monitoreo);
  }

  const handleNivelChange = (nuevoTipo: string) => {
      if (!urlModal.rowData) return;
      
      let nuevoId = 0;
      switch(nuevoTipo) {
          case 'proyecto': nuevoId = urlModal.rowData.id_proyecto; break;
          case 'objetivo': nuevoId = urlModal.rowData.id_oe; break;
          case 'actividad': nuevoId = urlModal.rowData.id_actividad; break;
          case 'indicador': nuevoId = urlModal.rowData.id_indicador; break;
          case 'monitoreo': nuevoId = urlModal.rowData.id_monitoreo; break;
      }

      setUrlModal(prev => ({ ...prev, entidad_tipo: nuevoTipo, id_entidad: nuevoId, urls: [] }));
      fetchUrls(nuevoTipo, nuevoId);
  }

  const handleAddUrl = async () => {
    if(!newUrl.url) return;
    try {
        const payload = {
            entidad_tipo: urlModal.entidad_tipo,
            id_entidad: urlModal.id_entidad,
            etiqueta: newUrl.etiqueta || 'Enlace',
            url: newUrl.url
        };
        const res = await fetch(`${API_BASE}/planificacion_url.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
            toast({title: "Enlace guardado"});
            setNewUrl({etiqueta: '', url: ''});
            fetchUrls(urlModal.entidad_tipo, urlModal.id_entidad); 
        }
    } catch(e) { }
  }

  const handleDeleteUrl = async (id_url: number) => {
    if(!confirm("¿Eliminar enlace?")) return;
    try {
        const res = await fetch(`${API_BASE}/planificacion_url.php`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({id_url})
        });
        const data = await res.json();
        if(data.success) {
            fetchUrls(urlModal.entidad_tipo, urlModal.id_entidad);
        }
    } catch(e) { }
  }

  const opcionesProyectos = useMemo(() => Array.from(new Set(monitoreos.map(m => `${m.sigla_dependencia} | ${m.proyecto_nombre}`))), [monitoreos]);
  const opcionesOE = useMemo(() => {
      let m = monitoreos;
      if (filtroProyecto !== "todos") m = m.filter(x => `${x.sigla_dependencia} | ${x.proyecto_nombre}` === filtroProyecto);
      return Array.from(new Set(m.map(x => x.oe_nombre).filter(Boolean)));
  }, [monitoreos, filtroProyecto]);

  const opcionesActividad = useMemo(() => {
      let m = monitoreos;
      if (filtroProyecto !== "todos") m = m.filter(x => `${x.sigla_dependencia} | ${x.proyecto_nombre}` === filtroProyecto);
      if (filtroOE !== "todos") m = m.filter(x => x.oe_nombre === filtroOE);
      return Array.from(new Set(m.map(x => x.actividad_nombre).filter(Boolean)));
  }, [monitoreos, filtroProyecto, filtroOE]);

  const handleCambioProyecto = (val: string) => { setFiltroProyecto(val); setFiltroOE("todos"); setFiltroActividad("todos"); }
  const handleCambioOE = (val: string) => { setFiltroOE(val); setFiltroActividad("todos"); }

  const puedeEditarFila = (mon: any) => {
      const isEdicion = Number(mon.estado_proyecto) === ESTADO_EDICION;
      const isAprobado = Number(mon.estado_proyecto) === ESTADO_APROBADO;
      if (!isEdicion && !isAprobado) return false;
      if (userRol === 'admin' || userRol === 'cargafull') return true;
      if (userRol === 'carga' && userSigla === mon.sigla_dependencia) return true;
      return false;
  }

  const handleInputChange = (id: number, field: string, value: any) => {
    setCambios(prev => ({...prev, [id]: { ...prev[id], [field]: value }}))
  }

  // Función de Guardado en Lote
  const handleGuardarTodos = async () => {
    const idsConCambios = Object.keys(cambios);
    if (idsConCambios.length === 0) return;

    const updates = idsConCambios.map(idStr => {
        const id = Number(idStr);
        const mon = monitoreos.find(m => m.id_monitoreo === id);
        const c = cambios[id];
        return {
            id_monitoreo: id,
            meta_propuesta: c.meta_propuesta !== undefined ? c.meta_propuesta : mon?.meta_propuesta,
            meta_alcanzada: c.meta_alcanzada !== undefined ? c.meta_alcanzada : mon?.meta_alcanzada,
            observaciones: c.observaciones !== undefined ? c.observaciones : mon?.observaciones,
            no_aplica: c.no_aplica !== undefined ? (c.no_aplica ? 1 : 0) : Number(mon?.no_aplica || 0)
        };
    });

    setGuardandoTodos(true);
    try {
        const res = await fetch(`${API_BASE}/actualizar_monitoreo.php`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            credentials: 'include', body: JSON.stringify({ updates })
        });
        const data = await res.json();
        if (res.ok) {
            toast({ title: "Guardado", description: "Todas las modificaciones fueron guardadas.", className: "bg-green-100 border-green-500" });
            fetchMonitoreos(); 
            setCambios({});
        } else throw new Error(data.error || "Error al guardar");
    } catch (e: any) { 
        toast({ title: "Error", description: e.message, variant: "destructive" }); 
    } finally {
        setGuardandoTodos(false);
    }
  }

  const getSemaforo = (propuesta: any, alcanzada: any, noAplica: boolean) => {
      if (noAplica) return <Circle className="h-5 w-5 text-gray-200" />;
      if (alcanzada === null || alcanzada === "" || alcanzada === undefined) return <Circle className="h-5 w-5 text-gray-300" />;
      const p = parseFloat(propuesta); const a = parseFloat(alcanzada);
      if (isNaN(p) || isNaN(a)) return <Circle className="h-5 w-5 text-gray-300" />;
      if (a >= p) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      return <AlertCircle className="h-5 w-5 text-red-500" />;
  }

  const filtered = monitoreos.filter(m => {
      const searchMatch = (m.indicador_nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) || (m.proyecto_nombre || "").toLowerCase().includes(searchTerm.toLowerCase());
      const proyMatch = filtroProyecto === "todos" || `${m.sigla_dependencia} | ${m.proyecto_nombre}` === filtroProyecto;
      const oeMatch = filtroOE === "todos" || m.oe_nombre === filtroOE;
      const actMatch = filtroActividad === "todos" || m.actividad_nombre === filtroActividad;
      return searchMatch && proyMatch && oeMatch && actMatch;
  });

  // Cálculos de Paginación
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) return <DashboardLayout currentSection="Métricas"><div className="p-8 text-center">Cargando tablero...</div></DashboardLayout>
  if (accesoDenegado) return (<DashboardLayout currentSection="Métricas"><div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4"><ShieldAlert className="h-16 w-16 text-red-500 mb-2" /><h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2></div></DashboardLayout>);

  return (
    <DashboardLayout currentSection="Métricas">
      <div className="space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
            <div><h2 className="text-2xl font-bold tracking-tight">Tablero de Monitoreo</h2><p className="text-sm text-muted-foreground">Vista global de metas y avances.</p></div>
            <div className="relative w-full md:w-80"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar texto libre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        </div>

        <Card className="bg-slate-50/50 shadow-sm border-slate-200">
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                {/* CIRUGÍA: className="max-h-[300px]" agregado a SelectContent de los 3 filtros */}
                <div className="space-y-1 min-w-0"><label className="text-xs font-semibold text-slate-600">Dependencia y Proyecto</label><Select value={filtroProyecto} onValueChange={handleCambioProyecto}><SelectTrigger className="h-9 text-sm w-full [&>span]:truncate bg-white"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent className="max-h-[300px]"><SelectItem value="todos">-- Todos --</SelectItem>{opcionesProyectos.map(op => <SelectItem key={op} value={op} className="truncate">{op}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1 min-w-0"><label className="text-xs font-semibold text-slate-600">Objetivo Específico</label><Select value={filtroOE} onValueChange={handleCambioOE} disabled={filtroProyecto === "todos"}><SelectTrigger className="h-9 text-sm w-full [&>span]:truncate bg-white"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent className="max-h-[300px]"><SelectItem value="todos">-- Todos --</SelectItem>{opcionesOE.map(op => <SelectItem key={op} value={op as string} className="truncate">{op as string}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1 min-w-0"><label className="text-xs font-semibold text-slate-600">Actividad Prioritaria</label><Select value={filtroActividad} onValueChange={setFiltroActividad} disabled={filtroOE === "todos"}><SelectTrigger className="h-9 text-sm w-full [&>span]:truncate bg-white"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent className="max-h-[300px]"><SelectItem value="todos">-- Todas --</SelectItem>{opcionesActividad.map(op => <SelectItem key={op} value={op as string} className="truncate">{op as string}</SelectItem>)}</SelectContent></Select></div>
                <div className="min-w-0 flex"><Button variant="outline" className="w-full h-9 text-slate-500" onClick={() => { setFiltroProyecto("todos"); setFiltroOE("todos"); setFiltroActividad("todos"); setSearchTerm(""); }}><FilterX className="h-4 w-4 mr-2" /> Limpiar</Button></div>
            </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle>Indicadores ({filtered.length})</CardTitle>
              {Object.keys(cambios).length > 0 && (
                  <Button onClick={handleGuardarTodos} disabled={guardandoTodos} className="bg-blue-600 hover:bg-blue-700 h-8 shadow-md transition-all">
                      <Save className="mr-2 h-4 w-4" /> 
                      {guardandoTodos ? "Guardando..." : `Guardar Cambios (${Object.keys(cambios).length})`}
                  </Button>
              )}
          </CardHeader>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 w-[5%] text-center">KPI</th>
                    <th className="px-4 py-3 w-[25%]">Indicador / Proyecto</th>
                    <th className="px-4 py-3 w-[15%]">Periodo</th>
                    <th className="px-4 py-3 w-[5%] text-center">Aplica</th>
                    <th className="px-4 py-3 w-[12%] text-center">Meta Prop.</th>
                    <th className="px-4 py-3 w-[12%] text-center">Ejecutado</th>
                    <th className="px-4 py-3 w-[20%]">Observaciones</th>
                    <th className="px-4 py-3 w-[6%] text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No hay datos disponibles.</td></tr>
                  ) : (
                    paginatedData.map((mon) => {
                      const valPropuesta = cambios[mon.id_monitoreo]?.meta_propuesta !== undefined ? cambios[mon.id_monitoreo].meta_propuesta : (mon.meta_propuesta || "");
                      const valEjecutado = cambios[mon.id_monitoreo]?.meta_alcanzada !== undefined ? cambios[mon.id_monitoreo].meta_alcanzada : (mon.meta_alcanzada || "");
                      const valObs = cambios[mon.id_monitoreo]?.observaciones !== undefined ? cambios[mon.id_monitoreo].observaciones : (mon.observaciones || "");
                      const valNoAplica = cambios[mon.id_monitoreo]?.no_aplica !== undefined ? cambios[mon.id_monitoreo].no_aplica : (Number(mon.no_aplica) === 1);
                      const hayCambios = cambios[mon.id_monitoreo] !== undefined;
                      const habilitadoParaEditar = puedeEditarFila(mon);
                      const isEdicion = Number(mon.estado_proyecto) === ESTADO_EDICION;
                      const isAprobado = Number(mon.estado_proyecto) === ESTADO_APROBADO;
                      const sufijo = mon.tipo_meta === 'porcentaje' ? '%' : '';

                      return (
                        <tr key={mon.id_monitoreo} className={`border-b ${hayCambios ? 'bg-blue-50/30' : habilitadoParaEditar ? 'hover:bg-slate-50 bg-white' : 'bg-gray-50/50'} ${valNoAplica ? 'opacity-60' : ''}`}>
                            <td className="px-4 py-3 text-center align-middle relative">
                                {hayCambios && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" title="Cambios sin guardar"></div>}
                                {getSemaforo(mon.meta_propuesta, valEjecutado, valNoAplica)}
                            </td>
                            <td className="px-4 py-3 align-top">
                                <div className={`font-medium ${habilitadoParaEditar ? 'text-gray-900' : 'text-gray-500'}`}>{mon.indicador_nombre}</div>
                                <div className="text-xs text-blue-600 mt-1 font-bold">{mon.sigla_dependencia} <span className="font-normal text-gray-500">- {mon.proyecto_nombre}</span></div>
                            </td>
                            <td className="px-4 py-3 align-middle text-sm text-gray-600">{mon.periodo_descripcion}</td>
                            <td className="px-4 py-3 text-center align-middle">
                                <input type="checkbox" className="h-4 w-4 cursor-pointer accent-blue-600" checked={!valNoAplica} disabled={!habilitadoParaEditar} onChange={(e) => handleInputChange(mon.id_monitoreo, 'no_aplica', !e.target.checked)} />
                            </td>
                            <td className="px-4 py-3 align-middle">
                                <div className="relative">
                                    <Input type="number" className={`h-8 w-full text-right ${sufijo ? 'pr-6' : ''} ${isEdicion && habilitadoParaEditar && !valNoAplica ? 'bg-white border-blue-400 font-bold text-blue-800' : 'bg-transparent border-transparent shadow-none'}`} value={valNoAplica ? "" : valPropuesta} disabled={!isEdicion || !habilitadoParaEditar || valNoAplica} onChange={(e) => handleInputChange(mon.id_monitoreo, 'meta_propuesta', e.target.value)} />
                                    {sufijo && !valNoAplica && <span className="absolute right-2 top-2 text-xs text-slate-400 font-bold">%</span>}
                                </div>
                            </td>
                            <td className="px-4 py-3 align-middle">
                                <div className="relative">
                                    <Input type="number" className={`h-8 w-full text-right ${sufijo ? 'pr-6' : ''} ${isAprobado && habilitadoParaEditar && !valNoAplica ? 'bg-white border-blue-400 font-bold text-blue-800' : 'bg-transparent border-transparent shadow-none placeholder:text-gray-300'}`} placeholder={valNoAplica ? "N/A" : (isAprobado && habilitadoParaEditar ? "0" : "-")} value={valNoAplica ? "" : valEjecutado} disabled={!isAprobado || !habilitadoParaEditar || valNoAplica} onChange={(e) => handleInputChange(mon.id_monitoreo, 'meta_alcanzada', e.target.value)} />
                                    {sufijo && !valNoAplica && <span className="absolute right-2 top-2 text-xs text-slate-400 font-bold">%</span>}
                                </div>
                            </td>
                            <td className="px-4 py-3 align-middle">
                                <Input className={`h-8 w-full text-xs ${habilitadoParaEditar ? 'bg-white' : 'bg-transparent border-transparent shadow-none'}`} placeholder={valNoAplica ? "Excluido..." : "Comentarios..."} value={valObs} disabled={!habilitadoParaEditar} onChange={(e) => handleInputChange(mon.id_monitoreo, 'observaciones', e.target.value)} />
                            </td>
                            
                            <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                                {habilitadoParaEditar ? (
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-100 mx-auto" onClick={() => openUrlModal(mon)} title="Gestionar Enlaces / Archivos"><Link2 className="h-4 w-4" /></Button>
                                ) : (
                                    <Lock className="h-4 w-4 text-gray-300 mx-auto" />
                                )}
                            </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
             </div>
             
             <div className="p-4 flex flex-col sm:flex-row items-center justify-between border-t bg-slate-50 gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 font-medium">Mostrar</span>
                    <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[70px] h-8 bg-white text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="30">30</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                    <span className="text-sm text-slate-500 font-medium">registros</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500 font-medium hidden sm:block">
                        Página {currentPage} de {totalPages === 0 ? 1 : totalPages} ({filtered.length} en total)
                    </span>
                    <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || totalPages === 0}>Siguiente</Button>
                    </div>
                </div>
             </div>
          </CardContent>
        </Card>

        <Dialog open={urlModal.isOpen} onOpenChange={(v) => setUrlModal(prev => ({...prev, isOpen: v}))}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg"><Link2 className="h-5 w-5 text-blue-600" /> Archivos y Enlaces Adjuntos</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    
                    <div className="bg-blue-50/50 p-3 rounded-md border border-blue-100 space-y-2">
                        <Label className="text-xs text-blue-800 font-bold uppercase tracking-wider">¿A qué nivel querés asociar el enlace?</Label>
                        <Select value={urlModal.entidad_tipo} onValueChange={handleNivelChange}>
                            <SelectTrigger className="bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="proyecto">🏢 Proyecto: <span className="font-semibold">{urlModal.rowData?.proyecto_nombre}</span></SelectItem>
                                <SelectItem value="objetivo">🎯 Obj. Específico: <span className="font-semibold">{urlModal.rowData?.oe_nombre}</span></SelectItem>
                                <SelectItem value="actividad">📋 Actividad: <span className="font-semibold">{urlModal.rowData?.actividad_nombre}</span></SelectItem>
                                <SelectItem value="indicador">📊 Indicador: <span className="font-semibold">{urlModal.rowData?.indicador_nombre}</span></SelectItem>
                                <SelectItem value="monitoreo">📅 Este Periodo: <span className="font-semibold">{urlModal.rowData?.periodo_descripcion}</span></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="bg-slate-50 border rounded-md p-3 min-h-[100px] max-h-[250px] overflow-y-auto">
                        {loadingUrls ? (
                            <div className="text-center text-sm text-slate-500 italic py-4">Cargando enlaces...</div>
                        ) : urlModal.urls.length === 0 ? (
                            <div className="text-center text-sm text-slate-500 italic py-4">No hay enlaces adjuntos en este nivel.</div>
                        ) : (
                            <ul className="space-y-2">
                                {urlModal.urls.map((u, i) => (
                                    <li key={i} className="flex items-center justify-between bg-white p-2 rounded border shadow-sm text-sm">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <ExternalLink className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                            <div className="truncate">
                                                <span className="font-bold text-slate-700 block text-xs">{u.etiqueta}</span>
                                                <a href={u.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs truncate block" title={u.url}>{u.url}</a>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-7 w-7 p-0 flex-shrink-0" onClick={() => handleDeleteUrl(u.id_url)}><Trash2 className="h-4 w-4" /></Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1"><Label className="text-xs">Etiqueta</Label><Input placeholder="Ej. Documento Respaldo" value={newUrl.etiqueta} onChange={e => setNewUrl({...newUrl, etiqueta: e.target.value})} className="h-8 text-xs" /></div>
                        <div className="col-span-2"><Label className="text-xs">URL (Link)</Label><Input placeholder="https://..." value={newUrl.url} onChange={e => setNewUrl({...newUrl, url: e.target.value})} className="h-8 text-xs" /></div>
                    </div>
                    <Button onClick={handleAddUrl} disabled={!newUrl.url} className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700">Agregar Enlace</Button>
                </div>
            </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  )
}