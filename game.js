document.addEventListener("DOMContentLoaded", () => {
    const authScreen = document.getElementById('auth-screen');
    const launcherScreen = document.getElementById('launcher-screen');
    const gameScreen = document.getElementById('game-screen');
    const usernameInput = document.getElementById('username-input');
    const loginBtn = document.getElementById('login-btn');
    const userWelcome = document.getElementById('user-welcome');
    const bestScoreDisplay = document.getElementById('best-score-display');
    const emeraldsMenuDisplay = document.getElementById('emeralds-menu-display');
    
    const launchBtn = document.getElementById('launch-btn');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const healthVal = document.getElementById('health-val');
    const ammoVal = document.getElementById('ammo-val');
    const scoreVal = document.getElementById('score-val');
    const moneyVal = document.getElementById('round-emeralds-val');
    const cashVal = document.getElementById('round-cash-val');
    const grenadesVal = document.getElementById('grenades-val');

    const shopUi = document.getElementById('shop-ui');
    const shopToggleBtn = document.getElementById('shop-toggle-btn');
    const reviveBarContainer = document.getElementById('revive-bar-container');
    const reviveProgressFill = document.getElementById('revive-progress-fill');

    const donateModal = document.getElementById('donate-modal');
    const donateOpenBtn = document.getElementById('donate-open-btn');
    const donateCloseBtn = document.getElementById('donate-close-btn');

    let gameRunning = false;
    let isShopOpen = false;
    let score = 0;
    let roundEmeralds = 0; 
    let totalEmeralds = 0; 
    let currentUser = "";
    let currentSkin = "default"; 
    let currentGunSkin = "black";

    let reviveProgress = 0;
    let targetAllyToRevive = null;

    window.addEventListener('contextmenu', e => e.preventDefault());

    // ==========================================
    // ЗАСТАВКА МЕНЮ
    // ==========================================
    const menuCanvas = document.getElementById('menuBgCanvas');
    const mCtx = menuCanvas.getContext('2d');
    let menuParticles = [];

    function resizeMenuCanvas() { menuCanvas.width = window.innerWidth; menuCanvas.height = window.innerHeight; }
    window.addEventListener('resize', resizeMenuCanvas); resizeMenuCanvas();

    for(let i=0; i<40; i++) {
        menuParticles.push({
            x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2,
            radius: Math.random() * 3 + 1, color: Math.random() > 0.5 ? '#ff4655' : '#00f0ff'
        });
    }

    function animateMenuBackground() {
        if (gameRunning) return;
        mCtx.fillStyle = "#060609"; mCtx.fillRect(0, 0, menuCanvas.width, menuCanvas.height);
        for(let p of menuParticles) {
            p.x += p.vx; p.y += p.vy;
            if(p.x < 0 || p.x > menuCanvas.width) p.vx *= -1;
            if(p.y < 0 || p.y > menuCanvas.height) p.vy *= -1;
            mCtx.beginPath(); mCtx.arc(p.x, p.y, p.radius, 0, Math.PI*2); mCtx.fillStyle = p.color; mCtx.fill();
        }
        requestAnimationFrame(animateMenuBackground);
    }
    animateMenuBackground();

    const skinButtons = document.querySelectorAll('.skin-btn');
    skinButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            let req = btn.getAttribute('data-skin') === 'ghost' ? 5 : (btn.getAttribute('data-skin') === 'gold' ? 12 : 0);
            if(totalEmeralds >= req) {
                skinButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentSkin = btn.getAttribute('data-skin');
            } else { alert("Недостаточно изумрудов!"); }
        });
    });

    const gunSkinButtons = document.querySelectorAll('.gun-skin-btn');
    gunSkinButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            let req = btn.getAttribute('data-gunskin') === 'neon' ? 3 : (btn.getAttribute('data-gunskin') === 'lava' ? 8 : 0);
            if(totalEmeralds >= req) {
                gunSkinButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentGunSkin = btn.getAttribute('data-gunskin');
            } else { alert("Недостаточно изумрудов на пушку!"); }
        });
    });

    // ==========================================
    // СИСТЕМА ПРОФИЛЕЙ (БЕЗ ЛОМАЮЩИХ ПАРОЛЕЙ)
    // ==========================================
    loginBtn.addEventListener('click', () => {
        let name = usernameInput.value.trim();
        if (name === "") { alert("Введите ваш позывной!"); return; }
        currentUser = name;
        let savedData = localStorage.getItem("xfab_user_" + currentUser);
        let bestScore = 0; totalEmeralds = 0;
        
        if (savedData) {
            let parsed = JSON.parse(savedData);
            bestScore = parsed.bestScore || 0;
            totalEmeralds = parsed.emeralds || 0;
        } else {
            localStorage.setItem("xfab_user_" + currentUser, JSON.stringify({ username: currentUser, bestScore: 0, emeralds: 0 }));
        }
        
        userWelcome.textContent = currentUser;
        bestScoreDisplay.textContent = bestScore;
        emeraldsMenuDisplay.textContent = totalEmeralds;
        
        authScreen.classList.add('hidden');
        launcherScreen.classList.remove('hidden');
    });

    function saveGameData() {
        let savedData = localStorage.getItem("xfab_user_" + currentUser);
        let currentBest = savedData ? JSON.parse(savedData).bestScore || 0 : 0;
        
        totalEmeralds += roundEmeralds; 
        let newBest = Math.max(currentBest, score);
        
        localStorage.setItem("xfab_user_" + currentUser, JSON.stringify({
            username: currentUser, bestScore: newBest, emeralds: totalEmeralds
        }));
        
        bestScoreDisplay.textContent = newBest;
        emeraldsMenuDisplay.textContent = totalEmeralds;
    }

    // ИГРОВЫЕ ПАРАМЕТРЫ ИГРОКА
    let player = {
        x: 150, y: 200, width: 32, height: 48, vx: 0, vy: 0, speed: 5, jumpForce: 13,
        grounded: false, health: 100, maxHealth: 100, ammo: 30, maxAmmo: 30, grenades: 3, facingLeft: false
    };

    let weapon = { fireRate: 150, lastShot: 0, damage: 25, isReloading: false };
    let camera = { x: 0 };
    let platforms = [], bullets = [], enemyBullets = [], enemies = [], allies = [], grenades = [], particles = [], items = [];
    let keys = {}; let mousePos = { x: 0, y: 0 };

    donateOpenBtn.addEventListener('click', () => { donateModal.classList.remove('hidden'); });
    donateCloseBtn.addEventListener('click', () => { donateModal.classList.add('hidden'); });
    launchBtn.addEventListener('click', () => { launcherScreen.classList.add('hidden'); gameScreen.classList.remove('hidden'); initGame(); });

    window.addEventListener('keydown', (e) => { 
        keys[e.code] = true; 
        if (e.code === 'KeyP') toggleShop();
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) keys['MouseDown'] = true; 
        if (e.button === 2) throwGrenade();          
    });
    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) keys['MouseDown'] = false;
    });
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect(); mousePos.x = e.clientX - rect.left; mousePos.y = e.clientY - rect.top;
    });

    shopToggleBtn.addEventListener('click', toggleShop);
    document.getElementById('close-shop-btn').addEventListener('click', toggleShop);

    document.getElementById('buy-ally-btn').addEventListener('click', () => {
        let playerCash = score * 5; 
        if (playerCash >= 150 && allies.length < 3) {
            score -= 30; 
            allies.push({
                x: player.x - 40, y: player.y, width: 32, height: 48, vx:0, vy:0,
                lastShot:0, offset: -(40 + allies.length * 40), facingLeft:false, health:100, isDowned:false
            });
            alert("Напарник нанят!"); updateHUD();
        } else if (allies.length >= 3) { alert("Лимит напарников достигнут!"); }
        else { alert("Недостаточно денег! Набирай очки ($" + playerCash + "/$150)."); }
    });

    document.getElementById('buy-damage-btn').addEventListener('click', () => {
        if (score >= 20) { score -= 20; player.health = Math.min(player.maxHealth + 50, player.health + 50); updateHUD(); }
    });
    document.getElementById('buy-grenade-btn').addEventListener('click', () => {
        if (score >= 10) { score -= 10; player.grenades++; updateHUD(); }
    });

    function initGame() {
        gameRunning = true; score = 0; roundEmeralds = 0; 
        player.health = 100; player.ammo = 30; player.grenades = 3; player.x = 150; player.y = 200;
        bullets = []; enemyBullets = []; enemies = []; grenades = []; particles = []; items = []; allies = []; 
        updateHUD(); requestAnimationFrame(gameLoop);
    }

    function updateHUD() {
        healthVal.textContent = Math.max(0, Math.floor(player.health));
        ammoVal.textContent = player.isReloading ? "RELOAD" : player.ammo + "/30";
        grenadesVal.textContent = player.grenades; scoreVal.textContent = score; moneyVal.textContent = roundEmeralds;
        cashVal.textContent = score * 5;
    }

    function toggleShop() { isShopOpen = !isShopOpen; shopUi.classList.toggle('hidden', !isShopOpen); }

    function throwGrenade() {
        if (player.grenades <= 0 || !gameRunning || isShopOpen) return;
        player.grenades--;
        const angle = Math.atan2(mousePos.y - (player.y + 20), (mousePos.x + camera.x) - (player.x + 16));
        grenades.push({x: player.x + 16, y: player.y + 10,
vx: Math.cos(angle) * 11, vy: Math.sin(angle) * 11 - 4,
timer: 110
});
updateHUD();
}
function createExplosion(x, y) {
for (let i = 0; i < 25; i++) {
particles.push({
x: x, y: y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
radius: Math.random() * 5 + 2, color: Math.random() > 0.5 ? '#ff4655' : '#ffeb3b', alpha: 1
});
}
}
function gameLoop() { if (!gameRunning) return; update(); render(); requestAnimationFrame(gameLoop); }
// ==========================================
// ИГРОВАЯ СИСТЕМА И ФИЗИКА (UPDATE)
// ==========================================
function update() {
if (keys['KeyA'] || keys['ArrowLeft']) player.vx = -player.speed;
else if (keys['KeyD'] || keys['ArrowRight']) player.vx = player.speed;
else player.vx *= 0.8;
if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.grounded) {
player.vy = -player.jumpForce; player.grounded = false;
}
player.vy += 0.6; player.x += player.vx; player.y += player.vy;
camera.x += (player.x - canvas.width / 3 - camera.x) * 0.1;
player.facingLeft = (mousePos.x + camera.x < player.x + 16);
// Бесконечный мир
platforms = [];
let startChunk = Math.floor(camera.x / 300) - 2; let endChunk = startChunk + 6;
platforms.push({ x: camera.x - 400, y: 400, width: canvas.width + 800, height: 50, type: 'floor' });
for (let i = startChunk; i <= endChunk; i++) {
let chunkX = i * 300; let blockY = 260 + Math.sin(i * 1.7) * 45;
if (i !== 0) platforms.push({ x: chunkX + 50, y: blockY, width: 140, height: 15, type: 'block' });
}
// Коллизия игрока с платформой
player.grounded = false;
for (let plat of platforms) {
if (player.x + player.width > plat.x && player.x < plat.x + plat.width && player.y + player.height > plat.y && player.y + player.height - player.vy <= plat.y + 12 && player.vy >= 0) {
player.y = plat.y - player.height; player.vy = 0; player.grounded = true;
}
}
// Рикошет гранат
for (let i = grenades.length - 1; i >= 0; i--) {
let g = grenades[i];
g.vy += 0.35; g.x += g.vx; g.y += g.vy;
for (let plat of platforms) {
if (g.x > plat.x && g.x < plat.x + plat.width && g.y > plat.y && g.y - g.vy <= plat.y + 10 && g.vy > 0) {
g.y = plat.y - 2; g.vy = -g.vy * 0.6; g.vx *= 0.7;
}
if (plat.type === 'block' && g.x > plat.x && g.x < plat.x + plat.width && g.y < plat.y + plat.height && g.y - g.vy >= plat.y && g.vy < 0) {
g.y = plat.y + plat.height + 2; g.vy = -g.vy * 0.6;
}
}
g.timer--;
if (g.timer <= 0) {
createExplosion(g.x, g.y);
for (let e of enemies) { if (Math.hypot(e.x - g.x, e.y - g.y) < 130) e.hp -= 100; }
grenades.splice(i, 1);
}
}
// Реанимация напарников
let closeToDownedAlly = false;
if (keys['KeyE']) {
for (let al of allies) {
if (al.isDowned && Math.hypot(player.x - al.x, player.y - al.y) < 70) {
closeToDownedAlly = true; targetAllyToRevive = al;
reviveProgress += 1.5;
reviveBarContainer.classList.remove('hidden');
reviveProgressFill.style.width = reviveProgress + "%";
if (reviveProgress >= 100) { al.isDowned = false; al.health = 100; reviveProgress = 0; reviveBarContainer.classList.add('hidden'); }
break;
}
}
}
if (!closeToDownedAlly || !keys['KeyE']) { reviveProgress = 0; reviveBarContainer.classList.add('hidden'); }
// Логика напарников
for (let al of allies) {
if (al.isDowned) { al.vx = 0; al.vy += 0.6; continue; }
let targetX = player.x + al.offset;
al.vx = (targetX - al.x) * 0.08; al.vy += 0.6; al.x += al.vx; al.y += al.vy;
al.facingLeft = player.facingLeft;
for (let plat of platforms) {
if (al.x + al.width > plat.x && al.x < plat.x + plat.width && al.y + al.height > plat.y && al.y + al.height - al.vy <= plat.y + 12 && al.vy >= 0) {
al.y = plat.y - al.height; al.vy = 0;
}
}
if (enemies.length > 0 && Date.now() - al.lastShot > 600) {
let e = enemies[0];
if (e && Math.abs(e.x - al.x) < 500) {
al.lastShot = Date.now();
let angle = Math.atan2((e.y + 20) - (al.y + 20), e.x - al.x);
bullets.push({ x: al.x + 16, y: al.y + 20, vx: Math.cos(angle) * 14, vy: Math.sin(angle) * 14, damage: 15, isAlly: true });
}
}
}
// Стрельба игрока
if (keys['MouseDown'] && !weapon.isReloading && Date.now() - weapon.lastShot > weapon.fireRate) {
if (player.ammo > 0) {
player.ammo--; weapon.lastShot = Date.now();
const angle = Math.atan2(mousePos.y - (player.y + 20), (mousePos.x + camera.x) - (player.x + 15));
bullets.push({ x: player.x + 15, y: player.y + 20, vx: Math.cos(angle) * 16, vy: Math.sin(angle) * 16, damage: weapon.damage });
if (player.ammo === 0) {
weapon.isReloading = true;
setTimeout(() => { player.ammo = player.maxAmmo; weapon.isReloading = false; updateHUD(); }, 1200);
}
updateHUD();
}
}
// Полет пуль
for (let i = bullets.length - 1; i >= 0; i--) { bullets[i].x += bullets[i].vx; bullets[i].y += bullets[i].vy; if (Math.abs(bullets[i].x - player.x) > 1200) bullets.splice(i, 1); }
for (let i = enemyBullets.length - 1; i >= 0; i--) {
let eb = enemyBullets[i]; eb.x += eb.vx; eb.y += eb.vy;
if (eb.x > player.x && eb.x < player.x + player.width && eb.y > player.y && eb.y < player.y + player.height) {
player.health -= 8; enemyBullets.splice(i, 1); updateHUD();
if (player.health <= 0) { gameOver(); continue; } continue;
}
for(let al of allies) {
if(!al.isDowned && eb.x > al.x && eb.x < al.x + al.width && eb.y > al.y && eb.y < al.y + al.height) {
al.health -= 15; enemyBullets.splice(i, 1); if(al.health <= 0) al.isDowned = true; break;
}
}
if (Math.abs(eb.x - player.x) > 1200) enemyBullets.splice(i, 1);
}
// БЕСКОНЕЧНЫЙ ДИНАМИЧЕСКИЙ СПАВН БОТОВ
if (Math.random() < 0.02 && enemies.length < 5) {
let isHeavy = Math.random() > 0.65;
let spawnX = camera.x + (Math.random() > 0.4 ? canvas.width + 100 : -150);
enemies.push({
x: spawnX, y: 150,
width: 34, height: 48, speed: isHeavy ? 1.2 : 2.5,
hp: isHeavy ? 180 : 70, maxHp: isHeavy ? 180 : 70, vy: 0,
type: isHeavy ? 'minigunner' : 'tactical_shooter',
lastShot: 0, shootCooldown: isHeavy ? 450 : 1300, facingLeft: true
});
}
// Тактический ИИ врагов
for (let i = enemies.length - 1; i >= 0; i--) {
let e = enemies[i];
e.vy += 0.6; e.y += e.vy;
let eGrounded = false;
for(let plat of platforms) {
if (e.x + e.width > plat.x && e.x < plat.x + plat.width && e.y + e.height > plat.y && e.y + e.height - e.vy <= plat.y + 12 && e.vy >= 0) {
e.y = plat.y - e.height; e.vy = 0; eGrounded = true;
}
}
if (e.x > player.x + 40) { e.x -= e.speed; e.facingLeft = true; }
else if (e.x < player.x - 40) { e.x += e.speed; e.facingLeft = false; }
if (player.y < e.y - 40 && eGrounded && Math.random() < 0.03) {
e.vy = -12;
}
let targetUnit = player;
for(let al of allies) { if(!al.isDowned && Math.abs(al.x - e.x) < Math.abs(targetUnit.x - e.x)) targetUnit = al; }
if (Math.abs(e.x - player.x) < 550 && Date.now() - e.lastShot > e.shootCooldown) {
e.lastShot = Date.now();
const angle = Math.atan2((targetUnit.y + 20) - (e.y + 20), targetUnit.x - e.x);
enemyBullets.push({ x: e.x + 16, y: e.y + 20, vx: Math.cos(angle) * 7, vy: Math.sin(angle) * 7 });
}
for (let j = bullets.length - 1; j >= 0; j--) {
let b = bullets[j];
if (b.x > e.x && b.x < e.x + e.width && b.y > e.y && b.y < e.y + e.height) { e.hp -= b.damage; bullets.splice(j, 1); }
}
if (e.hp <= 0) {
score += e.type === 'minigunner' ? 100 : 30;
if (e.type === 'minigunner') roundEmeralds += Math.floor(Math.random() * 2) + 1;
enemies.splice(i, 1); updateHUD();
}
if (Math.abs(e.x - player.x) > 1500) { enemies.splice(i, 1); }
}
for (let i = particles.length - 1; i >= 0; i--) { particles[i].x += particles[i].vx; particles[i].y += particles[i].vy; particles[i].alpha -= 0.02; if (particles[i].alpha <= 0) particles.splice(i, 1); }
}
function gameOver() { gameRunning = false; saveGameData(); alert("Операция завершена! Счёт операции: " + score); launcherScreen.classList.remove('hidden'); gameScreen.classList.add('hidden'); animateMenuBackground(); }
// ==========================================
// ОТРИСОВКА ВСЕЙ ГРАФИКИ (RENDER)
// ==========================================
function render() {
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.save(); ctx.translate(-camera.x, 0);
// Сетка
ctx.strokeStyle = '#11111a'; ctx.lineWidth = 1;
let startGrid = Math.floor(camera.x / 50) * 50;
for (let x = startGrid; x < startGrid + canvas.width + 100; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
// Платформы
for (let plat of platforms) {
ctx.fillStyle = plat.type === 'floor' ? '#161622' : '#28283a'; ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
ctx.strokeStyle = '#323246'; ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);
}
// Гранаты
ctx.fillStyle = '#ffeb3b';
for (let g of grenades) { ctx.beginPath(); ctx.arc(g.x, g.y, 6, 0, Math.PI*2); ctx.fill(); }
// Пули
for (let b of bullets) { ctx.fillStyle = b.isAlly ? '#2ecc71' : '#00f0ff'; ctx.fillRect(b.x - 4, b.y - 2, 8, 4); }
for (let eb of enemyBullets) { ctx.fillStyle = '#ff4655'; ctx.fillRect(eb.x - 4, eb.y - 2, 8, 4); }
for (let p of particles) { ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2); ctx.fill(); }
ctx.globalAlpha = 1;
// Напарники
for (let al of allies) {
ctx.fillStyle = al.isDowned ? '#78909c' : '#2ecc71'; ctx.fillRect(al.x, al.y, al.width, al.height);
ctx.fillStyle = '#fff'; let eyeX = al.facingLeft ? al.x + 4 : al.x + 20; ctx.fillRect(eyeX, al.y + 8, 8, 6);
if(!al.isDowned) { ctx.fillStyle = '#111'; let wpX = al.facingLeft ? al.x - 8 : al.x + 16; ctx.fillRect(wpX, al.y + 22, 24, 5); }
else { ctx.fillStyle = '#ffeb3b'; ctx.font = 'bold 16px Arial'; ctx.fillText("🆘", al.x + 4, al.y - 10); }
}
// Враги
for (let e of enemies) {
ctx.fillStyle = e.type === 'minigunner' ? '#ff9800' : '#b71c1c'; ctx.fillRect(e.x, e.y, e.width, e.height);
ctx.fillStyle = '#fff'; let eEyeX = e.facingLeft ? e.x + 4 : e.x + 20; ctx.fillRect(eEyeX, e.y + 8, 10, 6);
ctx.fillStyle = '#212121'; let eWpX = e.facingLeft ? e.x - 12 : e.x + 18; ctx.fillRect(eWpX, e.y + 20, 24, 6);
ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x, e.y - 12, e.width, 5);
ctx.fillStyle = '#e53935'; ctx.fillRect(e.x, e.y - 12, e.width * (e.hp / e.maxHp), 5);
}
// Игрок
if (currentSkin === "default") ctx.fillStyle = '#f5f5f5';
else if (currentSkin === "ghost") ctx.fillStyle = '#b388ff';
else if (currentSkin === "gold") ctx.fillStyle = '#ffea00';
ctx.fillRect(player.x, player.y, player.width, player.height);
ctx.fillStyle = '#ff4655'; let pEyeX = player.facingLeft ? player.x + 4 : player.x + 20; ctx.fillRect(pEyeX, player.y + 8, 8, 6);
// Оружие
ctx.save(); ctx.translate(player.x + 16, player.y + 24);
let angle = Math.atan2(mousePos.y - (player.y + 24), (mousePos.x + camera.x) - (player.x + 16)); ctx.rotate(angle);
if(currentGunSkin === "black") ctx.fillStyle = '#212121';
else if(currentGunSkin === "neon") ctx.fillStyle = '#ff4081';
else if(currentGunSkin === "lava") ctx.fillStyle = '#ff3d00';
ctx.fillRect(0, -3, 26, 6); ctx.restore();
ctx.restore();
}
}); 
