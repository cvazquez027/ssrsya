<?php
// api-backend/proyecto-detalle.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
header("Content-Type: application/json");

$id = $_GET['id'] ?? null;

if (!$id) {
    echo json_encode(["error" => "ID requerido"]);
    exit;
}

try {
    $pdo = getDB();

    $sql = "SELECT 
                p.*,
                d.descripcion as dependencia_descripcion,
                og.descripcion as objetivo_general, 
                CONCAT(r.apellido, ', ', r.nombre) as autoridad_nombre,
                r.cuil as autoridad_cuil,
                tep.descripcion as estado_descripcion
            FROM proyecto p
            LEFT JOIN dependencia d ON p.sigla_dependencia = d.sigla
            LEFT JOIN objetivo_general og ON p.id_proyecto = og.id_proyecto
            LEFT JOIN referente r ON d.id_referente = r.id_referente
            LEFT JOIN tipo_estado_proyecto tep ON p.estado_proyecto = tep.id_tipo_estado_proyecto
            WHERE p.id_proyecto = ?";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id]);
    $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$proyecto) {
        echo json_encode(["error" => "Proyecto no encontrado"]);
        exit;
    }

    $stmtRefs = $pdo->prepare("SELECT r.id_referente, CONCAT(r.apellido, ', ', r.nombre) as nombre, r.cuil FROM proyecto_referente pr JOIN referente r ON pr.id_referente = r.id_referente WHERE pr.id_proyecto = ?");
    $stmtRefs->execute([$id]);
    $proyecto['referentes'] = $stmtRefs->fetchAll(PDO::FETCH_ASSOC);

    // CIRUGÍA: Agregamos i.construccion a la consulta
    $sqlDetalle = "SELECT 
                    oe.id_oe, oe.descripcion as oe_desc,
                    a.id_actividad, a.descripcion as act_desc,
                    i.id_indicador, i.nombre as ind_nombre, i.construccion,
                    i.meta_anio1, i.meta_anio2, i.tipo_meta,
                    m.id_monitoreo, 
                    m.id_periodo_monitoreo,
                    pm.descripcion as periodo_descripcion,
                    m.meta_propuesta, 
                    m.meta_alcanzada, 
                    m.observaciones,
                    m.no_aplica
                   FROM objetivo_especifico oe
                   LEFT JOIN actividad_prioritaria a ON oe.id_oe = a.id_oe
                   LEFT JOIN indicador i ON a.id_actividad = i.id_actividad
                   LEFT JOIN monitoreo m ON i.id_indicador = m.id_indicador
                   LEFT JOIN periodo_monitoreo pm ON m.id_periodo_monitoreo = pm.id_periodo_monitoreo
                   WHERE oe.id_og = (SELECT id_og FROM objetivo_general WHERE id_proyecto = ?)
                   ORDER BY oe.id_oe, a.id_actividad, i.id_indicador, m.id_periodo_monitoreo";

    $stmtDetalle = $pdo->prepare($sqlDetalle);
    $stmtDetalle->execute([$id]);
    $filas = $stmtDetalle->fetchAll(PDO::FETCH_ASSOC);

    $objetivos = [];
    foreach ($filas as $f) {
        $id_oe = $f['id_oe'];
        if (!isset($objetivos[$id_oe])) {
            $objetivos[$id_oe] = ['id_oe' => $id_oe, 'descripcion' => $f['oe_desc'], 'actividades' => []];
        }

        $id_act = $f['id_actividad'];
        if ($id_act) {
            if (!isset($objetivos[$id_oe]['actividades'][$id_act])) {
                $objetivos[$id_oe]['actividades'][$id_act] = ['id_actividad' => $id_act, 'descripcion' => $f['act_desc'], 'indicadores' => []];
            }

            $id_ind = $f['id_indicador'];
            if ($id_ind) {
                if (!isset($objetivos[$id_oe]['actividades'][$id_act]['indicadores'][$id_ind])) {
                    $objetivos[$id_oe]['actividades'][$id_act]['indicadores'][$id_ind] = [
                        'id_indicador' => $id_ind,
                        'nombre' => $f['ind_nombre'],
                        'construccion' => $f['construccion'], // CIRUGÍA: Lo pasamos al JSON
                        'meta_anio1' => $f['meta_anio1'],
                        'meta_anio2' => $f['meta_anio2'],
                        'tipo_meta' => $f['tipo_meta'] ?? 'cantidad',
                        'monitoreos' => []
                    ];
                }

                if ($f['id_monitoreo']) {
                    $objetivos[$id_oe]['actividades'][$id_act]['indicadores'][$id_ind]['monitoreos'][] = [
                        'id_monitoreo' => $f['id_monitoreo'],
                        'id_periodo_monitoreo' => $f['id_periodo_monitoreo'],
                        'periodo_descripcion' => $f['periodo_descripcion'] ?? 'Sin periodo',
                        'meta_propuesta' => $f['meta_propuesta'],
                        'meta_alcanzada' => $f['meta_alcanzada'],
                        'observaciones' => $f['observaciones'],
                        'no_aplica' => $f['no_aplica']
                    ];
                }
            }
        }
    }

    $sum_project = 0;
    $count_project = 0;

    foreach ($objetivos as &$oe) {
        foreach ($oe['actividades'] as &$act) {
            foreach ($act['indicadores'] as &$ind) {
                $sum_ind = 0;
                $count_ind = 0;
                
                foreach ($ind['monitoreos'] as $m) {
                    if (isset($m['no_aplica']) && $m['no_aplica'] == 1) {
                        continue;
                    }

                    if ($m['meta_propuesta'] !== null && is_numeric($m['meta_propuesta'])) {
                        $prop = floatval($m['meta_propuesta']);
                        if ($prop > 0) {
                            $alc = ($m['meta_alcanzada'] !== null && is_numeric($m['meta_alcanzada'])) ? floatval($m['meta_alcanzada']) : 0;
                            $val = ($alc / $prop) * 100;
                            if ($val > 100) $val = 100;
                            $sum_ind += $val;
                            $count_ind++;
                        }
                    }
                }
                
                $avance_indicador = ($count_ind > 0) ? ($sum_ind / $count_ind) : 0;
                $sum_project += $avance_indicador;
                $count_project++; 
            }
            $act['indicadores'] = array_values($act['indicadores']);
        }
        $oe['actividades'] = array_values($oe['actividades']);
    }
    
    $proyecto['objetivos_especificos'] = array_values($objetivos);
    $proyecto['avance_porcentaje'] = $count_project > 0 ? round($sum_project / $count_project, 1) . "%" : "0%";

    echo json_encode(["proyecto" => $proyecto]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>