<?php
// api-backend/login.php
ini_set('display_errors', 0); 
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';

header('Content-Type: application/json');

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['username']) || !isset($input['password'])) {
        throw new Exception("Faltan datos de usuario o contraseña");
    }

    $username = $input['username'];
    $password = $input['password'];

    $pdo = getDB();
    $sql = "SELECT id_usuario, nombre, apellido, email, clave, rol, sigla, activo FROM usuario WHERE usuario = ? LIMIT 1";     
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && md5($password) === $user['clave']) {
        if ($user['activo'] != 1) throw new Exception("Usuario inactivo");

        // Calculamos los permisos por módulo al momento del login
        $stmtMod = $pdo->prepare("
            SELECT m.clave, um.rol 
            FROM usuario_modulo um
            JOIN modulo m ON um.id_modulo = m.id_modulo
            WHERE um.id_usuario = ? AND m.vigente = 1
        ");
        $stmtMod->execute([$user['id_usuario']]);
        $permisos = [];
        while ($row = $stmtMod->fetch(PDO::FETCH_ASSOC)) {
            $permisos[$row['clave']] = $row['rol'];
        }

        // Seteamos las variables de sesión
        $_SESSION['usuario_id'] = $user['id_usuario']; 
        $_SESSION['nombre'] = $user['nombre'];
        $_SESSION['apellido'] = $user['apellido'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['rol'] = $user['rol']; // Legacy
        $_SESSION['sigla'] = $user['sigla'];             
        $_SESSION['sigla_dependencia'] = $user['sigla']; 
        $_SESSION['permisos'] = $permisos; // <--- GUARDAMOS EN SESIÓN

        echo json_encode([
            "success" => true,
            "user" => [
                "nombre" => $user['nombre'],
                "apellido" => $user['apellido'],
                "rol" => $user['rol'],
                "sigla" => $user['sigla'],
                "permisos" => $permisos
            ]
        ]);
    } else {
        throw new Exception("Usuario o contraseña incorrectos");
    }
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}
?>