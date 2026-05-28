<?php
// api-backend/lista_indicadores.php
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
    $filtroOe = $_GET['id_oe'] ?? null; 
    $filtroActividad = $_GET['id_actividad'] ?? null; 

    // --- CIRUGÍA DE FILTRADO ---
    $filtroSeguridad = getSQLFilter($pdo, $id_usuario, $rol_planificacion, 'p.sigla_dependencia');

    // CIRUGÍA: Agregamos i.id_actividad y oe.id_oe al SELECT para que React pueda preseleccionar
    $sql = "SELECT 
                i.id_indicador, i.nombre, i.construccion, i.meta_anio1, i.meta_anio2, i.tipo_meta, i.id_tipo_indicador, i.id_otro_sistema, i.fuente, i.linea_base,
                i.id_actividad,
                ti.nombre as tipo_indicador_nombre, 
                ti.descripcion as tipo_indicador_desc,
                a.descripcion as actividad_descripcion,
                oe.id_oe,
                p.id_proyecto,
                p.descripcion as proyecto_nombre,
                p.sigla_dependencia,
                p.estado_proyecto, 
                tep.descripcion as proyecto_estado_descripcion
            FROM indicador i
            INNER JOIN actividad_prioritaria a ON i.id_actividad = a.id_actividad
            INNER JOIN objetivo_especifico oe ON a.id_oe = oe.id_oe
            INNER JOIN objetivo_general og ON oe.id_og = og.id_og
            INNER JOIN proyecto p ON og.id_proyecto = p.id_proyecto
            LEFT JOIN tipo_indicador ti ON i.id_tipo_indicador = ti.id_tipo_indicador
            LEFT JOIN otro_sistema os ON i.id_otro_sistema = os.id_otro_sistema
            LEFT JOIN tipo_estado_proyecto tep ON p.estado_proyecto = tep.id_tipo_estado_proyecto
            WHERE 1=1 ";

    $params = [];

    if ($filtroSigla) { $sql .= " AND p.sigla_dependencia = ?"; $params[] = $filtroSigla; }
    if ($filtroProyecto) { $sql .= " AND p.id_proyecto = ?"; $params[] = $filtroProyecto; }
    if ($filtroOe) { $sql .= " AND oe.id_oe = ?"; $params[] = $filtroOe; }
    if ($filtroActividad) { $sql .= " AND a.id_actividad = ?"; $params[] = $filtroActividad; }

    // Inyectamos filtro de seguridad
    if (is_array($filtroSeguridad)) {
        $sql .= $filtroSeguridad['sql'];
        foreach($filtroSeguridad['params'] as $p_val) {
            $params[] = $p_val;
        }
    }

    $sql .= " ORDER BY p.sigla_dependencia ASC, p.id_proyecto DESC, i.id_indicador ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>