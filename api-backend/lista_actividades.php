<?php
// api-backend/lista_actividades.php
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

header("Content-Type: application/json; charset=utf-8");

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");

    $id_usuario = $_SESSION['usuario_id'];
    $stmtRol = $pdo->prepare("SELECT rol FROM usuario_modulo WHERE id_usuario = ? AND id_modulo = (SELECT id_modulo FROM modulo WHERE clave = 'PLANIFICACION')");
    $stmtRol->execute([$id_usuario]);
    $rol_planificacion = $stmtRol->fetchColumn() ?: 'consulta';

    $filtroProyecto = $_GET['id_proyecto'] ?? null;
    $filtroSigla = $_GET['sigla'] ?? null;

    // --- CIRUGÍA DE FILTRADO DE SEGURIDAD ---
    $filtroSeguridad = getSQLFilter($pdo, $id_usuario, $rol_planificacion, 'p.sigla_dependencia');

    // --- CIRUGÍA SQL: JOINS corregidos y ALIAS exactos para el Frontend ---
    $sql = "SELECT 
                a.*,
                a.descripcion as actividad_descripcion,
                tap.descripcion as tipo_descripcion,
                e.descripcion as estado_actividad_descripcion,   
                oe.descripcion as oe_descripcion,
                og.id_proyecto,
                p.descripcion,
                p.sigla_dependencia,
                p.estado_proyecto,
                tep.descripcion as proyecto_estado_descripcion
            FROM actividad_prioritaria a
            JOIN objetivo_especifico oe ON a.id_oe = oe.id_oe
            JOIN objetivo_general og ON oe.id_og = og.id_og
            JOIN proyecto p ON og.id_proyecto = p.id_proyecto
            LEFT JOIN tipo_actividad_prioritaria tap ON a.id_tipo_actividad_prioritaria = tap.id_tipo_actividad_prioritaria
            LEFT JOIN estado e ON a.id_estado = e.id_estado
            LEFT JOIN tipo_estado_proyecto tep ON p.estado_proyecto = tep.id_tipo_estado_proyecto
            WHERE 1=1 ";

    $params = [];

    // 1. Filtros de la URL (CIRUGÍA: Usamos parámetros posicionales '?')
    if ($filtroProyecto) {
        $sql .= " AND p.id_proyecto = ?";
        $params[] = $filtroProyecto;
    } elseif ($filtroSigla) {
        $sql .= " AND p.sigla_dependencia = ?";
        $params[] = $filtroSigla;
    }

    // 2. Filtro de Seguridad (Ámbito)
    if (is_array($filtroSeguridad)) {
        $sql .= $filtroSeguridad['sql'];
    }

    $sql .= " ORDER BY p.sigla_dependencia ASC, p.id_proyecto DESC, oe.id_oe ASC, a.id_actividad ASC";

    $stmt = $pdo->prepare($sql);
    
    // Unificamos parámetros para el execute de manera segura
    $finalParams = $params;
    if (is_array($filtroSeguridad)) {
        foreach ($filtroSeguridad['params'] as $p) {
            $finalParams[] = $p;
        }
    }
    
    $stmt->execute($finalParams);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Formatear fechas si existen para que no rompan el front
    foreach ($data as &$row) {
        if (!empty($row['fecha_inicio'])) $row['fecha_inicio'] = date('Y-m-d', strtotime($row['fecha_inicio']));
        if (!empty($row['fecha_est_fin'])) $row['fecha_est_fin'] = date('Y-m-d', strtotime($row['fecha_est_fin']));
        if (!empty($row['fecha_real_fin'])) $row['fecha_real_fin'] = date('Y-m-d', strtotime($row['fecha_real_fin']));
    }

    // Devolvemos el JSON estructurado tal cual espera ActividadesPage.tsx
    echo json_encode(["success" => true, "data" => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>