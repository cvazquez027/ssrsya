<?php
// api-backend/check_pendientes.php
ini_set('display_errors', 0);
error_reporting(E_ALL);
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

require __DIR__ . '/session_config.php';
if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(["pendientes" => 0]);
    exit;
}

header("Content-Type: application/json");
$pdo = getDB();
$rol = $_SESSION['rol'];
$siglaUsuario = $_SESSION['sigla'];

try {
    $pendientes = 0;

    if ($rol === 'admin' || $rol === 'cargafull') {
        // === ADMIN / SSRSyA ===
        // Pendiente: Hilos abiertos donde la dependencia YA respondió (respuesta_dependencia NOT NULL)
        // y yo aún no lo cerré (revision_cerrada = 0).
        // (Nota: Si admin comenta de nuevo, se crea fila nueva, así que buscamos filas respondidas en hilos abiertos)
        
        $sql = "SELECT COUNT(*) FROM revision_ssrsya 
                WHERE revision_cerrada = 0 
                  AND respuesta_dependencia IS NOT NULL
                  AND respuesta_dependencia != ''"; // Asegurar que no esté vacío
        
        $stmt = $pdo->query($sql);
        $pendientes = $stmt->fetchColumn();

    } else {
        // === DEPENDENCIA (Carga) ===
        // Pendiente: Hilos abiertos (de mi dependencia) donde Admin comentó (comentario_ssrsya NOT NULL)
        // Y yo todavía NO respondí (respuesta_dependencia IS NULL).
        
        // Primero necesitamos filtrar por dependencia. Hacemos JOIN con las tablas.
        // Hacemos una query dinámica o union para cubrir todas las entidades
        
        // Estrategia simplificada: Buscamos revisiones abiertas sin respuesta, 
        // y luego en PHP filtramos si pertenecen a la dependencia del usuario.
        // (Es menos eficiente pero más seguro si el SQL complejo falla, aunque intentaremos SQL directo).

        // SQL Optimizado:
        $sql = "SELECT COUNT(DISTINCT r.id_revision_ssrsya)
                FROM revision_ssrsya r
                JOIN tabla_revisada tr ON r.id_tabla_revisada = tr.id_tabla_revisada
                -- Join gigante para validar dependencia
                LEFT JOIN proyecto p ON tr.tabla_revisada = 'proyecto' AND p.id_proyecto = r.id_pk_tabla_revisada
                LEFT JOIN objetivo_especifico oe ON tr.tabla_revisada = 'objetivo_especifico' AND oe.id_oe = r.id_pk_tabla_revisada
                LEFT JOIN actividad_prioritaria ap ON tr.tabla_revisada = 'actividad_prioritaria' AND ap.id_actividad = r.id_pk_tabla_revisada
                LEFT JOIN indicador i ON tr.tabla_revisada = 'indicador' AND i.id_indicador = r.id_pk_tabla_revisada
                
                -- Joins para llegar a proyecto desde hijos
                LEFT JOIN objetivo_general og_oe ON oe.id_og = og_oe.id_og
                LEFT JOIN proyecto p_oe ON og_oe.id_proyecto = p_oe.id_proyecto
                
                LEFT JOIN objetivo_especifico oe_ap ON ap.id_oe = oe_ap.id_oe
                LEFT JOIN objetivo_general og_ap ON oe_ap.id_og = og_ap.id_og
                LEFT JOIN proyecto p_ap ON og_ap.id_proyecto = p_ap.id_proyecto

                LEFT JOIN actividad_prioritaria ap_i ON i.id_actividad = ap_i.id_actividad
                LEFT JOIN objetivo_especifico oe_i ON ap_i.id_oe = oe_i.id_oe
                LEFT JOIN objetivo_general og_i ON oe_i.id_og = og_i.id_og
                LEFT JOIN proyecto p_i ON og_i.id_proyecto = p_i.id_proyecto

                WHERE r.revision_cerrada = 0
                  AND r.comentario_ssrsya IS NOT NULL
                  AND (r.respuesta_dependencia IS NULL OR r.respuesta_dependencia = '')
                  AND (
                      p.sigla_dependencia = ? OR
                      p_oe.sigla_dependencia = ? OR
                      p_ap.sigla_dependencia = ? OR
                      p_i.sigla_dependencia = ?
                  )";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$siglaUsuario, $siglaUsuario, $siglaUsuario, $siglaUsuario]);
        $pendientes = $stmt->fetchColumn();
    }

    echo json_encode(["pendientes" => $pendientes]);

} catch (Exception $e) {
    echo json_encode(["pendientes" => 0, "error" => $e->getMessage()]);
}
?>