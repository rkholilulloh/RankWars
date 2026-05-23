/* ==========================================================================
   TRIGGERS AND PROJECTILES MODULE - WORLD TRIGGER RANK WARS
   ========================================================================== */

// Trigger Catalog Definition with Stats & Descriptions
const TRIGGER_CATALOG = {
    // ⚔️ ATTACKER TRIGGERS
    "Kogetsu": {
        name: "Kogetsu",
        category: "attacker",
        description: "Standard, highly balanced Trion sword. Creates an arc sweep.",
        trionCost: 2,
        cooldown: 350, // ms
        damage: 42,
        range: 45 // px
    },
    "Senku": {
        name: "Senku",
        category: "attacker",
        description: "Kogetsu option. Expands blade range to 160px instantly.",
        trionCost: 6,
        cooldown: 800,
        damage: 45,
        range: 160
    },
    "Genyo": {
        name: "Genyo",
        category: "attacker",
        description: "Kogetsu option. Curves the slash arc, bypassing frontal shields.",
        trionCost: 4,
        cooldown: 600,
        damage: 38,
        range: 50
    },
    "Scorpion": {
        name: "Scorpion",
        category: "attacker",
        description: "Lightweight, highly agile blade. Short range but ultra fast.",
        trionCost: 1.5,
        cooldown: 140,
        damage: 22,
        range: 28
    },
    "Mole Claw": {
        name: "Mole Claw",
        category: "attacker",
        description: "Scorpion option. Spawns blades from the ground at target coordinates.",
        trionCost: 5,
        cooldown: 550,
        damage: 26,
        range: 150
    },
    "Raygust": {
        name: "Raygust",
        category: "attacker",
        description: "Defense/Attack hybrid blade. Can be configured into Shield Mode.",
        trionCost: 3,
        cooldown: 400,
        damage: 30,
        range: 35
    },
    "Thruster": {
        name: "Thruster",
        category: "attacker",
        description: "Raygust option. Gives a rapid speed thrust in facing direction.",
        trionCost: 4,
        cooldown: 1200,
        damage: 0,
        range: 120
    },

    // 🏹 SHOOTER TRIGGERS
    "Asteroid": {
        name: "Asteroid",
        category: "shooter",
        description: "Standard grid bullet. Melesat lurus, high speed.",
        trionCost: 3,
        cooldown: 250,
        damage: 16,
        speed: 10
    },
    "Hound": {
        name: "Hound",
        category: "shooter",
        description: "Homing bullet. Tracks down coordinates of nearest enemies.",
        trionCost: 4,
        cooldown: 300,
        damage: 12,
        speed: 8
    },
    "Viper": {
        name: "Viper",
        category: "shooter",
        description: "Programmable bullet. Draw customized waypoint curves with mouse.",
        trionCost: 4,
        cooldown: 350,
        damage: 14,
        speed: 9
    },
    "Meteora": {
        name: "Meteora",
        category: "shooter",
        description: "Explosive bullet. Creates concentric AoE circles. Breaks buildings.",
        trionCost: 6,
        cooldown: 450,
        damage: 25, // center direct hit
        speed: 7
    },

    // 🔫 GUNNER TRIGGERS
    "Assault Rifle": {
        name: "Assault Rifle",
        category: "gunner",
        description: "Automatic weapon. Rapid bullet discharge with small spread.",
        trionCost: 2.5,
        cooldown: 80,
        damage: 9,
        speed: 11
    },
    "Shotgun": {
        name: "Shotgun",
        category: "gunner",
        description: "Fires a rapid 5-bullet burst in a wide dispersion cone.",
        trionCost: 5,
        cooldown: 500,
        damage: 10, // per pellet
        speed: 9
    },

    // 🎯 SNIPER TRIGGERS
    "Egret": {
        name: "Egret",
        category: "sniper",
        description: "Standard sniper rifle. Direct hitscan beam, extremely long range.",
        trionCost: 10,
        cooldown: 1500,
        damage: 75,
        speed: 999 // instant
    },
    "Lightning": {
        name: "Lightning",
        category: "sniper",
        description: "Lightweight hitscan sniper. Low damage but drains enemy Trion directly.",
        trionCost: 8,
        cooldown: 650,
        damage: 10,
        trionDrain: 30,
        speed: 999
    },
    "Ibis": {
        name: "Ibis",
        category: "sniper",
        description: "Heavy anti-artillery sniper. Slow giant bullet, vaporizes cover tiles.",
        trionCost: 15,
        cooldown: 2000,
        damage: 95,
        speed: 5
    },

    // 🛡️ DEFENSIVE & SUPPORT TRIGGERS
    "Shield": {
        name: "Shield",
        category: "support",
        description: "Green light barrier. Resize with Scroll: Small/Strong to 360°/Weak.",
        trionCost: 1, // Passive consumption on hit
        cooldown: 100,
        damage: 0
    },
    "Grasshopper": {
        name: "Grasshopper",
        category: "support",
        description: "Spawns bounce pads. Steps trigger high speed impulse.",
        trionCost: 3,
        cooldown: 400,
        damage: 0
    },
    "Spider": {
        name: "Spider",
        category: "support",
        description: "Purple wires. Slows crossing enemy speed by 50%. Free for allies.",
        trionCost: 4,
        cooldown: 350,
        damage: 0
    },
    "Teleporter": {
        name: "Teleporter",
        category: "support",
        description: "Instant displacement up to 200px. Consumes Trion.",
        trionCost: 15,
        cooldown: 2000,
        damage: 0
    },
    "Lead Bullet": {
        name: "Lead Bullet",
        category: "support",
        description: "Optional Trigger. When active on one hand, bullets fired from the other hand deal 0 damage but apply speed-reducing Lead weights that bypass shields.",
        trionCost: 4,
        cooldown: 500,
        damage: 0
    },
    "Empty": {
        name: "Empty",
        category: "support",
        description: "Empty slot.",
        trionCost: 0,
        cooldown: 0,
        damage: 0
    }
};

/* ==========================================================================
   PROJECTILE ENTITIES CLASSES
   ========================================================================== */

class Bullet {
    constructor(x, y, angle, config = {}) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        
        this.type = config.type || 'asteroid'; // asteroid, hound, viper, meteora, ibis, gimlet, tomahawk, salamander, hornet, cobra
        this.speed = config.speed || 10;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        
        this.damage = config.damage || 15;
        this.trionCost = config.trionCost || 3;
        this.ownerId = config.ownerId || 'player';
        this.life = config.life || 180; // frames
        
        this.isLeadBullet = config.isLeadBullet || false; // lead bullet stacks
        this.isComposite = config.isComposite || false;
        
        // Homing settings
        this.target = null;
        
        // Viper / Cobra waypoint settings
        this.waypoints = config.waypoints ? [...config.waypoints] : null;
        this.waypointIndex = 0;
        
        // Size & aesthetics
        this.size = config.size || 8;
        this.color = this.isLeadBullet ? '#121212' : (config.color || '#ffdf00');
    }

    update(arena, agents) {
        this.life--;

        // 0. STRIKER SWEEPING MOTION (Zigzag spiral sweeps)
        if (this.type === 'striker') {
            if (this.strikerTime === undefined) {
                this.strikerTime = 0;
                this.baseAngle = this.angle;
            }
            this.strikerTime++;
            const frequency = 0.25;
            const amplitude = 0.7; // extreme zigzag
            this.angle = this.baseAngle + Math.sin(this.strikerTime * frequency) * amplitude;
            this.vx = Math.cos(this.angle) * this.speed;
            this.vy = Math.sin(this.angle) * this.speed;
        }
        // 1. VIPER & COBRA PATHING (Follow drawn or pre-programmed waypoints)
        else if (this.waypoints && this.waypoints.length > 0 && this.waypointIndex < this.waypoints.length) {
            const wp = this.waypoints[this.waypointIndex];
            const dx = wp.x - this.x;
            const dy = wp.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 12) {
                this.waypointIndex++;
            } else {
                const targetAngle = Math.atan2(dy, dx);
                this.vx = Math.cos(targetAngle) * this.speed;
                this.vy = Math.sin(targetAngle) * this.speed;
            }
        } 
        // 2. HOUND / TOMAHAWK / HORNET / SALAMANDER HOMING (Adjust vectors towards closest rival agent)
        else if ((this.type === 'hound' || this.type === 'tomahawk' || this.type === 'hornet' || this.type === 'salamander') && agents && agents.length > 0) {
            // Find closest rival who is not bailed out and not the owner
            let closestAgent = null;
            let minDist = 999999;
            
            for (const agent of agents) {
                if (agent.id === this.ownerId || agent.trion <= 0 || agent.isChameleonActive || agent.isBagwormActive) continue;
                const dx = agent.x - this.x;
                const dy = agent.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) {
                    minDist = dist;
                    closestAgent = agent;
                }
            }

            if (closestAgent) {
                const dx = closestAgent.x - this.x;
                const dy = closestAgent.y - this.y;
                const targetAngle = Math.atan2(dy, dx);
                
                // Gradually adjust bullet angle
                let angleDiff = targetAngle - this.angle;
                // Normalize angleDiff to -PI to PI
                angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
                
                const turnSpeed = this.type === 'tomahawk' ? 0.05 : (this.type === 'hornet' ? 0.12 : (this.type === 'salamander' ? 0.10 : 0.08));
                this.angle += Math.max(-turnSpeed, Math.min(turnSpeed, angleDiff));
                
                // Hornet accelerates in speed over time!
                if (this.type === 'hornet') {
                    this.speed = Math.min(22, this.speed + 0.12);
                }
                
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
            } else if (this.type === 'hornet') {
                // If hornet has no target, it still accelerates forward!
                this.speed = Math.min(22, this.speed + 0.12);
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
            }
        }

        // Apply velocities
        this.x += this.vx;
        this.y += this.vy;

        // Check border maps limits
        if (this.x < 0 || this.x > arena.width || this.y < 0 || this.y > arena.height) {
            this.life = 0;
            return;
        }

        // Check collidable walls
        const col = Math.floor(this.x / arena.tileSize);
        const row = Math.floor(this.y / arena.tileSize);
        if (arena.isWall(this.x, this.y)) {
            // Blow up walls with Ibis or explosive composite bullets (Meteora, Tomahawk, Salamander)
            if (this.type === 'ibis') {
                arena.damageTile(col, row, 120); // vaporizer block
                window.audio.playExplosion();
            } else if (this.type === 'meteora' || this.type === 'tomahawk' || this.type === 'salamander') {
                this.triggerExplosion(arena, agents);
            }
            this.life = 0; // Destroy projectile
        }
    }

    triggerExplosion(arena, agents) {
        window.audio.playExplosion();
        
        // Spawn debris
        arena.spawnDebris(this.x, this.y, 25);
        
        // Explosion AOE Damage Circle (80px radius)
        const radius = 80;
        const damageMax = this.damage;
        
        // Damage tiles in range
        const startCol = Math.max(0, Math.floor((this.x - radius) / arena.tileSize));
        const endCol = Math.min(arena.cols - 1, Math.floor((this.x + radius) / arena.tileSize));
        const startRow = Math.max(0, Math.floor((this.y - radius) / arena.tileSize));
        const endRow = Math.min(arena.rows - 1, Math.floor((this.y + radius) / arena.tileSize));

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const tile = arena.grid[r][c];
                if (tile.type === 'destructible') {
                    const tx = tile.x + arena.tileSize/2;
                    const ty = tile.y + arena.tileSize/2;
                    const dist = Math.sqrt((tx - this.x)**2 + (ty - this.y)**2);
                    if (dist <= radius) {
                        arena.damageTile(c, r, 60); // explosive block damage
                    }
                }
            }
        }

        // Damage agents in range
        for (const agent of agents) {
            if (agent.bailedOut) continue;
            const dist = Math.sqrt((agent.x - this.x)**2 + (agent.y - this.y)**2);
            if (dist <= radius) {
                // Scaling damage based on distance from center
                const scaling = 1 - (dist / radius);
                const actualDmg = Math.floor(damageMax * scaling);
                
                // Perform hit resolution (pass type to bypass shields if Gimlet or apply weight if Lead)
                agent.takeDamage(actualDmg, this.ownerId, this.isLeadBullet, this.type);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.color;
        ctx.shadowBlur = this.isLeadBullet ? 0 : 10;
        ctx.shadowColor = this.color;

        if (this.type === 'ibis') {
            // Draw anti-artillery giant bullet
            ctx.fillRect(-this.size, -this.size, this.size*2, this.size*2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        } else if (this.type === 'gimlet') {
            // Giant golden piercing core
            ctx.beginPath();
            ctx.moveTo(this.size * 1.8, 0);
            ctx.lineTo(-this.size * 0.8, -this.size * 1.2);
            ctx.lineTo(-this.size * 0.8, this.size * 1.2);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'tomahawk') {
            // Exploding homing grid shape
            ctx.fillRect(-this.size, -this.size, this.size*2, this.size*2);
            ctx.strokeStyle = '#ff5722';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-this.size*1.3, -this.size*1.3, this.size*2.6, this.size*2.6);
        } else if (this.type === 'salamander') {
            // Rocket fire projectile
            ctx.beginPath();
            ctx.moveTo(this.size * 1.5, 0);
            ctx.lineTo(-this.size * 0.8, -this.size * 0.8);
            ctx.lineTo(-this.size * 0.8, this.size * 0.8);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ff3d00';
            ctx.fillRect(-this.size * 1.4, -this.size * 0.4, this.size * 0.6, this.size * 0.8);
        } else if (this.type === 'hornet') {
            // Purple fast bullet with outer ring
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#e040fb';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-this.size * 1.2, -this.size * 1.2, this.size * 2.4, this.size * 2.4);
        } else if (this.type === 'cobra') {
            // Snake-like glowing cyan capsule
            ctx.fillRect(-this.size, -this.size/2, this.size*2, this.size);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-this.size * 0.5, -this.size/4, this.size, this.size/2);
        } else if (this.type === 'striker') {
            // Purple fast sweeping diamond
            ctx.beginPath();
            ctx.moveTo(this.size * 1.5, 0);
            ctx.lineTo(0, -this.size * 0.7);
            ctx.lineTo(-this.size * 1.5, 0);
            ctx.lineTo(0, this.size * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ea80fc';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else {
            // Default square / rectangular shooter projectile
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        }

        ctx.restore();
    }
}

// Interactive support items: Grasshopper Neon Jump Pads
class GrasshopperPad {
    constructor(x, y, ownerId) {
        this.x = x;
        this.y = y;
        this.size = 25; // width/height
        this.ownerId = ownerId;
        this.life = 360; // 6 seconds before decaying
        this.color = '#39ff14';
    }

    update(agents) {
        this.life--;
        
        // Check triggers when stepped on
        for (const agent of agents) {
            if (agent.trion <= 0) continue;
            
            // Check bounding circle vs bounce box
            const dist = Math.sqrt((agent.x - this.x)**2 + (agent.y - this.y)**2);
            if (dist < agent.radius + this.size/2) {
                // Apply a powerful 25 unit velocity multiplier in target/cursor direction
                const speed = 25;
                let angle = agent.angle;
                
                if (agent.id === 'player') {
                    // Check if mouse globals are available
                    const mX = (window.mouseX !== undefined) ? window.mouseX : 0;
                    const mY = (window.mouseY !== undefined) ? window.mouseY : 0;
                    const camX = (window.camera && window.camera.x !== undefined) ? window.camera.x : 0;
                    const camY = (window.camera && window.camera.y !== undefined) ? window.camera.y : 0;
                    angle = Math.atan2((mY + camY) - agent.y, (mX + camX) - agent.x);
                } else {
                    // For AI: use their target agent direction or current motion direction
                    if (agent.targetAgent) {
                        angle = Math.atan2(agent.targetAgent.y - agent.y, agent.targetAgent.x - agent.x);
                    } else if (agent.vx !== 0 || agent.vy !== 0) {
                        angle = Math.atan2(agent.vy, agent.vx);
                    }
                }

                agent.vx = Math.cos(angle) * speed;
                agent.vy = Math.sin(angle) * speed;
                
                // Set status agar WASD input/AI movement locked selama 0.3s (efek melayang)
                agent.isDashing = true;
                agent.dashTimer = 18; // 18 frames @ 60fps = 0.3s
                
                agent.isWeighted = false; // clear weight momentarily for launch!
                
                window.audio.playGrasshopper();
                this.life = 0; // Disappear instantly
                
                // Trigger flash debris rings
                break;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.lineWidth = 2.5;

        // Draw green tactical target icon
        ctx.strokeRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI*2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Corner decorative arrows
        ctx.fillStyle = 'rgba(57, 255, 20, 0.4)';
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, 6, 2);
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, 2, 6);
        ctx.fillRect(this.x + this.size/2 - 6, this.y - this.size/2, 6, 2);
        ctx.fillRect(this.x + this.size/2 - 2, this.y - this.size/2, 2, 6);
        ctx.fillRect(this.x - this.size/2, this.y + this.size/2 - 2, 6, 2);
        ctx.fillRect(this.x - this.size/2, this.y + this.size/2 - 6, 2, 6);
        ctx.restore();
    }
}

// Attach directly to window global
window.TRIGGER_CATALOG = TRIGGER_CATALOG;
window.Bullet = Bullet;
window.GrasshopperPad = GrasshopperPad;
