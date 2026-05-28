<?php
// api-backend/lista_maestras_comu.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';

if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401);
    echo json_encode(["error" => "No autorizado"]);
    exit;
}

header("Content-Type: application/json; charset=utf-8");

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");

    $respuesta = [
        "tipos_actividad" => [],
        "flujo_estados" => [],
        "tipos_meta" => [],
        "referentes" => [],
        "dependencias" => [],
        "actividades_planificacion" => [] // NUEVO: Para vincular
    ];

    $stmtTipos = $pdo->query("SELECT id_comu_tipo_actividad, descripcion FROM comu_tipo_actividad WHERE activo = 1 ORDER BY descripcion ASC");
    $respuesta["tipos_actividad"] = $stmtTipos->fetchAll(PDO::FETCH_ASSOC);

    $sqlFlujos = "SELECT f.id_comu_tipo_actividad, e.id_comu_estado, e.descripcion, f.orden 
                  FROM comu_flujo_estado f
                  INNER JOIN comu_estado e ON f.id_comu_estado = e.id_comu_estado
                  ORDER BY f.id_comu_tipo_actividad ASC, f.orden ASC";
    $stmtFlujos = $pdo->query($sqlFlujos);
    while ($row = $stmtFlujos->fetch(PDO::FETCH_ASSOC)) {
        $idTipo = $row['id_comu_tipo_actividad'];
        if (!isset($respuesta["flujo_estados"][$idTipo])) $respuesta["flujo_estados"][$idTipo] = [];
        $respuesta["flujo_estados"][$idTipo][] = ["id_comu_estado" => $row['id_comu_estado'], "descripcion" => $row['descripcion'], "orden" => $row['orden']];
    }

    $stmtMetas = $pdo->query("SELECT id_comu_tipo_meta, descripcion FROM comu_tipo_meta ORDER BY id_comu_tipo_meta ASC");
    $respuesta["tipos_meta"] = $stmtMetas->fetchAll(PDO::FETCH_ASSOC);

    $stmtRefs = $pdo->query("SELECT id_referente, nombre, apellido, cuil, sigla FROM referente ORDER BY apellido ASC, nombre ASC");
    $respuesta["referentes"] = $stmtRefs->fetchAll(PDO::FETCH_ASSOC);

    $stmtDep = $pdo->query("SELECT sigla, descripcion FROM dependencia ORDER BY sigla ASC");
    $respuesta["dependencias"] = $stmtDep->fetchAll(PDO::FETCH_ASSOC);

    // CIRUGÍA: Traemos las actividades prioritarias de planificación (con su proyecto para dar contexto)
    $sqlPlanif = "SELECT a.id_actividad, CONCAT(p.descripcion, ' - ', a.descripcion) as descripcion_completa 
                  FROM actividad_prioritaria a
                  JOIN objetivo_especifico oe ON a.id_oe = oe.id_oe
                  JOIN objetivo_general og ON oe.id_og = og.id_og
                  JOIN proyecto p ON og.id_proyecto = p.id_proyecto
                  WHERE p.estado_proyecto = 3 
                  ORDER BY p.descripcion ASC";
    $stmtPlanif = $pdo->query($sqlPlanif);
    $respuesta["actividades_planificacion"] = $stmtPlanif->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "data" => $respuesta]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Error interno al procesar los datos maestros."]);
}
?>