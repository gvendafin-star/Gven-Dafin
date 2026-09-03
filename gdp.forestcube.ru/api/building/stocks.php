<?php
// api/building/stocks.php - Обновление остатков стройматериалов

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/../../includes/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    requireAuthWithCSRF();
    
    $input = json_decode(file_get_contents('php://input'), true);
    $updates = $input['updates'] ?? [];
    
    if (empty($updates)) {
        echo json_encode(['success' => true, 'message' => 'Нет изменений']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("UPDATE building_stocks SET stock_available = ? WHERE product_id = ?");
        
        foreach ($updates as $data) {
            $product_id = $data['product_id'] ?? null;
            $stock_available = $data['stock_available'] ?? null;
            if ($product_id !== null && $stock_available !== null) {
                $stmt->execute([$stock_available, $product_id]);
            }
        }
        
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Сохранено']);
    } catch(PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Метод не поддерживается']);
?>