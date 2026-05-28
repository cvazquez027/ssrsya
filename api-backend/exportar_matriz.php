<?php
// api-backend/exportar_matriz.php
ini_set('display_errors', 0);
ini_set('max_execution_time', 600); 
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

if (session_status() === PHP_SESSION_NONE) session_start();

// Validar sesión
if (!isset($_SESSION['usuario_id'])) {
    // CIRUGÍA: Quitamos el http_response_code(401) para evitar que InfinityFree secuestre el error
    echo json_encode(["error" => "No autorizado"]); 
    exit;
}

header("Content-Type: application/json; charset=utf-8");

try {
    $pdo = getDB();
    $pdo->exec("SET sql_mode=''");

    $id_usuario = $_SESSION['usuario_id'];
    $depSeleccionada = isset($_GET['dependencia']) ? trim($_GET['dependencia']) : '';

    if (empty($depSeleccionada)) {
        echo json_encode(['error' => 'Dependencia no especificada']);
        exit;
    }

    // 1. Obtener TODAS las dependencias permitidas: 
    $sqlPermisos = "
        SELECT sigla AS sigla_permitida FROM usuario WHERE id_usuario = ? AND sigla IS NOT NULL AND sigla != ''
        UNION
        SELECT sigla_dependencia AS sigla_permitida FROM usuario_dependencia WHERE id_usuario = ?
    ";
    $stmtPermisos = $pdo->prepare($sqlPermisos);
    $stmtPermisos->execute([$id_usuario, $id_usuario]);
    $permitidasRaw = $stmtPermisos->fetchAll(PDO::FETCH_COLUMN);

    if (empty($permitidasRaw)) {
        echo json_encode(['error' => 'El usuario no tiene una dependencia principal ni dependencias asignadas.']);
        exit;
    }

    $permitidasNorm = array_map(function($item) {
        return strtoupper(trim((string)$item));
    }, $permitidasRaw);
    
    $depSeleccionadaNorm = strtoupper(trim($depSeleccionada));

    // Comodín
    $tieneAccesoGlobal = in_array('TODAS', $permitidasNorm) || in_array('*', $permitidasNorm);

    // 2. Determinar el filtro de la consulta
    $filtroDep = "";
    $params = [];

    if ($depSeleccionadaNorm === 'TODAS') {
        if ($tieneAccesoGlobal) {
            $filtroDep = "";
        } else {
            $inQuery = implode(',', array_fill(0, count($permitidasRaw), '?'));
            $filtroDep = " WHERE UPPER(TRIM(p.sigla_dependencia)) IN ($inQuery)";
            $params = $permitidasNorm; 
        }
    } else {
        if (!$tieneAccesoGlobal && !in_array($depSeleccionadaNorm, $permitidasNorm)) {
            echo json_encode(['error' => 'No tiene permisos para exportar la dependencia seleccionada.']);
            exit;
        }
        $filtroDep = " WHERE UPPER(TRIM(p.sigla_dependencia)) = ?";
        $params = [$depSeleccionadaNorm];
    }

    // 3. Consulta Principal
    $sql = "SELECT 
        p.sigla_dependencia AS `Dependencia`,
        p.descripcion AS `Proyectos`,
        pri.descripcion AS `Prioridad`,
        est.descripcion AS `Estado 2026`,
        refs.nombre_referente AS `Nombre Referente`,
        refs.apellido_referente AS `Apellido Referente`,
        refs.cuil_referente AS `Cuil Referente`,
        refs.dependencia_referente AS `Dependencia Referente`,
        refs.telefono_referente AS `Teléfono Referente`,
        refs.email_referente AS `Email Referente`,
        og.descripcion AS `Objetivo General`,
        oe.descripcion AS `Objetivos Específicos`,
        ta.descripcion AS `Tipo Actividad`,
        ap.descripcion AS `Actividades prioritarias`,
        ti.nombre AS `Tipo de indicador`,
        i.nombre AS `Nombre indicador`,
        i.construccion AS `Construcción indicador`,
        os.descripcion AS `Reporta a otro sistema de monitoreo`,
        i.fuente AS `Fuente`,
        i.linea_base AS `Línea de base 2025`,
        i.meta_anio1 AS `2026`,
        i.meta_anio2 AS `2027`,
        
        COALESCE(tm1.meta_propuesta, 0) AS `t1_propuesta`,
        tm1.meta_alcanzada AS `t1_alcanzada`,
        tm1.detalle_meta_alcanzada AS `t1_detalle`,
        
        COALESCE(tm2.meta_propuesta, 0) AS `t2_propuesta`,
        tm2.meta_alcanzada AS `t2_alcanzada`,
        tm2.detalle_meta_alcanzada AS `t2_detalle`,
        
        COALESCE(tm3.meta_propuesta, 0) AS `t3_propuesta`,
        tm3.meta_alcanzada AS `t3_alcanzada`,
        tm3.detalle_meta_alcanzada AS `t3_detalle`,
        
        COALESCE(tm4.meta_propuesta, 0) AS `t4_propuesta`,
        tm4.meta_alcanzada AS `t4_alcanzada`,
        tm4.detalle_meta_alcanzada AS `t4_detalle`,
        
        '' AS `Observaciones`
    FROM proyecto p
    LEFT JOIN prioridad pri ON p.id_prioridad = pri.id_prioridad
    LEFT JOIN estado est ON p.id_estado = est.id_estado
    LEFT JOIN (
        SELECT 
            pref.id_proyecto,
            GROUP_CONCAT(ref.nombre SEPARATOR ' | ') AS nombre_referente,
            GROUP_CONCAT(ref.apellido SEPARATOR ' | ') AS apellido_referente,
            GROUP_CONCAT(ref.cuil SEPARATOR ' | ') AS cuil_referente,
            GROUP_CONCAT(ref.sigla SEPARATOR ' | ') AS dependencia_referente,
            GROUP_CONCAT(dc.telefono SEPARATOR ' | ') AS telefono_referente,
            GROUP_CONCAT(dc.correo_electronico SEPARATOR ' | ') AS email_referente
        FROM proyecto_referente pref
        JOIN referente ref ON pref.id_referente = ref.id_referente
        LEFT JOIN datos_contacto dc ON ref.id_referente = dc.id_referente AND dc.vigente = 1
        GROUP BY pref.id_proyecto
    ) refs ON p.id_proyecto = refs.id_proyecto
    LEFT JOIN objetivo_general og ON p.id_proyecto = og.id_proyecto
    LEFT JOIN objetivo_especifico oe ON og.id_og = oe.id_og
    LEFT JOIN actividad_prioritaria ap ON oe.id_oe = ap.id_oe
    LEFT JOIN tipo_actividad_prioritaria ta ON ap.id_tipo_actividad_prioritaria = ta.id_tipo_actividad_prioritaria
    LEFT JOIN indicador i ON ap.id_actividad = i.id_actividad
    LEFT JOIN tipo_indicador ti ON i.id_tipo_indicador = ti.id_tipo_indicador
    LEFT JOIN otro_sistema os ON i.id_otro_sistema = os.id_otro_sistema
    LEFT JOIN monitoreo tm1 ON i.id_indicador = tm1.id_indicador AND tm1.id_periodo_monitoreo = 1
    LEFT JOIN monitoreo tm2 ON i.id_indicador = tm2.id_indicador AND tm2.id_periodo_monitoreo = 2
    LEFT JOIN monitoreo tm3 ON i.id_indicador = tm3.id_indicador AND tm3.id_periodo_monitoreo = 3
    LEFT JOIN monitoreo tm4 ON i.id_indicador = tm4.id_indicador AND tm4.id_periodo_monitoreo = 4
    $filtroDep
    ORDER BY p.id_proyecto, og.id_og, oe.id_oe, ap.id_actividad";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($data);

} catch (Exception $e) {
    // CIRUGÍA: Quitamos el http_response_code(500) para evitar secuestro de InfinityFree
    echo json_encode(['error' => 'Error al generar la exportación: ' . $e->getMessage()]);
}
?>