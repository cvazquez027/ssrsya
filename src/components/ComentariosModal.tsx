import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Lock, User, MessageSquare, AlertCircle, Pencil, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const API_BASE = "http://localhost/planificacion/api-backend";

interface ComentariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: "proyecto" | "objetivo_general" | "objetivo_especifico" | "actividad_prioritaria" | "indicador";
  entityId: number;
  entityTitle: string;
}

export function ComentariosModal({ isOpen, onClose, entityType, entityId, entityTitle }: ComentariosModalProps) {
  const { toast } = useToast()
  const [mensajes, setMensajes] = useState<any[]>([])
  
  // Estado para Nuevo Mensaje / Edición
  const [texto, setTexto] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [userRol, setUserRol] = useState("")
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const TABLE_IDS: Record<string, number> = {
      "proyecto": 1,
      "objetivo_general": 2,
      "objetivo_especifico": 3,
      "actividad_prioritaria": 4,
      "indicador": 5
  };

  useEffect(() => {
    if (isOpen) {
        fetchUser()
        fetchMensajes()
        limpiarInput()
    }
  }, [isOpen, entityId, entityType])

  useEffect(() => {
    if (!editingId) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [mensajes, editingId])

  const fetchUser = async () => {
      try {
          const res = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' })
          const data = await res.json()
          setUserRol(data.rol || "")
      } catch (e) { console.error(e) }
  }

  const fetchMensajes = async () => {
    setLoading(true)
    try {
        const idTabla = TABLE_IDS[entityType];
        // CAMBIO QUIRÚRGICO: Se corrige la ruta de revisiones_chat.php a revisiones_hilos.php
        const res = await fetch(`${API_BASE}/revisiones_hilos.php?modo=mensajes&id_tabla=${idTabla}&id_pk=${entityId}`, { credentials: 'include' })
        const data = await res.json()
        setMensajes(data.mensajes || [])
        setIsClosed(data.cerrado || false)
    } catch (e) { 
        console.error(e) 
        setMensajes([])
    } finally { 
        setLoading(false) 
    }
  }

  const limpiarInput = () => {
      setTexto("")
      setEditingId(null)
  }

  const iniciarEdicion = (msg: any) => {
      setTexto(msg.texto)
      setEditingId(msg.real_id)
  }

  const enviar = async () => {
      if (!texto.trim() || loading) return;

      setLoading(true);
      try {
          const method = editingId ? "PATCH" : "POST";
          const body: any = { texto: texto.trim() };

          if (editingId) {
              body.id_revision_ssrsya = editingId;
          } else {
              body.id_tabla_revisada = TABLE_IDS[entityType];
              body.id_pk_tabla_revisada = entityId;
          }

          const res = await fetch(`${API_BASE}/abm_revision.php`, {
              method: method,
              headers: { "Content-Type": "application/json" },
              credentials: 'include',
              body: JSON.stringify(body)
          });
          
          const data = await res.json();

          if (res.ok) {
              limpiarInput();
              await fetchMensajes(); 
          } else {
             toast({ 
                 title: "Atención", 
                 description: data.error || "Error al procesar la solicitud.", 
                 variant: "destructive" 
             })
          }
      } catch (e) { 
          toast({ title: "Error de conexión", variant: "destructive" }) 
      } finally {
          setLoading(false);
      }
  }

  // --- PERMISOS ---
  const esAdminOSsrya = ['admin', 'cargafull'].includes(userRol);
  const esCarga = userRol === 'carga';
  
  const ultimoMensaje = mensajes.length > 0 ? mensajes[mensajes.length - 1] : null;
  const ultimoEsDeAdmin = ultimoMensaje ? ultimoMensaje.es_admin : false;

  let puedeEscribir = !isClosed;
  let mensajeBloqueo = "";

  if (!editingId) {
      if (esCarga) {
          if (!ultimoMensaje) {
              puedeEscribir = false;
              mensajeBloqueo = "Esperando inicio de revisión por SSRSyA.";
          } else if (!ultimoEsDeAdmin) {
              puedeEscribir = false;
              mensajeBloqueo = "Ya has respondido. Espera respuesta de SSRSyA o edita tu respuesta anterior.";
          }
      } else if (esAdminOSsrya) {
          if (ultimoMensaje && ultimoEsDeAdmin) {
              puedeEscribir = false;
              mensajeBloqueo = "Esperando respuesta de la dependencia. Edita tu comentario si es necesario.";
          }
      }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
             <MessageSquare className="h-4 w-4 text-blue-600" /> 
             Revisiones: <span className="font-normal truncate max-w-[300px]">{entityTitle}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 rounded-md border space-y-3 custom-scrollbar">
            {loading && mensajes.length === 0 && <p className="text-center text-xs text-gray-400">Cargando...</p>}
            {!loading && mensajes.length === 0 && (
                <div className="text-center text-gray-400 text-sm mt-10 flex flex-col items-center gap-2">
                    <MessageSquare className="h-8 w-8 opacity-20" />
                    <span>Sin revisiones.</span>
                </div>
            )}
            
            {mensajes.map((msg) => {
                const esMio = (esAdminOSsrya && msg.es_admin) || (esCarga && !msg.es_admin);
                return (
                    <div key={msg.id} className={`flex ${msg.es_admin ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] p-3 rounded-lg text-xs shadow-sm group relative
                            ${msg.es_admin ? 'bg-white border text-gray-800' : 'bg-blue-600 text-white'}`}>
                            <div className={`font-bold mb-1 flex items-center gap-1 ${msg.es_admin ? 'text-blue-600' : 'text-blue-100'}`}>
                                <User className="h-3 w-3" /> {msg.autor}
                            </div>
                            <p className="whitespace-pre-wrap pr-4">{msg.texto}</p>
                            {esMio && !isClosed && (
                                <button 
                                    onClick={() => iniciarEdicion(msg)}
                                    className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                                        ${msg.es_admin ? 'text-gray-400 hover:text-blue-600' : 'text-blue-200 hover:text-white'}`}
                                    title="Editar"
                                >
                                    <Pencil className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>
                )
            })}
            <div ref={messagesEndRef} />
        </div>

        <DialogFooter className="mt-2">
            {isClosed ? (
                <div className="w-full p-2 bg-gray-100 text-gray-500 text-center text-sm rounded flex items-center justify-center gap-2">
                    <Lock className="h-4 w-4" /> Revisión Finalizada
                </div>
            ) : (!puedeEscribir && !editingId) ? (
                <div className="w-full p-3 bg-yellow-50 text-yellow-700 text-center text-xs rounded border border-yellow-200 flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" /> 
                    {mensajeBloqueo}
                </div>
            ) : (
                <div className="flex w-full gap-2 items-center">
                    {editingId && (
                        <Button size="icon" variant="ghost" onClick={limpiarInput} className="text-red-500" title="Cancelar edición">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                    <Input 
                        placeholder={editingId ? "Editando mensaje..." : (esAdminOSsrya ? "Nuevo comentario..." : "Escribir respuesta...")}
                        value={texto} 
                        onChange={(e) => setTexto(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && enviar()}
                        className={editingId ? "bg-yellow-50 border-yellow-300 focus-visible:ring-yellow-400" : ""}
                        disabled={loading}
                    />
                    <Button size="icon" onClick={enviar} disabled={loading || !texto.trim()} className={editingId ? "bg-yellow-600 hover:bg-yellow-700" : "bg-blue-600"}>
                        {editingId ? <Pencil className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}