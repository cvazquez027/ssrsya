<?php
// api-backend/dashboard_comu.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';
require __DIR__ . '/auth_utils.php';

if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401);
    echo json_encode(["error" => "No autorizado"]);
    exit;
}

header("Content-Type: application/json; charset=utf-8");

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");
    $id_usuario = $_SESSION['usuario_id'];

    $stmtRol = $pdo->prepare("SELECT rol FROM usuario_modulo WHERE id_usuario = ? AND id_modulo = (SELECT id_modulo FROM modulo WHERE clave = 'COMUNICACION')");
    $stmtRol->execute([$id_usuario]);
    $rol_comu = $stmtRol->fetchColumn() ?: 'consulta';

    // --- CIRUGÍA: Filtros RLS para Actividades e Indicadores ---
    $filtroAct = getSQLFilter($pdo, $id_usuario, $rol_comu, 'a.sigla');
    $whereA = is_array($filtroAct) ? $filtroAct['sql'] : "";
    $paramsA = is_array($filtroAct) ? $filtroAct['params'] : [];

    $filtroInd = getSQLFilter($pdo, $id_usuario, $rol_comu, 'i.sigla');
    $whereI = is_array($filtroInd) ? $filtroInd['sql'] : "";
    $paramsI = is_array($filtroInd) ? $filtroInd['params'] : [];

    $dashboard = [
        "kpis" => [],
        "por_tipo" => [],
        "por_estado" => [],
        "indicadores" => []
    ];

    // 1. KPIs Generales
    $sqlKpi = "SELECT 
        COUNT(*) as total_actividades,
        SUM(CASE WHEN id_comu_estado = 99 THEN 1 ELSE 0 END) as total_cerradas,
        SUM(CASE WHEN id_comu_estado != 99 THEN 1 ELSE 0 END) as total_en_curso,
        SUM(CASE WHEN publicado = 1 THEN 1 ELSE 0 END) as total_publicadas
    FROM comu_actividad a WHERE 1=1 " . $whereA;
    $stmtKpi = $pdo->prepare($sqlKpi);
    $stmtKpi->execute($paramsA);
    $dashboard['kpis'] = $stmtKpi->fetch(PDO::FETCH_ASSOC);

    // 2. Desglose por Tipo de Actividad
    $sqlTipo = "SELECT t.descripcion as name, COUNT(a.id_comu_actividad) as value 
                FROM comu_actividad a
                JOIN comu_tipo_actividad t ON a.id_comu_tipo_actividad = t.id_comu_tipo_actividad
                WHERE 1=1 " . $whereA . "
                GROUP BY t.id_comu_tipo_actividad, t.descripcion";
    $stmtTipo = $pdo->prepare($sqlTipo);
    $stmtTipo->execute($paramsA);
    $dashboard['por_tipo'] = $stmtTipo->fetchAll(PDO::FETCH_ASSOC);

    // 3. Cuello de Botella (Top Estados)
    $sqlEstado = "SELECT e.descripcion as name, COUNT(a.id_comu_actividad) as value 
                  FROM comu_actividad a
                  JOIN comu_estado e ON a.id_comu_estado = e.id_comu_estado
                  WHERE 1=1 " . $whereA . "
                  GROUP BY e.id_comu_estado, e.descripcion
                  ORDER BY value DESC LIMIT 10";
    $stmtEstado = $pdo->prepare($sqlEstado);
    $stmtEstado->execute($paramsA);
    $dashboard['por_estado'] = $stmtEstado->fetchAll(PDO::FETCH_ASSOC);

    // 4. Rendimiento de Indicadores
    $sqlInd = "SELECT meta_propuesta, meta_alcanzada FROM comu_indicador i WHERE 1=1 " . $whereI;
    $stmtInd = $pdo->prepare($sqlInd);
    $stmtInd->execute($paramsI);
    $indicadores = $stmtInd->fetchAll(PDO::FETCH_ASSOC);
    
    $cumplidos = 0; $no_cumplidos = 0; $pendientes = 0;
    foreach ($indicadores as $ind) {
        if ($ind['meta_alcanzada'] === null) {
            $pendientes++;
        } else {
            if ((float)$ind['meta_alcanzada'] >= (float)$ind['meta_propuesta']) {
                $cumplidos++;
            } else {
                $no_cumplidos++;
            }
        }
    }
    
    $dashboard['indicadores'] = [
        ["name" => "Cumplidos", "value" => $cumplidos, "color" => "#22c55e"],
        ["name" => "No Cumplidos", "value" => $no_cumplidos, "color" => "#ef4444"],
        ["name" => "Pendientes", "value" => $pendientes, "color" => "#e2e8f0"]
    ];

    echo json_encode($dashboard);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>