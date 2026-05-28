<?php
// api-backend/asociar_categoria.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';

if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401); echo json_encode(["error" => "No autorizado"]); exit;
}

header("Content-Type: application/json");
$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();

try {
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id_indicador']) || empty($input['id_categoria'])) throw new Exception("Faltan datos");
        
        $stmt = $pdo->prepare("INSERT IGNORE INTO indicador_categoria (id_indicador, id_categoria) VALUES (?, ?)");
        $stmt->execute([$input['id_indicador'], $input['id_categoria']]);
        echo json_encode(["success" => true, "mensaje" => "Asociación guardada"]);
        exit;
    } 
    
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $pdo->prepare("DELETE FROM indicador_categoria WHERE id_indicador=? AND id_categoria=?")
            ->execute([$input['id_indicador'], $input['id_categoria']]);
        echo json_encode(["success" => true]);
        exit;
    }
    
    if ($method === 'GET') {
        // MODIFICACIÓN QUIRÚRGICA: Nuevo endpoint para buscar indicadores por proyecto
        $accion = $_GET['accion'] ?? '';
        if ($accion === 'indicadores') {
            $id_proyecto = $_GET['id_proyecto'] ?? null;
            if (!$id_proyecto) { echo json_encode([]); exit; }

            $sqlInd = "SELECT i.id_indicador, i.nombre 
                       FROM indicador i
                       JOIN actividad_prioritaria ap ON i.id_actividad = ap.id_actividad
                       JOIN objetivo_especifico oe ON ap.id_oe = oe.id_oe
                       JOIN objetivo_general og ON oe.id_og = og.id_og
                       WHERE og.id_proyecto = ?
                       ORDER BY i.nombre";
            $stmtInd = $pdo->prepare($sqlInd);
            $stmtInd->execute([$id_proyecto]);
            echo json_encode($stmtInd->fetchAll(PDO::FETCH_ASSOC));
            exit;
        }

        // Endpoint original para la grilla
        $id_categoria = $_GET['id_categoria'] ?? null;
        $where = $id_categoria ? "WHERE ic.id_categoria = ?" : "WHERE c.vigente = 1";
        
        $sql = "SELECT 
                    c.id_categoria, c.nombre as categoria_nombre,
                    p.id_proyecto, p.descripcion as proyecto_desc, p.sigla_dependencia,
                    oe.id_oe, oe.descripcion as oe_desc,
                    ap.id_actividad, ap.descripcion as act_desc,
                    i.id_indicador, i.nombre as ind_nombre, i.tipo_meta, i.meta_anio1, i.meta_anio2,
                    m.id_monitoreo, m.id_periodo_monitoreo, pm.descripcion as periodo_desc, 
                    m.meta_propuesta, m.meta_alcanzada, m.observaciones, m.no_aplica
                FROM indicador_categoria ic
                JOIN categoria c ON ic.id_categoria = c.id_categoria
                JOIN indicador i ON ic.id_indicador = i.id_indicador
                JOIN actividad_prioritaria ap ON i.id_actividad = ap.id_actividad
                JOIN objetivo_especifico oe ON ap.id_oe = oe.id_oe
                JOIN objetivo_general og ON oe.id_og = og.id_og
                JOIN proyecto p ON og.id_proyecto = p.id_proyecto
                LEFT JOIN monitoreo m ON i.id_indicador = m.id_indicador
                LEFT JOIN periodo_monitoreo pm ON m.id_periodo_monitoreo = pm.id_periodo_monitoreo
                $where
                ORDER BY c.nombre, p.id_proyecto, oe.id_oe, ap.id_actividad, i.id_indicador, pm.id_periodo_monitoreo";

        $stmt = $pdo->prepare($sql);
        if ($id_categoria) $stmt->execute([$id_categoria]); else $stmt->execute();
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Agrupación jerárquica para la grilla
        $asociaciones = [];
        foreach ($filas as $f) {
            $kCat = $f['id_categoria']; $kProy = $f['id_proyecto']; $kOE = $f['id_oe']; $kAct = $f['id_actividad']; $kInd = $f['id_indicador'];

            if (!isset($asociaciones[$kCat])) $asociaciones[$kCat] = ['id_categoria' => $kCat, 'nombre' => $f['categoria_nombre'], 'proyectos' => []];
            if (!isset($asociaciones[$kCat]['proyectos'][$kProy])) $asociaciones[$kCat]['proyectos'][$kProy] = ['id_proyecto' => $kProy, 'descripcion' => $f['proyecto_desc'], 'sigla' => $f['sigla_dependencia'], 'objetivos' => []];
            if (!isset($asociaciones[$kCat]['proyectos'][$kProy]['objetivos'][$kOE])) $asociaciones[$kCat]['proyectos'][$kProy]['objetivos'][$kOE] = ['id_oe' => $kOE, 'descripcion' => $f['oe_desc'], 'actividades' => []];
            if (!isset($asociaciones[$kCat]['proyectos'][$kProy]['objetivos'][$kOE]['actividades'][$kAct])) $asociaciones[$kCat]['proyectos'][$kProy]['objetivos'][$kOE]['actividades'][$kAct] = ['id_actividad' => $kAct, 'descripcion' => $f['act_desc'], 'indicadores' => []];
            if (!isset($asociaciones[$kCat]['proyectos'][$kProy]['objetivos'][$kOE]['actividades'][$kAct]['indicadores'][$kInd])) {
                $asociaciones[$kCat]['proyectos'][$kProy]['objetivos'][$kOE]['actividades'][$kAct]['indicadores'][$kInd] = [
                    'id_indicador' => $kInd, 'nombre' => $f['ind_nombre'], 'tipo_meta' => $f['tipo_meta'], 'meta_anio1' => $f['meta_anio1'], 'meta_anio2' => $f['meta_anio2'], 'monitoreos' => []
                ];
            }
            if ($f['id_monitoreo']) {
                $asociaciones[$kCat]['proyectos'][$kProy]['objetivos'][$kOE]['actividades'][$kAct]['indicadores'][$kInd]['monitoreos'][] = [
                    'id_monitoreo' => $f['id_monitoreo'], 'periodo_descripcion' => $f['periodo_desc'], 'meta_propuesta' => $f['meta_propuesta'], 'meta_alcanzada' => $f['meta_alcanzada'], 'observaciones' => $f['observaciones'], 'no_aplica' => $f['no_aplica']
                ];
            }
        }

        // Limpiar índices de arrays
        $resultado = array_values(array_map(function($cat) {
            $cat['proyectos'] = array_values(array_map(function($proy) {
                $proy['objetivos'] = array_values(array_map(function($oe) {
                    $oe['actividades'] = array_values(array_map(function($act) {
                        $act['indicadores'] = array_values($act['indicadores']);
                        return $act;
                    }, $oe['actividades']));
                    return $oe;
                }, $proy['objetivos']));
                return $proy;
            }, $cat['proyectos']));
            return $cat;
        }, $asociaciones));

        echo json_encode($resultado);
    }
} catch (Exception $e) {
    http_response_code(400); echo json_encode(["error" => $e->getMessage()]);
}
?>