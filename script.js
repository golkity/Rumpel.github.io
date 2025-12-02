const SPHERES = {
    1: { id: 1, name: "Наука", tax: 5, icon: "fa-flask", colorClass: "type-science" },
    2: { id: 2, name: "Культура", tax: 5, icon: "fa-palette", colorClass: "type-culture" },
    3: { id: 3, name: "Досуг", tax: 10, icon: "fa-masks-theater", colorClass: "type-leisure" },
    4: { id: 4, name: "Образование", tax: 5, icon: "fa-graduation-cap", colorClass: "type-education" },
    5: { id: 5, name: "Спорт", tax: 5, icon: "fa-futbol", colorClass: "type-sport" },
    6: { id: 6, name: "Производство", tax: 15, icon: "fa-industry", colorClass: "type-industry" }
};

const ACTIONS = {
    1: "Грант", 2: "Налоги", 3: "Стройка", 
    4: "Апгрейд", 5: "Покупка земли", 6: "Форс-мажор"
};

const UPGRADE_COST = 20;
const BUILD_COST = 10;
const MAX_ROUNDS = 10;

let players = [];
let currentRound = 1;
let isCrisisMode = false;
let activePlayerId = null;

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('btn-inc-players').addEventListener('click', () => changePlayerCount(1));
    document.getElementById('btn-dec-players').addEventListener('click', () => changePlayerCount(-1));
    document.getElementById('btn-start').addEventListener('click', startGame);

    document.getElementById('btn-roll-action').addEventListener('click', rollAction);
    document.getElementById('btn-roll-sphere').addEventListener('click', rollSphere);
    document.getElementById('btn-crisis').addEventListener('click', toggleCrisis);
    document.getElementById('btn-finish-round').addEventListener('click', calculateSummary);
    
    document.querySelectorAll('.close-modal').forEach(b => {
        b.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.add('hidden');
        });
    });
    
    document.getElementById('btn-next-round').addEventListener('click', nextRound);
}

function changePlayerCount(delta) {
    const input = document.getElementById('player-count');
    let val = parseInt(input.value) + delta;
    if (val >= 2 && val <= 12) {
        input.value = val;
    }
}

function startGame() {
    const count = parseInt(document.getElementById('player-count').value);
    
    players = Array.from({ length: count }, (_, i) => ({
        id: i,
        name: `Район ${i + 1}`,
        money: 100,
        buildings: []
    }));

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('active');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('active');
    
    renderPlayers();
}

function renderPlayers() {
    const container = document.getElementById('players-container');
    container.innerHTML = '';

    players.forEach(p => {
        const card = document.createElement('div');
        card.className = 'player-card';
        
        card.innerHTML = `
            <div class="pc-header">
                <input type="text" value="${p.name}" class="name-input" onchange="updateName(${p.id}, this.value)">
                <div class="money"><i class="fa-solid fa-coins"></i> ${p.money.toFixed(0)}</div>
            </div>
            <div class="pc-controls">
                <button class="btn btn-success" onclick="modifyMoney(${p.id}, 10)">+10</button>
                <button class="btn btn-danger" onclick="modifyMoney(${p.id}, -10)">-10</button>
                <button class="btn btn-primary" style="flex:2" onclick="openBuildModal(${p.id})">
                    <i class="fa-solid fa-hammer"></i> Построить
                </button>
            </div>
            <div class="buildings-list"></div>
        `;

        const list = card.querySelector('.buildings-list');
        
        if (p.buildings.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:0.8rem; padding-top:20px;">Пусто</div>';
        } else {
            p.buildings.forEach((b, idx) => {
                const type = SPHERES[b.typeId];
                const tax = type.tax + (isCrisisMode ? 5 : 0);
                const income = b.upgraded ? (3.5 * tax) : (1.5 * tax);
                
                const bItem = document.createElement('div');
                bItem.className = `building-item ${b.upgraded ? 'upgraded' : ''}`;
                
                bItem.innerHTML = `
                    <div class="b-info ${type.colorClass}">
                        <div class="b-icon"><i class="fa-solid ${type.icon}"></i></div>
                        <div class="b-text">
                            <strong>${type.name} ${b.upgraded ? '<i class="fa-solid fa-star" style="color:#f59e0b"></i>' : ''}</strong>
                            <span>Налог: ${tax} | Доход: ${income.toFixed(1)}</span>
                        </div>
                    </div>
                    <div class="b-actions">
                        ${!b.upgraded ? `<button class="btn-up" onclick="upgradeBuilding(${p.id}, ${idx})" title="Апгрейд (${UPGRADE_COST})"><i class="fa-solid fa-arrow-up"></i></button>` : ''}
                        <button class="btn-del" onclick="deleteBuilding(${p.id}, ${idx})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                list.appendChild(bItem);
            });
        }
        
        container.appendChild(card);
    });
}

window.updateName = (id, newName) => {
    const p = players.find(x => x.id === id);
    if(p) p.name = newName;
};

window.modifyMoney = (id, amount) => {
    const p = players.find(x => x.id === id);
    if (p) {
        p.money += amount;
        renderPlayers();
    }
};

window.openBuildModal = (id) => {
    activePlayerId = id;
    const modal = document.getElementById('build-modal');
    const grid = document.getElementById('build-options');
    grid.innerHTML = '';

    Object.values(SPHERES).forEach(sphere => {
        const btn = document.createElement('div');
        btn.className = 'build-option';
        btn.innerHTML = `
            <i class="fa-solid ${sphere.icon}"></i>
            <strong>${sphere.name}</strong>
            <span style="display:block; font-size:0.8em; color:gray">Налог: ${sphere.tax}</span>
        `;
        btn.onclick = () => build(sphere.id);
        grid.appendChild(btn);
    });

    modal.classList.remove('hidden');
};

window.build = (sphereId) => {
    if (activePlayerId === null) return;
    const p = players.find(x => x.id === activePlayerId);
    
    if (p) {
        if (p.money < BUILD_COST) {
            showToast('Недостаточно средств (Нужно 10)', 'error');
            return;
        }
        p.money -= BUILD_COST;
        p.buildings.push({ typeId: sphereId, upgraded: false });
        renderPlayers();
        document.getElementById('build-modal').classList.add('hidden');
        showToast('Здание построено!', 'success');
    }
};

window.upgradeBuilding = (playerId, buildIdx) => {
    const p = players.find(x => x.id === playerId);
    if (!p) return;

    if (p.money < UPGRADE_COST) {
        showToast(`Нужно ${UPGRADE_COST} д.е.`, 'error');
        return;
    }

    p.money -= UPGRADE_COST;
    p.buildings[buildIdx].upgraded = true;
    renderPlayers();
    showToast('Здание улучшено!', 'success');
};

window.deleteBuilding = (playerId, buildIdx) => {
    if(!confirm("Снести здание? Денег не вернут.")) return;
    const p = players.find(x => x.id === playerId);
    if(p) {
        p.buildings.splice(buildIdx, 1);
        renderPlayers();
    }
};

function rollAction() {
    const val = Math.floor(Math.random() * 6) + 1;
    const el = document.getElementById('dice-res-action');
    el.innerHTML = `<span style="font-size:1.2em; margin-right:5px;">${val}</span> ${ACTIONS[val]}`;
}

function rollSphere() {
    const val = Math.floor(Math.random() * 6) + 1;
    const el = document.getElementById('dice-res-sphere');
    const sphere = SPHERES[val];
    el.innerHTML = `<i class="fa-solid ${sphere.icon}"></i> ${sphere.name}`;
}

function toggleCrisis() {
    isCrisisMode = !isCrisisMode;
    const btn = document.getElementById('btn-crisis');
    if (isCrisisMode) {
        btn.classList.add('active');
        showToast('КРИЗИС! Налоги +5', 'warning');
    } else {
        btn.classList.remove('active');
        showToast('Кризис миновал', 'success');
    }
    renderPlayers();
}

function calculateSummary() {
    const list = document.getElementById('summary-list');
    list.innerHTML = '';
    document.getElementById('summary-round-num').textContent = currentRound;

    players.forEach(p => {
        let totalIncome = 0;
        let totalTax = 0;

        p.buildings.forEach(b => {
            const baseTax = SPHERES[b.typeId].tax;
            const currentTax = baseTax + (isCrisisMode ? 5 : 0);
            const income = b.upgraded ? (3.5 * currentTax) : (1.5 * currentTax);
            
            totalTax += currentTax;
            totalIncome += income;
        });

        p.money = p.money + totalIncome - totalTax;

        const row = document.createElement('div');
        row.className = 'summary-row';
        row.innerHTML = `
            <div>${p.name}</div>
            <div class="val-plus">+${totalIncome.toFixed(1)}</div>
            <div class="val-minus">-${totalTax}</div>
            <div class="val-total">${p.money.toFixed(0)}</div>
        `;
        list.appendChild(row);
    });

    document.getElementById('summary-modal').classList.remove('hidden');
    renderPlayers();
}

function nextRound() {
    if (currentRound >= MAX_ROUNDS) {
        alert("Игра окончена!");
        return;
    }
    currentRound++;
    document.getElementById('round-display').innerHTML = `${currentRound}<span class="total">/${MAX_ROUNDS}</span>`;
    document.getElementById('summary-modal').classList.add('hidden');
    
    if(isCrisisMode) toggleCrisis();
}

function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check' : (type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-xmark');
    
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}