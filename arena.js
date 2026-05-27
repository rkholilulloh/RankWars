/* ==========================================================================
   ARENA GRID & GEOMETRY MODULE - WORLD TRIGGER RANK WARS
   ========================================================================== */

class Arena {
    constructor(width = 1200, height = 900) {
        this.width = width;
        this.height = height;
        this.tileSize = 60;
        this.cols = Math.ceil(width / this.tileSize);
        this.rows = Math.ceil(height / this.tileSize);
        this.mapType = 'cityscape'; // 'cityscape' or 'cybergrid'
        this.grid = []; // 2D array of tile objects
        this.debris = []; // particle debris from blown up walls
        this.spiderWebs = []; // array of { x1, y1, x2, y2, ownerId }
    }

    init(mapType = 'cityscape', width = 1200, height = 900) {
        this.mapType = mapType;
        this.width = width;
        this.height = height;
        this.cols = Math.ceil(this.width / this.tileSize);
        this.rows = Math.ceil(this.height / this.tileSize);
        this.grid = [];
        this.debris = [];
        this.spiderWebs = [];

        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                // Default walkable tile
                let tile = {
                    type: 'empty', // 'empty', 'indestructible', 'destructible'
                    hp: 0,
                    maxHp: 100,
                    x: c * this.tileSize,
                    y: r * this.tileSize,
                    isTree: false,
                    isMountainRock: false
                };

                // Border walls (indestructible outer boundaries)
                if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
                    tile.type = 'indestructible';
                } else {
                    // Safe spawn checking to ensure spawn points are completely clear of buildings/trees/mountains
                    const isNearAnySpawn = (
                        (c <= 4 && r <= 4) || // Top-Left
                        (c >= this.cols - 5 && r >= this.rows - 5) || // Bottom-Right
                        (c >= this.cols - 5 && r <= 4) || // Top-Right
                        (c <= 4 && r >= this.rows - 5) || // Bottom-Left
                        (c >= Math.floor(this.cols/2) - 3 && c <= Math.floor(this.cols/2) + 3 && r <= 4) || // Top-Center
                        (c >= Math.floor(this.cols/2) - 3 && c <= Math.floor(this.cols/2) + 3 && r >= this.rows - 5) || // Bottom-Center
                        (c <= 4 && r >= Math.floor(this.rows/2) - 3 && r <= Math.floor(this.rows/2) + 3) || // Left-Center
                        (c >= this.cols - 5 && r >= Math.floor(this.rows/2) - 3 && r <= Math.floor(this.rows/2) + 3) // Right-Center
                    );

                    if (mapType === 'cityscape') {
                        // Sprawling metropolitan grid blocks
                        const inBuilding = !isNearAnySpawn && (c % 9 >= 3 && c % 9 <= 6 && r % 9 >= 3 && r % 9 <= 6);
                        
                        if (inBuilding) {
                            tile.type = 'destructible';
                            tile.hp = 120; // Needs 1 Ibis shot or 2 Meteora hits to blow up
                            tile.maxHp = 120;
                        }
                    } else if (mapType === 'cityscape_large') {
                        // Dense skyscraper grid blocks across a massive area
                        const inBuilding = !isNearAnySpawn && (c % 8 >= 2 && c % 8 <= 5 && r % 8 >= 2 && r % 8 <= 5);
                        if (inBuilding) {
                            tile.type = 'destructible';
                            tile.hp = 120;
                            tile.maxHp = 120;
                        }
                    } else if (mapType === 'forest_mountain') {
                        // Sprawling rocky ridges and organic trees
                        const isMountain = !isNearAnySpawn && (c % 12 >= 5 && c % 12 <= 8 && r % 10 >= 4 && r % 10 <= 7);
                        if (isMountain) {
                            tile.type = 'indestructible';
                            tile.isMountainRock = true;
                        } else {
                            // Organic trees scattered outside spawning areas
                            if (!isNearAnySpawn && Math.random() < 0.16) {
                                tile.type = 'destructible';
                                tile.hp = 80; // Trees have lower HP
                                tile.maxHp = 80;
                                tile.isTree = true;
                            }
                        }
                    } else if (mapType === 'training_room') {
                        // Border Training Room Grid - structured columns
                        const isColumn = (
                            (c % 5 === 0 && r % 4 === 0) &&
                            (c > 2 && c < this.cols - 3 && r > 2 && r < this.rows - 3)
                        );
                        if (isColumn) {
                            tile.type = 'indestructible';
                        }
                    } else if (mapType === 'cybergrid') {
                        // Cyber Grid features small sparse pillars that cannot be destroyed
                        const isPillar = (
                            (c % 4 === 0 && r % 4 === 0) &&
                            (c > 1 && c < this.cols - 2 && r > 1 && r < this.rows - 2)
                        );

                        if (isPillar) {
                            tile.type = 'indestructible';
                        }
                    }
                }
                this.grid[r][c] = tile;
            }
        }
    }

    // Get Tile at specific pixel coordinates
    getTileAt(x, y) {
        const col = Math.floor(x / this.tileSize);
        const row = Math.floor(y / this.tileSize);
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            return this.grid[row][col];
        }
        return null;
    }

    // Direct collision check for quick point probes
    isWall(x, y) {
        const tile = this.getTileAt(x, y);
        return tile && tile.type !== 'empty';
    }

    // Circle against wall collisions (with sliding physics response)
    circleCollides(cx, cy, r) {
        const result = {
            collided: false,
            x: cx,
            y: cy,
            nx: 0,
            ny: 0
        };

        // Determine candidate tiles in bounds
        const startCol = Math.max(0, Math.floor((cx - r) / this.tileSize));
        const endCol = Math.min(this.cols - 1, Math.floor((cx + r) / this.tileSize));
        const startRow = Math.max(0, Math.floor((cy - r) / this.tileSize));
        const endRow = Math.min(this.rows - 1, Math.floor((cy + r) / this.tileSize));

        let maxOverlap = 0;

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const tile = this.grid[row][col];
                if (tile.type === 'empty') continue;

                // Find the closest point on the tile AABB to the circle center
                const tileLeft = tile.x;
                const tileRight = tile.x + this.tileSize;
                const tileTop = tile.y;
                const tileBottom = tile.y + this.tileSize;

                const closestX = Math.max(tileLeft, Math.min(cx, tileRight));
                const closestY = Math.max(tileTop, Math.min(cy, tileBottom));

                // Vector from closest point to circle center
                const distX = cx - closestX;
                const distY = cy - closestY;
                const distanceSq = distX * distX + distY * distY;

                if (distanceSq < r * r) {
                    result.collided = true;
                    const distance = Math.sqrt(distanceSq) || 0.001;
                    const overlap = r - distance;

                    if (overlap > maxOverlap) {
                        maxOverlap = overlap;
                        // Collision normal pointing away from the tile face
                        result.nx = distX / distance;
                        result.ny = distY / distance;
                        // Slide player coordinates outside
                        result.x = cx + result.nx * overlap;
                        result.y = cy + result.ny * overlap;
                    }
                }
            }
        }

        // Keep inside boundary walls absolutely
        if (result.x < r + this.tileSize) result.x = r + this.tileSize;
        if (result.x > this.width - r - this.tileSize) result.x = this.width - r - this.tileSize;
        if (result.y < r + this.tileSize) result.y = r + this.tileSize;
        if (result.y > this.height - r - this.tileSize) result.y = this.height - r - this.tileSize;

        return result;
    }

    // Raycast intersection (DDA algorithm or line-segment-tile check)
    // Used for Sniper hitscans (Egret, Lightning) and line-of-sight visual indicators
    raycast(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return { hit: false, x: x1, y: y1 };

        const stepSize = 4; // Check every 4 pixels along the path
        const steps = distance / stepSize;
        const xStep = dx / steps;
        const yStep = dy / steps;

        let currX = x1;
        let currY = y1;

        for (let i = 0; i <= steps; i++) {
            if (this.isWall(currX, currY)) {
                const col = Math.floor(currX / this.tileSize);
                const row = Math.floor(currY / this.tileSize);
                return {
                    hit: true,
                    x: currX,
                    y: currY,
                    col: col,
                    row: row,
                    tile: this.grid[row][col]
                };
            }
            currX += xStep;
            currY += yStep;
        }

        return { hit: false, x: x2, y: y2 };
    }

    // Deal damage to walls (e.g. Meteora or Ibis bullet hits destructible block)
    damageTile(col, row, damage) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
        
        const tile = this.grid[row][col];
        if (tile && tile.type === 'destructible') {
            tile.hp -= damage;
            
            // Spawn debris particles
            this.spawnDebris(tile.x + this.tileSize/2, tile.y + this.tileSize/2, 6);

            if (tile.hp <= 0) {
                tile.type = 'empty';
                tile.hp = 0;
                this.spawnDebris(tile.x + this.tileSize/2, tile.y + this.tileSize/2, 20); // Massive explosion shards
                return true; // Tile was destroyed!
            }
        }
        return false;
    }

    spawnDebris(x, y, count) {
        for (let i = 0; i < count; i++) {
            this.debris.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                color: (this.mapType === 'cityscape' || this.mapType === 'cityscape_large') ? '#5a6268' : (this.mapType === 'forest_mountain' ? '#2e7d32' : '#00f0ff'),
                size: Math.random() * 4 + 2,
                life: 30 + Math.random() * 30 // frames
            });
        }
    }

    updateDebris() {
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const p = this.debris[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.life--;
            if (p.life <= 0) {
                this.debris.splice(i, 1);
            }
        }
    }

    addSpiderWeb(x1, y1, x2, y2, ownerId) {
        // Enforce max wire quota limit (7 primary wires per owner)
        const maxWires = 7;
        const primaryWebs = this.spiderWebs.filter(w => w.ownerId === ownerId && !w.isAutoConnected);
        if (primaryWebs.length >= maxWires) {
            const oldestPrimaryIdx = this.spiderWebs.findIndex(w => w.ownerId === ownerId && !w.isAutoConnected);
            if (oldestPrimaryIdx !== -1) {
                this.spiderWebs.splice(oldestPrimaryIdx, 1);
                
                // Also clean up any auto-connected cross-wires that were orphaned
                this.spiderWebs = this.spiderWebs.filter(w => {
                    if (w.ownerId !== ownerId || !w.isAutoConnected) return true;
                    // Check if there is still a primary web sharing endpoint 1
                    const hasEnd1 = this.spiderWebs.some(pw => pw.ownerId === ownerId && !pw.isAutoConnected &&
                        ((pw.x1 === w.x1 && pw.y1 === w.y1) || (pw.x2 === w.x1 && pw.y2 === w.y1))
                    );
                    // Check if there is still a primary web sharing endpoint 2
                    const hasEnd2 = this.spiderWebs.some(pw => pw.ownerId === ownerId && !pw.isAutoConnected &&
                        ((pw.x1 === w.x2 && pw.y1 === w.y2) || (pw.x2 === w.x2 && pw.y2 === w.y2))
                    );
                    return hasEnd1 && hasEnd2;
                });
            }
        }

        // Push primary wire segment
        this.spiderWebs.push({ x1, y1, x2, y2, ownerId, isAutoConnected: false });


        // Holographic auto-connection distance
        const connectDist = 220;
        const newPts = [{x: x1, y: y1}, {x: x2, y: y2}];

        // Sweep existing webs of the same owner
        const existingPts = [];
        for (const web of this.spiderWebs) {
            if (web.ownerId === ownerId && !(web.x1 === x1 && web.y1 === y1 && web.x2 === x2 && web.y2 === y2)) {
                existingPts.push({x: web.x1, y: web.y1});
                existingPts.push({x: web.x2, y: web.y2});
            }
        }

        // Draw cross-connecting holographic wires between nearby endpoints
        for (const newPt of newPts) {
            for (const extPt of existingPts) {
                const dist = Math.sqrt((newPt.x - extPt.x) ** 2 + (newPt.y - extPt.y) ** 2);
                if (dist > 5 && dist < connectDist) {
                    const alreadyConnected = this.spiderWebs.some(w => 
                        w.ownerId === ownerId && 
                        ((w.x1 === newPt.x && w.y1 === newPt.y && w.x2 === extPt.x && w.y2 === extPt.y) ||
                         (w.x1 === extPt.x && w.y1 === extPt.y && w.x2 === newPt.x && w.y2 === newPt.y))
                    );
                    if (!alreadyConnected) {
                        this.spiderWebs.push({
                            x1: newPt.x,
                            y1: newPt.y,
                            x2: extPt.x,
                            y2: extPt.y,
                            ownerId: ownerId,
                            isAutoConnected: true
                        });
                    }
                }
            }
        }
    }

    draw(ctx) {
        // Draw grid floor lines background
        ctx.strokeStyle = (this.mapType === 'cityscape' || this.mapType === 'cityscape_large') ? 'rgba(255,255,255,0.015)' : (this.mapType === 'forest_mountain' ? 'rgba(46, 125, 50, 0.02)' : 'rgba(0, 240, 255, 0.02)');
        ctx.lineWidth = 1;
        for (let r = 0; r <= this.rows; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * this.tileSize);
            ctx.lineTo(this.width, r * this.tileSize);
            ctx.stroke();
        }
        for (let c = 0; c <= this.cols; c++) {
            ctx.beginPath();
            ctx.moveTo(c * this.tileSize, 0);
            ctx.lineTo(c * this.tileSize, this.height);
            ctx.stroke();
        }

        // Draw structural tiles
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.grid[r][c];
                if (tile.type === 'empty') continue;

                ctx.save();
                
                if (tile.type === 'indestructible') {
                    if (tile.isMountainRock) {
                        // Draw slate mountain rock ridge
                        ctx.fillStyle = '#2b2f33';
                        ctx.fillRect(tile.x, tile.y, this.tileSize, this.tileSize);
                        
                        ctx.strokeStyle = '#4e555c';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(tile.x + 2, tile.y + 2, this.tileSize - 4, this.tileSize - 4);
                        
                        // Drawn rocky jagged cracks
                        ctx.beginPath();
                        ctx.moveTo(tile.x + 5, tile.y + 5);
                        ctx.lineTo(tile.x + this.tileSize - 5, tile.y + this.tileSize - 5);
                        ctx.moveTo(tile.x + this.tileSize - 5, tile.y + 5);
                        ctx.lineTo(tile.x + 5, tile.y + this.tileSize - 5);
                        ctx.stroke();
                    } else {
                        // Outer wall or central heavy pillars
                        ctx.fillStyle = '#141c22';
                        ctx.fillRect(tile.x, tile.y, this.tileSize, this.tileSize);
                        
                        // Technical borders overlay
                        ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(tile.x + 1, tile.y + 1, this.tileSize - 2, this.tileSize - 2);

                        // Add cyber corner marks
                        ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
                        ctx.fillRect(tile.x, tile.y, 4, 4);
                        ctx.fillRect(tile.x + this.tileSize - 4, tile.y, 4, 4);
                        ctx.fillRect(tile.x, tile.y + this.tileSize - 4, 4, 4);
                        ctx.fillRect(tile.x + this.tileSize - 4, tile.y + this.tileSize - 4, 4, 4);
                    }
                } 
                else if (tile.type === 'destructible') {
                    if (tile.isTree) {
                        // Draw beautiful organic green circular tree!
                        const damageRatio = tile.hp / tile.maxHp;
                        const centerX = tile.x + this.tileSize / 2;
                        const centerY = tile.y + this.tileSize / 2;

                        ctx.fillStyle = damageRatio > 0.5 ? 'rgba(57, 255, 20, 0.45)' : 'rgba(139, 195, 74, 0.3)';
                        ctx.shadowBlur = damageRatio > 0.5 ? 8 : 2;
                        ctx.shadowColor = '#39ff14';

                        ctx.beginPath();
                        ctx.arc(centerX, centerY, this.tileSize / 2 - 4, 0, Math.PI * 2);
                        ctx.fill();

                        // Inner trunk trunk wood core
                        ctx.fillStyle = '#5c4033';
                        ctx.shadowBlur = 0;
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
                        ctx.fill();

                        // Leaf highlight border
                        ctx.strokeStyle = '#39ff14';
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, this.tileSize / 2 - 4, 0, Math.PI * 2);
                        ctx.stroke();
                    } else {
                        // Skyscraper buildings / blocks
                        const damageRatio = tile.hp / tile.maxHp;
                        ctx.fillStyle = `rgb(${Math.floor(40 + (1 - damageRatio) * 60)}, ${Math.floor(45 + (1 - damageRatio) * 20)}, ${Math.floor(52 - (1 - damageRatio) * 20)})`;
                        ctx.fillRect(tile.x, tile.y, this.tileSize, this.tileSize);

                        // Draw inner grid/windows
                        ctx.fillStyle = damageRatio > 0.6 ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255, 223, 0, 0.1)';
                        ctx.fillRect(tile.x + 10, tile.y + 10, 12, 12);
                        ctx.fillRect(tile.x + 38, tile.y + 10, 12, 12);
                        ctx.fillRect(tile.x + 10, tile.y + 38, 12, 12);
                        ctx.fillRect(tile.x + 38, tile.y + 38, 12, 12);

                        // Building wire outlines
                        ctx.strokeStyle = damageRatio > 0.5 ? 'rgba(57, 255, 20, 0.3)' : 'rgba(255, 59, 48, 0.3)';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(tile.x, tile.y, this.tileSize, this.tileSize);

                        // Cracks visual indicators based on health
                        if (damageRatio < 0.8) {
                            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                            ctx.lineWidth = 1.5;
                            ctx.beginPath();
                            ctx.moveTo(tile.x + 15, tile.y + 5);
                            ctx.lineTo(tile.x + 30, tile.y + 25);
                            ctx.lineTo(tile.x + 20, tile.y + 50);
                            ctx.stroke();
                        }
                        if (damageRatio < 0.4) {
                            ctx.beginPath();
                            ctx.moveTo(tile.x + 45, tile.y + 15);
                            ctx.lineTo(tile.x + 35, tile.y + 35);
                            ctx.lineTo(tile.x + 50, tile.y + 45);
                            ctx.stroke();
                        }
                    }
                }
                ctx.restore();
            }
        }

        // Draw active Spider Web wires (purple lines)
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#bd00ff';
        
        for (const web of this.spiderWebs) {
            if (web.isAutoConnected) {
                ctx.strokeStyle = 'rgba(189, 0, 255, 0.45)';
                ctx.lineWidth = 1.2;
                ctx.setLineDash([4, 4]); // Dashed connection for holographic mesh lines
            } else {
                ctx.strokeStyle = 'rgba(189, 0, 255, 0.75)';
                ctx.lineWidth = 2.4;
                ctx.setLineDash([]); // Solid border primary lines
            }

            ctx.beginPath();
            ctx.moveTo(web.x1, web.y1);
            ctx.lineTo(web.x2, web.y2);
            ctx.stroke();

            // Draw tiny attachment node circles
            ctx.fillStyle = '#bd00ff';
            ctx.beginPath();
            ctx.arc(web.x1, web.y1, web.isAutoConnected ? 1.5 : 3.2, 0, Math.PI*2);
            ctx.arc(web.x2, web.y2, web.isAutoConnected ? 1.5 : 3.2, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();

        // Draw debris shards
        ctx.save();
        for (const p of this.debris) {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.restore();
    }
}

// Bind to window global
window.Arena = Arena;
