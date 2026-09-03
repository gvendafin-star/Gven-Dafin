<?php
// api/invoice.php - с CSRF-защитой

require_once __DIR__ . '/security.php';

// Инициализируем сессию через security.php
initSecureSession();

// Проверка авторизации через security.php
if (!isAuthorized()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Не авторизован']);
    exit;
}

require_once __DIR__ . '/../includes/db.php';

$method = $_SERVER['REQUEST_METHOD'];

// GET - получение следующего свободного номера накладной
if ($method === 'GET') {
    try {
        $pdo->beginTransaction();
        
        // Получаем текущий счётчик (блокируем строку)
        $stmt = $pdo->query("SELECT prefix, counter FROM invoice_counter LIMIT 1 FOR UPDATE");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$row) {
            // Если счётчика нет — создаём
            $stmt = $pdo->prepare("INSERT INTO invoice_counter (prefix, counter) VALUES ('A', 0)");
            $stmt->execute();
            $counter = 0;
            $prefix = 'A';
        } else {
            $counter = $row['counter'];
            $prefix = $row['prefix'];
        }
        
        // Ищем САМЫЙ МАЛЕНЬКИЙ СВОБОДНЫЙ номер
        $found = false;
        $attempts = 0;
        $maxAttempts = 10000;
        $searchStart = 0;
        
        while (!$found && $attempts < $maxAttempts) {
            $attempts++;
            $searchStart++;
            $invoiceNumber = $prefix . '-' . str_pad($searchStart, 3, '0', STR_PAD_LEFT);
            
            // Проверяем, существует ли уже такой номер
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE order_number = ?");
            $stmt->execute([$invoiceNumber]);
            $count = $stmt->fetchColumn();
            
            if ($count == 0) {
                $found = true;
                // Обновляем счётчик на найденный номер
                $stmt = $pdo->prepare("UPDATE invoice_counter SET counter = ?");
                $stmt->execute([$searchStart]);
                
                error_log("✅ Выдан номер: $invoiceNumber (счётчик обновлён на $searchStart)");
            }
        }
        
        if (!$found) {
            throw new Exception('Не удалось найти свободный номер после ' . $maxAttempts . ' попыток');
        }
        
        $pdo->commit();
        
        echo json_encode(['success' => true, 'invoice_number' => $invoiceNumber]);
        
    } catch(PDOException $e) {
        $pdo->rollBack();
        error_log("❌ Ошибка получения номера: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Ошибка получения номера: ' . $e->getMessage()]);
    } catch(Exception $e) {
        $pdo->rollBack();
        error_log("❌ Ошибка: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// POST - сброс счётчика (для администратора)
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    
    if ($action === 'reset') {
        try {
            // При сбросе счётчика нужно проверить, какие номера уже заняты
            $stmt = $pdo->query("SELECT MAX(CAST(SUBSTRING(order_number, 3) AS UNSIGNED)) as max_num FROM orders WHERE order_number LIKE 'A-%'");
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $maxNum = $result['max_num'] ?? 0;
            
            $stmt = $pdo->prepare("UPDATE invoice_counter SET counter = ?");
            $stmt->execute([$maxNum]);
            
            echo json_encode(['success' => true, 'message' => 'Счётчик сброшен до ' . $maxNum]);
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

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Метод не поддерживается']);
?>