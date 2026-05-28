<?php
// api-backend/abm_usuarios.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';
require_once __DIR__ . '/mailer.php'; 

if (!isset($_SESSION['usuario_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["error" => "Acceso restringido a Administradores"]);
    exit;
}

header("Content-Type: application/json");
$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();

try {
    if ($method === 'GET') {
        $id = $_GET['id'] ?? 0;
        if ($id == 0) throw new Exception("Falta ID");
        
        $stmt = $pdo->prepare("SELECT id_usuario, usuario, nombre, apellido, email, rol, sigla, cuil, activo, id_referente FROM usuario WHERE id_usuario = ?");
        $stmt->execute([$id]);
        $u = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($u) {
            // Obtener módulos asignados
            $stmtM = $pdo->prepare("SELECT id_modulo FROM usuario_modulo WHERE id_usuario = ?");
            $stmtM->execute([$id]);
            $u['modulos'] = $stmtM->fetchAll(PDO::FETCH_COLUMN);
            
            // --- CIRUGÍA LOTE 4: Obtener dependencias permitidas (RLS) ---
            $stmtD = $pdo->prepare("SELECT sigla_dependencia FROM usuario_dependencia WHERE id_usuario = ?");
            $stmtD->execute([$id]);
            $u['dependencias_permitidas'] = $stmtD->fetchAll(PDO::FETCH_COLUMN);

            echo json_encode($u);
        } else {
            throw new Exception("Usuario no encontrado");
        }

    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $pdo->beginTransaction();

        $idUsuario = $input['id_usuario'] ?? null;
        $usuario = $input['usuario'] ?? '';
        $nombre = $input['nombre'] ?? '';
        $apellido = $input['apellido'] ?? '';
        $email = $input['email'] ?? '';
        $rol = $input['rol'] ?? 'consulta';
        $sigla = $input['sigla'] ?? '';
        $cuil = $input['cuil'] ?? '';
        $activo = isset($input['activo']) ? (int)$input['activo'] : 1;
        
        $idReferente = !empty($input['id_referente']) ? $input['id_referente'] : null;

        $enviarMail = false;

        if (empty($usuario) || empty($nombre) || empty($apellido) || empty($email) || empty($rol)) {
            throw new Exception("Faltan datos obligatorios");
        }

        if ($idUsuario) {
            // ACTUALIZAR USUARIO EXISTENTE
            $sql = "UPDATE usuario SET usuario=?, nombre=?, apellido=?, email=?, rol=?, sigla=?, cuil=?, activo=?, id_referente=? WHERE id_usuario=?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$usuario, $nombre, $apellido, $email, $rol, $sigla, $cuil, $activo, $idReferente, $idUsuario]);
            
            if (!empty($input['clave'])) {
                $stmtP = $pdo->prepare("UPDATE usuario SET clave = MD5(?) WHERE id_usuario = ?");
                $stmtP->execute([$input['clave'], $idUsuario]);
            }
        } else {
            // CREAR USUARIO NUEVO
            $claveTexto = !empty($input['clave']) ? $input['clave'] : '123456'; 
            $sql = "INSERT INTO usuario (usuario, nombre, apellido, email, clave, rol, sigla, cuil, activo, id_referente) VALUES (?, ?, ?, ?, MD5(?), ?, ?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$usuario, $nombre, $apellido, $email, $claveTexto, $rol, $sigla, $cuil, $activo, $idReferente]);
            $idUsuario = $pdo->lastInsertId();
            $enviarMail = true;
        }

        // --- CIRUGÍA DE ROLES POR MÓDULO (usuario_modulo) ---
        $stmtDel = $pdo->prepare("DELETE FROM usuario_modulo WHERE id_usuario = ?");
        $stmtDel->execute([$idUsuario]);

        if (!empty($input['modulos']) && is_array($input['modulos'])) {
            $stmtM = $pdo->prepare("INSERT INTO usuario_modulo (id_usuario, id_modulo, rol) VALUES (?, ?, ?)");
            foreach ($input['modulos'] as $idMod) {
                $stmtM->execute([$idUsuario, $idMod, $rol]); 
            }
        }

        // --- CIRUGÍA LOTE 4: ÁMBITO VISUAL (usuario_dependencia) ---
        $stmtDelDep = $pdo->prepare("DELETE FROM usuario_dependencia WHERE id_usuario = ?");
        $stmtDelDep->execute([$idUsuario]);

        if (!empty($input['dependencias_permitidas']) && is_array($input['dependencias_permitidas'])) {
            $stmtInsertDep = $pdo->prepare("INSERT INTO usuario_dependencia (id_usuario, sigla_dependencia, permiso_tipo) VALUES (?, ?, 'visual')");
            foreach ($input['dependencias_permitidas'] as $siglaDep) {
                $stmtInsertDep->execute([$idUsuario, $siglaDep]);
            }
        }

        $pdo->commit();

        if ($enviarMail && function_exists('enviarCorreoBrevo')) {
            try {
                $baseUrl = "http://localhost/planificacion"; 
                $asunto = "Bienvenido al Sistema";
                $cuerpo = "<h3>¡Hola {$nombre}!</h3>
                           <p>Te informamos que tu cuenta de usuario ha sido habilitada por un Administrador.</p>
                           <p>Ya podés ingresar al Sistema de Gestión y Planificación de la SSRSyA utilizando tu correo y la contraseña que creaste.</p>
                           <p><a href='{$baseUrl}/login' style='padding: 10px 15px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;'>Ingresar al Sistema</a></p>";
                enviarCorreoBrevo([$email], $asunto, $cuerpo);
            } catch (Exception $eMail) { /* Silencioso */ }
        }

        echo json_encode(["success" => true, "mensaje" => "Usuario guardado correctamente"]);

    } elseif ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id_usuario'])) throw new Exception("Falta ID");
        if ($input['id_usuario'] == $_SESSION['usuario_id']) throw new Exception("No puedes eliminarte a ti mismo.");

        $stmt = $pdo->prepare("DELETE FROM usuario WHERE id_usuario = ?");
        $stmt->execute([$input['id_usuario']]);
        
        echo json_encode(["success" => true, "mensaje" => "Usuario eliminado"]);
    } else {
        throw new Exception("Método no soportado");
    }

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>