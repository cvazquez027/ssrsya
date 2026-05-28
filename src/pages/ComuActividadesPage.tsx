import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Link as LinkIcon, Trash2, Save, Loader2, X, Eye, ExternalLink, Users, Calendar, Activity, Building2, Edit, CheckCircle, Globe, Download, ShieldAlert, ArrowLeft, Check, AlertCircle, History, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

const API_BASE = "http://localhost/planificacion/api-backend";

export default function ComuActividadesPage() {
  const { toast } = useToast();
  
  // --- CIRUGÍA DE SEGURIDAD: Estados del Usuario ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  const [actividades, setActividades] = useState<any[]>([]);
  const [maestras, setMaestras] = useState<any>({ tipos_actividad: [], flujo_estados: {}, referentes: [], dependencias: [], actividades_planificacion: [] });
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [detalleCargando, setDetalleCargando] = useState(false);
  const [actividadDetalle, setActividadDetalle] = useState<any>(null);

  // --- CIRUGÍA: Estados para el cambio de flujo con observación e historial ---
  const [modalAccion, setModalAccion] = useState<{open: boolean, tipo: 'avanzar'|'retroceder'|null}>({open: false, tipo: null});
  const [observacionAccion, setObservacionAccion] = useState("");
  const [historialAbierto, setHistorialAbierto] = useState(false);

  const estadoInicial = {
    id_comu_actividad: "", sigla: "", id_comu_tipo_actividad: "", id_comu_estado: "", 
    id_actividad_prioritaria: "0", descripcion: "", fecha_inicio: "", fecha_est_fin: "", publicado: false,
    check_comunicacion: 0, check_planificacion: 0, estado_actual: "",
    referentes: [] as string[], urls: [{ etiqueta: "Carpeta Drive", url: "" }]
  };
  const [formData, setFormData] = useState(estadoInicial);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [resUser, resMaestras, resActividades] = await Promise.all([
        fetch(`${API_BASE}/usuario.php`, { credentials: 'include' }),
        fetch(`${API_BASE}/lista_maestras_comu.php`, { credentials: 'include' }),
        fetch(`${API_BASE}/abm_comu_actividades.php`, { credentials: 'include' })
      ]);
      
      const userData = await resUser.json();
      setCurrentUser(userData);

      const rolComu = userData.permisos?.['COMUNICACION'];
      if (!rolComu) {
          setAccesoDenegado(true);
          setLoading(false);
          return;
      }

      const dataMaestras = await resMaestras.json();
      const dataActividades = await resActividades.json();
      
      if (dataMaestras.success) setMaestras(dataMaestras.data);
      if (dataActividades.success) setActividades(dataActividades.data);
    } catch (e) {
      toast({ title: "Error", description: "Falla de conexión", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const rolModulo = currentUser?.permisos?.['COMUNICACION'] || 'consulta';
  const puedeCrear = rolModulo === 'admin' || rolModulo === 'cargafull' || rolModulo === 'carga';
  
  const puedeEditarActividad = (actSigla: string) => {
      if (rolModulo === 'admin' || rolModulo === 'cargafull') return true;
      if (rolModulo === 'carga' && actSigla === currentUser?.sigla) return true;
      return false;
  };

  const handleAddUrl = () => setFormData(prev => ({ ...prev, urls: [...prev.urls, { etiqueta: "Enlace", url: "" }] }));
  const handleUrlChange = (index: number, field: 'etiqueta'|'url', value: string) => {
    const nuevasUrls = [...formData.urls];
    nuevasUrls[index][field] = value;
    setFormData({ ...formData, urls: nuevasUrls });
  };
  const handleRemoveUrl = (index: number) => setFormData({ ...formData, urls: formData.urls.filter((_, i) => i !== index) });
  const handleAddReferente = (idRef: string) => {
    if (!formData.referentes.includes(idRef)) setFormData(prev => ({ ...prev, referentes: [...prev.referentes, idRef] }));
  };
  const handleRemoveReferente = (idRef: string) => setFormData(prev => ({ ...prev, referentes: prev.referentes.filter(id => id !== idRef) }));

  const abrirAlta = () => {
      setModoEdicion(false);
      const siglaInicial = rolModulo === 'carga' ? currentUser.sigla : "";
      setFormData({ ...estadoInicial, sigla: siglaInicial });
      setModalOpen(true);
  };

  const abrirEdicion = () => {
      if (!actividadDetalle) return;
      setFormData({
          id_comu_actividad: actividadDetalle.id_comu_actividad,
          sigla: actividadDetalle.sigla,
          id_comu_tipo_actividad: String(actividadDetalle.id_comu_tipo_actividad),
          id_comu_estado: String(actividadDetalle.id_comu_estado),
          id_actividad_prioritaria: actividadDetalle.id_actividad_prioritaria ? String(actividadDetalle.id_actividad_prioritaria) : "0",
          descripcion: actividadDetalle.descripcion,
          fecha_inicio: actividadDetalle.fecha_inicio || "",
          fecha_est_fin: actividadDetalle.fecha_est_fin || "",
          publicado: Number(actividadDetalle.publicado) === 1,
          check_comunicacion: actividadDetalle.check_comunicacion || 0,
          check_planificacion: actividadDetalle.check_planificacion || 0,
          estado_actual: actividadDetalle.estado_actual || "",
          referentes: actividadDetalle.referentes_detalle?.map((r:any) => String(r.id_referente)) || [],
          urls: actividadDetalle.urls?.length ? actividadDetalle.urls : [{ etiqueta: "Carpeta Drive", url: "" }]
      });
      setModoEdicion(true);
      setModalDetalleOpen(false);
      setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    
    const payload = {
        ...formData,
        id_actividad_prioritaria: formData.id_actividad_prioritaria === "0" ? null : formData.id_actividad_prioritaria,
        modo: modoEdicion ? 'completo' : undefined
    };

    try {
      const res = await fetch(`${API_BASE}/abm_comu_actividades.php`, {
        method: modoEdicion ? "PUT" : "POST", 
        headers: { "Content-Type": "application/json" }, 
        credentials: 'include', 
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Éxito", description: modoEdicion ? "Actividad actualizada." : "Actividad registrada." });
        setModalOpen(false); 
        cargarDatos();
      } else throw new Error(data.error);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } 
    finally { setGuardando(false); }
  };

  const abrirDetalle = async (id: number) => {
    setModalDetalleOpen(true);
    setDetalleCargando(true);
    setHistorialAbierto(false); // Resetear historial al abrir
    try {
        const res = await fetch(`${API_BASE}/abm_comu_actividades.php?id=${id}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) setActividadDetalle(data.data);
    } catch (e) {
        toast({ title: "Error", description: "No se pudo cargar el detalle", variant: "destructive" });
        setModalDetalleOpen(false);
    } finally { setDetalleCargando(false); }
  };

  // --- CIRUGÍA: NUEVAS ACCIONES DE LA MÁQUINA DE ESTADOS PARA EL DETALLE ---
  const toggleCheckDetalle = async (tipo: 'comunicacion' | 'planificacion') => {
      if (!actividadDetalle) return;
      const nuevoComu = tipo === 'comunicacion' ? (actividadDetalle.check_comunicacion === 1 ? 0 : 1) : (actividadDetalle.check_comunicacion || 0);
      const nuevoPlan = tipo === 'planificacion' ? (actividadDetalle.check_planificacion === 1 ? 0 : 1) : (actividadDetalle.check_planificacion || 0);

      setActividadDetalle((prev: any) => ({ ...prev, check_comunicacion: nuevoComu, check_planificacion: nuevoPlan }));

      try {
          const res = await fetch(`${API_BASE}/abm_comu_actividades.php`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
              body: JSON.stringify({
                  id_comu_actividad: actividadDetalle.id_comu_actividad, modo: 'guardar_checks',
                  check_comunicacion: nuevoComu, check_planificacion: nuevoPlan
              })
          });
          const result = await res.json();
          if (!result.success) {
              toast({ title: "Error", description: result.error, variant: "destructive" });
              abrirDetalle(actividadDetalle.id_comu_actividad); // Recargar
          }
      } catch (error) {
          toast({ title: "Error", description: "Error al guardar la validación", variant: "destructive" });
      }
  };

  const ejecutarMovimiento = async () => {
      if (!observacionAccion.trim()) {
          toast({ title: "Atención", description: "Debes ingresar una observación para el cambio.", variant: "destructive" });
          return;
      }
      try {
          const res = await fetch(`${API_BASE}/abm_comu_actividades.php`, {
              method: "PUT", headers: { "Content-Type": "application/json" }, credentials: 'include',
              body: JSON.stringify({ id_comu_actividad: actividadDetalle.id_comu_actividad, modo: modalAccion.tipo, observacion: observacionAccion })
          });
          const data = await res.json();
          if (data.success) {
              toast({ title: "Estado Actualizado", description: data.mensaje });
              setModalAccion({open: false, tipo: null});
              setObservacionAccion("");
              abrirDetalle(actividadDetalle.id_comu_actividad);
              cargarDatos();
          } else throw new Error(data.error);
      } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  // ---------------------------------------------------------

  const togglePublicado = async () => {
      if (!actividadDetalle) return;
      const nuevoPublicado = Number(actividadDetalle.publicado) === 1 ? 0 : 1;
      try {
        const res = await fetch(`${API_BASE}/abm_comu_actividades.php`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, credentials: 'include',
            body: JSON.stringify({ id_comu_actividad: actividadDetalle.id_comu_actividad, publicado: nuevoPublicado, modo: 'publicado' })
        });
        const data = await res.json();
        if (data.success) {
            toast({ title: nuevoPublicado ? "Publicado" : "Oculto", description: "El estado de publicación ha sido actualizado." });
            setActividadDetalle({ ...actividadDetalle, publicado: nuevoPublicado });
            cargarDatos();
        } else throw new Error(data.error);
      } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const exportarExcel = () => {
      if (actividades.length === 0) {
          toast({ title: "Aviso", description: "No hay datos para exportar." });
          return;
      }
      const datosExcel = actividades.map(act => ({
          "ID": act.id_comu_actividad,
          "Dependencia": act.sigla,
          "Tipo de Actividad": act.tipo_actividad,
          "Descripción": act.descripcion,
          "Estado Actual": act.estado_actual,
          "Fecha Inicio": act.fecha_inicio || "S/D",
          "Fecha Estimada Fin": act.fecha_est_fin || "S/D",
          "Fecha Real Fin": act.fecha_real_fin || "En Curso",
          "¿Publicado?": Number(act.publicado) === 1 ? "Sí" : "No"
      }));

      const worksheet = XLSX.utils.json_to_sheet(datosExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Actividades_Comu");
      const columnWidths = [{ wch: 8 }, { wch: 15 }, { wch: 35 }, { wch: 50 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
      worksheet['!cols'] = columnWidths;
      XLSX.writeFile(workbook, `Reporte_Actividades_Comu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <DashboardLayout currentSection="Comunicación"><div className="p-8 text-center animate-pulse">Cargando módulo...</div></DashboardLayout>;

  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Comunicación">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>No tenés permisos asignados para visualizar el módulo de Comunicación.</p>
                  <p className="text-sm">Si creés que esto es un error, contactá a un Administrador.</p>
              </div>
          </DashboardLayout>
      );
  }

  // Verificaciones de estado para la UI (Máquina de Estados en Detalle)
  const isValidaSSRSyADetalle = actividadDetalle?.estado_actual?.trim().toLowerCase() === 'valida ssrsya';
  const isAvanzarDisabledDetalle = isValidaSSRSyADetalle && (actividadDetalle?.check_comunicacion !== 1 || actividadDetalle?.check_planificacion !== 1);

  return (
    <DashboardLayout currentSection="Comunicación">
      <div className="space-y-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Gestión de Actividades</h2>
            <p className="text-sm text-slate-500">Módulo de seguimiento y flujo de trabajo de comunicación.</p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={exportarExcel}>
                <Download className="mr-2 h-4 w-4" /> Exportar Excel
              </Button>
              {puedeCrear && (
                  <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700" onClick={abrirAlta}>
                    <Plus className="mr-2 h-4 w-4" /> Nueva Actividad
                  </Button>
              )}
          </div>

          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="!max-w-5xl !w-[95vw] max-h-[90vh] overflow-y-auto custom-scrollbar">
              <DialogHeader><DialogTitle>{modoEdicion ? "Editar Actividad" : "Registrar Nueva Actividad"}</DialogTitle></DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50 p-5 rounded-lg border">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Building2 className="h-3 w-3"/> Dependencia *</label>
                    <Select required value={formData.sigla} disabled={rolModulo === 'carga'} onValueChange={(val) => setFormData({...formData, sigla: val})}>
                      <SelectTrigger className="bg-white h-auto min-h-[2.5rem] whitespace-normal text-left [&>span]:line-clamp-2">
                        <SelectValue placeholder="Seleccione área..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[50vh]">
                        {maestras.dependencias.map((d: any) => (
                            <SelectItem key={d.sigla} value={d.sigla} className="whitespace-normal break-words py-2">{d.sigla} - {d.descripcion}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Activity className="h-3 w-3"/> Tipo de Actividad *</label>
                    <Select required disabled={modoEdicion} value={formData.id_comu_tipo_actividad} onValueChange={(val) => setFormData({...formData, id_comu_tipo_actividad: val})}>
                      <SelectTrigger className="bg-white h-auto min-h-[2.5rem] whitespace-normal text-left [&>span]:line-clamp-2">
                        <SelectValue placeholder="Clasificación..." />
                      </SelectTrigger>
                      <SelectContent>
                        {maestras.tipos_actividad.map((t: any) => (
                            <SelectItem key={t.id_comu_tipo_actividad} value={String(t.id_comu_tipo_actividad)} className="whitespace-normal break-words py-2">{t.descripcion}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Vincular a Actividad de Planificación (Opcional)</label>
                    <Select value={formData.id_actividad_prioritaria} onValueChange={(val) => setFormData({...formData, id_actividad_prioritaria: val})}>
                      <SelectTrigger className="bg-white border-slate-200 text-sm h-auto min-h-[2.5rem] whitespace-normal text-left [&>span]:line-clamp-2">
                          <SelectValue placeholder="Asociar a un proyecto aprobado..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[50vh]">
                        <SelectItem value="0" className="text-slate-500 italic py-2">-- Ninguna / Actividad Independiente --</SelectItem>
                        {maestras.actividades_planificacion.map((ap: any) => (
                            <SelectItem key={ap.id_actividad} value={String(ap.id_actividad)} className="whitespace-normal break-words py-2">{ap.descripcion_completa}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-xs font-semibold text-slate-600">Fecha de Inicio</label><Input type="date" value={formData.fecha_inicio} onChange={(e) => setFormData({...formData, fecha_inicio: e.target.value})} /></div>
                    <div className="space-y-2"><label className="text-xs font-semibold text-slate-600">Fecha Estimada Fin</label><Input type="date" value={formData.fecha_est_fin} onChange={(e) => setFormData({...formData, fecha_est_fin: e.target.value})} /></div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600">Descripción / Detalles *</label>
                  <Textarea required placeholder="Describa la actividad a realizar..." value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} className="min-h-[100px]" />
                </div>

                <div className="space-y-2 border-t pt-5">
                  <label className="text-xs font-semibold text-slate-600">Asignar Responsables</label>
                  <Select onValueChange={handleAddReferente} value="">
                    <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Busque y seleccione un responsable..." /></SelectTrigger>
                    <SelectContent className="max-h-[50vh]">
                      {maestras.referentes.filter((r: any) => !formData.referentes.includes(String(r.id_referente))).map((r: any) => (
                          <SelectItem key={r.id_referente} value={String(r.id_referente)}>{r.apellido}, {r.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.referentes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.referentes.map(idRef => {
                        const refData = maestras.referentes.find((r: any) => String(r.id_referente) === idRef);
                        if (!refData) return null;
                        return (
                          <span key={idRef} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md text-xs font-medium border border-indigo-200 shadow-sm">
                            {refData.apellido}, {refData.nombre}
                            <button type="button" onClick={() => handleRemoveReferente(idRef)} className="ml-1 text-indigo-400 hover:text-indigo-900 rounded-full p-0.5 hover:bg-indigo-200 transition-colors"><X className="h-3 w-3" /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-5 bg-slate-50 border rounded-md space-y-4 mt-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><LinkIcon className="h-3 w-3"/> Enlaces Relacionados</label>
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs bg-white w-full sm:w-auto" onClick={handleAddUrl}><Plus className="h-3 w-3 mr-1" /> Agregar link</Button>
                    </div>
                    {formData.urls.map((item, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-3 items-center">
                            <Input placeholder="Etiqueta" className="w-full sm:w-1/3 h-10 text-sm bg-white" value={item.etiqueta} onChange={(e) => handleUrlChange(idx, 'etiqueta', e.target.value)} />
                            <div className="flex gap-2 w-full sm:w-2/3">
                                <Input placeholder="https://..." type="url" className="flex-1 h-10 text-sm bg-white" value={item.url} onChange={(e) => handleUrlChange(idx, 'url', e.target.value)} />
                                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-red-500 hover:bg-red-100 rounded-full border border-transparent" onClick={() => handleRemoveUrl(idx)}><Trash2 className="h-5 w-5" /></Button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end pt-5 border-t mt-6 gap-3">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-blue-600 shadow-sm" disabled={guardando}>
                    {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                    {modoEdicion ? "Guardar Datos" : "Registrar Actividad"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="text-lg font-semibold text-slate-700">Listado de Actividades</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-600 uppercase bg-slate-100 border-b">
                  <tr>
                    <th className="px-4 py-3 w-[15%] min-w-[100px]">Dependencia</th>
                    <th className="px-4 py-3 w-[20%] min-w-[150px]">Tipo</th>
                    <th className="px-4 py-3 w-[35%] min-w-[200px]">Descripción</th>
                    <th className="px-4 py-3 text-center w-[10%] min-w-[100px]">Fechas</th>
                    <th className="px-4 py-3 text-center w-[15%] min-w-[120px]">Estado</th>
                    <th className="px-4 py-3 text-center w-[5%]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {actividades.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aún no hay actividades registradas.</td></tr>
                  ) : (
                    actividades.map((act) => (
                      <tr key={act.id_comu_actividad} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 align-top"><span className="inline-flex font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{act.sigla}</span></td>
                        <td className="px-4 py-3 font-semibold text-slate-800 align-top">{act.tipo_actividad}</td>
                        <td className="px-4 py-3 text-slate-600 align-top line-clamp-2" title={act.descripcion}>{act.descripcion}</td>
                        <td className="px-4 py-3 text-center align-top text-xs text-slate-500">
                            <div className="mb-1"><span className="font-semibold text-slate-700">I:</span> {act.fecha_inicio || '-'}</div>
                            <div><span className="font-semibold text-slate-700">F:</span> {act.fecha_est_fin || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-center border ${Number(act.id_comu_estado) === 99 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                                {act.estado_actual}
                            </span>
                            {Number(act.publicado) === 1 && <span title="Publicado" className="block mt-1 mx-auto w-fit"><Globe className="h-3 w-3 text-blue-600" /></span>}
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-100 hover:text-blue-800 rounded-full" onClick={() => abrirDetalle(act.id_comu_actividad)} title="Ver y Gestionar">
                                <Eye className="h-4 w-4" />
                            </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
             </div>
          </CardContent>
        </Card>

        {/* Modal de Detalle */}
        <Dialog open={modalDetalleOpen} onOpenChange={setModalDetalleOpen}>
          <DialogContent className="!max-w-5xl !w-[95vw] max-h-[90vh] overflow-y-auto custom-scrollbar">
            {detalleCargando || !actividadDetalle ? (
                <div className="p-12 text-center text-slate-500"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" /> Cargando detalle...</div>
            ) : (
                <>
                    <DialogHeader className="border-b pb-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div>
                                <DialogTitle className="text-xl font-bold text-slate-800">{actividadDetalle.tipo_actividad}</DialogTitle>
                                <p className="text-sm text-slate-500 mt-1">ID: #{actividadDetalle.id_comu_actividad} | Área: <span className="font-bold text-slate-700">{actividadDetalle.sigla}</span></p>
                            </div>
                            
                            {puedeEditarActividad(actividadDetalle.sigla) && (
                                <Button variant="outline" size="sm" onClick={abrirEdicion} className="text-blue-600 border-blue-200 hover:bg-blue-50 w-full sm:w-auto mt-2 sm:mt-0 shadow-sm">
                                    <Edit className="h-4 w-4 mr-2" /> Editar Datos
                                </Button>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="py-4 space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* Panel de Estado y Validación (Actualizado a la Máquina de Estados) */}
                            <div className="lg:col-span-2 bg-blue-50/50 border border-blue-100 p-5 rounded-lg flex flex-col items-start justify-between gap-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center w-full justify-between gap-4">
                                    <div className="flex items-center gap-3 text-blue-800 shrink-0">
                                        <Activity className="h-6 w-6" />
                                        <div><p className="text-xs font-bold uppercase tracking-wider">Flujo de Trabajo</p><p className="text-lg font-extrabold">{actividadDetalle.estado_actual}</p></div>
                                    </div>
                                    {puedeEditarActividad(actividadDetalle.sigla) && (
                                        <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                                            <Button type="button" size="sm" variant="outline" onClick={() => setModalAccion({open: true, tipo: 'retroceder'})} className="bg-white border-blue-200 text-blue-700 hover:bg-blue-100 w-full">
                                                <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Volver a etapa anterior
                                            </Button>
                                            <Button type="button" size="sm"
                                                onClick={() => setModalAccion({open: true, tipo: 'avanzar'})} 
                                                disabled={isAvanzarDisabledDetalle}
                                                className={`text-white transition w-full ${isAvanzarDisabledDetalle ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                                <Check className="w-3.5 h-3.5 mr-2" /> Marcar etapa cumplida
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Validaciones SSRSyA en el Detalle */}
                                {isValidaSSRSyADetalle && (
                                    <div className="w-full mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <h5 className="text-sm font-bold text-amber-800 mb-1 flex items-center">
                                            <AlertCircle className="w-4 h-4 mr-1" /> Validación Requerida (SSRSyA)
                                        </h5>
                                        {puedeEditarActividad(actividadDetalle.sigla) ? (
                                            <>
                                                <p className="text-xs text-amber-700 mb-3">Para avanzar a la siguiente etapa, se requieren las siguientes conformidades. Se guardan automáticamente al tildar.</p>
                                                <div className="flex flex-col sm:flex-row gap-4">
                                                    <label className="flex items-center space-x-3 cursor-pointer bg-white p-3 rounded-md border border-amber-100 hover:border-amber-300 transition w-full">
                                                        <input type="checkbox" checked={actividadDetalle.check_planificacion === 1} onChange={() => toggleCheckDetalle('planificacion')} className="rounded text-blue-600 focus:ring-blue-500 w-5 h-5" />
                                                        <span className="text-sm text-slate-800 font-medium">Conformidad de Planificación</span>
                                                    </label>
                                                    <label className="flex items-center space-x-3 cursor-pointer bg-white p-3 rounded-md border border-amber-100 hover:border-amber-300 transition w-full">
                                                        <input type="checkbox" checked={actividadDetalle.check_comunicacion === 1} onChange={() => toggleCheckDetalle('comunicacion')} className="rounded text-blue-600 focus:ring-blue-500 w-5 h-5" />
                                                        <span className="text-sm text-slate-800 font-medium">Conformidad de Comunicación</span>
                                                    </label>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <span className={`text-sm flex items-center font-semibold ${actividadDetalle.check_planificacion === 1 ? 'text-green-600' : 'text-slate-400'}`}>
                                                    {actividadDetalle.check_planificacion === 1 ? <CheckCircle className="w-5 h-5 mr-1"/> : <X className="w-5 h-5 mr-1"/>}
                                                    Planificación
                                                </span>
                                                <span className={`text-sm flex items-center font-semibold ${actividadDetalle.check_comunicacion === 1 ? 'text-green-600' : 'text-slate-400'}`}>
                                                    {actividadDetalle.check_comunicacion === 1 ? <CheckCircle className="w-5 h-5 mr-1"/> : <X className="w-5 h-5 mr-1"/>}
                                                    Comunicación
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            <div className="bg-slate-50 border p-5 rounded-lg flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-start xl:items-center justify-between gap-4">
                                <div><p className="text-xs font-bold uppercase tracking-wider text-slate-600">Visibilidad</p><p className="text-sm font-semibold text-slate-800">{Number(actividadDetalle.publicado) === 1 ? 'Público' : 'Interno'}</p></div>
                                <Button disabled={!puedeEditarActividad(actividadDetalle.sigla)} variant={Number(actividadDetalle.publicado) === 1 ? "default" : "outline"} size="sm" className={`w-full sm:w-auto ${Number(actividadDetalle.publicado) === 1 ? "bg-green-600 hover:bg-green-700" : ""}`} onClick={togglePublicado}>
                                    {Number(actividadDetalle.publicado) === 1 ? <><CheckCircle className="h-4 w-4 mr-2"/> Publicado</> : <><Globe className="h-4 w-4 mr-2"/> Publicar</>}
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-2">
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b pb-2">Descripción</h3>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border">{actividadDetalle.descripcion}</p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1 mb-2"><Calendar className="h-4 w-4"/> Fechas</h3>
                                    <div className="bg-slate-50 p-4 rounded-lg border text-sm space-y-3">
                                        <div className="flex justify-between border-b pb-2 gap-2"><span className="text-slate-500 shrink-0">Inicio:</span> <span className="font-semibold text-slate-800 text-right">{actividadDetalle.fecha_inicio || '-'}</span></div>
                                        <div className="flex justify-between border-b pb-2 gap-2"><span className="text-slate-500 shrink-0">Estimada Fin:</span> <span className="font-semibold text-slate-800 text-right">{actividadDetalle.fecha_est_fin || '-'}</span></div>
                                        <div className="flex justify-between gap-2"><span className="text-slate-500 shrink-0">Cierre Real:</span> <span className="font-bold text-green-700 text-right">{actividadDetalle.fecha_real_fin || 'En curso'}</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1 border-b pb-2 mb-4"><Users className="h-4 w-4"/> Responsables Asignados</h3>
                                {(!actividadDetalle.referentes_detalle || actividadDetalle.referentes_detalle.length === 0) ? (
                                    <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-lg border">No hay responsables asignados.</p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {actividadDetalle.referentes_detalle.map((ref: any) => (
                                            <div key={ref.id_referente} className="flex items-center gap-4 bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg">
                                                <div className="h-10 w-10 rounded-full bg-indigo-200 flex items-center justify-center shrink-0 text-indigo-700 font-bold text-sm">{ref.nombre.charAt(0)}{ref.apellido.charAt(0)}</div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-indigo-900 truncate">{ref.apellido}, {ref.nombre}</p>
                                                    <p className="text-xs text-indigo-600 uppercase font-mono truncate mt-0.5">{ref.sigla || 'General'} {ref.cuil ? `- ${ref.cuil}` : ''}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1 border-b pb-2 mb-4"><LinkIcon className="h-4 w-4"/> Enlaces de Trabajo</h3>
                                {(!actividadDetalle.urls || actividadDetalle.urls.length === 0) ? (
                                    <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-lg border">No hay enlaces cargados.</p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {actividadDetalle.urls.map((link: any) => (
                                            <a key={link.id_comu_url} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-white border hover:border-blue-400 hover:shadow-md transition-all p-4 rounded-lg group">
                                                <div className="flex flex-col overflow-hidden min-w-0"><span className="text-sm font-bold text-slate-800 group-hover:text-blue-700 truncate">{link.etiqueta}</span><span className="text-xs text-slate-500 truncate mt-1">{link.url}</span></div>
                                                <ExternalLink className="h-5 w-5 text-slate-300 group-hover:text-blue-600 shrink-0 ml-3" />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Historial Plegable */}
                        <div className="border rounded-lg overflow-hidden mt-4">
                            <button 
                                className="w-full flex items-center justify-between p-4 bg-slate-100 hover:bg-slate-200 transition-colors"
                                onClick={() => setHistorialAbierto(!historialAbierto)}
                            >
                                <div className="flex items-center gap-2 font-bold text-slate-700">
                                    <History className="h-4 w-4 text-blue-600" /> Historial de Cambios y Observaciones
                                </div>
                                {historialAbierto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            
                            {historialAbierto && (
                                <div className="p-4 bg-white space-y-4 animate-in slide-in-from-top-2 duration-200">
                                {(!actividadDetalle.historial || actividadDetalle.historial.length === 0) ? (
                                    <p className="text-sm text-slate-400 italic text-center">No hay movimientos registrados en el historial.</p>
                                ) : (
                                    actividadDetalle.historial.map((h: any) => (
                                    <div key={h.id_comu_historial} className="border-l-2 border-blue-200 pl-4 py-1 relative">
                                        <div className="absolute -left-1.5 top-2 h-3 w-3 rounded-full bg-blue-500 border-2 border-white" />
                                        <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-bold text-slate-500">{new Date(h.fecha_cambio).toLocaleString()}</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{h.usuario_nombre}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 mb-1">
                                            Movió de <span className="font-bold">{h.estado_anterior}</span> a <span className="font-bold">{h.estado_nuevo}</span>
                                        </p>
                                        {h.observacion && (
                                            <div className="bg-slate-50 p-2 rounded text-xs text-slate-700 italic border border-slate-200 mt-1">
                                                "{h.observacion}"
                                            </div>
                                        )}
                                    </div>
                                    ))
                                )}
                                </div>
                            )}
                        </div>

                    </div>
                </>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Observación Obligatoria */}
        <Dialog open={modalAccion.open} onOpenChange={(o) => !o && setModalAccion({open: false, tipo: null})}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" /> 
                Observación de {modalAccion.tipo === 'avanzar' ? 'Avance' : 'Retroceso'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-sm text-slate-500">
                Por favor, dejá una breve nota explicando el motivo por el cual la actividad {modalAccion.tipo === 'avanzar' ? 'avanza a la siguiente etapa' : 'vuelve a la etapa anterior'}.
              </p>
              <Textarea 
                placeholder="Escribe aquí tu observación..." 
                className="min-h-[100px]"
                value={observacionAccion}
                onChange={(e) => setObservacionAccion(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setModalAccion({open: false, tipo: null})}>Cancelar</Button>
              <Button className={modalAccion.tipo === 'avanzar' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'} onClick={ejecutarMovimiento}>
                Confirmar Cambio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}