import { useState, useEffect } from "react"
import * as XLSX from "xlsx"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Upload, CheckCircle2, Loader2, ShieldAlert, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const API_BASE = "http://localhost/planificacion/api-backend";

interface ProyectoResumen {
    id_temp: string;
    selected: boolean;
    dependencia: string;
    proyecto: string;
    objetivo_general: string;
    cant_oe: number;
    cant_act: number;
    cant_ind: number;
    filas: any[];
}

export default function ImportarPage() {
  const { toast } = useToast()
  
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [proyectosResumen, setProyectosResumen] = useState<ProyectoResumen[]>([])
  const [vistaPrevia, setVistaPrevia] = useState(false)
  const [importacionExitosa, setImportacionExitosa] = useState(false)
  const [resumenGlobal, setResumenGlobal] = useState<any>(null)
  const [accionReferente, setAccionReferente] = useState("actualizar")

  const [dependencias, setDependencias] = useState<any[]>([])
  const [dependenciaExportar, setDependenciaExportar] = useState<string>("")
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    verificarSesion();
    cargarDependencias();
  }, [])

  const verificarSesion = async () => {
    try {
        const resUser = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' });
        const userData = await resUser.json();
        const rolPlanificacion = userData.permisos?.['PLANIFICACION'];
        if (!rolPlanificacion || rolPlanificacion !== 'admin') {
            setAccesoDenegado(true);
        }
    } catch (e) {
        setAccesoDenegado(true);
    }
  }

  const cargarDependencias = async () => {
      try {
          const res = await fetch(`${API_BASE}/dependencia.php`, { credentials: 'include' }); 
          const data = await res.json();
          if (Array.isArray(data)) setDependencias(data);
          else if (data.datos) setDependencias(data.datos);
      } catch (e) {
          console.error("Error cargando dependencias:", e);
      }
  }

  const handleExportar = async () => {
      if (!dependenciaExportar) return;
      setExportando(true);
      try {
          const res = await fetch(`${API_BASE}/exportar_matriz.php?dependencia=${dependenciaExportar}`, {
              credentials: 'include' 
          });
          
          if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.error || "Error en la respuesta del servidor");
          }
          
          const data: any[] = await res.json();
          if ((data as any).error) throw new Error((data as any).error);
          if (data.length === 0) {
              toast({ title: "Sin datos", description: "No hay registros para la dependencia seleccionada.", variant: "destructive" });
              setExportando(false);
              return;
          }

          // 1. FORZAR ORDEN DE COLUMNAS ESTRICTO Y DOBLE CABECERA
          const header1 = [
              "Dependencia", "Proyectos", "Prioridad", "Estado 2026", 
              "Nombre Referente", "Apellido Referente", "Cuil Referente", "Dependencia Referente", "Teléfono Referente", "Email Referente", 
              "Objetivo General", "Objetivos Específicos", "Tipo Actividad", "Actividades prioritarias", 
              "Tipo de indicador", "Nombre indicador", "Construcción indicador", "Reporta a otro sistema de monitoreo", "Fuente", 
              "Línea de base 2025", "2026", "2027", 
              "1er Trimestre", "", "", 
              "2do Trimestre", "", "", 
              "3er Trimestre", "", "", 
              "4to Trimestre", "", "", 
              "Observaciones"
          ];

          const header2 = [
              "Dependencia", "Proyectos", "Prioridad", "Estado 2026", 
              "Nombre Referente", "Apellido Referente", "Cuil Referente", "Dependencia Referente", "Teléfono Referente", "Email Referente", 
              "Objetivo General", "Objetivos Específicos", "Tipo Actividad", "Actividades prioritarias", 
              "Tipo de indicador", "Nombre indicador", "Construcción indicador", "Reporta a otro sistema de monitoreo", "Fuente", 
              "Línea de base 2025", "2026", "2027", 
              "Meta Propuesta", "Meta Alcanzada", "Detalle", 
              "Meta Propuesta", "Meta Alcanzada", "Detalle", 
              "Meta Propuesta", "Meta Alcanzada", "Detalle", 
              "Meta Propuesta", "Meta Alcanzada", "Detalle", 
              "Observaciones"
          ];

          const aoa = [header1, header2];
          
          data.forEach(row => {
              aoa.push([
                  row["Dependencia"], row["Proyectos"], row["Prioridad"], row["Estado 2026"],
                  row["Nombre Referente"], row["Apellido Referente"], row["Cuil Referente"], row["Dependencia Referente"], row["Teléfono Referente"], row["Email Referente"],
                  row["Objetivo General"], row["Objetivos Específicos"], row["Tipo Actividad"], row["Actividades prioritarias"],
                  row["Tipo de indicador"], row["Nombre indicador"], row["Construcción indicador"], row["Reporta a otro sistema de monitoreo"], row["Fuente"],
                  row["Línea de base 2025"], row["2026"], row["2027"],
                  row["t1_propuesta"], row["t1_alcanzada"], row["t1_detalle"],
                  row["t2_propuesta"], row["t2_alcanzada"], row["t2_detalle"],
                  row["t3_propuesta"], row["t3_alcanzada"], row["t3_detalle"],
                  row["t4_propuesta"], row["t4_alcanzada"], row["t4_detalle"],
                  row["Observaciones"]
              ]);
          });

          const worksheet = XLSX.utils.aoa_to_sheet(aoa);

          // 2. DAR FORMATO A CABECERAS (Negrita)
          for (let r = 0; r <= 1; r++) {
              for (let c = 0; c < header1.length; c++) {
                  const cellRef = XLSX.utils.encode_cell({ r, c });
                  if (worksheet[cellRef]) {
                      worksheet[cellRef].s = { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } };
                  }
              }
          }

          // 3. COMBINACIÓN DE CELDAS (MERGES)
          const merges: XLSX.Range[] = [];
          
          // A. Combinar cabeceras Trimestrales (Horizontales)
          merges.push({ s: { r: 0, c: 22 }, e: { r: 0, c: 24 } }); // 1er Trimestre
          merges.push({ s: { r: 0, c: 25 }, e: { r: 0, c: 27 } }); // 2do Trimestre
          merges.push({ s: { r: 0, c: 28 }, e: { r: 0, c: 30 } }); // 3er Trimestre
          merges.push({ s: { r: 0, c: 31 }, e: { r: 0, c: 33 } }); // 4to Trimestre

          // B. Combinar columnas convencionales (Verticales fila 0 a 1)
          for(let c = 0; c <= 21; c++) {
              merges.push({ s: { r: 0, c: c }, e: { r: 1, c: c } });
          }
          merges.push({ s: { r: 0, c: 34 }, e: { r: 1, c: 34 } });

          // C. Lógica de agrupación jerárquica para los datos
          const getGroupKey = (row: any, colIdx: number) => {
              let key = row["Dependencia"] || "";
              if (colIdx === 0) return key;

              key += "|" + (row["Proyectos"] || "");
              if (colIdx >= 1 && colIdx <= 10) return key;

              key += "|" + (row["Objetivos Específicos"] || "");
              if (colIdx === 11) return key;

              key += "|" + (row["Actividades prioritarias"] || "");
              return key;
          };

          const colsToMerge = [
              "Dependencia", "Proyectos", "Prioridad", "Estado 2026", 
              "Nombre Referente", "Apellido Referente", "Cuil Referente", "Dependencia Referente", "Teléfono Referente", "Email Referente", 
              "Objetivo General", "Objetivos Específicos", "Tipo Actividad", "Actividades prioritarias"
          ];

          for (let c = 0; c <= 13; c++) {
              let startRow = 2; // Data arranca en el índice 2 de nuestro array "aoa"
              let currentVal = data[0][colsToMerge[c]];
              let currentGroup = getGroupKey(data[0], c);

              for (let r = 1; r < data.length; r++) {
                  let val = data[r][colsToMerge[c]];
                  let group = getGroupKey(data[r], c);

                  if (val !== currentVal || group !== currentGroup) {
                      if (r + 2 - 1 > startRow) {
                          merges.push({ s: { r: startRow, c: c }, e: { r: r + 2 - 1, c: c } });
                      }
                      startRow = r + 2;
                      currentVal = val;
                      currentGroup = group;
                  }
              }
              if (data.length > 0 && (data.length - 1 + 2 > startRow)) {
                  merges.push({ s: { r: startRow, c: c }, e: { r: data.length - 1 + 2, c: c } });
              }
          }

          if (merges.length > 0) {
              worksheet['!merges'] = merges;
          }

          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Matriz");
          const fecha = new Date().toISOString().split('T')[0];
          XLSX.writeFile(workbook, `Matriz_${dependenciaExportar}_${fecha}.xlsx`);
          
          toast({ title: "Exportación Exitosa", description: "El archivo se ha exportado con el formato combinado." });
      } catch (error: any) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
          setExportando(false);
      }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0])
  }

  const procesarExcel = () => {
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const bstr = e.target?.result;
      const workbook = XLSX.read(bstr, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });

      const normalizarTexto = (str: string) => {
          return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
      };

      let headerRowIndex = -1;
      let headersRow0: string[] = [];
      let headersRow1: string[] = [];
      
      // Adaptación inteligente: Busca "Dependencia" y lee si hay 1 o 2 filas de cabecera
      for (let i = 0; i < Math.min(rawData.length, 20); i++) {
         const rowStrs = rawData[i].map(c => normalizarTexto(String(c || '')));
         if (rowStrs.includes('dependencia') && rowStrs.includes('proyectos')) {
             headerRowIndex = i;
             headersRow0 = rawData[i].map(c => String(c || '').trim());
             
             if (i + 1 < rawData.length) {
                 const nextRowStrs = rawData[i+1].map(c => normalizarTexto(String(c || '')));
                 if (nextRowStrs.includes('metapropuesta') || nextRowStrs.includes('metaalcanzada')) {
                     headersRow1 = rawData[i+1].map(c => String(c || '').trim());
                     headerRowIndex = i + 1; // La data arranca después de la segunda cabecera
                 }
             }
             break;
         }
      }

      if (headerRowIndex === -1) {
          toast({ title: "Error de Formato", description: "No se encontraron las columnas 'Dependencia' y 'Proyectos'.", variant: "destructive" });
          setLoading(false);
          return;
      }

      const colMap: Record<string, number> = {
          dep: -1, proy: -1, prio: -1, est: -1, ref_nom: -1, ref_ape: -1, ref_cuil: -1,
          ref_dep: -1, ref_tel: -1, ref_mail: -1, og: -1, oe: -1, act_tipo: -1, act_desc: -1,
          ind_tipo: -1, ind_nombre: -1, ind_const: -1, ind_otro: -1, ind_fuente: -1,
          ind_base: -1, m2026: -1, m2027: -1, t1: -1, t2: -1, t3: -1, t4: -1
      };

      // Mapea las columnas encontradas buscando tanto en la fila superior como inferior de la cabecera
      const scanHeaders = (row: string[]) => {
          row.forEach((h, idx) => {
              const cleanH = normalizarTexto(h);
              if (cleanH === 'dependencia') colMap.dep = idx;
              else if (cleanH.includes('proyectos')) colMap.proy = idx;
              else if (cleanH === 'prioridad') colMap.prio = idx;
              else if (cleanH.includes('estado2026')) colMap.est = idx;
              else if (cleanH.includes('nombrereferente')) colMap.ref_nom = idx;
              else if (cleanH.includes('apellidoreferente')) colMap.ref_ape = idx;
              else if (cleanH.includes('cuil')) colMap.ref_cuil = idx;
              else if (cleanH.includes('dependenciareferente')) colMap.ref_dep = idx;
              else if (cleanH.includes('tel')) colMap.ref_tel = idx;
              else if (cleanH.includes('mail') || cleanH.includes('email')) colMap.ref_mail = idx;
              else if (cleanH.includes('objetivogeneral')) colMap.og = idx;
              else if (cleanH.includes('objetivosespecificos')) colMap.oe = idx;
              else if (cleanH.includes('tipoactividad')) colMap.act_tipo = idx;
              else if (cleanH.includes('actividadesprioritarias')) colMap.act_desc = idx;
              else if (cleanH.includes('tipodeindicador')) colMap.ind_tipo = idx;
              else if (cleanH.includes('nombreindicador')) colMap.ind_nombre = idx;
              else if (cleanH.includes('construccion')) colMap.ind_const = idx;
              else if (cleanH.includes('reportaaotro')) colMap.ind_otro = idx;
              else if (cleanH.includes('fuente')) colMap.ind_fuente = idx;
              else if (cleanH.includes('lineadebase')) colMap.ind_base = idx;
              else if (cleanH === '2026') colMap.m2026 = idx;
              else if (cleanH === '2027') colMap.m2027 = idx;
              else if (cleanH.includes('1ertrimestre')) colMap.t1 = idx;
              else if (cleanH.includes('2dotrimestre')) colMap.t2 = idx;
              else if (cleanH.includes('3ertrimestre')) colMap.t3 = idx;
              else if (cleanH.includes('4totrimestre')) colMap.t4 = idx;
          });
      };
      
      scanHeaders(headersRow0);
      if (headersRow1.length > 0) scanHeaders(headersRow1);

      const mappedRows: any[] = [];
      let ultimaDep = "", ultimoProy = "", ultimaPrio = "", ultimoEst = "", 
          ultimoRefNom = "", ultimoRefApe = "", ultimoCuil = "", ultimoMail = "", ultimoTel = "", 
          ultimoRefDep = "", ultimoOG = "", ultimoOE = "", ultimaActTipo = "", ultimaActDesc = "";

      const getCell = (row: any[], idx: number) => (idx !== -1 && row[idx] !== undefined) ? String(row[idx]).trim() : "";

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (row.length === 0 || row.every((c:any) => String(c).trim() === "")) continue;
          let esPorcentaje = false;
          const limpiarMeta = (val: any) => {
              if (!val) return "";
              const original = val.toString().trim();
              const upper = original.toUpperCase();
              if (upper === "" || upper === "N/A" || upper === "-") return "";
              let limpio = original;
              if (limpio.includes("%")) { esPorcentaje = true; limpio = limpio.replace(/%/g, "").trim(); }
              if (limpio.includes(",")) { limpio = limpio.replace(/,/g, "."); }
              return limpio;
          };

          const dep = getCell(row, colMap.dep) || ultimaDep;
          const proy = getCell(row, colMap.proy) || ultimoProy;
          const prio = getCell(row, colMap.prio) || ultimaPrio;
          const est = getCell(row, colMap.est) || ultimoEst;
          const refNom = getCell(row, colMap.ref_nom) || ultimoRefNom;
          const refApe = getCell(row, colMap.ref_ape) || ultimoRefApe;
          const cuil = getCell(row, colMap.ref_cuil).replace(/-/g, "") || ultimoCuil;
          const refDep = getCell(row, colMap.ref_dep) || ultimoRefDep;
          const tel = getCell(row, colMap.ref_tel) || ultimoTel;
          const mail = getCell(row, colMap.ref_mail) || ultimoMail;
          const og = getCell(row, colMap.og) || ultimoOG;
          const oe = getCell(row, colMap.oe) || ultimoOE;
          const actTipo = getCell(row, colMap.act_tipo) || ultimaActTipo;
          const actDesc = getCell(row, colMap.act_desc) || ultimaActDesc;

          const lineaBase = limpiarMeta(getCell(row, colMap.ind_base));
          const m2026 = limpiarMeta(getCell(row, colMap.m2026));
          const m2027 = limpiarMeta(getCell(row, colMap.m2027));
          const t1 = limpiarMeta(getCell(row, colMap.t1));
          const t2 = limpiarMeta(getCell(row, colMap.t2));
          const t3 = limpiarMeta(getCell(row, colMap.t3));
          const t4 = limpiarMeta(getCell(row, colMap.t4));

          const indTipoOriginal = getCell(row, colMap.ind_tipo);
          let tipoMetaCalculado = "cantidad"; 
          if (esPorcentaje) tipoMetaCalculado = "porcentaje";

          ultimaDep = dep; ultimoProy = proy; ultimaPrio = prio; ultimoEst = est;
          ultimoRefNom = refNom; ultimoRefApe = refApe; ultimoCuil = cuil; ultimoTel = tel; ultimoMail = mail; ultimoRefDep = refDep;
          ultimoOG = og; ultimoOE = oe; ultimaActTipo = actTipo; ultimaActDesc = actDesc;

          mappedRows.push({
            dependencia: dep,
            proyecto: { nombre: proy, prioridad: prio, estado: est },
            referente: { nombre: refNom, apellido: refApe, cuil: cuil, telefono: tel, email: mail, dependencia: refDep },
            objetivo_general: og,
            objetivo_especifico: oe,
            actividad: { tipo: actTipo, descripcion: actDesc },
            indicador: {
              tipo: indTipoOriginal, tipo_meta: tipoMetaCalculado, nombre: getCell(row, colMap.ind_nombre),
              construccion: getCell(row, colMap.ind_const), otro_sistema: getCell(row, colMap.ind_otro),
              fuente: getCell(row, colMap.ind_fuente), linea_base: lineaBase, meta_anio1: m2026, meta_anio2: m2027
            },
            monitoreo: { t1, t2, t3, t4 }
          });
      }

      const resumenMap = new Map<string, ProyectoResumen>();
      mappedRows.forEach(fila => {
          const key = `${fila.dependencia}|${fila.proyecto.nombre}`;
          if (!resumenMap.has(key)) {
              resumenMap.set(key, {
                  id_temp: key, selected: true, dependencia: fila.dependencia, proyecto: fila.proyecto.nombre,
                  objetivo_general: fila.objetivo_general, cant_oe: 0, cant_act: 0, cant_ind: 0, filas: []
              });
          }
          resumenMap.get(key)!.filas.push(fila);
      });

      resumenMap.forEach(p => {
          const oeSet = new Set(), actSet = new Set(), indSet = new Set();
          p.filas.forEach(f => {
              if (f.objetivo_especifico) oeSet.add(f.objetivo_especifico);
              if (f.actividad.descripcion) actSet.add(f.objetivo_especifico + f.actividad.descripcion);
              if (f.indicador.nombre) indSet.add(f.actividad.descripcion + f.indicador.nombre);
          });
          p.cant_oe = oeSet.size; p.cant_act = actSet.size; p.cant_ind = indSet.size;
      });

      setProyectosResumen(Array.from(resumenMap.values()));
      setVistaPrevia(true);
      setLoading(false);
    }
    reader.readAsBinaryString(file)
  }

  const toggleProjectSelection = (id_temp: string) => {
      setProyectosResumen(prev => prev.map(p => p.id_temp === id_temp ? { ...p, selected: !p.selected } : p));
  }

  const confirmarImportacion = async () => {
    const proyectosSeleccionados = proyectosResumen.filter(p => p.selected);
    if (proyectosSeleccionados.length === 0) {
        toast({ title: "Aviso", description: "Debe seleccionar al menos un proyecto.", variant: "destructive" });
        return;
    }
    const datosAEnviar = proyectosSeleccionados.flatMap(p => p.filas);
    setEnviando(true);
    try {
      const res = await fetch(`${API_BASE}/importar_confirmar.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datos: datosAEnviar, accion_referente: accionReferente }),
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setImportacionExitosa(true);
        setResumenGlobal(data.resumen);
        toast({ title: "Éxito", description: "Importación finalizada correctamente" });
      } else throw new Error(data.error || "Error desconocido");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setEnviando(false); }
  }

  const resetState = () => { setFile(null); setProyectosResumen([]); setVistaPrevia(false); setImportacionExitosa(false); }

  if (accesoDenegado) {
      return (
          <DashboardLayout currentSection="Importar Planificación">
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                  <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                  <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                  <p>Solo los Administradores pueden importar matrices al sistema.</p>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout currentSection="Importar Planificación">
      <div className="space-y-6">
        {!vistaPrevia && !importacionExitosa && (
          <div className="grid gap-6 md:grid-cols-1 mb-8">
            <Card className="border-blue-200 shadow-sm">
                <CardHeader className="bg-blue-50 pb-4 border-b border-blue-100">
                    <CardTitle className="flex items-center gap-2 text-blue-800">
                        <Download className="h-5 w-5" />
                        Exportar Matriz de Planificación
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="flex-1 w-full">
                            <Label htmlFor="dependencia-export">Seleccionar Dependencia a Exportar</Label>
                            <select 
                                id="dependencia-export"
                                className="flex h-10 w-full mt-1.5 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                value={dependenciaExportar}
                                onChange={(e) => setDependenciaExportar(e.target.value)}
                            >
                                <option value="">Seleccione una dependencia...</option>
                                <option value="TODAS">TODAS LAS PERMITIDAS</option>
                                {dependencias.map((dep: any) => (
                                    <option key={dep.sigla || dep.id_dependencia} value={dep.sigla}>
                                        {dep.sigla} {dep.descripcion ? `- ${dep.descripcion}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Button 
                            onClick={handleExportar} 
                            disabled={exportando || !dependenciaExportar}
                            className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                        >
                            {exportando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            {exportando ? "Generando..." : "Exportar Matriz"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Cargar Matriz de Planificación</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-12 text-center space-y-4">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-medium">Arrastre el archivo Excel aquí</p>
                  <Input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="max-w-xs mx-auto" />
                  {file && <Button onClick={procesarExcel} disabled={loading} className="w-full max-w-xs bg-blue-600">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Procesar Archivo"}</Button>}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {vistaPrevia && !importacionExitosa && (
            <Card>
                <CardHeader className="border-b bg-slate-50/50">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div><CardTitle>Vista Previa por Proyectos</CardTitle></div>
                        <RadioGroup value={accionReferente} onValueChange={setAccionReferente} className="flex flex-col md:flex-row gap-4 bg-white p-3 rounded border">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="actualizar" id="r1" /><Label htmlFor="r1" className="text-xs">Actualizar Referentes</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="ignorar" id="r2" /><Label htmlFor="r2" className="text-xs">Mantener contactos</Label></div>
                        </RadioGroup>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="rounded-md border overflow-hidden mb-6">
                        <Table>
                            <TableHeader className="bg-slate-100">
                                <TableRow>
                                    <TableHead className="w-12 text-center">Imp.</TableHead>
                                    <TableHead className="w-[10%]">Dep.</TableHead>
                                    <TableHead className="w-[30%]">Proyecto</TableHead>
                                    <TableHead className="w-[30%]">Objetivo General</TableHead>
                                    <TableHead className="text-center text-xs">Obj. Esp.</TableHead>
                                    <TableHead className="text-center text-xs">Actividades</TableHead>
                                    <TableHead className="text-center text-xs">Indicadores</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {proyectosResumen.map((p) => (
                                    <TableRow key={p.id_temp} className={p.selected ? 'bg-white' : 'bg-slate-50 opacity-60'}>
                                        <TableCell className="text-center align-middle">
                                            <input type="checkbox" className="h-4 w-4 cursor-pointer accent-blue-600" checked={p.selected} onChange={() => toggleProjectSelection(p.id_temp)} />
                                        </TableCell>
                                        <TableCell className="font-bold text-slate-700 text-xs align-top">{p.dependencia}</TableCell>
                                        <TableCell className="text-sm font-semibold text-blue-800 align-top">{p.proyecto}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground align-top">{p.objetivo_general.substring(0, 100)}...</TableCell>
                                        <TableCell className="text-center font-bold align-top">{p.cant_oe}</TableCell>
                                        <TableCell className="text-center font-bold align-top">{p.cant_act}</TableCell>
                                        <TableCell className="text-center font-bold align-top">{p.cant_ind}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={resetState} className="flex-1">Cancelar</Button>
                        <Button onClick={confirmarImportacion} disabled={enviando} className="flex-1 bg-blue-600 hover:bg-blue-700">
                            {enviando ? "Importando..." : `Confirmar Importación (${proyectosResumen.filter(p=>p.selected).length} Proyectos)`}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )}

        {importacionExitosa && (
            <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <AlertTitle className="text-lg font-bold text-green-800">¡Importación Exitosa!</AlertTitle>
                <AlertDescription className="text-green-700 mt-2">
                    <p>Se incorporaron a la base de datos: {resumenGlobal?.proyectos} Proyectos, {resumenGlobal?.actividades} Actividades y {resumenGlobal?.indicadores} Indicadores.</p>
                </AlertDescription>
                <Button variant="outline" size="sm" onClick={resetState} className="mt-4 border-green-600 text-green-700 hover:bg-green-100">Cargar otra matriz</Button>
            </Alert>
        )}
      </div>
    </DashboardLayout>
  )
}