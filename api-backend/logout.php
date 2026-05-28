<?php
// api-backend/logout.php
// 1. Incluir CORS al principio (CRUCIAL para que React pueda llamar a este archivo)
require __DIR__ . '/cors.php';

// 2. Iniciar sesión para poder destruirla
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 3. Destruir todas las variables de sesión
$_SESSION = [];

// 4. Borrar la cookie de sesión del navegador
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// 5. Destruir la sesión en el servidor
session_destroy();

// 6. Responder JSON de éxito
header('Content-Type: application/json');
echo json_encode(["success" => true, "mensaje" => "Sesión cerrada correctamente"]);
?>