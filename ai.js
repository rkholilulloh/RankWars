/* ==========================================================================
   TACTICAL AI RIVAL SYSTEM - WORLD TRIGGER RANK WARS
   ========================================================================== */

// Preload character chibi images for both canvas drawing and UI overlays
window.agentImages = {
    yuma: new Image(),
    osamu: new Image(),
    chika: new Image(),
    hyuse: new Image(),
    custom: new Image()
};
// Preload character chibi images for both canvas drawing and UI overlays
window.agentImages = {
    yuma: new Image(),
    osamu: new Image(),
    chika: new Image(),
    hyuse: new Image(),
    custom: new Image(),
    arafune: new Image(),
    kakizaki: new Image(),
    murakami: new Image(),
    azuma: new Image(),
    ikoma: new Image(),
    katori: new Image(),
    nasu: new Image(),
    suwa: new Image(),
    kageura: new Image(),
    ninomiya: new Image(),
    yuba: new Image()
};
window.agentImages.yuma.src = 'chibi/Yuma.png';
window.agentImages.osamu.src = 'chibi/Osamu.png';
window.agentImages.chika.src = 'chibi/Chika.png';
window.agentImages.hyuse.src = 'chibi/Hyuse.png';
window.agentImages.custom.src = 'chibi/Kyosuke.png';
window.agentImages.arafune.src = 'chibi/Arafune.jpg';
window.agentImages.kakizaki.src = 'chibi/Kakizaki.jpg';
window.agentImages.murakami.src = 'chibi/Murakami.jpg';
window.agentImages.azuma.src = 'chibi/Azuma.jpg';
window.agentImages.ikoma.src = 'chibi/Ikoma.jpg';
window.agentImages.katori.src = 'chibi/Katori.jpg';
window.agentImages.nasu.src = 'chibi/Nasu.jpg';
window.agentImages.suwa.src = 'chibi/Suwa.jpg';
window.agentImages.kageura.src = 'chibi/Kageura.jpg';
window.agentImages.ninomiya.src = 'chibi/Ninomiya.jpg';
window.agentImages.yuba.src = 'chibi/Yuba.jpg';

class AIAgent {
    constructor(id, name, preset = 'yuma', difficulty = 'medium') {
        this.id = id;
        this.name = name;
        this.preset = preset;
        this.difficulty = difficulty;

        // Physical properties
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.radius = 18;
        this.angle = 0;
        this.speed = 3.5;

        // Trion Energy Capacity (scaled to match player presets, multiplied by trionBoostFactor)
        const boost = window.trionBoostFactor || 2.0;
        this.trionMax = (window.agentPresets && window.agentPresets[preset] ? window.agentPresets[preset].trion * 100 : 900) * boost;
        this.trion = this.trionMax;

        const hpBoost = window.hpBoostFactor || 1.0;
        this.bodyHpMax = 1000 * hpBoost;
        this.bodyHp = this.bodyHpMax;
        this.isLeaking = false;
        this.leakRate = 0;

        // Movement Debuffs (Lead Bullet stack counts)
        this.isWeighted = false;
        this.weightStacks = 0; // stack up to 3 times
        this.isDashing = false;
        this.dashTimer = 0;
        this.stunTimer = 0; // Stun timer for Gimlet stuns

        // Briefcase configuration (4 Main, 4 Sub)
        this.briefcase = {
            main: ["Empty", "Empty", "Empty", "Empty"],
            sub: ["Empty", "Empty", "Empty", "Empty"]
        };
        this.activeMain = 0;
        this.activeSub = 0;

        // Tactical flags
        this.isBagwormActive = false;
        this.isChameleonActive = false;
        this.isRaygustShieldActive = false;
        this.isShieldActive = false;

        // Timers & State Machine
        this.cooldowns = { main: 0, sub: 0 };
        this.state = 'patrol'; // patrol, chase, snipe, flee
        this.targetAgent = null;
        this.stateTimer = 0;

        // Shield tuning sizes (dynamic angle for AI shields)
        this.shieldAngle = 90; // degrees

        // Bail out state (agent is eliminated only when this is true)
        this.bailedOut = false;

        // Path waypoint
        this.patrolTarget = { x: 0, y: 0 };

        this.applyPreset(preset);
    }

    applyPreset(preset) {
        if (preset === 'yuma') {
            this.briefcase.main = ["Scorpion", "Shield", "Grasshopper", "Empty"];
            this.briefcase.sub = ["Scorpion", "Shield", "Grasshopper", "Bagworm"];
            this.speed = 4.2;
        }
        else if (preset === 'osamu') {
            this.briefcase.main = ["Raygust", "Asteroid", "Shield", "Empty"];
            this.briefcase.sub = ["Thruster", "Spider", "Shield", "Bagworm"];
            this.speed = 3.2;
        }
        else if (preset === 'chika') {
            this.briefcase.main = ["Ibis", "Egret", "Lightning", "Shield"];
            this.briefcase.sub = ["Hound", "Shield", "Bagworm", "Lead Bullet"];
            this.speed = 2.8;
        }
        else if (preset === 'hyuse') {
            this.briefcase.main = ["Kogetsu", "Asteroid", "Shield", "Empty"];
            this.briefcase.sub = ["Senku", "Viper", "Shield", "Bagworm"];
            this.speed = 3.6;
        }
        else if (preset === 'arafune') {
            this.briefcase.main = ["Egret", "Ibis", "Kogetsu", "Shield"];
            this.briefcase.sub = ["Lightning", "Senku", "Bagworm", "Shield"];
            this.speed = 3.6;
        }
        else if (preset === 'kakizaki') {
            this.briefcase.main = ["Assault Rifle", "Shield", "Empty", "Empty"];
            this.briefcase.sub = ["Hound", "Bagworm", "Shield", "Empty"];
            this.speed = 3.4;
        }
        else if (preset === 'murakami') {
            this.briefcase.main = ["Kogetsu", "Raygust", "Shield", "Empty"];
            this.briefcase.sub = ["Thruster", "Bagworm", "Shield", "Empty"];
            this.speed = 3.3;
        }
        else if (preset === 'azuma') {
            this.briefcase.main = ["Egret", "Ibis", "Shield", "Empty"];
            this.briefcase.sub = ["Lightning", "Bagworm", "Shield", "Empty"];
            this.speed = 3.2;
        }
        else if (preset === 'ikoma') {
            this.briefcase.main = ["Kogetsu", "Shield", "Empty", "Empty"];
            this.briefcase.sub = ["Senku", "Bagworm", "Shield", "Empty"];
            this.speed = 3.7;
        }
        else if (preset === 'katori') {
            this.briefcase.main = ["Scorpion", "Assault Rifle", "Shield", "Empty"];
            this.briefcase.sub = ["Grasshopper", "Bagworm", "Shield", "Empty"];
            this.speed = 4.0;
        }
        else if (preset === 'nasu') {
            this.briefcase.main = ["Viper", "Asteroid", "Shield", "Empty"];
            this.briefcase.sub = ["Viper", "Bagworm", "Shield", "Empty"];
            this.speed = 3.8;
        }
        else if (preset === 'suwa') {
            this.briefcase.main = ["Shotgun", "Shield", "Empty", "Empty"];
            this.briefcase.sub = ["Shotgun", "Bagworm", "Shield", "Empty"];
            this.speed = 3.0;
        }
        else if (preset === 'kageura') {
            this.briefcase.main = ["Scorpion", "Shield", "Empty", "Empty"];
            this.briefcase.sub = ["Scorpion", "Mole Claw", "Bagworm", "Shield"];
            this.speed = 3.9;
        }
        else if (preset === 'ninomiya') {
            this.briefcase.main = ["Asteroid", "Hound", "Shield", "Empty"];
            this.briefcase.sub = ["Asteroid", "Hound", "Bagworm", "Shield"];
            this.speed = 3.4;
        }
        else if (preset === 'yuba') {
            this.briefcase.main = ["Assault Rifle", "Shield", "Empty", "Empty"];
            this.briefcase.sub = ["Assault Rifle", "Bagworm", "Shield", "Empty"];
            this.speed = 3.8;
        }
        else if (preset === 'custom') {
            this.briefcase.main = ["Kogetsu", "Hound", "Assault Rifle", "Shield"];
            this.briefcase.sub = ["Meteora", "Viper", "Lead Bullet", "Bagworm"];
            this.speed = 3.5;
        }

        // Apply difficulty modifiers to speed
        if (this.difficulty === 'easy') {
            this.speed *= 0.65;
        } else if (this.difficulty === 'hard') {
            this.speed *= 1.15;
        }
    }

    takeDamage(amount, attackerId, isLeadBullet = false, bulletType = '') {
        // If bodyHp is already 0, any hit triggers bail out
        if (this.bodyHp <= 0) {
            if (!this.bailedOut) {
                if (attackerId && attackerId !== this.id) {
                    this.lastAttackerId = attackerId;
                    this.lastAttackTime = Date.now();
                }
                if (typeof triggerBailOut !== 'undefined') {
                    triggerBailOut(this.id, 'Trion Body Destroyed');
                }
            }
            return;
        }

        if (isLeadBullet) {
            this.isWeighted = true;
            let stacks = 1;
            if (bulletType === 'egret') stacks = 2;
            else if (bulletType === 'ibis') stacks = 4;
            else if (bulletType === 'lightning') stacks = 1;

            this.weightStacks = Math.min(5, this.weightStacks + stacks);

            if (window.spawnSparks) {
                window.spawnSparks(this.x, this.y, '#121212', 10);
            }
            return;
        }

        // Check if shield blocks the damage (Gimlet is blocked only by Full Shield!)
        // Active shield snap block is only possible if this.trion > 0
        if (attackerId && !this.isChameleonActive && this.trion > 0) {
            const hasShieldMain = this.briefcase.main[this.activeMain] === "Shield";
            const hasShieldSub = this.briefcase.sub[this.activeSub] === "Shield";
            const isFullShield = this.isShieldActive && hasShieldMain && hasShieldSub;

            const hasShield = hasShieldMain || hasShieldSub;
            const isGimlet = bulletType === 'gimlet';

            if (hasShield) {
                const attacker = allAgents.find(a => a.id === attackerId);
                if (attacker) {
                    let shouldBlock = false;

                    if (this.isShieldActive) {
                        // Shield is already active. Check if attacker is in the blocking arc
                        const attackAngle = Math.atan2(attacker.y - this.y, attacker.x - this.x);
                        let angleDiff = attackAngle - this.angle;
                        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

                        const currentShieldAngle = isFullShield ? 360 : 90;
                        const shieldRad = (currentShieldAngle * Math.PI) / 360;
                        if (Math.abs(angleDiff) <= shieldRad) {
                            shouldBlock = true;
                        }
                    } else {
                        // Shield is not active. Attempt a reactive block!
                        let blockChance = 0.8;
                        if (this.difficulty === 'easy') blockChance = 0.35;
                        else if (this.difficulty === 'hard') blockChance = 0.95;

                        if (Math.random() < blockChance) {
                            // Snap to face the attacker and raise the shield reactively
                            this.angle = Math.atan2(attacker.y - this.y, attacker.x - this.x);
                            this.isShieldActive = true;
                            shouldBlock = true;
                        }
                    }

                    if (shouldBlock && (!isGimlet || isFullShield)) {
                        if (isFullShield) {
                            // Full Shield holds! Only drain 8% of the damage as Trion cost
                            this.trion -= amount * 0.08;
                            window.audio.playShieldBlock();
                            if (window.spawnSparks) {
                                window.spawnSparks(this.x + Math.cos(this.angle) * 22, this.y + Math.sin(this.angle) * 22, '#ffd700', 16);
                            }
                        } else {
                            // Standard Shield holds! Completely block damage to Trion HP body, charge 25% Trion cost
                            this.trion -= amount * 0.25;
                            window.audio.playShieldBlock();
                            if (window.spawnSparks) {
                                window.spawnSparks(this.x + Math.cos(this.angle) * 22, this.y + Math.sin(this.angle) * 22, '#39ff14', 12);
                            }
                        }
                        if (this.trion <= 0) {
                            this.trion = 0;
                            this.isShieldActive = false;
                            if (attackerId && attackerId !== this.id) {
                                this.lastAttackerId = attackerId;
                                this.lastAttackTime = Date.now();
                            }
                        }
                        return;
                    }
                }
            }
        }

        // Apply normal damage directly to Body HP
        this.bodyHp -= amount;
        if (attackerId && attackerId !== this.id) {
            this.lastAttackerId = attackerId;
            this.lastAttackTime = Date.now();
        }

        // Gimlet stuns AI!
        if (bulletType === 'gimlet') {
            this.stunTimer = 20; // 20 frames stun!
        }

        if (window.spawnSparks) {
            window.spawnSparks(this.x, this.y, '#ff3b30', 8);
        }
        // Active leakage if HP falls below 50%
        if (this.bodyHp < this.bodyHpMax * 0.5 && !this.isLeaking) {
            this.isLeaking = true;
            this.leakRate = 10; // 10 points per second passively
            if (typeof addLog !== 'undefined') {
                addLog(`[WARNING] ${this.name} Trion Body damaged below 50%! Passive Trion Leakage activated!`, 'kill');
            }
        }

        if (this.bodyHp <= 0) {
            this.bodyHp = 0;
            if (typeof triggerBailOut !== 'undefined') {
                triggerBailOut(this.id, 'Trion Body Destroyed');
            }
        }

        if (window.spawnSparks) {
            window.spawnSparks(this.x, this.y, '#ff3b30', 8);
        }
    }

    update(arena, allAgents, bullets, grPads, logs) {
        if (this.bailedOut) return;

        // Decrement cooldowns based on difficulty
        let cdReduction = 16.67; // ms (approx 60fps frame)
        if (this.difficulty === 'easy') {
            cdReduction = 8.0; // Cooldowns tick down ~50% slower, giving player more breathing room
        } else if (this.difficulty === 'hard') {
            cdReduction = 22.0; // Cooldowns tick down faster for more aggressive AI attacks
        }

        if (this.cooldowns.main > 0) this.cooldowns.main -= cdReduction;
        if (this.cooldowns.sub > 0) this.cooldowns.sub -= cdReduction;

        // Passive Trion Drain & Leakage
        if (this.isBagwormActive) this.trion -= 0.3;
        if (this.isChameleonActive) this.trion -= 0.6;

        if (this.isLeaking) {
            this.bodyHp -= this.leakRate / 60;
        }

        if (this.trion <= 0) {
            this.trion = 0;
            this.isShieldActive = false;
        }

        if (this.bodyHp <= 0) {
            this.bodyHp = 0;
            if (typeof triggerBailOut !== 'undefined') {
                triggerBailOut(this.id, 'Trion Body Destroyed - Leakage');
            }
        }

        // Dynamic Spider wire overlap check for AI
        let inFriendlySpider = false;
        let inEnemySpider = false;
        if (arena && arena.spiderWebs) {
            for (const web of arena.spiderWebs) {
                const dist = pointToLineDistance(this.x, this.y, web.x1, web.y1, web.x2, web.y2);
                if (dist < this.radius + 6) { // Expanded threshold for better responsive overlap feel
                    if (web.ownerId === this.id) {
                        inFriendlySpider = true;
                    } else {
                        inEnemySpider = true;
                    }
                }
            }
        }

        // Apply speed modifiers (dual Scorpion, friendly/enemy Spider, weight stacks)
        let currentSpeed = this.speed;
        const hasDualScorpion = this.briefcase.main[this.activeMain] === 'Scorpion' && this.briefcase.sub[this.activeSub] === 'Scorpion';
        if (hasDualScorpion) {
            currentSpeed *= 1.15;
        }

        // Apply movement speed penalty if shielding
        if (this.isShieldActive && this.trion > 0) {
            const hasShieldMain = this.briefcase.main[this.activeMain] === "Shield";
            const hasShieldSub = this.briefcase.sub[this.activeSub] === "Shield";
            if (hasShieldMain && hasShieldSub) {
                currentSpeed *= 0.60; // 40% speed penalty for Full Shield
            } else {
                currentSpeed *= 0.80; // 20% speed penalty for Standard Shield
            }
        }

        if (inEnemySpider) {
            currentSpeed *= 0.4;
            if (window.spawnSparks && Math.random() < 0.22) {
                window.spawnSparks(this.x, this.y, '#bd00ff', 2); // Purple digital slow sparks
            }
        } else if (inFriendlySpider) {
            currentSpeed *= 1.35; // Boost speed by 35%
            if (window.spawnSparks && Math.random() < 0.22) {
                window.spawnSparks(this.x, this.y, '#39ff14', 2); // Green speed boost sparks
            }
        } else if (this.isWeighted) {
            currentSpeed *= Math.max(0.15, 1 - 0.2 * this.weightStacks);
        }

        // 1. TACTICAL BRAIN / DECISION TREE
        this.stateTimer--;
        if (this.stateTimer <= 0) {
            this.evaluateState(allAgents);
            this.stateTimer = 60 + Math.random() * 60; // Re-evaluate every 1-2 seconds
        }

        // Find nearest visible threat
        let nearestThreat = null;
        let threatDist = 999999;
        for (const agent of allAgents) {
            if (agent.id === this.id || agent.bailedOut) continue;

            const dist = Math.sqrt((agent.x - this.x) ** 2 + (agent.y - this.y) ** 2);

            // Stealth visual detection limits:
            let detected = true;
            if (agent.isBagwormActive) {
                // If there's a wall blocking direct visual sight, Bagworm keeps them hidden.
                const ray = arena.raycast(this.x, this.y, agent.x, agent.y);
                if (ray.hit && dist > 220) {
                    detected = false;
                }
            }
            if (agent.isChameleonActive && dist > 70) detected = false;

            if (!detected) continue;

            if (dist < threatDist) {
                threatDist = dist;
                nearestThreat = agent;
            }
        }

        this.targetAgent = nearestThreat;

        // 2. STEERING & MOVEMENT CONTROL
        if (this.stunTimer && this.stunTimer > 0) {
            this.stunTimer--;
            this.vx = 0;
            this.vy = 0;
            if (window.spawnSparks && Math.random() < 0.35) {
                window.spawnSparks(this.x, this.y, '#ffd700', 3); // Gold sparks for stun
            }
        } else if (this.isDashing) {
            this.vx *= 0.92;
            this.vy *= 0.92;
            this.dashTimer--;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        } else {
            let tx = this.patrolTarget.x;
            let ty = this.patrolTarget.y;

            if (this.state === 'chase' && this.targetAgent) {
                tx = this.targetAgent.x;
                ty = this.targetAgent.y;
            }
            else if (this.state === 'snipe' && this.targetAgent) {
                // Snipe state: keep maximum distance but in sight
                const angle = Math.atan2(this.y - this.targetAgent.y, this.x - this.targetAgent.x);
                tx = this.targetAgent.x + Math.cos(angle) * 700;
                ty = this.targetAgent.y + Math.sin(angle) * 700;
            }
            else if (this.state === 'flee' && this.targetAgent) {
                // Run opposite direction
                const angle = Math.atan2(this.y - this.targetAgent.y, this.x - this.targetAgent.x);
                tx = this.x + Math.cos(angle) * 200;
                ty = this.y + Math.sin(angle) * 200;
            }

            // Steering vector towards target
            let dx = tx - this.x;
            let dy = ty - this.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 15) {
                this.vx = (dx / dist) * currentSpeed;
                this.vy = (dy / dist) * currentSpeed;
                this.angle = Math.atan2(dy, dx);
            } else {
                this.vx = 0;
                this.vy = 0;
                this.chooseNewPatrolTarget(arena);
            }
        }

        // Dynamic defensive response: if a bullet is incoming, raise Shield!
        this.checkIncomingBulletsAndShield(bullets);

        // Apply physical movements & collisions with sliding response
        this.x += this.vx;
        this.y += this.vy;

        const collision = arena.circleCollides(this.x, this.y, this.radius);
        if (collision.collided) {
            this.x = collision.x;
            this.y = collision.y;
            if (this.state === 'patrol' || this.state === 'flee' || !this.targetAgent) {
                this.chooseNewPatrolTarget(arena);
            }
        }

        // Determine dynamic engagement distance based on equipped briefcase triggers
        let engageDist = 600; // Default threat distance
        const hasSniper = this.briefcase.main.some(t => t === 'Egret' || t === 'Ibis' || t === 'Lightning');
        const hasGunnerOrShooter = this.briefcase.main.some(t => {
            const config = window.TRIGGER_CATALOG[t];
            return config && (config.category === 'gunner' || config.category === 'shooter');
        }) || this.briefcase.sub.some(t => {
            const config = window.TRIGGER_CATALOG[t];
            return config && (config.category === 'gunner' || config.category === 'shooter');
        });

        if (hasSniper) {
            engageDist = 1300;
        } else if (hasGunnerOrShooter) {
            engageDist = 650;
        } else {
            engageDist = 300; // Attacker close-range combat
        }

        // 3. COMBAT ACTIONS & TRIGGER USE
        if (this.targetAgent && threatDist < engageDist && (!this.stunTimer || this.stunTimer <= 0)) {
            // Aim facing vector at threat
            this.angle = Math.atan2(this.targetAgent.y - this.y, this.targetAgent.x - this.x);

            // Execute specific trigger attacks (only if trion > 0)
            if (this.trion > 0) {
                this.performCombatAction(threatDist, bullets, grPads, arena);
            }
        }
    }

    evaluateState(allAgents) {
        // Snipe state if sniper
        const hasSniper = this.briefcase.main.some(t => t === 'Egret' || t === 'Ibis' || t === 'Lightning');
        if (hasSniper) {
            this.state = this.trion < 400 ? 'flee' : 'snipe';
            if (this.state === 'flee') {
                this.isBagwormActive = true; // cloaked sniper trying to escape
            } else {
                // Snipers always maintain Bagworm until they aim to shoot!
                this.isBagwormActive = true;
            }
            return;
        }

        if (this.trion < 300) {
            this.state = 'flee';
            this.isBagwormActive = true; // hide to run away
        } else {
            // Deploy Bagworm if patrolling to maintain stealth. Only deactivate when actively chasing or fighting.
            if (this.state === 'patrol' || !this.targetAgent) {
                this.isBagwormActive = true;
            } else {
                this.isBagwormActive = Math.random() > 0.5; // occasionally hide while chasing
            }
            this.state = Math.random() > 0.4 ? 'chase' : 'patrol';
        }
    }

    chooseNewPatrolTarget(arena) {
        // Choose arbitrary safe walkable coordinates
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * (arena.width - 200) + 100;
            const y = Math.random() * (arena.height - 200) + 100;
            if (!arena.isWall(x, y)) {
                this.patrolTarget = { x, y };
                break;
            }
        }
    }

    checkIncomingBulletsAndShield(bullets) {
        const hasShield = this.briefcase.main.includes("Shield") || this.briefcase.sub.includes("Shield");
        if (!hasShield || this.trion <= 0) {
            this.isShieldActive = false;
            return;
        }

        let bulletApproaching = false;
        let incomingAngle = 0;

        for (const b of bullets) {
            if (b.ownerId === this.id) continue;
            const dx = b.x - this.x;
            const dy = b.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check if bullet heading towards AI within 150px
            if (dist < 150) {
                const dotProduct = b.vx * dx + b.vy * dy;
                if (dotProduct < 0) { // Moving towards
                    bulletApproaching = true;
                    incomingAngle = Math.atan2(-dy, -dx); // Angle of incoming attack
                    break;
                }
            }
        }

        if (bulletApproaching && this.trion > 0) {
            // Turn shield on towards attack angle
            this.angle = incomingAngle;
            // Shield cost: passive consumption on frame
            const hasShieldMain = this.briefcase.main[this.activeMain] === "Shield";
            const hasShieldSub = this.briefcase.sub[this.activeSub] === "Shield";
            const isFullShield = hasShieldMain && hasShieldSub;
            this.trion -= isFullShield ? 1.0 : 0.5;
            this.isShieldActive = true;
        } else {
            this.isShieldActive = false;
        }
    }

    performCombatAction(dist, bullets, grPads, arena) {
        if (this.isChameleonActive) return; // Chameleon strictly locks other slots and blocks AI actions!

        const mainTrigName = this.briefcase.main[this.activeMain];
        const subTrigName = this.briefcase.sub[this.activeSub];
        const mainConfig = window.TRIGGER_CATALOG[mainTrigName];
        const subConfig = window.TRIGGER_CATALOG[subTrigName];

        // ==========================================
        // 1. TACTICAL SPECIAL MOVEMENTS & TRAPPING SUPPORT
        // ==========================================

        // A. Osamu & Katori: Spider Wire placement anywhere with mesh auto-connections!
        const hasSpider = this.briefcase.main.includes('Spider') || this.briefcase.sub.includes('Spider');
        if (hasSpider && dist < 240 && this.cooldowns.sub <= 0 && this.trion >= 40 && Math.random() > 0.65) {
            this.isBagwormActive = false;
            this.trion -= 40;

            // Spawn tripwire connecting local points near targets/AI
            const angleOffset = (Math.random() - 0.5) * 1.6;
            const wLen = 90 + Math.random() * 90;
            const x1 = this.x - Math.cos(this.angle + angleOffset) * 35;
            const y1 = this.y - Math.sin(this.angle + angleOffset) * 35;
            const x2 = this.x + Math.cos(this.angle + angleOffset) * wLen;
            const y2 = this.y + Math.sin(this.angle + angleOffset) * wLen;

            arena.addSpiderWeb(x1, y1, x2, y2, this.id);
            window.audio.playShieldBlock();
            this.cooldowns.sub = 800; // ms
            return;
        }

        // B. Yuma & Katori: Grasshopper Neon Jump Pads
        const hasGrasshopper = this.briefcase.main.includes('Grasshopper') || this.briefcase.sub.includes('Grasshopper');
        if (hasGrasshopper && dist > 100 && dist < 220 && this.cooldowns.sub <= 0 && this.trion >= 30 && Math.random() > 0.6) {
            this.trion -= 30;
            grPads.push(new window.GrasshopperPad(this.x, this.y, this.id));
            this.cooldowns.sub = 450;
            return;
        }

        // C. Murakami: Raygust + Thruster Dash-Slash forward!
        const hasRaygust = mainTrigName === 'Raygust' || subTrigName === 'Raygust';
        const hasThruster = this.briefcase.main.includes('Thruster') || this.briefcase.sub.includes('Thruster');
        if (hasRaygust && hasThruster && dist > 75 && dist < 220 && this.cooldowns.sub <= 0 && this.trion >= 40 && Math.random() > 0.6) {
            this.isBagwormActive = false;
            this.trion -= 40;
            window.audio.playThruster();

            // Set active main/sub slots to Raygust and Thruster
            const raygustIdx = this.briefcase.main.indexOf('Raygust');
            if (raygustIdx !== -1) this.activeMain = raygustIdx;

            const thrusterIdx = this.briefcase.sub.indexOf('Thruster');
            if (thrusterIdx !== -1) this.activeSub = thrusterIdx;

            const dashSpeed = 22;
            this.vx = Math.cos(this.angle) * dashSpeed;
            this.vy = Math.sin(this.angle) * dashSpeed;
            this.isDashing = true;
            this.dashTimer = 12; // locks movement for 12 frames
            this.isWeighted = false; // clear weights during dash

            if (window.spawnSparks) {
                window.spawnSparks(this.x - Math.cos(this.angle) * 15, this.y - Math.sin(this.angle) * 15, '#00f0ff', 20);
            }
            this.cooldowns.sub = 1200; // cooldown
            return;
        }

        // ==========================================
        // 2. LONG RANGE SNIPERS WEAPONS (Egret, Ibis, Lightning)
        // ==========================================
        const hasSniperWeapon = this.briefcase.main.some(t => t === 'Egret' || t === 'Ibis' || t === 'Lightning');
        if (hasSniperWeapon && dist > 180 && this.cooldowns.main <= 0) {
            const sniperSlots = [];
            this.briefcase.main.forEach((t, idx) => {
                if (t === 'Egret' || t === 'Ibis' || t === 'Lightning') {
                    sniperSlots.push({ name: t, index: idx });
                }
            });

            if (sniperSlots.length > 0) {
                const selectedSlot = sniperSlots[Math.floor(Math.random() * sniperSlots.length)];
                const weaponName = selectedSlot.name;
                const trig = window.TRIGGER_CATALOG[weaponName];
                this.activeMain = selectedSlot.index;

                const leadActive = this.briefcase.sub.includes('Lead Bullet');
                let extraCost = leadActive ? 40 : 0;

                if (this.trion >= trig.trionCost + extraCost) {
                    this.trion -= (trig.trionCost + extraCost);
                } else {
                    return;
                }

                // AI Aiming offsets based on difficulty
                let targetX = this.targetAgent.x;
                let targetY = this.targetAgent.y;
                if (this.difficulty === 'easy') {
                    targetX += (Math.random() - 0.5) * 85;
                    targetY += (Math.random() - 0.5) * 85;
                } else if (this.difficulty === 'medium') {
                    targetX += (Math.random() - 0.5) * 20;
                    targetY += (Math.random() - 0.5) * 20;
                }

                const ray = arena.raycast(this.x, this.y, targetX, targetY);
                if (!ray.hit) { // Direct clear line of sight
                    this.isBagwormActive = false; // Discharging deactivates Bagworm

                    if (weaponName === 'Ibis') {
                        let shootAngle = this.angle;
                        if (this.difficulty === 'easy') shootAngle += (Math.random() - 0.5) * 0.25;

                        bullets.push(new window.Bullet(this.x, this.y, shootAngle, {
                            type: 'ibis',
                            damage: leadActive ? 0 : trig.damage,
                            speed: trig.speed,
                            size: leadActive ? 22 : 15,
                            ownerId: this.id,
                            isLeadBullet: leadActive,
                            color: leadActive ? '#121212' : '#ffdf00'
                        }));
                        window.audio.playShoot('meteora');
                    } else {
                        // Hitscan Egret or Lightning
                        let didHit = true;
                        if (this.difficulty === 'easy' && Math.random() > 0.45) didHit = false;
                        else if (this.difficulty === 'medium' && Math.random() > 0.85) didHit = false;

                        window.audio.playHitscan(weaponName === 'Lightning');

                        const laserParts = (typeof particles !== 'undefined') ? particles : (window.particles || null);
                        if (laserParts) {
                            laserParts.push({
                                type: 'laser',
                                x1: this.x,
                                y1: this.y,
                                x2: ray.x,
                                y2: ray.y,
                                color: leadActive ? 'rgba(18, 18, 18, 0.95)' : (weaponName === 'Lightning' ? 'rgba(0, 240, 255, 0.8)' : 'rgba(255,255,255,0.7)'),
                                life: 15
                            });
                        }

                        if (didHit) {
                            const weaponKey = weaponName.toLowerCase();
                            this.targetAgent.takeDamage(leadActive ? 0 : trig.damage, this.id, leadActive, weaponKey);
                            if (!leadActive && weaponName === 'Lightning') {
                                this.targetAgent.trion -= trig.trionDrain;
                                if (this.targetAgent.trion <= 0) {
                                    this.targetAgent.trion = 0;
                                    this.targetAgent.lastAttackerId = this.id;
                                    this.targetAgent.lastAttackTime = Date.now();
                                }
                            }
                        }
                    }
                    this.cooldowns.main = trig.cooldown;
                    return;
                }
            }
        }

        // ==========================================
        // 3. COMPOSITE FUSIONS ATTACKS (Ninomiya/High Trion Shooters)
        // ==========================================
        const canFuse = this.briefcase.main.includes('Asteroid') && this.briefcase.sub.includes('Hound');
        if (canFuse && this.trion > 420 && this.cooldowns.main <= 0 && this.cooldowns.sub <= 0 && Math.random() > 0.65) {
            this.isBagwormActive = false;
            this.trion -= 80;

            const isGimlet = Math.random() > 0.5;
            if (isGimlet) {
                window.audio.playShoot('meteora');
                bullets.push(new window.Bullet(this.x, this.y, this.angle, {
                    type: 'gimlet',
                    damage: 360,
                    speed: 13,
                    ownerId: this.id,
                    color: '#ffd700',
                    size: 14,
                    isComposite: true
                }));
                if (typeof addLog !== 'undefined') {
                    addLog(`[TACTICAL] AI ${this.name} fused Gimlet shield-piercing composite bullet!`, 'system');
                }
            } else {
                if (typeof addLog !== 'undefined') {
                    addLog(`[TACTICAL] AI ${this.name} fused Hornet accelerating homing composite swarm!`, 'system');
                }
                for (let i = 0; i < 4; i++) {
                    setTimeout(() => {
                        if (this.bailedOut || !matchActive) return;
                        bullets.push(new window.Bullet(this.x, this.y, this.angle + (Math.random() - 0.5) * 0.25, {
                            type: 'hornet',
                            damage: 180,
                            speed: 9,
                            ownerId: this.id,
                            color: '#bd00ff',
                            size: 8,
                            isComposite: true
                        }));
                        window.audio.playShoot('hound');
                    }, i * 100);
                }
            }

            this.cooldowns.main = 1500;
            this.cooldowns.sub = 1500;
            return;
        }

        // Tactically cycle main/sub active slots based on target distance
        if (dist < 80) {
            const mainAttackerIdx = this.briefcase.main.findIndex(t => window.TRIGGER_CATALOG[t] && window.TRIGGER_CATALOG[t].category === 'attacker');
            if (mainAttackerIdx !== -1 && this.activeMain !== mainAttackerIdx) this.activeMain = mainAttackerIdx;

            const subAttackerIdx = this.briefcase.sub.findIndex(t => window.TRIGGER_CATALOG[t] && window.TRIGGER_CATALOG[t].category === 'attacker');
            if (subAttackerIdx !== -1 && this.activeSub !== subAttackerIdx) this.activeSub = subAttackerIdx;
        } else if (dist > 120 && dist < 450) {
            const mainShooterIdx = this.briefcase.main.findIndex(t => window.TRIGGER_CATALOG[t] && (window.TRIGGER_CATALOG[t].category === 'shooter' || window.TRIGGER_CATALOG[t].category === 'gunner'));
            if (mainShooterIdx !== -1 && this.activeMain !== mainShooterIdx) this.activeMain = mainShooterIdx;
        }

        // ==========================================
        // 4. ATTACKER MELEE SLASHES (Kogetsu, Scorpion, Raygust, Senku)
        // ==========================================
        const activeMainName = this.briefcase.main[this.activeMain];
        const activeSubName = this.briefcase.sub[this.activeSub];
        const activeMainConfig = window.TRIGGER_CATALOG[activeMainName];

        if (activeMainConfig && activeMainConfig.category === 'attacker') {
            // A. Senku Medium Range Kogetsu sweep (AI Ikoma / Arafune signature)
            const hasSenku = this.briefcase.sub.includes('Senku');
            if (activeMainName === 'Kogetsu' && hasSenku && dist > 45 && dist < 160 && this.cooldowns.sub <= 0 && this.trion >= 60) {
                this.isBagwormActive = false;
                this.trion -= 60;
                window.audio.playSenku();
                this.targetAgent.takeDamage(450, this.id);
                this.cooldowns.sub = 800; // ms

                const slashParts = (typeof particles !== 'undefined') ? particles : (window.particles || null);
                if (slashParts) {
                    slashParts.push({
                        type: 'slash',
                        x: this.x,
                        y: this.y,
                        angle: this.angle,
                        color: '#ffffff',
                        life: 10,
                        maxLife: 10,
                        range: 160
                    });
                }
                if (window.cutSpiderWebsInArc) {
                    window.cutSpiderWebsInArc(this, 160);
                }
                return;
            }

            // B. Close Range Melee sweeps
            if (dist < (activeMainConfig.range || 40) && this.cooldowns.main <= 0 && this.trion >= activeMainConfig.trionCost) {
                this.isBagwormActive = false;
                this.trion -= activeMainConfig.trionCost;

                let damage = activeMainConfig.damage || 22;
                const isKogetsu = activeMainName === 'Kogetsu';
                const hasDualKogetsu = isKogetsu && activeSubName === 'Kogetsu';
                if (hasDualKogetsu) damage = Math.floor(damage * 1.25);

                window.audio.playSlash(activeMainName === 'Scorpion');
                this.targetAgent.takeDamage(damage, this.id);
                this.cooldowns.main = activeMainConfig.cooldown || 140;

                const slashParts = (typeof particles !== 'undefined') ? particles : (window.particles || null);
                if (slashParts) {
                    slashParts.push({
                        type: 'slash',
                        x: this.x,
                        y: this.y,
                        angle: this.angle,
                        color: activeMainName === 'Scorpion' ? '#ff3b30' : (isKogetsu ? '#00f0ff' : '#00ff14'),
                        life: 10,
                        maxLife: 10,
                        range: activeMainConfig.range || 45
                    });
                }
                if (window.cutSpiderWebsInArc) {
                    window.cutSpiderWebsInArc(this, activeMainConfig.range || 45);
                }
                return;
            }
        }

        // ==========================================
        // 5. SHOOTERS TRIGGERS (Asteroid, Hound, Meteora, Viper)
        // ==========================================
        if (activeMainConfig && activeMainConfig.category === 'shooter' && this.cooldowns.main <= 0) {
            const bulletType = activeMainName.toLowerCase();
            const leadActive = this.briefcase.sub.includes('Lead Bullet');
            const isDualShooter = (activeMainName === activeSubName);

            let bulletCost = activeMainConfig.trionCost + (leadActive ? 40 : 0);
            let fireDouble = false;

            if (isDualShooter && this.trion >= bulletCost * 2) {
                bulletCost *= 2;
                fireDouble = true;
            }

            if (this.trion >= bulletCost) {
                this.isBagwormActive = false; // Discharging shooter bullets deactivates Bagworm
                this.trion -= bulletCost;
            } else {
                return;
            }

            let shootAngle = this.angle;
            if (this.difficulty === 'easy') {
                shootAngle += (Math.random() - 0.5) * 0.35;
            } else if (this.difficulty === 'medium') {
                shootAngle += (Math.random() - 0.5) * 0.12;
            }

            if (bulletType === 'viper') {
                // Programmable viper bullet trajectories for Rei Nasu/AI Shooters
                const curveOffset = Math.random() > 0.5 ? 0.45 : -0.45;
                const p1 = { x: this.x + Math.cos(shootAngle + curveOffset) * 80, y: this.y + Math.sin(shootAngle + curveOffset) * 80 };
                const p2 = { x: this.x + Math.cos(shootAngle - curveOffset) * 160, y: this.y + Math.sin(shootAngle - curveOffset) * 160 };
                const p3 = { x: this.x + Math.cos(shootAngle) * 320, y: this.y + Math.sin(shootAngle) * 320 };
                const wps = [p1, p2, p3];

                if (fireDouble) {
                    const ox = Math.cos(shootAngle + Math.PI / 2) * 10;
                    const oy = Math.sin(shootAngle + Math.PI / 2) * 10;

                    bullets.push(new window.Bullet(this.x + ox, this.y + oy, shootAngle, {
                        type: 'viper',
                        damage: leadActive ? 0 : activeMainConfig.damage,
                        speed: activeMainConfig.speed,
                        ownerId: this.id,
                        waypoints: wps.map(wp => ({ x: wp.x + ox, y: wp.y + oy })),
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : '#ffc107',
                        size: leadActive ? 12 : 8
                    }));

                    bullets.push(new window.Bullet(this.x - ox, this.y - oy, shootAngle, {
                        type: 'viper',
                        damage: leadActive ? 0 : activeMainConfig.damage,
                        speed: activeMainConfig.speed,
                        ownerId: this.id,
                        waypoints: wps.map(wp => ({ x: wp.x - ox, y: wp.y - oy })),
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : '#ffc107',
                        size: leadActive ? 12 : 8
                    }));
                } else {
                    bullets.push(new window.Bullet(this.x, this.y, shootAngle, {
                        type: 'viper',
                        damage: leadActive ? 0 : activeMainConfig.damage,
                        speed: activeMainConfig.speed,
                        ownerId: this.id,
                        waypoints: wps,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : '#ffc107',
                        size: leadActive ? 12 : 8
                    }));
                }
            } else {
                if (fireDouble) {
                    bullets.push(new window.Bullet(this.x, this.y, shootAngle - 0.08, {
                        type: bulletType,
                        damage: leadActive ? 0 : activeMainConfig.damage,
                        speed: activeMainConfig.speed,
                        ownerId: this.id,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                        size: leadActive ? 12 : 8
                    }));
                    bullets.push(new window.Bullet(this.x, this.y, shootAngle + 0.08, {
                        type: bulletType,
                        damage: leadActive ? 0 : activeMainConfig.damage,
                        speed: activeMainConfig.speed,
                        ownerId: this.id,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                        size: leadActive ? 12 : 8
                    }));
                } else {
                    bullets.push(new window.Bullet(this.x, this.y, shootAngle, {
                        type: bulletType,
                        damage: leadActive ? 0 : activeMainConfig.damage,
                        speed: activeMainConfig.speed,
                        ownerId: this.id,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                        size: leadActive ? 12 : 8
                    }));
                }
            }

            window.audio.playShoot(bulletType);
            this.cooldowns.main = activeMainConfig.cooldown;
            return;
        }

        // ==========================================
        // 6. GUNNERS TRIGGERS (Assault Rifle, Shotgun)
        // ==========================================
        if (activeMainConfig && activeMainConfig.category === 'gunner' && this.cooldowns.main <= 0) {
            const leadActive = this.briefcase.sub.includes('Lead Bullet');
            let bulletCost = activeMainConfig.trionCost + (leadActive ? 40 : 0);

            if (this.trion >= bulletCost) {
                this.isBagwormActive = false; // Discharging shooter bullets deactivates Bagworm
                this.trion -= bulletCost;
            } else {
                return;
            }

            let shootAngle = this.angle;
            if (this.difficulty === 'easy') {
                shootAngle += (Math.random() - 0.5) * 0.25;
            } else if (this.difficulty === 'medium') {
                shootAngle += (Math.random() - 0.5) * 0.10;
            }

            if (activeMainName === 'Assault Rifle') {
                const spread = (Math.random() - 0.5) * 0.15;
                bullets.push(new window.Bullet(this.x, this.y, shootAngle + spread, {
                    type: 'asteroid',
                    damage: leadActive ? 0 : activeMainConfig.damage,
                    speed: activeMainConfig.speed,
                    ownerId: this.id,
                    isLeadBullet: leadActive,
                    color: leadActive ? '#121212' : '#ffdf00',
                    size: leadActive ? 10 : 6
                }));
                window.audio.playShoot('gunner');
            } else if (activeMainName === 'Shotgun') {
                for (let i = -2; i <= 2; i++) {
                    const spreadAngle = shootAngle + i * 0.08;
                    bullets.push(new window.Bullet(this.x, this.y, spreadAngle, {
                        type: 'asteroid',
                        damage: leadActive ? 0 : activeMainConfig.damage - 2,
                        speed: activeMainConfig.speed + (Math.random() - 0.5) * 2,
                        ownerId: this.id,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : '#ff9500',
                        size: leadActive ? 9 : 5,
                        life: 35
                    }));
                }
                window.audio.playShoot('gunner');
            }

            this.cooldowns.main = activeMainConfig.cooldown;
            return;
        }
    }

    draw(ctx) {
        if (this.bailedOut) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Chameleon active opacity scale
        ctx.globalAlpha = this.isChameleonActive ? 0.08 : 1.0;

        // Determine AIAgent theme color based on preset
        let themeColor = '#ff3b30'; // Default red
        if (this.preset === 'yuma') themeColor = '#ff3b30';      // Red
        else if (this.preset === 'osamu') themeColor = '#ffdf00';     // Gold/Amber
        else if (this.preset === 'chika') themeColor = '#e040fb';     // Purple/Pink
        else if (this.preset === 'hyuse') themeColor = '#00e676';     // Emerald/Green

        // Outer cyber glowing aura
        ctx.shadowBlur = 12;
        ctx.shadowColor = themeColor;
        ctx.fillStyle = '#141e24';
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 3.5;

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // DRAW CHIBI AVATAR ON CANVAS
        if (window.agentImages && window.agentImages[this.preset]) {
            const img = window.agentImages[this.preset];
            if (img.complete) {
                ctx.save();
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.beginPath();
                ctx.arc(0, 0, this.radius - 2.5, 0, Math.PI * 2);
                ctx.clip();
                ctx.rotate(-this.angle); // Rotate back so chibi face remains upright
                ctx.drawImage(img, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
                ctx.restore();
            }
        }

        // Direction arrow nose
        ctx.fillStyle = themeColor;
        ctx.beginPath();
        ctx.moveTo(this.radius, -5);
        ctx.lineTo(this.radius + 8, 0);
        ctx.lineTo(this.radius, 5);
        ctx.closePath();
        ctx.fill();

        // Draw active Shield arc if AI is blocking
        if (this.isShieldActive) {
            const hasShieldMain = this.briefcase.main[this.activeMain] === "Shield";
            const hasShieldSub = this.briefcase.sub[this.activeSub] === "Shield";
            const isFullShield = hasShieldMain && hasShieldSub;

            ctx.save();
            ctx.strokeStyle = isFullShield ? 'rgba(0, 240, 255, 0.9)' : 'rgba(57, 255, 20, 0.85)';
            ctx.lineWidth = isFullShield ? 6 : 5;
            ctx.shadowBlur = 10;
            ctx.shadowColor = isFullShield ? '#00f0ff' : '#39ff14';

            const currentShieldAngle = isFullShield ? 360 : 90;
            const shieldRad = (currentShieldAngle * Math.PI) / 360; // half angle bounds
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8, -shieldRad, shieldRad);
            ctx.stroke();
            ctx.restore();
        }

        // Draw stacked weights indicators if slowed by Lead Bullet or Wires
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

        // AIAgent name floating text and dual mini HP/Trion bars
        if (!this.isChameleonActive) {
            ctx.save();
            // 1. Draw name and numeric Trion
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 9px monospace';
            ctx.textAlign = 'center';
            const trionVal = Math.max(0, Math.floor(this.trion));
            ctx.fillText(`${this.name.toUpperCase()} [${trionVal}/${this.trionMax}]`, this.x, this.y - 25);

            // 2. Draw mini bars (HP Cyan & Trion Green)
            const barWidth = 40;
            const barHeight = 3;
            const barX = this.x - barWidth / 2;

            // HP Bar (Cyan)
            const barY1 = this.y - 38;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX, barY1, barWidth, barHeight);
            const hpFillWidth = Math.max(0, Math.min(1, this.bodyHp / this.bodyHpMax)) * barWidth;
            ctx.fillStyle = '#00f0ff'; // HP Cyan
            ctx.fillRect(barX, barY1, hpFillWidth, barHeight);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(barX, barY1, barWidth, barHeight);

            // Trion Bar (Green)
            const barY2 = this.y - 33;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX, barY2, barWidth, barHeight);
            const trionFillWidth = Math.max(0, Math.min(1, this.trion / this.trionMax)) * barWidth;
            ctx.fillStyle = '#39ff14'; // Trion Green
            ctx.fillRect(barX, barY2, trionFillWidth, barHeight);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(barX, barY2, barWidth, barHeight);

            ctx.restore();
        }
    }
}

// Bind to window global
window.AIAgent = AIAgent;
