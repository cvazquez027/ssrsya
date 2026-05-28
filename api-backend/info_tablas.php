<?php
// api-backend/debug_datos.php
ini_set('display_errors', 1);
error_reporting(E_ALL);
require 'db.php';

// 👇 CAMBIA ESTO POR LA SIGLA QUE USAS EN TU LOGIN
$sigla_a_probar = "SSRSYA"; 

echo "<h1>🕵️‍♂️ Rastreando datos para: $sigla_a_probar</h1>";

try {
    $pdo = getDB();

    // 1. BUSCAR PROYECTOS
    echo "<h3>1. Buscando Proyectos...</h3>";
    $sql1 = "SELECT id_proyecto, descripcion FROM proyecto WHERE sigla_dependencia = ?";
    $stmt = $pdo->prepare($sql1);
    $stmt->execute([$sigla_a_probar]);
    $proyectos = $stmt->fetchAll();

    $ids_proyectos = [];
    if (count($proyectos) > 0) {
        echo "✅ Encontré " . count($proyectos) . " proyectos.<br>";
        foreach($proyectos as $p) {
            echo "--- ID: " . $p['id_proyecto'] . " | " . substr($p['descripcion'], 0, 50) . "...<br>";
            $ids_proyectos[] = $p['id_proyecto'];
        }
    } else {
        die("❌ No hay proyectos para esta sigla. Fin del análisis.");
    }

    // 2. BUSCAR OBJETIVOS GENERALES (Usando los IDs de arriba)
    echo "<h3>2. Buscando Objetivos Generales...</h3>";
    if (empty($ids_proyectos)) die("Sin proyectos no puedo buscar objetivos.");
    
    // Creamos un string de signos de pregunta para el IN (?,?,?)
    $inQuery = implode(',', array_fill(0, count($ids_proyectos), '?'));
    
    $sql2 = "SELECT id_og, descripcion, id_proyecto FROM objetivo_general WHERE id_proyecto IN ($inQuery)";
    $stmt = $pdo->prepare($sql2);
    $stmt->execute($ids_proyectos);
    $ogs = $stmt->fetchAll();

    $ids_ogs = [];
    if (count($ogs) > 0) {
        echo "✅ Encontré " . count($ogs) . " objetivos generales vinculados.<br>";
        foreach($ogs as $o) {
            echo "--- ID OG: " . $o['id_og'] . " (Del Proyecto " . $o['id_proyecto'] . ")<br>";
            $ids_ogs[] = $o['id_og'];
        }
    } else {
        echo "❌ <strong>AQUÍ SE CORTA:</strong> Hay proyectos, pero ninguno tiene 'Objetivos Generales' cargados en la base de datos.<br>";
        die();
    }

    // 3. BUSCAR OBJETIVOS ESPECÍFICOS
    echo "<h3>3. Buscando Objetivos Específicos...</h3>";
    $inQueryOG = implode(',', array_fill(0, count($ids_ogs), '?'));
    
    $sql3 = "SELECT id_oe, descripcion, id_og FROM objetivo_especifico WHERE id_og IN ($inQueryOG)";
    $stmt = $pdo->prepare($sql3);
    $stmt->execute($ids_ogs);
    $oes = $stmt->fetchAll();

    if (count($oes) > 0) {
        echo "✅ Encontré " . count($oes) . " objetivos específicos.<br>";
    } else {
        echo "❌ <strong>AQUÍ SE CORTA:</strong> Hay Objetivos Generales, pero no tienen 'Específicos'.<br>";
    }

} catch (Exception $e) {
    echo "Error SQL: " . $e->getMessage();
}
?>