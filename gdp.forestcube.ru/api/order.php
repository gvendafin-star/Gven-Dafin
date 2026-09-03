<?php
// api/order.php - ПОЛНАЯ ВЕРСИЯ С ПОДДЕРЖКОЙ СТРОЙМАТЕРИАЛОВ

require_once __DIR__ . '/security.php';

// ========== НАСТРОЙКА ЛОГИРОВАНИЯ ==========
$logFile = __DIR__ . '/../error_log';

function writeLog($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message" . PHP_EOL;
    file_put_contents($logFile, $logMessage, FILE_APPEND | LOCK_EX);
}

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', $logFile);

writeLog("========== НОВЫЙ ЗАПРОС ==========");
writeLog("Метод: " . $_SERVER['REQUEST_METHOD']);
writeLog("URI: " . $_SERVER['REQUEST_URI']);

require_once __DIR__ . '/../includes/db.php';

$method = $_SERVER['REQUEST_METHOD'];

// ========== GET - получение заявок ==========
if ($method === 'GET') {
    requireAuth();
    
    $action = $_GET['action'] ?? '';
    $statusFilter = $_GET['status'] ?? '';
    
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
                $order['services'] = [];
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
    
    if ($action === 'all' || !$action) {
        try {
            $sql = "SELECT * FROM orders";
            $params = [];
            
            if ($statusFilter && $statusFilter !== 'all') {
                $sql .= " WHERE status = ?";
                $params[] = $statusFilter;
            }
            
            $sql .= " ORDER BY created_at DESC";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $stats = [
                'total' => 0,
                'sum' => 0,
                'volume' => 0,
                'delivery' => 0,
                'card' => 0,
                'preorder_sum' => 0
            ];
            
            foreach ($orders as $order) {
                if ($order['status'] !== 'unpaid') {
                    $stats['total']++;
                    $stats['sum'] += floatval($order['total']);
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

// ========== POST - создание/обновление заявки ==========
if ($method === 'POST') {
    requireAuthWithCSRF();
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // ===== ЗАВЕРШЕНИЕ ЗАДАНИЯ (МЕЙКЕР) =====
    if (isset($input['action']) && $input['action'] === 'complete') {
        $id = $input['id'] ?? null;
        
        writeLog("🛠️ COMPLETE: запрос на завершение задания ID $id");
        
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Не указан ID заявки']);
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
            
            if ($order['maker_completed'] == 1) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'error' => 'Задание уже завершено']);
                exit;
            }
            
            $currentStatus = $order['status'] ?? 'shipped';
            $newStatus = $currentStatus;
            
            if ($currentStatus === 'preorder') {
                $newStatus = 'shipped';
                writeLog("🛠️ COMPLETE: Статус предзаказ → отгружена");
            }
            
            $stmt = $pdo->prepare("
                UPDATE orders SET 
                    maker_completed = 1,
                    maker_completed_at = NOW(),
                    status = ?
                WHERE id = ?
            ");
            $stmt->execute([$newStatus, $id]);
            
            writeLog("🛠️ COMPLETE: Задание ID $id завершено, статус: $newStatus");
            
            $pdo->commit();
            
            echo json_encode([
                'success' => true,
                'message' => 'Задание завершено' . ($currentStatus === 'preorder' ? ', статус изменён на "Отгружена"' : ''),
                'status' => $newStatus
            ]);
            
        } catch(PDOException $e) {
            $pdo->rollBack();
            writeLog("❌ COMPLETE: Ошибка: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Ошибка завершения: ' . $e->getMessage()]);
        }
        exit;
    }
    
    // ===== ОБНОВЛЕНИЕ ЗАЯВКИ =====
    if (isset($input['action']) && $input['action'] === 'update') {
        $id = $input['id'] ?? null;
        $order_number = $input['order_number'] ?? null;
        $client_name = $input['client_name'] ?? '';
        $phone = $input['phone'] ?? '';
        $address = $input['address'] ?? '';
        $total = $input['total'] ?? 0;
        $delivery_cost = $input['delivery_cost'] ?? 0;
        $card_fee = $input['card_fee'] ?? 0;
        $loading_cost = $input['loading_cost'] ?? 0;
        $items = $input['items'] ?? '';
        $delivery_needed = $input['delivery_needed'] ?? 0;
        $card_payment = $input['card_payment'] ?? 0;
        $cart_items = $input['cart_items'] ?? [];
        $old_items = $input['old_items'] ?? [];
        $status = $input['status'] ?? 'shipped';
        
        writeLog("📝 UPDATE: Заявка $order_number (ID $id), статус: $status, loading_cost: $loading_cost");
        
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
            
            $oldStatus = $order['status'] ?? 'shipped';
            writeLog("📝 Старый статус: $oldStatus, Новый статус: $status");
            
            if ($oldStatus === 'cancelled') {
                $pdo->rollBack();
                echo json_encode([
                    'success' => false, 
                    'error' => 'Заявка со статусом "Отменена" не редактируется',
                    'status' => 'cancelled_locked'
                ]);
                exit;
            }
            
            $shouldReturn = false;
            $shouldWriteOff = false;
            
            if ($status === 'unpaid' && $oldStatus !== 'unpaid') {
                $shouldReturn = true;
                writeLog("↩️ Переход в не оплачена: возврат товара");
            }
            
            if ($oldStatus === 'unpaid' && $status !== 'unpaid') {
                $shouldWriteOff = true;
                writeLog("✅ Выход из не оплачена: списание товара");
            }
            
            if ($status === 'preorder' && $oldStatus !== 'preorder') {
                $shouldWriteOff = true;
                writeLog("📦 Предзаказ: списание товара (в минус при необходимости)");
            }
            
            if ($oldStatus === 'preorder' && $status === 'unpaid') {
                $shouldReturn = true;
                writeLog("↩️ Предзаказ → не оплачена: возврат товара");
            }
            
            if ($oldStatus === 'preorder' && $status === 'shipped') {
                writeLog("📦 Предзаказ → отгружена: остатки не меняются");
            }
            
            if ($oldStatus === 'shipped' && $status === 'preorder') {
                writeLog("✅ Отгружена → предзаказ: остатки не меняются");
            }
            
            // ===== ВОЗВРАТ ТОВАРА НА СКЛАД =====
            if ($shouldReturn) {
                if (!empty($old_items) && is_array($old_items)) {
                    foreach ($old_items as $product_id => $qty) {
                        $qty = intval($qty);
                        if ($qty > 0) {
                            $isBuilding = $product_id >= 10000;
                            $realId = $isBuilding ? $product_id - 10000 : $product_id;
                            
                            if ($isBuilding) {
                                $stmt = $pdo->prepare("SELECT name FROM building_products WHERE id = ?");
                                $stmt->execute([$realId]);
                                $product = $stmt->fetch(PDO::FETCH_ASSOC);
                                $productName = $product ? $product['name'] : 'Стройматериал ID ' . $realId;
                                
                                $stmt = $pdo->prepare("SELECT stock_available FROM building_stocks WHERE product_id = ? FOR UPDATE");
                                $stmt->execute([$realId]);
                                $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                                if ($stock) {
                                    $new_stock = $stock['stock_available'] + $qty;
                                    $stmt = $pdo->prepare("UPDATE building_stocks SET stock_available = ? WHERE product_id = ?");
                                    $stmt->execute([$new_stock, $realId]);
                                    writeLog("↩️ Возврат стройматериала '$productName' ID $realId +$qty, стало $new_stock");
                                }
                            } else {
                                $stmt = $pdo->prepare("SELECT product_name FROM stocks WHERE product_id = ?");
                                $stmt->execute([$product_id]);
                                $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                                $productName = $stock ? $stock['product_name'] : 'Товар ID ' . $product_id;
                                
                                $stmt = $pdo->prepare("SELECT stock_available FROM stocks WHERE product_id = ? FOR UPDATE");
                                $stmt->execute([$product_id]);
                                $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                                if ($stock) {
                                    $new_stock = $stock['stock_available'] + $qty;
                                    $stmt = $pdo->prepare("UPDATE stocks SET stock_available = ? WHERE product_id = ?");
                                    $stmt->execute([$new_stock, $product_id]);
                                    writeLog("↩️ Возврат пиломатериала '$productName' ID $product_id +$qty, стало $new_stock");
                                }
                            }
                        }
                    }
                }
            }
            
            // ===== СПИСАНИЕ ТОВАРА СО СКЛАДА =====
            if ($shouldWriteOff) {
                if (!empty($cart_items) && is_array($cart_items)) {
                    foreach ($cart_items as $product_id => $qty) {
                        $qty = intval($qty);
                        if ($qty > 0) {
                            $isBuilding = $product_id >= 10000;
                            $realId = $isBuilding ? $product_id - 10000 : $product_id;
                            
                            if ($isBuilding) {
                                $stmt = $pdo->prepare("SELECT name FROM building_products WHERE id = ?");
                                $stmt->execute([$realId]);
                                $product = $stmt->fetch(PDO::FETCH_ASSOC);
                                $productName = $product ? $product['name'] : 'Стройматериал ID ' . $realId;
                                
                                $stmt = $pdo->prepare("SELECT stock_available FROM building_stocks WHERE product_id = ? FOR UPDATE");
                                $stmt->execute([$realId]);
                                $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                                if ($stock) {
                                    $new_stock = $stock['stock_available'] - $qty;
                                    $stmt = $pdo->prepare("UPDATE building_stocks SET stock_available = ? WHERE product_id = ?");
                                    $stmt->execute([$new_stock, $realId]);
                                    writeLog("✅ Списание стройматериала '$productName' ID $realId -$qty, было {$stock['stock_available']}, стало $new_stock");
                                } else {
                                    $stmt = $pdo->prepare("INSERT INTO building_stocks (product_id, stock_available) VALUES (?, ?)");
                                    $stmt->execute([$realId, -$qty]);
                                    writeLog("📦 Создан новый стройматериал '$productName' ID $realId с остатком -$qty");
                                }
                            } else {
                                $stmt = $pdo->prepare("SELECT product_name FROM stocks WHERE product_id = ?");
                                $stmt->execute([$product_id]);
                                $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                                $productName = $stock ? $stock['product_name'] : 'Товар ID ' . $product_id;
                                
                                $stmt = $pdo->prepare("SELECT stock_available FROM stocks WHERE product_id = ? FOR UPDATE");
                                $stmt->execute([$product_id]);
                                $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                                if ($stock) {
                                    $new_stock = $stock['stock_available'] - $qty;
                                    $stmt = $pdo->prepare("UPDATE stocks SET stock_available = ? WHERE product_id = ?");
                                    $stmt->execute([$new_stock, $product_id]);
                                    writeLog("✅ Списание пиломатериала '$productName' ID $product_id -$qty, было {$stock['stock_available']}, стало $new_stock");
                                } else {
                                    $stmt = $pdo->prepare("INSERT INTO stocks (product_id, product_name, stock_available) VALUES (?, ?, ?)");
                                    $stmt->execute([$product_id, $productName, -$qty]);
                                    writeLog("📦 Создан новый пиломатериал '$productName' ID $product_id с остатком -$qty");
                                }
                            }
                        }
                    }
                }
            }
            
            // ⭐ ПЕРЕСЧИТЫВАЕМ services_sum
            $servicesSum = 0;
            if (!empty($items)) {
                $itemsArray = explode(', ', $items);
                foreach ($itemsArray as $item) {
                    if (strpos($item, 'Услуга:') !== false) {
                        preg_match('/- (\d+) ₽/', $item, $priceMatch);
                        if ($priceMatch) {
                            $servicesSum += intval($priceMatch[1]);
                        }
                    }
                }
            }
            $servicesSum += intval($loading_cost);
            
            $stmt = $pdo->prepare("
                UPDATE orders SET 
                    client_name = ?,
                    phone = ?,
                    address = ?,
                    total = ?,
                    delivery_cost = ?,
                    card_fee = ?,
                    loading_cost = ?,
                    services_sum = ?,
                    items = ?,
                    delivery_needed = ?,
                    card_payment = ?,
                    status = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $client_name,
                $phone,
                $address,
                $total,
                $delivery_cost,
                $card_fee,
                $loading_cost,
                $servicesSum,
                $items,
                $delivery_needed,
                $card_payment,
                $status,
                $id
            ]);
            
            $pdo->commit();
            writeLog("✅ UPDATE: Заявка $order_number обновлена, статус: $status, services_sum: $servicesSum");
            
            echo json_encode([
                'success' => true,
                'message' => 'Заявка обновлена, остатки пересчитаны',
                'status' => $status
            ]);
            
        } catch(PDOException $e) {
            $pdo->rollBack();
            writeLog("❌ UPDATE: Ошибка: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Ошибка обновления: ' . $e->getMessage()]);
        }
        exit;
    }
    
    // ===== СОЗДАНИЕ НОВОЙ ЗАЯВКИ =====
    $order_number = $input['order_number'] ?? null;
    $client_name = $input['client_name'] ?? '';
    $phone = $input['phone'] ?? '';
    $address = $input['address'] ?? '';
    $total = $input['total'] ?? 0;
    $delivery_cost = $input['delivery_cost'] ?? 0;
    $card_fee = $input['card_fee'] ?? 0;
    $loading_cost = $input['loading_cost'] ?? 0;
    $items = $input['items'] ?? '';
    $delivery_needed = $input['delivery_needed'] ?? 0;
    $card_payment = $input['card_payment'] ?? 0;
    $cart_items = $input['cart_items'] ?? [];
    $is_preorder = $input['is_preorder'] ?? false;
    
    $status = $input['status'] ?? null;
    if ($status === null) {
        $status = $is_preorder ? 'preorder' : 'shipped';
    }
    
    writeLog("📝 POST: Новая заявка: $order_number, статус: $status, is_preorder: " . ($is_preorder ? 'true' : 'false'));
    writeLog("📝 POST: cart_items: " . json_encode($cart_items));
    
    if (!$order_number) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Не указан номер заявки']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        
        // ⭐ СЧИТАЕМ services_sum
        $servicesSum = 0;
        if (!empty($items)) {
            $itemsArray = explode(', ', $items);
            foreach ($itemsArray as $item) {
                if (strpos($item, 'Услуга:') !== false) {
                    preg_match('/- (\d+) ₽/', $item, $priceMatch);
                    if ($priceMatch) {
                        $servicesSum += intval($priceMatch[1]);
                    }
                }
            }
        }
        $servicesSum += intval($loading_cost);
        
        $stmt = $pdo->prepare("
            INSERT INTO orders (
                order_number, 
                client_name, 
                phone, 
                address, 
                total, 
                delivery_cost, 
                card_fee, 
                loading_cost,
                services_sum,
                items, 
                delivery_needed, 
                card_payment,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $order_number,
            $client_name,
            $phone,
            $address,
            $total,
            $delivery_cost,
            $card_fee,
            $loading_cost,
            $servicesSum,
            $items,
            $delivery_needed,
            $card_payment,
            $status
        ]);
        
        $order_id = $pdo->lastInsertId();
        writeLog("✅ POST: Заявка сохранена, ID: $order_id, статус: $status, services_sum: $servicesSum");
        
        // ===== СПИСАНИЕ ТОВАРА СО СКЛАДА ПРИ СОЗДАНИИ =====
        if ($status !== 'unpaid' && !empty($cart_items) && is_array($cart_items)) {
            foreach ($cart_items as $product_id => $qty) {
                $qty = intval($qty);
                if ($qty > 0) {
                    $isBuilding = $product_id >= 10000;
                    $realId = $isBuilding ? $product_id - 10000 : $product_id;
                    
                    if ($isBuilding) {
                        $stmt = $pdo->prepare("SELECT name FROM building_products WHERE id = ?");
                        $stmt->execute([$realId]);
                        $product = $stmt->fetch(PDO::FETCH_ASSOC);
                        $productName = $product ? $product['name'] : 'Стройматериал ID ' . $realId;
                        
                        $stmt = $pdo->prepare("SELECT stock_available FROM building_stocks WHERE product_id = ? FOR UPDATE");
                        $stmt->execute([$realId]);
                        $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                        if ($stock) {
                            $new_stock = $stock['stock_available'] - $qty;
                            $stmt = $pdo->prepare("UPDATE building_stocks SET stock_available = ? WHERE product_id = ?");
                            $stmt->execute([$new_stock, $realId]);
                            writeLog("✅ POST: Списание стройматериала '$productName' ID $realId -$qty, было {$stock['stock_available']}, стало $new_stock");
                        } else {
                            $stmt = $pdo->prepare("INSERT INTO building_stocks (product_id, stock_available) VALUES (?, ?)");
                            $stmt->execute([$realId, -$qty]);
                            writeLog("📦 Создан новый стройматериал '$productName' ID $realId с остатком -$qty");
                        }
                    } else {
                        $stmt = $pdo->prepare("SELECT product_name FROM stocks WHERE product_id = ?");
                        $stmt->execute([$product_id]);
                        $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                        $productName = $stock ? $stock['product_name'] : 'Товар ID ' . $product_id;
                        
                        $stmt = $pdo->prepare("SELECT stock_available FROM stocks WHERE product_id = ? FOR UPDATE");
                        $stmt->execute([$product_id]);
                        $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                        if ($stock) {
                            $new_stock = $stock['stock_available'] - $qty;
                            $stmt = $pdo->prepare("UPDATE stocks SET stock_available = ? WHERE product_id = ?");
                            $stmt->execute([$new_stock, $product_id]);
                            writeLog("✅ POST: Списание пиломатериала '$productName' ID $product_id -$qty, было {$stock['stock_available']}, стало $new_stock");
                        } else {
                            $stmt = $pdo->prepare("INSERT INTO stocks (product_id, product_name, stock_available) VALUES (?, ?, ?)");
                            $stmt->execute([$product_id, $productName, -$qty]);
                            writeLog("📦 Создан новый пиломатериал '$productName' ID $product_id с остатком -$qty");
                        }
                    }
                }
            }
        } else if ($status === 'unpaid') {
            writeLog("📝 POST: Заявка 'Не оплачена' — остатки НЕ списываются (резерв)");
        }
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'id' => $order_id,
            'order_number' => $order_number,
            'status' => $status,
            'services_sum' => $servicesSum,
            'message' => 'Заявка сохранена' . ($status === 'unpaid' ? ' (товар зарезервирован, остатки не тронуты)' : ', остатки обновлены')
        ]);
        
    } catch(PDOException $e) {
        $pdo->rollBack();
        writeLog("❌ POST: Ошибка сохранения: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Ошибка сохранения: ' . $e->getMessage()]);
    }
    exit;
}

// ========== DELETE - удаление заявки ==========
if ($method === 'DELETE') {
    requireAuthWithCSRF();
    
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? null;
    $order_number = $input['order_number'] ?? null;
    
    writeLog("🗑️ DELETE: запрос, id=$id, order_number=$order_number");
    
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
        
        $orderStatus = $order['status'] ?? 'shipped';
        if ($orderStatus !== 'unpaid') {
            $itemsString = $order['items'] ?? '';
            if ($itemsString) {
                $items = array_map('trim', explode(',', $itemsString));
                foreach ($items as $item) {
                    if (preg_match('/^(.+?)\s*[-–]\s*(\d+)\s*шт/', $item, $match)) {
                        $product_name = trim($match[1]);
                        $qty = intval($match[2]);
                        
                        if ($qty > 0) {
                            // Пытаемся найти в stocks (пиломатериалы)
                            $stmt = $pdo->prepare("SELECT product_id, stock_available FROM stocks WHERE product_name = ? FOR UPDATE");
                            $stmt->execute([$product_name]);
                            $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                            
                            if ($stock) {
                                $new_stock = $stock['stock_available'] + $qty;
                                $stmt = $pdo->prepare("UPDATE stocks SET stock_available = ? WHERE product_id = ?");
                                $stmt->execute([$new_stock, $stock['product_id']]);
                                writeLog("↩️ Возврат пиломатериала: $product_name (ID {$stock['product_id']}) +$qty");
                            } else {
                                // Пробуем найти в building_products (стройматериалы)
                                $stmt = $pdo->prepare("SELECT id FROM building_products WHERE name = ?");
                                $stmt->execute([$product_name]);
                                $building = $stmt->fetch(PDO::FETCH_ASSOC);
                                if ($building) {
                                    $stmt = $pdo->prepare("SELECT stock_available FROM building_stocks WHERE product_id = ? FOR UPDATE");
                                    $stmt->execute([$building['id']]);
                                    $stock = $stmt->fetch(PDO::FETCH_ASSOC);
                                    if ($stock) {
                                        $new_stock = $stock['stock_available'] + $qty;
                                        $stmt = $pdo->prepare("UPDATE building_stocks SET stock_available = ? WHERE product_id = ?");
                                        $stmt->execute([$new_stock, $building['id']]);
                                        writeLog("↩️ Возврат стройматериала: $product_name (ID {$building['id']}) +$qty");
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        $stmt = $pdo->prepare("DELETE FROM orders WHERE id = ?");
        $stmt->execute([$id]);
        writeLog("🗑️ DELETE: Заявка удалена");
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true, 
            'message' => 'Заявка удалена, остатки возвращены'
        ]);
        
    } catch(PDOException $e) {
        $pdo->rollBack();
        writeLog("❌ DELETE: Ошибка удаления: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Ошибка удаления: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Метод не поддерживается']);
?>