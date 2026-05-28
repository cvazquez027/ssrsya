<?php
// api-backend/solicitar_acceso.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';

header("Content-Type: application/json");
$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();

try {
    // --- NUEVO: SI ES GET, DEVOLVEMOS DEPENDENCIAS PÚBLICAS ---
    if ($method === 'GET') {
        // Solo sigla y descripción, solo vigentes
        $stmt = $pdo->query("SELECT sigla, descripcion FROM dependencia WHERE vigente = 1 ORDER BY sigla");
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        exit;
    }

    // --- SI ES POST, PROCESAMOS LA SOLICITUD (Como antes) ---
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        // 1. Validar campos obligatorios
        if (empty($input['nombre']) || empty($input['apellido']) || empty($input['cuil']) || 
            empty($input['usuario']) || empty($input['password']) || 
            empty($input['sigla']) || empty($input['rol'])) {
            throw new Exception("Todos los campos son obligatorios.");
        }

        // 2. Validar Formato de Usuario
        if (!filter_var($input['usuario'], FILTER_VALIDATE_EMAIL) || !str_ends_with($input['usuario'], '@msal.gov.ar')) {
            throw new Exception("El usuario debe ser un email válido terminado en @msal.gov.ar");
        }

        // 3. Validar Complejidad de Contraseña
        $password = $input['password'];
        if (strlen($password) < 8) throw new Exception("La contraseña debe tener al menos 8 caracteres.");
        if (!preg_match('/[A-Z]/', $password)) throw new Exception("Debe tener una mayúscula.");
        if (!preg_match('/[a-z]/', $password)) throw new Exception("Debe tener una minúscula.");
        if (!preg_match('/[0-9]/', $password)) throw new Exception("Debe tener un número.");
        if (!preg_match('/[\W_]/', $password)) throw new Exception("Debe tener un carácter especial.");

        // 4. Validar Rol
        if (!in_array($input['rol'], ['carga', 'cargafull', 'autorizante'])) {
            throw new Exception("Rol no válido.");
        }

        // 5. Verificar duplicados
        $stmtCheck = $pdo->prepare("SELECT count(*) FROM usuario WHERE usuario = ? OR cuil = ?");
        $stmtCheck->execute([$input['usuario'], $input['cuil']]);
        if ($stmtCheck->fetchColumn() > 0) {
            throw new Exception("El usuario o CUIL ya existen.");
        }

        // 6. Insertar
        $sql = "INSERT INTO usuario (usuario, clave, nombre, apellido, cuil, email, activo, rol, sigla, fecha_creacion) 
                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NOW())";
        
        $pdo->prepare($sql)->execute([
            $input['usuario'], md5($password), $input['nombre'], $input['apellido'], 
            $input['cuil'], $input['usuario'], $input['rol'], $input['sigla']
        ]);

        try {
            $admins = getEmailsPorRol('admin');
            if (!empty($admins)) {
                $asunto = "Nueva Solicitud de Acceso - SIGEP";
                $cuerpo = "<h3>Nueva solicitud pendiente</h3>
                        <p>El usuario <b>{$input['usuario']}</b> ({$input['nombre']} {$input['apellido']}) 
                        de la dependencia <b>{$input['sigla']}</b> ha solicitado acceso con rol <b>{$input['rol']}</b>.</p>
                        <p>Ingrese al sistema para aprobarlo o rechazarlo.</p>";
                enviarCorreoBrevo($admins, $asunto, $cuerpo);
            }
        } catch (Exception $e) { /* Ignoramos error de mail para no frenar el registro */ }

        echo json_encode(["success" => true, "mensaje" => "Solicitud enviada correctamente."]);
        exit;
    }

    throw new Exception("Método no permitido");

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>