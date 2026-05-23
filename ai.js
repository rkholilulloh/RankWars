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
window.agentImages.yuma.src = 'YumaChibi.png';
window.agentImages.osamu.src = 'OsamuChibi.png';
window.agentImages.chika.src = 'ChikaChibi.png';
window.agentImages.hyuse.src = 'HyuseChibi.png';
window.agentImages.custom.src = 'KyosukeChibi.png';

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
        this.trionMax = (preset === 'chika' ? 480 : (preset === 'hyuse' ? 240 : (preset === 'osamu' ? 100 : 200))) * boost;
        this.trion = this.trionMax;

        const hpBoost = window.hpBoostFactor || 1.0;
        this.bodyHpMax = 100 * hpBoost;
        this.bodyHp = this.bodyHpMax;
        this.isLeaking = false;
        this.leakRate = 0;

        // Movement Debuffs (Lead Bullet stack counts)
        this.isWeighted = false;
        this.weightStacks = 0; // stack up to 3 times
        this.isDashing = false;
        this.dashTimer = 0;

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

                        const currentShieldAngle = isFullShield ? 150 : this.shieldAngle;
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
                            // Full Shield holds! Only drain 2% of the damage as Trion cost
                            this.trion -= amount * 0.02;
                            window.audio.playShieldBlock();
                            if (window.spawnSparks) {
                                window.spawnSparks(this.x + Math.cos(this.angle) * 22, this.y + Math.sin(this.angle) * 22, '#ffd700', 16);
                            }
                        } else {
                            // Standard Shield holds! Completely block damage to Trion HP body, charge 8% Trion cost
                            this.trion -= amount * 0.08;
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

        // Active leakage if HP falls below 50%
        if (this.bodyHp < this.bodyHpMax * 0.5 && !this.isLeaking) {
            this.isLeaking = true;
            this.leakRate = 1; // 1 point per second passively
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
        if (this.isBagwormActive) this.trion -= 0.03;
        if (this.isChameleonActive) this.trion -= 0.06;

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
                if (dist < this.radius + 3) {
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

        if (inEnemySpider) {
            currentSpeed *= 0.4;
        } else if (inFriendlySpider) {
            currentSpeed *= 1.3;
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
            // Bagworm detection limit: 220px
            if (agent.isBagwormActive && dist > 220) continue;
            // Chameleon detection limit: 70px
            if (agent.isChameleonActive && dist > 70) continue;

            if (dist < threatDist) {
                threatDist = dist;
                nearestThreat = agent;
            }
        }

        this.targetAgent = nearestThreat;

        // 2. STEERING & MOVEMENT CONTROL
        if (this.isDashing) {
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
                tx = this.targetAgent.x + Math.cos(angle) * 450;
                ty = this.targetAgent.y + Math.sin(angle) * 450;
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
                if (this.state === 'patrol') {
                    this.chooseNewPatrolTarget(arena);
                }
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
            if (this.state === 'patrol') {
                this.chooseNewPatrolTarget(arena);
            }
        }

        // 3. COMBAT ACTIONS & TRIGGER USE
        if (this.targetAgent && threatDist < 600) {
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
        if (this.preset === 'chika') {
            this.state = this.trion < 40 ? 'flee' : 'snipe';
            if (this.state === 'flee') {
                this.isBagwormActive = true; // cloaked sniper trying to escape
            } else {
                // Sniper presets use Bagworm while patrolling or randomly while holding angle
                this.isBagwormActive = Math.random() > 0.4;
            }
            return;
        }

        if (this.trion < 30) {
            this.state = 'flee';
            this.isBagwormActive = true; // hide to run away
        } else {
            this.isBagwormActive = Math.random() > 0.6; // randomly deploy camouflage
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
            this.trion -= 0.1;
            this.isShieldActive = true;
        } else {
            this.isShieldActive = false;
        }
    }

    performCombatAction(dist, bullets, grPads, arena) {
        if (this.isChameleonActive) return; // Chameleon strictly locks other slots and blocks AI actions!

        const isSniper = this.preset === 'chika';
        const isAttacker = this.preset === 'yuma';
        const isShooter = this.preset === 'osamu';
        const isAllRounder = this.preset === 'hyuse';

        // 1. Snipers Action (Egret / Lightning)
        // 1. Snipers Action (Egret / Lightning)
        if (isSniper && this.cooldowns.main <= 0) {
            const slotIndex = Math.random() > 0.5 ? 1 : 0;
            const weaponName = this.briefcase.main[slotIndex];
            const trig = window.TRIGGER_CATALOG[weaponName];

            if (trig && (trig.name === 'Ibis' || trig.name === 'Lightning' || trig.name === 'Egret')) {
                // Check opposite hand for Lead Bullet
                const leadActive = this.briefcase.sub.includes('Lead Bullet');

                // Deduct cost
                let extraCost = leadActive ? 4 : 0;
                if (this.trion >= trig.trionCost + extraCost) {
                    this.trion -= (trig.trionCost + extraCost);
                } else {
                    return;
                }

                // Check Raycast line of sight with organic aiming offsets
                let targetX = this.targetAgent.x;
                let targetY = this.targetAgent.y;
                if (this.difficulty === 'easy') {
                    targetX += (Math.random() - 0.5) * 75;
                    targetY += (Math.random() - 0.5) * 75;
                } else if (this.difficulty === 'medium') {
                    targetX += (Math.random() - 0.5) * 20;
                    targetY += (Math.random() - 0.5) * 20;
                }

                const ray = arena.raycast(this.x, this.y, targetX, targetY);
                if (!ray.hit) { // Direct line of sight!
                    this.isBagwormActive = false; // Discharging trigger deactivates Bagworm
                    if (weaponName === 'Ibis') {
                        // Shoot giant slow projectile
                        let shootAngle = this.angle;
                        if (this.difficulty === 'easy') {
                            shootAngle += (Math.random() - 0.5) * 0.25;
                        }
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
                        // Hitscan Lightning / Egret
                        let didHit = true;
                        if (this.difficulty === 'easy' && Math.random() > 0.4) didHit = false;
                        else if (this.difficulty === 'medium' && Math.random() > 0.85) didHit = false;

                        window.audio.playHitscan(weaponName === 'Lightning');
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
                }
            }
        }

        // Tactically select the best trigger slot depending on range
        if (dist < 80) {
            const mainAttackerIdx = this.briefcase.main.findIndex(t => window.TRIGGER_CATALOG[t] && window.TRIGGER_CATALOG[t].category === 'attacker');
            if (mainAttackerIdx !== -1 && this.activeMain !== mainAttackerIdx) {
                this.activeMain = mainAttackerIdx;
            }
            const subAttackerIdx = this.briefcase.sub.findIndex(t => window.TRIGGER_CATALOG[t] && window.TRIGGER_CATALOG[t].category === 'attacker');
            if (subAttackerIdx !== -1 && this.activeSub !== subAttackerIdx) {
                this.activeSub = subAttackerIdx;
            }
        } else if (dist > 120 && dist < 450) {
            const mainShooterIdx = this.briefcase.main.findIndex(t => window.TRIGGER_CATALOG[t] && window.TRIGGER_CATALOG[t].category === 'shooter');
            if (mainShooterIdx !== -1 && this.activeMain !== mainShooterIdx) {
                this.activeMain = mainShooterIdx;
            }
        }

        // 2. Attackers Action (Scorpion / Kogetsu / Raygust / Thruster / Grasshopper)
        const mainTrigName = this.briefcase.main[this.activeMain];
        const mainConfig = window.TRIGGER_CATALOG[mainTrigName];
        if (mainConfig && mainConfig.category === 'attacker') {
            if (dist < (mainConfig.range || 40) && this.cooldowns.main <= 0 && this.trion >= mainConfig.trionCost) {
                this.isBagwormActive = false; // Close-range slash deactivates Bagworm
                this.trion -= mainConfig.trionCost;

                let damage = mainConfig.damage || 22;
                const isKogetsu = mainTrigName === 'Kogetsu';
                const hasDualKogetsu = isKogetsu && this.briefcase.sub[this.activeSub] === 'Kogetsu';
                if (hasDualKogetsu) {
                    damage = Math.floor(damage * 1.25);
                }

                window.audio.playSlash(mainTrigName === 'Scorpion');
                this.targetAgent.takeDamage(damage, this.id);
                this.cooldowns.main = mainConfig.cooldown || 140;

                // Spawn slash particles
                const parts = (typeof particles !== 'undefined') ? particles : (window.particles || null);
                if (parts) {
                    parts.push({
                        type: 'slash',
                        x: this.x,
                        y: this.y,
                        angle: this.angle,
                        color: mainTrigName === 'Scorpion' ? '#ff3b30' : (isKogetsu ? '#00f0ff' : '#00ff14'),
                        life: 10,
                        maxLife: 10,
                        range: mainConfig.range || 45
                    });
                }
            } else if (dist > 100 && dist < 220 && this.cooldowns.sub <= 0 && Math.random() > 0.7) {
                if (this.briefcase.sub[this.activeSub] === 'Grasshopper' || this.briefcase.main[this.activeMain] === 'Grasshopper') {
                    if (this.trion >= 3) { // Grasshopper trion cost is 3
                        this.trion -= 3;
                        grPads.push(new window.GrasshopperPad(this.x, this.y, this.id));
                        this.cooldowns.sub = 400;
                    }
                }
            }
        }

        // 3. Shooter / All-Rounder Action (Hound / Meteora / Viper)
        const activeMainTrig = this.briefcase.main[this.activeMain];
        const activeSubTrig = this.briefcase.sub[this.activeSub];
        const mainTrig = window.TRIGGER_CATALOG[activeMainTrig];

        if (mainTrig && mainTrig.category === 'shooter' && this.cooldowns.main <= 0) {
            const bulletType = activeMainTrig.toLowerCase();
            const leadActive = this.briefcase.sub.includes('Lead Bullet');

            // Check if dual shooter (identical active Shooter trigger in both slots)
            const isDualShooter = (activeMainTrig === activeSubTrig);

            let bulletCost = mainTrig.trionCost + (leadActive ? 4 : 0);
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

            // Apply shooting angle error based on difficulty
            let shootAngle = this.angle;
            if (this.difficulty === 'easy') {
                shootAngle += (Math.random() - 0.5) * 0.35;
            } else if (this.difficulty === 'medium') {
                shootAngle += (Math.random() - 0.5) * 0.12;
            }

            if (bulletType === 'viper') {
                // If AI uses Viper, let's create dynamic waypoints for zigzag or curve
                const p1 = { x: this.x + Math.cos(shootAngle - 0.4) * 80, y: this.y + Math.sin(shootAngle - 0.4) * 80 };
                const p2 = { x: this.x + Math.cos(shootAngle + 0.4) * 160, y: this.y + Math.sin(shootAngle + 0.4) * 160 };
                const p3 = { x: this.x + Math.cos(shootAngle) * 320, y: this.y + Math.sin(shootAngle) * 320 };
                const wps = [p1, p2, p3];

                if (fireDouble) {
                    const ox = Math.cos(shootAngle + Math.PI / 2) * 10;
                    const oy = Math.sin(shootAngle + Math.PI / 2) * 10;

                    bullets.push(new window.Bullet(this.x + ox, this.y + oy, shootAngle, {
                        type: 'viper',
                        damage: leadActive ? 0 : mainTrig.damage,
                        speed: mainTrig.speed,
                        ownerId: this.id,
                        waypoints: wps.map(wp => ({ x: wp.x + ox, y: wp.y + oy })),
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : '#ffdf00',
                        size: leadActive ? 12 : 8
                    }));

                    bullets.push(new window.Bullet(this.x - ox, this.y - oy, shootAngle, {
                        type: 'viper',
                        damage: leadActive ? 0 : mainTrig.damage,
                        speed: mainTrig.speed,
                        ownerId: this.id,
                        waypoints: wps.map(wp => ({ x: wp.x - ox, y: wp.y - oy })),
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : '#ffdf00',
                        size: leadActive ? 12 : 8
                    }));
                } else {
                    bullets.push(new window.Bullet(this.x, this.y, shootAngle, {
                        type: 'viper',
                        damage: leadActive ? 0 : mainTrig.damage,
                        speed: mainTrig.speed,
                        ownerId: this.id,
                        waypoints: wps,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : '#ffdf00',
                        size: leadActive ? 12 : 8
                    }));
                }
            } else {
                if (fireDouble) {
                    bullets.push(new window.Bullet(this.x, this.y, shootAngle - 0.08, {
                        type: bulletType,
                        damage: leadActive ? 0 : mainTrig.damage,
                        speed: mainTrig.speed,
                        ownerId: this.id,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                        size: leadActive ? 12 : 8
                    }));
                    bullets.push(new window.Bullet(this.x, this.y, shootAngle + 0.08, {
                        type: bulletType,
                        damage: leadActive ? 0 : mainTrig.damage,
                        speed: mainTrig.speed,
                        ownerId: this.id,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                        size: leadActive ? 12 : 8
                    }));
                } else {
                    bullets.push(new window.Bullet(this.x, this.y, shootAngle, {
                        type: bulletType,
                        damage: leadActive ? 0 : mainTrig.damage,
                        speed: mainTrig.speed,
                        ownerId: this.id,
                        isLeadBullet: leadActive,
                        color: leadActive ? '#121212' : (bulletType === 'meteora' ? '#ff3b30' : '#ffdf00'),
                        size: leadActive ? 12 : 8
                    }));
                }
            }

            window.audio.playShoot(bulletType);
            this.cooldowns.main = mainTrig.cooldown;

            if (Math.random() > 0.8) {
                this.activeMain = (this.activeMain + 1) % 4;
            }
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
            ctx.save();
            ctx.strokeStyle = 'rgba(57, 255, 20, 0.85)';
            ctx.lineWidth = 5;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#39ff14';

            const shieldRad = (this.shieldAngle * Math.PI) / 360; // half angle bounds
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
