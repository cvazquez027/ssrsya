import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Activity, CheckCircle2, Globe, Clock, Target, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const API_BASE = "http://localhost/planificacion/api-backend";

const COLORES_TIPO = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

export default function ComuDashboardPage() {
  const { toast } = useToast();
  
  // --- CIRUGÍA: Estados de Seguridad ---
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDashboard();
  }, []);

  const cargarDashboard = async () => {
    try {
      // CIRUGÍA: Traemos al usuario para validar si tiene el módulo
      const resUser = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' });
      const userData = await resUser.json();
      
      if (!userData.permisos?.['COMUNICACION']) {
          setAccesoDenegado(true);
          setLoading(false);
          return;
      }

      const resData = await fetch(`${API_BASE}/dashboard_comu.php`, { credentials: 'include' });
      const d = await resData.json();
      
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (error: any) {
      toast({ title: "Error", description: "No se pudieron cargar las métricas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout currentSection="Dashboard de Comunicación">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  // PANTALLA DE ACCESO DENEGADO
  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Dashboard de Comunicación">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>No tenés permisos para visualizar el módulo de Comunicación.</p>
              </div>
          </DashboardLayout>
      );
  }

  if (!data) return null;

  const { kpis, por_tipo, por_estado, indicadores } = data;

  return (
    <DashboardLayout currentSection="Dashboard de Comunicación">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Monitor de Comunicación</h2>
          <p className="text-sm text-slate-500">Métricas y estado general de las actividades comunicacionales.</p>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <Activity className="h-8 w-8 text-blue-500 mb-2" />
              <p className="text-sm font-medium text-slate-600">Actividades Totales</p>
              <h3 className="text-3xl font-bold text-slate-800">{kpis.total_actividades || 0}</h3>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
              <p className="text-sm font-medium text-slate-600">Completadas</p>
              <h3 className="text-3xl font-bold text-slate-800">{kpis.total_cerradas || 0}</h3>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <Clock className="h-8 w-8 text-orange-500 mb-2" />
              <p className="text-sm font-medium text-slate-600">En Curso</p>
              <h3 className="text-3xl font-bold text-slate-800">{kpis.total_en_curso || 0}</h3>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <Globe className="h-8 w-8 text-purple-500 mb-2" />
              <p className="text-sm font-medium text-slate-600">Publicadas</p>
              <h3 className="text-3xl font-bold text-slate-800">{kpis.total_publicadas || 0}</h3>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-base font-bold text-slate-700">Distribución por Tipo de Actividad</CardTitle>
                </CardHeader>
                <CardContent className="p-4 h-[350px] flex items-center justify-center">
                    {por_tipo.length === 0 ? (
                        <div className="text-slate-400 text-sm">No hay datos suficientes</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={por_tipo} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value">
                                    {por_tipo.map((_: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORES_TIPO[index % COLORES_TIPO.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip formatter={(value) => [`${value} act.`, 'Cantidad']} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-base font-bold text-slate-700">Cuello de Botella: Top 10 Estados Activos</CardTitle>
                </CardHeader>
                <CardContent className="p-4 h-[350px]">
                    {por_estado.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">No hay datos suficientes</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={por_estado} margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" tick={{fill: '#475569', fontSize: 11}} width={140} axisLine={false} tickLine={false} />
                                <RechartsTooltip cursor={{fill: '#f1f5f9'}} formatter={(value) => [`${value} act.`, 'Cantidad']} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 lg:col-span-2">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-base font-bold text-slate-700 flex items-center gap-2">
                        <Target className="h-5 w-5 text-blue-600" /> Rendimiento de Indicadores
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 h-[250px]">
                    {indicadores.every((i: any) => i.value === 0) ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">No hay indicadores cargados</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={indicadores} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{fill: '#475569', fontSize: 12, fontWeight: 600}} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                                <RechartsTooltip cursor={{fill: '#f1f5f9'}} formatter={(value) => [`${value} indicadores`, 'Total']} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                                    {indicadores.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

        </div>
      </div>
    </DashboardLayout>
  );
}