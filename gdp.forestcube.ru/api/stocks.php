<?php
// api/stocks.php - ПОДДЕРЖКА ПАКЕТНОГО СОХРАНЕНИЯ (МАССИВ)

require_once __DIR__ . '/security.php';

$method = $_SERVER['REQUEST_METHOD'];

// ========== GET ==========
if ($method === 'GET') {
    requireAuth();
    require_once __DIR__ . '/../includes/db.php';
    
    try {
        $stmt = $pdo->query("SELECT product_id, product_name, stock_available FROM stocks ORDER BY product_id");
        $stocks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'stocks' => $stocks]);
    } catch(PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Ошибка запроса: ' . $e->getMessage()]);
    }
    exit;
}

// ========== POST ==========
if ($method === 'POST') {
    requireAuthWithCSRF();
    require_once __DIR__ . '/../includes/db.php';
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Проверяем, пришёл ли массив (пакетная отправка)
    if (isset($input['updates']) && is_array($input['updates'])) {
        // ===== ПАКЕТНОЕ СОХРАНЕНИЕ =====
        $updates = $input['updates'];
        
        if (empty($updates)) {
            echo json_encode(['success' => true, 'message' => 'Нет изменений для сохранения']);
            exit;
        }
        
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("UPDATE stocks SET stock_available = ? WHERE product_id = ?");
            
            foreach ($updates as $data) {
                $product_id = $data['product_id'] ?? null;
                $stock_available = $data['stock_available'] ?? null;
                
                if ($product_id !== null && $stock_available !== null) {
                    $stmt->execute([$stock_available, $product_id]);
                }
            }
            
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Сохранено ' . count($updates) . ' позиций']);
            
        } catch(PDOException $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Ошибка обновления: ' . $e->getMessage()]);
        }
        exit;
        
    } else {
        // ===== ОДИНОЧНОЕ СОХРАНЕНИЕ (для совместимости) =====
        $product_id = $input['product_id'] ?? null;
        $stock_available = $input['stock_available'] ?? null;
        
        if (!$product_id || $stock_available === null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Не указан ID или остаток']);
            exit;
        }
        
        try {
            $stmt = $pdo->prepare("UPDATE stocks SET stock_available = ? WHERE product_id = ?");
            $stmt->execute([$stock_available, $product_id]);
            echo json_encode(['success' => true]);
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Ошибка обновления: ' . $e->getMessage()]);
        }
        exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Метод не поддерживается']);
?>