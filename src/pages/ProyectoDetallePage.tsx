import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, Target, CheckSquare, BarChart3, TrendingUp, 
  CheckCircle, Send, XCircle, Unlock, FileDown, Users, ShieldAlert,
  BookOpen, ChevronDown, ChevronUp
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts"

const API_BASE = "http://localhost/planificacion/api-backend";
const ESTADO = { EDICION: 1, PARA_AUTORIZAR: 2, APROBADO: 3, RECHAZADO: 4, CERRADO: 5 };

// --- DATOS DEL GLOSARIO (Importados del CSV) ---
const GLOSARIO = [
  {
    seccion: "Sistema de Planificación y Seguimiento",
    items: [
      { termino: "Objetivo de la herramienta", definicion: "El objetivo de la herramienta es poder identificar y dar seguimiento a los objetivos estratégicos de cada una de las diferentes áreas que componen la Secretaría de Gestión Sanitaria y poder dar un seguimiento a las acciones que de ellas se desprenden. Una vez confeccionada, la siguiente matriz debe reflejar los diferentes tipos de objetivos a llevar a cabo, las actividades necesarias para alcanzar los resultados esperados, los recursos necesarios para desarrollar las actividades, los indicadores medibles, y el procedimiento a seguir para determinar estos indicadores. Se trata de una herramienta que sintetiza el plan operativo, sanitario y financiero del proyecto, sus actividades y recursos. Es un reflejo de aquello que se quiere lograr y de los medios para alcanzarlo." }
    ]
  },
  {
    seccion: "Definición del contenido de cada columna de la matriz de planificación",
    items: [
      { termino: "Dependencia", definicion: "Cada área que forma parte de la estructura orgánico-funcional de la Secretaría de Gestión Sanitaria." },
      { termino: "Proyectos", definicion: "Nombre de la línea de trabajo / proyecto / programa (unidad de medida elegida por el área)." },
      { termino: "Prioridad", definicion: "Alta - media - baja (Definido por el área - referente del proyecto)." },
      { termino: "Estado 2026", definicion: "Definir si es CONTINUA o NUEVO (continua de años anteriores o es un nuevo proyecto)." },
      { termino: "Referente", definicion: "Establecer los datos del referente de ese proyecto - linea de trabajo - programa - Puede ser el referente del equipo tecnico o, en caso de no haber, el director/directora responsable." },
      { termino: "Objetivo General", definicion: "Corresponde a la descripción objetiva de la situación que se pretende conseguir con la ejecución del proyecto. Puede ser un único objetivo general, o varios." },
      { termino: "Objetivos Específicos", definicion: "Cada uno de los cambios particulares y necesarios para alcanzar el objetivo general. Según corresponda, pueden ser sanitarios, de gestión y/o financieros." },
      { termino: "Tipo de Actividad", definicion: "Definir un tipo de actividad:\n- Rectoría y gobernanza: encuentros nacional, reuniones con referentes jurisdiccionales o regionales, asistencia técnica, generación de documentos de referencia o lineamientos nacionales, articulación intrainter ministerial y con organismos internacionales, etc.\n- Capacitación: acciones de sensibilización, capacitación y cursos, asistencia técnica.\n- Caracterización y análisis sanitario: producción de información y análisis de información priorizada.\n- Insumos: todo lo que refiere a la adquisición, distribución y mejora de stock.\n- Comunicación: estrategias de comunicación y producción de piezas comunicacionales.\n- Sistemas de registro: mejora continua de la implementación y adherencia a los sistemas de registro e información sanitaria.\n- Otros." },
      { termino: "Actividad", definicion: "Descripción de la actividad principal/prioritaria que se llevará a cabo durante el corto/mediano plazo, para poder cumplir con los objetivos definidos. Es probable que para cada objetivo se necesiten llevar a cabo varias actividades." },
      { termino: "Tipo de Indicador", definicion: "El tipo de indicador utilizado para medir el grado de logro de los objetivos: proceso, resultado, impacto.\n- Proceso: miden las actividades y operaciones necesarias para convertir los insumos en productos (JGM, 2021).\n- Resultado: refiere a cambios en el comportamiento, actitud o certificación de los destinatarios de un programa una vez que han recibido los bienes, regulaciones o servicios de la intervención (FAO, 2019).\n- Impacto: cuantifican las transformaciones alcanzadas sobre la situación problemática sobre la que se propuso intervenir." },
      { termino: "Nombre del Indicador", definicion: "Nombre del indicador que se busca monitorear." },
      { termino: "Construcción del Indicador", definicion: "Explicitar la construcción del indicador (numerador y denominador, porcentaje, cantidad, etc)." },
      { termino: "Correspondencia con otra matriz", definicion: "Explicitar si el indicador está en otra matriz: ODS, meta física, proyecto de financiamiento externo, otro." },
      { termino: "Fuente", definicion: "Definir la fuente de datos donde será posible verificar la información cargada en la matriz. Puede ser un sistema de registro ya existente o la información que brinde un área aunque no esté consolidada en un sistema de registro." },
      { termino: "Línea de Base", definicion: "Primera medición de todos los indicadores. Punto de partida del proyecto, contemplando el último dato disponible, idealmente 2025. Si es nuevo, poner 0." },
      { termino: "Meta 2026", definicion: "Valor que se busca alcanzar en el 2026." },
      { termino: "Meta 2027", definicion: "Valor que se busca alcanzar en el 2027, en caso de corresponder." },
      { termino: "Distribución por trimestres", definicion: "Valor que se busca alcanzar por trimestres, ya sea nominal y/o % de avance." }
    ]
  }
];

interface Monitoreo {
  id_monitoreo: number
  id_periodo_monitoreo: number
  periodo_descripcion: string
  meta_propuesta: string | null
  meta_alcanzada: string | null
  observaciones: string | null
  no_aplica?: number 
}

interface Indicador {
  id_indicador: number
  nombre: string
  construccion: string
  tipo_meta?: string
  meta_anio1: number | null
  meta_anio2: number | null
  monitoreos: Monitoreo[]
}

interface Actividad {
  id_actividad: number
  descripcion: string
  indicadores: Indicador[]
}

interface ObjetivoEspecifico {
  id_oe: number
  descripcion: string
  actividades: Actividad[]
}

interface ProyectoDetalle {
  descripcion: string
  objetivo_general: string
  dependencia_sigla: string
  dependencia_descripcion: string
  autoridad_nombre: string
  autoridad_cuil: string
  autoridades: { nombre: string, cuil: string }[] 
  metricas: {
    objetivos_especificos: number
    actividades: number
    indicadores: number
    avance: string
  }
  objetivos_especificos: ObjetivoEspecifico[]
}

const getColorAvance = (avance: number) => {
    if (avance < 30) return "#ef4444"; 
    if (avance < 70) return "#eab308"; 
    return "#22c55e"; 
};

const getBadgeAvanceClass = (avance: number | null) => {
    if (avance === null) return "bg-stone-100 text-stone-400 border-stone-200";
    if (avance < 30) return "bg-red-50 text-red-700 border-red-200";
    if (avance < 70) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-green-50 text-green-700 border-green-200";
};

const getSolidKpiCardClass = (avance: number) => {
    if (avance < 30) return "bg-red-500 text-white";
    if (avance < 70) return "bg-yellow-500 text-white";
    return "bg-green-500 text-white";
};

const BadgeAvance = ({ avance }: { avance: number | null }) => {
    if (avance === null) return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-400 border border-stone-200">N/A</span>;
    return (
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${getBadgeAvanceClass(avance)}`}>
            {avance.toFixed(1)}%
        </span>
    );
};

const getMonitoreoAvance = (mon: Monitoreo): number | null => {
    if (mon.no_aplica === 1) return null;
    if (mon.meta_propuesta && !isNaN(parseFloat(mon.meta_propuesta))) {
        const prop = parseFloat(mon.meta_propuesta);
        if (prop > 0) {
            const alc = mon.meta_alcanzada ? parseFloat(mon.meta_alcanzada) : 0;
            let pct = (alc / prop) * 100;
            return pct > 100 ? 100 : pct;
        }
    }
    return null;
}

const getIndicadorAvance = (ind: Indicador): number | null => {
    if (!ind.monitoreos || ind.monitoreos.length === 0) return null;
    let sum = 0; let count = 0;
    ind.monitoreos.forEach(mon => {
        const val = getMonitoreoAvance(mon);
        if (val !== null) { sum += val; count++; }
    });
    return count > 0 ? sum / count : null;
}

const getActividadAvance = (act: Actividad): number | null => {
    if (!act.indicadores || act.indicadores.length === 0) return null;
    let sum = 0; let count = 0;
    act.indicadores.forEach(ind => {
        const val = getIndicadorAvance(ind);
        if (val !== null) { sum += val; count++; }
    });
    return count > 0 ? sum / count : null;
}

const getOEAvance = (oe: ObjetivoEspecifico): number | null => {
    if (!oe.actividades || oe.actividades.length === 0) return null;
    let sum = 0; let count = 0;
    oe.actividades.forEach(act => {
        const val = getActividadAvance(act);
        if (val !== null) { sum += val; count++; }
    });
    return count > 0 ? sum / count : null;
}

export default function ProyectoDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const [accesoDenegado, setAccesoDenegado] = useState(false);

  const [detalle, setDetalle] = useState<ProyectoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [proyecto, setProyecto] = useState<any>(null)
  
  const [userRol, setUserRol] = useState("")
  const [userSigla, setUserSigla] = useState("") 
  const [userDependencias, setUserDependencias] = useState<string[]>([]) 

  const [isChartOpen, setIsChartOpen] = useState(false)
  const [chartData, setChartData] = useState<any[]>([])

  // Estado para el acordeón del Glosario
  const [showGlosario, setShowGlosario] = useState(false)

  useEffect(() => {
    if (id) { fetchDetalle(); fetchUser(); }
  }, [id])

  const fetchUser = async () => {
    try {
      const response = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' })
      const userData = await response.json()
      
      const rolPlanificacion = userData.permisos?.['PLANIFICACION'];
      if (!rolPlanificacion) {
          setAccesoDenegado(true);
          return;
      }

      setUserRol(rolPlanificacion); 
      setUserSigla(userData.sigla || ""); 
      setUserDependencias(userData.dependencias_permitidas || []);
    } catch (error) { console.error(error) }
  }

  const fetchDetalle = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/proyecto-detalle.php?id=${id}`, { credentials: 'include' })
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`)
      
      const data = await response.json()
      if (!data.proyecto) throw new Error("Datos inválidos")

      const proyectoNormalizado = { ...data.proyecto, estado_proyecto: Number(data.proyecto.estado_proyecto ?? 1) }
      setProyecto(proyectoNormalizado)

      const totalActividades = data.proyecto.objetivos_especificos?.reduce((sum: number, oe: any) => sum + (oe.actividades?.length || 0), 0) || 0
      const totalIndicadores = data.proyecto.objetivos_especificos?.reduce((sum: number, oe: any) => sum + (oe.actividades?.reduce((actSum: number, act: any) => actSum + (act.indicadores?.length || 0), 0) || 0), 0) || 0

      setDetalle({
        descripcion: data.proyecto.descripcion,
        objetivo_general: data.proyecto.objetivo_general || "Sin objetivo general",
        dependencia_sigla: data.proyecto.sigla_dependencia,
        dependencia_descripcion: data.proyecto.dependencia_descripcion || data.proyecto.sigla_dependencia,
        autoridad_nombre: data.proyecto.autoridad_nombre || "Sin asignar",
        autoridad_cuil: data.proyecto.autoridad_cuil || "",
        autoridades: data.proyecto.referentes || [],
        metricas: { objetivos_especificos: data.proyecto.objetivos_especificos?.length || 0, actividades: totalActividades, indicadores: totalIndicadores, avance: data.proyecto.avance_porcentaje || "0%" },
        objetivos_especificos: data.proyecto.objetivos_especificos || [],
      })
    } catch (error) { toast({ title: "Error", description: "No se pudo cargar el detalle", variant: "destructive" }) } finally { setLoading(false) }
  }

  const handleOpenChart = () => {
      if (!detalle) return;
      const periodosMap: any = {};
      
      detalle.objetivos_especificos.forEach(oe => {
          oe.actividades.forEach(act => {
              act.indicadores.forEach(ind => {
                  ind.monitoreos?.forEach(mon => {
                      if (mon.no_aplica === 1) return;
                      if (mon.meta_propuesta && !isNaN(parseFloat(mon.meta_propuesta))) {
                          const prop = parseFloat(mon.meta_propuesta);
                          if (prop > 0) {
                              const alc = mon.meta_alcanzada ? parseFloat(mon.meta_alcanzada) : 0;
                              let pct = (alc / prop) * 100;
                              if (pct > 100) pct = 100; 
                              
                              if (!periodosMap[mon.periodo_descripcion]) {
                                  periodosMap[mon.periodo_descripcion] = { sum: 0, count: 0 };
                              }
                              periodosMap[mon.periodo_descripcion].sum += pct;
                              periodosMap[mon.periodo_descripcion].count += 1;
                          }
                      }
                  });
              });
          });
      });

      const data = Object.keys(periodosMap).map(periodo => {
          const real = periodosMap[periodo].count > 0 ? (periodosMap[periodo].sum / periodosMap[periodo].count) : 0;
          return {
              periodo,
              Real: Number(real.toFixed(1)),
              Faltante: Number((100 - real).toFixed(1)) 
          };
      });
      
      data.sort((a, b) => a.periodo.localeCompare(b.periodo));
      
      setChartData(data);
      setIsChartOpen(true);
  }

  const handleExportPDF = () => {
     if (!detalle) return;
     const doc = new jsPDF('l', 'mm', 'a4');
     const pageWidth = doc.internal.pageSize.getWidth();
     doc.addImage('/logo-msal.png', 'PNG', 15, 10, 22, 22);
     doc.setFontSize(10);
     doc.setTextColor(100);
     doc.text("Subsecretaría de Relaciones Sectoriales y Articulación", pageWidth - 15, 15, { align: 'right' });
     doc.setFontSize(16);
     doc.setTextColor(30);
     doc.setFont('helvetica', 'bold');
     doc.text(detalle.dependencia_descripcion, 15, 40);
     doc.setFontSize(16);
     doc.setTextColor(30);
     doc.setFont('helvetica', 'bold');
     const splitTitle = doc.splitTextToSize("Proyecto: " + detalle.descripcion, pageWidth - 30);
     doc.text(splitTitle, 15, 50);
     let currentY = 60 + ((splitTitle.length - 1) * 7);
     doc.setFontSize(11);
     doc.setFont('helvetica', 'normal');
     doc.setTextColor(60);
     const splitOG = doc.splitTextToSize("Objetivo General: " + detalle.objetivo_general, pageWidth - 30);
     doc.text(splitOG, 15, currentY);
     currentY += (splitOG.length * 5) + 5;
     doc.setDrawColor(220);
     doc.line(15, currentY, pageWidth - 15, currentY);
     currentY += 10;
     doc.setFontSize(10);
     doc.setFont('helvetica', 'bold');
     doc.text(`Objetivos: ${detalle.metricas.objetivos_especificos}`, 15, currentY);
     doc.text(`Actividades: ${detalle.metricas.actividades}`, 55, currentY);
     doc.text(`Indicadores: ${detalle.metricas.indicadores}`, 105, currentY);
     doc.text(`Estado: ${proyecto?.estado_descripcion}`, 155, currentY);
     currentY += 10;
     const tableBody: any[] = [];
     detalle.objetivos_especificos.forEach((oe) => {
         if (oe.actividades.length === 0) { tableBody.push([oe.descripcion, 'Sin actividades', '-', '-', '-', '-', '-', '-']); } else {
             oe.actividades.forEach((act, actIdx) => {
                 if (act.indicadores.length === 0) { tableBody.push([actIdx === 0 ? oe.descripcion : '', act.descripcion, 'Sin indicadores', '-', '-', '-', '-', '-']); } else {
                     act.indicadores.forEach((ind, indIdx) => {
                         const sufijo = ind.tipo_meta === 'porcentaje' ? '%' : '';
                         const metasAnio = `2026: ${ind.meta_anio1 || 0}${sufijo}\n2027: ${ind.meta_anio2 || 0}${sufijo}`;
                         if (!ind.monitoreos || ind.monitoreos.length === 0) { tableBody.push([(actIdx === 0 && indIdx === 0) ? oe.descripcion : '', indIdx === 0 ? act.descripcion : '', metasAnio, ind.nombre, 'Sin periodos', '-', '-', '-']); } else {
                             ind.monitoreos.forEach((mon, monIdx) => { tableBody.push([(actIdx === 0 && indIdx === 0 && monIdx === 0) ? oe.descripcion : '', (indIdx === 0 && monIdx === 0) ? act.descripcion : '', (monIdx === 0) ? metasAnio : '', (monIdx === 0) ? ind.nombre : '', mon.periodo_descripcion, mon.meta_propuesta ? `${mon.meta_propuesta}${sufijo}` : '0', mon.meta_alcanzada ? `${mon.meta_alcanzada}${sufijo}` : '-', mon.observaciones || '-']); });
                         }
                     });
                 }
             });
         }
     });
     autoTable(doc, { startY: currentY, head: [['Objetivo Específico', 'Actividad', 'Metas Anuales', 'Indicador', 'Periodo', 'M. Prop.', 'M. Alc.', 'Obs.']], body: tableBody, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' }, headStyles: { fillColor: [162, 37, 100], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 40 }, 2: { cellWidth: 25 }, 3: { cellWidth: 40 }, 4: { cellWidth: 30 }, 5: { cellWidth: 15 }, 6: { cellWidth: 15 }, 7: { cellWidth: 40 } }, didParseCell: function (data: any) { if (data.section === 'body' && data.cell.text[0] === '') { data.cell.styles.borderWidth = 0; } } });
     doc.save(`Proyecto_${id}_${detalle.dependencia_sigla}.pdf`);
  };

  // Función de impresión a PDF específica para el Glosario
  const handleExportGlosarioPDF = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text("Glosario y Criterios - Matriz de Planificación", 15, 20);

    let currentY = 30;

    GLOSARIO.forEach((sec) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(162, 37, 100); // Borgoña/Magenta
        doc.text(sec.seccion, 15, currentY);
        currentY += 8;

        const tableBody = sec.items.map(item => [item.termino, item.definicion]);

        autoTable(doc, {
            startY: currentY,
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
            columnStyles: {
                0: { cellWidth: 50, fontStyle: 'bold', fillColor: [245, 245, 245] },
                1: { cellWidth: pageWidth - 80 }
            },
            didDrawPage: (data) => {
                currentY = data.cursor ? data.cursor.y + 10 : currentY + 10;
            }
        });
    });

    doc.save("Glosario_Planificacion.pdf");
  };

  const rolNormalizado = String(userRol).trim().toLowerCase();
  const soyAdmin = rolNormalizado === 'admin' || rolNormalizado === 'administrador'; 
  const soyAutorizante = rolNormalizado === 'autorizante'; 
  
  const siglaProy = String(detalle?.dependencia_sigla).trim().toLowerCase();
  const siglaUser = String(userSigla).trim().toLowerCase();
  
  const esMiDependencia = 
      (siglaUser === siglaProy) || 
      (userDependencias && userDependencias.map(d => String(d).trim().toLowerCase()).includes(siglaProy));

  const puedeEnviarAutorizar = () => { 
      if (proyecto?.estado_proyecto !== ESTADO.EDICION) return false; 
      if (soyAdmin) return true; 
      if (rolNormalizado === 'cargafull') return true; 
      if (rolNormalizado === 'carga' && esMiDependencia) return true; 
      return false; 
  }

  const puedeGestionarAutorizacion = () => { 
      if (proyecto?.estado_proyecto !== ESTADO.PARA_AUTORIZAR) return false; 
      if (soyAdmin) return true; 
      if (soyAutorizante && esMiDependencia) return true; 
      return false; 
  }

  const puedeReabrir = () => { 
      const estado = proyecto?.estado_proyecto; 
      if (estado !== ESTADO.APROBADO && estado !== ESTADO.RECHAZADO) return false; 
      if (soyAdmin) return true; 
      if (soyAutorizante && esMiDependencia) return true; 
      return false; 
  }

  const cambiarEstado = async (nuevoEstado: number, mensaje: string) => {
    if (!confirm(mensaje)) return
    try {
      const response = await fetch(`${API_BASE}/proyecto_estado.php`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: 'include', body: JSON.stringify({ id_proyecto: proyecto.id_proyecto, estado: nuevoEstado }), })
      const rawText = await response.text(); let data;
      try { data = JSON.parse(rawText); } catch (e) { throw new Error("Respuesta inválida del servidor."); }
      if (response.ok) { toast({ title: "Éxito", description: "Estado actualizado" }); fetchDetalle(); } else { throw new Error(data.error || "Error desconocido") }
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }) }
  }

  const handleVolver = () => { window.history.length > 2 ? navigate(-1) : navigate('/tablero'); }

  if (loading) return <DashboardLayout currentSection="Inicio"><div className="flex h-64 items-center justify-center text-stone-500">Cargando datos...</div></DashboardLayout>
  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Inicio">
              <div className="flex flex-col items-center justify-center h-[60vh] text-stone-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-stone-800">Acceso Denegado</h2>
                  <p>No tenés permisos para visualizar el módulo de Planificación.</p>
              </div>
          </DashboardLayout>
      );
  }
  if (!detalle) return <DashboardLayout currentSection="Inicio">Error al cargar</DashboardLayout>

  const avanceProjectNum = parseFloat(detalle.metricas.avance.replace('%', '')) || 0;

  return (
    <DashboardLayout currentSection="Inicio">
      <div className="space-y-4 lg:space-y-6 relative">

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleVolver} className="border-stone-200 text-stone-600"><ArrowLeft className="h-4 w-4 mr-2" /> Volver</Button>
            <Button variant="secondary" size="sm" onClick={handleExportPDF} className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"><FileDown className="h-4 w-4 mr-2" /> Exportar PDF</Button>
          </div>
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-xl lg:text-2xl text-primary">{detalle.dependencia_sigla} - {detalle.dependencia_descripcion}</CardTitle>
                <p className="text-sm font-medium text-stone-600 mt-1">Autoridad: {detalle.autoridad_nombre}</p>
              </div>
              <div className="flex items-center gap-2">
                 {(() => {
                    let badgeClass = "bg-stone-100 text-stone-800";
                    switch (proyecto?.estado_proyecto) {
                      case ESTADO.EDICION: badgeClass = "bg-primary/10 text-primary border border-primary/20"; break;
                      case ESTADO.PARA_AUTORIZAR: badgeClass = "bg-yellow-100 text-yellow-800 border border-yellow-200"; break;
                      case ESTADO.APROBADO: badgeClass = "bg-green-100 text-green-800 border border-green-200"; break;
                      case ESTADO.RECHAZADO: badgeClass = "bg-red-100 text-red-800 border border-red-200"; break;
                      case ESTADO.CERRADO: badgeClass = "bg-stone-100 text-stone-800 border border-stone-200"; break;
                    }
                    return <span className={`px-3 py-1 text-sm font-semibold rounded-md ${badgeClass}`}>{proyecto?.estado_descripcion || "Desconocido"}</span>
                 })()}
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-stone-200">
          <CardHeader>
            <CardTitle className="text-stone-800">{detalle.descripcion}</CardTitle>
            <p className="text-sm text-stone-500 mt-1">Objetivo General: {detalle.objetivo_general}</p>
            
            <div className="flex items-center gap-2 mt-4 flex-wrap">
                <span className="font-semibold text-sm text-stone-700 mr-1"><Users className="h-4 w-4 inline mb-0.5 mr-1 text-stone-400" /> Equipo Referente:</span>
                {detalle.autoridades && detalle.autoridades.length > 0 ? (
                    detalle.autoridades.map((auth, idx) => (
                        <span key={idx} className="bg-primary/10 border border-primary/20 text-primary px-2 py-1 rounded-md text-xs font-semibold shadow-sm">{auth.nombre}</span>
                    ))
                ) : (
                    <span className="text-xs text-stone-400 italic bg-white border border-stone-200 px-2 py-1 rounded-md shadow-sm">Sin asignar</span>
                )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-primary text-white p-4 rounded-lg cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate(`/objetivos-especificos?id_proyecto=${id}`)}><Target className="h-5 w-5 mb-1"/><p className="text-xs">Objetivos</p><p className="text-2xl font-bold">{detalle.metricas.objetivos_especificos}</p></div>
              <div className="bg-emerald-600 text-white p-4 rounded-lg cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate(`/actividades?id_proyecto=${id}`)}><CheckSquare className="h-5 w-5 mb-1"/><p className="text-xs">Actividades</p><p className="text-2xl font-bold">{detalle.metricas.actividades}</p></div>
              <div className="bg-purple-600 text-white p-4 rounded-lg cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate(`/indicadores?id_proyecto=${id}`)}><BarChart3 className="h-5 w-5 mb-1"/><p className="text-xs">Indicadores</p><p className="text-2xl font-bold">{detalle.metricas.indicadores}</p></div>
              
              <div className={`${getSolidKpiCardClass(avanceProjectNum)} p-4 rounded-lg cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all`} onClick={handleOpenChart}>
                  <TrendingUp className="h-5 w-5 mb-1"/>
                  <p className="text-xs">Avance</p>
                  <p className="text-2xl font-bold">{detalle.metricas.avance}</p>
              </div>

              <div className="flex flex-col gap-2 justify-center">
                {puedeEnviarAutorizar() && <Button onClick={() => cambiarEstado(ESTADO.PARA_AUTORIZAR, "¿Enviar para autorizar?")} className="w-full bg-primary hover:bg-primary/90 text-white"><Send className="mr-2 h-4 w-4" /> Enviar</Button>}
                {puedeGestionarAutorizacion() && (
                  <div className="flex flex-col gap-2 w-full">
                    <Button onClick={() => cambiarEstado(ESTADO.APROBADO, "¿APROBAR proyecto?")} className="w-full bg-green-600 hover:bg-green-700 text-white"><CheckCircle className="mr-2 h-4 w-4" /> Aprobar</Button>
                    <Button onClick={() => cambiarEstado(ESTADO.RECHAZADO, "¿RECHAZAR proyecto?")} variant="destructive" className="w-full"><XCircle className="mr-2 h-4 w-4" /> Rechazar</Button>
                  </div>
                )}
                {puedeReabrir() && <Button onClick={() => cambiarEstado(ESTADO.EDICION, "¿REABRIR para edición?")} variant="outline" className="w-full border-stone-300 text-stone-700 hover:bg-stone-100"><Unlock className="mr-2 h-4 w-4" /> Reabrir</Button>}
                {!puedeEnviarAutorizar() && !puedeGestionarAutorizacion() && !puedeReabrir() && <div className="text-xs text-center text-stone-400 p-2 border border-stone-200 rounded bg-stone-50">Sin acciones disponibles</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* --- GLOSARIO COLAPSABLE --- */}
        <Card className="border-stone-200 shadow-sm overflow-hidden transition-all duration-300">
            <CardHeader
                className="bg-stone-50/50 cursor-pointer flex flex-row items-center justify-between pb-4 hover:bg-stone-100 transition-colors"
                onClick={() => setShowGlosario(!showGlosario)}
            >
                <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base text-stone-800">Glosario y Criterios de la Matriz</CardTitle>
                </div>
                {showGlosario ? <ChevronUp className="h-4 w-4 text-stone-500" /> : <ChevronDown className="h-4 w-4 text-stone-500" />}
            </CardHeader>
            
            {showGlosario && (
                <CardContent className="pt-4 border-t border-stone-100 bg-white">
                    <div className="flex justify-end mb-4">
                        <Button variant="outline" size="sm" onClick={handleExportGlosarioPDF} className="text-stone-600 border-stone-300 hover:bg-stone-100">
                            <FileDown className="h-4 w-4 mr-2" /> Imprimir Glosario
                        </Button>
                    </div>
                    
                    <div className="space-y-6">
                        {GLOSARIO.map((seccion, sIdx) => (
                            <div key={sIdx} className="space-y-3">
                                <h3 className="font-bold text-primary border-b border-stone-200 pb-1">{seccion.seccion}</h3>
                                <div className="space-y-2">
                                    {seccion.items.map((item, iIdx) => (
                                        <div key={iIdx} className="flex flex-col md:flex-row gap-2 md:gap-4 p-3 bg-stone-50 rounded-md border border-stone-100">
                                            <span className="font-bold text-stone-700 md:w-1/4 shrink-0 text-sm">{item.termino}:</span>
                                            <span className="text-stone-600 text-sm whitespace-pre-wrap">{item.definicion}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            )}
        </Card>

        <Card className="border-stone-200">
          <CardHeader><CardTitle className="text-base text-stone-800">Planificación y Seguimiento</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse table-fixed text-xs">
                <thead>
                  <tr className="border-b bg-stone-50">
                    <th className="text-left p-2 w-[18%] text-stone-600">Objetivo Específico</th>
                    <th className="text-left p-2 w-[18%] text-stone-600">Actividad</th>
                    <th className="text-left p-2 w-[8%] text-stone-600">Metas</th>
                    <th className="text-left p-2 w-[15%] text-stone-600">Indicador</th>
                    <th className="text-left p-2 w-[14%] text-stone-600">Periodo</th>
                    <th className="text-left p-2 w-[7%] text-stone-600">Meta Prop.</th>
                    <th className="text-left p-2 w-[7%] text-stone-600">Meta Alc.</th>
                    <th className="text-left p-2 w-[13%] text-stone-600">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.objetivos_especificos.map((oe) => {
                    const oeSpan = Math.max(1, oe.actividades.reduce((acc, act) => 
                        acc + Math.max(1, act.indicadores.reduce((acc2, ind) => 
                            acc2 + Math.max(1, ind.monitoreos?.length || 0), 0)), 0));

                    return oe.actividades.length === 0 ? (
                      <tr key={`oe-${oe.id_oe}`} className="border-b border-stone-100 hover:bg-stone-50/50">
                        <td className="p-3 align-top bg-white border-r border-stone-100">
                            <div className="font-medium text-stone-800 mb-1.5">{oe.descripcion}</div>
                            <BadgeAvance avance={getOEAvance(oe)} />
                        </td>
                        <td colSpan={7} className="p-3 text-stone-400 text-[10px] italic align-top">Sin actividades cargadas</td>
                      </tr>
                    ) : (
                      oe.actividades.map((act, actIndex) => {
                        const actSpan = Math.max(1, act.indicadores.reduce((acc, ind) => 
                            acc + Math.max(1, ind.monitoreos?.length || 0), 0));

                        return act.indicadores.length === 0 ? (
                           <tr key={`act-${act.id_actividad}`} className="border-b border-stone-100 hover:bg-stone-50/50">
                             {actIndex === 0 && (
                                 <td rowSpan={oeSpan} className="p-3 align-top bg-white border-r border-stone-100">
                                    <div className="font-medium text-stone-800 mb-1.5">{oe.descripcion}</div>
                                    <BadgeAvance avance={getOEAvance(oe)} />
                                 </td>
                             )}
                             <td className="p-3 align-top bg-white border-r border-stone-100">
                                 <div className="text-stone-700 mb-1.5">{act.descripcion}</div>
                                 <BadgeAvance avance={getActividadAvance(act)} />
                             </td>
                             <td colSpan={6} className="p-3 text-stone-400 text-[10px] italic align-top">Sin indicadores cargados</td>
                           </tr>
                        ) : (
                          act.indicadores.map((ind, indIndex) => {
                            const indSpan = Math.max(1, ind.monitoreos?.length || 0);
                            const esPorcentaje = ind.tipo_meta === 'porcentaje';
                            
                            return (!ind.monitoreos || ind.monitoreos.length === 0) ? (
                              <tr key={`ind-${ind.id_indicador}`} className="border-b border-stone-100 hover:bg-stone-50/50">
                                {actIndex === 0 && indIndex === 0 && (
                                    <td rowSpan={oeSpan} className="p-3 align-top bg-white border-r border-stone-100">
                                        <div className="font-medium text-stone-800 mb-1.5">{oe.descripcion}</div>
                                        <BadgeAvance avance={getOEAvance(oe)} />
                                    </td>
                                )}
                                {indIndex === 0 && (
                                    <td rowSpan={actSpan} className="p-3 align-top bg-white border-r border-stone-100">
                                        <div className="text-stone-700 mb-1.5">{act.descripcion}</div>
                                        <BadgeAvance avance={getActividadAvance(act)} />
                                    </td>
                                )}
                                <td className="p-3 align-top bg-white border-r border-stone-100">
                                  {ind.meta_anio1 && <div className="mb-1"><span className="font-semibold text-stone-500">2026:</span> {ind.meta_anio1}{esPorcentaje ? '%' : ''}</div>}
                                  {ind.meta_anio2 && <div><span className="font-semibold text-stone-500">2027:</span> {ind.meta_anio2}{esPorcentaje ? '%' : ''}</div>}
                                </td>
                                <td className="p-3 align-top bg-white border-r border-stone-100">
                                    <div className="font-semibold text-stone-700 mb-1.5">{ind.nombre}</div>
                                    {ind.construccion && <div className="text-[10px] text-stone-400 italic mb-1.5 leading-tight">{ind.construccion}</div>}
                                    <BadgeAvance avance={getIndicadorAvance(ind)} />
                                </td>
                                <td colSpan={4} className="p-3 text-stone-400 text-[10px] italic align-top">Sin periodos</td>
                              </tr>
                            ) : (
                              ind.monitoreos.map((mon, monIndex) => (
                                <tr key={mon.id_monitoreo} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                                  {actIndex === 0 && indIndex === 0 && monIndex === 0 && (
                                      <td rowSpan={oeSpan} className="p-3 align-top bg-white border-r border-stone-100">
                                          <div className="font-medium text-stone-800 mb-1.5">{oe.descripcion}</div>
                                          <BadgeAvance avance={getOEAvance(oe)} />
                                      </td>
                                  )}
                                  {indIndex === 0 && monIndex === 0 && (
                                      <td rowSpan={actSpan} className="p-3 align-top bg-white border-r border-stone-100">
                                          <div className="text-stone-700 mb-1.5">{act.descripcion}</div>
                                          <BadgeAvance avance={getActividadAvance(act)} />
                                      </td>
                                  )}
                                  {monIndex === 0 && (
                                    <>
                                      <td rowSpan={indSpan} className="p-3 align-top bg-white border-r border-stone-100">
                                        {ind.meta_anio1 && <div className="mb-1"><span className="font-semibold text-stone-400">2026:</span> {ind.meta_anio1}{esPorcentaje ? '%' : ''}</div>}
                                        {ind.meta_anio2 && <div><span className="font-semibold text-stone-400">2027:</span> {ind.meta_anio2}{esPorcentaje ? '%' : ''}</div>}
                                      </td>
                                      <td rowSpan={indSpan} className="p-3 align-top bg-white border-r border-stone-100">
                                          <div className="font-semibold text-stone-700 mb-1.5">{ind.nombre}</div>
                                          {ind.construccion && <div className="text-[10px] text-stone-400 italic mb-1.5 leading-tight">{ind.construccion}</div>}
                                          <BadgeAvance avance={getIndicadorAvance(ind)} />
                                      </td>
                                    </>
                                  )}
                                  <td className="p-3 align-top border-r border-stone-100">
                                      <div className="text-stone-600 mb-1.5">{mon.periodo_descripcion}</div>
                                      <BadgeAvance avance={getMonitoreoAvance(mon)} />
                                  </td>
                                  <td className="p-3 align-top border-r border-stone-100 text-stone-600">{mon.meta_propuesta}{esPorcentaje && mon.meta_propuesta ? '%' : ''}</td>
                                  <td className="p-3 align-top font-bold text-primary border-r border-stone-100">{mon.meta_alcanzada ? `${mon.meta_alcanzada}${esPorcentaje ? '%' : ''}` : "-"}</td>
                                  <td className="p-3 align-top italic text-stone-500">{mon.observaciones || "-"}</td>
                                </tr>
                              ))
                            )
                          })
                        )
                      })
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isChartOpen} onOpenChange={setIsChartOpen}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader><DialogTitle className="text-stone-800">Avance Real vs Proyectado por Período</DialogTitle></DialogHeader>
                <div className="h-[400px] w-full mt-4">
                    {chartData.length === 0 ? (
                         <div className="flex h-full items-center justify-center text-stone-400 italic">No hay datos de avance para graficar.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="periodo" tick={{fontSize: 12, fill: '#78716c'}} />
                                <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} tick={{fill: '#78716c'}} />
                                <RechartsTooltip formatter={(value) => `${value}%`} cursor={{fill: '#f5f5f4'}} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                                <Bar dataKey="Real" stackId="a" name="Avance Real (%)" barSize={50}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getColorAvance(entry.Real)} />
                                    ))}
                                </Bar>
                                <Bar dataKey="Faltante" stackId="a" fill="#e7e5e4" name="Brecha para la meta" barSize={50} />
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