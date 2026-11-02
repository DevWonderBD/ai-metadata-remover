<?php
/**
 * AI Metadata Remover - Stats REST API for cPanel
 * DevWonder Open Source Initiative
 * 
 * Supports:
 * - GET: returns current metrics
 * - POST: records visits or cleaned image counts (supports offline batch sync)
 */

header('Content-Type: application/json; charset=utf-8');

// Load configuration
$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    // Fallback if config.php is not yet created
    $configFile = __DIR__ . '/config.example.php';
}
require_once $configFile;

// CORS headers
$origin = defined('ALLOWED_ORIGIN') ? ALLOWED_ORIGIN : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function getDbConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}

try {
    $pdo = getDbConnection();
} catch (Exception $e) {
    // If DB is unconfigured or unavailable, return graceful fallback values
    echo json_encode([
        'status' => 'fallback',
        'message' => 'Database connection unavailable',
        'data' => [
            'total_visits' => 0,
            'unique_visitors' => 0,
            'images_cleaned' => 0,
            'ai_detected_count' => 0,
        ]
    ]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT `stat_key`, `stat_value` FROM `site_stats`");
        $rows = $stmt->fetchAll();
        $stats = [
            'total_visits' => 0,
            'unique_visitors' => 0,
            'images_cleaned' => 0,
            'ai_detected_count' => 0,
        ];
        foreach ($rows as $row) {
            $stats[$row['stat_key']] = (int)$row['stat_value'];
        }
        echo json_encode(['status' => 'success', 'data' => $stats]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);

    if (!$data || !isset($data['action'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Missing action']);
        exit;
    }

    $action = $data['action'];

    try {
        if ($action === 'visit') {
            $isUnique = !empty($data['unique']);
            $sql = "UPDATE `site_stats` SET `stat_value` = `stat_value` + 1 WHERE `stat_key` = 'total_visits'";
            $pdo->exec($sql);

            if ($isUnique) {
                $sqlUnique = "UPDATE `site_stats` SET `stat_value` = `stat_value` + 1 WHERE `stat_key` = 'unique_visitors'";
                $pdo->exec($sqlUnique);
            }
            echo json_encode(['status' => 'success', 'recorded' => 'visit']);
        } elseif ($action === 'clean') {
            $count = isset($data['count']) ? max(1, (int)$data['count']) : 1;
            $aiCount = isset($data['ai_count']) ? max(0, (int)$data['ai_count']) : 0;

            $stmt = $pdo->prepare("UPDATE `site_stats` SET `stat_value` = `stat_value` + :cnt WHERE `stat_key` = 'images_cleaned'");
            $stmt->execute([':cnt' => $count]);

            if ($aiCount > 0) {
                $stmtAi = $pdo->prepare("UPDATE `site_stats` SET `stat_value` = `stat_value` + :aicnt WHERE `stat_key` = 'ai_detected_count'");
                $stmtAi->execute([':aicnt' => $aiCount]);
            }

            echo json_encode(['status' => 'success', 'recorded' => 'clean', 'count' => $count, 'ai_count' => $aiCount]);
        } else {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Unknown action']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

