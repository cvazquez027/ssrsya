import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Save, Loader2, Edit, Trash2, CheckCircle2, AlertCircle, Circle, BarChart2, Building2, Target, Calendar, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx'; // CIRUGÍA: Importamos SheetJS para Excel

const API_BASE = "http://localhost/planificacion/api-backend";

export default function ComuIndicadoresPage() {
  const { toast } = useToast();
  const [indicadores, setIndicadores] = useState<any[]>([]);
  const [maestras, setMaestras] = useState<any>({ dependencias: [], tipos_meta: [] });
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);

  const estadoInicial = {
    id_comu_indicador: "", sigla: "", id_comu_tipo_meta: "", nombre: "", construccion: "",
    periodo: "", meta_propuesta: "", desc_meta_propuesta: "",
    meta_alcanzada: "", desc_meta_alcanzada: "", observaciones: ""
  };
  const [formData, setFormData] = useState(estadoInicial);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [resMaestras, resIndicadores] = await Promise.all([
        fetch(`${API_BASE}/lista_maestras_comu.php`, { credentials: 'include' }),
        fetch(`${API_BASE}/abm_comu_indicadores.php`, { credentials: 'include' })
      ]);
      const dataMaestras = await resMaestras.json();
      const dataIndicadores = await resIndicadores.json();
      
      if (dataMaestras.success) setMaestras(dataMaestras.data);
      if (dataIndicadores.success) setIndicadores(dataIndicadores.data);
    } catch (e) {
      toast({ title: "Error", description: "Falla de conexión", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const abrirAlta = () => {
      setModoEdicion(false);
      setFormData(estadoInicial);
      setModalOpen(true);
  };

  const abrirEdicion = (ind: any) => {
      setFormData({
          id_comu_indicador: ind.id_comu_indicador,
          sigla: ind.sigla,
          id_comu_tipo_meta: String(ind.id_comu_tipo_meta),
          nombre: ind.nombre,
          construccion: ind.construccion || "",
          periodo: ind.periodo || "",
          meta_propuesta: ind.meta_propuesta !== null ? String(ind.meta_propuesta) : "",
          desc_meta_propuesta: ind.desc_meta_propuesta || "",
          meta_alcanzada: ind.meta_alcanzada !== null ? String(ind.meta_alcanzada) : "",
          desc_meta_alcanzada: ind.desc_meta_alcanzada || "",
          observaciones: ind.observaciones || ""
      });
      setModoEdicion(true);
      setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    
    try {
      const res = await fetch(`${API_BASE}/abm_comu_indicadores.php`, {
        method: modoEdicion ? "PUT" : "POST", 
        headers: { "Content-Type": "application/json" }, 
        credentials: 'include', 
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Éxito", description: modoEdicion ? "Indicador actualizado." : "Indicador registrado." });
        setModalOpen(false); 
        cargarDatos();
      } else throw new Error(data.error);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } 
    finally { setGuardando(false); }
  };

  const eliminarIndicador = async (id: number) => {
    if (!window.confirm("¿Estás seguro de que deseás eliminar este indicador? Esta acción no se puede deshacer.")) return;
    
    try {
        const res = await fetch(`${API_BASE}/abm_comu_indicadores.php?id=${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            toast({ title: "Eliminado", description: "El indicador fue borrado." });
            cargarDatos();
        } else throw new Error(data.error);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  // CIRUGÍA: Función de exportación a Excel para Indicadores
  const exportarExcel = () => {
    if (indicadores.length === 0) {
        toast({ title: "Aviso", description: "No hay datos para exportar." });
        return;
    }

    // 1. Damos un formato limpio a los datos y calculamos el estado textual
    const datosExcel = indicadores.map(ind => {
        let estadoTextual = "Pendiente";
        if (ind.meta_alcanzada !== null && ind.meta_alcanzada !== "") {
            const p = parseFloat(ind.meta_propuesta);
            const a = parseFloat(ind.meta_alcanzada);
            if (!isNaN(p) && !isNaN(a)) {
                estadoTextual = a >= p ? "Cumplida" : "No Cumplida";
            }
        }

        const sufijo = ind.tipo_meta_desc?.toLowerCase().includes('porcentaje') ? '%' : '';

        return {
            "ID": ind.id_comu_indicador,
            "Dependencia": ind.sigla,
            "Nombre del Indicador": ind.nombre,
            "Tipo de Meta": ind.tipo_meta_desc,
            "Período": ind.periodo || "S/D",
            "Fórmula / Construcción": ind.construccion || "S/D",
            "Meta Propuesta": ind.meta_propuesta !== null ? `${ind.meta_propuesta}${sufijo}` : "S/D",
            "Meta Alcanzada": ind.meta_alcanzada !== null ? `${ind.meta_alcanzada}${sufijo}` : "S/D",
            "Estado": estadoTextual,
            "Observaciones": ind.observaciones || "S/D"
        };
    });

    // 2. Creamos el libro y la hoja
    const worksheet = XLSX.utils.json_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Indicadores_Comu");

    // 3. Ajustamos el ancho de las columnas
    const columnWidths = [
        { wch: 8 },  // ID
        { wch: 15 }, // Dependencia
        { wch: 45 }, // Nombre
        { wch: 15 }, // Tipo Meta
        { wch: 20 }, // Período
        { wch: 50 }, // Fórmula
        { wch: 15 }, // Propuesta
        { wch: 15 }, // Alcanzada
        { wch: 15 }, // Estado
        { wch: 45 }  // Observaciones
    ];
    worksheet['!cols'] = columnWidths;

    // 4. Descargamos el archivo
    XLSX.writeFile(workbook, `Reporte_Indicadores_Comu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getSemaforo = (propuesta: any, alcanzada: any) => {
      if (alcanzada === null || alcanzada === "" || alcanzada === undefined) {
          return <span title="Pendiente de ejecución" className="block mx-auto w-fit"><Circle className="h-5 w-5 text-slate-300" /></span>;
      }
      const p = parseFloat(propuesta);
      const a = parseFloat(alcanzada);
      if (isNaN(p) || isNaN(a)) return <span title="Datos inválidos" className="block mx-auto w-fit"><Circle className="h-5 w-5 text-slate-300" /></span>;
      
      if (a >= p) return <span title="Meta Cumplida" className="block mx-auto w-fit"><CheckCircle2 className="h-5 w-5 text-green-500" /></span>;
      return <span title="Meta No Cumplida" className="block mx-auto w-fit"><AlertCircle className="h-5 w-5 text-red-500" /></span>;
  };

  if (loading) return <DashboardLayout currentSection="Comunicación - Indicadores"><div className="p-8 text-center animate-pulse">Cargando métricas...</div></DashboardLayout>;

  return (
    <DashboardLayout currentSection="Comunicación - Indicadores">
      <div className="space-y-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Métricas e Indicadores</h2>
            <p className="text-sm text-slate-500">Gestión de objetivos cuantitativos y cualitativos de comunicación.</p>
          </div>
          
          {/* Botonera agrupada y responsiva */}
          <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={exportarExcel}>
                <Download className="mr-2 h-4 w-4" /> Exportar Excel
              </Button>
              <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700" onClick={abrirAlta}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo Indicador
              </Button>
          </div>

          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="!max-w-4xl !w-[95vw] max-h-[90vh] overflow-y-auto custom-scrollbar">
              <DialogHeader><DialogTitle>{modoEdicion ? "Editar Indicador" : "Crear Nuevo Indicador"}</DialogTitle></DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><BarChart2 className="h-4 w-4"/> 1. Definición del Indicador</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Building2 className="h-3 w-3"/> Dependencia *</label>
                            <Select required value={formData.sigla} onValueChange={(val) => setFormData({...formData, sigla: val})}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Área..." /></SelectTrigger>
                                <SelectContent className="max-h-[50vh]">
                                    {maestras.dependencias.map((d: any) => <SelectItem key={d.sigla} value={d.sigla}>{d.sigla}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-semibold text-slate-600">Nombre del Indicador *</label>
                            <Input required placeholder="Ej: Cantidad de posteos en redes sociales" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">Construcción / Fórmula</label>
                        <Textarea placeholder="Ej: Sumatoria de todos los posteos realizados en Instagram y X" value={formData.construccion} onChange={(e) => setFormData({...formData, construccion: e.target.value})} className="h-16" />
                    </div>
                </div>

                <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><Target className="h-4 w-4"/> 2. Planificación y Resultados</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Calendar className="h-3 w-3"/> Período de Medición</label>
                            <Input placeholder="Ej: Marzo 2026, Q1, Campaña Verano" value={formData.periodo} onChange={(e) => setFormData({...formData, periodo: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">Unidad de Medida *</label>
                            <Select required value={formData.id_comu_tipo_meta} onValueChange={(val) => setFormData({...formData, id_comu_tipo_meta: val})}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                                <SelectContent>
                                    {maestras.tipos_meta.map((tm: any) => <SelectItem key={tm.id_comu_tipo_meta} value={String(tm.id_comu_tipo_meta)}>{tm.descripcion}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 border rounded-lg p-4 bg-white border-blue-100 shadow-sm">
                            <h4 className="font-bold text-blue-800 text-sm flex items-center gap-2">Planificado (Propuesta)</h4>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500">Valor Numérico Esperado</label>
                                <Input type="number" step="0.01" placeholder="Ej: 50" value={formData.meta_propuesta} onChange={(e) => setFormData({...formData, meta_propuesta: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500">Justificación / Descripción (Opcional)</label>
                                <Textarea placeholder="Detalle de la propuesta..." value={formData.desc_meta_propuesta} onChange={(e) => setFormData({...formData, desc_meta_propuesta: e.target.value})} className="h-16" />
                            </div>
                        </div>

                        <div className="space-y-4 border rounded-lg p-4 bg-slate-50 border-emerald-100 shadow-sm">
                            <h4 className="font-bold text-emerald-700 text-sm flex items-center gap-2">Ejecutado (Realidad)</h4>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500">Valor Numérico Logrado</label>
                                <Input type="number" step="0.01" placeholder="Ej: 55" value={formData.meta_alcanzada} onChange={(e) => setFormData({...formData, meta_alcanzada: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500">Análisis del resultado (Opcional)</label>
                                <Textarea placeholder="¿Por qué se llegó o no se llegó a la meta?" value={formData.desc_meta_alcanzada} onChange={(e) => setFormData({...formData, desc_meta_alcanzada: e.target.value})} className="h-16" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">Observaciones Generales</label>
                        <Input placeholder="Comentarios adicionales..." value={formData.observaciones} onChange={(e) => setFormData({...formData, observaciones: e.target.value})} />
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t mt-6 gap-3">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 shadow-sm" disabled={guardando}>
                    {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                    {modoEdicion ? "Guardar Cambios" : "Crear Indicador"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="text-lg font-semibold text-slate-700">Tablero de Indicadores</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-600 uppercase bg-slate-100 border-b">
                  <tr>
                    <th className="px-4 py-3 w-[5%] text-center">KPI</th>
                    <th className="px-4 py-3 w-[10%]">Área</th>
                    <th className="px-4 py-3 w-[35%]">Nombre del Indicador</th>
                    <th className="px-4 py-3 w-[15%]">Período</th>
                    <th className="px-4 py-3 text-center w-[12%]">Meta Prop.</th>
                    <th className="px-4 py-3 text-center w-[12%]">Ejecutado</th>
                    <th className="px-4 py-3 text-center w-[11%]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {indicadores.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-500">Aún no hay indicadores registrados.</td></tr>
                  ) : (
                    indicadores.map((ind) => {
                        const sufijo = ind.tipo_meta_desc?.toLowerCase().includes('porcentaje') ? '%' : '';
                        
                        return (
                          <tr key={ind.id_comu_indicador} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-center align-middle">{getSemaforo(ind.meta_propuesta, ind.meta_alcanzada)}</td>
                            <td className="px-4 py-3 font-bold text-slate-700 align-top">{ind.sigla}</td>
                            <td className="px-4 py-3 text-slate-800 font-medium align-top">
                                <p className="line-clamp-2" title={ind.nombre}>{ind.nombre}</p>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide">{ind.tipo_meta_desc}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 align-top">{ind.periodo || '-'}</td>
                            <td className="px-4 py-3 text-center align-middle font-semibold text-blue-700 bg-blue-50/30">
                                {ind.meta_propuesta !== null ? `${ind.meta_propuesta}${sufijo}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center align-middle font-bold text-slate-800 bg-slate-50/50">
                                {ind.meta_alcanzada !== null ? `${ind.meta_alcanzada}${sufijo}` : <span className="text-slate-400 font-normal">S/D</span>}
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                                <div className="flex justify-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 rounded-full" onClick={() => abrirEdicion(ind)} title="Editar Ficha / Cargar Meta">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-100 rounded-full" onClick={() => eliminarIndicador(ind.id_comu_indicador)} title="Eliminar">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </td>
                          </tr>
                        )
                    })
                  )}
                </tbody>
              </table>
             </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}