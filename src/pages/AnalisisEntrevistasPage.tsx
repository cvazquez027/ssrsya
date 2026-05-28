import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Search, FileText, ShieldAlert } from "lucide-react";
import * as XLSX from "xlsx"; 

const API_BASE = "http://localhost/planificacion/api-backend";

interface Fragmento {
  id_fragmento: number;
  codigo_entrevista: string;
  profesion_estudios: string;
  hablante: string;
  texto: string;
  capacidad: string | null;
  dimension: string | null;
  categoria: string | null;
}

export default function AnalisisEntrevistasPage() {
  // --- CIRUGÍA DE SEGURIDAD ---
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  const [data, setData] = useState<Fragmento[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filtroCapacidad, setFiltroCapacidad] = useState("todas");
  const [filtroDimension, setFiltroDimension] = useState("todas");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // CIRUGÍA: Verificamos permisos antes de cargar los datos
      const resUser = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' });
      const userData = await resUser.json();
      if (!userData.permisos?.['ENTREV']) {
          setAccesoDenegado(true);
          setLoading(false);
          return;
      }

      const res = await fetch(`${API_BASE}/analisis_entrevistas.php`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error("Error al cargar datos", error);
    } finally {
      setLoading(false);
    }
  };

  const capacidadesUnicas = useMemo(() => {
    return Array.from(new Set(data.map(item => item.capacidad).filter(Boolean))) as string[];
  }, [data]);

  const dimensionesUnicas = useMemo(() => {
    return Array.from(new Set(
      data
        .filter(item => filtroCapacidad === "todas" || item.capacidad === filtroCapacidad)
        .map(item => item.dimension)
        .filter(Boolean)
    )) as string[];
  }, [data, filtroCapacidad]);

  const dataFiltrada = useMemo(() => {
    return data.filter((item) => {
      const matchSearch = item.texto.toLowerCase().includes(search.toLowerCase()) || 
                          item.codigo_entrevista.toLowerCase().includes(search.toLowerCase());
      const matchCapacidad = filtroCapacidad === "todas" || item.capacidad === filtroCapacidad;
      const matchDimension = filtroDimension === "todas" || item.dimension === filtroDimension;
      
      return matchSearch && matchCapacidad && matchDimension;
    });
  }, [data, search, filtroCapacidad, filtroDimension]);

  const handleExportExcel = () => {
    const datosExcel = dataFiltrada.map(item => ({
      "Entrevista": item.codigo_entrevista,
      "Perfil": item.profesion_estudios || "N/A",
      "Hablante": item.hablante,
      "Capacidad (Nivel 1)": item.capacidad || "Sin clasificar",
      "Dimensión (Nivel 2)": item.dimension || "Sin clasificar",
      "Categoría (Nivel 3)": item.categoria || "Sin clasificar",
      "Fragmento Textual": item.texto
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Análisis Cualitativo");
    XLSX.writeFile(workbook, "Exportacion_Entrevistas.xlsx");
  };

  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Análisis de Entrevistas">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>No tenés permisos para visualizar el módulo de Análisis de Entrevistas.</p>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout currentSection="Análisis de Entrevistas">
      <div className="space-y-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Análisis Cualitativo</h2>
            <p className="text-sm text-slate-500">Filtrá y visualizá los fragmentos categorizados de las entrevistas.</p>
          </div>
          <Button 
            onClick={handleExportExcel} 
            disabled={dataFiltrada.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors shadow-sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar a Excel
          </Button>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 pb-4">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-500" /> Filtros de Búsqueda
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="space-y-1 min-w-0">
                <label className="text-xs font-semibold text-slate-600">Buscar en texto o código</label>
                <Input 
                  placeholder="Ej: Entrevista_01 o palabra clave..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 text-sm focus-visible:ring-blue-500"
                />
              </div>

              <div className="space-y-1 min-w-0">
                <label className="text-xs font-semibold text-slate-600">Capacidad (Nivel 1)</label>
                <Select value={filtroCapacidad} onValueChange={(v) => { setFiltroCapacidad(v); setFiltroDimension("todas"); }}>
                  <SelectTrigger className="h-9 text-sm w-full [&>span]:truncate">
                    <SelectValue placeholder="Todas las capacidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">-- Todas las capacidades --</SelectItem>
                    {capacidadesUnicas.map(cap => (
                      <SelectItem key={cap} value={cap} className="truncate">{cap}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 min-w-0">
                <label className="text-xs font-semibold text-slate-600">Dimensión (Nivel 2)</label>
                <Select 
                  value={filtroDimension} 
                  onValueChange={setFiltroDimension}
                  disabled={filtroCapacidad === "todas"} 
                >
                  <SelectTrigger className="h-9 text-sm w-full [&>span]:truncate">
                    <SelectValue placeholder="Todas las dimensiones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">-- Todas las dimensiones --</SelectItem>
                    {dimensionesUnicas.map(dim => (
                      <SelectItem key={dim} value={dim} className="truncate">{dim}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Resultados: {dataFiltrada.length} fragmentos
            </span>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center text-slate-500 animate-pulse">Cargando base de conocimiento...</div>
            ) : dataFiltrada.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center text-slate-500">
                <FileText className="h-12 w-12 mb-3 text-slate-300" />
                <p>No se encontraron fragmentos que coincidan con los filtros.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-600 uppercase bg-slate-100 sticky top-0 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-32">Entrevista</th>
                    <th className="px-4 py-3 font-semibold">Fragmento & Categorización</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dataFiltrada.map((item) => (
                    <tr key={item.id_fragmento} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 align-top">
                        <div className="font-bold text-slate-800">{item.codigo_entrevista}</div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                            {item.hablante}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="text-slate-700 italic mb-3 leading-relaxed border-l-4 border-slate-300 pl-3">
                          "{item.texto}"
                        </p>
                        {item.capacidad ? (
                          <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-md border border-purple-200">
                              L1: {item.capacidad}
                            </span>
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md border border-indigo-200">
                              L2: {item.dimension}
                            </span>
                            <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded-md border border-teal-200">
                              L3: {item.categoria}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-1 rounded-md">
                            No categorizado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

      </div>
    </DashboardLayout>
  );
}