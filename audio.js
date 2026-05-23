/* ==========================================================================
   AUDIO SYNTHESIZER ENGINE - WORLD TRIGGER RANK WARS
   ========================================================================== */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterVolume = null;
        this.muted = false;
    }

    init() {
        if (this.ctx) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            this.masterVolume = this.ctx.createGain();
            this.masterVolume.gain.setValueAtTime(0.3, this.ctx.currentTime); // moderate volume
            this.masterVolume.connect(this.ctx.destination);
        } catch (e) {
            console.warn("Web Audio API not supported in this browser:", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setVolume(volume) {
        if (!this.masterVolume) return;
        this.masterVolume.gain.setValueAtTime(volume, this.ctx.currentTime);
    }

    createNoiseBuffer() {
        if (!this.ctx) return null;
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // 1. KOGETSU / SCORPION SLASH (Swoosh)
    playSlash(isScorpion = false) {
        this.init();
        this.resume();
        if (!this.ctx || this.muted) return;

        const now = this.ctx.currentTime;
        const duration = isScorpion ? 0.12 : 0.22;
        
        // Oscillator for the ring
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isScorpion ? 800 : 400, now);
        osc.frequency.exponentialRampToValueAtTime(isScorpion ? 150 : 80, now + duration);

        filter.type = 'bandpass';
        filter.Q.setValueAtTime(5, now);
        filter.frequency.setValueAtTime(isScorpion ? 1000 : 600, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + duration);

        gainNode.gain.setValueAtTime(0.01, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + duration);

        // Add a noise swoosh element
        const noise = this.ctx.createBufferSource();
        const noiseBuffer = this.createNoiseBuffer();
        if (noiseBuffer) {
            noise.buffer = noiseBuffer;
            const noiseGain = this.ctx.createGain();
            const noiseFilter = this.ctx.createBiquadFilter();

            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(1000, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(200, now + duration);

            noiseGain.gain.setValueAtTime(0.15, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterVolume);

            noise.start(now);
            noise.stop(now + duration);
        }
    }

    // 2. SENKU EXTENSION (Powerful, long slash)
    playSenku() {
        this.init();
        this.resume();
        if (!this.ctx || this.muted) return;

        const now = this.ctx.currentTime;
        const duration = 0.45;

        // Oscillator
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + duration);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + duration);

        gainNode.gain.setValueAtTime(0.01, now);
        gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + duration);

        // Added deep sub rumble
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(90, now);
        subOsc.frequency.linearRampToValueAtTime(30, now + duration);
        subGain.gain.setValueAtTime(0.3, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        subOsc.connect(subGain);
        subGain.connect(this.masterVolume);
        
        subOsc.start(now);
        subOsc.stop(now + duration);
    }

    // 3. SHOOTER FIRE (Beep-shoot)
    playShoot(type = 'asteroid') {
        this.init();
        this.resume();
        if (!this.ctx || this.muted) return;

        const now = this.ctx.currentTime;
        const duration = 0.15;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        if (type === 'meteora') {
            // Explosive release tone
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(250, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + duration);
        } else if (type === 'hound') {
            // High speed alert chime
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.linearRampToValueAtTime(1200, now + duration);
            gainNode.gain.setValueAtTime(0.1, now);
        } else if (type === 'viper') {
            // High sliding whistle
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.linearRampToValueAtTime(1500, now + duration);
        } else if (type === 'gunner') {
            // Rapid dry noise click
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(100, now + duration);
            gainNode.gain.setValueAtTime(0.08, now);
        } else {
            // Asteroid standard crisp tone
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + duration);
        }

        osc.connect(gainNode);
        gainNode.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + duration);
    }

    // 4. METEORA EXPLOSION
    playExplosion() {
        this.init();
        this.resume();
        if (!this.ctx || this.muted) return;

        const now = this.ctx.currentTime;
        const duration = 0.8;

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(10, now + duration);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(40, now + duration);

        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + duration);

        // Heavy Noise Rumble
        const noise = this.ctx.createBufferSource();
        const noiseBuffer = this.createNoiseBuffer();
        if (noiseBuffer) {
            noise.buffer = noiseBuffer;
            const noiseGain = this.ctx.createGain();
            const noiseFilter = this.ctx.createBiquadFilter();

            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(200, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(20, now + duration);

            noiseGain.gain.setValueAtTime(0.5, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterVolume);

            noise.start(now);
            noise.stop(now + duration);
        }
    }

    // 5. SHIELD DEFLECTION (Metallic Ceramic Clang)
    playShieldBlock() {
        this.init();
        this.resume();
        if (!this.ctx || this.muted) return;

        const now = this.ctx.currentTime;
        const duration = 0.25;

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1800, now);
        osc1.frequency.linearRampToValueAtTime(1400, now + duration);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1000, now);
        osc2.frequency.linearRampToValueAtTime(800, now + duration);

        filter.type = 'highpass';
        filter.frequency.setValueAtTime(700, now);

        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterVolume);

        osc1.start(now);
        osc1.stop(now + duration);
        osc2.start(now);
        osc2.stop(now + duration);
    }

    // 6. GRASSHOPPER PAD DEPLOY / BOUNCE
    playGrasshopper() {
        this.init();
        this.resume();
        if (!this.ctx || this.muted) return;

        const now = this.ctx.currentTime;
        const duration = 0.2;

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + duration); // rapid rising pitch

        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gainNode);
        gainNode.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + duration);
    }

    // 7. TELEPORTER ZAP
    playTeleport() {
        this.init();
        this.resume();
        if (!this.ctx || this.muted) return;

        const now = this.ctx.currentTime;
        const duration = 0.25;

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(2500, now + duration);

        filter.type = 'bandpass';
        filter.Q.setValueAtTime(10, now);
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(3000, now + duration);

        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + duration);
    }

    // 8. BAIL OUT WARNING & SIREN
    playBailOut() {
        this.init();
        this.resume();
        if (!this.ctx || this.muted) return;

        const now = this.ctx.currentTime;
        const duration = 1.0;

        // Two-tone digital alarm
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(660, now + 0.2);
        osc.frequency.setValueAtTime(880, now + 0.4);
        osc.frequency.setValueAtTime(660, now + 0.6);

        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.setValueAtTime(0.2, now + 0.6);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gainNode);
        gainNode.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + duration);

        // Digital grid dissolution noise sweep
        const noise = this.ctx.createBufferSource();
        const noiseBuffer = this.createNoiseBuffer();
        if (noiseBuffer) {
            noise.buffer = noiseBuffer;
            const noiseGain = this.ctx.createGain();
            const noiseFilter = this.ctx.createBiquadFilter();

            noiseFilter.type = 'highpass';
            noiseFilter.frequency.setValueAtTime(2000, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(100, now + duration);

            noiseGain.gain.setValueAtTime(0.15, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterVolume);

            noise.start(now);
            noise.stop(now + duration);
        }
    }

    // 9. THRUSTER BOOST / DASH (Short powerful jet burst)
    playThruster() {
        this.init();
        this.resume();
        if (!this.ctx || this.muted) return;

        const now = this.ctx.currentTime;
        const duration = 0.15;

        const noise = this.ctx.createBufferSource();
        const noiseBuffer = this.createNoiseBuffer();
        if (noiseBuffer) {
            noise.buffer = noiseBuffer;
            const noiseGain = this.ctx.createGain();
            const noiseFilter = this.ctx.createBiquadFilter();

            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(800, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(80, now + duration);

            noiseGain.gain.setValueAtTime(0.35, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterVolume);

            noise.start(now);
            noise.stop(now + duration);
        }
    }

    // 10. SNIPER EGRET/LIGHTNING HITSCAN BEAM
    playHitscan(isLightning = false) {
        this.init();
        this.resume();
        if (!this.ctx || this.muted) return;

        const now = this.ctx.currentTime;
        const duration = isLightning ? 0.12 : 0.35;

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = isLightning ? 'sine' : 'sawtooth';
        osc.frequency.setValueAtTime(isLightning ? 2000 : 1200, now);
        osc.frequency.exponentialRampToValueAtTime(isLightning ? 800 : 200, now + duration);

        gainNode.gain.setValueAtTime(isLightning ? 0.12 : 0.25, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gainNode);
        gainNode.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + duration);
    }
}

// Attach directly to global window
window.audio = new AudioEngine();
