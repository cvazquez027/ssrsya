<?php
// api-backend/metricas_totales.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';
require __DIR__ . '/auth_utils.php';

if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401);
    echo json_encode(["error" => "No autorizado"]);
    exit;
}

header("Content-Type: application/json");

try {
    $pdo = getDB();
    $id_usuario = $_SESSION['usuario_id'];

    $stmtRol = $pdo->prepare("SELECT rol FROM usuario_modulo WHERE id_usuario = ? AND id_modulo = (SELECT id_modulo FROM modulo WHERE clave = 'PLANIFICACION')");
    $stmtRol->execute([$id_usuario]);
    $rol_planificacion = $stmtRol->fetchColumn() ?: 'consulta';

    // --- CIRUGÍA: Filtro RLS ---
    $filtro = getSQLFilter($pdo, $id_usuario, $rol_planificacion, 'p.sigla_dependencia');
    $whereFiltro = is_array($filtro) ? $filtro['sql'] : "";
    $params = is_array($filtro) ? $filtro['params'] : [];

    // 1. Proyectos
    $sql = "SELECT COUNT(*) as count FROM proyecto p WHERE 1=1 " . $whereFiltro;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $proyectos = $stmt->fetch()['count'];

    // 2. OEs
    $sql = "SELECT COUNT(DISTINCT oe.id_oe) as count 
            FROM objetivo_especifico oe 
            INNER JOIN objetivo_general og ON oe.id_og = og.id_og 
            INNER JOIN proyecto p ON og.id_proyecto = p.id_proyecto 
            WHERE 1=1 " . $whereFiltro;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $obsEspecificos = $stmt->fetch()['count'];

    // 3. Actividades
    $sql = "SELECT COUNT(DISTINCT a.id_actividad) as count 
            FROM actividad_prioritaria a 
            INNER JOIN objetivo_especifico oe ON a.id_oe = oe.id_oe 
            INNER JOIN objetivo_general og ON oe.id_og = og.id_og 
            INNER JOIN proyecto p ON og.id_proyecto = p.id_proyecto 
            WHERE 1=1 " . $whereFiltro;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $actividades = $stmt->fetch()['count'];

    // 4. Indicadores
    $sql = "SELECT COUNT(DISTINCT i.id_indicador) as count 
            FROM indicador i 
            INNER JOIN actividad_prioritaria a ON i.id_actividad = a.id_actividad 
            INNER JOIN objetivo_especifico oe ON a.id_oe = oe.id_oe 
            INNER JOIN objetivo_general og ON oe.id_og = og.id_og 
            INNER JOIN proyecto p ON og.id_proyecto = p.id_proyecto 
            WHERE 1=1 " . $whereFiltro;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $indicadores = $stmt->fetch()['count'];

    // 5. Avance General
    $sqlAvance = "SELECT 
                    p.id_proyecto,
                    p.descripcion as proyecto_nombre,
                    i.id_indicador,
                    m.meta_propuesta,
                    m.meta_alcanzada,
                    m.no_aplica
                  FROM indicador i
                  INNER JOIN actividad_prioritaria a ON i.id_actividad = a.id_actividad
                  INNER JOIN objetivo_especifico oe ON a.id_oe = oe.id_oe
                  INNER JOIN objetivo_general og ON oe.id_og = og.id_og
                  INNER JOIN proyecto p ON og.id_proyecto = p.id_proyecto
                  LEFT JOIN monitoreo m ON i.id_indicador = m.id_indicador
                  WHERE p.estado_proyecto = 3 " . $whereFiltro;

    $stmtAvance = $pdo->prepare($sqlAvance);
    $stmtAvance->execute($params);
    $monitoreos = $stmtAvance->fetchAll(PDO::FETCH_ASSOC);

    $proyectos_data = [];
    foreach ($monitoreos as $row) {
        $p_id = $row['id_proyecto'];
        if (!isset($proyectos_data[$p_id])) {
            $proyectos_data[$p_id] = [
                'nombre' => $row['proyecto_nombre'],
                'indicadores' => []
            ];
        }
        $i_id = $row['id_indicador'];
        if (!isset($proyectos_data[$p_id]['indicadores'][$i_id])) {
            $proyectos_data[$p_id]['indicadores'][$i_id] = [];
        }
        if ($row['meta_propuesta'] !== null || $row['meta_alcanzada'] !== null || $row['no_aplica'] !== null) {
            $proyectos_data[$p_id]['indicadores'][$i_id][] = [
                'prop' => $row['meta_propuesta'],
                'alc' => $row['meta_alcanzada'],
                'na' => $row['no_aplica']
            ];
        }
    }

    $proyectos_avance = [];
    $sum_global = 0;
    $count_global = 0;

    foreach ($proyectos_data as $p_id => $p_data) {
        $sum_p = 0;
        $count_p = 0;
        
        foreach ($p_data['indicadores'] as $i_id => $monis) {
            if (empty($monis)) continue;
            $sum_ind = 0;
            $count_ind = 0;
            
            foreach ($monis as $m) {
                if ($m['na'] == 1) continue;
                if ($m['prop'] !== null && is_numeric($m['prop'])) {
                    $prop = floatval($m['prop']);
                    if ($prop > 0) {
                        $alc = ($m['alc'] !== null && is_numeric($m['alc'])) ? floatval($m['alc']) : 0;
                        $val = ($alc / $prop) * 100;
                        if ($val > 100) $val = 100;
                        $sum_ind += $val;
                        $count_ind++;
                    }
                }
            }
            
            $avance_indicador = ($count_ind > 0) ? ($sum_ind / $count_ind) : 0;
            $sum_p += $avance_indicador;
            $count_p++;
            
            $sum_global += $avance_indicador;
            $count_global++;
        }
        
        $proyectos_avance[] = [
            'nombre' => $p_data['nombre'],
            'avance' => ($count_p > 0) ? round($sum_p / $count_p, 1) : 0
        ];
    }

    usort($proyectos_avance, function($a, $b) {
        return $b['avance'] <=> $a['avance'];
    });

    $avancePromedio = ($count_global > 0) ? round($sum_global / $count_global, 1) . "%" : "0%";

    echo json_encode([
        "cantidadProyectos" => $proyectos, 
        "cantidadObjetivosEspecificos" => $obsEspecificos,
        "cantidadActividades" => $actividades,
        "cantidadIndicadores" => $indicadores,
        "avancePromedio" => $avancePromedio,
        "proyectos_avance" => $proyectos_avance
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>