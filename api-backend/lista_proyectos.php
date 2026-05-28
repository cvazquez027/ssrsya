<?php
// api-backend/lista_proyectos.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';
require __DIR__ . '/auth_utils.php'; // <--- NUEVA INCLUSIÓN

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
    // Obtenemos el rol específico de Planificación
    $stmtRol = $pdo->prepare("SELECT rol FROM usuario_modulo WHERE id_usuario = ? AND id_modulo = (SELECT id_modulo FROM modulo WHERE clave = 'PLANIFICACION')");
    $stmtRol->execute([$id_usuario]);
    $rol_planificacion = $stmtRol->fetchColumn() ?: 'consulta';

    // --- CIRUGÍA DE FILTRADO ---
    $filtro = getSQLFilter($pdo, $id_usuario, $rol_planificacion, 'p.sigla_dependencia');

    $sql = "SELECT 
                p.id_proyecto,
                p.descripcion as proyecto_descripcion,
                p.sigla_dependencia,
                p.id_prioridad,
                p.id_estado,
                p.estado_proyecto,
                
                dep.descripcion as dependencia_desc,
                prio.descripcion as prioridad_desc,
                e.descripcion as estado_desc,
                
                COALESCE(tep.descripcion, 'Desconocido') as estado_workflow_desc,
                og.id_og,
                og.descripcion as og_descripcion
            FROM proyecto p
            LEFT JOIN objetivo_general og ON p.id_proyecto = og.id_proyecto
            LEFT JOIN tipo_estado_proyecto tep ON p.estado_proyecto = tep.id_tipo_estado_proyecto
            LEFT JOIN dependencia dep ON p.sigla_dependencia = dep.sigla
            LEFT JOIN prioridad prio ON p.id_prioridad = prio.id_prioridad
            LEFT JOIN estado e ON p.id_estado = e.id_estado
            WHERE 1=1 ";

    // Inyectamos el filtro de seguridad
    if (is_array($filtro)) {
        $sql .= $filtro['sql'];
    }

    $sql .= " ORDER BY p.id_proyecto DESC";

    $stmt = $pdo->prepare($sql);
    
    // Ejecutamos pasando los parámetros del filtro si existen
    $stmt->execute(is_array($filtro) ? $filtro['params'] : []);
    
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if ($data === false) $data = [];

    // Mapeo de múltiples referentes por proyecto
    $stmtRefs = $pdo->query("SELECT pr.id_proyecto, pr.id_referente, CONCAT(r.apellido, ', ', r.nombre) as nombre FROM proyecto_referente pr JOIN referente r ON pr.id_referente = r.id_referente");
    $refsMap = [];
    while ($row = $stmtRefs->fetch(PDO::FETCH_ASSOC)) {
        $refsMap[$row['id_proyecto']][] = $row;
    }

    foreach ($data as &$p) {
        $p['referentes'] = $refsMap[$p['id_proyecto']] ?? [];
    }

    echo json_encode($data);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}