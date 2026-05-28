/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2, XCircle, AlertTriangle, Upload, FileSpreadsheet,
  FileText, Trash2, ChevronDown, ChevronUp, Info
} from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface AreaHeader {
  dependencia: string;
  domicilio: string;
  piso: string;
  oficina: string;
  telefono: string;
  responsable: string;
}

interface ProcessedFile {
  sigla: string;
  fileName: string;
  personCount: number;
  issues: string[];
  warnings: string[];
  autoCompleted: string[];
  finalRows: any[][];
}

// ─── Datos de referencia (extraídos del unificado enero 2026) ─────────────────

const REFERENCE_HEADERS: Record<string, AreaHeader> = {
  SSRSyA: {
    dependencia: 'DEPENDENCIA: Ministerio de Salud de la Nación',
    domicilio: 'DOMICILIO:  Av 9 de Julio 1925',
    piso: 'PISO: 6to',
    oficina: 'OFICINA:',
    telefono: 'TELEFONO: 4379-9000 int. 4451',
    responsable: 'RESPONSABLE DE ASISTENCIA: Andrea KUSZCZAK y Christian D. VAZQUEZ',
  },
  DNAPySC: {
    dependencia: 'DEPENDENCIA: Ministerio de Salud de la Nación',
    domicilio: 'DOMICILIO:  Av 9 de Julio 1925',
    piso: 'PISO: 12',
    oficina: 'OFICINA: 1202',
    telefono: 'TELEFONO:  4379-9000,  Interno: 4866',
    responsable: 'RESPONSABLE DE ASISTENCIA:  Alexa Méndez,  Liliana Rearte',
  },
  DNACV: {
    dependencia: 'DEPENDENCIA: Ministerio de Salud de la Nación',
    domicilio: 'DOMICILIO:  Av 9 de Julio 1925',
    piso: 'PISO: 11',
    oficina: 'OFICINA: Ala moreno',
    telefono: 'TELEFONO: 4379-9000 / int. 4873',
    responsable: 'RESPONSABLE DE ASISTENCIA: Claudia Viviana Duarte / Marcela Cristina Dominguez Rodriguez',
  },
  DISAPENIA: {
    dependencia: 'DEPENDENCIA: Ministerio de Salud de la Nación',
    domicilio: 'DOMICILIO:  Av 9 de Julio 1925',
    piso: 'PISO: 11',
    oficina: 'OFICINA:',
    telefono: 'TELEFONO: 4379-9000 / int. 4987',
    responsable: 'RESPONSABLE DE ASISTENCIA:',
  },
  DIJUPAM: {
    dependencia: 'DEPENDENCIA: Ministerio de Salud de la Nación',
    domicilio: 'DOMICILIO:  Av 9 de Julio 1925',
    piso: 'PISO: 11',
    oficina: 'OFICINA: ALA MORENO',
    telefono: 'TELEFONO: 4379-9000- interno 9223 - 4858',
    responsable: 'RESPONSABLE DE ASISTENCIA: Lic. Lorena Bordenave',
  },
  DNSSyR: {
    dependencia: 'DEPENDENCIA: Ministerio de Salud de la Nación',
    domicilio: 'DOMICILIO:  Bernardo de Irigoyen 296',
    piso: 'PISO:',
    oficina: 'OFICINA:',
    telefono: 'TELÉFONO: S/D',
    responsable: 'RESPONSABLE DE ASISTENCIA: Laura Amodeo / Teresa Smoler',
  },
  DNFSP: {
    dependencia: 'DEPENDENCIA: Dirección Nacional de Fortalecimiento de los Sistemas Provinciales',
    domicilio: 'DOMICILIO:  Bernardo de Irigoyen 296',
    piso: 'PISO: 10',
    oficina: 'OFICINA:',
    telefono: 'TELEFONO: 011-5042-0756',
    responsable: 'RESPONSABLE DE ASISTENCIA: Tec. Samantha Seoane Verges',
  },
  DTFP: {
    dependencia: 'DEPENDENCIA: Ministerio de Salud de la Nación',
    domicilio: 'DOMICILIO:  Av 9 de Julio 1925',
    piso: 'PISO: 6',
    oficina: 'OFICINA:',
    telefono: 'TELEFONO:',
    responsable: 'RESPONSABLE DE ASISTENCIA: ',
  },
  CSI: {
    dependencia: 'DEPENDENCIA: Ministerio de Salud de la Nación',
    domicilio: 'DOMICILIO:  Av 9 de Julio 1925',
    piso: 'PISO: 12',
    oficina: 'OFICINA:',
    telefono: 'TELEFONO: 4379-9000. Int 4866',
    responsable: 'RESPONSABLE DE ASISTENCIA: Felix Nehuen CORREA LAURI',
  },
};

const AREA_NAMES: Record<string, string> = {
  SSRSyA:    'Subse. Relaciones Sectoriales y Articulación',
  DNSSyR:    'Dir. Nac. Salud Sexual y Reproductiva',
  DNACV:     'Dir. Nac. Abordaje por Curso de Vida',
  DISAPENIA: 'Dir. Salud Perinatal, Niñez y Adolescencia',
  DIJUPAM:   'Dir. Juventudes y de la Persona Adulta y Mayor',
  DNAPySC:   'Dir. Nac. Atención Primaria y Salud Comunitaria',
  DNFSP:     'Dir. Nac. Fortalecimiento Sistemas Provinciales',
  DTFP:      'Dir. Transferencias Financieras a Provincias',
  CSI:       'Coord. Salud Intercultural',
};

const SHEET_ORDER = ['SSRSyA', 'DNAPySC', 'DNACV', 'DISAPENIA', 'DIJUPAM', 'DNSSyR', 'DNFSP', 'DTFP', 'CSI'];

const MESES = [
  'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractValue(label: any): string {
  if (label == null) return '';
  const s = String(label);
  const idx = s.indexOf(':');
  if (idx === -1) return s.trim();
  return s.substring(idx + 1).trim();
}

function isFieldEmpty(val: any): boolean {
  if (val == null) return true;
  return extractValue(val) === '';
}

function detectArea(rows: any[][]): string | null {
  for (let i = 5; i < Math.min(rows.length, 12); i++) {
    const unidad = String(rows[i]?.[6] ?? '').toUpperCase();
    if (!unidad) continue;
    if (unidad.includes('SUBSE') && unidad.includes('RELACIONES')) return 'SSRSyA';
    if (unidad.includes('SALUD SEXUAL')) return 'DNSSyR';
    if (unidad.includes('ABORDAJE') || unidad.includes('CURSO DE VIDA')) return 'DNACV';
    if (unidad.includes('PERINATAL')) return 'DISAPENIA';
    if (unidad.includes('JUVENTUDES')) return 'DIJUPAM';
    if (unidad.includes('PRIMARIA') && unidad.includes('SALUD')) return 'DNAPySC';
    if (unidad.includes('FORTALECIMIENTO')) return 'DNFSP';
    if (unidad.includes('TRANSFERENCIAS') && unidad.includes('FINANC')) return 'DTFP';
    if (unidad.includes('INTERCULTURAL')) return 'CSI';
  }
  return null;
}

function processFile(rows: any[][], sigla: string, fileName: string): ProcessedFile {
  // Copia profunda de las filas
  const finalRows: any[][] = rows.map(r => Array.isArray(r) ? [...r] : []);
  const ref = REFERENCE_HEADERS[sigla];
  const issues: string[] = [];
  const warnings: string[] = [];
  const autoCompleted: string[] = [];

  function ensureRow(idx: number) {
    while (finalRows.length <= idx) finalRows.push([]);
    while (finalRows[idx].length < 10) finalRows[idx].push(null);
  }

  function checkFix(rowIdx: number, colIdx: number, label: string, refVal: string, optional = false) {
    ensureRow(rowIdx);
    const cur = finalRows[rowIdx][colIdx];
    if (isFieldEmpty(cur)) {
      const refExtracted = extractValue(refVal);
      if (refExtracted !== '') {
        finalRows[rowIdx][colIdx] = refVal;
        autoCompleted.push(label);
      } else if (!optional) {
        issues.push(`${label} vacío y sin dato de referencia`);
      }
    }
  }

  checkFix(0, 0, 'DEPENDENCIA',              ref.dependencia);
  checkFix(1, 0, 'DOMICILIO',                ref.domicilio);
  checkFix(1, 5, 'PISO',                     ref.piso);
  checkFix(1, 6, 'OFICINA',                  ref.oficina, true);
  checkFix(2, 0, 'TELÉFONO',                 ref.telefono);
  checkFix(3, 0, 'RESPONSABLE DE ASISTENCIA', ref.responsable);

  // Validar domicilio laboral (col I = índice 8) en filas de datos
  const dataRows = finalRows.slice(5).filter(r => r.some((c: any) => c != null));
  const missing = dataRows.filter(r => r[8] == null || String(r[8]).trim() === '').length;
  if (missing > 0) {
    warnings.push(`${missing} persona(s) sin Domicilio laboral`);
  }

  // Truncar a 10 columnas (A-J), eliminando K en adelante
  const cleanRows = finalRows.map(r => r.slice(0, 10));

  return { sigla, fileName, personCount: dataRows.length, issues, warnings, autoCompleted, finalRows: cleanRows };
}

async function generateExcel(files: Map<string, ProcessedFile>, mes: string) {
  const wb = XLSX.utils.book_new();
  for (const sigla of SHEET_ORDER) {
    const pf = files.get(sigla);
    if (!pf) continue;
    const ws = XLSX.utils.aoa_to_sheet(pf.finalRows);
    XLSX.utils.book_append_sheet(wb, ws, sigla);
  }
  const mesCapitalized = mes.charAt(0) + mes.slice(1).toLowerCase();
  XLSX.writeFile(wb, `SSRSyA_-_Certificación_de_Servicios_-_${mesCapitalized}_2026.xlsx`);
}

async function generateDocx(mes: string, autoCompletions: { sigla: string; items: string[] }[]) {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Referencia: CERTIFICACIÓN DE SERVICIOS DEL PERSONAL - SUBSECRETARÍA DE RELACIONES SECTORIALES Y ARTICULACIÓN - "${mes} 2026"`,
          size: 24,
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Destinatarios: AGUZMAN, LIFERNANDEZ, VREYES, JFILIPOWICZ, DRIQUELME, EPICHIONI',
          size: 24,
        }),
      ],
      spacing: { after: 400 },
    }),
  );

  const withAC = autoCompletions.filter(a => a.items.length > 0);
  if (withAC.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'NOTA INTERNA — Campos completados automáticamente:', bold: true, size: 22 }),
        ],
        spacing: { before: 400, after: 160 },
      }),
    );
    for (const { sigla, items } of withAC) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `• ${AREA_NAMES[sigla] ?? sigla}: ${items.join(', ')}`, size: 20 }),
          ],
          spacing: { after: 80 },
        }),
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Nota_Certificacion_${mes}_2026.docx`);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CertificacionServiciosPage() {
  const [mes, setMes] = useState('');
  const [files, setFiles] = useState<Map<string, ProcessedFile>>(new Map());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [unrecognized, setUnrecognized] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleCard = (sigla: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(sigla) ? next.delete(sigla) : next.add(sigla);
      return next;
    });
  };

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const newUnrecognized: string[] = [];

    for (const file of arr) {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];

      const sigla = detectArea(rows);
      if (!sigla) {
        newUnrecognized.push(file.name);
        continue;
      }

      const processed = processFile(rows, sigla, file.name);
      setFiles(prev => new Map(prev).set(sigla, processed));
    }

    if (newUnrecognized.length > 0) {
      setUnrecognized(prev => [...prev, ...newUnrecognized]);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (sigla: string) => {
    setFiles(prev => { const next = new Map(prev); next.delete(sigla); return next; });
    setExpandedCards(prev => { const next = new Set(prev); next.delete(sigla); return next; });
  };

  const clearAll = () => {
    setFiles(new Map());
    setExpandedCards(new Set());
    setUnrecognized([]);
  };

  const handleGenerate = async () => {
    if (!mes || files.size === 0) return;
    setGenerating(true);
    try {
      await generateExcel(files, mes);
      const autoCompletions = SHEET_ORDER
        .filter(s => files.has(s))
        .map(s => ({ sigla: s, items: files.get(s)!.autoCompleted }));
      await generateDocx(mes, autoCompletions);
    } finally {
      setGenerating(false);
    }
  };

  const totalPersonas = Array.from(files.values()).reduce((s, f) => s + f.personCount, 0);
  const totalIssues   = Array.from(files.values()).reduce((s, f) => s + f.issues.length, 0);
  const totalWarnings = Array.from(files.values()).reduce((s, f) => s + f.warnings.length, 0);
  const totalAC       = Array.from(files.values()).reduce((s, f) => s + f.autoCompleted.length, 0);
  const missingAreas  = SHEET_ORDER.filter(s => !files.has(s));
  const canGenerate   = mes !== '' && files.size > 0 && totalIssues === 0;

  return (
    <DashboardLayout currentSection="RRHH">
      <div className="p-6 space-y-6 max-w-5xl mx-auto">

        {/* Encabezado */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Certificación de Servicios Mensual</h1>
          <p className="text-muted-foreground mt-1">
            Consolidación de planillas por área → Excel unificado + nota de envío
          </p>
        </div>

        {/* Selector de mes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1. Mes a certificar</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Seleccioná el mes…" />
              </SelectTrigger>
              <SelectContent>
                {MESES.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Zona de carga */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2. Cargar planillas de las áreas</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Arrastrá los archivos acá o hacé click para seleccionar</p>
              <p className="text-xs text-muted-foreground mt-1">Podés cargar varios a la vez. El área se detecta automáticamente.</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                multiple
                className="hidden"
                onChange={onInputChange}
              />
            </div>

            {unrecognized.length > 0 && (
              <Alert variant="destructive" className="mt-3">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  No se pudo detectar el área de: <strong>{unrecognized.join(', ')}</strong>
                </AlertDescription>
              </Alert>
            )}

            {files.size > 0 && missingAreas.length > 0 && (
              <Alert className="mt-3">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Áreas sin cargar: <strong>{missingAreas.map(s => AREA_NAMES[s]).join(', ')}</strong>.
                  Podés generar igual con las que tenés.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Validación */}
        {files.size > 0 && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                3. Resultado de la validación
                <span className="ml-2 text-muted-foreground font-normal text-sm">
                  ({files.size}/{SHEET_ORDER.length} áreas · {totalPersonas} personas)
                </span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Limpiar todo
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-3 flex-wrap mb-3">
                {totalIssues > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> {totalIssues} error(es)
                  </Badge>
                )}
                {totalWarnings > 0 && (
                  <Badge variant="outline" className="gap-1 border-yellow-400 text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-3 w-3" /> {totalWarnings} advertencia(s)
                  </Badge>
                )}
                {totalAC > 0 && (
                  <Badge variant="outline" className="gap-1 border-blue-400 text-blue-700 dark:text-blue-400">
                    <Info className="h-3 w-3" /> {totalAC} campo(s) autocompletado(s)
                  </Badge>
                )}
                {totalIssues === 0 && totalWarnings === 0 && totalAC === 0 && (
                  <Badge variant="outline" className="gap-1 border-green-500 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" /> Todo OK
                  </Badge>
                )}
              </div>

              {SHEET_ORDER.filter(s => files.has(s)).map(sigla => {
                const pf = files.get(sigla)!;
                const expanded = expandedCards.has(sigla);
                const hasDetail = pf.issues.length + pf.warnings.length + pf.autoCompleted.length > 0;
                const statusIcon =
                  pf.issues.length > 0   ? <XCircle className="h-4 w-4 text-destructive" /> :
                  pf.warnings.length > 0  ? <AlertTriangle className="h-4 w-4 text-yellow-500" /> :
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />;

                return (
                  <div key={sigla} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center px-4 py-3 gap-3 bg-muted/20">
                      {statusIcon}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{sigla}</span>
                          <span className="text-xs text-muted-foreground">{AREA_NAMES[sigla]}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{pf.fileName}</div>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">{pf.personCount} personas</Badge>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => removeFile(sigla)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      {hasDetail && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => toggleCard(sigla)}>
                          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>

                    {expanded && hasDetail && (
                      <div className="px-4 py-3 space-y-1.5 border-t bg-background text-sm">
                        {pf.issues.map((iss, i) => (
                          <div key={i} className="flex items-start gap-2 text-destructive">
                            <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>{iss}</span>
                          </div>
                        ))}
                        {pf.warnings.map((w, i) => (
                          <div key={i} className="flex items-start gap-2 text-yellow-700 dark:text-yellow-400">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>{w}</span>
                          </div>
                        ))}
                        {pf.autoCompleted.map((ac, i) => (
                          <div key={i} className="flex items-start gap-2 text-blue-700 dark:text-blue-400">
                            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>{ac} (completado desde referencia)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Generar */}
        {files.size > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">4. Generar archivos</CardTitle>
            </CardHeader>
            <CardContent>
              {!mes && (
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>Seleccioná el mes antes de generar.</AlertDescription>
                </Alert>
              )}
              {totalIssues > 0 && (
                <Alert variant="destructive" className="mb-4">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Hay errores en: {Array.from(files.values()).filter(f => f.issues.length > 0).map(f => f.sigla).join(', ')}. Corregí y recargá esos archivos.
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={handleGenerate} disabled={!canGenerate || generating} className="gap-2">
                {generating
                  ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  : <><FileSpreadsheet className="h-4 w-4" /><FileText className="h-4 w-4" /></>
                }
                {generating ? 'Generando…' : 'Generar Excel + Nota .docx'}
              </Button>

              {canGenerate && (
                <p className="text-xs text-muted-foreground mt-3">
                  Se descargarán dos archivos: el Excel unificado y la nota Word con el mes <strong>{mes}</strong>.
                </p>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}
