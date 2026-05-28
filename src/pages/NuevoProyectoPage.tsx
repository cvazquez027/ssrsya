import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, PlusCircle, ShieldAlert } from "lucide-react"

const API_BASE = "http://localhost/planificacion/api-backend";

interface Prioridad { id_prioridad: number; descripcion: string; }
interface EstadoOrigen { id_estado: number; descripcion: string; }
interface Referente { id_referente: number; nombre: string; apellido: string; sigla: string; }

export default function NuevoProyectoPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  
  // --- CIRUGÍA ---
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  const [loading, setLoading] = useState(false)
  const [userSigla, setUserSigla] = useState("")
  const [userRol, setUserRol] = useState("")
  
  const [prioridades, setPrioridades] = useState<Prioridad[]>([])
  const [estadosOrigen, setEstadosOrigen] = useState<EstadoOrigen[]>([])
  const [referentes, setReferentes] = useState<Referente[]>([])
  const [dependencias, setDependencias] = useState<any[]>([])

  const [formData, setFormData] = useState({
    descripcion: "",
    objetivo_general: "",
    id_prioridad: "",
    id_estado: "",
    id_referente: "",
    sigla_dependencia: ""
  })

  useEffect(() => {
    fetchSession()
    fetchCombos()
  }, [])

  const fetchSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' });
      const data = await res.json();
      
      if (data.id) {
        const rolPlanificacion = data.permisos?.['PLANIFICACION'];
        
        // Bloqueamos si no tiene permiso, o si su rol no le permite crear
        if (!rolPlanificacion || rolPlanificacion === 'consulta' || rolPlanificacion === 'autorizante') {
            setAccesoDenegado(true);
            return;
        }

        setUserSigla(data.sigla);
        // CIRUGÍA: Guardamos el rol específico del módulo en lugar del global
        setUserRol(rolPlanificacion); 
        setFormData(prev => ({ ...prev, sigla_dependencia: data.sigla }));
      }
    } catch (e) { console.error(e); }
  }

  const fetchCombos = async () => {
    try {
      const res = await fetch(`${API_BASE}/opciones_proyecto.php`);
      const data = await res.json();
      setPrioridades(data.prioridades || []);
      setEstadosOrigen(data.estados || []);
      setReferentes(data.referentes || []);
      setDependencias(data.dependencias || []);
    } catch (e) { console.error(e); }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.descripcion || !formData.objetivo_general || !formData.id_prioridad || !formData.id_estado || !formData.id_referente || !formData.sigla_dependencia) {
        toast({ title: "Error", description: "Todos los campos con asterisco (*) son obligatorios.", variant: "destructive" });
        return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/crear_proyecto.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Proyecto Creado", description: "El proyecto se guardó correctamente." });
        navigate("/proyectos");
      } else {
        throw new Error(data.error || "No se pudo crear el proyecto");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Nuevo Proyecto">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>No tenés permisos para crear proyectos en este módulo.</p>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout currentSection="Nuevo Proyecto">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/proyectos">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold">Carga de Nuevo Proyecto</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-blue-600" /> Datos Principales
            </CardTitle>
            <CardDescription>Complete la información básica para iniciar la planificación.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dependencia <span className="text-red-500">*</span></Label>
                  <select 
                    className="w-full p-2 border rounded-md bg-white text-sm"
                    value={formData.sigla_dependencia}
                    onChange={(e) => setFormData({...formData, sigla_dependencia: e.target.value})}
                    disabled={userRol !== 'admin' && userRol !== 'cargafull'}
                    required
                  >
                    {dependencias.map(d => (
                      <option key={d.sigla} value={d.sigla}>{d.sigla} - {d.descripcion}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Prioridad <span className="text-red-500">*</span></Label>
                  <select 
                    className="w-full p-2 border rounded-md bg-white text-sm"
                    value={formData.id_prioridad}
                    onChange={(e) => setFormData({...formData, id_prioridad: e.target.value})}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {prioridades.map(p => <option key={p.id_prioridad} value={p.id_prioridad}>{p.descripcion}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estado de Origen <span className="text-red-500">*</span></Label>
                  <select 
                    className="w-full p-2 border rounded-md bg-white text-sm"
                    value={formData.id_estado}
                    onChange={(e) => setFormData({...formData, id_estado: e.target.value})}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {estadosOrigen.map(e => <option key={e.id_estado} value={e.id_estado}>{e.descripcion}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Referente <span className="text-red-500">*</span></Label>
                  <select 
                    className="w-full p-2 border rounded-md bg-white text-sm"
                    value={formData.id_referente}
                    onChange={(e) => setFormData({...formData, id_referente: e.target.value})}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {referentes.map((r) => (
                      <option key={r.id_referente} value={r.id_referente}>
                        {r.apellido}, {r.nombre} ({r.sigla})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Nombre del Proyecto <span className="text-red-500">*</span></Label>
                <Textarea 
                  id="descripcion" 
                  value={formData.descripcion}
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="objetivo">Objetivo General <span className="text-red-500">*</span></Label>
                <Textarea 
                  id="objetivo" 
                  value={formData.objetivo_general}
                  onChange={(e) => setFormData({...formData, objetivo_general: e.target.value})}
                  required
                />
              </div>

              <div className="hidden">
                  <Input value={userSigla} readOnly />
              </div>

              <div className="pt-4">
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                  {loading ? "Guardando..." : "Crear Proyecto"} <Save className="ml-2 h-4 w-4" />
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}