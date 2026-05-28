/**
 * ==========================================================================
 * BORDER RANK WARS SIMULATOR - MULTIPLAYER CLIENT ENGINE (PHP SSE)
 * ==========================================================================
 */

// 1. REMOTE PLAYER CLASS REPRESENTATION
class RemotePlayer {
    constructor(id, name, preset) {
        this.id = id;
        this.name = name;
        this.preset = preset;

        // Physical coordinates
        this.x = 100;
        this.y = 100;
        this.vx = 0;
        this.vy = 0;
        this.radius = 18;
        this.angle = 0;

        // Dynamic target coordinates for smooth interpolation
        this.targetX = 100;
        this.targetY = 100;
        this.targetAngle = 0;

        // Health/Trion body properties
        this.bodyHpMax = 1000;
        this.bodyHp = 1000;
        this.trionMax = 1000;
        this.trion = 1000;

        // Visual status flags
        this.isBagwormActive = false;
        this.isChameleonActive = false;
        this.isShieldActive = false;
        this.isLeftMouseDown = false;
        this.isRightMouseDown = false;
        this.shieldAngle = 90;

        // Briefcase trigger configurations
        this.briefcase = {
            main: ["Empty", "Empty", "Empty", "Empty"],
            sub: ["Empty", "Empty", "Empty", "Empty"]
        };
        this.activeMainIndex = 0;
        this.activeSubIndex = 0;

        // Movement debuffs (Lead Bullet weights)
        this.isWeighted = false;
        this.weightStacks = 0;
        this.bailedOut = false;
    }

    // Updates remote player states via Linear Interpolation (Lerp)
    update(arena, allAgents, bullets, grPads, addLog) {
        if (this.bailedOut) return;

        // Interpolate position at ~25% step rate (gives silky smooth renders)
        this.x += (this.targetX - this.x) * 0.25;
        this.y += (this.targetY - this.y) * 0.25;

        // Smooth angle rotation Lerp to prevent instant snapping
        let diff = this.targetAngle - this.angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.angle += diff * 0.25;
    }

    // Renders the remote player identically to normal players
    draw(ctx) {
        if (this.bailedOut) return;

        // Steer radar visibility: Bagworm conceals if outside visual proximity
        if (this.isBagwormActive) {
            const localPlayer = window.player || (window.allAgents && window.allAgents.find(a => a.id === 'player'));
            if (localPlayer) {
                const dist = Math.sqrt((localPlayer.x - this.x) ** 2 + (localPlayer.y - this.y) ** 2);
                if (dist > 450) {
                    // Hide completely on this client's screen if Bagworm stealth applies
                    return;
                }
            }
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Chameleon transparency rendering
        ctx.globalAlpha = this.isChameleonActive ? 0.08 : 1.0;

        // Dedicated glowing magenta border for remote player avatars to clearly tell them apart
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#bd00ff';
        ctx.fillStyle = '#141e24';
        ctx.strokeStyle = '#bd00ff';
        ctx.lineWidth = 3.5;

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Chibi avatar renderer
        if (window.agentImages && window.agentImages[this.preset]) {
            const img = window.agentImages[this.preset];
            if (img.complete) {
                ctx.save();
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.beginPath();
                ctx.arc(0, 0, this.radius - 2.5, 0, Math.PI * 2);
                ctx.clip();
                ctx.rotate(-this.angle); // Upright face rotation lock
                ctx.drawImage(img, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
                ctx.restore();
            }
        }

        // Magenta direction nose arrow
        ctx.fillStyle = '#bd00ff';
        ctx.beginPath();
        ctx.moveTo(this.radius, -5);
        ctx.lineTo(this.radius + 8, 0);
        ctx.lineTo(this.radius, 5);
        ctx.closePath();
        ctx.fill();

        // Shield blocking arc renders
        const hasShieldMain = this.briefcase.main[this.activeMainIndex] === 'Shield';
        const hasShieldSub = this.briefcase.sub[this.activeSubIndex] === 'Shield';
        const bothAreShield = hasShieldMain && hasShieldSub;

        let mainShieldActiveDraw = false;
        let subShieldActiveDraw = false;

        if (bothAreShield) {
            const eitherPressed = this.isLeftMouseDown || this.isRightMouseDown;
            mainShieldActiveDraw = !this.isChameleonActive && eitherPressed && this.trion > 0;
            subShieldActiveDraw = !this.isChameleonActive && eitherPressed && this.trion > 0;
        } else {
            mainShieldActiveDraw = !this.isChameleonActive && (hasShieldMain && this.isLeftMouseDown) && this.trion > 0;
            subShieldActiveDraw = !this.isChameleonActive && (hasShieldSub && this.isRightMouseDown) && this.trion > 0;
        }

        if (mainShieldActiveDraw || subShieldActiveDraw) {
            ctx.save();
            const isFull = mainShieldActiveDraw && subShieldActiveDraw;
            ctx.strokeStyle = 'rgba(57, 255, 20, 0.85)';
            ctx.lineWidth = 5;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#39ff14';

            const currentShieldAngle = isFull ? 360 : 90;
            const shieldRad = (currentShieldAngle * Math.PI) / 360;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8, -shieldRad, shieldRad);
            ctx.stroke();
            ctx.restore();
        }

        // Lead bullet weights rendering
        if (this.isWeighted) {
            ctx.save();
            ctx.fillStyle = '#121212';
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
            for (let i = 0; i < this.weightStacks; i++) {
                const hx = -12 + i * 7;
                const hy = 0;
                const size = 3.5;
                ctx.beginPath();
                for (let j = 0; j < 6; j++) {
                    const hAngle = (Math.PI / 3) * j;
                    ctx.lineTo(hx + size * Math.cos(hAngle), hy + size * Math.sin(hAngle));
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        }

        ctx.restore();

        // Health bars rendering
        if (!this.isChameleonActive) {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 9px monospace';
            ctx.textAlign = 'center';
            const trionVal = Math.max(0, Math.floor(this.trion));
            ctx.fillText(`${this.name.toUpperCase()} [${trionVal}/${this.trionMax}]`, this.x, this.y - 25);

            const barWidth = 40;
            const barHeight = 3;
            const barX = this.x - barWidth / 2;

            // Replicated HP bar (Purple)
            const barY1 = this.y - 38;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX, barY1, barWidth, barHeight);
            const hpFillWidth = Math.max(0, Math.min(1, this.bodyHp / this.bodyHpMax)) * barWidth;
            ctx.fillStyle = '#bd00ff';
            ctx.fillRect(barX, barY1, hpFillWidth, barHeight);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(barX, barY1, barWidth, barHeight);

            // Replicated Trion bar (Green)
            const barY2 = this.y - 33;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX, barY2, barWidth, barHeight);
            const trionFillWidth = Math.max(0, Math.min(1, this.trion / this.trionMax)) * barWidth;
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(barX, barY2, trionFillWidth, barHeight);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(barX, barY2, barWidth, barHeight);

            ctx.restore();
        }
    }
}

// 2. MULTIPLAYER MANAGER STATE SYSTEM
class MultiplayerManager {
    constructor() {
        this.roomId = '';
        this.playerId = 'player_' + Math.floor(Math.random() * 9000 + 1000);
        this.isHost = false;

        // Base broker script address (switches dynamically based on Host computer IP)
        this.serverUrl = './multiplayer.php';

        this.eventSource = null;

        // Active room occupants
        this.lobbyPlayers = [];
        this.localSpawnPoint = null;

        this.lastBroadcastTime = 0;
        this.broadcastRate = 40; // ms between coord sync uploads (~25 Hz)

        this.initializeUIListeners();
    }

    // A. LOBBY EVENT SWITCHERS
    initializeUIListeners() {
        const modeSoloBtn = document.getElementById('mode-solo-btn');
        const modeSquadBtn = document.getElementById('mode-squad-btn');
        const modeTrainingBtn = document.getElementById('mode-training-btn');
        const modeLanBtn = document.getElementById('mode-lan-btn');
        const soloParams = document.getElementById('solo-parameters');
        const squadParams = document.getElementById('squad-parameters');
        const trainingParams = document.getElementById('training-parameters');
        const lanParams = document.getElementById('lan-parameters');

        window.gameMode = 'solo';

        modeSoloBtn.addEventListener('click', () => {
            modeSoloBtn.classList.add('active');
            modeSquadBtn.classList.remove('active');
            if (modeTrainingBtn) modeTrainingBtn.classList.remove('active');
            modeLanBtn.classList.remove('active');
            soloParams.style.display = 'block';
            squadParams.style.display = 'none';
            if (trainingParams) trainingParams.style.display = 'none';
            lanParams.style.display = 'none';
            window.gameMode = 'solo';
            window.isMultiplayer = false;
            this.disconnect();
            this.logStatus("Switched to Solo Offline Practice.");
        });

        modeSquadBtn.addEventListener('click', () => {
            modeSquadBtn.classList.add('active');
            modeSoloBtn.classList.remove('active');
            if (modeTrainingBtn) modeTrainingBtn.classList.remove('active');
            modeLanBtn.classList.remove('active');
            soloParams.style.display = 'none';
            squadParams.style.display = 'block';
            if (trainingParams) trainingParams.style.display = 'none';
            lanParams.style.display = 'none';
            window.gameMode = 'squad';
            window.isMultiplayer = false;
            this.disconnect();
            this.logStatus("Switched to Border Squad Rank Wars HQ.");
            if (window.initializeSquadUI) {
                window.initializeSquadUI();
            }
        });

        if (modeTrainingBtn) {
            modeTrainingBtn.addEventListener('click', () => {
                modeTrainingBtn.classList.add('active');
                modeSoloBtn.classList.remove('active');
                modeSquadBtn.classList.remove('active');
                modeLanBtn.classList.remove('active');
                soloParams.style.display = 'none';
                squadParams.style.display = 'none';
                if (trainingParams) trainingParams.style.display = 'block';
                lanParams.style.display = 'none';
                window.gameMode = 'training';
                window.isMultiplayer = false;
                this.disconnect();
                this.logStatus("Switched to Virtual Training Simulator HQ.");
            });
        }

        modeLanBtn.addEventListener('click', () => {
            modeLanBtn.classList.add('active');
            modeSoloBtn.classList.remove('active');
            modeSquadBtn.classList.remove('active');
            if (modeTrainingBtn) modeTrainingBtn.classList.remove('active');
            soloParams.style.display = 'none';
            squadParams.style.display = 'none';
            if (trainingParams) trainingParams.style.display = 'none';
            lanParams.style.display = 'block';
            window.gameMode = 'lan';
            window.isMultiplayer = true;
            this.logStatus("Switched to LAN Multiplayer HQ.");
            this.fetchLocalIPs();
        });

        // Room Hosting click
        document.getElementById('lan-host-btn').addEventListener('click', () => {
            this.hostMatch();
        });

        // Room Joining click
        document.getElementById('lan-join-btn').addEventListener('click', () => {
            const ip = document.getElementById('lan-ip-input').value.trim();
            if (!ip) {
                alert("PLEASE ENTER A VALID HOST IP OR COMPUTER URL!");
                return;
            }
            this.joinMatch(ip);
        });

        // Ready Toggles click
        document.getElementById('lan-ready-btn').addEventListener('click', () => {
            this.toggleReady();
        });

        // Host match deployment click
        document.getElementById('lan-start-btn').addEventListener('click', () => {
            this.deployMatchFromHost();
        });
    }

    logStatus(text) {
        document.getElementById('lan-status-text').textContent = text;
    }

    // Dynamic network IP scans for the lobby host display
    fetchLocalIPs() {
        fetch('./multiplayer.php?action=get_ip')
            .then(res => res.json())
            .then(data => {
                if (data.ips && data.ips.length > 0) {
                    this.logStatus("Ready. Your host IP address is " + data.ips.join(" or ") + ". Use this to connect with friends!");
                }
            })
            .catch(err => {
                this.logStatus("Offline (XAMPP not detected). Please run inside XAMPP to stream.");
            });
    }

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.roomId = '';
        this.isHost = false;
        this.serverUrl = './multiplayer.php';
        document.getElementById('lan-lobby-room').style.display = 'none';
        document.querySelector('.lan-setup-modes').style.display = 'flex';
    }

    // B. MATCH HOSTING DISPATCH
    hostMatch() {
        this.disconnect();
        this.logStatus("Allocating tactical channel...");

        fetch('./multiplayer.php?action=create_room')
            .then(res => res.json())
            .then(data => {
                if (data.roomId) {
                    this.roomId = data.roomId;
                    this.isHost = true;
                    this.serverUrl = './multiplayer.php'; // Keep relative since we are host

                    this.logStatus("Tactical channel opened: " + this.roomId);
                    this.registerInRoom();
                } else {
                    this.logStatus("Error: Failed to open tactical channel.");
                }
            })
            .catch(err => {
                this.logStatus("Network Error: Make sure XAMPP Apache is running!");
            });
    }

    // C. MATCH JOINING DISPATCH
    joinMatch(ipAddress) {
        this.disconnect();

        // Clean URL configurations
        let formattedIp = ipAddress;
        if (!formattedIp.startsWith('http://') && !formattedIp.startsWith('https://')) {
            formattedIp = 'http://' + formattedIp;
        }
        // Append folder suffix if needed
        if (!formattedIp.endsWith('/')) {
            formattedIp += '/';
        }
        if (!formattedIp.includes('World%20Trigger') && !formattedIp.includes('World Trigger')) {
            formattedIp += 'World%20Trigger/';
        }

        this.serverUrl = formattedIp + 'multiplayer.php';
        this.logStatus("Scanning address: " + formattedIp);

        const roomCode = prompt("ENTER BORDER ROOM ID (e.g. ROOM-1234):");
        if (!roomCode) {
            this.logStatus("Scan aborted.");
            this.disconnect();
            return;
        }

        this.roomId = roomCode.toUpperCase().trim();
        this.isHost = false;

        this.registerInRoom();
    }

    // Joins room directory using a POST request
    registerInRoom() {
        const joinUrl = `${this.serverUrl}?action=join_room&room=${this.roomId}&player=${this.playerId}`;
        const activeAgent = window.getSelectedAgent ? window.getSelectedAgent() : 'yuma';
        const briefcase = window.getActiveBriefcase ? window.getActiveBriefcase() : { main: [], sub: [] };
        const agentName = window.agentPresets && window.agentPresets[activeAgent] ? window.agentPresets[activeAgent].name : 'Custom Agent';

        const body = {
            name: agentName,
            preset: activeAgent,
            briefcase: briefcase,
            isHost: this.isHost
        };

        fetch(joinUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStringifySafe(body)
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    this.logStatus("Joined channel. Opening EventSource stream...");
                    this.openEventStream();
                } else {
                    this.logStatus("Join failed: " + (data.error || "Unknown response"));
                    this.disconnect();
                }
            })
            .catch(err => {
                this.logStatus("Failed to join. Double check host IP address and Room ID.");
                this.disconnect();
            });
    }

    // D. HTML5 SERVER-SENT EVENTS DUAL PERSISTENT STREAM
    openEventStream() {
        const streamUrl = `${this.serverUrl}?action=stream&room=${this.roomId}&player=${this.playerId}`;

        this.eventSource = new EventSource(streamUrl);

        this.eventSource.onmessage = (e) => {
            const data = jsonParseSafe(e.data);
            if (!data) return;

            if (data.error) {
                this.logStatus("Stream error: " + data.error);
                this.disconnect();
                return;
            }

            this.handleStreamUpdate(data);
        };

        this.eventSource.onerror = (err) => {
            this.logStatus("Stream disconnected. Attempting to reconnect...");
        };

        // Render UI panels state
        document.querySelector('.lan-setup-modes').style.display = 'none';
        document.getElementById('lan-lobby-room').style.display = 'block';
        document.getElementById('lan-room-id').textContent = this.roomId;

        // Display dynamic local IP address when host
        if (this.isHost) {
            fetch('./multiplayer.php?action=get_ip')
                .then(res => res.json())
                .then(d => {
                    document.getElementById('lan-host-ip').textContent = d.ips && d.ips.length > 0 ? d.ips[0] : '127.0.0.1';
                });
            document.getElementById('lan-map-select').disabled = false;
        } else {
            // Clients are forced to use map set by host
            document.getElementById('lan-host-ip').textContent = "Remote Tunnel";
            document.getElementById('lan-map-select').disabled = true;
        }
    }

    // Synchronize client details in the lobby screen
    handleStreamUpdate(data) {
        this.lobbyPlayers = data.players || [];
        const config = data.config || {};

        // 1. If match transitioned to playing, start game simulation!
        if (config.status === 'playing' && !window.getMatchActive()) {
            this.logStatus("TACTICAL DEPLOYMENT INITIATED!");

            // Map configuration override from server config
            if (config.map) {
                const mapSelect = document.getElementById('map-select');
                if (mapSelect) {
                    mapSelect.value = config.map;
                }
            }

            // Spawn points initialization
            this.calculateSpawnCoordinates();

            // Trigger local start!
            window.isMultiplayer = true;
            window.setMatchActive(false); // Clear singleplayer locks
            if (window.startSimulation) {
                // Manually trigger startSimulation click action
                window.audio.init();
                window.audio.resume();

                // Directly bypass Singleplayer startSimulation calls
                document.getElementById('lobby-screen').classList.remove('active');
                document.getElementById('game-screen').classList.add('active');

                // Map setup
                const mapSelect = document.getElementById('map-select').value;
                let mapWidth = 3200;
                let mapHeight = 2900;
                let mapDisplayName = "Cyber Grid Map";
                let arenaType = 'cybergrid';
                if (mapSelect.includes('cityscape')) {
                    arenaType = mapSelect.includes('large') ? 'cityscape_large' : 'cityscape';
                    mapDisplayName = "Cityscape Map";
                } else if (mapSelect.includes('forest')) {
                    arenaType = 'forest_mountain';
                    mapDisplayName = "Forest & Mountain Map";
                } else if (mapSelect.includes('training')) {
                    arenaType = 'training_room';
                    mapDisplayName = "Border Training Grid";
                }

                if (mapSelect.includes('small')) {
                    mapWidth = 1200;
                    mapHeight = 1000;
                    mapDisplayName += " (Small)";
                } else if (mapSelect.includes('medium')) {
                    mapWidth = 2000;
                    mapHeight = 1800;
                    mapDisplayName += " (Medium)";
                }

                window.arena.init(arenaType, mapWidth, mapHeight);
                document.getElementById('hud-map-name').textContent = mapDisplayName;

                // Read Boosts
                window.trionBoostFactor = 2.0;
                window.hpBoostFactor = 1.0;

                // Instantiates Local Player object
                const activeAgent = window.getSelectedAgent();
                const presets = window.agentPresets[activeAgent];

                window.player = {
                    id: this.playerId, // SET player ID to unique peer socket ID!
                    name: presets.name,
                    x: this.localSpawnPoint.x,
                    y: this.localSpawnPoint.y,
                    vx: 0,
                    vy: 0,
                    radius: 18,
                    angle: 0,
                    speed: presets.speed,
                    trionMax: presets.trion * 100 * window.trionBoostFactor,
                    trion: presets.trion * 100 * window.trionBoostFactor,
                    bodyHpMax: 1000 * window.hpBoostFactor,
                    bodyHp: 1000 * window.hpBoostFactor,
                    isLeaking: false,
                    leakRate: 0,
                    isWeighted: false,
                    weightStacks: 0,
                    isDashing: false,
                    dashTimer: 0,
                    stunTimer: 0,
                    briefcase: {
                        main: [...window.getActiveBriefcase().main],
                        sub: [...window.getActiveBriefcase().sub]
                    },
                    activeMainIndex: 0,
                    activeSubIndex: 0,
                    shieldAngle: 90,
                    isBagwormActive: false,
                    isChameleonActive: false,
                    bailedOut: false,
                    cooldowns: { main: 0, sub: 0 },
                    takeDamage: function (amount, attackerId, isLeadBullet = false, bulletType = '') {
                        if (this.bodyHp <= 0) {
                            window.triggerBailOutGlobal(this.id, 'Trion Body Destroyed');
                            return;
                        }
                        if (isLeadBullet) {
                            this.isWeighted = true;
                            let stacks = 1;
                            if (bulletType === 'egret') stacks = 2;
                            else if (bulletType === 'ibis') stacks = 4;
                            else if (bulletType === 'lightning') stacks = 1;
                            this.weightStacks = Math.min(5, this.weightStacks + stacks);
                            if (window.spawnSparks) window.spawnSparks(this.x, this.y, '#121212', 10);
                            return;
                        }

                        const hasShieldMain = this.briefcase.main[this.activeMainIndex] === 'Shield';
                        const hasShieldSub = this.briefcase.sub[this.activeSubIndex] === 'Shield';
                        const bothAreShield = hasShieldMain && hasShieldSub;

                        let mainShield = false;
                        let subShield = false;
                        if (bothAreShield) {
                            const pressed = window.isLeftMouseDown || window.isRightMouseDown;
                            mainShield = !this.isChameleonActive && pressed && this.trion > 0;
                            subShield = !this.isChameleonActive && pressed && this.trion > 0;
                        } else {
                            mainShield = !this.isChameleonActive && (hasShieldMain && window.isLeftMouseDown) && this.trion > 0;
                            subShield = !this.isChameleonActive && (hasShieldSub && window.isRightMouseDown) && this.trion > 0;
                        }

                        const isFull = mainShield && subShield;
                        const isBlocked = this.isBlockingAngle(attackerId);
                        const isGimlet = bulletType === 'gimlet';

                        if (isBlocked && (!isGimlet || isFull)) {
                            if (isFull) {
                                this.trion -= amount * 0.08;
                                window.audio.playShieldBlock();
                                if (window.spawnSparks) window.spawnSparks(this.x + Math.cos(this.angle) * 22, this.y + Math.sin(this.angle) * 22, '#ffd700', 16);
                            } else {
                                this.trion -= amount * 0.25;
                                window.audio.playShieldBlock();
                                if (window.spawnSparks) window.spawnSparks(this.x + Math.cos(this.angle) * 22, this.y + Math.sin(this.angle) * 22, '#39ff14', 12);
                            }
                            if (this.trion <= 0) this.trion = 0;
                            return;
                        }

                        this.bodyHp -= amount;
                        if (attackerId && attackerId !== this.id) {
                            this.lastAttackerId = attackerId;
                            this.lastAttackTime = Date.now();
                        }
                        if (window.spawnSparks) window.spawnSparks(this.x, this.y, '#ff3b30', 8);

                        if (bulletType === 'gimlet') {
                            this.stunTimer = 20;
                            window.addLogGlobal(`[SYSTEM] ${this.name} is STUNNED by Gimlet!`, 'system');
                        }

                        if (this.bodyHp < this.bodyHpMax * 0.5 && !this.isLeaking) {
                            this.isLeaking = true;
                            this.leakRate = 3;
                            window.addLogGlobal(`[WARNING] You took severe damage! Trion leakage active!`, 'kill');
                        }
                        if (this.bodyHp <= 0) {
                            this.bodyHp = 0;
                            window.triggerBailOutGlobal(this.id, 'Trion Body Destroyed');
                        }
                    },
                    isBlockingAngle(attackerId) {
                        if (this.trion <= 0) return false;
                        const hasShieldMain = this.briefcase.main[this.activeMainIndex] === 'Shield';
                        const hasShieldSub = this.briefcase.sub[this.activeSubIndex] === 'Shield';
                        const bothAreShield = hasShieldMain && hasShieldSub;

                        let mainShield = false;
                        let subShield = false;
                        if (bothAreShield) {
                            const pressed = window.isLeftMouseDown || window.isRightMouseDown;
                            mainShield = !this.isChameleonActive && pressed;
                            subShield = !this.isChameleonActive && pressed;
                        } else {
                            mainShield = !this.isChameleonActive && (hasShieldMain && window.isLeftMouseDown);
                            subShield = !this.isChameleonActive && (hasShieldSub && window.isRightMouseDown);
                        }

                        if (!mainShield && !subShield) return false;

                        const attacker = window.allAgents.find(a => a.id === attackerId);
                        if (!attacker) return false;

                        const attackAngle = Math.atan2(attacker.y - this.y, attacker.x - this.x);
                        let diff = attackAngle - this.angle;
                        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                        const currentShieldAngle = (mainShield && subShield) ? 360 : 90;
                        const shieldRad = (currentShieldAngle * Math.PI) / 360;
                        return Math.abs(diff) <= shieldRad;
                    }
                };

                // Clear vectors
                window.bullets.length = 0;
                window.grPads.length = 0;
                window.particles.length = 0;
                window.allAgents.length = 0;
                window.allAgents.push(window.player);

                // Hook local player takeDamage to replicate changes
                const originalTakeDamage = window.player.takeDamage;
                window.player.takeDamage = function (amount, attackerId, isLeadBullet = false, bulletType = '') {
                    originalTakeDamage.call(this, amount, attackerId, isLeadBullet, bulletType);
                    if (window.isMultiplayer && window.multiplayerManager) {
                        window.multiplayerManager.sendPlayerDamage(this.bodyHp, this.trion, attackerId, isLeadBullet, bulletType);
                    }
                };

                // Spawn other competitors into game fields
                this.spawnRemotePlayersIntoField();

                // Initialize scores
                const scoreBoard = {};
                window.allAgents.forEach(a => scoreBoard[a.id] = 0);
                window.setScoreBoard(scoreBoard);

                // Setup HUD labels
                if (window.updateHUDSlotLabels) window.updateHUDSlotLabels();

                window.setGameTime(300 * 60);
                window.setMatchActive(true);

                window.addLogGlobal("[SYSTEM] LAN Rank Wars Battle Commenced!", 'system');

                // Run physics rendering gameLoop!
                requestAnimationFrame(window.gameLoop);
            }
            return;
        }

        // 2. Render joined player rows
        const listContainer = document.getElementById('lan-players-list');
        if (listContainer) {
            listContainer.innerHTML = '';

            let allReady = true;
            this.lobbyPlayers.forEach(p => {
                const row = document.createElement('div');
                row.className = 'lan-player-row' + (p.isReady ? ' ready' : '');

                // Host status label
                const hostTag = p.isHost ? ' (Host)' : '';
                const statusClass = p.isReady ? 'ready' : 'waiting';
                const statusText = p.isReady ? 'READY' : 'PREPARING';

                row.innerHTML = `
                    <div class="lan-player-info">
                        <div class="lan-avatar-mini" style="background-image: url('chibi/${this.presetAvatarMap(p.preset)}')"></div>
                        <span class="lan-name">${p.name}${hostTag}</span>
                    </div>
                    <span class="lan-status-badge ${statusClass}">${statusText}</span>
                `;
                listContainer.appendChild(row);

                if (!p.isReady) {
                    allReady = false;
                }
            });

            // Enable Host Deployment once everyone is ready
            if (this.isHost) {
                const startBtn = document.getElementById('lan-start-btn');
                if (startBtn) {
                    startBtn.disabled = !allReady || this.lobbyPlayers.length < 2;
                }
            }
        }

        // 3. Sync gameplay states dynamically once match is active
        if (window.getMatchActive()) {
            this.lobbyPlayers.forEach(p => {
                if (p.id === this.playerId) return; // Skip myself

                // Find or create remote player in game simulation array
                let rp = window.allAgents.find(a => a.id === p.id);
                if (!rp) {
                    rp = new RemotePlayer(p.id, p.name, p.preset);
                    window.allAgents.push(rp);
                }

                // Sync properties
                rp.targetX = p.x;
                rp.targetY = p.y;
                rp.targetAngle = p.angle;
                rp.vx = p.vx;
                rp.vy = p.vy;
                rp.bodyHp = p.bodyHp;
                rp.trion = p.trion;

                rp.activeMainIndex = p.activeMainIndex;
                rp.activeSubIndex = p.activeSubIndex;
                rp.isBagwormActive = p.isBagwormActive;
                rp.isChameleonActive = p.isChameleonActive;
                rp.isLeftMouseDown = p.isLeftMouseDown;
                rp.isRightMouseDown = p.isRightMouseDown;
                rp.briefcase = p.briefcase;

                rp.isWeighted = p.isWeighted;
                rp.weightStacks = p.weightStacks;

                if (p.bailedOut && !rp.bailedOut) {
                    rp.bailedOut = true;
                    if (window.triggerBailOutGlobal) {
                        window.triggerBailOutGlobal(rp.id, 'Trion Body Vaporized');
                    }
                }
            });

            // 4. Handle lock-free events queue
            if (data.events && data.events.length > 0) {
                data.events.forEach(evt => {
                    if (evt.ownerId === this.playerId) return; // Skip own events

                    if (evt.type === 'bullet') {
                        // Spawn bullet locally
                        window.bullets.push(new window.Bullet(evt.x, evt.y, evt.angle, evt.config));
                        if (window.audio && window.audio.playShoot) {
                            window.audio.playShoot(evt.config.type || 'asteroid');
                        }
                    }
                    else if (evt.type === 'grasshopper') {
                        // Spawn Grasshopper neon jump pads locally
                        window.grPads.push(new window.GrasshopperPad(evt.x, evt.y, evt.ownerId));
                        if (window.audio && window.audio.playGrasshopper) {
                            window.audio.playGrasshopper();
                        }
                    }
                    else if (evt.type === 'spider') {
                        // Spawn Spider wires locally
                        window.arena.addSpiderWeb(evt.x1, evt.y1, evt.x2, evt.y2, evt.ownerId);
                        if (window.audio && window.audio.playShieldBlock) {
                            window.audio.playShieldBlock();
                        }
                    }
                    else if (evt.type === 'damage') {
                        // Replicate hits
                        const target = window.allAgents.find(a => a.id === evt.targetId);
                        if (target) {
                            target.bodyHp = evt.hp;
                            target.trion = evt.trion;
                            if (window.spawnSparks) {
                                window.spawnSparks(target.x, target.y, '#ff3b30', 8);
                            }
                        }
                    }
                    else if (evt.type === 'bailout') {
                        const target = window.allAgents.find(a => a.id === evt.targetId);
                        if (target && !target.bailedOut) {
                            target.bailedOut = true;
                            if (window.triggerBailOutGlobal) {
                                window.triggerBailOutGlobal(target.id, evt.reason);
                            }
                        }
                    }
                });
            }
        }
    }

    presetAvatarMap(preset) {
        const avatars = {
            yuma: 'Yuma.png', osamu: 'Osamu.png', chika: 'Chika.png', hyuse: 'Hyuse.png',
            custom: 'Kyosuke.png', arafune: 'Arafune.jpg', kakizaki: 'Kakizaki.jpg',
            murakami: 'Murakami.jpg', azuma: 'Azuma.jpg', ikoma: 'Ikoma.jpg',
            katori: 'Katori.jpg', nasu: 'Nasu.jpg', suwa: 'Suwa.jpg',
            kageura: 'Kageura.jpg', ninomiya: 'Ninomiya.jpg', yuba: 'Yuba.jpg'
        };
        return avatars[preset] || 'Kyosuke.png';
    }

    // E. SPAWN RESOLVER
    calculateSpawnCoordinates() {
        // Deterministic spawn placement based on player index in sorted array
        const sorted = [...this.lobbyPlayers].sort((a, b) => a.id.localeCompare(b.id));
        const idx = sorted.findIndex(p => p.id === this.playerId);

        // Dynamic grids coordinates based on map size
        const w = window.arena.width;
        const h = window.arena.height;

        const spawnPoints = [
            { x: 120, y: 120 },                  // Top-Left
            { x: w - 120, y: h - 120 },          // Bottom-Right
            { x: w - 120, y: 120 },              // Top-Right
            { x: 120, y: h - 120 },              // Bottom-Left
            { x: Math.floor(w / 2), y: 120 },      // Top-Center
            { x: Math.floor(w / 2), y: h - 120 }   // Bottom-Center
        ];

        this.localSpawnPoint = spawnPoints[idx % spawnPoints.length];
    }

    // Spawns other room occupants as RemotePlayers
    spawnRemotePlayersIntoField() {
        this.lobbyPlayers.forEach(p => {
            if (p.id === this.playerId) return; // Skip myself

            const rp = new RemotePlayer(p.id, p.name, p.preset);

            // Assign coordinate spawn points based on index
            const sorted = [...this.lobbyPlayers].sort((a, b) => a.id.localeCompare(b.id));
            const idx = sorted.findIndex(x => x.id === p.id);
            const w = window.arena.width;
            const h = window.arena.height;
            const spawnPoints = [
                { x: 120, y: 120 },
                { x: w - 120, y: h - 120 },
                { x: w - 120, y: 120 },
                { x: 120, y: h - 120 },
                { x: Math.floor(w / 2), y: 120 },
                { x: Math.floor(w / 2), y: h - 120 }
            ];

            const pt = spawnPoints[idx % spawnPoints.length];
            rp.x = pt.x;
            rp.y = pt.y;
            rp.targetX = pt.x;
            rp.targetY = pt.y;

            const presets = window.agentPresets[p.preset] || { trion: 7 };
            rp.trionMax = presets.trion * 100 * window.trionBoostFactor;
            rp.trion = rp.trionMax;
            rp.bodyHpMax = 1000 * window.hpBoostFactor;
            rp.bodyHp = rp.bodyHpMax;
            rp.briefcase = p.briefcase;

            window.allAgents.push(rp);
        });
    }

    // F. STATE BROADCAST TICKERS
    sendPlayerUpdate() {
        if (!this.roomId) return;
        const now = Date.now();
        if (now - this.lastBroadcastTime < this.broadcastRate) return;
        this.lastBroadcastTime = now;

        const updateUrl = `${this.serverUrl}?action=update&room=${this.roomId}&player=${this.playerId}`;

        const p = window.player;
        if (!p) return;

        const state = {
            x: p.x,
            y: p.y,
            vx: p.vx,
            vy: p.vy,
            angle: p.angle,
            bodyHp: p.bodyHp,
            trion: p.trion,
            activeMainIndex: p.activeMainIndex,
            activeSubIndex: p.activeSubIndex,
            isBagwormActive: p.isBagwormActive,
            isChameleonActive: p.isChameleonActive,
            isLeftMouseDown: window.isLeftMouseDown,
            isRightMouseDown: window.isRightMouseDown,
            isWeighted: p.isWeighted,
            weightStacks: p.weightStacks,
            bailedOut: p.bailedOut
        };

        fetch(updateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStringifySafe(state)
        }).catch(err => { });
    }

    // Toggle ready check
    toggleReady() {
        if (!this.roomId) return;
        const me = this.lobbyPlayers.find(p => p.id === this.playerId);
        if (!me) return;

        const readyState = !me.isReady;
        this.logStatus(readyState ? "Combat-Ready reported!" : "Preparing triggers loadout...");

        fetch(`${this.serverUrl}?action=update&room=${this.roomId}&player=${this.playerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStringifySafe({ isReady: readyState })
        }).catch(err => { });
    }

    // Deployment trigger from room host
    deployMatchFromHost() {
        if (!this.isHost || !this.roomId) return;
        this.logStatus("Broadcasting tactical deployment...");

        const map = document.getElementById('lan-map-select').value;
        const config = {
            status: 'playing',
            map: map
        };

        fetch(`${this.serverUrl}?action=update&room=${this.roomId}&player=${this.playerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStringifySafe({ isReady: true })
        }).then(() => {
            fetch(`${this.serverUrl}?action=event&room=${this.roomId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: jsonStringifySafe({
                    type: 'config_change',
                    config: config,
                    ownerId: this.playerId
                })
            });
        }).catch(err => { });
    }

    // G. GAMEPLAY ENTITIES ACTION WRAPPERS
    broadcastBullet(bullet) {
        if (!this.roomId) return;

        const event = {
            type: 'bullet',
            ownerId: this.playerId,
            x: bullet.x,
            y: bullet.y,
            angle: bullet.angle,
            config: {
                type: bullet.type,
                speed: bullet.speed,
                damage: bullet.damage,
                trionCost: bullet.trionCost,
                life: bullet.life,
                isLeadBullet: bullet.isLeadBullet,
                isComposite: bullet.isComposite,
                size: bullet.size,
                color: bullet.color,
                waypoints: bullet.waypoints
            }
        };

        fetch(`${this.serverUrl}?action=event&room=${this.roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStringifySafe(event)
        }).catch(err => { });
    }

    broadcastGrasshopper(x, y) {
        if (!this.roomId) return;

        const event = {
            type: 'grasshopper',
            ownerId: this.playerId,
            x: x,
            y: y
        };

        fetch(`${this.serverUrl}?action=event&room=${this.roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStringifySafe(event)
        }).catch(err => { });
    }

    broadcastSpiderWeb(x1, y1, x2, y2) {
        if (!this.roomId) return;

        const event = {
            type: 'spider',
            ownerId: this.playerId,
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2
        };

        fetch(`${this.serverUrl}?action=event&room=${this.roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStringifySafe(event)
        }).catch(err => { });
    }

    sendPlayerDamage(hp, trion, attackerId, isLead, type) {
        if (!this.roomId) return;

        const event = {
            type: 'damage',
            ownerId: this.playerId,
            targetId: this.playerId,
            hp: hp,
            trion: trion,
            attackerId: attackerId,
            isLead: isLead,
            bulletType: type
        };

        fetch(`${this.serverUrl}?action=event&room=${this.roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStringifySafe(event)
        }).catch(err => { });

        if (hp <= 0) {
            this.sendPlayerBailout('Trion Body Depleted');
        }
    }

    sendPlayerBailout(reason) {
        if (!this.roomId) return;

        const event = {
            type: 'bailout',
            ownerId: this.playerId,
            targetId: this.playerId,
            reason: reason
        };

        fetch(`${this.serverUrl}?action=event&room=${this.roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStringifySafe(event)
        }).catch(err => { });
    }
}

// 3. UTILITY ROBUST JSON HELPER CONVERTERS (Avoid circular dependencies crash)
function jsonStringifySafe(obj) {
    try {
        return JSON.stringify(obj);
    } catch (e) {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) return;
                seen.add(value);
            }
            return value;
        });
    }
}

function jsonParseSafe(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}

// Instantiate Multiplayer Manager in the global window grid
window.isMultiplayer = false;
window.multiplayerManager = new MultiplayerManager();
