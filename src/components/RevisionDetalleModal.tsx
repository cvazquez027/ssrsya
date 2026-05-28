import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, ArrowRight, Layers, Target, CheckSquare, BarChart } from "lucide-react"

const API_BASE = "http://localhost/planificacion/api-backend";

interface RevisionDetalleModalProps {
    isOpen: boolean
    onClose: () => void
    entityId: number | null
    entityType: string | null // 'proyecto', 'objetivo_especifico', 'actividad', 'indicador'
}

export function RevisionDetalleModal({ isOpen, onClose, entityId, entityType }: RevisionDetalleModalProps) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isOpen && entityId && entityType) {
            fetchDetalle()
        } else {
            setData(null)
        }
    }, [isOpen, entityId, entityType])

    const fetchDetalle = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/revisiones_detalle.php?id=${entityId}&tipo=${entityType}`)
            if (res.ok) {
                const result = await res.json()
                setData(result)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    // Iconos según nivel
    const getIcon = (label: string) => {
        if (label.includes("Proyecto")) return <Layers className="h-4 w-4 mr-1 text-blue-600"/>
        if (label.includes("Obj")) return <Target className="h-4 w-4 mr-1 text-orange-600"/>
        if (label.includes("Actividad")) return <CheckSquare className="h-4 w-4 mr-1 text-green-600"/>
        return <ArrowRight className="h-4 w-4"/>
    }

    // Renderiza un campo clave-valor bonito
    const Field = ({ label, value }: { label: string, value: any }) => {
        if (!value) return null
        return (
            <div className="mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase block">{label}</span>
                <div className="text-sm text-gray-800 bg-gray-50 p-2 rounded border">{value}</div>
            </div>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {entityType === 'proyecto' && <Layers className="h-5 w-5 text-blue-600"/>}
                        {entityType === 'objetivo_especifico' && <Target className="h-5 w-5 text-orange-600"/>}
                        {entityType === 'actividad' && <CheckSquare className="h-5 w-5 text-green-600"/>}
                        {entityType === 'indicador' && <BarChart className="h-5 w-5 text-purple-600"/>}
                        Detalle de la Entidad
                    </DialogTitle>
                    <DialogDescription>
                        Información completa y contexto jerárquico.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600"/></div>
                ) : data ? (
                    <div className="space-y-6">
                        {/* 1. CADENA DE DEPENDENCIAS (CONTEXTO) */}
                        {data.contexto && data.contexto.length > 0 && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Depende de:</h4>
                                <div className="space-y-2">
                                    {data.contexto.map((ctx: any, i: number) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <div className="mt-0.5">{getIcon(ctx.label)}</div>
                                            <div className="flex-1">
                                                <Badge variant="outline" className="mb-1 text-[10px]">{ctx.label}</Badge>
                                                <p className="text-sm font-medium text-slate-700 leading-tight">{ctx.val}</p>
                                            </div>
                                            {i < data.contexto.length - 1 && (
                                                 <div className="flex flex-col items-center px-2">
                                                    <div className="h-4 w-px bg-slate-300"></div>
                                                 </div>
                                            )}
                                        </div>
                                    ))}
                                    {/* Flecha final apuntando al ítem actual */}
                                    <div className="flex justify-center py-1"><ArrowRight className="h-4 w-4 text-slate-400 rotate-90"/></div>
                                </div>
                            </div>
                        )}

                        {/* 2. DETALLE DEL ÍTEM ACTUAL */}
                        <Card className="border-blue-100 shadow-sm">
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge className="bg-blue-600 hover:bg-blue-700">Ítem Actual</Badge>
                                    <h3 className="text-lg font-bold text-gray-900">{data.nombre}</h3>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-1">
                                    {/* Renderizado condicional de campos según tipo */}
                                    
                                    {data.tipo === 'proyecto' && (
                                        <>
                                            <Field label="Objetivo General" value={data.detalle.obj_gral_desc} />
                                            <Field label="Sigla Dependencia" value={data.detalle.sigla_dependencia} />
                                        </>
                                    )}

                                    {data.tipo === 'objetivo_especifico' && (
                                         <Field label="Descripción Completa" value={data.detalle.descripcion} />
                                    )}

                                    {data.tipo === 'actividad' && (
                                        <>
                                            <Field label="Descripción de Actividad" value={data.detalle.descripcion} />
                                            <div className="grid grid-cols-2 gap-4">
                                                <Field label="Tipo" value={data.detalle.id_tipo_actividad_prioritaria} /> 
                                                {/* Si quieres el nombre del tipo, tendrías que hacer JOIN en el backend, por ahora sale ID */}
                                            </div>
                                        </>
                                    )}

                                    {data.tipo === 'indicador' && (
                                        <>
                                            <Field label="Fórmula / Construcción" value={data.detalle.construccion} />
                                            <div className="grid grid-cols-2 gap-4">
                                                <Field label="Fuente" value={data.detalle.fuente} />
                                                <Field label="Línea Base" value={data.detalle.linea_base} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 bg-blue-50/50 p-2 rounded">
                                                <Field label="Meta 2026" value={data.detalle.meta_anio1} />
                                                <Field label="Meta 2027" value={data.detalle.meta_anio2} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <div className="text-center text-gray-500">No se encontró información.</div>
                )}
            </DialogContent>
        </Dialog>
    )
}