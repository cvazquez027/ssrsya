<?php
// C:\xampp\htdocs\planificacion\api-backend\db.php
$whitelist = array('127.0.0.1', '::1', 'localhost');

if (in_array($_SERVER['HTTP_HOST'], $whitelist)) {
    // --- CREDENCIALES LOCALES (localhost) ---
    $host = 'localhost';
    $db   = 'seguimiento_planificacion';
    $user = 'root';
    $pass = 'Tomi.vc_0725';
    $port = '3306';
} else {
    // --- CREDENCIALES PRODUCCIÓN (InfinityFree) ---
    $host = 'sql308.infinityfree.com';
    $db   = 'if0_39971369_seguimiento_planificacion';
    $user = 'if0_39971369';
    $pass = 'Tomi0725';
    $port = '3306';
}

$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;port=$port;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

function getDB() {
    global $dsn, $user, $pass, $options;
    try {
        return new PDO($dsn, $user, $pass, $options);
    } catch (\PDOException $e) {
        http_response_code(500);
        // En desarrollo mostramos el error, en producción no deberíamos
        echo json_encode(["error" => "Error de conexión BD: " . $e->getMessage()]);
        exit;
    }
}
?>