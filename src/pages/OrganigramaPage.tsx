import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Users, ArrowRight, ShieldAlert, Network } from "lucide-react"

const API_BASE = "http://localhost/planificacion/api-backend";

interface Dependencia {
  sigla: string
  descripcion: string
  id_referente: number
  referente_nombre: string
  sigla_superior: string | null
  children?: Dependencia[]
}

export default function OrganigramaPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [accesoDenegado, setAccesoDenegado] = useState(false)
  const [arbol, setArbol] = useState<Dependencia[]>([])

  useEffect(() => {
    fetchDependencias()
  }, [])

  const fetchDependencias = async () => {
    try {
      setLoading(true)
      
      const resUser = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' })
      const userData = await resUser.json()
      
      if (!userData.permisos?.['PLANIFICACION']) {
          setAccesoDenegado(true)
          setLoading(false)
          return
      }

      const resDep = await fetch(`${API_BASE}/lista_maestras.php?tabla=dependencia`, { credentials: 'include' })
      if (resDep.ok) {
          const dataAll = await resDep.json()
          
          // Filtramos solo las vigentes para el mapa visual
          const dataVigentes = dataAll.filter((d: any) => d.vigente === 1)
          
          // Construimos el árbol
          const tree = buildTree(dataVigentes)
          setArbol(tree)
      }
    } catch (error) {
      console.error("Error al cargar organigrama", error)
    } finally {
      setLoading(false)
    }
  }

  const buildTree = (list: any[]): Dependencia[] => {
    const siglaSet = new Set(list.map(d => d.sigla))
    const roots = list.filter(item => !item.sigla_superior || !siglaSet.has(item.sigla_superior))
    
    const getChildren = (parentSigla: string): Dependencia[] => {
      return list.filter(item => item.sigla_superior === parentSigla).map(item => ({
        ...item, children: getChildren(item.sigla)
      }))
    }

    return roots.map(root => ({ ...root, children: getChildren(root.sigla) }))
  }

  const renderNode = (node: Dependencia, isRoot = false) => {
    return (
        <div key={node.sigla} className="relative">
            {/* Línea horizontal que conecta con el padre (si no es raíz) */}
            {!isRoot && (
                <div className="absolute -left-6 top-6 w-6 h-[2px] bg-stone-300"></div>
            )}
            
            <Card 
                className="w-full max-w-xl mb-4 cursor-pointer hover:border-primary hover:shadow-md transition-all group border-l-4 border-l-primary z-10 relative bg-white"
                onClick={() => navigate(`/tablero?dependencia=${node.sigla}`)}
            >
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="font-bold text-stone-800 text-sm sm:text-base">{node.sigla}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{node.descripcion}</p>
                        {node.referente_nombre && (
                            <p className="text-[10px] text-stone-400 mt-2 flex items-center gap-1">
                                <Users className="h-3 w-3"/> {node.referente_nombre}
                            </p>
                        )}
                    </div>
                    <div className="h-8 w-8 shrink-0 rounded-full bg-stone-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors text-stone-400">
                        <ArrowRight className="h-4 w-4" />
                    </div>
                </CardContent>
            </Card>

            {/* Renderizado recursivo de hijos */}
            {node.children && node.children.length > 0 && (
                <div className="ml-6 border-l-2 border-stone-300 pl-6 relative">
                    {node.children.map(child => renderNode(child, false))}
                </div>
            )}
        </div>
    )
  }

  if (loading) return <DashboardLayout currentSection="Organigrama"><div className="p-8 text-center text-stone-500 animate-pulse">Generando mapa estructural...</div></DashboardLayout>

  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Organigrama">
              <div className="flex flex-col items-center justify-center h-[60vh] text-stone-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-stone-800">Acceso Denegado</h2>
                  <p>No tenés permisos para visualizar la estructura del sistema.</p>
              </div>
          </DashboardLayout>
      )
  }

  return (
    <DashboardLayout currentSection="Organigrama">
      <div className="space-y-6">
        
        <div>
            <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                <Network className="h-6 w-6 text-primary" /> Estructura Organizacional
            </h2>
            <p className="text-sm text-stone-500 mt-1">
                Navegue visualmente por las dependencias de la Secretaría. Haga clic en cualquier área para acceder a su planificación y tablero de control.
            </p>
        </div>

        <div className="bg-stone-50/50 p-4 sm:p-6 lg:p-8 rounded-xl border border-stone-200 shadow-inner overflow-x-auto">
            <div className="min-w-[300px]">
                {arbol.length === 0 ? (
                    <div className="text-center text-stone-400 italic py-12">No hay dependencias registradas en el sistema.</div>
                ) : (
                    arbol.map(rootNode => renderNode(rootNode, true))
                )}
            </div>
        </div>

      </div>
    </DashboardLayout>
  )
}