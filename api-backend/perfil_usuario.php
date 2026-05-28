<?php
// api-backend/perfil_usuario.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php'; // Asegúrate de tener este archivo o usa tu lógica de session habitual

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401);
    echo json_encode(["error" => "No autorizado"]);
    exit;
}

header("Content-Type: application/json");
$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();
$userId = $_SESSION['usuario_id'];

try {
    if ($method === 'GET') {
        // Obtenemos todos los datos para mostrar (menos la clave)
        $stmt = $pdo->prepare("SELECT id_usuario, usuario, nombre, apellido, cuil, email, rol, sigla FROM usuario WHERE id_usuario = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode($user ?: []);

    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        // Validaciones básicas
        if (empty($input['nombre']) || empty($input['apellido']) || empty($input['email'])) {
            throw new Exception("Nombre, Apellido y Email son obligatorios.");
        }

        // Query dinámica: Si manda pass, la actualizamos. Si no, no.
        $sql = "UPDATE usuario SET nombre = ?, apellido = ?, email = ?";
        $params = [$input['nombre'], $input['apellido'], $input['email']];

        if (!empty($input['password_nueva'])) {
            $sql .= ", clave = ?";
            $params[] = md5($input['password_nueva']);
        }

        $sql .= " WHERE id_usuario = ?";
        $params[] = $userId;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        // Actualizamos sesión para que se vea reflejado el cambio de nombre sin reloguear
        $_SESSION['nombre'] = $input['nombre'];
        $_SESSION['apellido'] = $input['apellido'];
        $_SESSION['email'] = $input['email'];

        echo json_encode(["success" => true]);
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>