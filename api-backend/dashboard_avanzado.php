<?php
// api-backend/dashboard_avanzado.php
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

    $siglaFiltro = $_GET['sigla'] ?? null;
    $filtroSeguridad = getSQLFilter($pdo, $id_usuario, $rol_planificacion, 'p.sigla_dependencia');

    $baseWhere = " WHERE p.estado_proyecto = 3 "; // Solo proyectos aprobados
    $params = [];

    if (is_array($filtroSeguridad)) {
        $baseWhere .= " AND " . str_replace("WHERE ", "", $filtroSeguridad['sql']);
        $params = array_merge($params, $filtroSeguridad['params']);
    }

    if ($siglaFiltro) {
        $baseWhere .= " AND p.sigla_dependencia = ? ";
        $params[] = $siglaFiltro;
    }

    $response = [];

    // 1. Proyectos por dependencia
    $sqlProyectos = "SELECT sigla_dependencia, COUNT(id_proyecto) as cantidad FROM proyecto p $baseWhere GROUP BY sigla_dependencia";
    $stmt = $pdo->prepare($sqlProyectos);
    $stmt->execute($params);
    $response['proyectos_por_dep'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Objetivos Específicos por dependencia
    $sqlObjetivos = "SELECT p.sigla_dependencia, COUNT(oe.id_oe) as cantidad 
        FROM objetivo_especifico oe 
        JOIN objetivo_general og ON oe.id_og = og.id_og 
        JOIN proyecto p ON og.id_proyecto = p.id_proyecto 
        $baseWhere GROUP BY p.sigla_dependencia";
    $stmt = $pdo->prepare($sqlObjetivos);
    $stmt->execute($params);
    $response['objetivos_por_dep'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Distribución de Actividades por Tipo
    $sqlTiposAct = "SELECT p.sigla_dependencia, tap.descripcion as tipo_actividad, COUNT(ap.id_actividad) as cantidad
        FROM actividad_prioritaria ap
        JOIN tipo_actividad_prioritaria tap ON ap.id_tipo_actividad_prioritaria = tap.id_tipo_actividad_prioritaria
        JOIN objetivo_especifico oe ON ap.id_oe = oe.id_oe
        JOIN objetivo_general og ON oe.id_og = og.id_og
        JOIN proyecto p ON og.id_proyecto = p.id_proyecto
        $baseWhere GROUP BY p.sigla_dependencia, tap.descripcion";
    $stmt = $pdo->prepare($sqlTiposAct);
    $stmt->execute($params);
    $response['distribucion_actividades'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. % de Cumplimiento por dependencia
    $sqlCumplimiento = "SELECT p.sigla_dependencia, 
        ROUND(AVG(CASE WHEN m.meta_programada > 0 THEN 
            (CASE WHEN m.meta_alcanzada > m.meta_programada THEN 100 ELSE (m.meta_alcanzada / m.meta_programada * 100) END) 
        ELSE 0 END), 1) as cumplimiento
        FROM monitoreo m
        JOIN indicador i ON m.id_indicador = i.id_indicador
        JOIN actividad_prioritaria ap ON i.id_actividad = ap.id_actividad
        JOIN objetivo_especifico oe ON ap.id_oe = oe.id_oe
        JOIN objetivo_general og ON oe.id_og = og.id_og
        JOIN proyecto p ON og.id_proyecto = p.id_proyecto
        $baseWhere AND m.no_aplica = 0
        GROUP BY p.sigla_dependencia";
    $stmt = $pdo->prepare($sqlCumplimiento);
    $stmt->execute($params);
    $response['cumplimiento_por_dep'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 5. KPIs Especiales: Documentos / Guías
    $sqlDocumentos = "SELECT p.sigla_dependencia, IFNULL(SUM(m.meta_alcanzada), 0) as cantidad
        FROM monitoreo m
        JOIN indicador i ON m.id_indicador = i.id_indicador
        JOIN actividad_prioritaria ap ON i.id_actividad = ap.id_actividad
        JOIN tipo_actividad_prioritaria tap ON ap.id_tipo_actividad_prioritaria = tap.id_tipo_actividad_prioritaria
        JOIN objetivo_especifico oe ON ap.id_oe = oe.id_oe
        JOIN objetivo_general og ON oe.id_og = og.id_og
        JOIN proyecto p ON og.id_proyecto = p.id_proyecto
        $baseWhere AND m.no_aplica = 0
        AND (tap.descripcion LIKE '%Comunicaci%' OR tap.descripcion LIKE '%Rector%')
        AND (i.nombre LIKE '%documento%' OR i.nombre LIKE '%publicacion%' OR i.nombre LIKE '%protocolo%')
        GROUP BY p.sigla_dependencia";
    $stmt = $pdo->prepare($sqlDocumentos);
    $stmt->execute($params);
    $response['documentos_por_dep'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 6. KPIs Especiales: Capacitados
    $sqlCapacitados = "SELECT p.sigla_dependencia, IFNULL(SUM(m.meta_alcanzada), 0) as cantidad
        FROM monitoreo m
        JOIN indicador i ON m.id_indicador = i.id_indicador
        JOIN actividad_prioritaria ap ON i.id_actividad = ap.id_actividad
        JOIN tipo_actividad_prioritaria tap ON ap.id_tipo_actividad_prioritaria = tap.id_tipo_actividad_prioritaria
        JOIN objetivo_especifico oe ON ap.id_oe = oe.id_oe
        JOIN objetivo_general og ON oe.id_og = og.id_og
        JOIN proyecto p ON og.id_proyecto = p.id_proyecto
        $baseWhere AND m.no_aplica = 0
        AND tap.descripcion LIKE '%Capacitaci%' AND i.nombre LIKE '%capacitad%'
        GROUP BY p.sigla_dependencia";
    $stmt = $pdo->prepare($sqlCapacitados);
    $stmt->execute($params);
    $response['capacitados_por_dep'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 7. Grado de Cumplimiento de Insumos
    $sqlInsumos = "SELECT p.sigla_dependencia, 
        ROUND(AVG(CASE WHEN m.meta_programada > 0 THEN 
            (CASE WHEN m.meta_alcanzada > m.meta_programada THEN 100 ELSE (m.meta_alcanzada / m.meta_programada * 100) END) 
        ELSE 0 END), 1) as cumplimiento
        FROM monitoreo m
        JOIN indicador i ON m.id_indicador = i.id_indicador
        JOIN actividad_prioritaria ap ON i.id_actividad = ap.id_actividad
        JOIN tipo_actividad_prioritaria tap ON ap.id_tipo_actividad_prioritaria = tap.id_tipo_actividad_prioritaria
        JOIN objetivo_especifico oe ON ap.id_oe = oe.id_oe
        JOIN objetivo_general og ON oe.id_og = og.id_og
        JOIN proyecto p ON og.id_proyecto = p.id_proyecto
        $baseWhere AND m.no_aplica = 0 AND tap.descripcion LIKE '%Insumo%'
        GROUP BY p.sigla_dependencia";
    $stmt = $pdo->prepare($sqlInsumos);
    $stmt->execute($params);
    $response['insumos_por_dep'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "data" => $response]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>