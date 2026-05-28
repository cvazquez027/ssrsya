<?php
// api-backend/lista_usuarios.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';

// Solo ADMIN o CARGAFULL deberían ver esto (ajustar según tu criterio)
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['rol'], ['admin', 'cargafull'])) {
    http_response_code(403);
    echo json_encode(["error" => "No autorizado"]);
    exit;
}

header("Content-Type: application/json");
$pdo = getDB();

try {
    // Seleccionamos todo MENOS la clave
    $sql = "SELECT 
                u.id_usuario, u.cuil, u.usuario, u.apellido, u.nombre, 
                u.email, u.activo, u.sigla, u.fecha_creacion, u.rol,
                d.descripcion as dependencia_desc
            FROM usuario u
            LEFT JOIN dependencia d ON u.sigla = d.sigla
            ORDER BY u.apellido, u.nombre";

    $stmt = $pdo->query($sql);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($data);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>