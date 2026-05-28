<?php
// api-backend/opciones_actividad.php
ini_set('display_errors', 0);
error_reporting(E_ALL);
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

header("Content-Type: application/json; charset=utf-8");

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");

    // 1. Traer Tipos de Actividad
    $stmtTipos = $pdo->query("SELECT id_tipo_actividad_prioritaria as id, descripcion FROM tipo_actividad_prioritaria ORDER BY id_tipo_actividad_prioritaria");
    $tipos = $stmtTipos->fetchAll(PDO::FETCH_ASSOC);

    // 2. Traer Estados de Actividad (Ojo: Tabla 'estado', no 'tipo_estado_proyecto')
    $stmtEstados = $pdo->query("SELECT id_estado as id, descripcion FROM estado ORDER BY id_estado");
    $estados = $stmtEstados->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "tipos" => $tipos,
        "estados" => $estados
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Error al cargar opciones"]);
}
?>