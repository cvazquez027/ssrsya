import { useState, useEffect, useRef } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Lock, Unlock, MessageSquare, CheckCircle2, User, Pencil, X, AlertCircle, Info, ShieldAlert } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { RevisionDetalleModal } from "@/components/RevisionDetalleModal"

const API_BASE = "http://localhost/planificacion/api-backend";

export default function RevisionesPage() {
  const { toast } = useToast()

  // --- CIRUGÍA DE SEGURIDAD ---
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  // --- NUEVO ESTADO PARA EL MODAL DE DETALLE ---
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false)
  const [seleccionDetalle, setSeleccionDetalle] = useState<{id: number, tipo: string} | null>(null)
  
  const [hilos, setHilos] = useState<any[]>([])
  const [hiloSeleccionado, setHiloSeleccionado] = useState<any>(null)
  const [mensajes, setMensajes] = useState<any[]>([])
  const [hiloCerrado, setHiloCerrado] = useState(false)
  
  const [nuevoMensaje, setNuevoMensaje] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)

  const [loadingList, setLoadingList] = useState(true)
  const [userRol, setUserRol] = useState("")
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    if (!editingId) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [mensajes, editingId])

  // --- FUNCIÓN CORREGIDA ---
  const abrirDetalle = (hilo: any) => {
        setSeleccionDetalle({
            // El backend lista_revisiones devuelve 'id_pk_tabla_revisada' como el ID de la entidad
            id: hilo.id_pk_tabla_revisada, 
            tipo: hilo.tabla_revisada // 'proyecto', 'actividad_prioritaria', etc.
        })
        setModalDetalleOpen(true)
  }

  const fetchUser = async () => {
    try {
        const res = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' })
        const data = await res.json()
        
        // CIRUGÍA: Validamos permisos de módulo
        const rolPlanificacion = data.permisos?.['PLANIFICACION'];
        if (!rolPlanificacion) {
            setAccesoDenegado(true);
            setLoadingList(false);
            return;
        }

        setUserRol(rolPlanificacion);
        
        // Solo buscamos hilos si tiene permisos
        fetchHilos();
    } catch (e) { console.error(e) }
  }

  const fetchHilos = async () => {
    try {
      const res = await fetch(`${API_BASE}/revisiones_hilos.php?modo=lista`, { credentials: 'include' })
      const data = await res.json()
      setHilos(data)
    } catch (e) { console.error(e) } finally { setLoadingList(false) }
  }

  const seleccionarHilo = async (hilo: any) => {
      setHiloSeleccionado(hilo)
      cancelarEdicion()
      setMensajes([])
      try {
          const res = await fetch(`${API_BASE}/revisiones_hilos.php?modo=mensajes&id_tabla=${hilo.id_tabla_revisada}&id_pk=${hilo.id_pk_tabla_revisada}`, { credentials: 'include' })
          const data = await res.json()
          setMensajes(data.mensajes)
          setHiloCerrado(data.cerrado)
      } catch (e) { console.error(e) }
  }

  const iniciarEdicion = (msg: any) => {
      setNuevoMensaje(msg.texto)
      setEditingId(msg.real_id)
  }

  const cancelarEdicion = () => {
      setNuevoMensaje("")
      setEditingId(null)
  }

  const enviarMensaje = async () => {
      if (!nuevoMensaje.trim()) return;

      try {
          const method = editingId ? "PATCH" : "POST";
          const body: any = { 
              texto: nuevoMensaje,
              id_tabla_revisada: hiloSeleccionado.id_tabla_revisada,
              id_pk_tabla_revisada: hiloSeleccionado.id_pk_tabla_revisada
          };

          if (editingId) body.id_revision_ssrsya = editingId;

          const res = await fetch(`${API_BASE}/abm_revision.php`, {
              method: method,
              headers: { "Content-Type": "application/json" },
              credentials: 'include',
              body: JSON.stringify(body)
          });

          const data = await res.json();

          if (res.ok) {
              cancelarEdicion();
              seleccionarHilo(hiloSeleccionado); 
          } else {
              toast({ title: "Atención", description: data.error, variant: "destructive" })
          }
      } catch (e) { toast({title: "Error al enviar", variant: "destructive"}) }
  }

  const toggleHilo = async (nuevoEstado: boolean) => {
      const accion = nuevoEstado ? "cerrar" : "reabrir";
      if (!confirm(`¿Seguro que deseas ${accion} esta revisión?`)) return;
      
      try {
          const res = await fetch(`${API_BASE}/abm_revision.php`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: 'include',
              body: JSON.stringify({
                  id_tabla_revisada: hiloSeleccionado.id_tabla_revisada,
                  id_pk_tabla_revisada: hiloSeleccionado.id_pk_tabla_revisada,
                  cerrado: nuevoEstado ? 1 : 0
              })
          });
          
          if (res.ok) {
              const data = await res.json();
              toast({ title: data.mensaje });
              seleccionarHilo(hiloSeleccionado);
          } else {
              const data = await res.json();
              throw new Error(data.error || "Error al cambiar estado");
          }
      } catch (e: any) { 
          toast({title: "Error", description: e.message, variant: "destructive"}) 
      }
  }

  const esSsrya = ['admin', 'cargafull'].includes(userRol);
  const esCarga = userRol === 'carga';
  
  const ultimoMensaje = mensajes.length > 0 ? mensajes[mensajes.length - 1] : null;
  const ultimoEsDeAdmin = ultimoMensaje ? ultimoMensaje.es_admin : false;

  let puedeEscribir = !hiloCerrado;
  let mensajeBloqueo = "";

  if (!editingId) {
      if (esCarga) {
          if (!ultimoMensaje || !ultimoEsDeAdmin) {
              puedeEscribir = false;
              mensajeBloqueo = "Esperando acción de SSRSyA.";
          }
      } else if (esSsrya) {
          if (ultimoMensaje && ultimoEsDeAdmin) {
              puedeEscribir = false;
              mensajeBloqueo = "Esperando respuesta de dependencia.";
          }
      }
  }

  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Revisiones">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>No tenés permisos para visualizar el módulo de Planificación.</p>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout currentSection="Revisiones">
        <div className="flex h-[calc(100vh-140px)] gap-4">
            {/* LISTA */}
            <Card className="w-1/3 flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 font-semibold text-gray-700 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" /> Bandeja de Entrada
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {loadingList ? <div className="p-4 text-center">Cargando...</div> : 
                     hilos.length === 0 ? <div className="p-4 text-center text-sm text-muted-foreground">No hay revisiones.</div> :
                     hilos.map((hilo, i) => (
                        <div 
                            key={i}
                            // 1. Clic general abre el chat
                            onClick={() => seleccionarHilo(hilo)}
                            className={`p-3 rounded-lg cursor-pointer border transition-colors hover:bg-blue-50 relative group
                                ${hiloSeleccionado?.ultimo_id === hilo.ultimo_id ? 'bg-blue-100 border-blue-200 shadow-sm' : 'bg-white border-gray-100'}`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="text-xs font-bold uppercase text-blue-600 px-1.5 py-0.5 bg-blue-50 rounded border border-blue-100">{hilo.tabla_revisada.replace('_', ' ')}</span>
                                <span className="text-[10px] text-gray-400">{hilo.sigla_dependencia}</span>
                            </div>
                            
                            {/* 2. Título interactivo: e.stopPropagation() para NO abrir el chat, sino el modal */}
                            <div 
                                className="text-sm font-medium text-gray-800 mt-1 line-clamp-2 hover:text-blue-600 hover:underline flex items-center gap-1 w-fit"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    abrirDetalle(hilo);
                                }}
                                title="Ver detalle completo"
                            >
                                {hilo.titulo_entidad || "Sin título"}
                                <Info className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* CHAT */}
            <Card className="w-2/3 flex flex-col overflow-hidden shadow-md">
                {hiloSeleccionado ? (
                    <>
                        <div className="p-4 border-b bg-white flex justify-between items-center shadow-sm z-10">
                            <div>
                                {/* Título en el chat también clicable por si acaso */}
                                <h3 
                                    className="font-bold text-gray-800 cursor-pointer hover:underline hover:text-blue-600"
                                    onClick={() => abrirDetalle(hiloSeleccionado)}
                                >
                                    {hiloSeleccionado.titulo_entidad}
                                </h3>
                                <p className="text-xs text-muted-foreground uppercase">{hiloSeleccionado.tabla_revisada}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {hiloCerrado ? (
                                    <>
                                        <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                                            <CheckCircle2 className="h-3 w-3" /> Finalizado
                                        </span>
                                        {esSsrya && (
                                            <Button size="sm" variant="outline" onClick={() => toggleHilo(false)} className="text-blue-600 hover:bg-blue-50 h-8 ml-2 border-blue-200">
                                                <Unlock className="h-3 w-3 mr-1" /> Reabrir
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    esSsrya && (
                                        <Button size="sm" variant="outline" onClick={() => toggleHilo(true)} className="text-red-600 hover:bg-red-50 h-8">
                                            <Lock className="h-3 w-3 mr-1" /> Cerrar
                                        </Button>
                                    )
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                            {mensajes.map((msg) => {
                                const esMio = (esSsrya && msg.es_admin) || (esCarga && !msg.es_admin);
                                return (
                                    <div key={msg.id} className={`flex ${msg.es_admin ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm text-sm relative group
                                            ${msg.es_admin ? 'bg-white text-gray-800 border border-gray-200' : 'bg-blue-600 text-white'}`}>
                                            <div className={`text-[10px] font-bold mb-1 flex items-center gap-1 ${msg.es_admin ? 'text-blue-600' : 'text-blue-100'}`}>
                                                <User className="h-3 w-3" /> {msg.autor}
                                            </div>
                                            <p className="whitespace-pre-wrap leading-relaxed pr-6">{msg.texto}</p>
                                            
                                            {esMio && !hiloCerrado && (
                                                <button onClick={() => iniciarEdicion(msg)} className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity ${msg.es_admin ? 'text-gray-400 hover:text-blue-600' : 'text-blue-200 hover:text-white'}`}>
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 bg-white border-t">
                            {hiloCerrado ? (
                                <div className="text-center text-sm text-gray-400 p-2 border border-dashed rounded"><Lock className="h-4 w-4 inline mr-2"/> Conversación cerrada.</div>
                            ) : (!puedeEscribir && !editingId) ? (
                                <div className="text-center text-xs text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200 flex justify-center items-center gap-2">
                                    <AlertCircle className="h-4 w-4"/> {mensajeBloqueo}
                                </div>
                            ) : (
                                <div className="flex gap-2 items-center">
                                    {editingId && <Button size="icon" variant="ghost" onClick={cancelarEdicion} className="text-red-500"><X className="h-4 w-4"/></Button>}
                                    <Input 
                                        value={nuevoMensaje}
                                        onChange={(e) => setNuevoMensaje(e.target.value)}
                                        placeholder={editingId ? "Editando..." : "Escribir..."}
                                        onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()}
                                        className={editingId ? "bg-yellow-50 border-yellow-300" : ""}
                                    />
                                    <Button onClick={enviarMensaje} className={editingId ? "bg-yellow-600 hover:bg-yellow-700" : "bg-blue-600"}>
                                        {editingId ? <Pencil className="h-4 w-4"/> : <Send className="h-4 w-4" />}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                        <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
                        <p>Seleccione una conversación</p>
                    </div>
                )}
            </Card>
        </div>
        <RevisionDetalleModal 
                isOpen={modalDetalleOpen}
                onClose={() => setModalDetalleOpen(false)}
                entityId={seleccionDetalle?.id || null}
                entityType={seleccionDetalle?.tipo || null}
        />
    </DashboardLayout>
  )
}