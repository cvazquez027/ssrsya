<?php
// api-backend/lista_objetivos.php (Corrección de nombre)
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

    // RECIBIMOS LOS DOS POSIBLES FILTROS
    $filtroProyecto = $_GET['id_proyecto'] ?? null;
    $filtroSigla = $_GET['sigla'] ?? null;

    $sql = "SELECT 
                oe.id_oe, 
                oe.descripcion, 
                p.id_proyecto, 
                p.descripcion as proyecto_nombre, 
                p.sigla_dependencia,
                p.estado_proyecto,
                COALESCE(tep.descripcion, 'Desconocido') as estado_descripcion
            FROM objetivo_especifico oe
            INNER JOIN objetivo_general og ON oe.id_og = og.id_og
            INNER JOIN proyecto p ON og.id_proyecto = p.id_proyecto
            LEFT JOIN tipo_estado_proyecto tep ON p.estado_proyecto = tep.id_tipo_estado_proyecto";

    // LÓGICA DE FILTRADO JERÁRQUICA
    if ($filtroProyecto) {
        // PRIORIDAD 1: Filtrar por Proyecto específico (Caso 3)
        $sql .= " WHERE p.id_proyecto = :id_proy";
    } elseif ($filtroSigla) {
        // PRIORIDAD 2: Filtrar por Dependencia (Caso 2)
        $sql .= " WHERE p.sigla_dependencia = :sigla";
    }
    // PRIORIDAD 3: Si no hay filtros, trae todo (Caso 1)

    $sql .= " ORDER BY p.sigla_dependencia ASC, p.id_proyecto DESC, oe.id_oe ASC";

    $stmt = $pdo->prepare($sql);

    if ($filtroProyecto) {
        $stmt->execute([':id_proy' => $filtroProyecto]);
    } elseif ($filtroSigla) {
        $stmt->execute([':sigla' => $filtroSigla]);
    } else {
        $stmt->execute();
    }
    
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if ($data === false) $data = [];

    echo json_encode($data, JSON_THROW_ON_ERROR);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Error: " . $e->getMessage()]);
}
?>