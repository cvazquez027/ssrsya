import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Pencil, Trash2, Phone, Save, ShieldAlert, Layers } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const API_BASE = "http://localhost/planificacion/api-backend";

export default function MaestrasPage() {
  const { toast } = useToast()
  
  // --- CIRUGÍA DE SEGURIDAD ---
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  const [userRol, setUserRol] = useState("")
  const [userSigla, setUserSigla] = useState("")
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [activeTab, setActiveTab] = useState("dependencia")
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editData, setEditData] = useState<any>({})
  
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [currentReferente, setCurrentReferente] = useState<any>(null)
  const [editContact, setEditContact] = useState<any>({})

  const [auxDependencias, setAuxDependencias] = useState<any[]>([])
  const [auxReferentes, setAuxReferentes] = useState<any[]>([])

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    if (!checkingAuth && userRol !== 'autorizante' && !accesoDenegado) {
        fetchData(activeTab)
        if (['dependencia', 'referente'].includes(activeTab)) {
            fetchAuxiliares()
        }
    }
  }, [activeTab, checkingAuth, accesoDenegado])

  const fetchUser = async () => {
    try {
        const res = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' })
        const userData = await res.json()
        
        // CIRUGÍA: Validamos permisos en el módulo CONFIG
        const rolConfig = userData.permisos?.['CONFIG'];
        if (!rolConfig) {
            setAccesoDenegado(true);
            setCheckingAuth(false);
            return;
        }

        setUserRol(rolConfig)
        setUserSigla(userData.sigla || "")
        if (rolConfig === 'carga') setActiveTab('referente')
    } catch (e) { console.error(e) } 
    finally { setCheckingAuth(false) }
  }

  const fetchAuxiliares = async () => {
      if (userRol === 'carga') return; 
      try {
          const resDep = await fetch(`${API_BASE}/lista_maestras.php?tabla=dependencia`, { credentials: 'include' })
          if (resDep.ok) {
              const dataDep = await resDep.json();
              if (Array.isArray(dataDep)) setAuxDependencias(dataDep);
          }
          const resRef = await fetch(`${API_BASE}/lista_maestras.php?tabla=referente`, { credentials: 'include' })
          if (resRef.ok) {
              const dataRef = await resRef.json();
              if (Array.isArray(dataRef)) setAuxReferentes(dataRef);
          }
      } catch (e) {}
  }

  const fetchData = async (tabla: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/lista_maestras.php?tabla=${tabla}`, { credentials: 'include' })
      if (!res.ok) throw new Error("Error en petición");
      const jsonData = await res.json()
      setData(Array.isArray(jsonData) ? jsonData : [])
    } catch (e) {
      toast({ title: "Error", description: "No se pudieron cargar los datos", variant: "destructive" })
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const fetchContacts = async (idRef: number) => {
      try {
          const res = await fetch(`${API_BASE}/lista_maestras.php?tabla=datos_contacto&id=${idRef}`, { credentials: 'include' })
          if (res.ok) {
              const jsonData = await res.json();
              setContacts(Array.isArray(jsonData) ? jsonData : []);
          }
      } catch (e) { console.error(e) }
  }

  const handleDelete = async (id: any, pkField: string) => {
      if (!confirm("¿Eliminar registro?")) return;
      try {
          const res = await fetch(`${API_BASE}/abm_maestras.php`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              credentials: 'include',
              body: JSON.stringify({ tabla: activeTab, id, pk_field: pkField })
          })
          const json = await res.json();
          if (res.ok) fetchData(activeTab)
          else toast({ title: "No se pudo borrar", description: json.error || "Asegúrese de que no esté en uso", variant: "destructive" })
      } catch (e) { toast({ title: "Error al borrar", variant: "destructive" }) }
  }

  const handleSave = async () => {
      try {
          const payload = { ...editData, tabla: activeTab };
          if (userRol === 'carga' && activeTab === 'referente') {
              payload.sigla = userSigla;
          }

          const res = await fetch(`${API_BASE}/abm_maestras.php`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: 'include',
              body: JSON.stringify(payload)
          })
          const json = await res.json();
          if (res.ok) {
              toast({ title: "Guardado exitoso" })
              setIsModalOpen(false)
              fetchData(activeTab)
              if (userRol !== 'carga') fetchAuxiliares()
          } else {
              throw new Error(json.error || "Error al guardar")
          }
      } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }) }
  }

  const openContacts = (ref: any) => {
      setCurrentReferente(ref)
      fetchContacts(ref.id_referente)
      setEditContact({ id_datos_contacto: 0, telefono: "", correo_electronico: "", direccion: "", vigente: 1 })
      setContactModalOpen(true)
  }

  const handleSaveContact = async () => {
      try {
          const body = { ...editContact, tabla: 'datos_contacto', id_referente: currentReferente.id_referente };
          const res = await fetch(`${API_BASE}/abm_maestras.php`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: 'include',
              body: JSON.stringify(body)
          })
          if (res.ok) {
              toast({ title: "Contacto guardado" })
              fetchContacts(currentReferente.id_referente)
              setEditContact({ id_datos_contacto: 0, telefono: "", correo_electronico: "", direccion: "", vigente: 1 })
          } else {
              toast({ title: "Error al guardar", variant: "destructive" })
          }
      } catch (e) { toast({ title: "Error al guardar contacto", variant: "destructive" }) }
  }

  const editExistingContact = (c: any) => setEditContact(c)

  const handleNew = () => {
      switch (activeTab) {
          case 'dependencia': setEditData({ sigla: "", descripcion: "", sigla_superior: "", id_referente: "", vigente: 1, es_alta: true }); break;
          case 'referente': setEditData({ id_referente: 0, nombre: "", apellido: "", cuil: "", sigla: userRol === 'carga' ? userSigla : "" }); break;
          case 'modulo': setEditData({ id_modulo: 0, descripcion: "", clave: "", vigente: 1 }); break;
          case 'tipo_indicador': setEditData({ id_tipo_indicador: 0, nombre: "", descripcion: "" }); break; 
          case 'categoria': setEditData({ id_categoria: 0, nombre: "", detalle: "", vigente: 1 }); break; 
          case 'tipo_actividad_prioritaria': setEditData({ id_tipo_actividad_prioritaria: 0, descripcion: "" }); break; 
          default: setEditData({ [`id_${activeTab}`]: 0, descripcion: "" }); break;
      }
      setIsModalOpen(true)
  }

  const renderModalContent = () => {
      if (activeTab === 'modulo') {
          return (
              <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                      <Label>Nombre del Módulo</Label>
                      <Input value={editData.descripcion} onChange={e => setEditData({...editData, descripcion: e.target.value})} placeholder="Ej: Recursos Humanos" />
                  </div>
                  <div className="space-y-2">
                      <Label>Clave Interna (Código único)</Label>
                      <Input value={editData.clave} onChange={e => setEditData({...editData, clave: e.target.value.toUpperCase()})} placeholder="Ej: RRHH" />
                      <p className="text-[10px] text-gray-500">Usado por el sistema para verificar permisos.</p>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                      <Checkbox checked={editData.vigente == 1} onCheckedChange={(c) => setEditData({...editData, vigente: c ? 1 : 0})} />
                      <Label>Vigente</Label>
                  </div>
              </div>
          )
      }

      if (activeTab === 'tipo_indicador') { 
          return (
              <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                      <Label>Nombre del Tipo</Label>
                      <Input value={editData.nombre} onChange={e => setEditData({...editData, nombre: e.target.value})} placeholder="Ej: Proceso" />
                  </div>
                  <div className="space-y-2">
                      <Label>Descripción detallada</Label>
                      <Input value={editData.descripcion} onChange={e => setEditData({...editData, descripcion: e.target.value})} placeholder="Explicación del tipo..." />
                  </div>
              </div>
          )
      }

      if (activeTab === 'categoria') { 
          return (
              <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                      <Label>Nombre del Proyecto Integrado</Label>
                      <Input value={editData.nombre} onChange={e => setEditData({...editData, nombre: e.target.value})} placeholder="Ej: Eje Transversal..." />
                  </div>
                  <div className="space-y-2">
                      <Label>Detalle / Descripción</Label>
                      <Input value={editData.detalle} onChange={e => setEditData({...editData, detalle: e.target.value})} placeholder="Explicación de la categoría..." />
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                      <Checkbox checked={editData.vigente == 1} onCheckedChange={(c) => setEditData({...editData, vigente: c ? 1 : 0})} />
                      <Label>Vigente</Label>
                  </div>
              </div>
          )
      }

      if (userRol === 'carga' && activeTab === 'referente') {
          return (
              <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Nombre</Label><Input value={editData.nombre} onChange={e => setEditData({...editData, nombre: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Apellido</Label><Input value={editData.apellido} onChange={e => setEditData({...editData, apellido: e.target.value})} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>CUIL</Label><Input value={editData.cuil} onChange={e => setEditData({...editData, cuil: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Dependencia</Label><Input value={userSigla} disabled className="bg-muted text-muted-foreground" /></div>
                  </div>
              </div>
          )
      }

      switch (activeTab) {
          case 'dependencia':
              return (
                  <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>Sigla</Label><Input value={editData.sigla} onChange={e => setEditData({...editData, sigla: e.target.value})} disabled={!editData.es_alta} /></div>
                          <div className="space-y-2"><Label>Vigente</Label><div className="flex items-center space-x-2 mt-2"><Checkbox checked={editData.vigente == 1} onCheckedChange={(c) => setEditData({...editData, vigente: c ? 1 : 0})} /><span>{editData.vigente ? 'Sí' : 'No'}</span></div></div>
                      </div>
                      <div className="space-y-2"><Label>Dependencia</Label><Input value={editData.descripcion} onChange={e => setEditData({...editData, descripcion: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Dep. Superior</Label><Select value={editData.sigla_superior || "0"} onValueChange={v => setEditData({...editData, sigla_superior: v === "0" ? null : v})}><SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger><SelectContent><SelectItem value="0">Ninguna</SelectItem>{auxDependencias.map(d => <SelectItem key={d.sigla} value={d.sigla}>{d.sigla} - {d.descripcion}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label>Autoridad</Label><Select value={String(editData.id_referente || "0")} onValueChange={v => setEditData({...editData, id_referente: v === "0" ? null : v})}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent><SelectItem value="0">Sin asignar</SelectItem>{auxReferentes.map(r => <SelectItem key={r.id_referente} value={String(r.id_referente)}>{r.apellido}, {r.nombre}</SelectItem>)}</SelectContent></Select></div>
                  </div>
              )
          case 'referente':
              return (
                  <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>Nombre</Label><Input value={editData.nombre} onChange={e => setEditData({...editData, nombre: e.target.value})} /></div>
                          <div className="space-y-2"><Label>Apellido</Label><Input value={editData.apellido} onChange={e => setEditData({...editData, apellido: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>CUIL</Label><Input value={editData.cuil} onChange={e => setEditData({...editData, cuil: e.target.value})} /></div>
                          <div className="space-y-2"><Label>Dependencia</Label><Select value={editData.sigla || ""} onValueChange={v => setEditData({...editData, sigla: v})}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{auxDependencias.map(d => <SelectItem key={d.sigla} value={d.sigla}>{d.sigla}</SelectItem>)}</SelectContent></Select></div>
                      </div>
                  </div>
              )
          default:
              return (
                  <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label>Descripción</Label><Input value={editData.descripcion} onChange={e => setEditData({...editData, descripcion: e.target.value})} /></div>
                  </div>
              )
      }
  }

  // PANTALLA DE ACCESO DENEGADO GENERAL AL MÓDULO
  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Tablas Maestras">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4 text-center">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>No tenés permisos para visualizar la Configuración del Sistema.</p>
              </div>
          </DashboardLayout>
      );
  }

  // BLOQUEO ESPECÍFICO DE ROL AUTORIZANTE (Lógica que ya tenías)
  if (!checkingAuth && userRol === 'autorizante') {
      return (
          <DashboardLayout currentSection="Tablas Maestras">
              <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800">Acceso Restringido</h2>
                  <p className="text-gray-500 mt-2">Su rol de Autorizante no tiene permisos para ver esta sección.</p>
              </div>
          </DashboardLayout>
      )
  }

  return (
    <DashboardLayout currentSection="Tablas Maestras">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">Configuración del Sistema</h2>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`flex flex-wrap h-auto w-full mb-4 gap-1 p-1 bg-slate-100 ${userRol === 'carga' ? 'w-[200px]' : ''}`}>
                {userRol !== 'carga' && <TabsTrigger value="dependencia">Dependencias</TabsTrigger>}
                <TabsTrigger value="referente">Referentes</TabsTrigger>
                {userRol !== 'carga' && (
                    <>
                        <TabsTrigger value="modulo" className="flex items-center gap-2"><Layers className="h-3 w-3"/> Módulos</TabsTrigger>
                        <TabsTrigger value="categoria">Proyectos Int.</TabsTrigger>
                        <TabsTrigger value="tipo_indicador">T. Indicador</TabsTrigger>
                        <TabsTrigger value="tipo_actividad_prioritaria">T. Actividad</TabsTrigger>
                        <TabsTrigger value="estado">Estados</TabsTrigger>
                        <TabsTrigger value="prioridad">Prioridades</TabsTrigger>
                        <TabsTrigger value="periodo_monitoreo">Periodos</TabsTrigger>
                        <TabsTrigger value="otro_sistema">Sistemas</TabsTrigger>
                    </>
                )}
            </TabsList>

            <div className="flex justify-end mb-4">
                <Button size="sm" onClick={handleNew} className="bg-blue-600 shadow-sm"><Plus className="mr-2 h-4 w-4"/> Nuevo Registro</Button>
            </div>

            <Card className="shadow-sm">
                <CardContent className="p-0">
                    <Table className="table-fixed w-full">
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                {activeTab === 'modulo' && <><TableHead className="w-[40%]">Módulo</TableHead><TableHead className="w-[40%]">Clave</TableHead><TableHead className="w-[20%]">Vigente</TableHead></>}
                                {activeTab === 'tipo_indicador' && <><TableHead className="w-[30%]">Tipo</TableHead><TableHead className="w-[60%]">Descripción</TableHead></>}
                                {activeTab === 'categoria' && <><TableHead className="w-[30%]">Nombre</TableHead><TableHead className="w-[45%]">Detalle</TableHead><TableHead className="w-[10%] text-center">Vigente</TableHead></>}
                                {activeTab === 'dependencia' && <><TableHead className="w-[15%]">Sigla</TableHead><TableHead className="w-[30%]">Dependencia</TableHead><TableHead className="w-[20%]">Superior</TableHead><TableHead className="w-[20%]">Autoridad</TableHead><TableHead className="w-[15%] text-center">Vigente</TableHead></>}
                                {activeTab === 'referente' && <><TableHead className="w-[30%]">Nombre Completo</TableHead><TableHead className="w-[25%]">CUIL</TableHead><TableHead className="w-[20%]">Dependencia</TableHead><TableHead className="w-[25%] text-center">Contactos</TableHead></>}
                                {!['dependencia','referente','modulo','tipo_indicador','categoria'].includes(activeTab) && <><TableHead className="w-[15%]">ID</TableHead><TableHead className="w-[85%]">Descripción</TableHead></>}
                                <TableHead className="w-[100px] text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                            ) : data.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">No hay registros.</TableCell></TableRow>
                            ) : data.map((row, i) => (
                                <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                                    {activeTab === 'modulo' && (<><TableCell className="font-bold">{row.descripcion}</TableCell><TableCell><span className="font-mono text-xs bg-slate-100 p-1 rounded border">{row.clave}</span></TableCell><TableCell>{row.vigente == 1 ? "SI" : "NO"}</TableCell></>)}
                                    {activeTab === 'tipo_indicador' && (<><TableCell className="font-bold align-top whitespace-normal">{row.nombre}</TableCell><TableCell className="text-sm text-slate-600 align-top whitespace-normal break-words">{row.descripcion}</TableCell></>)}
                                    {activeTab === 'categoria' && (<><TableCell className="font-bold align-top whitespace-normal">{row.nombre}</TableCell><TableCell className="text-sm text-slate-600 align-top whitespace-normal break-words">{row.detalle}</TableCell><TableCell className="text-center align-top">{row.vigente == 1 ? <span className="text-green-600 font-bold text-xs">SI</span> : <span className="text-red-400 text-xs">NO</span>}</TableCell></>)}
                                    {activeTab === 'dependencia' && (<><TableCell className="font-bold align-top">{row.sigla}</TableCell><TableCell className="whitespace-normal align-top">{row.descripcion}</TableCell><TableCell className="text-gray-500 align-top text-xs whitespace-normal">{row.superior_descripcion || '-'}</TableCell><TableCell className="align-top text-sm whitespace-normal">{row.referente_nombre || '-'}</TableCell><TableCell className="text-center align-top">{row.vigente == 1 ? <span className="text-green-600 font-bold text-xs">SI</span> : <span className="text-red-400 text-xs">NO</span>}</TableCell></>)}
                                    {activeTab === 'referente' && (<><TableCell className="align-top font-medium whitespace-normal">{row.apellido}, {row.nombre}</TableCell><TableCell className="align-top">{row.cuil}</TableCell><TableCell className="align-top font-bold text-blue-600">{row.sigla}</TableCell><TableCell className="text-center align-top"><Button variant="outline" size="sm" onClick={() => openContacts(row)} className="h-7 text-xs shadow-none hover:bg-slate-100"><Phone className="h-3 w-3 mr-1"/> Ver</Button></TableCell></>)}
                                    {!['dependencia','referente','modulo','tipo_indicador','categoria'].includes(activeTab) && (<><TableCell className="font-mono text-xs text-slate-400">{Object.values(row)[0] as any}</TableCell><TableCell className="whitespace-normal">{row.descripcion}</TableCell></>)}
                                    <TableCell className="text-right space-x-1 whitespace-nowrap align-top">
                                        <Button variant="ghost" size="sm" onClick={() => { setEditData(row); setIsModalOpen(true); }} className="hover:bg-blue-50"><Pencil className="h-4 w-4 text-blue-600" /></Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(Object.values(row)[0], Object.keys(row)[0])} className="hover:bg-red-50"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </Tabs>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle className="text-lg border-b pb-2">{editData.es_alta || Object.values(editData)[0] === 0 ? "Nuevo Registro" : "Editar Registro"}</DialogTitle></DialogHeader>
                {renderModalContent()}
                <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button onClick={handleSave} className="bg-blue-600">Guardar Cambios</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Contactos: {currentReferente?.apellido}, {currentReferente?.nombre}</DialogTitle></DialogHeader>
                <div className="bg-slate-50 p-4 rounded-lg border shadow-inner mb-4">
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-3">{editContact.id_datos_contacto === 0 ? "Nuevo Contacto" : "Modificando Contacto"}</h4>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="space-y-1"><Label className="text-[10px]">Teléfono</Label><Input value={editContact.telefono} onChange={e => setEditContact({...editContact, telefono: e.target.value})} className="h-8" /></div>
                        <div className="space-y-1"><Label className="text-[10px]">Email</Label><Input value={editContact.correo_electronico} onChange={e => setEditContact({...editContact, correo_electronico: e.target.value})} className="h-8" /></div>
                        <div className="space-y-1"><Label className="text-[10px]">Dirección</Label><Input value={editContact.direccion} onChange={e => setEditContact({...editContact, direccion: e.target.value})} className="h-8" /></div>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2"><Checkbox checked={editContact.vigente == 1} onCheckedChange={(c) => setEditContact({...editContact, vigente: c ? 1 : 0})} /><Label className="text-xs">Vigente</Label></div>
                        <Button size="sm" onClick={handleSaveContact} className="h-8"><Save className="h-3 w-3 mr-1"/> Guardar</Button>
                    </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-xs">Tel</TableHead><TableHead className="text-xs">Email</TableHead><TableHead className="text-xs text-center">Vigente</TableHead><TableHead></TableHead></TableRow></TableHeader>
                        <TableBody>
                            {contacts.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-xs text-slate-400 py-4 italic">No hay contactos registrados</TableCell></TableRow> : contacts.map(c => (
                                <TableRow key={c.id_datos_contacto} className={c.vigente == 0 ? "opacity-40" : ""}>
                                    <TableCell className="text-xs">{c.telefono || '-'}</TableCell>
                                    <TableCell className="text-xs">{c.correo_electronico}</TableCell>
                                    <TableCell className="text-xs text-center">{c.vigente == 1 ? "Sí" : "No"}</TableCell>
                                    <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => editExistingContact(c)}><Pencil className="h-3 w-3"/></Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}