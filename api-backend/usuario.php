<?php
// api-backend/usuario.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';
require __DIR__ . '/auth_utils.php'; // <--- Inyección de Seguridad RLS

header("Content-Type: application/json; charset=utf-8");

if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401);
    echo json_encode(["error" => "No hay sesión activa"]);
    exit;
}

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");
    
    // Obtenemos los datos base del usuario
    $stmt = $pdo->prepare("SELECT id_usuario, usuario, nombre, apellido, email, rol, sigla, cuil FROM usuario WHERE id_usuario = ?");
    $stmt->execute([$_SESSION['usuario_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        // Obtenemos los permisos específicos por módulo (usuario_modulo)
        $stmtM = $pdo->prepare("SELECT m.clave, um.rol FROM usuario_modulo um JOIN modulo m ON um.id_modulo = m.id_modulo WHERE um.id_usuario = ?");
        $stmtM->execute([$user['id_usuario']]);
        $permisos = $stmtM->fetchAll(PDO::FETCH_KEY_PAIR);

        // Determinamos el alcance visual basándonos en el rol de Planificación
        $rolPlanif = $permisos['PLANIFICACION'] ?? $user['rol'];
        
        // CIRUGÍA: Obtenemos el array de dependencias. Si es Admin devuelve NULL (ve todo). 
        // Si es Autorizante/Carga devuelve un array con sus siglas.
        $deps = getDependenciasPermitidas($pdo, $user['id_usuario'], $rolPlanif);

        echo json_encode([
            'id_usuario' => $user['id_usuario'],
            'usuario' => $user['usuario'],
            'nombre' => $user['nombre'],
            'apellido' => $user['apellido'],
            'email' => $user['email'],
            'rol' => $user['rol'], // Rol global base
            'sigla' => $user['sigla'], // Sigla base
            'cuil' => $user['cuil'],
            'permisos' => $permisos, // Módulos a los que tiene acceso
            'dependencias_permitidas' => $deps // <-- Clave para el Dashboard
        ]);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "Usuario no encontrado en la base de datos"]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Error de base de datos: " . $e->getMessage()]);
}
?>