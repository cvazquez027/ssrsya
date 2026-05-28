<?php
// api-backend/recuperar_clave.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';

header("Content-Type: application/json");
$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $accion = $input['accion'] ?? ''; // 'solicitar' o 'resetear'

    // --- 1. SOLICITAR RECUPERACIÓN (Enviar Email) ---
    if ($method === 'POST' && $accion === 'solicitar') {
        if (empty($input['email'])) throw new Exception("Email requerido");
        $email = $input['email'];

        // Verificar si existe el usuario
        $stmt = $pdo->prepare("SELECT id_usuario, nombre, apellido FROM usuario WHERE usuario = ? AND activo = 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            // Generar token único y expiración (1 hora)
            $token = bin2hex(random_bytes(32));
            $expires = date("Y-m-d H:i:s", strtotime('+1 hour'));

            // Guardar en BD
            $pdo->prepare("UPDATE usuario SET reset_token = ?, reset_expires = ? WHERE id_usuario = ?")
                ->execute([$token, $expires, $user['id_usuario']]);

            // URL del Frontend (CAMBIAR ESTO POR TU URL REAL DE INFINITYFREE EN PRODUCCIÓN)
            // En local suele ser http://localhost:5173 o http://localhost/planificacion
            $baseUrl = (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false) 
                ? 'http://localhost:5173' 
                : 'https://ssrsya.my-board.org'; 

            $link = "$baseUrl/restablecer?token=$token";

            // Enviar Correo
            $asunto = "Recuperar Contraseña";
            $cuerpo = "
                <p>Hola <b>{$user['nombre']}</b>,</p>
                <p>Has solicitado restablecer tu contraseña.</p>
                <p>Haz clic en el siguiente enlace para crear una nueva (válido por 1 hora):</p>
                <p><a href='$link'>$link</a></p>
                <p>Si no fuiste tú, ignora este mensaje.</p>
            ";

            enviarCorreoBrevo([$email], $asunto, $cuerpo);
        }

        // Por seguridad, siempre decimos "Si el correo existe, se envió..." para no revelar usuarios
        echo json_encode(["success" => true, "mensaje" => "Si el correo es correcto, recibirás un enlace de recuperación."]);
    }

    // --- 2. RESETEAR CONTRASEÑA (Guardar nueva clave) ---
    elseif ($method === 'POST' && $accion === 'resetear') {
        if (empty($input['token']) || empty($input['password'])) throw new Exception("Datos incompletos");

        $token = $input['token'];
        $password = $input['password'];

        // Buscar usuario con ese token y que no haya expirado
        $stmt = $pdo->prepare("SELECT id_usuario FROM usuario WHERE reset_token = ? AND reset_expires > NOW()");
        $stmt->execute([$token]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            throw new Exception("El enlace es inválido o ha expirado.");
        }

        // Validar complejidad (Opcional, pero recomendado igual que en registro)
        if (strlen($password) < 8) throw new Exception("La contraseña es muy corta.");

        // Actualizar clave y borrar token
        $sql = "UPDATE usuario SET clave = ?, reset_token = NULL, reset_expires = NULL WHERE id_usuario = ?";
        $pdo->prepare($sql)->execute([md5($password), $user['id_usuario']]);

        echo json_encode(["success" => true, "mensaje" => "Contraseña actualizada. Ya puedes iniciar sesión."]);
    } 
    else {
        throw new Exception("Acción no válida");
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>