<?php
// api-backend/opciones_proyecto.php
ini_set('display_errors', 0);
error_reporting(E_ALL);
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

header("Content-Type: application/json; charset=utf-8");

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");

    // 1. Dependencias (Solo vigentes)
    $stmtDep = $pdo->query("SELECT sigla, descripcion FROM dependencia WHERE vigente = 1 ORDER BY descripcion ASC"); 
    $dependencias = $stmtDep->fetchAll(PDO::FETCH_ASSOC);

    // 2. Prioridades
    $stmtPrio = $pdo->query("SELECT id_prioridad, descripcion FROM prioridad ORDER BY id_prioridad");
    $prioridades = $stmtPrio->fetchAll(PDO::FETCH_ASSOC);

    // 3. Estados (Tabla 'estado')
    // Corregido: id_estado refiere al estado original (Nuevo o Continúa)
    $stmtEst = $pdo->query("SELECT id_estado, descripcion FROM estado ORDER BY id_estado");
    $estados = $stmtEst->fetchAll(PDO::FETCH_ASSOC);

    // 4. Referentes
    $stmtRef = $pdo->query("SELECT id_referente, nombre, apellido FROM referente ORDER BY apellido, nombre");
    $referentes = $stmtRef->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "dependencias" => $dependencias,
        "prioridades" => $prioridades,
        "estados" => $estados,
        "referentes" => $referentes
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Error al cargar opciones: " . $e->getMessage()]);
}
?>