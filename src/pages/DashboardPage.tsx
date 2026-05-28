import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  ChevronDown, ChevronRight, Building2, Eye, FolderKanban, Target, ListChecks, BarChart3, TrendingUp, Filter, ShieldAlert, Search, LayoutDashboard, PieChart, Activity, Users, FileText
} from "lucide-react"

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts"

interface Dependencia {
  sigla: string
  descripcion: string
  id_referente: number
  referente_nombre: string
  sigla_superior: string | null
  children?: Dependencia[]
}

interface Proyecto {
  id_proyecto: number
  proyecto_descripcion: string
  og_descripcion?: string 
  sigla_dependencia?: string 
  estado_desc?: string 
  estado_workflow_desc?: string
  estado_proyecto?: number
}

interface Metricas {
  cantidadProyectos: number
  cantidadObjetivosEspecificos: number
  cantidadActividades: number
  cantidadIndicadores: number
  avancePromedio: string
  proyectos_avance?: { nombre: string, avance: number }[] 
}

const API_BASE = "http://localhost/planificacion/api-backend";
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#f43f5e'];

const getColorAvance = (avance: number) => {
  if (avance < 30) return "#ef4444"; 
  if (avance < 70) return "#eab308"; 
  return "#22c55e"; 
};

const getBadgeAvanceClass = (avance: number) => {
  if (avance < 30) return "bg-red-50 text-red-700 border-red-200";
  if (avance < 70) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-green-50 text-green-700 border-green-200";
};

const getKpiCardClass = (avance: number) => {
  if (avance < 30) return "from-red-50 to-red-100/60 border-red-300";
  if (avance < 70) return "from-yellow-50 to-yellow-100/60 border-yellow-300";
  return "from-green-50 to-green-100/60 border-green-300";
};

const getKpiTextClass = (avance: number) => {
  if (avance < 30) return "text-red-700";
  if (avance < 70) return "text-yellow-700";
  return "text-green-700";
};

const getKpiIconClass = (avance: number) => {
  if (avance < 30) return "text-red-600";
  if (avance < 70) return "text-yellow-600";
  return "text-green-600";
};

export default function DashboardPage() {
  const { toast } = useToast()
  const navigate = useNavigate() 
  
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  const [hasGlobalAccess, setHasGlobalAccess] = useState(true);

  const [dependencias, setDependencias] = useState<Dependencia[]>([])
  const [proyectos, setProyectos] = useState<{ [key: string]: Proyecto[] }>({})
  const [allProyectos, setAllProyectos] = useState<Proyecto[]>([]) 
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({})
  const [selectedDep, setSelectedDep] = useState<string | null>(null)
  
  const [isOrgSheetOpen, setIsOrgSheetOpen] = useState(false)
  const [isChartModalOpen, setIsChartModalOpen] = useState(false) 
  const [mostrarGlobal, setMostrarGlobal] = useState(true) 
  
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [metricasAvanzadas, setMetricasAvanzadas] = useState<any>({
      proyectos_por_dep: [], objetivos_por_dep: [], distribucion_actividades: [], cumplimiento_por_dep: [], documentos_por_dep: [], capacitados_por_dep: [], insumos_por_dep: []
  });

  const [metricas, setMetricas] = useState<Metricas>({
    cantidadProyectos: 0, cantidadObjetivosEspecificos: 0, cantidadActividades: 0, cantidadIndicadores: 0, avancePromedio: "0%", proyectos_avance: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchInitialData() }, [])

  useEffect(() => {
    const timerId = setTimeout(() => { setDebouncedSearch(searchTerm); }, 300);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  useEffect(() => {
      if (!loading && !accesoDenegado) {
          fetchProyectos(debouncedSearch);
      }
  }, [debouncedSearch]);

  const fetchProyectos = async (query: string = "") => {
      setIsSearching(true);
      try {
          const url = query ? `${API_BASE}/lista_proyectos.php?search=${encodeURIComponent(query)}` : `${API_BASE}/lista_proyectos.php`;
          const resProy = await fetch(url, { credentials: 'include' });
          if (resProy.ok) {
              const dataProy = await resProy.json();
              if (Array.isArray(dataProy)) {
                  setAllProyectos(dataProy); 
                  const grouped: { [key: string]: Proyecto[] } = {};
                  dataProy.forEach((p: any) => {
                    if (!grouped[p.sigla_dependencia]) grouped[p.sigla_dependencia] = [];
                    grouped[p.sigla_dependencia].push(p);
                  });
                  setProyectos(grouped);
              } else {
                  setAllProyectos([]); setProyectos({});
              }
          }
      } catch (e) { 
          console.warn("Error cargando proyectos", e);
          setAllProyectos([]); setProyectos({});
      } finally {
          setIsSearching(false);
      }
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true)

      const resUser = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' });
      const userData = await resUser.json();
      
      if (!userData.permisos?.['PLANIFICACION']) {
          setAccesoDenegado(true);
          setLoading(false);
          return;
      }

      const depsPermitidas = userData.dependencias_permitidas;
      const isGlobal = (depsPermitidas === null);
      setHasGlobalAccess(isGlobal);
      
      let dataDepAll = [];
      try {
          const resDep = await fetch(`${API_BASE}/dependencia.php`, { credentials: 'include' });
          if (resDep.ok) dataDepAll = await resDep.json();
      } catch (e) { console.warn("Error cargando dependencias", e); }

      await fetchProyectos("");

      // CIRUGÍA: Leer URL para ver si venimos del Organigrama
      const urlParams = new URLSearchParams(window.location.search);
      const depFromUrl = urlParams.get('dependencia');

      if (depFromUrl) {
          setSelectedDep(depFromUrl);
          setMostrarGlobal(false);
          try {
              const resMet = await fetch(`${API_BASE}/metricas.php?sigla=${depFromUrl}`, { credentials: 'include' });
              if (resMet.ok) {
                  const dataMet = await resMet.json();
                  if (!dataMet.error) setMetricas(dataMet);
              }
              const resAdv = await fetch(`${API_BASE}/dashboard_avanzado.php?sigla=${depFromUrl}`, { credentials: 'include' });
              if (resAdv.ok) {
                  const dataAdv = await resAdv.json();
                  if (dataAdv.success) setMetricasAvanzadas(dataAdv.data);
              }
          } catch (e) { console.warn(e); }
      } else {
          // Carga Global estándar
          try {
              const resMet = await fetch(`${API_BASE}/metricas_totales.php`, { credentials: 'include' });
              if (resMet.ok) {
                  const dataMet = await resMet.json();
                  if (!dataMet.error) setMetricas(dataMet);
              }
          } catch (e) { console.warn(e); }

          try {
              const resAdv = await fetch(`${API_BASE}/dashboard_avanzado.php`, { credentials: 'include' });
              if (resAdv.ok) {
                  const dataAdv = await resAdv.json();
                  if (dataAdv.success) setMetricasAvanzadas(dataAdv.data);
              }
          } catch (e) { console.warn(e); }
      }

      if (Array.isArray(dataDepAll)) {
          let dataDepFiltered = dataDepAll;
          if (!isGlobal && Array.isArray(depsPermitidas)) {
              dataDepFiltered = dataDepAll.filter((d: any) => depsPermitidas.includes(d.sigla));
          }
          setDependencias(buildTree(dataDepFiltered));
      }

    } catch (error) {
      toast({ title: "Error", description: "Ocurrió un error al cargar el tablero principal.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const buildTree = (list: Dependencia[]): Dependencia[] => {
    const siglaSet = new Set(list.map(d => d.sigla));
    const roots = list.filter(item => !item.sigla_superior || !siglaSet.has(item.sigla_superior));
    
    const getChildren = (parentSigla: string): Dependencia[] => {
      return list.filter(item => item.sigla_superior === parentSigla).map(item => ({
        ...item, children: getChildren(item.sigla)
      }));
    };

    return roots.map(root => ({ ...root, children: getChildren(root.sigla) }));
  }

  const toggleExpand = (e: React.MouseEvent, sigla: string) => {
    e.stopPropagation()
    setExpanded(prev => ({ ...prev, [sigla]: !prev[sigla] }))
  }

  const handleDepClick = async (sigla: string) => {
    navigate(`/tablero?dependencia=${sigla}`, { replace: true });
    setSelectedDep(sigla)
    setMostrarGlobal(false) 
    setIsOrgSheetOpen(false) 
    try {
      const res = await fetch(`${API_BASE}/metricas.php?sigla=${sigla}`, { credentials: 'include' })
      const data = await res.json()
      if (!data.error) setMetricas(data)

      const resAdv = await fetch(`${API_BASE}/dashboard_avanzado.php?sigla=${sigla}`, { credentials: 'include' })
      const dataAdv = await resAdv.json()
      if (dataAdv.success) setMetricasAvanzadas(dataAdv.data)
    } catch (error) { console.error(error) }
  }

  const handleKPIClick = async () => {
    navigate(`/tablero`, { replace: true });
    setSelectedDep(null)
    setMostrarGlobal(true) 
    setIsOrgSheetOpen(false) 
    try {
      const res = await fetch(`${API_BASE}/metricas_totales.php`, { credentials: 'include' })
      const data = await res.json()
      if (!data.error) setMetricas(data)

      const resAdv = await fetch(`${API_BASE}/dashboard_avanzado.php`, { credentials: 'include' })
      const dataAdv = await resAdv.json()
      if (dataAdv.success) setMetricasAvanzadas(dataAdv.data)
    } catch (error) { console.error(error) }

    setTimeout(() => {
      const element = document.getElementById("grilla-proyectos-dashboard");
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  const formatDistribucionData = () => {
    if (!metricasAvanzadas.distribucion_actividades) return { data: [], keys: [] };
    const grouped: any = {};
    const tiposSet = new Set<string>();

    metricasAvanzadas.distribucion_actividades.forEach((item: any) => {
      if (!grouped[item.sigla_dependencia]) {
        grouped[item.sigla_dependencia] = { name: item.sigla_dependencia };
      }
      grouped[item.sigla_dependencia][item.tipo_actividad] = Number(item.cantidad);
      tiposSet.add(item.tipo_actividad);
    });

    return { data: Object.values(grouped), keys: Array.from(tiposSet) };
  };

  const getMergedDepData = () => {
    const depsMap: { [key: string]: any } = {};
    const initDep = (sigla: string) => {
        if (!depsMap[sigla]) depsMap[sigla] = { sigla, proyectos: 0, objetivos: 0, cumplimiento: 0, insumos: 0, capacitados: 0, documentos: 0 };
    };

    metricasAvanzadas.proyectos_por_dep?.forEach((d: any) => { initDep(d.sigla_dependencia); depsMap[d.sigla_dependencia].proyectos = Number(d.cantidad); });
    metricasAvanzadas.objetivos_por_dep?.forEach((d: any) => { initDep(d.sigla_dependencia); depsMap[d.sigla_dependencia].objetivos = Number(d.cantidad); });
    metricasAvanzadas.cumplimiento_por_dep?.forEach((d: any) => { initDep(d.sigla_dependencia); depsMap[d.sigla_dependencia].cumplimiento = Number(d.cumplimiento); });
    metricasAvanzadas.insumos_por_dep?.forEach((d: any) => { initDep(d.sigla_dependencia); depsMap[d.sigla_dependencia].insumos = Number(d.cumplimiento); });
    metricasAvanzadas.capacitados_por_dep?.forEach((d: any) => { initDep(d.sigla_dependencia); depsMap[d.sigla_dependencia].capacitados = Number(d.cantidad); });
    metricasAvanzadas.documentos_por_dep?.forEach((d: any) => { initDep(d.sigla_dependencia); depsMap[d.sigla_dependencia].documentos = Number(d.cantidad); });

    return Object.values(depsMap);
  };

  const distData = formatDistribucionData();
  const mergedChartData = getMergedDepData();

  const renderTree = (nodes: Dependencia[]) => (
    <ul className="space-y-1 ml-4">
      {nodes.map(node => (
        <li key={node.sigla} className="space-y-1">
          <div className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${selectedDep === node.sigla ? 'bg-primary/10 border-l-4 border-primary text-primary' : 'hover:bg-stone-100'}`} onClick={() => handleDepClick(node.sigla)}>
            {node.children && node.children.length > 0 ? (
              <div onClick={(e) => toggleExpand(e, node.sigla)} className="p-1 hover:bg-stone-200 rounded text-stone-500 hover:text-stone-800 transition-colors">
                {expanded[node.sigla] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            ) : <div className="w-6" />}
            <Building2 className={`h-4 w-4 shrink-0 ${selectedDep === node.sigla ? 'text-primary' : 'text-stone-400'}`} />
            <span className="text-sm font-medium">{node.sigla} - {node.descripcion}</span>
          </div>
          {node.children && node.children.length > 0 && expanded[node.sigla] && renderTree(node.children)}
        </li>
      ))}
    </ul>
  )

  if (loading) return <DashboardLayout currentSection="Tablero de Control"><div className="p-8 text-center text-stone-500 animate-pulse">Cargando tablero...</div></DashboardLayout>

  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Tablero de Control">
              <div className="flex flex-col items-center justify-center h-[60vh] text-stone-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-stone-800">Acceso Denegado</h2>
                  <p>No tenés permisos para visualizar el módulo de Planificación.</p>
              </div>
          </DashboardLayout>
      );
  }

  const avanceGlobalNum = parseFloat(metricas.avancePromedio.replace('%', '')) || 0;

  return (
    <DashboardLayout currentSection="Tablero de Control">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                {mostrarGlobal ? <LayoutDashboard className="h-5 w-5 text-primary"/> : <Building2 className="h-5 w-5 text-primary"/>}
                {mostrarGlobal 
                    ? (hasGlobalAccess ? "Visión Global SSRSyA" : "Visión Global (Mis Áreas Asignadas)") 
                    : `Dependencia: ${selectedDep}`}
            </h2>
            <p className="text-sm text-stone-500">Métricas y proyectos en tiempo real</p>
          </div>
          
          <Sheet open={isOrgSheetOpen} onOpenChange={setIsOrgSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors shadow-sm"><Filter className="h-4 w-4 mr-2" />Explorar Áreas</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[400px] flex flex-col p-0">
              <SheetHeader className="p-6 border-b bg-stone-50"><SheetTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Seleccionar Vista</SheetTitle></SheetHeader>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <>
                      <Button variant="ghost" onClick={handleKPIClick} className={`w-full justify-start mb-4 ${mostrarGlobal ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-stone-600 hover:bg-stone-100'}`}>
                          <Building2 className="h-4 w-4 mr-2" />Visión Global
                      </Button>
                      <div className="pr-2">{renderTree(dependencias)}</div>
                  </>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <Tabs defaultValue="proyectos" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 h-auto gap-2 bg-stone-100 p-1 rounded-xl">
            <TabsTrigger value="proyectos" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow py-3">
               <FolderKanban className="h-4 w-4 mr-2" /> Visión General
            </TabsTrigger>
            <TabsTrigger value="comparativo" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow py-3">
               <PieChart className="h-4 w-4 mr-2" /> Análisis Comparativo
            </TabsTrigger>
            <TabsTrigger value="actividades" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow py-3">
               <Activity className="h-4 w-4 mr-2" /> Detalle de Actividades
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proyectos" className="space-y-6 focus-visible:outline-none">
            
            <div className="relative w-full max-w-2xl mx-auto">
                <Search className={`absolute left-4 top-3.5 h-5 w-5 ${isSearching ? 'text-primary animate-pulse' : 'text-stone-400'}`} />
                <Input 
                    placeholder="Búsqueda profunda: proyectos, objetivos, actividades o indicadores..." 
                    className="pl-12 py-6 text-base bg-white shadow-sm border-stone-200 focus-visible:ring-primary rounded-full" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>

            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <Card className={`transition-all bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 aspect-square flex flex-col cursor-pointer hover:shadow-md hover:-translate-y-1`} onClick={handleKPIClick}>
                <CardContent className="flex flex-col items-center justify-center h-full p-2 text-center"><FolderKanban className="h-6 w-6 text-primary mb-2 shrink-0" /><p className="text-xs lg:text-sm font-medium text-stone-700 mb-1 lg:mb-2 leading-tight">Proyectos</p><div className="text-2xl lg:text-4xl font-bold text-primary">{metricas.cantidadProyectos}</div></CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-1 bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-200 aspect-square flex flex-col" onClick={() => navigate(selectedDep ? `/objetivos-especificos?sigla=${selectedDep}` : `/objetivos-especificos`)}>
                <CardContent className="flex flex-col items-center justify-center h-full p-2 text-center"><Target className="h-6 w-6 text-emerald-600 mb-2 shrink-0" /><p className="text-xs lg:text-sm font-medium text-stone-700 mb-1 lg:mb-2 leading-tight">Obj. Específicos</p><div className="text-2xl lg:text-4xl font-bold text-emerald-700">{metricas.cantidadObjetivosEspecificos}</div></CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-1 bg-gradient-to-br from-purple-50 to-purple-100/60 border-purple-200 aspect-square flex flex-col" onClick={() => navigate(selectedDep ? `/actividades?sigla=${selectedDep}` : `/actividades`)}>
                <CardContent className="flex flex-col items-center justify-center h-full p-2 text-center"><ListChecks className="h-6 w-6 text-purple-600 mb-2 shrink-0" /><p className="text-xs lg:text-sm font-medium text-stone-700 mb-1 lg:mb-2 leading-tight">Actividades</p><div className="text-2xl lg:text-4xl font-bold text-purple-700">{metricas.cantidadActividades}</div></CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-1 bg-gradient-to-br from-orange-50 to-orange-100/60 border-orange-200 aspect-square flex flex-col" onClick={() => navigate(selectedDep ? `/indicadores?sigla=${selectedDep}` : `/indicadores`)}>
                <CardContent className="flex flex-col items-center justify-center h-full p-2 text-center"><BarChart3 className="h-6 w-6 text-orange-600 mb-2 shrink-0" /><p className="text-xs lg:text-sm font-medium text-stone-700 mb-1 lg:mb-2 leading-tight">Indicadores</p><div className="text-2xl lg:text-4xl font-bold text-orange-700">{metricas.cantidadIndicadores}</div></CardContent>
            </Card>
            
            <Card className={`cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 bg-gradient-to-br aspect-square flex flex-col border ${getKpiCardClass(avanceGlobalNum)}`} onClick={() => setIsChartModalOpen(true)}>
                <CardContent className="flex flex-col items-center justify-center h-full p-2 text-center">
                <TrendingUp className={`h-6 w-6 mb-2 shrink-0 ${getKpiIconClass(avanceGlobalNum)}`} />
                <p className="text-xs lg:text-sm font-medium text-stone-700 mb-1 lg:mb-2 leading-tight">Avance</p>
                <div className={`text-2xl lg:text-4xl font-bold ${getKpiTextClass(avanceGlobalNum)}`}>{metricas.avancePromedio}</div>
                </CardContent>
            </Card>
            </div>

            <Card id="grilla-proyectos-dashboard" className="animate-in fade-in slide-in-from-bottom-2 duration-300 border-stone-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-stone-100 bg-stone-50/50 pb-4">
                <CardTitle className="text-lg text-stone-800">
                    {mostrarGlobal ? "Todos los Proyectos" : `Proyectos: ${selectedDep}`}
                    {debouncedSearch && <span className="ml-2 text-sm font-normal text-primary bg-primary/10 px-2 py-1 rounded-md">Filtrados</span>}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                {((selectedDep && (!proyectos[selectedDep] || proyectos[selectedDep].length === 0)) || (mostrarGlobal && allProyectos.length === 0)) ? (
                <div className="text-center py-12 text-stone-400 flex flex-col items-center"><FolderKanban className="h-12 w-12 opacity-20 mb-4" /><p>No hay proyectos registrados en esta selección.</p></div>
                ) : (
                <div className="overflow-x-auto rounded-md border border-stone-200">
                    <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="p-4 text-center text-sm font-semibold text-stone-700 w-[8%]">Dep.</th>
                        <th className="p-4 text-sm font-semibold text-stone-700 w-[27%]">Descripción del Proyecto</th>
                        <th className="p-4 text-sm font-semibold text-stone-700 w-[30%]">Objetivo General</th>
                        <th className="p-4 text-center text-sm font-semibold text-stone-700 w-[10%]">Avance</th>
                        <th className="p-4 text-center text-sm font-semibold text-stone-700 w-[15%]">Estado</th>
                        <th className="p-4 text-center text-sm font-semibold text-stone-700 w-[10%]">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {(mostrarGlobal ? allProyectos : proyectos[selectedDep || ""]).map((proyecto) => {
                        const isAprobado = proyecto.estado_proyecto === 3 || proyecto.estado_workflow_desc === 'Aprobado';
                        const avanceVal = metricas.proyectos_avance?.find(pa => String(pa.nombre).trim() === String(proyecto.proyecto_descripcion).trim())?.avance ?? 0;

                        return (
                            <tr key={proyecto.id_proyecto} className="hover:bg-stone-50 transition-colors">
                            <td className="p-4 text-center align-top">
                                <span className="text-[11px] bg-primary/10 text-primary px-2 py-1 rounded font-bold inline-block uppercase border border-primary/20">
                                    {proyecto.sigla_dependencia || "-"}
                                </span>
                            </td>
                            <td className="p-4 text-sm align-top break-words whitespace-normal text-stone-800 font-medium">{proyecto.proyecto_descripcion}</td>
                            <td className="p-4 text-sm align-top break-words whitespace-normal text-stone-600">{proyecto.og_descripcion || <span className="text-stone-400 italic">Sin objetivo general</span>}</td>
                            
                            <td className="p-4 text-center align-top">
                                {isAprobado ? (
                                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold border ${getBadgeAvanceClass(avanceVal)}`}>
                                        {avanceVal}%
                                    </span>
                                ) : (
                                    <span className="inline-block px-2 py-1 rounded text-[11px] font-semibold bg-stone-100 text-stone-400 border border-stone-200">
                                        N/A
                                    </span>
                                )}
                            </td>

                            <td className="p-4 text-center align-top">
                                <span className="px-2 py-1 bg-stone-100 rounded text-xs font-semibold text-stone-600 border border-stone-200">
                                    {proyecto.estado_workflow_desc || 'Desconocido'}
                                </span>
                            </td>
                            <td className="p-4 text-center align-top">
                                <Link to={`/proyecto-detalle/${proyecto.id_proyecto}`}>
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10 border-stone-200"><Eye className="h-4 w-4" /></Button>
                                </Link>
                            </td>
                            </tr>
                        )
                        })}
                    </tbody>
                    </table>
                </div>
                )}
            </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comparativo" className="space-y-6 focus-visible:outline-none animate-in fade-in duration-500">
             {mergedChartData.length === 0 ? (
                 <Card className="border-dashed border-2 border-stone-200 shadow-none bg-stone-50/50">
                    <CardContent className="flex flex-col items-center justify-center py-24 text-stone-500">
                        <PieChart className="h-16 w-16 mb-4 text-stone-300" />
                        <h3 className="text-xl font-semibold text-stone-700">Sin datos para comparar</h3>
                        <p className="max-w-md text-center mt-2">No hay proyectos aprobados que cumplan con los criterios en la selección actual.</p>
                    </CardContent>
                 </Card>
             ) : (
                 <>
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <Card className="border border-stone-200 shadow-sm bg-white">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                            <p className="text-sm font-medium text-stone-500 mb-1">Personas Capacitadas</p>
                            <h3 className="text-3xl font-bold text-primary">
                                {metricasAvanzadas.capacitados_por_dep?.reduce((acc: number, curr: any) => acc + Number(curr.cantidad), 0) || 0}
                            </h3>
                            <p className="text-xs text-stone-400 mt-1">Acumulado total de metas alcanzadas</p>
                            </div>
                            <div className="p-4 bg-primary/10 rounded-full text-primary"><Users className="h-8 w-8" /></div>
                        </CardContent>
                        </Card>

                        <Card className="border border-stone-200 shadow-sm bg-white">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                            <p className="text-sm font-medium text-stone-500 mb-1">Guías / Documentos / Protocolos</p>
                            <h3 className="text-3xl font-bold text-emerald-700">
                                {metricasAvanzadas.documentos_por_dep?.reduce((acc: number, curr: any) => acc + Number(curr.cantidad), 0) || 0}
                            </h3>
                            <p className="text-xs text-stone-400 mt-1">Acumulado total de metas alcanzadas</p>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-full text-emerald-600"><FileText className="h-8 w-8" /></div>
                        </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                        
                        <Card className="border border-stone-200 shadow-sm col-span-1 lg:col-span-2">
                        <CardHeader className="border-b border-stone-100 bg-stone-50/50">
                            <CardTitle className="text-lg text-stone-800">1. Cantidad de Proyectos y Objetivos por Dependencia</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={mergedChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="sigla" tick={{fontSize: 12, fill: '#78716c'}} />
                                        <YAxis />
                                        <RechartsTooltip cursor={{fill: '#f5f5f4'}} />
                                        <Legend />
                                        <Bar dataKey="proyectos" name="Proyectos" fill="#a22564" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="objetivos" name="Objetivos Específicos" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                        </Card>

                        <Card className="border border-stone-200 shadow-sm col-span-1 lg:col-span-2">
                        <CardHeader className="border-b border-stone-100 bg-stone-50/50">
                            <CardTitle className="text-lg text-stone-800">2. % de Actividades según Tipo (Composición)</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="h-[400px] w-full">
                                {distData.data.length === 0 ? (
                                    <div className="flex h-full items-center justify-center text-stone-400 italic">No hay datos de actividades.</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={distData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical" stackOffset="expand">
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" tickFormatter={(tick) => `${(tick * 100).toFixed(0)}%`} />
                                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fill: '#78716c'}} />
                                            <RechartsTooltip formatter={(value: number, name: string) => [`${value} Actividades`, name]} cursor={{fill: '#f5f5f4'}} />
                                            <Legend />
                                            {distData.keys.map((key, index) => (
                                                <Bar key={key} dataKey={key} stackId="a" fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </CardContent>
                        </Card>

                        <Card className="border border-stone-200 shadow-sm">
                        <CardHeader className="border-b border-stone-100 bg-stone-50/50">
                            <CardTitle className="text-lg text-stone-800">3. Grado de Cumplimiento (%)</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={mergedChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="sigla" tick={{fontSize: 12, fill: '#78716c'}} />
                                        <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                                        <RechartsTooltip cursor={{fill: '#f5f5f4'}} formatter={(val: number) => [`${val}%`, '']} />
                                        <Legend />
                                        <Bar dataKey="cumplimiento" name="% Cumplimiento Gral" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="insumos" name="% Entrega Insumos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                        </Card>

                        <Card className="border border-stone-200 shadow-sm">
                        <CardHeader className="border-b border-stone-100 bg-stone-50/50">
                            <CardTitle className="text-lg text-stone-800">4. Capacitación y Producción Documental</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={mergedChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="sigla" tick={{fontSize: 12, fill: '#78716c'}} />
                                        <YAxis />
                                        <RechartsTooltip cursor={{fill: '#f5f5f4'}} />
                                        <Legend />
                                        <Bar dataKey="capacitados" name="Personas Capacitadas" fill="#ec4899" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="documentos" name="Guías/Documentos" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                        </Card>

                    </div>
                 </>
             )}
          </TabsContent>

          <TabsContent value="actividades" className="focus-visible:outline-none">
             <Card className="border-dashed border-2 border-stone-200 shadow-none bg-stone-50/50">
                <CardContent className="flex flex-col items-center justify-center py-24 text-stone-500">
                    <Activity className="h-16 w-16 mb-4 text-stone-300" />
                    <h3 className="text-xl font-semibold text-stone-700">Módulo Analítico en Construcción</h3>
                    <p className="max-w-md text-center mt-2">Aquí implementaremos la matriz interactiva de gráficos facetados y tablas dinámicas de actividades.</p>
                </CardContent>
             </Card>
          </TabsContent>

        </Tabs>

        <Dialog open={isChartModalOpen} onOpenChange={setIsChartModalOpen}>
            <DialogContent className="sm:max-w-[700px] w-[95vw]">
                <DialogHeader>
                    <DialogTitle className="text-xl text-stone-800">Composición del Avance</DialogTitle>
                </DialogHeader>
                <div className="h-[400px] w-full mt-4">
                    {(!metricas.proyectos_avance || metricas.proyectos_avance.length === 0) ? (
                        <div className="flex h-full items-center justify-center text-stone-400 italic">No hay proyectos aprobados en curso en esta selección.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metricas.proyectos_avance} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                                <YAxis dataKey="nombre" type="category" width={180} tick={{fontSize: 11, fill: '#78716c'}} />
                                <RechartsTooltip cursor={{fill: '#f5f5f4'}} formatter={(value: number) => [`${value}%`, 'Avance Promedio']} />
                                <Bar dataKey="avance" radius={[0, 4, 4, 0]} name="Avance del Proyecto" barSize={25}>
                                    {metricas.proyectos_avance.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getColorAvance(entry.avance)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  )
}