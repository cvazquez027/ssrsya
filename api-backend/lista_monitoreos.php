<?php
// api-backend/lista_monitoreos.php
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

    $filtro = getSQLFilter($pdo, $id_usuario, $rol_planificacion, 'p.sigla_dependencia');

    // CIRUGÍA: Sumamos id_proyecto, id_oe, id_actividad, id_indicador al SELECT
    $sql = "SELECT 
                m.id_monitoreo,
                m.meta_propuesta,
                m.meta_alcanzada,
                m.observaciones,
                m.no_aplica,
                pm.descripcion as periodo_descripcion,
                
                i.id_indicador,
                i.nombre as indicador_nombre,
                i.construccion as indicador_formula,
                i.tipo_meta,
                
                a.id_actividad,
                a.descripcion as actividad_nombre,
                
                oe.id_oe,
                oe.descripcion as oe_nombre,
                
                p.id_proyecto,
                p.sigla_dependencia,
                p.descripcion as proyecto_nombre,
                p.estado_proyecto,
                COALESCE(tep.descripcion, 'Desconocido') as estado_descripcion
            FROM monitoreo m
            INNER JOIN periodo_monitoreo pm ON m.id_periodo_monitoreo = pm.id_periodo_monitoreo
            INNER JOIN indicador i ON m.id_indicador = i.id_indicador
            INNER JOIN actividad_prioritaria a ON i.id_actividad = a.id_actividad
            INNER JOIN objetivo_especifico oe ON a.id_oe = oe.id_oe
            INNER JOIN objetivo_general og ON oe.id_og = og.id_og
            INNER JOIN proyecto p ON og.id_proyecto = p.id_proyecto
            LEFT JOIN tipo_estado_proyecto tep ON p.estado_proyecto = tep.id_tipo_estado_proyecto
            WHERE 1=1 ";

    if (is_array($filtro)) {
        $sql .= $filtro['sql'];
    }

    $sql .= " ORDER BY p.sigla_dependencia, p.id_proyecto, oe.id_oe, a.id_actividad, i.id_indicador, pm.id_periodo_monitoreo";

    $stmt = $pdo->prepare($sql);
    $stmt->execute(is_array($filtro) ? $filtro['params'] : []);
    
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>