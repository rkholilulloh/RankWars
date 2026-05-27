<?php
/**
 * ==========================================================================
 * BORDER RANK WARS SIMULATOR - MULTIPLAYER BROKER (PHP SSE EDITION)
 * ==========================================================================
 */

error_reporting(0);
ini_set('display_errors', 0);
date_default_timezone_set('UTC');

// Dynamic base directory for active multiplayer rooms
$base_dir = __DIR__ . '/rooms';
if (!is_dir($base_dir)) {
    mkdir($base_dir, 0777, true);
}

// Global garbage collector: delete rooms that haven't been modified in 10 minutes
clean_expired_rooms($base_dir);

$action = isset($_GET['action']) ? $_GET['action'] : '';

// 1. DYNAMIC IPv4 DISCOVERY FOR LAN MATCHES
if ($action === 'get_ip') {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    
    $ips = [];
    $host = gethostname();
    $addrs = gethostbynamel($host);
    if ($addrs) {
        foreach ($addrs as $addr) {
            // Focus on common LAN class ranges: 192.168.*, 10.*, 172.*
            if (strpos($addr, '192.168.') === 0 || strpos($addr, '10.') === 0 || strpos($addr, '172.') === 0) {
                $ips[] = $addr;
            }
        }
    }
    // Fallback to loopback or whatever was returned
    if (empty($ips)) {
        $ips = $addrs ? $addrs : ['127.0.0.1'];
    }
    
    echo json_encode(['ips' => $ips]);
    exit;
}

// 2. ROOM CREATION
if ($action === 'create_room') {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    
    $roomId = 'ROOM-' . rand(1000, 9999);
    $room_path = $base_dir . '/' . $roomId;
    
    if (!is_dir($room_path)) {
        mkdir($room_path, 0777, true);
    }
    
    // Default room configuration parameters
    $config = [
        'id' => $roomId,
        'map' => 'training_small',
        'difficulty' => 'medium',
        'trionBoost' => 20, // multiplied by 10 (2.0 boost)
        'hpBoost' => 1.0,
        'status' => 'lobby', // lobby, playing, finished
        'created_at' => time()
    ];
    
    file_put_contents($room_path . '/config.json', json_encode($config));
    
    echo json_encode(['roomId' => $roomId, 'config' => $config]);
    exit;
}

// 3. JOINING A ROOM
if ($action === 'join_room') {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    
    $roomId = isset($_GET['room']) ? preg_replace('/[^A-Za-z0-9\-]/', '', $_GET['room']) : '';
    $playerId = isset($_GET['player']) ? preg_replace('/[^A-Za-z0-9\_]/', '', $_GET['player']) : '';
    
    if (empty($roomId) || empty($playerId)) {
        echo json_encode(['error' => 'Missing parameter details']);
        exit;
    }
    
    $room_path = $base_dir . '/' . $roomId;
    if (!is_dir($room_path)) {
        echo json_encode(['error' => 'Room code not found or expired']);
        exit;
    }
    
    $post_data = json_decode(file_get_contents('php://input'), true);
    if (!$post_data) {
        $post_data = [];
    }
    
    $player_state = [
        'id' => $playerId,
        'name' => isset($post_data['name']) ? $post_data['name'] : 'Unknown Ranger',
        'preset' => isset($post_data['preset']) ? $post_data['preset'] : 'custom',
        'briefcase' => isset($post_data['briefcase']) ? $post_data['briefcase'] : ['main' => [], 'sub' => []],
        'isHost' => isset($post_data['isHost']) ? (bool)$post_data['isHost'] : false,
        'isReady' => isset($post_data['isHost']) ? (bool)$post_data['isHost'] : false, // Host ready by default
        'x' => 100,
        'y' => 100,
        'vx' => 0,
        'vy' => 0,
        'angle' => 0,
        'bodyHp' => 1000,
        'trion' => 1000,
        'bailedOut' => false,
        'isBagwormActive' => false,
        'isChameleonActive' => false,
        'lastUpdate' => microtime(true)
    ];
    
    file_put_contents($room_path . '/player_' . $playerId . '.json', json_encode($player_state));
    
    echo json_encode(['success' => true, 'player' => $player_state]);
    exit;
}

// 4. PLAYER COORDINATES & STATE REAL-TIME BROADCASTS (POST ACTION)
if ($action === 'update') {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    
    $roomId = isset($_GET['room']) ? preg_replace('/[^A-Za-z0-9\-]/', '', $_GET['room']) : '';
    $playerId = isset($_GET['player']) ? preg_replace('/[^A-Za-z0-9\_]/', '', $_GET['player']) : '';
    
    if (empty($roomId) || empty($playerId)) {
        echo json_encode(['error' => 'Missing parameter details']);
        exit;
    }
    
    $room_path = $base_dir . '/' . $roomId;
    if (!is_dir($room_path)) {
        echo json_encode(['error' => 'Room expired']);
        exit;
    }
    
    $post_data = json_decode(file_get_contents('php://input'), true);
    if ($post_data) {
        $file_name = $room_path . '/player_' . $playerId . '.json';
        
        // Merge existing presets and static loadouts if present, only updating dynamic vectors
        if (file_exists($file_name)) {
            $existing = json_decode(file_get_contents($file_name), true);
            if ($existing) {
                $post_data = array_merge($existing, $post_data);
            }
        }
        
        $post_data['lastUpdate'] = microtime(true);
        file_put_contents($file_name, json_encode($post_data));
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'No state data supplied']);
    }
    exit;
}

// 5. LOCK-FREE ACTION EVENTS BROADCAST (POST ACTION)
if ($action === 'event') {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    
    $roomId = isset($_GET['room']) ? preg_replace('/[^A-Za-z0-9\-]/', '', $_GET['room']) : '';
    
    if (empty($roomId)) {
        echo json_encode(['error' => 'Missing room ID']);
        exit;
    }
    
    $room_path = $base_dir . '/' . $roomId;
    if (!is_dir($room_path)) {
        echo json_encode(['error' => 'Room expired']);
        exit;
    }
    
    $post_data = json_decode(file_get_contents('php://input'), true);
    if ($post_data) {
        // Generate a fast random code to prevent conflicts
        $evt_id = microtime(true) . '_' . rand(1000, 9999);
        $evt_file = $room_path . '/evt_' . $evt_id . '.json';
        
        file_put_contents($evt_file, json_encode($post_data));
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'No event content supplied']);
    }
    exit;
}

// 6. REAL-TIME SERVER-SENT EVENTS (SSE) PERSISTENT DOWNSTREAM
if ($action === 'stream') {
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('Access-Control-Allow-Origin: *');
    
    // Prevent PHP script timeout
    set_time_limit(0);
    
    $roomId = isset($_GET['room']) ? preg_replace('/[^A-Za-z0-9\-]/', '', $_GET['room']) : '';
    $playerId = isset($_GET['player']) ? preg_replace('/[^A-Za-z0-9\_]/', '', $_GET['player']) : '';
    
    if (empty($roomId)) {
        echo "data: " . json_encode(['error' => 'Missing room ID']) . "\n\n";
        ob_flush();
        flush();
        exit;
    }
    
    $room_path = $base_dir . '/' . $roomId;
    if (!is_dir($room_path)) {
        echo "data: " . json_encode(['error' => 'Room code not found']) . "\n\n";
        ob_flush();
        flush();
        exit;
    }
    
    // Establish client connection checks
    $last_hash = '';
    $heartbeat_time = time();
    
    // Stream loop
    while (true) {
        // Prevent buffer locking
        if (connection_aborted()) {
            // Clean up player file on disconnect
            if (!empty($playerId) && file_exists($room_path . '/player_' . $playerId . '.json')) {
                @unlink($room_path . '/player_' . $playerId . '.json');
            }
            exit;
        }
        
        clearstatcache();
        
        if (!is_dir($room_path)) {
            echo "data: " . json_encode(['event' => 'room_closed']) . "\n\n";
            ob_flush();
            flush();
            exit;
        }
        
        // 1. Gather all players
        $players = [];
        $player_files = glob($room_path . '/player_*.json');
        
        // Auto-bailout/cleanup players who stopped broadcasting for more than 7 seconds
        $now = microtime(true);
        foreach ($player_files as $file) {
            $data = json_decode(file_get_contents($file), true);
            if ($data) {
                if ($now - $data['lastUpdate'] > 7.0) {
                    @unlink($file);
                } else {
                    $players[] = $data;
                }
            }
        }
        
        // 2. Gather lock-free events queue
        $events = [];
        $event_files = glob($room_path . '/evt_*.json');
        foreach ($event_files as $file) {
            $evt = json_decode(file_get_contents($file), true);
            if ($evt) {
                $events[] = $evt;
            }
            @unlink($file); // Consume/delete event instantly so it fires only once per player
        }
        
        // 3. Gather room configuration
        $config_file = $room_path . '/config.json';
        $config = file_exists($config_file) ? json_decode(file_get_contents($config_file), true) : [];
        
        // Build response
        $response = [
            'players' => $players,
            'events' => $events,
            'config' => $config
        ];
        
        $json_response = json_encode($response);
        $current_hash = md5($json_response);
        
        // Only flush if data has changed or if we have events, or to send a heartbeat every 5s
        if ($current_hash !== $last_hash || !empty($events) || (time() - $heartbeat_time >= 5)) {
            echo "data: " . $json_response . "\n\n";
            ob_flush();
            flush();
            
            $last_hash = $current_hash;
            $heartbeat_time = time();
        }
        
        // 40ms sleep (~25 updates/sec, optimal real-time rendering)
        usleep(40000);
    }
    exit;
}

// 7. INACTIVE ROOM CLEANER UTILITY
function clean_expired_rooms($base_dir) {
    $now = time();
    $rooms = glob($base_dir . '/*', GLOB_ONLYDIR);
    foreach ($rooms as $room) {
        $config_file = $room . '/config.json';
        if (file_exists($config_file)) {
            $mtime = filemtime($config_file);
            // Delete room directory if inactive for more than 10 minutes
            if ($now - $mtime > 600) {
                delete_directory_recursive($room);
            }
        } else {
            // Delete directory immediately if config is missing
            delete_directory_recursive($room);
        }
    }
}

function delete_directory_recursive($dir) {
    if (!is_dir($dir)) return;
    $files = array_diff(scandir($dir), ['.', '..']);
    foreach ($files as $file) {
        $path = $dir . '/' . $file;
        if (is_dir($path)) {
            delete_directory_recursive($path);
        } else {
            @unlink($path);
        }
    }
    @rmdir($dir);
}
?>
