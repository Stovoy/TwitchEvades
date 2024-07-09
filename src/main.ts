import * as PIXI from 'pixi.js';
import tmi from 'tmi.js';

const appContainer = document.createElement('div');
appContainer.id = 'pixi-container';
document.body.appendChild(appContainer);

let app: PIXI.Application;

async function initPixiApp() {
    app = new PIXI.Application();
    await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x1099bb,
        resolution: window.devicePixelRatio || 1,
    });

    appContainer.appendChild(app.canvas);

    // Load the background image
    const texture = await PIXI.Assets.load('public/Background.jpg');

    // Create a TilingSprite using the loaded texture
    const tilingSprite = new PIXI.TilingSprite(
        texture,
        app.screen.width,
        app.screen.height
    );

    // Add the tiling sprite to the stage
    app.stage.addChild(tilingSprite);

    // Update the tiling sprite size when the window is resized
    window.addEventListener('resize', () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
        tilingSprite.width = app.screen.width;
        tilingSprite.height = app.screen.height;
    });
}

initPixiApp().then(() => {
    const CHANNEL_NAME = 'Stovoy';
    const client = new tmi.Client({
        channels: [CHANNEL_NAME]
    });

    const circles = new Map();
    const CIRCLE_RADIUS = 20;
    const MAX_SPEED = 100;
    const FRICTION = 1;
    const ACCELERATION = 1;
    const PARTICLE_LIFETIME = 60;
    const INACTIVITY_TIMEOUT = 60000; // 1 minute

    class Particle extends PIXI.Graphics {
        vx: number;
        vy: number;
        lifetime: number;

        constructor(x: number, y: number, color: number) {
            super();
            this.beginFill(color);
            this.drawCircle(0, 0, 2);
            this.endFill();
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 3;
            this.vy = (Math.random() - 0.5) * 3;
            this.alpha = 1;
            this.lifetime = PARTICLE_LIFETIME;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.alpha = this.lifetime / PARTICLE_LIFETIME;
            this.lifetime--;
            return this.lifetime > 0;
        }
    }

    class Circle {
        container: PIXI.Container;
        graphic: PIXI.Graphics;
        nameText: PIXI.Text;
        velocity: { x: number; y: number };
        lastActiveTime: number;

        constructor(name: string, color: number) {
            this.container = new PIXI.Container();

            this.graphic = new PIXI.Graphics();
            this.graphic.beginFill(color);
            this.graphic.lineStyle(2, 0x000000);
            this.graphic.drawCircle(0, 0, CIRCLE_RADIUS);
            this.graphic.endFill();

            this.nameText = new PIXI.Text(name, {
                fontFamily: 'Arial',
                fontSize: 14,
                fill: 0xFFFFFF,
                align: 'center',
                stroke: 0x000000,
                strokeThickness: 4
            });
            this.nameText.anchor.set(0.5);
            this.nameText.y = -CIRCLE_RADIUS - 10;

            this.container.addChild(this.graphic);
            this.container.addChild(this.nameText);

            this.container.x = Math.random() * app.screen.width;
            this.container.y = Math.random() * app.screen.height;

            this.velocity = {x: 0, y: 0};
            this.lastActiveTime = Date.now();

            app.stage.addChild(this.container);
        }

        update() {
            this.velocity.x *= FRICTION;
            this.velocity.y *= FRICTION;

            this.container.x += this.velocity.x;
            this.container.y += this.velocity.y;

            if (this.container.x < CIRCLE_RADIUS) {
                this.container.x = CIRCLE_RADIUS;
                this.velocity.x *= -1;
                this.emitParticles();
            } else if (this.container.x > app.screen.width - CIRCLE_RADIUS) {
                this.container.x = app.screen.width - CIRCLE_RADIUS;
                this.velocity.x *= -1;
                this.emitParticles();
            }

            if (this.container.y < CIRCLE_RADIUS) {
                this.container.y = CIRCLE_RADIUS;
                this.velocity.y *= -1;
                this.emitParticles();
            } else if (this.container.y > app.screen.height - CIRCLE_RADIUS) {
                this.container.y = app.screen.height - CIRCLE_RADIUS;
                this.velocity.y *= -1;
                this.emitParticles();
            }
        }

        accelerate() {
            const angle = Math.random() * Math.PI * 2;
            this.velocity.x += Math.cos(angle) * ACCELERATION;
            this.velocity.y += Math.sin(angle) * ACCELERATION;

            const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            if (speed > MAX_SPEED) {
                this.velocity.x = (this.velocity.x / speed) * MAX_SPEED;
                this.velocity.y = (this.velocity.y / speed) * MAX_SPEED;
            }

            this.lastActiveTime = Date.now();
        }

        emitParticles() {
            for (let i = 0; i < 10; i++) {
                const particle = new Particle(this.container.x, this.container.y, this.graphic.fill.color);
                app.stage.addChild(particle);
                particles.push(particle);
            }
        }
    }

    const particles: Particle[] = [];

    function checkCollisions() {
        const circleArray = Array.from(circles.values());
        for (let i = 0; i < circleArray.length; i++) {
            for (let j = i + 1; j < circleArray.length; j++) {
                const circle1 = circleArray[i];
                const circle2 = circleArray[j];
                const dx = circle1.container.x - circle2.container.x;
                const dy = circle1.container.y - circle2.container.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < CIRCLE_RADIUS * 2) {
                    const angle = Math.atan2(dy, dx);
                    const sin = Math.sin(angle);
                    const cos = Math.cos(angle);

                    // Rotate velocity
                    const vx1 = circle1.velocity.x * cos + circle1.velocity.y * sin;
                    const vy1 = circle1.velocity.y * cos - circle1.velocity.x * sin;
                    const vx2 = circle2.velocity.x * cos + circle2.velocity.y * sin;
                    const vy2 = circle2.velocity.y * cos - circle2.velocity.x * sin;

                    // Swap velocities
                    circle1.velocity.x = vx2 * cos - vy1 * sin;
                    circle1.velocity.y = vy1 * cos + vx2 * sin;
                    circle2.velocity.x = vx1 * cos - vy2 * sin;
                    circle2.velocity.y = vy2 * cos + vx1 * sin;

                    // Move circles apart
                    const moveX = (CIRCLE_RADIUS * 2 - distance) * dx / distance / 2;
                    const moveY = (CIRCLE_RADIUS * 2 - distance) * dy / distance / 2;
                    circle1.container.x += moveX;
                    circle1.container.y += moveY;
                    circle2.container.x -= moveX;
                    circle2.container.y -= moveY;

                    circle1.emitParticles();
                    circle2.emitParticles();
                }
            }
        }
    }

    function removeInactiveCircles() {
        const now = Date.now();
        circles.forEach((circle, name) => {
            if (now - circle.lastActiveTime > INACTIVITY_TIMEOUT) {
                app.stage.removeChild(circle.container);
                circles.delete(name);
            }
        });
    }

    app.ticker.add(() => {
        circles.forEach(circle => circle.update());
        checkCollisions();
        removeInactiveCircles();

        for (let i = particles.length - 1; i >= 0; i--) {
            if (!particles[i].update()) {
                app.stage.removeChild(particles[i]);
                particles.splice(i, 1);
            }
        }
    });

    client.connect().catch(console.error);

    client.on('message', (channel, tags, message, self) => {
        if (self) return;

        const username = tags['display-name'];
        const color = tags.color || `#${Math.floor(Math.random() * 16777215).toString(16)}`;

        if (!circles.has(username)) {
            circles.set(username, new Circle(username, parseInt(color.replace('#', '0x'))));
        }

        circles.get(username).accelerate();
    });

    window.addEventListener('resize', () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
    });

    circles.set("Stovoy", new Circle("Stovoy", 0xFF0000));

    for (let i = 0; i < 10; i++) {
        circles.get("Stovoy").accelerate();
    }
});
