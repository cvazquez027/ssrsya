<?php
// api-backend/planificacion_url.php
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
$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");

    // ================= GET: LISTAR URLS =================
    if ($method === 'GET') {
        $tipo = $_GET['entidad_tipo'] ?? '';
        $id_entidad = (int)($_GET['id_entidad'] ?? 0);

        if (!$tipo || !$id_entidad) throw new Exception("Faltan parámetros");

        $stmt = $pdo->prepare("SELECT * FROM planificacion_url WHERE entidad_tipo = ? AND id_entidad = ? ORDER BY fecha_creacion DESC");
        $stmt->execute([$tipo, $id_entidad]);
        echo json_encode(["success" => true, "data" => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }

    // ================= POST: CREAR URL =================
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['entidad_tipo']) || empty($input['id_entidad']) || empty($input['url'])) {
            throw new Exception("Faltan datos obligatorios");
        }

        $etiqueta = !empty($input['etiqueta']) ? $input['etiqueta'] : 'Enlace';

        $stmt = $pdo->prepare("INSERT INTO planificacion_url (entidad_tipo, id_entidad, etiqueta, url) VALUES (?, ?, ?, ?)");
        $stmt->execute([$input['entidad_tipo'], $input['id_entidad'], $etiqueta, $input['url']]);

        echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
        exit;
    }

    // ================= DELETE: BORRAR URL =================
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id_url'])) throw new Exception("Falta ID");

        $stmt = $pdo->prepare("DELETE FROM planificacion_url WHERE id_url = ?");
        $stmt->execute([$input['id_url']]);

        echo json_encode(["success" => true]);
        exit;
    }

    throw new Exception("Método no soportado");

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>