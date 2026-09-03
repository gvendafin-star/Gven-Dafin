<?php
// api/orders.php - с CSRF-защитой и фильтром для мейкера

require_once __DIR__ . '/security.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$statusFilter = $_GET['status'] ?? '';
$filterMode = $_GET['filter'] ?? ''; // 'active' для мейкера

// GET - получение данных (без CSRF)
if ($method === 'GET') {
    requireAuth();
    require_once __DIR__ . '/../includes/db.php';
    
    // ========== ПОЛУЧЕНИЕ ОДНОЙ ЗАЯВКИ ПО ID ==========
    if ($action === 'get') {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Не указан ID']);
            exit;
        }
        try {
            $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
            $stmt->execute([$id]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($order) {
                echo json_encode(['success' => true, 'order' => $order]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Заявка не найдена']);
            }
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    // ========== ПОЛУЧЕНИЕ ВСЕХ ЗАЯВОК С ФИЛЬТРОМ ==========
    if ($action === 'all' || !$action) {
        try {
            // ⭐ ДЛЯ МЕЙКЕРА — ТОЛЬКО АКТИВНЫЕ ЗАДАНИЯ
            if ($filterMode === 'active') {
                $sql = "SELECT * FROM orders 
                        WHERE status != 'unpaid' 
                          AND maker_completed = 0 
                          AND status IN ('preorder', 'shipped')
                        ORDER BY created_at DESC";
                $params = [];
            } else {
                // Для всех остальных — все заявки с фильтром по статусу
                $sql = "SELECT * FROM orders";
                $params = [];
                
                if ($statusFilter && $statusFilter !== 'all') {
                    $sql .= " WHERE status = ?";
                    $params[] = $statusFilter;
                }
                $sql .= " ORDER BY created_at DESC";
            }
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Считаем статистику
            $stats = [
                'total' => 0,
                'sum' => 0,
                'volume' => 0,
                'delivery' => 0,
                'card' => 0,
                'preorder_sum' => 0
            ];
            
            foreach ($orders as $order) {
                // Исключаем только 'unpaid' из активных заявок
                if ($order['status'] !== 'unpaid') {
                    $stats['total']++;
                    $stats['sum'] += floatval($order['total']);
                    
                    // Объём
                    $volume = 0;
                    if (!empty($order['items'])) {
                        $items = explode(',', $order['items']);
                        foreach ($items as $item) {
                            if (preg_match('/([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)/', $item, $match)) {
                                $w = floatval($match[1]);
                                $h = floatval($match[2]);
                                $l = floatval($match[3]);
                                if (preg_match('/(\d+)\s*шт/', $item, $qtyMatch)) {
                                    $qty = intval($qtyMatch[1]);
                                    $volume += $w * $h * $l * $qty;
                                }
                            }
                        }
                    }
                    $stats['volume'] += $volume;
                    
                    if ($order['status'] === 'preorder') {
                        $stats['preorder_sum'] += floatval($order['total']);
                    }
                }
                if ($order['delivery_needed']) $stats['delivery']++;
                if ($order['card_payment']) $stats['card']++;
            }
            
            echo json_encode([
                'success' => true, 
                'orders' => $orders,
                'stats' => $stats
            ]);
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    // ========== ПОЛУЧЕНИЕ КЛИЕНТОВ ==========
    if ($action === 'clients') {
        try {
            $stmt = $pdo->query("
                SELECT DISTINCT 
                    client_name, 
                    phone, 
                    address 
                FROM orders 
                WHERE client_name != '' AND phone != ''
                ORDER BY created_at DESC 
                LIMIT 50
            ");
            $clients = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'clients' => $clients]);
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Неизвестное действие']);
    exit;
}

// DELETE - удаление заявки
if ($method === 'DELETE') {
    requireAuthWithCSRF();
    require_once __DIR__ . '/../includes/db.php';
    
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? null;
    $order_number = $input['order_number'] ?? null;
    
    if (!$id || !$order_number) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Не указан ID или номер заявки']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE");
        $stmt->execute([$id]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Заявка не найдена']);
            exit;
        }
        
        // Возвращаем остатки если заявка не была в статусе unpaid
        if ($order['status'] !== 'unpaid') {
            $itemsString = $order['items'] ?? '';
            if ($itemsString) {
                $items = array_map('trim', explode(',', $itemsString));
                foreach ($items as $item) {
                    if (preg_match('/^(.+?)\s*[-–]\s*(\d+)\s*шт/', $item, $match)) {
                        $product_name = trim($match[1]);
                        $qty = intval($match[2]);
                        
                        if ($qty > 0) {
                            $stmt = $pdo->prepare("SELECT product_id, stock_available FROM stocks WHERE product_name = ? FOR UPDATE");
                            $stmt->execute([$product_name]);
                            $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                            
                            if ($stock) {
                                $new_stock = $stock['stock_available'] + $qty;
                                $stmt = $pdo->prepare("UPDATE stocks SET stock_available = ? WHERE product_id = ?");
                                $stmt->execute([$new_stock, $stock['product_id']]);
                            }
                        }
                    }
                }
            }
        }
        
        $stmt = $pdo->prepare("DELETE FROM orders WHERE id = ?");
        $stmt->execute([$id]);
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true, 
            'message' => 'Заявка удалена, остатки возвращены'
        ]);
        
    } catch(PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Ошибка удаления: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Метод не поддерживается']);
?>