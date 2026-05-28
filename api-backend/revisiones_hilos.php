<?php
// api-backend/revisiones_hilos.php
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

header("Content-Type: application/json");
$pdo = getDB();
$pdo->exec("SET NAMES 'utf8mb4'");

$modo = $_GET['modo'] ?? 'lista'; 
$rol = $_SESSION['rol'];
$siglaUsuario = $_SESSION['sigla'];

try {
    if ($modo === 'lista') {
        // (El código de la lista sigue igual, no cambia la lógica de agrupación)
        $sql = "SELECT DISTINCT 
                    r.id_tabla_revisada,
                    r.id_pk_tabla_revisada,
                    tr.tabla_revisada,
                    CASE 
                        WHEN tr.tabla_revisada = 'proyecto' THEN (SELECT descripcion FROM proyecto WHERE id_proyecto = r.id_pk_tabla_revisada)
                        WHEN tr.tabla_revisada = 'objetivo_especifico' THEN (SELECT descripcion FROM objetivo_especifico WHERE id_oe = r.id_pk_tabla_revisada)
                        WHEN tr.tabla_revisada = 'actividad_prioritaria' THEN (SELECT descripcion FROM actividad_prioritaria WHERE id_actividad = r.id_pk_tabla_revisada)
                        WHEN tr.tabla_revisada = 'indicador' THEN (SELECT nombre FROM indicador WHERE id_indicador = r.id_pk_tabla_revisada)
                        ELSE 'Entidad Desconocida'
                    END as titulo_entidad,
                    CASE 
                        WHEN tr.tabla_revisada = 'proyecto' THEN (SELECT sigla_dependencia FROM proyecto WHERE id_proyecto = r.id_pk_tabla_revisada)
                        WHEN tr.tabla_revisada = 'objetivo_especifico' THEN (SELECT p.sigla_dependencia FROM objetivo_especifico oe JOIN objetivo_general og ON oe.id_og=og.id_og JOIN proyecto p ON og.id_proyecto=p.id_proyecto WHERE oe.id_oe = r.id_pk_tabla_revisada)
                        WHEN tr.tabla_revisada = 'actividad_prioritaria' THEN (SELECT p.sigla_dependencia FROM actividad_prioritaria a JOIN objetivo_especifico oe ON a.id_oe=oe.id_oe JOIN objetivo_general og ON oe.id_og=og.id_og JOIN proyecto p ON og.id_proyecto=p.id_proyecto WHERE a.id_actividad = r.id_pk_tabla_revisada)
                        WHEN tr.tabla_revisada = 'indicador' THEN (SELECT p.sigla_dependencia FROM indicador i JOIN actividad_prioritaria a ON i.id_actividad=a.id_actividad JOIN objetivo_especifico oe ON a.id_oe=oe.id_oe JOIN objetivo_general og ON oe.id_og=og.id_og JOIN proyecto p ON og.id_proyecto=p.id_proyecto WHERE i.id_indicador = r.id_pk_tabla_revisada)
                        ELSE ''
                    END as sigla_dependencia,
                    MAX(r.id_revision_ssrsya) as ultimo_id
                FROM revision_ssrsya r
                JOIN tabla_revisada tr ON r.id_tabla_revisada = tr.id_tabla_revisada
                GROUP BY r.id_tabla_revisada, r.id_pk_tabla_revisada, tr.tabla_revisada
                ORDER BY ultimo_id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $raw = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $filtrado = [];
        foreach ($raw as $row) {
            if ($rol !== 'admin' && $rol !== 'cargafull') {
                if ($row['sigla_dependencia'] !== $siglaUsuario) continue;
            }
            $filtrado[] = $row;
        }
        echo json_encode($filtrado);

    } elseif ($modo === 'mensajes') {
        // --- AQUÍ CAMBIA LA LÓGICA DE VISUALIZACIÓN ---
        $idTabla = $_GET['id_tabla'];
        $idPk = $_GET['id_pk'];

        // Traemos las filas tal cual están en la BD
        $sql = "SELECT 
                    r.*, 
                    u.nombre as u_nombre, u.apellido as u_apellido, u.sigla as u_sigla
                FROM revision_ssrsya r
                LEFT JOIN usuario u ON r.id_usuario = u.id_usuario
                WHERE r.id_tabla_revisada = ? AND r.id_pk_tabla_revisada = ?
                ORDER BY r.id_revision_ssrsya ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$idTabla, $idPk]);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Procesamos para convertir cada fila en 1 o 2 mensajes visuales
        $chat = [];
        $cerrado = false;

        foreach ($filas as $fila) {
            // 1. Mensaje de SSRSyA (siempre existe en la fila al crearla)
            if (!empty($fila['comentario_ssrsya'])) {
                $chat[] = [
                    'id' => $fila['id_revision_ssrsya'] . '_C', // ID único virtual
                    'real_id' => $fila['id_revision_ssrsya'],
                    'tipo' => 'comentario',
                    'texto' => $fila['comentario_ssrsya'],
                    'autor' => $fila['u_sigla'] ?: 'SSRSyA', // El usuario que creó el registro (SSRSyA)
                    'es_admin' => true,
                    'fecha' => $fila['id_revision_ssrsya'] // Usamos ID como proxy de tiempo si no hay fecha
                ];
            }

            // 2. Mensaje de Dependencia (si ya se hizo el UPDATE)
            if (!empty($fila['respuesta_dependencia'])) {
                $chat[] = [
                    'id' => $fila['id_revision_ssrsya'] . '_R',
                    'real_id' => $fila['id_revision_ssrsya'],
                    'tipo' => 'respuesta',
                    'texto' => $fila['respuesta_dependencia'],
                    'autor' => 'Dependencia', // O podrías guardar el ID del usuario que respondió si agregaras esa columna
                    'es_admin' => false,
                    'fecha' => $fila['id_revision_ssrsya'] // Aparece después por orden de array
                ];
            }

            if ($fila['revision_cerrada'] == 1) $cerrado = true;
        }

        echo json_encode(["mensajes" => $chat, "cerrado" => $cerrado]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>