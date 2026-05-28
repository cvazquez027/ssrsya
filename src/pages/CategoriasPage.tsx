import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Save, Trash2, Filter, ShieldAlert } from "lucide-react"

const API_BASE = "http://localhost/planificacion/api-backend";

// --- MOTOR DE AVANCES ---
const getBadgeAvanceClass = (avance: number | null) => {
    if (avance === null) return "bg-slate-100 text-slate-400 border-slate-200";
    if (avance < 30) return "bg-red-50 text-red-700 border-red-200";
    if (avance < 70) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-green-50 text-green-700 border-green-200";
};

const BadgeAvance = ({ avance }: { avance: number | null }) => {
    if (avance === null) return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-400 border border-slate-200">N/A</span>;
    return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${getBadgeAvanceClass(avance)}`}>{avance.toFixed(1)}%</span>;
};

const getMonitoreoAvance = (mon: any): number | null => {
    if (mon.no_aplica === 1) return null;
    if (mon.meta_propuesta && !isNaN(parseFloat(mon.meta_propuesta))) {
        const prop = parseFloat(mon.meta_propuesta);
        if (prop > 0) {
            const alc = mon.meta_alcanzada ? parseFloat(mon.meta_alcanzada) : 0;
            let pct = (alc / prop) * 100; return pct > 100 ? 100 : pct;
        }
    }
    return null;
}
const getIndicadorAvance = (ind: any): number | null => {
    if (!ind.monitoreos || ind.monitoreos.length === 0) return null;
    let sum = 0, count = 0; ind.monitoreos.forEach((m:any) => { const v = getMonitoreoAvance(m); if (v !== null) { sum+=v; count++; } });
    return count > 0 ? sum/count : null;
}

export default function CategoriasPage() {
    const { toast } = useToast()
    
    // --- CIRUGÍA DE SEGURIDAD ---
    const [accesoDenegado, setAccesoDenegado] = useState(false);
    
    const [categorias, setCategorias] = useState<any[]>([])
    const [proyectos, setProyectos] = useState<any[]>([])
    const [indicadoresFull, setIndicadoresFull] = useState<any[]>([])
    
    // Formularios
    const [idCategoriaSeleccionada, setIdCategoriaSeleccionada] = useState("")
    const [idProyectoSel, setIdProyectoSel] = useState("")
    const [idIndicadorSel, setIdIndicadorSel] = useState("")

    // Grilla
    const [filtroCategoria, setFiltroCategoria] = useState("todas")
    const [grillaData, setGrillaData] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => { 
        verificarSesion().then(tieneAcceso => {
            if (tieneAcceso) {
                cargarMaestras(); 
                cargarGrilla("todas"); 
            }
        });
    }, [])

    const verificarSesion = async () => {
        try {
            const resUser = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' });
            const userData = await resUser.json();
            
            if (!userData.permisos?.['PLANIFICACION']) {
                setAccesoDenegado(true);
                return false;
            }
            return true;
        } catch (e) {
            console.error("Error validando sesión:", e);
            return false;
        }
    }

    const cargarMaestras = async () => {
        try {
            const resCat = await fetch(`${API_BASE}/lista_maestras.php?tabla=categoria`, { credentials: 'include' })
            const resProy = await fetch(`${API_BASE}/lista_proyectos.php`, { credentials: 'include' }) 
            
            const dataCat = await resCat.json()
            const dataProy = await resProy.json()
            
            setCategorias(Array.isArray(dataCat) ? dataCat : [])
            
            const aprobados = Array.isArray(dataProy) ? dataProy.filter(p => Number(p.estado_proyecto) === 3) : []
            setProyectos(aprobados)
        } catch(e) { console.error(e) }
    }

    const cargarIndicadoresProyecto = async (idProy: string) => {
        setIdProyectoSel(idProy); setIdIndicadorSel("");
        try {
            const res = await fetch(`${API_BASE}/asociar_categoria.php?accion=indicadores&id_proyecto=${idProy}`, { credentials: 'include' })
            const dataInd = await res.json()
            setIndicadoresFull(Array.isArray(dataInd) ? dataInd : [])
        } catch(e){ console.error(e) }
    }

    const cargarGrilla = async (filtroId: string) => {
        setLoading(true)
        try {
            const url = filtroId === "todas" ? `${API_BASE}/asociar_categoria.php` : `${API_BASE}/asociar_categoria.php?id_categoria=${filtroId}`;
            const res = await fetch(url, { credentials: 'include' });
            const dataGrilla = await res.json();
            setGrillaData(Array.isArray(dataGrilla) ? dataGrilla : []);
        } catch(e) { console.error(e) } finally { setLoading(false) }
    }

    const handleAsociar = async () => {
        if(!idCategoriaSeleccionada || !idIndicadorSel) { toast({title: "Atención", description: "Seleccione Proyecto Integrado e Indicador", variant: "destructive"}); return; }
        try {
            const res = await fetch(`${API_BASE}/asociar_categoria.php`, {
                method: 'POST', body: JSON.stringify({id_categoria: idCategoriaSeleccionada, id_indicador: idIndicadorSel}), credentials: 'include'
            })
            if(res.ok) { toast({title: "Éxito", description: "Indicador asociado"}); cargarGrilla(filtroCategoria); setIdIndicadorSel(""); }
        } catch(e){}
    }

    const handleDesvincular = async (idCat: number, idInd: number) => {
        if(!confirm("¿Desvincular indicador de este Proyecto Integrado?")) return;
        try {
            const res = await fetch(`${API_BASE}/asociar_categoria.php`, {
                method: 'DELETE', body: JSON.stringify({id_categoria: idCat, id_indicador: idInd}), credentials: 'include'
            })
            if(res.ok) { toast({title: "Desvinculado"}); cargarGrilla(filtroCategoria); }
        } catch(e){}
    }

    if (accesoDenegado) {
        return (
            <DashboardLayout currentSection="Proyectos Integrados">
                <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                    <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                    <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                    <p>No tenés permisos para visualizar el módulo de Planificación.</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout currentSection="Proyectos Integrados">
            <div className="space-y-6">
                
                {/* FORMULARIO DE ASOCIACIÓN */}
                <Card className="bg-slate-50 border-slate-200 shadow-sm">
                    <CardHeader><CardTitle className="text-lg">Asociar Indicador a Proyecto Integrado</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                        {/* MODIFICACIÓN QUIRÚRGICA: Contenedor con overflow-hidden y trigger con ajuste dinámico de altura */}
                        <div className="space-y-1 w-full overflow-hidden">
                            <Label>Proyecto Integrado</Label>
                            <Select value={idCategoriaSeleccionada} onValueChange={setIdCategoriaSeleccionada}>
                                <SelectTrigger className="bg-white w-full h-auto min-h-[40px] whitespace-normal break-words text-left">
                                    <SelectValue placeholder="Seleccione Proyecto Integrado..." />
                                </SelectTrigger>
                                <SelectContent className="max-w-[80vw] sm:max-w-[400px]">
                                    {categorias.map(c => <SelectItem key={c.id_categoria} value={c.id_categoria.toString()} className="whitespace-normal break-words">{c.nombre}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* MODIFICACIÓN QUIRÚRGICA: Contenedor con overflow-hidden y trigger con ajuste dinámico de altura */}
                        <div className="space-y-1 w-full overflow-hidden">
                            <Label>Proyecto Origen (Aprobados)</Label>
                            <Select value={idProyectoSel} onValueChange={cargarIndicadoresProyecto}>
                                <SelectTrigger className="bg-white w-full h-auto min-h-[40px] whitespace-normal break-words text-left">
                                    <SelectValue placeholder="Buscar Proyecto..." />
                                </SelectTrigger>
                                <SelectContent className="max-w-[80vw] sm:max-w-[400px]">
                                    {proyectos.map(p => (
                                        <SelectItem 
                                            key={p.id_proyecto} 
                                            value={p.id_proyecto.toString()} 
                                            className="whitespace-normal break-words py-2 pr-6 border-b last:border-0"
                                        >
                                            <span className="font-bold text-blue-800 mr-1">{p.sigla_dependencia} -</span> 
                                            {p.proyecto_descripcion || p.descripcion}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* MODIFICACIÓN QUIRÚRGICA: Contenedor con overflow-hidden y trigger con ajuste dinámico de altura */}
                        <div className="space-y-1 w-full overflow-hidden">
                            <Label>Indicador</Label>
                            <Select value={idIndicadorSel} onValueChange={setIdIndicadorSel} disabled={!idProyectoSel}>
                                <SelectTrigger className="bg-white w-full h-auto min-h-[40px] whitespace-normal break-words text-left">
                                    <SelectValue placeholder="Seleccione Indicador..." />
                                </SelectTrigger>
                                <SelectContent className="max-w-[80vw] sm:max-w-[400px]">
                                    {indicadoresFull.map(i => (
                                        <SelectItem 
                                            key={i.id_indicador} 
                                            value={i.id_indicador.toString()}
                                            className="whitespace-normal break-words py-2 border-b last:border-0"
                                        >
                                            {i.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="pt-[22px]">
                            <Button onClick={handleAsociar} className="bg-blue-600 hover:bg-blue-700 w-full h-10 min-h-[40px]"><Save className="mr-2 h-4 w-4"/> Asociar</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* GRILLA DE ASOCIACIONES */}
                <Card>
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b bg-white pb-4 gap-4">
                        <CardTitle className="text-lg">Grilla de Asociaciones Vigentes</CardTitle>
                        <div className="flex items-center gap-2 w-full sm:w-80">
                            <Filter className="h-4 w-4 text-slate-400" />
                            <Select value={filtroCategoria} onValueChange={(val) => { setFiltroCategoria(val); cargarGrilla(val); }}>
                                <SelectTrigger className="h-auto min-h-[36px] whitespace-normal break-words text-left">
                                    <SelectValue placeholder="Filtrar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">Todas los Proyectos Intregrados</SelectItem>
                                    {categorias.map(c => <SelectItem key={c.id_categoria} value={c.id_categoria.toString()} className="whitespace-normal">{c.nombre}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? <div className="p-8 text-center text-slate-500">Cargando...</div> : grillaData.length === 0 ? <div className="p-8 text-center text-slate-500">No hay indicadores asociados al proyecto integrado seleccionado.</div> : (
                            <div className="w-full overflow-x-auto custom-scrollbar">
                                <table className="w-full border-collapse table-fixed text-xs min-w-[800px]">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left p-3 w-[15%]">Proyecto Integrado</th>
                                            <th className="text-left p-3 w-[25%]">Proyecto / OE / Actividad</th>
                                            <th className="text-left p-3 w-[20%]">Indicador Asoc.</th>
                                            <th className="text-left p-3 w-[15%]">Periodo</th>
                                            <th className="text-center p-3 w-[10%]">Meta Prop.</th>
                                            <th className="text-center p-3 w-[10%]">Meta Alc.</th>
                                            <th className="text-center p-3 w-[5%]"><Trash2 className="h-4 w-4 mx-auto"/></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grillaData.map(cat => (
                                            cat.proyectos.map((proy:any) => (
                                                proy.objetivos.map((oe:any) => (
                                                    oe.actividades.map((act:any) => (
                                                        act.indicadores.map((ind:any) => {
                                                            const indSpan = Math.max(1, ind.monitoreos?.length || 0);
                                                            const esPct = ind.tipo_meta === 'porcentaje';
                                                            return ind.monitoreos?.length > 0 ? ind.monitoreos.map((mon:any, mIdx:number) => (
                                                                <tr key={`${cat.id_categoria}-${ind.id_indicador}-${mon.id_monitoreo}`} className="border-b hover:bg-slate-50">
                                                                    {mIdx === 0 && (
                                                                        <>
                                                                            <td rowSpan={indSpan} className="p-3 align-top bg-white border-r font-bold text-slate-700">{cat.nombre}</td>
                                                                            <td rowSpan={indSpan} className="p-3 align-top bg-white border-r">
                                                                                <div className="text-[10px] text-blue-600 font-bold mb-1">PROY: {proy.sigla}</div>
                                                                                <div className="text-slate-600 mb-1 leading-tight">{oe.descripcion}</div>
                                                                                <div className="text-slate-500 italic leading-tight">{act.descripcion}</div>
                                                                            </td>
                                                                            <td rowSpan={indSpan} className="p-3 align-top bg-white border-r">
                                                                                <div className="font-semibold text-slate-800 mb-2 leading-tight">{ind.nombre}</div>
                                                                                <BadgeAvance avance={getIndicadorAvance(ind)} />
                                                                            </td>
                                                                        </>
                                                                    )}
                                                                    <td className="p-3 align-top border-r">
                                                                        <div className="text-slate-600 mb-1">{mon.periodo_descripcion}</div>
                                                                        <BadgeAvance avance={getMonitoreoAvance(mon)} />
                                                                    </td>
                                                                    <td className="p-3 align-top border-r text-center">{mon.meta_propuesta}{esPct && mon.meta_propuesta ? '%' : ''}</td>
                                                                    <td className="p-3 align-top font-bold text-blue-700 border-r text-center">{mon.meta_alcanzada ? `${mon.meta_alcanzada}${esPct ? '%' : ''}` : "-"}</td>
                                                                    {mIdx === 0 && (
                                                                        <td rowSpan={indSpan} className="p-3 align-middle text-center border-r">
                                                                            <Button variant="ghost" size="sm" onClick={() => handleDesvincular(cat.id_categoria, ind.id_indicador)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 p-0"><Trash2 className="h-4 w-4"/></Button>
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            )) : (
                                                                <tr key={`${cat.id_categoria}-${ind.id_indicador}`} className="border-b hover:bg-slate-50">
                                                                    <td className="p-3 align-top bg-white border-r font-bold text-slate-700">{cat.nombre}</td>
                                                                    <td className="p-3 align-top bg-white border-r">
                                                                        <div className="text-[10px] text-blue-600 font-bold mb-1">PROY: {proy.sigla}</div>
                                                                        <div className="text-slate-600 mb-1 leading-tight">{oe.descripcion}</div>
                                                                        <div className="text-slate-500 italic leading-tight">{act.descripcion}</div>
                                                                    </td>
                                                                    <td className="p-3 align-top bg-white border-r">
                                                                        <div className="font-semibold text-slate-800 mb-2 leading-tight">{ind.nombre}</div>
                                                                        <BadgeAvance avance={getIndicadorAvance(ind)} />
                                                                    </td>
                                                                    <td colSpan={3} className="p-3 text-center text-slate-400 italic align-middle border-r">Sin periodos cargados</td>
                                                                    <td className="p-3 align-middle text-center border-r">
                                                                        <Button variant="ghost" size="sm" onClick={() => handleDesvincular(cat.id_categoria, ind.id_indicador)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 p-0"><Trash2 className="h-4 w-4"/></Button>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })
                                                    ))
                                                ))
                                            ))
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </DashboardLayout>
    )
}