<?php
// api-backend/lista_maestras.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

if (session_status() === PHP_SESSION_NONE) session_start();

if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401); echo json_encode(["error" => "No autorizado"]); exit;
}

$rol = $_SESSION['rol'];
$siglaUsuario = $_SESSION['sigla'];

session_write_close(); 

header("Content-Type: application/json");

$tabla = $_GET['tabla'] ?? '';
$id = $_GET['id'] ?? null;

// --- REGLA 1: Restricciones de Autorizante ---
// MODIFICACIÓN QUIRÚRGICA: Permitimos que el autorizante acceda a 'modulo' para poder renderizar la barra lateral
if ($rol === 'autorizante') {
    if ($tabla !== 'modulo') {
        http_response_code(403);
        echo json_encode(["error" => "Acceso denegado"]);
        exit;
    }
}

try {
    $pdo = getDB();

    // --- REGLA 2: Restricciones de Carga ---
    if ($rol === 'carga') {
        // MODIFICACIÓN QUIRÚRGICA: Agregamos 'categoria' a las tablas permitidas
        if (!in_array($tabla, ['referente', 'datos_contacto', 'modulo', 'categoria'])) {
            echo json_encode([]); 
            exit;
        }
    }

    $data = [];

    switch ($tabla) {
        case 'modulo':
            $sql = "SELECT * FROM modulo WHERE vigente = 1 ORDER BY descripcion";
            if ($rol === 'admin') {
                $sql = "SELECT * FROM modulo ORDER BY descripcion";
            }
            $stmt = $pdo->query($sql);
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;

        case 'estado':
        case 'prioridad':
        case 'periodo_monitoreo':
        case 'otro_sistema':
        case 'dependencia':
        case 'tipo_actividad_prioritaria': 
            if ($tabla === 'estado') $sql = "SELECT * FROM estado ORDER BY id_estado";
            elseif ($tabla === 'prioridad') $sql = "SELECT * FROM prioridad ORDER BY id_prioridad";
            elseif ($tabla === 'periodo_monitoreo') $sql = "SELECT * FROM periodo_monitoreo ORDER BY id_periodo_monitoreo DESC";
            elseif ($tabla === 'otro_sistema') $sql = "SELECT * FROM otro_sistema ORDER BY descripcion";
            elseif ($tabla === 'tipo_actividad_prioritaria') $sql = "SELECT * FROM tipo_actividad_prioritaria ORDER BY descripcion";
            elseif ($tabla === 'dependencia') {
                $sql = "SELECT d.*, CONCAT(r.nombre, ' ', r.apellido) as referente_nombre, d2.descripcion as superior_descripcion
                        FROM dependencia d
                        LEFT JOIN referente r ON d.id_referente = r.id_referente
                        LEFT JOIN dependencia d2 ON d.sigla_superior = d2.sigla
                        ORDER BY d.sigla";
            }
            $stmt = $pdo->query($sql);
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;

        case 'tipo_indicador': 
            $stmt = $pdo->query("SELECT * FROM tipo_indicador ORDER BY nombre");
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;

        // MODIFICACIÓN QUIRÚRGICA: Agregamos el case para reconocer la tabla 'categoria'
        case 'categoria':
            $stmt = $pdo->query("SELECT * FROM categoria WHERE vigente = 1 ORDER BY nombre");
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;

        case 'referente':
            $sql = "SELECT r.*, d.descripcion as dependencia_descripcion 
                    FROM referente r
                    LEFT JOIN dependencia d ON r.sigla = d.sigla";
            
            if ($rol === 'carga') {
                $sql .= " WHERE r.sigla = :sigla";
                $sql .= " ORDER BY r.apellido, r.nombre";
                $stmt = $pdo->prepare($sql);
                $stmt->execute(['sigla' => $siglaUsuario]);
            } else {
                $sql .= " ORDER BY r.apellido, r.nombre";
                $stmt = $pdo->query($sql);
            }
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;

        case 'datos_contacto':
            if (!$id) throw new Exception("Falta ID Referente");
            
            if ($rol === 'carga') {
                $stmtCheck = $pdo->prepare("SELECT sigla FROM referente WHERE id_referente = ?");
                $stmtCheck->execute([$id]);
                $siglaRef = $stmtCheck->fetchColumn();
                if ($siglaRef !== $siglaUsuario) {
                    echo json_encode([]); 
                    exit;
                }
            }

            $stmt = $pdo->prepare("SELECT * FROM datos_contacto WHERE id_referente = ? ORDER BY id_datos_contacto DESC");
            $stmt->execute([$id]);
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;
            
        default:
            throw new Exception("Tabla no reconocida: " . $tabla);
    }

    echo json_encode($data);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>