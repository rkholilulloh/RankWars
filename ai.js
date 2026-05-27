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
    constructor(id, name, preset = 'yuma', difficulty = 'medium', teamId = null, teamColor = null) {
        this.id = id;
        this.name = name;
        this.preset = preset;
        this.difficulty = difficulty;
        this.teamId = teamId;
        this.teamColor = teamColor;

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
        this.compositeChargeTimer = 0;
        this.compositeSilenceTimer = 0;
        this.compositeFusionType = null;
        this.spiderConsecutiveCount = 0;



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
        this.prefersBagworm = Math.random() < 0.65;

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

        // Tactical balance counters (World Trigger smart AI limitations)
        this.senkuCount = 0;
        this.asteroidCount = 0;
        this.meteoraCount = 0;
        this.egretCount = 0;
        this.ibisCount = 0;
        this.lightningCount = 0;

        this.gunnerFiredCount = 0;
        this.gunnerReloadTimer = 0;

        this.shooterDelayTimer = 0;
        this.shooterBurstCount = 0;

        this.applyPreset(preset);

        // Initial Bagworm activation for Snipers and Shooters to hide on player radar
        const hasBagworm = this.briefcase.main.includes('Bagworm') || this.briefcase.sub.includes('Bagworm');
        const hasSniper = this.briefcase.main.some(t => t === 'Egret' || t === 'Ibis' || t === 'Lightning');
        const hasShooter = this.briefcase.main.some(t => {
            const config = window.TRIGGER_CATALOG[t];
            return config && config.category === 'shooter';
        }) || this.briefcase.sub.some(t => {
            const config = window.TRIGGER_CATALOG[t];
            return config && config.category === 'shooter';
        });

        if (hasBagworm && (hasSniper || hasShooter)) {
            this.isBagwormActive = true;
        }
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

        // Check if shield blocks the damage (Gimlet is blocked only by Full Shield or heavy Raygust Shield!)
        // Active shield snap block is only possible if this.trion > 0
        if (attackerId && !this.isChameleonActive && this.trion > 0) {
            const hasShieldMain = this.briefcase.main[this.activeMain] === "Shield";
            const hasShieldSub = this.briefcase.sub[this.activeSub] === "Shield";
            const isFullShield = this.isShieldActive && hasShieldMain && hasShieldSub;

            const hasShield = hasShieldMain || hasShieldSub;
            const isRaygustShield = this.isRaygustShieldActive;
            const isGimlet = bulletType === 'gimlet';

            if (hasShield || isRaygustShield) {
                const attacker = (typeof allAgents !== 'undefined') ? allAgents.find(a => a.id === attackerId) : null;
                if (attacker) {
                    let shouldBlock = false;

                    if (isRaygustShield) {
                        // Raygust Shield is always active in front of the AI (120 degree arc)
                        const attackAngle = Math.atan2(attacker.y - this.y, attacker.x - this.x);
                        let angleDiff = attackAngle - this.angle;
                        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
                        const shieldRad = (120 * Math.PI) / 360; // 120 degree front-facing protection arc
                        if (Math.abs(angleDiff) <= shieldRad) {
                            shouldBlock = true;
                        }
                    } else if (this.isShieldActive) {
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

                    if (shouldBlock && (!isGimlet || isFullShield || isRaygustShield)) {
                        if (isRaygustShield) {
                            // Raygust Shield holds! Heavy defense: only 15% Trion cost drain
                            this.trion -= amount * 0.15;
                            window.audio.playShieldBlock();
                            if (window.spawnSparks) {
                                window.spawnSparks(this.x + Math.cos(this.angle) * 22, this.y + Math.sin(this.angle) * 22, '#00ff14', 14);
                            }
                        } else if (isFullShield) {
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
                            this.isRaygustShieldActive = false;
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
            this.leakRate = 3; // 3 points per second passively
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

        if (this.compositeSilenceTimer > 0) {
            this.compositeSilenceTimer -= cdReduction;
            if (this.compositeSilenceTimer < 0) this.compositeSilenceTimer = 0;
        }

        // Handle AI composite bullet charging delay freeze
        if (this.compositeChargeTimer && this.compositeChargeTimer > 0) {
            this.compositeChargeTimer -= cdReduction;
            this.vx = 0;
            this.vy = 0;
            this.isShieldActive = false; // disable shields

            if (this.compositeChargeTimer <= 0) {
                this.compositeChargeTimer = 0;
                this.fireAICompositeBulletFinal(bullets, logs);
            }

            // Apply collision checking against walls
            if (arena) {
                const collision = arena.circleCollides(this.x, this.y, this.radius);
                if (collision.collided) {
                    this.x = collision.x;
                    this.y = collision.y;
                }
            }
            return; // Return early to freeze the AI agent!
        }


        if (this.cooldowns.main > 0) this.cooldowns.main -= cdReduction;
        if (this.cooldowns.sub > 0) this.cooldowns.sub -= cdReduction;
        if (this.gunnerReloadTimer > 0) this.gunnerReloadTimer -= cdReduction;
        if (this.shooterDelayTimer > 0) this.shooterDelayTimer -= cdReduction;

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

        // Dynamic Scorpion Standard Mode (1 Scorpion, 1 Shield/Empty) vs Dual Wield Mode (< 30% HP target execution)
        const activeMainName = this.briefcase.main[this.activeMain];
        const activeSubName = this.briefcase.sub[this.activeSub];
        if (activeMainName === 'Scorpion') {
            if (this.targetAgent && this.targetAgent.bodyHp < this.targetAgent.bodyHpMax * 0.3) {
                // Dual wield Scorpion for execution! Find Scorpion slot in sub briefcase
                const subScorpionIdx = this.briefcase.sub.indexOf('Scorpion');
                if (subScorpionIdx !== -1) {
                    this.activeSub = subScorpionIdx;
                }
            } else {
                // Standard Mode: Keep a Shield or Non-Scorpion equipped on sub-hand
                const subShieldIdx = this.briefcase.sub.indexOf('Shield');
                if (subShieldIdx !== -1 && this.briefcase.sub[this.activeSub] === 'Scorpion') {
                    this.activeSub = subShieldIdx; // Revert sub-hand to Shield to maintain defense
                }
            }
        }

        // Raygust Shield Mode vs Blade Mode state determination
        const hasRaygustMain = this.briefcase.main[this.activeMain] === 'Raygust';
        const hasRaygustSub = this.briefcase.sub[this.activeSub] === 'Raygust';
        const hasRaygustActive = hasRaygustMain || hasRaygustSub;
        if (hasRaygustActive && this.targetAgent) {
            // Check if the target is cornered near a wall or boundary
            const target = this.targetAgent;
            const isTargetNearWall = arena.isWall(target.x - 45, target.y) ||
                arena.isWall(target.x + 45, target.y) ||
                arena.isWall(target.x, target.y - 45) ||
                arena.isWall(target.x, target.y + 45) ||
                target.x < 60 || target.x > arena.width - 60 ||
                target.y < 60 || target.y > arena.height - 60;

            if (isTargetNearWall) {
                this.isRaygustShieldActive = false; // Cornered: switch to sharp blade mode to strike!
            } else {
                this.isRaygustShieldActive = true; // Open/Neutral: maintain slow heavy Shield Mode
            }
        } else {
            this.isRaygustShieldActive = false;
        }

        // Apply speed modifiers (dual Scorpion, friendly/enemy Spider, weight stacks)
        let currentSpeed = this.speed;

        // Raygust Shield Mode speed penalty (slow but constant pressure)
        if (this.isRaygustShieldActive) {
            currentSpeed *= 0.50; // 50% speed penalty while pushing with heavy Raygust shield
        }

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
            if (this.teamId && agent.teamId && agent.teamId === this.teamId) continue; // Skip teammates!

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
            else if ((this.state === 'patrol' || !this.targetAgent) && this.teamId && typeof allAgents !== 'undefined') {
                const captain = allAgents.find(a => a.teamId === this.teamId && a.isCaptain && !a.bailedOut);
                if (captain && captain !== this) {
                    const myIndex = parseInt(this.id.split('_')[1] || '0', 10);
                    const followAngle = (myIndex * 2 * Math.PI) / 3;
                    const followRadius = 90;
                    tx = captain.x + Math.cos(followAngle) * followRadius;
                    ty = captain.y + Math.sin(followAngle) * followRadius;

                    const fDistSq = (tx - this.x) ** 2 + (ty - this.y) ** 2;
                    if (fDistSq < 45 * 45) {
                        tx = this.x;
                        ty = this.y;
                    }
                }
            }
            else if (this.state === 'snipe' && this.targetAgent) {
                const hasSniper = this.briefcase.main.some(t => t === 'Egret' || t === 'Ibis' || t === 'Lightning');
                if (hasSniper) {
                    // Camp furthest map corner from the threat
                    const corners = [
                        { x: 100, y: 100 },
                        { x: arena.width - 100, y: 100 },
                        { x: 100, y: arena.height - 100 },
                        { x: arena.width - 100, y: arena.height - 100 }
                    ];
                    let bestCorner = corners[0];
                    let maxCornerDist = 0;
                    for (const corner of corners) {
                        const cDistSq = (corner.x - this.targetAgent.x) ** 2 + (corner.y - this.targetAgent.y) ** 2;
                        if (cDistSq > maxCornerDist) {
                            maxCornerDist = cDistSq;
                            bestCorner = corner;
                        }
                    }
                    tx = bestCorner.x;
                    ty = bestCorner.y;
                } else {
                    // Snipe state: keep maximum distance but in sight
                    const angle = Math.atan2(this.y - this.targetAgent.y, this.x - this.targetAgent.x);
                    tx = this.targetAgent.x + Math.cos(angle) * 700;
                    ty = this.targetAgent.y + Math.sin(angle) * 700;
                }
            }
            else if (this.state === 'flee' && this.targetAgent) {
                const hasSniper = this.briefcase.main.some(t => t === 'Egret' || t === 'Ibis' || t === 'Lightning');
                if (hasSniper) {
                    // Flee to furthest corner
                    const corners = [
                        { x: 100, y: 100 },
                        { x: arena.width - 100, y: 100 },
                        { x: 100, y: arena.height - 100 },
                        { x: arena.width - 100, y: arena.height - 100 }
                    ];
                    let bestCorner = corners[0];
                    let maxCornerDist = 0;
                    for (const corner of corners) {
                        const cDistSq = (corner.x - this.targetAgent.x) ** 2 + (corner.y - this.targetAgent.y) ** 2;
                        if (cDistSq > maxCornerDist) {
                            maxCornerDist = cDistSq;
                            bestCorner = corner;
                        }
                    }
                    tx = bestCorner.x;
                    ty = bestCorner.y;
                } else {
                    // Run opposite direction
                    const angle = Math.atan2(this.y - this.targetAgent.y, this.x - this.targetAgent.x);
                    tx = this.x + Math.cos(angle) * 200;
                    ty = this.y + Math.sin(angle) * 200;
                }
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

        // Force Shield active while reloading a Gunner weapon
        if (this.gunnerReloadTimer > 0 && this.trion > 0) {
            const hasShield = this.briefcase.main.includes("Shield") || this.briefcase.sub.includes("Shield");
            if (hasShield) {
                this.isShieldActive = true;
            }
        }

        // Halt movement for Attacker AI when shield is active to block incoming bullets (perfect shield-chase block)
        const activeMainConfig = window.TRIGGER_CATALOG[this.briefcase.main[this.activeMain]];
        if (this.isShieldActive && !this.isRaygustShieldActive && activeMainConfig && activeMainConfig.category === 'attacker') {
            this.vx = 0;
            this.vy = 0;
        }

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
        const hasBagworm = this.briefcase.main.includes('Bagworm') || this.briefcase.sub.includes('Bagworm');
        const hasSniper = this.briefcase.main.some(t => t === 'Egret' || t === 'Ibis' || t === 'Lightning');

        if (!hasBagworm) {
            this.isBagwormActive = false;
            if (hasSniper) {
                this.state = this.trion < 400 ? 'flee' : 'snipe';
                return;
            }
            if (this.trion < 300) {
                this.state = 'flee';
            } else {
                this.state = Math.random() > 0.4 ? 'chase' : 'patrol';
            }
            return;
        }

        // If they have Bagworm, apply prefersBagworm trait logic
        if (hasSniper) {
            this.state = this.trion < 400 ? 'flee' : 'snipe';
            if (this.prefersBagworm) {
                this.isBagwormActive = this.state === 'flee' ? (Math.random() < 0.9) : (Math.random() < 0.95);
            } else {
                this.isBagwormActive = this.state === 'flee' ? (Math.random() < 0.2) : false;
            }
            return;
        }

        if (this.trion < 300) {
            this.state = 'flee';
            this.isBagwormActive = this.prefersBagworm ? (Math.random() < 0.9) : (Math.random() < 0.2);
        } else {
            this.state = Math.random() > 0.4 ? 'chase' : 'patrol';
            if (this.prefersBagworm) {
                if (this.state === 'patrol' || !this.targetAgent) {
                    this.isBagwormActive = Math.random() < 0.85;
                } else {
                    this.isBagwormActive = Math.random() < 0.35;
                }
            } else {
                this.isBagwormActive = false;
            }
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

        // Track target's velocity history for Sniper zigzag check
        if (this.targetAgent) {
            if (!this.targetVelocityHistory) {
                this.targetVelocityHistory = [];
            }
            const targetSpeed = Math.sqrt(this.targetAgent.vx ** 2 + this.targetAgent.vy ** 2);
            if (targetSpeed > 1) {
                this.targetVelocityHistory.push(Math.atan2(this.targetAgent.vy, this.targetAgent.vx));
                if (this.targetVelocityHistory.length > 30) {
                    this.targetVelocityHistory.shift();
                }
            }
        }

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
            // Smart tactical anchor search
            const nearbySolidTiles = [];
            const searchRadius = 240;
            
            const startCol = Math.max(0, Math.floor((this.x - searchRadius) / arena.tileSize));
            const endCol = Math.min(arena.cols - 1, Math.floor((this.x + searchRadius) / arena.tileSize));
            const startRow = Math.max(0, Math.floor((this.y - searchRadius) / arena.tileSize));
            const endRow = Math.min(arena.rows - 1, Math.floor((this.y + searchRadius) / arena.tileSize));

            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const tile = arena.grid[r][c];
                    if (tile && tile.type !== 'empty') {
                        const tx = tile.x + arena.tileSize / 2;
                        const ty = tile.y + arena.tileSize / 2;
                        const d = Math.sqrt((tx - this.x) ** 2 + (ty - this.y) ** 2);
                        if (d <= searchRadius) {
                            nearbySolidTiles.push({ x: tx, y: ty });
                        }
                    }
                }
            }

            // Find all valid obstacle center pairs separated by <= 200px (Anchor Distance Limit!)
            let validPairs = [];
            for (let i = 0; i < nearbySolidTiles.length; i++) {
                for (let j = i + 1; j < nearbySolidTiles.length; j++) {
                    const t1 = nearbySolidTiles[i];
                    const t2 = nearbySolidTiles[j];
                    const d = Math.sqrt((t1.x - t2.x) ** 2 + (t1.y - t2.y) ** 2);
                    if (d >= 40 && d <= 200) {
                        validPairs.push({ t1, t2, d });
                    }
                }
            }

            // If no valid anchor pairs exist in range, do not shoot kawat to avoid screen floating spam!
            if (validPairs.length > 0) {
                // Deactivate Bagworm and deduct Trion cost
                this.isBagwormActive = false;
                this.trion -= 40;

                // Select a random valid pair
                const selectedPair = validPairs[Math.floor(Math.random() * validPairs.length)];
                const x1 = selectedPair.t1.x;
                const y1 = selectedPair.t1.y;
                const x2 = selectedPair.t2.x;
                const y2 = selectedPair.t2.y;

                arena.addSpiderWeb(x1, y1, x2, y2, this.id);
                window.audio.playShieldBlock();

                // Increment consecutive spider placement count for overheating cooldown
                this.spiderConsecutiveCount = (this.spiderConsecutiveCount || 0) + 1;
                if (this.spiderConsecutiveCount >= 4) {
                    this.spiderConsecutiveCount = 0;
                    this.cooldowns.sub = 1800; // 1.8 seconds overheat casting cooldown after 4 consec wires!
                    if (typeof addLog !== 'undefined') {
                        addLog(`[TACTICAL] AI ${this.name} Spider trigger overheated! Cooldown recovery active.`, 'system');
                    }
                } else {
                    this.cooldowns.sub = 800; // standard 0.8s cooldown
                }
                return;
            }
        }


        // B. Grasshopper Emergency Escape or Execution Leaps
        const hasGrasshopper = this.briefcase.main.includes('Grasshopper') || this.briefcase.sub.includes('Grasshopper');
        if (hasGrasshopper && this.cooldowns.sub <= 0 && this.trion >= 30) {
            const targetActiveMain = this.targetAgent.briefcase.main[this.targetAgent.activeMain];
            const targetMainConfig = window.TRIGGER_CATALOG[targetActiveMain];
            const targetIsAttacker = targetMainConfig && targetMainConfig.category === 'attacker';
            const isTargetLowHP = this.targetAgent.bodyHp < this.targetAgent.bodyHpMax * 0.3;

            let shouldJump = false;
            let jumpDir = this.angle; // default jump forward

            if (dist < 100 && targetIsAttacker) {
                // Escape Backward when ambushed by an Attacker close range
                shouldJump = true;
                jumpDir = this.angle + Math.PI; // Jump backwards!
            } else if (dist > 120 && dist < 250 && isTargetLowHP) {
                // Forward Leap to close in and execute a low HP target
                shouldJump = true;
                jumpDir = this.angle; // Jump forward!
            }

            if (shouldJump) {
                this.trion -= 30;

                // Spawn Grasshopper Pad
                const pad = new window.GrasshopperPad(this.x, this.y, this.id);
                grPads.push(pad);

                // Apply velocity impulse immediately
                const jumpForce = 15;
                this.vx = Math.cos(jumpDir) * jumpForce;
                this.vy = Math.sin(jumpDir) * jumpForce;
                this.isDashing = true;
                this.dashTimer = 10; // Locks steering control briefly for natural physical jump feel

                window.audio.playShieldBlock(); // Play jump sound
                this.cooldowns.sub = 800; // Cooldown
                return;
            }
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

                // A. Sniper Quota checks
                if (weaponName === 'Egret' && this.egretCount >= 10) return;
                if (weaponName === 'Ibis' && this.ibisCount >= 5) return;
                if (weaponName === 'Lightning' && this.lightningCount >= 15) return;

                // B. Target zigzag tracking & fire restriction
                let isZigzagging = false;
                if (this.targetVelocityHistory && this.targetVelocityHistory.length >= 10) {
                    let diffSum = 0;
                    for (let i = 1; i < this.targetVelocityHistory.length; i++) {
                        let diff = this.targetVelocityHistory[i] - this.targetVelocityHistory[i - 1];
                        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // Normalize difference
                        diffSum += Math.abs(diff);
                    }
                    const avgChange = diffSum / (this.targetVelocityHistory.length - 1);
                    if (avgChange > 0.22) { // Angle change > 0.22 radians indicates erratic zigzag movement
                        isZigzagging = true;
                    }
                }

                if (isZigzagging) {
                    return; // Hold sniper fire to conserve core Trion ammunition!
                }

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
                    this.prefersBagworm = false;  // Discard Bagworm permanently

                    if (weaponName === 'Ibis') {
                        this.ibisCount++; // Consumes 1 Ibis charges (limit 5 per match)
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

                        if (weaponName === 'Egret') this.egretCount++; // Consumes Egret (limit 10 per match)
                        else this.lightningCount++;                   // Consumes Lightning (limit 15 per match)

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
        if (canFuse && this.trion > 420 && this.cooldowns.main <= 0 && this.cooldowns.sub <= 0 && this.compositeSilenceTimer <= 0 && Math.random() > 0.65) {

            // Smart tactical cover check for AI composite bullets
            let isSafeToFuse = false;

            // Scenario A: Threat is far away (more than 350px)
            if (dist > 350) {
                isSafeToFuse = true;
            } else if (this.targetAgent) {
                // Scenario B: AI is behind cover (a wall blocks direct line of sight)
                const ray = arena.raycast(this.x, this.y, this.targetAgent.x, this.targetAgent.y);
                if (ray.hit) {
                    isSafeToFuse = true;
                } else {
                    // Scenario C: A teammate is closer to the target than this AI (acting as a distraction)
                    const teammates = allAgents.filter(a => a.id !== this.id && a.teamId === this.teamId && !a.bailedOut);
                    const anyTeammateCloser = teammates.some(t => {
                        const distToTarget = Math.sqrt((t.x - this.targetAgent.x) ** 2 + (t.y - this.targetAgent.y) ** 2);
                        return distToTarget < dist;
                    });
                    if (anyTeammateCloser) {
                        isSafeToFuse = true;
                    }
                }
            }

            if (isSafeToFuse) {
                this.isBagwormActive = false; // Cloak is discharged
                this.prefersBagworm = false;
                this.trion -= 80;

                this.compositeChargeTimer = 1800; // 1.8 seconds charge delay
                this.compositeFusionType = Math.random() > 0.5 ? 'gimlet' : 'hornet';
                this.isShieldActive = false; // ensure shields are disabled

                if (typeof addLog !== 'undefined') {
                    addLog(`[TACTICAL] AI ${this.name} started fusing ${this.compositeFusionType.toUpperCase()} composite bullet!`, 'system');
                }
                return;
            }
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

            // Vulnerability Check for smart Senku deployment
            let isTargetVulnerable = false;
            if (this.targetAgent) {
                const isTargetReloading = (this.targetAgent.gunnerReloadTimer && this.targetAgent.gunnerReloadTimer > 0) ||
                    (this.targetAgent.shooterDelayTimer && this.targetAgent.shooterDelayTimer > 0);

                // Dot product check for target looking away
                const targetToAIX = this.x - this.targetAgent.x;
                const targetToAIY = this.y - this.targetAgent.y;
                const targetHeadingX = Math.cos(this.targetAgent.angle);
                const targetHeadingY = Math.sin(this.targetAgent.angle);
                const dot = targetToAIX * targetHeadingX + targetToAIY * targetHeadingY;
                const isTargetLookingAway = dot < 0; // negative means target is facing away from the AI

                isTargetVulnerable = isTargetReloading || isTargetLookingAway;
            }

            if (activeMainName === 'Kogetsu' && hasSenku && this.senkuCount < 3 && isTargetVulnerable && dist > 45 && dist < 160 && this.cooldowns.sub <= 0 && this.trion >= 60) {
                this.isBagwormActive = false;
                this.trion -= 60;
                this.senkuCount++; // Consumes 1 Senku charges (limit 3 per match)
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
            let maxRange = activeMainConfig.range || 40;
            if (activeMainName === 'Kogetsu') maxRange = 50; // Swing Kogetsu only if dist < 50px

            // Raygust cannot swing while in heavy Shield Mode
            const canRaygustSwing = activeMainName !== 'Raygust' || !this.isRaygustShieldActive;

            if (canRaygustSwing && dist < maxRange && this.cooldowns.main <= 0 && this.trion >= activeMainConfig.trionCost) {
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
                        range: maxRange
                    });
                }
                if (window.cutSpiderWebsInArc) {
                    window.cutSpiderWebsInArc(this, maxRange);
                }
                return;
            }
        }

        // ==========================================
        // 5. SHOOTERS TRIGGERS (Asteroid, Hound, Meteora, Viper)
        // ==========================================
        if (activeMainConfig && activeMainConfig.category === 'shooter' && this.cooldowns.main <= 0 && this.compositeSilenceTimer <= 0) {
            const bulletType = activeMainName.toLowerCase();
            const leadActive = this.briefcase.sub.includes('Lead Bullet');
            const isDualShooter = (activeMainName === activeSubName);

            // 1. Quota & Delay Checks
            if (this.shooterDelayTimer > 0) return;
            if (bulletType === 'asteroid' && this.asteroidCount >= 40) return;
            if (bulletType === 'meteora' && this.meteoraCount >= 10) return;

            let bulletCost = activeMainConfig.trionCost + (leadActive ? 40 : 0);
            let fireDouble = isDualShooter;

            // 2. Hound Tactical Check
            if (bulletType === 'hound') {
                if (dist <= 150) return; // Do not fire Hound up close

                const ray = arena.raycast(this.x, this.y, this.targetAgent.x, this.targetAgent.y);
                const targetHeadingX = Math.cos(this.targetAgent.angle);
                const targetHeadingY = Math.sin(this.targetAgent.angle);
                const targetToAIX = this.x - this.targetAgent.x;
                const targetToAIY = this.y - this.targetAgent.y;
                const dot = targetToAIX * targetHeadingX + targetToAIY * targetHeadingY;
                const isTargetFleeing = dot < 0;
                const isBehindObstacle = ray.hit;

                if (!isTargetFleeing && !isBehindObstacle) return; // Only fire if fleeing or behind cover
            }

            // 3. Viper Tactical & Preset Checks
            if (bulletType === 'viper') {
                const ray = arena.raycast(this.x, this.y, this.targetAgent.x, this.targetAgent.y);
                const isPlayerShielding = this.targetAgent.isShieldActive;
                if (!ray.hit && !isPlayerShielding) return; // Only fire if behind walls or player is shielding
            }

            // 4. Trion Cost Deduction & Bagworm discharge
            let burstMultiplier = (bulletType === 'asteroid' || bulletType === 'meteora') ? 4 : 1;
            let totalCost = bulletCost * burstMultiplier * (fireDouble ? 2 : 1);

            if (this.trion >= totalCost) {
                this.isBagwormActive = false; // Discharging shooter bullets deactivates Bagworm
                this.prefersBagworm = false;  // Discard Bagworm permanently after first shot
                this.trion -= totalCost;
            } else {
                return;
            }

            let shootAngle = this.angle;
            if (this.difficulty === 'easy') {
                shootAngle += (Math.random() - 0.5) * 0.35;
            } else if (this.difficulty === 'medium') {
                shootAngle += (Math.random() - 0.5) * 0.12;
            }

            // 5. Fire Bullets
            if (bulletType === 'viper') {
                // Programmable viper bullet snap trajectories (Patah Kiri / Patah Kanan)
                const isPatahKiri = Math.random() > 0.5;
                const perpAngle = shootAngle + (isPatahKiri ? Math.PI / 2 : -Math.PI / 2);
                const wp1 = {
                    x: this.x + Math.cos(shootAngle) * (dist * 0.4) + Math.cos(perpAngle) * 120,
                    y: this.y + Math.sin(shootAngle) * (dist * 0.4) + Math.sin(perpAngle) * 120
                };
                const wp2 = {
                    x: this.x + Math.cos(shootAngle) * (dist * 0.8) + Math.cos(perpAngle) * 120,
                    y: this.y + Math.sin(shootAngle) * (dist * 0.8) + Math.sin(perpAngle) * 120
                };
                const wp3 = {
                    x: this.targetAgent.x,
                    y: this.targetAgent.y
                };
                const wps = [wp1, wp2, wp3];

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
                window.audio.playShoot(bulletType);
                this.cooldowns.main = activeMainConfig.cooldown;
            }
            else if (bulletType === 'asteroid' || bulletType === 'meteora') {
                // 4-Bullet Burst Mode with 2-second retreat delay
                for (let i = 0; i < 4; i++) {
                    setTimeout(() => {
                        if (this.bailedOut || (typeof matchActive !== 'undefined' && !matchActive)) return;

                        // Increment fired count
                        if (bulletType === 'asteroid') this.asteroidCount++;
                        else this.meteoraCount++;

                        const spread = (Math.random() - 0.5) * 0.15;
                        if (fireDouble) {
                            bullets.push(new window.Bullet(this.x, this.y, shootAngle - 0.06 + spread, {
                                type: bulletType,
                                damage: leadActive ? 0 : activeMainConfig.damage,
                                speed: activeMainConfig.speed,
                                ownerId: this.id,
                                isLeadBullet: leadActive,
                                color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                                size: leadActive ? 12 : 8
                            }));
                            bullets.push(new window.Bullet(this.x, this.y, shootAngle + 0.06 + spread, {
                                type: bulletType,
                                damage: leadActive ? 0 : activeMainConfig.damage,
                                speed: activeMainConfig.speed,
                                ownerId: this.id,
                                isLeadBullet: leadActive,
                                color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                                size: leadActive ? 12 : 8
                            }));
                        } else {
                            bullets.push(new window.Bullet(this.x, this.y, shootAngle + spread, {
                                type: bulletType,
                                damage: leadActive ? 0 : activeMainConfig.damage,
                                speed: activeMainConfig.speed,
                                ownerId: this.id,
                                isLeadBullet: leadActive,
                                color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                                size: leadActive ? 12 : 8
                            }));
                        }
                        window.audio.playShoot(bulletType);
                    }, i * 120);
                }

                // Force 2 seconds reload/tactical flee delay
                this.shooterDelayTimer = 2000;
                this.state = 'flee';
                this.stateTimer = 120; // 2 seconds of fleeing to seek cover
                this.cooldowns.main = activeMainConfig.cooldown + 300;
            }
            else {
                // Hound or other standard shooters
                if (fireDouble) {
                    bullets.push(new window.Bullet(this.x, this.y, shootAngle - 0.08, {
                        type: bulletType,
                        damage: leadActive ? 0 : activeMainConfig.damage,
                        speed: activeMainConfig.speed,
                        ownerId: this.id,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : '#ffdf00',
                        size: leadActive ? 12 : 8
                    }));
                    bullets.push(new window.Bullet(this.x, this.y, shootAngle + 0.08, {
                        type: bulletType,
                        damage: leadActive ? 0 : activeMainConfig.damage,
                        speed: activeMainConfig.speed,
                        ownerId: this.id,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : '#ffdf00',
                        size: leadActive ? 12 : 8
                    }));
                } else {
                    bullets.push(new window.Bullet(this.x, this.y, shootAngle, {
                        type: bulletType,
                        damage: leadActive ? 0 : activeMainConfig.damage,
                        speed: activeMainConfig.speed,
                        ownerId: this.id,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : '#ffdf00',
                        size: leadActive ? 12 : 8
                    }));
                }
                window.audio.playShoot(bulletType);
                this.cooldowns.main = activeMainConfig.cooldown;
            }
            return;
        }

        // ==========================================
        // 6. GUNNERS TRIGGERS (Assault Rifle, Shotgun)
        // ==========================================
        if (activeMainConfig && activeMainConfig.category === 'gunner' && this.cooldowns.main <= 0) {
            // 1. Range & Reload Checks
            if (dist > 250) return; // Out of Range!
            if (this.gunnerReloadTimer > 0) return; // Reloading!

            const leadActive = this.briefcase.sub.includes('Lead Bullet');
            let bulletCost = activeMainConfig.trionCost + (leadActive ? 40 : 0);

            if (this.trion >= bulletCost) {
                this.isBagwormActive = false; // Discharging shooter bullets deactivates Bagworm
                this.prefersBagworm = false;  // Discard Bagworm permanently after first shot
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

            // 2. Increment magazine count & reload trigger
            this.gunnerFiredCount++;
            if (this.gunnerFiredCount >= 10) {
                this.gunnerReloadTimer = 1500; // 1.5 seconds reload state
                this.gunnerFiredCount = 0;     // Reset magazine
                this.isShieldActive = true;    // Instantly trigger defensive shield
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

        // Determine AIAgent theme color based on preset or team color
        let themeColor = this.teamColor;
        if (!themeColor) {
            themeColor = '#ff3b30'; // Default red
            if (this.preset === 'yuma') themeColor = '#ff3b30';      // Red
            else if (this.preset === 'osamu') themeColor = '#ffdf00';     // Gold/Amber
            else if (this.preset === 'chika') themeColor = '#e040fb';     // Purple/Pink
            else if (this.preset === 'hyuse') themeColor = '#00e676';     // Emerald/Green
        }

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

        let drawRaygustShield = this.isRaygustShieldActive;
        let drawShield = this.isShieldActive;
        if (this.compositeChargeTimer && this.compositeChargeTimer > 0) {
            drawRaygustShield = false;
            drawShield = false;
        }

        // Draw active Raygust Shield Mode (widened front green shield)
        if (drawRaygustShield) {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 255, 20, 0.95)';
            ctx.lineWidth = 8;
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#00ff14';

            const shieldAngle = 120; // Wide 120-degree heavy shield
            const shieldRad = (shieldAngle * Math.PI) / 360; // half angle bounds
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, -shieldRad, shieldRad);
            ctx.stroke();
            ctx.restore();
        }

        // Draw active Shield arc if AI is blocking
        if (drawShield) {
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

        // Draw Fusing Composite Trion Cubes!
        if (this.compositeChargeTimer && this.compositeChargeTimer > 0) {
            ctx.save();
            const progress = (1800 - this.compositeChargeTimer) / 1800;
            const shift = progress * 30; // move from 30px to 0px

            let cubeColor = '#ffd700'; // gold fallback
            if (this.compositeFusionType === 'tomahawk') cubeColor = '#ff5722';
            else if (this.compositeFusionType === 'salamander') cubeColor = '#ff9800';
            else if (this.compositeFusionType === 'hornet') cubeColor = '#bd00ff';
            else if (this.compositeFusionType === 'cobra') cubeColor = '#00e5ff';

            ctx.shadowBlur = 8 + progress * 12;
            ctx.shadowColor = cubeColor;
            ctx.fillStyle = cubeColor;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;

            if (progress < 0.9) {
                // Draw two smaller cubes approaching
                const size = 6 + progress * 4;
                const leftY = -30 + shift;
                const rightY = 30 - shift;

                // Left cube
                ctx.fillRect(-size / 2, leftY - size / 2, size, size);
                ctx.strokeRect(-size / 2, leftY - size / 2, size, size);

                // Right cube
                ctx.fillRect(-size / 2, rightY - size / 2, size, size);
                ctx.strokeRect(-size / 2, rightY - size / 2, size, size);
            } else {
                // Fused! Draw a single large glowing cube in center
                const size = 12 + (progress - 0.9) * 15;
                ctx.shadowBlur = 20;
                ctx.fillRect(-size / 2, -size / 2, size, size);
                ctx.strokeRect(-size / 2, -size / 2, size, size);
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
            const prefix = this.teamId ? `[T${this.teamId}] ` : '';
            ctx.fillText(`${prefix}${this.name.toUpperCase()} [${trionVal}/${this.trionMax}]`, this.x, this.y - 25);

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

    fireAICompositeBulletFinal(bullets, logs) {
        const fusionType = this.compositeFusionType;
        if (!fusionType) return;

        if (fusionType === 'gimlet') {
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
        } else if (fusionType === 'hornet') {
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

        // Apply Recoil Slide (AI slides backward)
        const recoilSpeed = 9;
        this.vx = Math.cos(this.angle + Math.PI) * recoilSpeed;
        this.vy = Math.sin(this.angle + Math.PI) * recoilSpeed;
        this.isDashing = true;
        this.dashTimer = 10;

        // Apply 3s Silenced Cooldown
        this.compositeSilenceTimer = 3000;
        this.cooldowns.main = 3000;
        this.cooldowns.sub = 3000;

        this.compositeFusionType = null;
    }
}


// Bind to window global
window.AIAgent = AIAgent;
