<?php
// test_modelos.php
header('Content-Type: application/json');

$GEMINI_API_KEY = "AIzaSyB-8-fWmf1_wLtEu0hS5QdbRmnc81MPElc";

$url = "https://generativelanguage.googleapis.com/v1beta/models?key=" . $GEMINI_API_KEY;

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Apagamos SSL por localhost

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode >= 200 && $httpCode < 300) {
    $data = json_decode($response, true);
    $modelos_utiles = [];
    
    // Filtramos para mostrar solo los modelos que soportan generacion de texto
    foreach ($data['models'] as $modelo) {
        if (in_array('generateContent', $modelo['supportedGenerationMethods'] ?? [])) {
            $modelos_utiles[] = [
                "nombre_exacto" => $modelo['name'],
                "version" => $modelo['version'] ?? 'N/A',
                "metodos" => $modelo['supportedGenerationMethods']
            ];
        }
    }
    
    echo json_encode([
        "estado" => "EXITO",
        "modelos_disponibles_para_chat" => $modelos_utiles
    ], JSON_PRETTY_PRINT);
} else {
    echo json_encode([
        "estado" => "ERROR",
        "http_code" => $httpCode,
        "respuesta_cruda" => json_decode($response, true)
    ], JSON_PRETTY_PRINT);
}
?>