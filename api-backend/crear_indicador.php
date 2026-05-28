<?php
// api-backend/crear_indicador.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Método no permitido"]);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);

    // Validamos campos obligatorios del indicador
    // Asumo estos campos, ajustalos si tu tabla 'indicador' tiene otros nombres
    if (empty($input['nombre']) || empty($input['id_actividad'])) {
        throw new Exception("Faltan datos del indicador");
    }

    $pdo = getDB();
    $pdo->beginTransaction();

    // 1. Insertamos el Indicador
    // Agrega aquí meta_anio1, meta_anio2, construccion, etc. si los envías desde el front
    $sqlInd = "INSERT INTO indicador (nombre, id_actividad, meta_anio1, meta_anio2, construccion) 
               VALUES (?, ?, ?, ?, ?)";
    
    $stmtInd = $pdo->prepare($sqlInd);
    $stmtInd->execute([
        $input['nombre'],
        $input['id_actividad'],
        $input['meta_anio1'] ?? null,
        $input['meta_anio2'] ?? null,
        $input['construccion'] ?? null
    ]);
    
    $id_indicador = $pdo->lastInsertId();

    // 2. MAGIA AUTOMÁTICA: Generar registros de Monitoreo
    // Traemos TODOS los periodos existentes en la tabla periodo_monitoreo
    $stmtPeriodos = $pdo->query("SELECT id_periodo_monitoreo FROM periodo_monitoreo");
    $periodos = $stmtPeriodos->fetchAll(PDO::FETCH_COLUMN);

    if ($periodos) {
        // Preparamos el insert masivo para monitoreo
        $sqlMonitoreo = "INSERT INTO monitoreo (id_indicador, id_periodo_monitoreo) VALUES (?, ?)";
        $stmtMonitoreo = $pdo->prepare($sqlMonitoreo);

        foreach ($periodos as $id_periodo) {
            $stmtMonitoreo->execute([$id_indicador, $id_periodo]);
        }
    }

    $pdo->commit();

    echo json_encode([
        "success" => true, 
        "mensaje" => "Indicador creado y monitoreos generados exitosamente",
        "id_indicador" => $id_indicador
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>