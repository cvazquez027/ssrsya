import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, Save, Layers, ShieldAlert } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const API_BASE = "http://localhost/planificacion/api-backend";

export default function ModulosPage() {
  const { toast } = useToast()
  
  // --- CIRUGÍA DE SEGURIDAD ---
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState({ clave: "", descripcion: "" })

  useEffect(() => { 
      verificarSesion().then(tieneAcceso => {
          if (tieneAcceso) fetchModules() 
      })
  }, [])

  const verificarSesion = async () => {
      try {
          const resUser = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' });
          const userData = await resUser.json();
          
          // CIRUGÍA: Validamos permisos en el módulo CONFIG
          const rolConfig = userData.permisos?.['CONFIG'];
          // Generalmente solo los 'admin' pueden crear módulos
          if (!rolConfig || rolConfig !== 'admin') {
              setAccesoDenegado(true);
              setLoading(false);
              return false;
          }
          return true;
      } catch (e) {
          console.error("Error validando sesión:", e);
          return false;
      }
  }

  const fetchModules = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/lista_maestras.php?tabla=modulo`)
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch (e) {
      toast({ title: "Error", description: "No se pudieron cargar los módulos", variant: "destructive" })
    } finally { setLoading(false) }
  }

  const handleOpenDialog = (item: any = null) => {
    setEditingItem(item)
    setFormData(item ? { clave: item.clave, descripcion: item.descripcion } : { clave: "", descripcion: "" })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    const url = `${API_BASE}/gestion_maestras.php?tabla=modulo`
    const method = editingItem ? "PUT" : "POST"
    const payload = editingItem ? { ...formData, id_modulo: editingItem.id_modulo } : formData

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        toast({ title: editingItem ? "Módulo actualizado" : "Módulo creado" })
        setIsDialogOpen(false)
        fetchModules()
      }
    } catch (e) {
      toast({ title: "Error al guardar", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar este módulo?")) return
    try {
      const res = await fetch(`${API_BASE}/gestion_maestras.php?tabla=modulo&id=${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Módulo eliminado" })
        fetchModules()
      }
    } catch (e) {
      toast({ title: "Error al eliminar", variant: "destructive" })
    }
  }

  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Gestión de Módulos">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4 text-center">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>Solo los Administradores Globales pueden gestionar la creación de Módulos del Sistema.</p>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout currentSection="Gestión de Módulos">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" /> Módulos del Sistema
          </CardTitle>
          <Button onClick={() => handleOpenDialog()} size="sm">
            <Plus className="h-4 w-4 mr-2" /> Nuevo Módulo
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clave (Sistema)</TableHead>
                <TableHead>Descripción / Nombre</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center">Cargando...</TableCell></TableRow>
              ) : data.map((m) => (
                <TableRow key={m.id_modulo}>
                  <TableCell className="font-mono text-xs font-bold">{m.clave}</TableCell>
                  <TableCell>{m.descripcion}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(m)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(m.id_modulo)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Editar Módulo" : "Nuevo Módulo"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label>Clave (Ej: COMUNICACION)</Label>
              <Input value={formData.clave} onChange={e => setFormData({ ...formData, clave: e.target.value.toUpperCase() })} placeholder="CLAVE_UNICA" />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Input value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} placeholder="Nombre del módulo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" /> Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}