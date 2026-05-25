/* ==========================================================================
   CORE GAMEPLAY LOOP & ENGINE - WORLD TRIGGER RANK WARS
   ========================================================================== */

// Game Engine State Variables
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const radarCanvas = document.getElementById('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');

let arena = null;
const allAgents = [];
let player = null;
const camera = { x: 0, y: 0, width: 900, height: 600 };
let cameraZoom = 1.0;

function getWorldMouse() {
    if (player && cameraZoom !== 1.0) {
        return {
            x: player.x + (mouseX - canvas.width / 2) / cameraZoom,
            y: player.y + (mouseY - canvas.height / 2) / cameraZoom
        };
    } else {
        return {
            x: mouseX + camera.x,
            y: mouseY + camera.y
        };
    }
}

function cutSpiderWebsInArc(agent, range) {
    if (!arena || !arena.spiderWebs) return;

    for (let i = arena.spiderWebs.length - 1; i >= 0; i--) {
        const web = arena.spiderWebs[i];
        if (web.ownerId === agent.id) continue; // Only cut ENEMY webs!

        // Short-circuit check if segment is completely out of range
        const minDist = pointToLineDistance(agent.x, agent.y, web.x1, web.y1, web.x2, web.y2);
        if (minDist > range) continue;

        // Sample 11 points along the segment to check intersection
        for (let t = 0; t <= 1; t += 0.1) {
            const sx = web.x1 + t * (web.x2 - web.x1);
            const sy = web.y1 + t * (web.y2 - web.y1);

            const dx = sx - agent.x;
            const dy = sy - agent.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= range) {
                const targetAngle = Math.atan2(dy, dx);
                let angleDiff = targetAngle - agent.angle;
                angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

                const slashSweep = (80 * Math.PI) / 180;
                if (Math.abs(angleDiff) <= slashSweep / 2) {
                    // Severed!
                    if (window.spawnSparks) {
                        window.spawnSparks(sx, sy, '#bd00ff', 12);
                    }
                    if (typeof addLog !== 'undefined') {
                        const cutterName = agent.id === 'player' ? 'Your' : `${agent.name}'s`;
                        addLog(`[TACTICAL] ${cutterName} blade severed an enemy tripwire!`, 'system');
                    }
                    arena.spiderWebs.splice(i, 1);
                    break;
                }
            }
        }
    }
}
window.cutSpiderWebsInArc = cutSpiderWebsInArc;

const bullets = [];
const grPads = [];
const particles = []; // glowing sparks, digital blocks, slashes

// Interactive Drawing States
let tempViperWaypoints = [];
let isDrawingViper = false;

let spiderAnchor = null; // first click coordinate for Spider Wire {x, y}

let gameTime = 300 * 60; // 5 minutes at 60fps
let matchActive = false;
let scoreBoard = {};
let gameDifficulty = 'medium';
let trionBoostFactor = 2.0;
window.trionBoostFactor = trionBoostFactor;
let hpBoostFactor = 1.0;
window.hpBoostFactor = hpBoostFactor;

// Key mappings
const keys = {};
let mouseX = 0;
let mouseY = 0;
let isLeftMouseDown = false;
let isRightMouseDown = false;

/* ==========================================================================
   INITIALIZATION & LOBBY SYSTEM
   ========================================================================== */

function initLobby() {
    arena = new window.Arena(900, 600); // init global arena
    setupAgentSelectors();
    setupBriefcaseSelectors();
    setupDeployButton();
    setupKeyboardListeners();
    setupMouseListeners();
    setupRivalSelectors();
}

function setupRivalSelectors() {
    const checkboxes = document.querySelectorAll('.rival-checkbox input');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const label = cb.closest('.rival-checkbox');
            if (cb.checked) {
                label.classList.add('active');
            } else {
                label.classList.remove('active');
            }
        });
    });
}

// 1. Agent Selection Screen Actions
function isProjectileWeapon(name) {
    const trig = window.TRIGGER_CATALOG[name];
    if (!trig) return false;
    return trig.category === 'shooter' || trig.category === 'gunner' || trig.category === 'sniper';
}

const agentPresets = {
    yuma: { name: "Yuma Kuga", trion: 8, attack: 9, defense: 7, mobility: 9, speed: 4.2, desc: "Neighbor with exceptional combat reflexes. Equips Scorpion for versatile close-range combat, complemented by Grasshopper maneuvers.", main: ["Scorpion", "Shield", "Grasshopper", "Empty"], sub: ["Scorpion", "Shield", "Grasshopper", "Bagworm"] },
    osamu: { name: "Osamu Mikumo", trion: 4, attack: 4, defense: 8, mobility: 5, speed: 3.2, desc: "Tamakoma Captain. Focuses on tactical spider webs and homing Hound traps to corner opponents.", main: ["Raygust", "Asteroid", "Shield", "Empty"], sub: ["Thruster", "Spider", "Shield", "Bagworm"] },
    chika: { name: "Chika Amatori", trion: 10, attack: 10, defense: 6, mobility: 4, speed: 2.8, desc: "Trion Monster. Deploys heavy-artillery Sniper triggers. Fires giant Ibis shots capable of blowing up map buildings.", main: ["Ibis", "Egret", "Lightning", "Shield"], sub: ["Hound", "Shield", "Bagworm", "Lead Bullet"] },
    hyuse: { name: "Hyuse", trion: 9, attack: 8, defense: 8, mobility: 7, speed: 3.6, desc: "Aftokrator Knight. Leverages Raygust heavy shield modes and customizable Viper curves to pressure targets.", main: ["Kogetsu", "Asteroid", "Shield", "Empty"], sub: ["Senku", "Viper", "Shield", "Bagworm"] },
    arafune: { name: "Tetsuji Arafune", trion: 6, attack: 7, defense: 6, mobility: 7, speed: 3.6, desc: "Arafune Unit Captain. An All-Rounder sniper who can aggressively defend himself with Kogetsu if opponents close the distance.", main: ["Egret", "Ibis", "Kogetsu", "Shield"], sub: ["Lightning", "Senku", "Bagworm", "Shield"] },
    kakizaki: { name: "Kuniharu Kakizaki", trion: 6, attack: 6, defense: 8, mobility: 6, speed: 3.4, desc: "Kakizaki Unit Captain. A highly disciplined defense-oriented Gunner who utilizes Assault Rifle fire behind solid Shield arrays.", main: ["Assault Rifle", "Shield", "Empty", "Empty"], sub: ["Hound", "Bagworm", "Shield", "Empty"] },
    murakami: { name: "Ko Murakami", trion: 7, attack: 8, defense: 10, mobility: 6, speed: 3.3, desc: "Suzunari-1 Ace. Top No. 4 Attacker with a flawless shield defense. Uses Raygust Shield Mode paired with a Main-hand Kogetsu.", main: ["Kogetsu", "Raygust", "Shield", "Empty"], sub: ["Thruster", "Bagworm", "Shield", "Empty"] },
    azuma: { name: "Haruaki Azuma", trion: 7, attack: 8, defense: 8, mobility: 6, speed: 3.2, desc: "Azuma Unit Captain. Border's first Sniper and ultimate tactician. Masters map camouflage to land devastating wall-piercing Ibis shots.", main: ["Egret", "Ibis", "Shield", "Empty"], sub: ["Lightning", "Bagworm", "Shield", "Empty"] },
    ikoma: { name: "Tatsuhito Ikoma", trion: 7, attack: 9, defense: 6, mobility: 7, speed: 3.7, desc: "Ikoma Unit Captain. Master of the Ikoma Senku—an ultra-fast, extended-range blade slash that catches out enemies from afar.", main: ["Kogetsu", "Shield", "Empty", "Empty"], sub: ["Senku", "Bagworm", "Shield", "Empty"] },
    katori: { name: "Yoko Katori", trion: 6, attack: 8, defense: 6, mobility: 9, speed: 4.0, desc: "Katori Unit Captain. A hyper-agile All-Rounder who uses Grasshopper to fly around the map while dual-wielding Scorpion and Handguns.", main: ["Scorpion", "Assault Rifle", "Shield", "Empty"], sub: ["Grasshopper", "Bagworm", "Shield", "Empty"] },
    nasu: { name: "Rei Nasu", trion: 7, attack: 8, defense: 6, mobility: 8, speed: 3.8, desc: "Nasu Unit Captain. A genius Shooter who commands complex Viper bullet trajectories to bypass cover and strike from blind spots.", main: ["Viper", "Asteroid", "Shield", "Empty"], sub: ["Viper", "Bagworm", "Shield", "Empty"] },
    suwa: { name: "Kotaro Suwa", trion: 6, attack: 7, defense: 7, mobility: 5, speed: 3.0, desc: "Suwa Unit Captain. Close-quarters Gunner who locks down choke points with a dual-shotgun setup to vaporize shields at short range.", main: ["Shotgun", "Shield", "Empty", "Empty"], sub: ["Shotgun", "Bagworm", "Shield", "Empty"] },
    kageura: { name: "Kotaro Kageura", trion: 8, attack: 9, defense: 5, mobility: 8, speed: 3.9, desc: "Kageura Unit Captain. Top No. 1 B-Rank Attacker. Deploys whipping Scorpion blades and surprise Mole Claw strikes from the ground.", main: ["Scorpion", "Shield", "Empty", "Empty"], sub: ["Scorpion", "Mole Claw", "Bagworm", "Shield"] },
    ninomiya: { name: "Masataka Ninomiya", trion: 9, attack: 10, defense: 7, mobility: 6, speed: 3.4, desc: "Ninomiya Unit Captain. No. 1 Shooter in Border. Overwhelms targets with massive Trion pools, spamming lethal Hornet and Gimlet fusions.", main: ["Asteroid", "Hound", "Shield", "Empty"], sub: ["Asteroid", "Hound", "Bagworm", "Shield"] },
    yuba: { name: "Takuma Yuba", trion: 6, attack: 9, defense: 6, mobility: 8, speed: 3.8, desc: "Yuba Unit Captain. A fast-draw dual pistol Gunner specialized in 1v1 duels. Shortens projectile range for absolute bullet velocity.", main: ["Assault Rifle", "Shield", "Empty", "Empty"], sub: ["Assault Rifle", "Bagworm", "Shield", "Empty"] },
    custom: { name: "Custom Agent", trion: 7, attack: 7, defense: 7, mobility: 7, speed: 3.5, desc: "Configure your own combination! Click briefcase slots above to select custom attacker, shooter, and support Triggers.", main: ["Kogetsu", "Hound", "Assault Rifle", "Shield"], sub: ["Meteora", "Viper", "Lead Bullet", "Bagworm"] }
};
window.agentPresets = agentPresets;

let selectedAgent = 'yuma';
let activeBriefcase = {
    main: ["Scorpion", "Grasshopper", "Shield", "Empty"],
    sub: ["Scorpion", "Shield", "Bagworm", "Empty"]
};

function setupAgentSelectors() {
    const cards = document.querySelectorAll('.agent-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            selectedAgent = card.getAttribute('data-agent');
            updateStatsDisplay();

            // Load Default Briefcase for Preset
            const data = agentPresets[selectedAgent];
            activeBriefcase.main = [...data.main];
            activeBriefcase.sub = [...data.sub];
            renderBriefcaseHTML();
        });
    });
}

function updateStatsDisplay() {
    const data = agentPresets[selectedAgent];
    if (!data) return;

    // Update Stats Display
    const portrait = document.getElementById('agent-stats-portrait');
    if (portrait) {
        portrait.className = `agent-portrait ${selectedAgent} animate-glow`;
    }

    document.getElementById('stat-trion').style.width = `${Math.min(10, data.trion) * 10}%`;
    document.getElementById('stat-attack').style.width = `${Math.min(10, data.attack) * 10}%`;
    document.getElementById('stat-defense').style.width = `${Math.min(10, data.defense) * 10}%`;
    document.getElementById('stat-mobility').style.width = `${Math.min(10, data.mobility) * 10}%`;

    if (selectedAgent === 'custom') {
        document.getElementById('stat-trion-val').innerHTML = `<button class="stat-btn" onclick="adjustCustomStat('trion', -1)">-</button> <span class="stat-num">${data.trion}</span> <button class="stat-btn" onclick="adjustCustomStat('trion', 1)">+</button>`;
        document.getElementById('stat-attack-val').innerHTML = `<button class="stat-btn" onclick="adjustCustomStat('attack', -1)">-</button> <span class="stat-num">${data.attack}</span> <button class="stat-btn" onclick="adjustCustomStat('attack', 1)">+</button>`;
        document.getElementById('stat-defense-val').innerHTML = `<button class="stat-btn" onclick="adjustCustomStat('defense', -1)">-</button> <span class="stat-num">${data.defense}</span> <button class="stat-btn" onclick="adjustCustomStat('defense', 1)">+</button>`;
        document.getElementById('stat-mobility-val').innerHTML = `<button class="stat-btn" onclick="adjustCustomStat('mobility', -1)">-</button> <span class="stat-num">${data.mobility}</span> <button class="stat-btn" onclick="adjustCustomStat('mobility', 1)">+</button>`;
    } else {
        document.getElementById('stat-trion-val').textContent = data.trion;
        document.getElementById('stat-attack-val').textContent = data.attack;
        document.getElementById('stat-defense-val').textContent = data.defense;
        document.getElementById('stat-mobility-val').textContent = data.mobility;
    }

    document.getElementById('agent-description').textContent = data.desc;
}

window.adjustCustomStat = function (stat, amount) {
    const data = agentPresets.custom;
    if (!data) return;

    data[stat] = Math.max(1, Math.min(10, data[stat] + amount));

    // Update speed based on mobility
    if (stat === 'mobility') {
        data.speed = 2.0 + (data.mobility * 0.22); // dynamic speed formula: mobility 7 = 3.54 speed
    }

    // Refresh display
    updateStatsDisplay();
};

function renderBriefcaseHTML() {
    const mainSlots = document.querySelectorAll('.main-hand .slot-item');
    const subSlots = document.querySelectorAll('.sub-hand .slot-item');

    mainSlots.forEach((slot, idx) => {
        const trgName = activeBriefcase.main[idx];
        const trig = window.TRIGGER_CATALOG[trgName];
        slot.querySelector('.trigger-name').textContent = trgName;
        slot.querySelector('.trigger-type').textContent = trig ? trig.category : "None";
        slot.setAttribute('data-type', trig ? trig.category : "none");
    });

    subSlots.forEach((slot, idx) => {
        const trgName = activeBriefcase.sub[idx];
        const trig = window.TRIGGER_CATALOG[trgName];
        slot.querySelector('.trigger-name').textContent = trgName;
        slot.querySelector('.trigger-type').textContent = trig ? trig.category : "None";
        slot.setAttribute('data-type', trig ? trig.category : "none");
    });
}

// 2. Briefcase Editor Slot Modals
let editingSlot = null; // { side: 'main'|'sub', index: 0-3 }

function setupBriefcaseSelectors() {
    const mainSlots = document.querySelectorAll('.main-hand .slot-item');
    const subSlots = document.querySelectorAll('.sub-hand .slot-item');
    const dialog = document.getElementById('trigger-dialog');
    const closeModal = document.getElementById('close-modal-btn');
    const resetBtn = document.getElementById('reset-briefcase');

    const openSelector = (side, index) => {
        editingSlot = { side, index };
        document.getElementById('target-slot-id').textContent = `${side.toUpperCase()} ${index + 1}`;
        dialog.classList.add('active');

        // Reset and sync tab buttons active state
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(t => {
            if (t.getAttribute('data-category') === 'attacker') {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });

        showCategory('attacker'); // default tab
    };

    mainSlots.forEach((slot, idx) => {
        slot.addEventListener('click', () => openSelector('main', idx));
    });

    subSlots.forEach((slot, idx) => {
        slot.addEventListener('click', () => openSelector('sub', idx));
    });

    closeModal.addEventListener('click', () => dialog.classList.remove('active'));
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.classList.remove('active');
    });

    resetBtn.addEventListener('click', () => {
        const data = agentPresets[selectedAgent];
        activeBriefcase.main = [...data.main];
        activeBriefcase.sub = [...data.sub];
        renderBriefcaseHTML();
    });

    // Handle dialog category tabs click
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            showCategory(tab.getAttribute('data-category'));
        });
    });
}

function showCategory(category) {
    const listContainer = document.querySelector('.trigger-list-container');
    listContainer.innerHTML = '';

    if (!editingSlot) return;
    const side = editingSlot.side;
    const oppositeSide = side === 'main' ? 'sub' : 'main';

    // Filter Trigger Catalog
    for (const [key, trig] of Object.entries(window.TRIGGER_CATALOG)) {
        if (trig.category === category || (category === 'sniper' && trig.category === 'gunner')) {

            // 1. Enforce option triggers opposite hand weapon requirements (don't show if missing)
            if (key === 'Senku' || key === 'Genyo') {
                if (!activeBriefcase[oppositeSide].includes('Kogetsu')) {
                    continue;
                }
            }
            if (key === 'Thruster') {
                if (!activeBriefcase[oppositeSide].includes('Raygust')) {
                    continue;
                }
            }
            if (key === 'Mole Claw') {
                if (!activeBriefcase[oppositeSide].includes('Scorpion')) {
                    continue;
                }
            }
            if (key === 'Lead Bullet') {
                const hasOppositeProjectile = activeBriefcase[oppositeSide].some(t => isProjectileWeapon(t));
                if (!hasOppositeProjectile) {
                    continue;
                }
            }

            // 2. Enforce Main-only and Sub-only trigger rules based on Border regulations
            if (side === 'main' && (key === 'Bagworm' || key === 'Lead Bullet' || key === 'Teleporter' || key === 'Senku' || key === 'Genyo' || key === 'Thruster' || key === 'Mole Claw')) {
                continue;
            }
            if (side === 'sub' && (key === 'Egret' || key === 'Lightning' || key === 'Ibis')) {
                continue;
            }

            const card = document.createElement('div');
            card.className = 'trigger-choice-card';
            card.innerHTML = `
                <div class="trigger-choice-info">
                    <h4>${trig.name}</h4>
                    <p>${trig.description}</p>
                </div>
                <div class="trion-badge">${trig.trionCost > 0 ? 'Cost: ' + trig.trionCost : 'Passive'}</div>
            `;

            card.addEventListener('click', () => {
                if (editingSlot) {
                    const side = editingSlot.side;
                    const idx = editingSlot.index;

                    // Perform the assignment (filtered items are already validated!)
                    activeBriefcase[side][idx] = key;

                    // Check and auto-clean dependents on both sides
                    const hasKogetsuMain = activeBriefcase.main.includes('Kogetsu');
                    const hasKogetsuSub = activeBriefcase.sub.includes('Kogetsu');
                    const hasRaygustMain = activeBriefcase.main.includes('Raygust');
                    const hasRaygustSub = activeBriefcase.sub.includes('Raygust');
                    const hasScorpionMain = activeBriefcase.main.includes('Scorpion');
                    const hasScorpionSub = activeBriefcase.sub.includes('Scorpion');

                    for (let s = 0; s < 4; s++) {
                        // Senku and Genyo require Kogetsu on the opposite hand
                        if ((activeBriefcase.sub[s] === 'Senku' || activeBriefcase.sub[s] === 'Genyo') && !hasKogetsuMain) {
                            activeBriefcase.sub[s] = 'Empty';
                        }
                        if ((activeBriefcase.main[s] === 'Senku' || activeBriefcase.main[s] === 'Genyo') && !hasKogetsuSub) {
                            activeBriefcase.main[s] = 'Empty';
                        }

                        // Thruster requires Raygust on the opposite hand
                        if (activeBriefcase.sub[s] === 'Thruster' && !hasRaygustMain) {
                            activeBriefcase.sub[s] = 'Empty';
                        }
                        if (activeBriefcase.main[s] === 'Thruster' && !hasRaygustSub) {
                            activeBriefcase.main[s] = 'Empty';
                        }

                        // Mole Claw requires Scorpion on the opposite hand
                        if (activeBriefcase.sub[s] === 'Mole Claw' && !hasScorpionMain) {
                            activeBriefcase.sub[s] = 'Empty';
                        }
                        if (activeBriefcase.main[s] === 'Mole Claw' && !hasScorpionSub) {
                            activeBriefcase.main[s] = 'Empty';
                        }
                    }

                    // Cross-side cleanup for Lead Bullet
                    const oppositeSide = side === 'main' ? 'sub' : 'main';
                    const hasProjectileThisSide = activeBriefcase[side].some(t => isProjectileWeapon(t));
                    if (!hasProjectileThisSide) {
                        for (let s = 0; s < 4; s++) {
                            if (activeBriefcase[oppositeSide][s] === 'Lead Bullet') {
                                activeBriefcase[oppositeSide][s] = 'Empty';
                            }
                        }
                    }

                    renderBriefcaseHTML();
                    document.getElementById('trigger-dialog').classList.remove('active');
                }
            });

            listContainer.appendChild(card);
        }
    }
}

// 3. Deploy Simulation Button Transition
function setupDeployButton() {
    const deployBtn = document.getElementById('start-battle-btn');
    deployBtn.addEventListener('click', () => {
        window.audio.init();
        window.audio.resume();
        startSimulation();
    });
}

/* ==========================================================================
   KEYBOARD & MOUSE EVENT LISTENERS
   ========================================================================== */

function setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
        const key = e.key.toUpperCase();
        keys[key] = true;

        if (!matchActive) return;

        // Switch Main Slots (1, 2, 3, 4)
        if (e.key === '1') player.activeMainIndex = 0;
        if (e.key === '2') player.activeMainIndex = 1;
        if (e.key === '3') player.activeMainIndex = 2;
        if (e.key === '4') player.activeMainIndex = 3;

        // Switch Sub Slots (Q, E, R, F)
        if (key === 'Q') player.activeSubIndex = 0;
        if (key === 'E') player.activeSubIndex = 1;
        if (key === 'R') player.activeSubIndex = 2;
        if (key === 'F') player.activeSubIndex = 3;

        if (e.key === 'Escape') {
            togglePause();
        }
    });

    window.addEventListener('keyup', (e) => {
        keys[e.key.toUpperCase()] = false;
    });
}

function setupMouseListeners() {
    const updateMousePos = (e) => {
        const rect = canvas.getBoundingClientRect();
        // Scale from CSS display size to canvas internal resolution
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseY = (e.clientY - rect.top) * scaleY;
    };

    canvas.addEventListener('mousemove', updateMousePos);

    canvas.addEventListener('mousedown', (e) => {
        updateMousePos(e);
        window.audio.init();
        window.audio.resume();

        if (e.button === 0) {
            isLeftMouseDown = true;

            // Check if drawing Viper path
            const activeTrig = player.briefcase.main[player.activeMainIndex];
            if (activeTrig === 'Viper') {
                isDrawingViper = true;
                const wm = getWorldMouse();
                tempViperWaypoints = [{ x: wm.x, y: wm.y }];
            }
        }
        if (e.button === 2) isRightMouseDown = true;
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            isLeftMouseDown = false;

            // Trigger Viper projectile release
            if (isDrawingViper) {
                isDrawingViper = false;
                fireViperWaypoints();
            }
        }
        if (e.button === 2) isRightMouseDown = false;
    });

    // Resize camera using scroll wheel for snipers
    canvas.addEventListener('wheel', (e) => {
        if (!matchActive || !player) return;
        e.preventDefault();

        const activeMainTrig = player.briefcase.main[player.activeMainIndex];
        const isHoldingSniper = (activeMainTrig === 'Egret' || activeMainTrig === 'Ibis' || activeMainTrig === 'Lightning');

        if (isHoldingSniper) {
            // Adjust camera zoom: scroll down (deltaY > 0) to zoom out, scroll up (deltaY < 0) to zoom in
            const direction = e.deltaY > 0 ? -1 : 1;
            cameraZoom = Math.max(0.45, Math.min(1.0, cameraZoom + direction * 0.05));
        }
    });

    // Disable context menu on canvas so right clicks work properly
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Disable context menu on bailout screen so right clicks don't bring up browser overlay
    const bailoutScreen = document.getElementById('bailout-screen');
    if (bailoutScreen) {
        bailoutScreen.addEventListener('contextmenu', e => e.preventDefault());
    }
}

/* ==========================================================================
   SIMULATION ENGINE START
   ========================================================================== */

function startSimulation() {
    // 1. Hide Lobby Screen, Show Arena HUD
    document.getElementById('lobby-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    // 2. Map Configurations
    const mapSelect = document.getElementById('map-select').value;
    let mapWidth = 3200;
    let mapHeight = 2900;
    let mapDisplayName = "Cyber Grid Map";
    let arenaType = 'cybergrid';

    // Parse the map type
    if (mapSelect.includes('cityscape')) {
        arenaType = mapSelect.includes('large') ? 'cityscape_large' : 'cityscape';
        mapDisplayName = "Cityscape Map";
    } else if (mapSelect.includes('forest')) {
        arenaType = 'forest_mountain';
        mapDisplayName = "Forest & Mountain Map";
    } else if (mapSelect.includes('training')) {
        arenaType = 'training_room';
        mapDisplayName = "Border Training Grid";
    } else {
        arenaType = 'cybergrid';
        mapDisplayName = "Cyber Grid Plain";
    }

    // Parse the size and assign dimensions
    if (mapSelect.includes('small')) {
        mapWidth = 1200;
        mapHeight = 1000;
        mapDisplayName += " (Small)";
    } else if (mapSelect.includes('medium')) {
        mapWidth = 2000;
        mapHeight = 1800;
        mapDisplayName += " (Medium)";
    } else {
        // Large maps
        if (mapSelect === 'cityscape_large') {
            mapWidth = 3800;
            mapHeight = 3200;
        } else if (mapSelect.includes('forest')) {
            mapWidth = 3500;
            mapHeight = 3000;
        } else if (mapSelect.includes('training')) {
            mapWidth = 3600;
            mapHeight = 3200;
        } else {
            mapWidth = 3200;
            mapHeight = 2900;
        }
        mapDisplayName += " (Large)";
    }

    arena.init(arenaType, mapWidth, mapHeight);
    document.getElementById('hud-map-name').textContent = mapDisplayName;

    // Read Difficulty, Trion Boost and HP Boost Settings
    const trionBoostSelect = document.getElementById('trion-boost-select');
    trionBoostFactor = trionBoostSelect ? parseFloat(trionBoostSelect.value) : 2.0;
    window.trionBoostFactor = trionBoostFactor;

    const hpBoostSelect = document.getElementById('hp-boost-select');
    hpBoostFactor = hpBoostSelect ? parseFloat(hpBoostSelect.value) : 1.0;
    window.hpBoostFactor = hpBoostFactor;

    const difficultySelect = document.getElementById('difficulty-select');
    gameDifficulty = difficultySelect ? difficultySelect.value : 'medium';

    // 3. Spawns Player Object
    player = {
        id: 'player',
        name: (agentPresets[selectedAgent] && agentPresets[selectedAgent].name) || 'Custom Agent',
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        radius: 18,
        angle: 0,
        speed: (agentPresets[selectedAgent] ? agentPresets[selectedAgent].speed : 3.5),

        // Trion capacity (scaled standard capacity, multiplied by trionBoostFactor)
        trionMax: (agentPresets[selectedAgent] ? agentPresets[selectedAgent].trion * 100 : 900) * trionBoostFactor,
        trion: 0, // Set in reset state below
        bodyHpMax: 1000 * hpBoostFactor,
        bodyHp: 1000 * hpBoostFactor,
        isLeaking: false,
        leakRate: 0,

        isWeighted: false,
        weightStacks: 0,
        isDashing: false,
        dashTimer: 0,
        stunTimer: 0, // Initialize stunTimer for Gimlet stuns

        // active briefcase setup slots indices
        briefcase: {
            main: [...activeBriefcase.main],
            sub: [...activeBriefcase.sub]
        },
        activeMainIndex: 0,
        activeSubIndex: 0,

        shieldAngle: 90, // scrollable shield degree

        // Passive Camouflage
        isBagwormActive: false,
        isChameleonActive: false,

        // Bail out state (agent is eliminated only when this is true)
        bailedOut: false,

        // Cooldown maps
        cooldowns: { main: 0, sub: 0 },

        takeDamage(amount, attackerId, isLeadBullet = false, bulletType = '') {
            // If bodyHp is already 0, any hit triggers bail out
            if (this.bodyHp <= 0) {
                triggerBailOut('player', 'Trion Body Destroyed');
                return;
            }

            // Handle Lead Bullet stack - bypasses shielding completely!
            if (isLeadBullet) {
                this.isWeighted = true;
                let stacks = 1;
                if (bulletType === 'egret') stacks = 2;
                else if (bulletType === 'ibis') stacks = 4;
                else if (bulletType === 'lightning') stacks = 1;

                this.weightStacks = Math.min(5, this.weightStacks + stacks);
                addLog(`[WARNING] Hit by black Lead Bullet! Total weight stacks: ${this.weightStacks}`, 'kill');
                spawnSparks(this.x, this.y, '#121212', 10);
                return;
            }

            // Check if Full Shield is active
            const hasShieldMain = this.briefcase.main[this.activeMainIndex] === 'Shield';
            const hasShieldSub = this.briefcase.sub[this.activeSubIndex] === 'Shield';
            const bothAreShield = hasShieldMain && hasShieldSub;

            let mainShieldActive = false;
            let subShieldActive = false;

            if (bothAreShield) {
                const eitherPressed = isLeftMouseDown || isRightMouseDown;
                mainShieldActive = !this.isChameleonActive && eitherPressed && this.trion > 0;
                subShieldActive = !this.isChameleonActive && eitherPressed && this.trion > 0;
            } else {
                mainShieldActive = !this.isChameleonActive && (hasShieldMain && isLeftMouseDown) && this.trion > 0;
                subShieldActive = !this.isChameleonActive && (hasShieldSub && isRightMouseDown) && this.trion > 0;
            }

            const isFullShield = mainShieldActive && subShieldActive;

            // Normal Hit checks shield block direction (Gimlet is blocked only by Full Shield!)
            const isBlocked = this.isBlockingAngle(attackerId);
            const isGimlet = bulletType === 'gimlet';

            if (isBlocked && (!isGimlet || isFullShield)) {
                if (isFullShield) {
                    // Full Shield holds! Only drain 8% of the damage as Trion cost
                    this.trion -= amount * 0.08;
                    window.audio.playShieldBlock();
                    // Golden sparks for Full Shield
                    spawnSparks(this.x + Math.cos(this.angle) * 22, this.y + Math.sin(this.angle) * 22, '#ffd700', 16);
                    if (isGimlet) {
                        addLog("[TACTICAL] Full Shield successfully blocked Gimlet!", "system");
                    }
                } else {
                    // Standard Shield holds! Completely block damage to Trion HP body, charge 25% Trion cost
                    this.trion -= amount * 0.25;
                    window.audio.playShieldBlock();
                    // Green sparks for standard Shield
                    spawnSparks(this.x + Math.cos(this.angle) * 22, this.y + Math.sin(this.angle) * 22, '#39ff14', 12);
                }
                if (this.trion <= 0) {
                    this.trion = 0;
                }
                return;
            }

            // Scale damage based on difficulty
            let finalAmount = amount;
            if (gameDifficulty === 'easy') {
                finalAmount = Math.floor(amount * 0.6); // 40% damage reduction
            } else if (gameDifficulty === 'hard') {
                finalAmount = Math.floor(amount * 1.25); // 25% damage increase
            }

            // Hit connects directly to Body HP
            this.bodyHp -= finalAmount;
            if (attackerId && attackerId !== this.id) {
                this.lastAttackerId = attackerId;
                this.lastAttackTime = Date.now();
            }
            spawnSparks(this.x, this.y, '#ff3b30', 8);

            // Gimlet stuns!
            if (bulletType === 'gimlet') {
                this.stunTimer = 20; // 20 frames stun!
                addLog(`[SYSTEM] ${this.name} is STUNNED by high-penetration Gimlet!`, 'system');
            }

            // Active leakage if HP falls below 50%
            if (this.bodyHp < this.bodyHpMax * 0.5 && !this.isLeaking) {
                this.isLeaking = true;
                this.leakRate = 10; // 10 points per second passively
                addLog(`[WARNING] ${this.name} Trion Body damaged below 50%! Passive Trion Leakage activated!`, 'kill');
            }

            if (this.bodyHp <= 0) {
                this.bodyHp = 0;
                triggerBailOut('player', 'Trion Body Destroyed');
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
                const eitherPressed = isLeftMouseDown || isRightMouseDown;
                mainShield = !this.isChameleonActive && eitherPressed;
                subShield = !this.isChameleonActive && eitherPressed;
            } else {
                mainShield = !this.isChameleonActive && (hasShieldMain && isLeftMouseDown);
                subShield = !this.isChameleonActive && (hasShieldSub && isRightMouseDown);
            }

            if (!mainShield && !subShield) return false;

            // Find attacker
            const attacker = allAgents.find(a => a.id === attackerId);
            if (!attacker) return false;

            const attackAngle = Math.atan2(attacker.y - this.y, attacker.x - this.x);
            let angleDiff = attackAngle - this.angle;
            // Normalize
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

            // Full Shield provides a complete 360-degree coverage!
            const currentShieldAngle = (mainShield && subShield) ? 360 : 90;
            const shieldRad = (currentShieldAngle * Math.PI) / 360; // half angle bounds
            return Math.abs(angleDiff) <= shieldRad;
        }
    };

    const spawnPoints = [
        { x: 100, y: 100 }, // Top-Left
        { x: arena.width - 100, y: arena.height - 100 }, // Bottom-Right
        { x: arena.width - 100, y: 100 }, // Top-Right
        { x: 100, y: arena.height - 100 }, // Bottom-Left
        { x: arena.width / 2, y: 100 }, // Top-Center
        { x: arena.width / 2, y: arena.height - 100 }, // Bottom-Center
        { x: 100, y: arena.height / 2 }, // Left-Center
        { x: arena.width - 100, y: arena.height / 2 }, // Right-Center
        { x: arena.width / 3, y: arena.height / 3 },
        { x: (arena.width * 2) / 3, y: (arena.height * 2) / 3 },
        { x: (arena.width * 2) / 3, y: arena.height / 3 },
        { x: arena.width / 3, y: (arena.height * 2) / 3 }
    ];

    const getWalkableSpawn = (pt) => {
        if (!arena.isWall(pt.x, pt.y)) return pt;
        for (let radius = 30; radius < 300; radius += 30) {
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                const sx = pt.x + Math.cos(angle) * radius;
                const sy = pt.y + Math.sin(angle) * radius;
                if (sx > 50 && sx < arena.width - 50 && sy > 50 && sy < arena.height - 50 && !arena.isWall(sx, sy)) {
                    return { x: sx, y: sy };
                }
            }
        }
        return pt;
    };

    // Spawn player at safe Point 0
    const playerSpawn = getWalkableSpawn(spawnPoints[0]);
    player.x = playerSpawn.x;
    player.y = playerSpawn.y;
    player.trion = player.trionMax;
    player.bodyHp = player.bodyHpMax;
    player.isLeaking = false;
    player.leakRate = 0;

    // Activate initial Bagworm on player if equipped
    let playerBgwMainIdx = player.briefcase.main.indexOf('Bagworm');
    let playerBgwSubIdx = player.briefcase.sub.indexOf('Bagworm');
    if (playerBgwMainIdx !== -1) {
        player.activeMainIndex = playerBgwMainIdx;
        player.isBagwormActive = true;
    } else if (playerBgwSubIdx !== -1) {
        player.activeSubIndex = playerBgwSubIdx;
        player.isBagwormActive = true;
    }

    // Clear vectors
    bullets.length = 0;
    grPads.length = 0;
    particles.length = 0;
    allAgents.length = 0;
    allAgents.push(player);

    // 4. Spawns Smart AI Opponents based on user selections
    const selectedRivals = [];
    const checkboxes = document.querySelectorAll('.rival-checkboxes-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
        if (cb.checked) {
            const val = cb.value;
            const presetData = agentPresets[val];
            if (presetData) {
                selectedRivals.push({ preset: val, name: presetData.name });
            }
        }
    });

    // Fallback if none checked (spawn at least Osamu Mikumo)
    if (selectedRivals.length === 0) {
        selectedRivals.push({ preset: 'osamu', name: 'Osamu Mikumo' });
    }

    // Spawn Extra B-Rank Agents
    const extraRivalsSelect = document.getElementById('extra-rivals-select');
    const extraRivalsCount = extraRivalsSelect ? parseInt(extraRivalsSelect.value, 10) : 0;
    const bRankPresets = ['yuma', 'osamu', 'chika', 'hyuse', 'custom'];
    const bRankFirstNames = ['Kuruma', 'Tonoka', 'Okadera', 'Arao', 'Koarai', 'Okudera', 'Inukai', 'Tsuzuji', 'Yoneya', 'Miwa'];
    const bRankRoles = ['Attacker', 'Shooter', 'Gunner', 'Sniper'];

    for (let i = 0; i < extraRivalsCount; i++) {
        const preset = bRankPresets[Math.floor(Math.random() * bRankPresets.length)];
        const firstName = bRankFirstNames[Math.floor(Math.random() * bRankFirstNames.length)];
        let role = 'Attacker';
        if (preset === 'chika') role = 'Sniper';
        else if (preset === 'osamu') role = 'Shooter';
        else if (preset === 'hyuse') role = 'All-Rounder';
        else if (preset === 'custom') role = 'Gunner';

        const name = `B-Rank ${firstName} (${role})`;
        selectedRivals.push({ preset, name });
    }

    selectedRivals.forEach((rival, i) => {
        const ai = new window.AIAgent(`ai_${i}`, rival.name, rival.preset, gameDifficulty);

        // Spawn AI sequentially at distant spawn points
        const ptIndex = (i + 1) % spawnPoints.length;
        const aiSpawn = getWalkableSpawn(spawnPoints[ptIndex]);
        ai.x = aiSpawn.x;
        ai.y = aiSpawn.y;

        // Activate initial Bagworm on AI if equipped
        let aiBgwMainIdx = ai.briefcase.main.indexOf('Bagworm');
        let aiBgwSubIdx = ai.briefcase.sub.indexOf('Bagworm');
        if (aiBgwMainIdx !== -1) {
            ai.activeMain = aiBgwMainIdx;
            ai.isBagwormActive = true;
        } else if (aiBgwSubIdx !== -1) {
            ai.activeSub = aiBgwSubIdx;
            ai.isBagwormActive = true;
        }

        allAgents.push(ai);
    });

    // Initialize scores
    scoreBoard = {};
    allAgents.forEach(a => scoreBoard[a.id] = 0);

    // Setup HUD slot cards labels
    updateHUDSlotLabels();

    gameTime = 300 * 60; // 5:00 at 60fps
    matchActive = true;

    // Clear status feed logs
    document.getElementById('game-logs').innerHTML = '';
    addLog("[SYSTEM] Rank Wars Match Commenced! Deploying triggers...", 'system');

    // Run Gameloop
    requestAnimationFrame(gameLoop);
}

function updateHUDSlotLabels() {
    const mainCards = document.querySelectorAll('#hud-main-slots .hud-slot-card');
    const subCards = document.querySelectorAll('#hud-sub-slots .hud-slot-card');

    mainCards.forEach((card, idx) => {
        card.querySelector('.name').textContent = player.briefcase.main[idx];
    });

    subCards.forEach((card, idx) => {
        card.querySelector('.name').textContent = player.briefcase.sub[idx];
    });
}

/* ==========================================================================
   SIMULATION CORE UPDATE & PHYSICS GAME LOOP
   ========================================================================== */

function gameLoop() {
    if (!matchActive) return;

    // 1. Core State Logic Updates
    updateTimer();
    updatePlayerInputPhysics();

    // Update camera follow centering on player
    camera.x = player.x - camera.width / 2;
    camera.y = player.y - camera.height / 2;
    camera.x = Math.max(0, Math.min(camera.x, arena.width - camera.width));
    camera.y = Math.max(0, Math.min(camera.y, arena.height - camera.height));

    updateProjectilesAndInteractives();
    updateAIAgents();
    updateParticles();
    arena.updateDebris();

    // 2. Screen Graphics Renders
    renderArenaCanvas();
    renderTacticalRadar();
    renderHUDLabels();
    renderScoreLeaderboard();

    // Check match completion
    // Don't auto-end when trion is 0; agents at 0 trion are still alive until hit
    const aliveAgents = allAgents.filter(a => !a.bailedOut);
    if (gameTime <= 0 || player.bailedOut || aliveAgents.length <= 1) {
        endSimulationMatch();
        return;
    }

    requestAnimationFrame(gameLoop);
}

function updateTimer() {
    gameTime--;
    const totalSecs = Math.ceil(gameTime / 60);
    const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    document.getElementById('game-timer').textContent = `${m}:${s}`;
}
function updatePlayerInputPhysics() {
    if (player.bailedOut) return;

    // Decrement trigger cooldowns
    if (player.cooldowns.main > 0) player.cooldowns.main -= 16.67;
    if (player.cooldowns.sub > 0) player.cooldowns.sub -= 16.67;

    // Reset zoom when not holding a sniper
    const activeMainTrig = player.briefcase.main[player.activeMainIndex];
    const isHoldingSniper = (activeMainTrig === 'Egret' || activeMainTrig === 'Ibis' || activeMainTrig === 'Lightning');
    if (!isHoldingSniper) {
        cameraZoom = 1.0;
    }

    // Passive Trion drain
    player.isBagwormActive = (player.briefcase.main[player.activeMainIndex] === 'Bagworm' || player.briefcase.sub[player.activeSubIndex] === 'Bagworm');
    player.isChameleonActive = (player.briefcase.main[player.activeMainIndex] === 'Chameleon' || player.briefcase.sub[player.activeSubIndex] === 'Chameleon');

    if (player.isBagwormActive) player.trion -= 0.3;
    if (player.isChameleonActive) player.trion -= 0.8;

    // Active Shield passive drain
    const mainShieldActive = !player.isChameleonActive && (player.briefcase.main[player.activeMainIndex] === 'Shield' && isLeftMouseDown) && player.trion > 0;
    const subShieldActive = !player.isChameleonActive && (player.briefcase.sub[player.activeSubIndex] === 'Shield' && isRightMouseDown) && player.trion > 0;
    if (mainShieldActive && subShieldActive) {
        player.trion -= 1.0; // Passive consumption for Full Shield
    } else if (mainShieldActive || subShieldActive) {
        player.trion -= 0.5; // Passive consumption for Standard Shield
    }

    if (player.isLeaking) {
        player.bodyHp -= player.leakRate / 60;
    }

    if (player.trion <= 0) {
        player.trion = 0;
    }

    if (player.bodyHp <= 0) {
        player.bodyHp = 0;
        triggerBailOut('player', 'Trion Body Destroyed - Leakage');
    }

    // Dynamic Spider wire overlap check
    let inFriendlySpider = false;
    let inEnemySpider = false;
    for (const web of arena.spiderWebs) {
        const dist = pointToLineDistance(player.x, player.y, web.x1, web.y1, web.x2, web.y2);
        if (dist < player.radius + 6) { // Expanded threshold for better responsive overlap feel
            if (web.ownerId === 'player') {
                inFriendlySpider = true;
            } else {
                inEnemySpider = true;
            }
        }
    }

    // Determine target vector movement speed (slowing down to 15% min speed cap)
    let currentSpeed = player.speed;
    const hasDualScorpion = player.briefcase.main[player.activeMainIndex] === 'Scorpion' && player.briefcase.sub[player.activeSubIndex] === 'Scorpion';
    if (hasDualScorpion) {
        currentSpeed *= 1.15;
    }

    // Apply movement speed penalty if shielding
    const hasShieldMain = player.briefcase.main[player.activeMainIndex] === 'Shield';
    const hasShieldSub = player.briefcase.sub[player.activeSubIndex] === 'Shield';
    const bothAreShield = hasShieldMain && hasShieldSub;

    let mainShield = false;
    let subShield = false;

    if (bothAreShield) {
        const eitherPressed = isLeftMouseDown || isRightMouseDown;
        mainShield = !player.isChameleonActive && eitherPressed && player.trion > 0;
        subShield = !player.isChameleonActive && eitherPressed && player.trion > 0;
    } else {
        mainShield = !player.isChameleonActive && (hasShieldMain && isLeftMouseDown) && player.trion > 0;
        subShield = !player.isChameleonActive && (hasShieldSub && isRightMouseDown) && player.trion > 0;
    }

    if (mainShield && subShield) {
        currentSpeed *= 0.60; // 40% speed penalty for Full Shield
    } else if (mainShield || subShield) {
        currentSpeed *= 0.80; // 20% speed penalty for Standard Shield
    }

    if (inEnemySpider) {
        currentSpeed *= 0.4;
        if (Math.random() < 0.22) {
            spawnSparks(player.x, player.y, '#bd00ff', 2); // Purple particles for slow
        }
    } else if (inFriendlySpider) {
        currentSpeed *= 1.35; // Boost speed by 35%
        if (Math.random() < 0.22) {
            spawnSparks(player.x, player.y, '#39ff14', 2); // Green particles for speed boost
        }
    } else if (player.isWeighted) {
        currentSpeed *= Math.max(0.15, 1 - 0.2 * player.weightStacks);
    }

    if (player.stunTimer && player.stunTimer > 0) {
        player.stunTimer--;
        player.vx = 0;
        player.vy = 0;
        if (Math.random() < 0.35 && window.spawnSparks) {
            window.spawnSparks(player.x, player.y, '#ffd700', 3); // Gold sparks for stun
        }
    } else {
        if (player.isDashing) {
            player.vx *= 0.92;
            player.vy *= 0.92;
            player.dashTimer--;
            if (player.dashTimer <= 0) {
                player.isDashing = false;
            }
        } else {
            // Input checks
            let dx = 0;
            let dy = 0;
            if (keys['W']) dy = -1;
            if (keys['S']) dy = 1;
            if (keys['A']) dx = -1;
            if (keys['D']) dx = 1;

            // Move velocities
            if (dx !== 0 && dy !== 0) {
                // scale diagonals vectors
                dx *= 0.707;
                dy *= 0.707;
            }

            player.vx = dx * currentSpeed;
            player.vy = dy * currentSpeed;
        }

        // Facing angles aim matches cursor world coordinates
        const worldMouse = getWorldMouse();
        player.angle = Math.atan2(worldMouse.y - player.y, worldMouse.x - player.x);

        // Dynamic execution of Left click active Main slot Trigger
        // Block trigger usage when trion is depleted
        if (player.trion > 0 && isLeftMouseDown && player.cooldowns.main <= 0) {
            executeTriggerAction('main');
        }

        // Dynamic execution of Right click active Sub slot Trigger
        if (player.trion > 0 && isRightMouseDown && player.cooldowns.sub <= 0) {
            executeTriggerAction('sub');
        }

        // Composite Bullet fusion check (Keys Shift + Spacebar)
        if (player.trion > 0 && keys[' '] && player.cooldowns.main <= 0 && player.cooldowns.sub <= 0) {
            executeCompositeFusion();
        }
    }

    // Apply movement updates
    player.x += player.vx;
    player.y += player.vy;

    // Collision checking against walls
    const collision = arena.circleCollides(player.x, player.y, player.radius);
    if (collision.collided) {
        player.x = collision.x;
        player.y = collision.y;
    }
}

/* ==========================================================================
   TRIGGERS EXECUTION LOGIC
   ========================================================================== */

function executeTriggerAction(side) {
    if (player.isChameleonActive) return; // Chameleon strictly locks other slots and blocks all attacks/support triggers!

    const isMain = side === 'main';
    const index = isMain ? player.activeMainIndex : player.activeSubIndex;
    const trigName = isMain ? player.briefcase.main[index] : player.briefcase.sub[index];

    if (trigName === "Empty" || trigName === "Bagworm" || trigName === "Chameleon" || trigName === "Shield" || trigName === "Lead Bullet") return;

    const config = window.TRIGGER_CATALOG[trigName];
    if (!config) return;

    // Deduct active Trion
    if (player.trion < config.trionCost) {
        addLog("[ERROR] Insufficient Trion reserves to deploy trigger!", "system");
        return;
    }

    player.trion -= config.trionCost;
    const cooldownRef = isMain ? 'main' : 'sub';

    // ⚔️ ATTACKER TRIGGERS
    if (config.category === 'attacker') {
        if (trigName === 'Kogetsu') {
            window.audio.playSlash(false);
            performBladeSlash(config.damage, config.range, '#00f0ff', false);
            player.cooldowns[cooldownRef] = config.cooldown;
        }
        else if (trigName === 'Scorpion') {
            window.audio.playSlash(true);
            performBladeSlash(config.damage, config.range, '#ff3b30', false);
            player.cooldowns[cooldownRef] = config.cooldown;
        }
        else if (trigName === 'Raygust') {
            // Thick direct line slash
            window.audio.playSlash(false);
            performBladeSlash(config.damage, config.range, '#00ff14', false);
            player.cooldowns[cooldownRef] = config.cooldown;
        }
        else if (trigName === 'Senku') {
            // Checks if left hand holds Kogetsu
            const leftTrig = player.briefcase.main[player.activeMainIndex];
            if (leftTrig === 'Kogetsu') {
                window.audio.playSenku();
                performBladeSlash(config.damage, config.range, '#ffffff', false, true); // range 160px!
                player.cooldowns[cooldownRef] = config.cooldown;
            } else {
                player.trion += config.trionCost; // Refund cost
                addLog("[WARNING] Senku must be deployed with Kogetsu active!", "system");
            }
        }
        else if (trigName === 'Genyo') {
            const leftTrig = player.briefcase.main[player.activeMainIndex];
            if (leftTrig === 'Kogetsu') {
                window.audio.playSlash(false);
                performBladeSlash(config.damage, config.range, '#ffdf00', true); // Genyo curves!
                player.cooldowns[cooldownRef] = config.cooldown;
            } else {
                player.trion += config.trionCost; // Refund cost
                addLog("[WARNING] Genyo must be deployed with Kogetsu active!", "system");
            }
        }
        else if (trigName === 'Mole Claw') {
            const success = performMoleClawStrike(config.damage);
            if (success) {
                window.audio.playSlash(true);
                player.cooldowns[cooldownRef] = config.cooldown;
            } else {
                player.trion += config.trionCost; // Refund cost
            }
        }
        else if (trigName === 'Thruster') {
            window.audio.playThruster();
            const dashSpeed = 22;
            player.vx = Math.cos(player.angle) * dashSpeed;
            player.vy = Math.sin(player.angle) * dashSpeed;
            player.isDashing = true;
            player.dashTimer = 12; // 12 frames lock movement
            player.isWeighted = false; // remove speed debuffs during launch!
            spawnSparks(player.x - Math.cos(player.angle) * 15, player.y - Math.sin(player.angle) * 15, '#00f0ff', 20);
            player.cooldowns[cooldownRef] = config.cooldown;
        }
    }

    // 🏹 SHOOTER TRIGGERS
    else if (config.category === 'shooter') {
        const bulletType = trigName.toLowerCase();

        // Lead active check (using shift key or cross-hand optional trigger if equipped in opposite hand)
        const activeMainTrig = player.briefcase.main[player.activeMainIndex];
        const activeSubTrig = player.briefcase.sub[player.activeSubIndex];
        const oppositeSide = isMain ? 'sub' : 'main';
        const hasOppositeLead = player.briefcase[oppositeSide].includes('Lead Bullet');
        const leadActive = hasOppositeLead && (keys['SHIFT'] || (isMain ? (activeSubTrig === 'Lead Bullet') : (activeMainTrig === 'Lead Bullet')));

        if (leadActive) {
            if (player.trion < 40) {
                // Refund cost already deducted
                player.trion += config.trionCost;
                addLog("[ERROR] Insufficient Trion reserves to deploy Lead Bullet (+40 Trion required)!", "system");
                return;
            }
            player.trion -= 40;
        }

        // Check if dual shooter (identical active Shooter trigger in both slots)
        const isDualShooter = (activeMainTrig === activeSubTrig);
        let fireDouble = false;
        if (isDualShooter && player.trion >= config.trionCost) {
            player.trion -= config.trionCost;
            fireDouble = true;
            addLog(`[TACTICAL] Dual Wielding ${trigName}! Firing double bullets.`, "system");
        }

        if (bulletType === 'viper') {
            // Left click drag activates Viper drawing path
            if (side === 'main' && isLeftMouseDown) {
                player.trion += config.trionCost; // Refund continuous drag costs
                return;
            }
            fireViperZigzag(side);
        } else {
            // Standard Asteroid, Hound, Meteora
            if (fireDouble) {
                // Fire double bullets with slight spread offset
                bullets.push(new window.Bullet(player.x, player.y, player.angle - 0.08, {
                    type: bulletType,
                    damage: leadActive ? 0 : config.damage,
                    speed: config.speed,
                    ownerId: 'player',
                    isLeadBullet: leadActive,
                    color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                    size: leadActive ? 12 : 8
                }));
                bullets.push(new window.Bullet(player.x, player.y, player.angle + 0.08, {
                    type: bulletType,
                    damage: leadActive ? 0 : config.damage,
                    speed: config.speed,
                    ownerId: 'player',
                    isLeadBullet: leadActive,
                    color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                    size: leadActive ? 12 : 8
                }));
            } else {
                bullets.push(new window.Bullet(player.x, player.y, player.angle, {
                    type: bulletType,
                    damage: leadActive ? 0 : config.damage,
                    speed: config.speed,
                    ownerId: 'player',
                    isLeadBullet: leadActive,
                    color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                    size: leadActive ? 12 : 8
                }));
            }

            window.audio.playShoot(bulletType);
        }

        player.cooldowns[cooldownRef] = config.cooldown;
    }

    // 🔫 GUNNER TRIGGERS
    else if (trigName === 'Assault Rifle') {
        const spread = (Math.random() - 0.5) * 0.15;
        const activeMainTrig = player.briefcase.main[player.activeMainIndex];
        const activeSubTrig = player.briefcase.sub[player.activeSubIndex];
        const oppositeSide = isMain ? 'sub' : 'main';
        const hasOppositeLead = player.briefcase[oppositeSide].includes('Lead Bullet');
        const leadActive = hasOppositeLead && (keys['SHIFT'] || (isMain ? (activeSubTrig === 'Lead Bullet') : (activeMainTrig === 'Lead Bullet')));

        if (leadActive) {
            if (player.trion < 40) {
                player.trion += config.trionCost;
                addLog("[ERROR] Insufficient Trion reserves to deploy Lead Bullet (+40 Trion required)!", "system");
                return;
            }
            player.trion -= 40;
        }

        bullets.push(new window.Bullet(player.x, player.y, player.angle + spread, {
            type: 'asteroid',
            damage: leadActive ? 0 : config.damage,
            speed: config.speed,
            ownerId: 'player',
            isLeadBullet: leadActive,
            color: leadActive ? '#121212' : '#ffdf00',
            size: leadActive ? 10 : 6
        }));

        window.audio.playShoot('gunner');
        player.cooldowns[cooldownRef] = config.cooldown;
    }
    else if (trigName === 'Shotgun') {
        const activeMainTrig = player.briefcase.main[player.activeMainIndex];
        const activeSubTrig = player.briefcase.sub[player.activeSubIndex];
        const oppositeSide = isMain ? 'sub' : 'main';
        const hasOppositeLead = player.briefcase[oppositeSide].includes('Lead Bullet');
        const leadActive = hasOppositeLead && (keys['SHIFT'] || (isMain ? (activeSubTrig === 'Lead Bullet') : (activeMainTrig === 'Lead Bullet')));

        if (leadActive) {
            if (player.trion < 40) {
                player.trion += config.trionCost;
                addLog("[ERROR] Insufficient Trion reserves to deploy Lead Bullet (+40 Trion required)!", "system");
                return;
            }
            player.trion -= 40;
        }

        for (let i = -2; i <= 2; i++) {
            const spreadAngle = player.angle + i * 0.08;
            bullets.push(new window.Bullet(player.x, player.y, spreadAngle, {
                type: 'asteroid',
                damage: leadActive ? 0 : config.damage - 2,
                speed: config.speed + (Math.random() - 0.5) * 2,
                ownerId: 'player',
                isLeadBullet: leadActive,
                color: leadActive ? '#121212' : '#ff9500',
                size: leadActive ? 9 : 5,
                life: 35
            }));
        }
        window.audio.playShoot('gunner');
        player.cooldowns[cooldownRef] = config.cooldown;
    }

    // 🎯 SNIPER TRIGGERS (Egret, Lightning)
    else if (trigName === 'Egret' || trigName === 'Lightning') {
        const activeMainTrig = player.briefcase.main[player.activeMainIndex];
        const activeSubTrig = player.briefcase.sub[player.activeSubIndex];
        const oppositeSide = isMain ? 'sub' : 'main';
        const hasOppositeLead = player.briefcase[oppositeSide].includes('Lead Bullet');
        const leadActive = hasOppositeLead && (keys['SHIFT'] || (isMain ? (activeSubTrig === 'Lead Bullet') : (activeMainTrig === 'Lead Bullet')));

        if (leadActive) {
            if (player.trion < 40) {
                player.trion += config.trionCost;
                addLog("[ERROR] Insufficient Trion reserves to deploy Lead Bullet (+40 Trion required)!", "system");
                return;
            }
            player.trion -= 40;
        }

        const ray = arena.raycast(player.x, player.y, player.x + Math.cos(player.angle) * 1500, player.y + Math.sin(player.angle) * 1500);

        // Play sniper sound
        window.audio.playHitscan(trigName === 'Lightning');

        // Render laser trace line
        particles.push({
            type: 'laser',
            x1: player.x,
            y1: player.y,
            x2: ray.x,
            y2: ray.y,
            color: leadActive ? 'rgba(18, 18, 18, 0.95)' : (trigName === 'Lightning' ? 'rgba(0, 240, 255, 0.8)' : 'rgba(255,255,255,0.7)'),
            life: 15
        });

        // Resolve targets in path
        let hitThreat = null;
        let minDist = 999999;

        for (const agent of allAgents) {
            if (agent.id === 'player' || agent.bailedOut || agent.isChameleonActive) continue;

            // Vector calculation from line segment
            const dist = pointToLineDistance(agent.x, agent.y, player.x, player.y, ray.x, ray.y);
            if (dist < agent.radius + 5) {
                const threatDist = Math.sqrt((agent.x - player.x) ** 2 + (agent.y - player.y) ** 2);
                if (threatDist < minDist) {
                    minDist = threatDist;
                    hitThreat = agent;
                }
            }
        }

        if (hitThreat) {
            const wasBailed = hitThreat.bailedOut;
            if (trigName === 'Lightning') {
                hitThreat.takeDamage(leadActive ? 0 : config.damage, 'player', leadActive, 'lightning');
                if (!leadActive) {
                    hitThreat.trion -= config.trionDrain; // Lightning drains trion
                    if (hitThreat.trion <= 0) {
                        hitThreat.trion = 0;
                        hitThreat.lastAttackerId = 'player';
                        hitThreat.lastAttackTime = Date.now();
                    }
                }
                addLog(`[HIT] Lightning hit ${hitThreat.name}!`, 'system');
            } else {
                hitThreat.takeDamage(leadActive ? 0 : config.damage, 'player', leadActive, 'egret');
                addLog(`[HIT] Egret registered direct critical hit on ${hitThreat.name}!`, 'system');
            }
            spawnSparks(hitThreat.x, hitThreat.y, leadActive ? '#121212' : '#39ff14', 15);
        }

        player.cooldowns[cooldownRef] = config.cooldown;
    }
    else if (trigName === 'Ibis') {
        const activeMainTrig = player.briefcase.main[player.activeMainIndex];
        const activeSubTrig = player.briefcase.sub[player.activeSubIndex];
        const oppositeSide = isMain ? 'sub' : 'main';
        const hasOppositeLead = player.briefcase[oppositeSide].includes('Lead Bullet');
        const leadActive = hasOppositeLead && (keys['SHIFT'] || (isMain ? (activeSubTrig === 'Lead Bullet') : (activeMainTrig === 'Lead Bullet')));

        if (leadActive) {
            if (player.trion < 40) {
                player.trion += config.trionCost;
                addLog("[ERROR] Insufficient Trion reserves to deploy Lead Bullet (+40 Trion required)!", "system");
                return;
            }
            player.trion -= 40;
        }

        bullets.push(new window.Bullet(player.x, player.y, player.angle, {
            type: 'ibis',
            damage: leadActive ? 0 : config.damage,
            speed: config.speed,
            ownerId: 'player',
            isLeadBullet: leadActive,
            color: leadActive ? '#121212' : '#ffdf00',
            size: leadActive ? 19 : 15
        }));

        window.audio.playShoot('meteora'); // Heavy explosive cannon sound for Ibis
        player.cooldowns[cooldownRef] = config.cooldown;
    }

    // 🛡️ MOBILE & SUPPORT TRIGGERS (Grasshopper, Teleporter, Spider)
    else if (trigName === 'Grasshopper') {
        const maxRadius = 120;
        const wm = getWorldMouse();
        const dx = wm.x - player.x;
        const dy = wm.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let padX = wm.x;
        let padY = wm.y;
        if (dist > maxRadius) {
            padX = player.x + (dx / dist) * maxRadius;
            padY = player.y + (dy / dist) * maxRadius;
        }

        grPads.push(new window.GrasshopperPad(padX, padY, 'player'));
        window.audio.playGrasshopper();
        player.cooldowns[cooldownRef] = config.cooldown;
    }
    else if (trigName === 'Teleporter') {
        const maxRadius = 200;
        const wm = getWorldMouse();
        const dx = wm.x - player.x;
        const dy = wm.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let destX = wm.x;
        let destY = wm.y;
        if (dist > maxRadius) {
            destX = player.x + (dx / dist) * maxRadius;
            destY = player.y + (dy / dist) * maxRadius;
        }

        if (!arena.isWall(destX, destY)) {
            spawnSparks(player.x, player.y, '#0084ff', 20);

            player.x = destX;
            player.y = destY;

            spawnSparks(player.x, player.y, '#0084ff', 20);
            window.audio.playTeleport();

            player.cooldowns[cooldownRef] = config.cooldown;
        } else {
            player.trion += config.trionCost; // Refund cost
            addLog("[WARNING] Teleport coordinates must be inside empty walkable grid space!", "system");
        }
    }
    else if (trigName === 'Spider') {
        const wm = getWorldMouse();
        const worldMX = wm.x;
        const worldMY = wm.y;

        // Check if placement is within 280px radius of player
        const distFromPlayer = Math.sqrt((player.x - worldMX) ** 2 + (player.y - worldMY) ** 2);
        if (distFromPlayer > 280) {
            player.trion += config.trionCost; // Refund cost
            spiderAnchor = null;
            addLog("[WARNING] Spider wire must be placed within 280px of your character!", "system");
            return;
        }

        if (!spiderAnchor) {
            spiderAnchor = { x: worldMX, y: worldMY };
            player.trion += config.trionCost; // First click sets anchor: refund cost
            addLog("[TACTICAL] Spider Web anchor 1 locked. Click anywhere within 280px to anchor connecting tripwire...", "system");
        } else {
            const dist = Math.sqrt((spiderAnchor.x - worldMX) ** 2 + (spiderAnchor.y - worldMY) ** 2);
            if (dist <= 240) {
                // Connect anywhere successfully! Call addSpiderWeb on arena
                arena.addSpiderWeb(spiderAnchor.x, spiderAnchor.y, worldMX, worldMY, 'player');
                addLog("[TACTICAL] Tripwire anchored successfully!", "system");
                window.audio.playShieldBlock();
                spiderAnchor = null;
                player.cooldowns[cooldownRef] = config.cooldown;
            } else {
                spiderAnchor = null;
                player.trion += config.trionCost; // Refund cost on range failure
                addLog("[WARNING] Spider wire anchors too far apart! Max connection range is 240px.", "system");
            }
        }
    }
}

// Blade slash math geometry colliders checking
function performBladeSlash(damage, range, color, isGenyo = false, isSenku = false) {
    const hasDualKogetsu = player.briefcase.main[player.activeMainIndex] === 'Kogetsu' && player.briefcase.sub[player.activeSubIndex] === 'Kogetsu';
    let finalDamage = damage;
    if (hasDualKogetsu) {
        finalDamage = Math.floor(finalDamage * 1.25);
    }

    // Generate slice arc particle
    const slashArc = {
        type: 'slash',
        x: player.x,
        y: player.y,
        angle: player.angle,
        color: color,
        life: 10,
        maxLife: 10,
        range: isSenku ? 160 : range
    };
    particles.push(slashArc);

    // Resolve damage sweeps on visible targets
    for (const agent of allAgents) {
        if (agent.id === 'player' || agent.bailedOut) continue;

        const dx = agent.x - player.x;
        const dy = agent.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= slashArc.range + agent.radius) {
            const targetAngle = Math.atan2(dy, dx);
            let angleDiff = targetAngle - player.angle;
            // Normalize
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

            // Slash arc width (approx 80 degrees sweep)
            const slashSweep = (80 * Math.PI) / 180;
            if (Math.abs(angleDiff) <= slashSweep / 2) {
                const wasBailed = agent.bailedOut;
                // Genyo option ignores frontal shield vectors
                if (isGenyo) {
                    agent.takeDamage(finalDamage, 'player', false);
                    addLog(`[HIT] Genyo curves blade bypassing ${agent.name} Shield!`, 'system');
                } else {
                    agent.takeDamage(finalDamage, 'player', false);
                    addLog(`[HIT] Slashed target ${agent.name}!`, 'system');
                }
                spawnSparks(agent.x, agent.y, '#39ff14', 12);
            }
        }
    }

    // Cut enemy spider webs that intersect the slash arc
    cutSpiderWebsInArc(player, slashArc.range);
}

function performMoleClawStrike(damage) {
    // Left click location in world coordinates
    const wm = getWorldMouse();
    const strikeX = wm.x;
    const strikeY = wm.y;
    const maxRadius = 160;

    const dx = strikeX - player.x;
    const dy = strikeY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= maxRadius) {
        // Spawns vertical scorpion blade spikes
        particles.push({
            type: 'claw',
            x: strikeX,
            y: strikeY,
            color: '#ff3b30',
            life: 15,
            maxLife: 15
        });

        // Damage target at coordinate
        for (const agent of allAgents) {
            if (agent.bailedOut) continue;
            const targetDist = Math.sqrt((agent.x - strikeX) ** 2 + (agent.y - strikeY) ** 2);
            if (targetDist < agent.radius + 15) {
                const wasBailed = agent.bailedOut;
                agent.takeDamage(damage, 'player', false);
                addLog(`[HIT] Mole Claw spikes pierce ${agent.name} from the ground!`, 'system');
                spawnSparks(agent.x, agent.y, '#ff3b30', 10);
            }
        }
        return true;
    } else {
        addLog("[WARNING] Target is out of range for Mole Claw! Max radius: 160px.", "system");
        return false;
    }
}

// Viper customizable path functions
function fireViperWaypoints(side = 'main') {
    const viperConfig = window.TRIGGER_CATALOG["Viper"];
    if (tempViperWaypoints.length < 2) {
        if (player.trion < viperConfig.trionCost) {
            addLog("[ERROR] Insufficient Trion reserves to deploy Viper!", "system");
            tempViperWaypoints = [];
            return;
        }
        player.trion -= viperConfig.trionCost;
        fireViperZigzag(side);
        tempViperWaypoints = [];
        return;
    }

    // Deduct base Viper trion cost exactly once on launch
    if (player.trion < viperConfig.trionCost) {
        addLog("[ERROR] Insufficient Trion reserves to deploy Viper waypoints!", "system");
        tempViperWaypoints = [];
        return;
    }
    player.trion -= viperConfig.trionCost;

    // Shoot 5 Viper bullets along the drawn waypoints sequentially
    window.audio.playShoot('viper');
    const delay = 100;

    const isMain = side === 'main';
    const oppositeSide = isMain ? 'sub' : 'main';
    const hasOppositeLead = player.briefcase[oppositeSide].includes('Lead Bullet');
    const activeMainTrig = player.briefcase.main[player.activeMainIndex];
    const activeSubTrig = player.briefcase.sub[player.activeSubIndex];
    const leadActive = hasOppositeLead && (keys['SHIFT'] || (isMain ? (activeSubTrig === 'Lead Bullet') : (activeMainTrig === 'Lead Bullet')));

    // Cost check for all 5 bullets
    let extraCost = leadActive ? 40 : 0;

    // Auto-detect dual-wielding to fire double streams
    const isDualShooter = (activeMainTrig === activeSubTrig);
    const fireDouble = isDualShooter;

    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            if (!matchActive || player.bailedOut) return;
            if (leadActive && player.trion < extraCost) return;
            if (leadActive) player.trion -= extraCost;

            if (fireDouble) {
                const ox = Math.cos(player.angle + Math.PI / 2) * 10;
                const oy = Math.sin(player.angle + Math.PI / 2) * 10;

                bullets.push(new window.Bullet(player.x + ox, player.y + oy, player.angle, {
                    type: 'viper',
                    damage: leadActive ? 0 : window.TRIGGER_CATALOG["Viper"].damage,
                    speed: window.TRIGGER_CATALOG["Viper"].speed,
                    ownerId: 'player',
                    waypoints: tempViperWaypoints.map(wp => ({ x: wp.x + ox, y: wp.y + oy })),
                    isLeadBullet: leadActive,
                    color: leadActive ? '#121212' : '#ffc107',
                    size: leadActive ? 12 : 8
                }));

                bullets.push(new window.Bullet(player.x - ox, player.y - oy, player.angle, {
                    type: 'viper',
                    damage: leadActive ? 0 : window.TRIGGER_CATALOG["Viper"].damage,
                    speed: window.TRIGGER_CATALOG["Viper"].speed,
                    ownerId: 'player',
                    waypoints: tempViperWaypoints.map(wp => ({ x: wp.x - ox, y: wp.y - oy })),
                    isLeadBullet: leadActive,
                    color: leadActive ? '#121212' : '#ffc107',
                    size: leadActive ? 12 : 8
                }));
            } else {
                bullets.push(new window.Bullet(player.x, player.y, player.angle, {
                    type: 'viper',
                    damage: leadActive ? 0 : window.TRIGGER_CATALOG["Viper"].damage,
                    speed: window.TRIGGER_CATALOG["Viper"].speed,
                    ownerId: 'player',
                    waypoints: tempViperWaypoints,
                    isLeadBullet: leadActive,
                    color: leadActive ? '#121212' : '#ffc107',
                    size: leadActive ? 12 : 8
                }));
            }
        }, i * delay);
    }

    tempViperWaypoints = [];
}

function fireViperZigzag(side = 'main') {
    window.audio.playShoot('viper');

    const isMain = side === 'main';
    const oppositeSide = isMain ? 'sub' : 'main';
    const hasOppositeLead = player.briefcase[oppositeSide].includes('Lead Bullet');
    const activeMainTrig = player.briefcase.main[player.activeMainIndex];
    const activeSubTrig = player.briefcase.sub[player.activeSubIndex];
    const leadActive = hasOppositeLead && (keys['SHIFT'] || (isMain ? (activeSubTrig === 'Lead Bullet') : (activeMainTrig === 'Lead Bullet')));
    let extraCost = leadActive ? 40 : 0;

    // Auto-detect dual-wielding to fire double streams
    const isDualShooter = (activeMainTrig === activeSubTrig);
    const fireDouble = isDualShooter;

    // Programmatic Viper curving trajectories with high shape variety
    let wps = [];
    const patternChoice = Math.floor(Math.random() * 4);
    if (patternChoice === 0) {
        // S-Curve
        const p1 = { x: player.x + Math.cos(player.angle - 0.6) * 90, y: player.y + Math.sin(player.angle - 0.6) * 90 };
        const p2 = { x: player.x + Math.cos(player.angle + 0.6) * 180, y: player.y + Math.sin(player.angle + 0.6) * 180 };
        const p3 = { x: player.x + Math.cos(player.angle) * 350, y: player.y + Math.sin(player.angle) * 350 };
        wps = [p1, p2, p3];
    } else if (patternChoice === 1) {
        // Wide Hook (sweeps out to flank the target's shield)
        const p1 = { x: player.x + Math.cos(player.angle + 0.85) * 110, y: player.y + Math.sin(player.angle + 0.85) * 110 };
        const p2 = { x: player.x + Math.cos(player.angle + 0.3) * 220, y: player.y + Math.sin(player.angle + 0.3) * 220 };
        const p3 = { x: player.x + Math.cos(player.angle) * 350, y: player.y + Math.sin(player.angle) * 350 };
        wps = [p1, p2, p3];
    } else if (patternChoice === 2) {
        // Deep loop
        const p1 = { x: player.x + Math.cos(player.angle - 0.85) * 110, y: player.y + Math.sin(player.angle - 0.85) * 110 };
        const p2 = { x: player.x + Math.cos(player.angle - 0.3) * 220, y: player.y + Math.sin(player.angle - 0.3) * 220 };
        const p3 = { x: player.x + Math.cos(player.angle) * 350, y: player.y + Math.sin(player.angle) * 350 };
        wps = [p1, p2, p3];
    } else {
        // Double sharp zigzag
        const p1 = { x: player.x + Math.cos(player.angle - 0.7) * 80, y: player.y + Math.sin(player.angle - 0.7) * 80 };
        const p2 = { x: player.x + Math.cos(player.angle + 0.7) * 160, y: player.y + Math.sin(player.angle + 0.7) * 160 };
        const p3 = { x: player.x + Math.cos(player.angle - 0.4) * 250, y: player.y + Math.sin(player.angle - 0.4) * 250 };
        const p4 = { x: player.x + Math.cos(player.angle) * 350, y: player.y + Math.sin(player.angle) * 350 };
        wps = [p1, p2, p3, p4];
    }

    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            if (!matchActive || player.bailedOut) return;
            if (leadActive && player.trion < extraCost) return;
            if (leadActive) player.trion -= extraCost;

            if (fireDouble) {
                const ox = Math.cos(player.angle + Math.PI / 2) * 10;
                const oy = Math.sin(player.angle + Math.PI / 2) * 10;

                bullets.push(new window.Bullet(player.x + ox, player.y + oy, player.angle, {
                    type: 'viper',
                    damage: leadActive ? 0 : window.TRIGGER_CATALOG["Viper"].damage,
                    speed: window.TRIGGER_CATALOG["Viper"].speed,
                    ownerId: 'player',
                    waypoints: wps.map(wp => ({ x: wp.x + ox, y: wp.y + oy })),
                    isLeadBullet: leadActive,
                    color: leadActive ? '#121212' : '#ffc107',
                    size: leadActive ? 12 : 8
                }));

                bullets.push(new window.Bullet(player.x - ox, player.y - oy, player.angle, {
                    type: 'viper',
                    damage: leadActive ? 0 : window.TRIGGER_CATALOG["Viper"].damage,
                    speed: window.TRIGGER_CATALOG["Viper"].speed,
                    ownerId: 'player',
                    waypoints: wps.map(wp => ({ x: wp.x - ox, y: wp.y - oy })),
                    isLeadBullet: leadActive,
                    color: leadActive ? '#121212' : '#ffc107',
                    size: leadActive ? 12 : 8
                }));
            } else {
                bullets.push(new window.Bullet(player.x, player.y, player.angle, {
                    type: 'viper',
                    damage: leadActive ? 0 : window.TRIGGER_CATALOG["Viper"].damage,
                    speed: window.TRIGGER_CATALOG["Viper"].speed,
                    ownerId: 'player',
                    waypoints: wps,
                    isLeadBullet: leadActive,
                    color: leadActive ? '#121212' : '#ffc107',
                    size: leadActive ? 12 : 8
                }));
            }
        }, i * 120);
    }
}

// Spacebar Composite Fusion
function executeCompositeFusion() {
    if (player.isChameleonActive) return; // Chameleon locks slots and blocks composite fusions!

    const leftTrig = player.briefcase.main[player.activeMainIndex];
    const rightTrig = player.briefcase.sub[player.activeSubIndex];

    let fusionType = null;
    let trionCost = 0;

    if (leftTrig === 'Asteroid' && rightTrig === 'Asteroid') {
        fusionType = 'gimlet';
        trionCost = 60;
    } else if ((leftTrig === 'Asteroid' && rightTrig === 'Meteora') || (leftTrig === 'Meteora' && rightTrig === 'Asteroid')) {
        fusionType = 'tomahawk';
        trionCost = 100;
    } else if ((leftTrig === 'Hound' && rightTrig === 'Meteora') || (leftTrig === 'Meteora' && rightTrig === 'Hound')) {
        fusionType = 'salamander';
        trionCost = 90;
    } else if ((leftTrig === 'Asteroid' && rightTrig === 'Viper') || (leftTrig === 'Viper' && rightTrig === 'Asteroid')) {
        fusionType = 'cobra';
        trionCost = 70;
    } else if (leftTrig === 'Hound' && rightTrig === 'Hound') {
        fusionType = 'hornet';
        trionCost = 80;
    } else if (leftTrig === 'Viper' && rightTrig === 'Viper') {
        // fusionType = 'striker';
        // trionCost = 80;
    }

    if (!fusionType) {
        addLog("[WARNING] No valid composite fusion combination equipped/selected! Combinations: Asteroid+Asteroid (Gimlet), Asteroid+Meteora (Tomahawk), Hound+Meteora (Salamander), Asteroid+Viper (Cobra), Hound+Hound (Hornet)", "system");
        return;
    }

    if (player.trion < trionCost) {
        addLog(`[ERROR] Insufficient Trion to execute Composite Fusion (${trionCost} Trion required)!`, "system");
        return;
    }

    player.trion -= trionCost;

    if (fusionType === 'gimlet') {
        window.audio.playShoot('meteora');
        bullets.push(new window.Bullet(player.x, player.y, player.angle, {
            type: 'gimlet',
            damage: 360,
            speed: 13,
            ownerId: 'player',
            color: '#ffd700',
            size: 14,
            isComposite: true
        }));
        addLog("[TACTICAL] COMPOSITE FUSION: Gimlet shield-piercing bullet deployed!", "system");
    }
    else if (fusionType === 'tomahawk') {
        window.audio.playShoot('meteora');
        // If the player drew Viper waypoints, Tomahawk curves along them! Otherwise homing tracks.
        const wps = (tempViperWaypoints && tempViperWaypoints.length >= 2) ? [...tempViperWaypoints] : null;
        bullets.push(new window.Bullet(player.x, player.y, player.angle, {
            type: 'tomahawk',
            damage: 400,
            speed: 8,
            ownerId: 'player',
            waypoints: wps,
            color: '#ff5722',
            size: 15,
            isComposite: true
        }));
        addLog(wps ? "[TACTICAL] COMPOSITE FUSION: Tomahawk Waypoint-guided Explosive deployed!" : "[TACTICAL] COMPOSITE FUSION: Tomahawk Homing Explosive deployed!", "system");
        tempViperWaypoints = [];
    }
    else if (fusionType === 'salamander') {
        window.audio.playShoot('meteora');
        bullets.push(new window.Bullet(player.x, player.y, player.angle, {
            type: 'salamander',
            damage: 380,
            speed: 12,
            ownerId: 'player',
            color: '#ff9800',
            size: 13,
            isComposite: true
        }));
        addLog("[TACTICAL] COMPOSITE FUSION: Salamander Homing Homing-Explosive deployed!", "system");
    }
    else if (fusionType === 'hornet') {
        addLog("[TACTICAL] COMPOSITE FUSION: Hornet sequential accelerating homing swarm deployed!", "system");
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (!matchActive || player.bailedOut) return;
                bullets.push(new window.Bullet(player.x, player.y, player.angle + (Math.random() - 0.5) * 0.25, {
                    type: 'hornet',
                    damage: 180,
                    speed: 9,
                    ownerId: 'player',
                    color: '#bd00ff',
                    size: 8,
                    isComposite: true
                }));
                window.audio.playShoot('hound');
            }, i * 100);
        }
    }
    else if (fusionType === 'cobra') {
        addLog("[TACTICAL] COMPOSITE FUSION: Cobra snake zigzag bullet deployed!", "system");
        const angle = player.angle;
        const p1 = { x: player.x + Math.cos(angle - 0.4) * 100, y: player.y + Math.sin(angle - 0.4) * 100 };
        const p2 = { x: player.x + Math.cos(angle + 0.4) * 200, y: player.y + Math.sin(angle + 0.4) * 200 };
        const p3 = { x: player.x + Math.cos(angle - 0.2) * 300, y: player.y + Math.sin(angle - 0.2) * 300 };
        const p4 = { x: player.x + Math.cos(angle) * 450, y: player.y + Math.sin(angle) * 450 };
        const wps = [p1, p2, p3, p4];

        for (let i = 0; i < 4; i++) {
            setTimeout(() => {
                if (!matchActive || player.bailedOut) return;
                bullets.push(new window.Bullet(player.x, player.y, player.angle, {
                    type: 'cobra',
                    damage: 320,
                    speed: 11,
                    ownerId: 'player',
                    waypoints: wps,
                    color: '#00e5ff',
                    size: 10,
                    isComposite: true
                }));
                window.audio.playShoot('viper');
            }, i * 120);
        }
    }
    else if (fusionType === 'striker') {
        addLog("[TACTICAL] COMPOSITE FUSION: Striker extreme high-speed zigzag sweeps deployed!", "system");
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (!matchActive || player.bailedOut) return;
                bullets.push(new window.Bullet(player.x, player.y, player.angle, {
                    type: 'striker',
                    damage: 280,
                    speed: 16,
                    ownerId: 'player',
                    color: '#e040fb',
                    size: 9,
                    isComposite: true
                }));
                window.audio.playShoot('viper');
            }, i * 100);
        }
    }

    player.cooldowns.main = 1500;
    player.cooldowns.sub = 1500;
}

/* ==========================================================================
   ENTITIES UPDATE LOOPS (Bullets, AI, Wires, Pads)
   ========================================================================== */

function updateProjectilesAndInteractives() {
    // 1. Bullets Update
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.update(arena, allAgents);

        // Bounding circle intersection on active combatants
        for (const agent of allAgents) {
            if (agent.bailedOut || agent.id === b.ownerId) continue;

            const dx = agent.x - b.x;
            const dy = agent.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < agent.radius + b.size / 2) {
                // Impact Resolution
                const wasBailed = agent.bailedOut;
                if (b.type === 'meteora' || b.type === 'tomahawk' || b.type === 'salamander') {
                    b.triggerExplosion(arena, allAgents);
                } else {
                    agent.takeDamage(b.damage, b.ownerId, b.isLeadBullet, b.type);
                }
                b.life = 0; // Destroy projectile
                break;
            }
        }

        if (b.life <= 0) {
            bullets.splice(i, 1);
        }
    }

    // 2. Grasshopper pads bounce check
    for (let i = grPads.length - 1; i >= 0; i--) {
        const p = grPads[i];
        p.update(allAgents);
        if (p.life <= 0) {
            grPads.splice(i, 1);
        }
    }

    // 3. Spider tripwire slows checks
    for (const web of arena.spiderWebs) {
        for (const agent of allAgents) {
            // Speed penalty only applies to rivals of owner
            if (agent.id === web.ownerId || agent.bailedOut) continue;

            const dist = pointToLineDistance(agent.x, agent.y, web.x1, web.y1, web.x2, web.y2);
            if (dist < agent.radius + 3) {
                // Tripwire crossed! Cut speed
                agent.isWeighted = true;
                agent.weightStacks = 2; // slow stack
                // Trigger small alert log once
                if (Math.random() > 0.985) {
                    addLog(`[TACTICAL] Spider Wire tripped, slowing ${agent.name}!`, 'system');
                }
            }
        }
    }
}

function updateAIAgents() {
    allAgents.forEach(agent => {
        if (agent.id === 'player') return;

        agent.update(arena, allAgents, bullets, grPads, addLog);
    });
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life--;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

/* ==========================================================================
   COLLISIONS GEOMETRIC HELPER MATHS
   ========================================================================== */

function pointToLineDistance(x, y, x1, y1, x2, y2) {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

function spawnSparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            type: 'spark',
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            color: color,
            size: Math.random() * 3 + 1,
            life: 20 + Math.random() * 20
        });
    }
}

/* ==========================================================================
   EVENT LOGGING & STATS FEED
   ========================================================================== */

function addLog(message, type = 'system') {
    const container = document.getElementById('game-logs');
    if (!container) return;

    const msg = document.createElement('div');
    msg.className = `log-message ${type}`;
    msg.textContent = message;
    container.appendChild(msg);

    // Keep scrolled to bottom
    container.scrollTop = container.scrollHeight;
}

// Bailed out event execution
function triggerBailOut(agentId, reason) {
    const agent = allAgents.find(a => a.id === agentId);
    if (!agent || agent.bailedOut) return;

    // Mark agent as bailed out so they are truly eliminated
    agent.bailedOut = true;

    window.audio.playBailOut();
    addLog(`[BAIL OUT] ${agent.name.toUpperCase()} has bailed out! [Reason: ${reason}]`, 'bailout');

    // Spawn green digital cubes blocks crumbling effect
    for (let i = 0; i < 35; i++) {
        particles.push({
            type: 'digital',
            x: agent.x,
            y: agent.y,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 5 - 1, // float up
            color: '#39ff14',
            size: Math.random() * 6 + 3,
            life: 40 + Math.random() * 40
        });
    }

    // Award point to whoever defeated him
    let winner = 'System';
    let killerId = 'system';
    let credited = false;

    // Check if there was a recent direct attacker (within 8 seconds)
    const recentAttackerLimit = 8000; // ms
    if (agent.lastAttackerId) {
        const timePassed = Date.now() - agent.lastAttackTime;
        if (timePassed < recentAttackerLimit) {
            const attacker = allAgents.find(a => a.id === agent.lastAttackerId);
            if (attacker && !attacker.bailedOut) {
                winner = attacker.name;
                killerId = attacker.id;
                credited = true;
            }
        }
    }

    if (!credited) {
        // Fallback: Find closest other agent who is still alive
        let minD = 99999;
        for (const a of allAgents) {
            if (a.id === agentId || a.bailedOut) continue;
            const d = Math.sqrt((a.x - agent.x) ** 2 + (a.y - agent.y) ** 2);
            if (d < minD) {
                minD = d;
                winner = a.name;
                killerId = a.id;
            }
        }
    }

    if (!scoreBoard[killerId]) {
        scoreBoard[killerId] = 0;
    }
    scoreBoard[killerId]++;
    addLog(`[SCORE] ${winner} awarded +1 Point!`, 'system');
}

/* ==========================================================================
   CANVAS GRAPHICS RENDERING ENGINE
   ========================================================================== */

function renderArenaCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (player && cameraZoom !== 1.0) {
        // Zoom centered on the player
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(cameraZoom, cameraZoom);
        ctx.translate(-player.x, -player.y);
    } else {
        // Standard clamped camera view
        ctx.translate(-camera.x, -camera.y);
    }

    // 1. Draw floor grids map tiles
    arena.draw(ctx);

    // 2. Draw Grasshopper Pads
    grPads.forEach(p => p.draw(ctx));

    // 3. Draw active waypoints drawn for Viper in real-time
    if (isDrawingViper && tempViperWaypoints.length > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 223, 0, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(tempViperWaypoints[0].x, tempViperWaypoints[0].y);
        for (let i = 1; i < tempViperWaypoints.length; i++) {
            ctx.lineTo(tempViperWaypoints[i].x, tempViperWaypoints[i].y);
        }
        ctx.stroke();
        ctx.restore();

        // Check and track dragging mouse points
        if (tempViperWaypoints.length < 50) { // Limit waypoint complexity
            const wm = getWorldMouse();
            tempViperWaypoints.push({ x: wm.x, y: wm.y });
        }
    }

    // 4. Draw Spider Anchor placement preview
    if (spiderAnchor) {
        ctx.save();
        ctx.strokeStyle = 'rgba(189, 0, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(spiderAnchor.x, spiderAnchor.y);
        const wm = getWorldMouse();
        ctx.lineTo(wm.x, wm.y);
        ctx.stroke();
        ctx.restore();
    }

    // Draw Spider placement limit circle when Spider is active
    if (player && !player.bailedOut) {
        const activeMain = player.briefcase.main[player.activeMainIndex];
        const activeSub = player.briefcase.sub[player.activeSubIndex];
        if (activeMain === 'Spider' || activeSub === 'Spider') {
            ctx.save();
            ctx.strokeStyle = 'rgba(189, 0, 255, 0.22)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.arc(player.x, player.y, 280, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(189, 0, 255, 0.02)';
            ctx.fill();
            ctx.restore();
        }
    }

    // 5. Draw Projectiles Bullets
    bullets.forEach(b => b.draw(ctx));

    // 6. Draw AI Agents & Player
    allAgents.forEach(agent => {
        if (agent.id === 'player') {
            // Draw main player manually
            drawPlayerCharacter();
        } else {
            agent.draw(ctx);
        }
    });

    // 7. Draw Visual Action Particles
    renderParticles();

    ctx.restore();
}

function drawPlayerCharacter() {
    if (player.bailedOut) return;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Chameleon active opacity scale
    ctx.globalAlpha = player.isChameleonActive ? 0.08 : 1.0;

    // Outer cyber glowing aura
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = '#141e24';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // DRAW CHIBI AVATAR ON CANVAS
    if (window.agentImages && window.agentImages[selectedAgent]) {
        const img = window.agentImages[selectedAgent];
        if (img.complete) {
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.beginPath();
            ctx.arc(0, 0, player.radius - 2.5, 0, Math.PI * 2);
            ctx.clip();
            ctx.rotate(-player.angle); // Rotate back so chibi face remains upright
            ctx.drawImage(img, -player.radius, -player.radius, player.radius * 2, player.radius * 2);
            ctx.restore();
        }
    }

    // Direction arrow nose
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(player.radius, -5);
    ctx.lineTo(player.radius + 8, 0);
    ctx.lineTo(player.radius, 5);
    ctx.closePath();
    ctx.fill();

    // Draw active green/cyan Shield arc if blocking
    const hasShieldMain = player.briefcase.main[player.activeMainIndex] === 'Shield';
    const hasShieldSub = player.briefcase.sub[player.activeSubIndex] === 'Shield';
    const bothAreShield = hasShieldMain && hasShieldSub;

    let mainShieldActiveDraw = false;
    let subShieldActiveDraw = false;

    if (bothAreShield) {
        const eitherPressed = isLeftMouseDown || isRightMouseDown;
        mainShieldActiveDraw = !player.isChameleonActive && eitherPressed && player.trion > 0;
        subShieldActiveDraw = !player.isChameleonActive && eitherPressed && player.trion > 0;
    } else {
        mainShieldActiveDraw = !player.isChameleonActive && (hasShieldMain && isLeftMouseDown) && player.trion > 0;
        subShieldActiveDraw = !player.isChameleonActive && (hasShieldSub && isRightMouseDown) && player.trion > 0;
    }

    if (mainShieldActiveDraw || subShieldActiveDraw) {
        ctx.save();
        const isFull = mainShieldActiveDraw && subShieldActiveDraw;
        ctx.strokeStyle = 'rgba(57, 255, 20, 0.85)';
        ctx.lineWidth = 5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#39ff14';

        const currentShieldAngle = isFull ? 360 : 90;
        const shieldRad = (currentShieldAngle * Math.PI) / 360; // half angle bounds
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 8, -shieldRad, shieldRad);
        ctx.stroke();
        ctx.restore();
    }

    // Draw stacked weights indicators if slowed by Lead Bullet or Wires
    if (player.isWeighted) {
        ctx.save();
        ctx.fillStyle = '#121212';
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        for (let i = 0; i < player.weightStacks; i++) {
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

    // Player name floating text and HP bar
    if (!player.isChameleonActive) {
        ctx.save();
        // 1. Draw name and numeric Trion
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 9px monospace';
        ctx.textAlign = 'center';
        const trionVal = Math.max(0, Math.floor(player.trion));
        ctx.fillText(`${player.name.toUpperCase()} [${trionVal}/${player.trionMax}]`, player.x, player.y - 25);

        // 2. Draw mini bars (HP Cyan & Trion Green)
        const barWidth = 40;
        const barHeight = 3;
        const barX = player.x - barWidth / 2;

        // HP Bar (Cyan)
        const barY1 = player.y - 38;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX, barY1, barWidth, barHeight);
        const hpFillWidth = Math.max(0, Math.min(1, player.bodyHp / player.bodyHpMax)) * barWidth;
        ctx.fillStyle = '#00f0ff'; // HP Cyan
        ctx.fillRect(barX, barY1, hpFillWidth, barHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, barY1, barWidth, barHeight);

        // Trion Bar (Green)
        const barY2 = player.y - 33;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX, barY2, barWidth, barHeight);
        const trionFillWidth = Math.max(0, Math.min(1, player.trion / player.trionMax)) * barWidth;
        ctx.fillStyle = '#39ff14'; // Trion Green
        ctx.fillRect(barX, barY2, trionFillWidth, barHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, barY2, barWidth, barHeight);

        ctx.restore();
    }
}

function renderParticles() {
    ctx.save();
    for (const p of particles) {
        if (p.type === 'spark') {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            p.x += p.vx;
            p.y += p.vy;
        }
        else if (p.type === 'laser') {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.min(4, p.life);
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.moveTo(p.x1, p.y1);
            ctx.lineTo(p.x2, p.y2);
            ctx.stroke();
        }
        else if (p.type === 'slash') {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 4 * (p.life / p.maxLife);
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.color;

            ctx.beginPath();
            // Draw visual crescent blade slash sweep
            const angle = p.angle;
            const size = (80 * Math.PI) / 180;
            const startAngle = angle - size / 2;
            const endAngle = angle + size / 2;
            ctx.arc(p.x, p.y, p.range, startAngle, endAngle);
            ctx.stroke();
        }
        else if (p.type === 'claw') {
            // Mole Claw vertical grid strike spike
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 12;
            ctx.shadowColor = p.color;

            ctx.strokeRect(p.x - 15, p.y - 15, 30, 30);

            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 12);
            ctx.lineTo(p.x - 8, p.y + 8);
            ctx.lineTo(p.x + 8, p.y + 8);
            ctx.closePath();
            ctx.fill();
        }
        else if (p.type === 'digital') {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
        }
        else if (p.type === 'shockwave') {
            ctx.save();
            ctx.strokeStyle = p.color;
            const pct = (p.maxLife - p.life) / p.maxLife;
            ctx.lineWidth = 4 * (1 - pct);
            ctx.shadowBlur = 15;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.maxRadius * pct, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
    ctx.restore();
}

/* ==========================================================================
   TACTICAL RADAR RADIAL DRAWING
   ========================================================================== */

function renderTacticalRadar() {
    radarCtx.clearRect(0, 0, radarCanvas.width, radarCanvas.height);

    // Draw radar background circle grids
    const cx = radarCanvas.width / 2;
    const cy = radarCanvas.height / 2;
    const rMax = radarCanvas.width / 2 - 5;

    radarCtx.strokeStyle = 'rgba(57, 255, 20, 0.15)';
    radarCtx.lineWidth = 1.5;

    radarCtx.beginPath();
    radarCtx.arc(cx, cy, rMax, 0, Math.PI * 2);
    radarCtx.arc(cx, cy, rMax * 0.6, 0, Math.PI * 2);
    radarCtx.arc(cx, cy, rMax * 0.3, 0, Math.PI * 2);
    radarCtx.stroke();

    radarCtx.beginPath();
    radarCtx.moveTo(cx - rMax, cy);
    radarCtx.lineTo(cx + rMax, cy);
    radarCtx.moveTo(cx, cy - rMax);
    radarCtx.lineTo(cx, cy + rMax);
    radarCtx.stroke();

    // Map all coordinates ratio scaled to radar bounding circular area
    const scaleX = rMax / (arena.width / 2);
    const scaleY = rMax / (arena.height / 2);

    // Apply circular clipping for structural rendering inside the radar face
    radarCtx.save();
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, rMax, 0, Math.PI * 2);
    radarCtx.clip();

    // Draw dynamic background fill based on map type for a premium tactical theme
    if (arena.mapType === 'forest_mountain') {
        radarCtx.fillStyle = 'rgba(46, 125, 50, 0.06)';
    } else if (arena.mapType === 'training_room') {
        radarCtx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    } else if (arena.mapType === 'cybergrid') {
        radarCtx.fillStyle = 'rgba(0, 240, 255, 0.04)';
    } else {
        radarCtx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    }
    radarCtx.fillRect(cx - rMax, cy - rMax, rMax * 2, rMax * 2);

    // Draw the boundary lines of the actual walkable arena map
    radarCtx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    radarCtx.lineWidth = 1;
    radarCtx.strokeRect(cx - rMax, cy - rMax, rMax * 2, rMax * 2);

    // Loop through the 2D grid and render actual building block obstacles, mountains, and trees
    const tileW = arena.tileSize * scaleX;
    const tileH = arena.tileSize * scaleY;

    for (let r = 0; r < arena.rows; r++) {
        for (let c = 0; c < arena.cols; c++) {
            const tile = arena.grid[r][c];
            if (!tile || tile.type === 'empty') continue;

            const rx = (tile.x - arena.width / 2) * scaleX;
            const ry = (tile.y - arena.height / 2) * scaleY;
            const tx = cx + rx;
            const ty = cy + ry;

            if (tile.type === 'indestructible') {
                if (tile.isMountainRock) {
                    // Rocky Slate Mountain Ridge (brown/dark gray)
                    radarCtx.fillStyle = 'rgba(121, 85, 72, 0.45)';
                    radarCtx.strokeStyle = 'rgba(121, 85, 72, 0.65)';
                    radarCtx.lineWidth = 0.5;
                    radarCtx.fillRect(tx, ty, tileW, tileH);
                    radarCtx.strokeRect(tx, ty, tileW, tileH);
                } else {
                    // Outer border walls or structural columns (heavy dark gray with cyber outline)
                    radarCtx.fillStyle = 'rgba(52, 58, 64, 0.5)';
                    radarCtx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
                    radarCtx.lineWidth = 0.5;
                    radarCtx.fillRect(tx, ty, tileW, tileH);
                    radarCtx.strokeRect(tx, ty, tileW, tileH);
                }
            } else if (tile.type === 'destructible') {
                if (tile.isTree) {
                    // Tree (neon-tinted green circle)
                    radarCtx.fillStyle = 'rgba(57, 255, 20, 0.28)';
                    radarCtx.strokeStyle = 'rgba(57, 255, 20, 0.55)';
                    radarCtx.lineWidth = 0.5;
                    radarCtx.beginPath();
                    radarCtx.arc(tx + tileW / 2, ty + tileH / 2, Math.min(tileW, tileH) / 2 - 0.5, 0, Math.PI * 2);
                    radarCtx.fill();
                    radarCtx.stroke();
                } else {
                    // Destructible building block (cyan high-tech translucent structure)
                    const damageRatio = tile.hp / tile.maxHp;
                    // Colors adapt based on active block damage ratio
                    radarCtx.fillStyle = `rgba(${Math.floor(0 + (1 - damageRatio) * 150)}, 240, 255, 0.2)`;
                    radarCtx.strokeStyle = `rgba(0, 240, 255, ${0.35 * damageRatio})`;
                    radarCtx.lineWidth = 0.5;
                    radarCtx.fillRect(tx, ty, tileW, tileH);
                    radarCtx.strokeRect(tx, ty, tileW, tileH);
                }
            }
        }
    }

    // Render interactive Purple Spider Webs
    if (arena.spiderWebs && arena.spiderWebs.length > 0) {
        radarCtx.save();
        radarCtx.strokeStyle = 'rgba(189, 0, 255, 0.45)';
        radarCtx.lineWidth = 1.2;
        for (const web of arena.spiderWebs) {
            const rx1 = cx + (web.x1 - arena.width / 2) * scaleX;
            const ry1 = cy + (web.y1 - arena.height / 2) * scaleY;
            const rx2 = cx + (web.x2 - arena.width / 2) * scaleX;
            const ry2 = cy + (web.y2 - arena.height / 2) * scaleY;
            radarCtx.beginPath();
            radarCtx.moveTo(rx1, ry1);
            radarCtx.lineTo(rx2, ry2);
            radarCtx.stroke();
        }
        radarCtx.restore();
    }

    // Render interactive Grasshopper Jump Pads
    if (grPads && grPads.length > 0) {
        radarCtx.save();
        for (const pad of grPads) {
            const rx = cx + (pad.x - arena.width / 2) * scaleX;
            const ry = cy + (pad.y - arena.height / 2) * scaleY;
            const pSize = pad.size * Math.min(scaleX, scaleY);
            radarCtx.fillStyle = 'rgba(57, 255, 20, 0.55)';
            radarCtx.shadowBlur = 3;
            radarCtx.shadowColor = '#39ff14';
            radarCtx.fillRect(rx - pSize / 2, ry - pSize / 2, pSize, pSize);
        }
        radarCtx.restore();
    }

    // Render Competitors & Player with high-fidelity glowing dots and camouflage states
    allAgents.forEach(agent => {
        if (agent.bailedOut) return;

        // Chameleon and Bagworm triggers HIDE agents completely from tactical screens
        if (agent.id !== 'player') {
            if (agent.isChameleonActive) return;
            if (agent.isBagwormActive) {
                // Check if player has direct visual line of sight to this agent
                const ray = arena.raycast(player.x, player.y, agent.x, agent.y);
                if (ray.hit) {
                    // Line of sight blocked by wall! So Bagworm works, hide it
                    return;
                }
            }
        }

        const rx = (agent.x - arena.width / 2) * scaleX;
        const ry = (agent.y - arena.height / 2) * scaleY;
        const tx = cx + rx;
        const ty = cy + ry;

        radarCtx.save();

        if (agent.id === 'player') {
            if (player.isBagwormActive || player.isChameleonActive) {
                // Cloaked player: draw as faint, pulsing cyan outline circle for self-navigation feedback
                radarCtx.fillStyle = 'rgba(0, 240, 255, 0.12)';
                radarCtx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
                radarCtx.lineWidth = 1;
                radarCtx.setLineDash([2, 2]); // Dashed signature ring
                radarCtx.shadowBlur = 3;
                radarCtx.shadowColor = '#00f0ff';
                radarCtx.beginPath();
                radarCtx.arc(tx, ty, 5, 0, Math.PI * 2);
                radarCtx.fill();
                radarCtx.stroke();
            } else {
                // Active visible player: bright cyber-cyan dot
                radarCtx.fillStyle = '#00f0ff';
                radarCtx.shadowBlur = 10;
                radarCtx.shadowColor = '#00f0ff';
                radarCtx.beginPath();
                radarCtx.arc(tx, ty, 4.5, 0, Math.PI * 2);
                radarCtx.fill();
            }
        } else {
            // Enemy Competitor: glowing tactical red dot
            radarCtx.fillStyle = '#ff3b30';
            radarCtx.shadowBlur = 10;
            radarCtx.shadowColor = '#ff3b30';
            radarCtx.beginPath();
            radarCtx.arc(tx, ty, 4.2, 0, Math.PI * 2);
            radarCtx.fill();
        }
        radarCtx.restore();
    });

    radarCtx.restore(); // Restore context to discard boundary clipping path
}

/* ==========================================================================
   HUD STATUS CONTROLS
   ========================================================================== */

function renderHUDLabels() {
    // 1. HP and Trion Capacity Bars Double Sided filling
    const hpPct = player.bodyHp / player.bodyHpMax;
    document.getElementById('player-hp-bar').style.width = `${hpPct * 100}%`;
    document.getElementById('player-hp-val-hud').textContent = `${Math.floor(player.bodyHp)} / ${player.bodyHpMax}`;

    const pct = player.trion / player.trionMax;
    document.getElementById('player-trion-bar').style.width = `${pct * 100}%`;
    document.getElementById('player-trion-val-hud').textContent = `${Math.floor(player.trion)} / ${player.trionMax}`;

    // 2. Score text
    document.getElementById('player-score').textContent = scoreBoard['player'];

    // 3. Main Slot HUD Active Glow highlights
    const mainCards = document.querySelectorAll('#hud-main-slots .hud-slot-card');
    mainCards.forEach((card, idx) => {
        if (idx === player.activeMainIndex) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    // 4. Sub Slot HUD Active Glow highlights
    const subCards = document.querySelectorAll('#hud-sub-slots .hud-slot-card');
    subCards.forEach((card, idx) => {
        if (idx === player.activeSubIndex) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    // 5. Active Option Composite Bullet panel indicator glows
    const leftTrig = player.briefcase.main[player.activeMainIndex];
    const rightTrig = player.briefcase.sub[player.activeSubIndex];
    const compositePanel = document.getElementById('composite-indicator');

    let isCompositeCompatible = false;
    let descText = "Not Compatible";

    if (leftTrig === 'Asteroid' && rightTrig === 'Asteroid') {
        isCompositeCompatible = true;
        descText = "Asteroid + Asteroid = Gimlet";
    } else if ((leftTrig === 'Viper' && rightTrig === 'Meteora') || (leftTrig === 'Meteora' && rightTrig === 'Viper')) {
        isCompositeCompatible = true;
        descText = "Viper + Meteora = Tomahawk";
    } else if ((leftTrig === 'Asteroid' && rightTrig === 'Meteora') || (leftTrig === 'Meteora' && rightTrig === 'Asteroid')) {
        isCompositeCompatible = true;
        descText = "Asteroid + Meteora = Salamander";
    } else if (leftTrig === 'Hound' && rightTrig === 'Hound') {
        isCompositeCompatible = true;
        descText = "Hound + Hound = Hornet";
    } else if ((leftTrig === 'Asteroid' && rightTrig === 'Viper') || (leftTrig === 'Viper' && rightTrig === 'Asteroid')) {
        isCompositeCompatible = true;
        descText = "Asteroid + Viper = Cobra";
    }

    if (isCompositeCompatible) {
        compositePanel.classList.add('active');
        document.getElementById('composite-desc').textContent = descText;
    } else {
        compositePanel.classList.remove('active');
        document.getElementById('composite-desc').textContent = "Not Compatible";
    }

    // 6. Lead Bullet indicator status Shift
    const leadPanel = document.getElementById('lead-indicator');
    const isMainWeapon = ['Asteroid', 'Hound', 'Viper', 'Meteora', 'Assault Rifle', 'Shotgun', 'Egret', 'Lightning', 'Ibis'].includes(leftTrig);
    const isSubWeapon = ['Asteroid', 'Hound', 'Viper', 'Meteora', 'Assault Rifle', 'Shotgun', 'Egret', 'Lightning', 'Ibis'].includes(rightTrig);

    const hasSubLead = player.briefcase.sub.includes('Lead Bullet');
    const hasMainLead = player.briefcase.main.includes('Lead Bullet');

    const isLeadCompatible =
        (isMainWeapon && hasSubLead) ||
        (isSubWeapon && hasMainLead);

    const activeLead = isLeadCompatible && (
        keys['SHIFT'] ||
        (isMainWeapon && rightTrig === 'Lead Bullet') ||
        (isSubWeapon && leftTrig === 'Lead Bullet')
    );

    if (isLeadCompatible) {
        leadPanel.classList.add('active');
        if (activeLead) {
            document.getElementById('lead-desc').textContent = "LEAD INFUSION ACTIVE";
        } else {
            document.getElementById('lead-desc').textContent = "HOLD SHIFT / SELECT LEAD BULLET";
        }
    } else {
        leadPanel.classList.remove('active');
        document.getElementById('lead-desc').textContent = "Not Compatible";
    }
}

function renderScoreLeaderboard() {
    const list = document.getElementById('score-list');
    list.innerHTML = '';

    // Sort agents by scored points
    const sorted = [...allAgents].sort((a, b) => {
        const scoreA = scoreBoard[a.id] || 0;
        const scoreB = scoreBoard[b.id] || 0;
        return scoreB - scoreA;
    });

    sorted.forEach((agent, idx) => {
        const row = document.createElement('div');
        row.className = `score-row ${agent.id === 'player' ? 'active' : ''}`;

        let hpStatus = '';
        if (agent.bailedOut) {
            hpStatus = `<span class="hp-badge bailed-out">BAILED OUT</span>`;
        } else {
            const hpPct = Math.round((agent.bodyHp / agent.bodyHpMax) * 100);
            const trionPct = Math.round((agent.trion / agent.trionMax) * 100);
            const leakIndicator = agent.isLeaking ? `<span class="hp-badge leaking-pulse" style="background:#ff3b30; color:#fff; animation: flash 1s ease infinite alternate; margin-left:5px; font-size:0.65rem; padding:1px 3px; border-radius:2px; font-weight:700;">LEAKING</span>` : '';
            hpStatus = `<span class="hp-badge alive-hp" style="background:rgba(0, 240, 255, 0.15); color:var(--border-cyan); border: 1px solid var(--border-cyan); padding: 1px 3px; border-radius: 2px; font-size: 0.65rem; font-weight: 700; margin-left: 5px;">${hpPct}% HP</span><span class="hp-badge alive-trion" style="background:rgba(57, 255, 20, 0.15); color:var(--border-green); border: 1px solid var(--border-green); padding: 1px 3px; border-radius: 2px; font-size: 0.65rem; font-weight: 700; margin-left: 5px;">${trionPct}% TRION</span>${leakIndicator}`;
        }

        row.innerHTML = `
            <span class="rank">${idx + 1}</span>
            <span class="name" style="display: flex; align-items: center; flex-wrap: wrap;">${agent.name}${hpStatus}</span>
            <span class="score">${scoreBoard[agent.id] || 0} Pts</span>
        `;
        list.appendChild(row);
    });
}

/* ==========================================================================
   PAUSE AND MATCH END MECHANICS
   ========================================================================== */

function togglePause() {
    const screen = document.getElementById('pause-screen');
    if (screen.classList.contains('active')) {
        screen.classList.remove('active');
        matchActive = true;
        requestAnimationFrame(gameLoop);
    } else {
        screen.classList.add('active');
        matchActive = false;
    }
}

// Pause actions binders
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('pause-quit-btn').addEventListener('click', () => {
    document.getElementById('pause-screen').classList.remove('active');
    bailoutMatch();
});

document.getElementById('menu-btn').addEventListener('click', () => {
    togglePause();
});

function bailoutMatch() {
    matchActive = false;
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('lobby-screen').classList.add('active');
}

function endSimulationMatch() {
    matchActive = false;

    // 1. Calculate standings
    const sorted = [...allAgents].sort((a, b) => (scoreBoard[b.id] || 0) - (scoreBoard[a.id] || 0));

    // Determine player state and true winner
    const survivors = allAgents.filter(a => !a.bailedOut);
    let winnerAgent = null;

    if (survivors.length > 0) {
        // Winner is the survivor with the highest score
        const sortedSurvivors = [...survivors].sort((a, b) => (scoreBoard[b.id] || 0) - (scoreBoard[a.id] || 0));
        winnerAgent = sortedSurvivors[0];
    } else {
        // No survivors, winner is the highest-scoring AI agent
        const aiAgents = [...allAgents].filter(a => a.id !== 'player').sort((a, b) => (scoreBoard[b.id] || 0) - (scoreBoard[a.id] || 0));
        winnerAgent = aiAgents.length > 0 ? aiAgents[0] : sorted[0];
    }

    const isPlayerWinner = (!player.bailedOut) && (winnerAgent.id === 'player');
    const playerBailedOut = player.bailedOut;

    // 2. Update Overlay Elements
    const titleEl = document.getElementById('bailout-title');
    const flasherEl = document.getElementById('bailout-flasher');
    const boxEl = document.getElementById('bailout-container');

    let resultColor = "";
    let resultShadow = "";
    let resultBg = "";
    let titleText = "";
    let flasherText = "";

    if (isPlayerWinner) {
        resultColor = "var(--border-green)";
        resultShadow = "0 0 15px rgba(57, 255, 20, 0.6)";
        resultBg = "rgba(57, 255, 20, 0.15)";
        titleText = "VICTORY";
        flasherText = `WINNER: ${winnerAgent.name.toUpperCase()} (YOU) (${scoreBoard[winnerAgent.id] || 0} PTS)`;
    } else if (playerBailedOut) {
        resultColor = "#ff3b30"; // Red for bailout
        resultShadow = "0 0 15px rgba(255, 59, 48, 0.6)";
        resultBg = "rgba(255, 59, 48, 0.15)";
        titleText = "DEFEAT - BAILED OUT";
        flasherText = `WINNER: ${winnerAgent.name.toUpperCase()} (${scoreBoard[winnerAgent.id] || 0} PTS)`;
    } else {
        resultColor = "#ff9500"; // Orange for scoring defeat
        resultShadow = "0 0 15px rgba(255, 149, 0, 0.6)";
        resultBg = "rgba(255, 149, 0, 0.15)";
        titleText = "DEFEAT - OUTPOWERED";
        flasherText = `WINNER: ${winnerAgent.name.toUpperCase()} (${scoreBoard[winnerAgent.id] || 0} PTS)`;
    }

    if (titleEl) {
        titleEl.textContent = titleText;
        titleEl.style.color = resultColor;
        titleEl.style.textShadow = resultShadow;
    }

    // Flasher shows the winner!
    if (flasherEl) {
        flasherEl.textContent = flasherText;
        flasherEl.style.background = resultBg;
        flasherEl.style.color = resultColor;
    }

    if (boxEl) {
        boxEl.style.borderColor = resultColor;
        boxEl.style.boxShadow = `0 0 25px ${resultColor === 'var(--border-green)' ? 'rgba(57, 255, 20, 0.4)' : (resultColor === '#ff3b30' ? 'rgba(255, 59, 48, 0.4)' : 'rgba(255, 149, 0, 0.4)')}`;
    }

    // 3. Populate scoreboard list
    const scoreboardListEl = document.getElementById('final-scoreboard-list');
    if (scoreboardListEl) {
        scoreboardListEl.innerHTML = '';

        // Add header row for clarity
        const headerRow = document.createElement('div');
        headerRow.className = 'detail-row';
        headerRow.style.borderBottom = '1px solid rgba(255, 255, 255, 0.15)';
        headerRow.style.paddingBottom = '6px';
        headerRow.style.marginBottom = '8px';
        headerRow.style.fontWeight = '700';
        headerRow.style.color = 'var(--text-accent)';
        headerRow.style.fontFamily = 'var(--font-cyber)';
        headerRow.style.fontSize = '0.8rem';
        headerRow.innerHTML = `
            <span>COMPETITOR</span>
            <span>STATUS</span>
            <span>SCORE</span>
        `;
        scoreboardListEl.appendChild(headerRow);

        sorted.forEach((agent) => {
            const row = document.createElement('div');
            row.className = 'detail-row';
            row.style.padding = '6px 8px';
            row.style.margin = '2px 0';
            row.style.borderRadius = '4px';

            if (agent.id === 'player') {
                row.style.color = '#ffffff';
                row.style.fontWeight = '700';
                if (playerBailedOut) {
                    row.style.background = 'rgba(255, 59, 48, 0.1)';
                    row.style.border = '1px solid rgba(255, 59, 48, 0.2)';
                } else if (isPlayerWinner) {
                    row.style.background = 'rgba(57, 255, 20, 0.1)';
                    row.style.border = '1px solid rgba(57, 255, 20, 0.2)';
                } else {
                    row.style.background = 'rgba(255, 149, 0, 0.1)';
                    row.style.border = '1px solid rgba(255, 149, 0, 0.2)';
                }
            } else {
                row.style.background = 'rgba(255, 255, 255, 0.02)';
            }

            let statusText = '';
            let statusColor = '';
            if (agent.bailedOut) {
                statusText = 'BAILED OUT';
                statusColor = '#ff3b30';
            } else {
                const hpPct = Math.round((agent.bodyHp / agent.bodyHpMax) * 100);
                const trionPct = Math.round((agent.trion / agent.trionMax) * 100);
                statusText = `${hpPct}% HP | ${trionPct}% TRION`;
                statusColor = 'var(--border-green)';
            }

            let ptsColor = 'var(--text-primary)';
            if (agent.id === 'player') {
                if (playerBailedOut) ptsColor = '#ff3b30';
                else if (isPlayerWinner) ptsColor = 'var(--border-green)';
                else ptsColor = '#ff9500';
            }

            row.innerHTML = `
                <span style="display: flex; align-items: center; gap: 5px;">
                    ${agent.name} ${agent.id === 'player' ? `<span style="font-size:0.65rem; background:${playerBailedOut ? '#ff3b30' : (isPlayerWinner ? 'var(--border-green)' : '#ff9500')}; color:#000; padding:1px 3px; border-radius:2px; font-weight:900;">YOU</span>` : ''}
                </span>
                <span style="color: ${statusColor}; font-size: 0.8rem; font-family: var(--font-cyber); font-weight: 700;">${statusText}</span>
                <span style="font-family: var(--font-cyber); font-weight: 700; color: ${ptsColor}">${scoreBoard[agent.id] || 0} PTS</span>
            `;
            scoreboardListEl.appendChild(row);
        });
    }

    // Show Overlay
    document.getElementById('bailout-screen').classList.add('active');
}

// Overlays Buttons Binders
document.getElementById('retry-btn').addEventListener('click', () => {
    document.getElementById('bailout-screen').classList.remove('active');
    startSimulation();
});

document.getElementById('return-lobby-btn').addEventListener('click', () => {
    document.getElementById('bailout-screen').classList.remove('active');
    bailoutMatch();
});

// Run Setup on load
window.addEventListener('DOMContentLoaded', () => {
    initLobby();
});
