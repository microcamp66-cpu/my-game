import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCmDIOYngcgykr-3WVzhmRYyVQ8e8L4sDg",
  authDomain: "my-game---rpg.firebaseapp.com",
  projectId: "my-game---rpg",
  storageBucket: "my-game---rpg.firebasestorage.app",
  messagingSenderId: "719995939743",
  appId: "1:719995939743:web:05c8bb934650cfabfeabaa"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Configurações
const WORLD_SEED = 42;
const WORLD_NOISE_SCALE = 0.08;

const CLASSES = {
    "Guerreiro": { vida: 180, mana: 50, dano: 20, skills: [{ nome: "Corte Rápido", nivel: 1, mana: 10, mult: 1.5 }, { nome: "Impacto Terrestre", nivel: 3, mana: 20, mult: 2.5 }, { nome: "Tormenta de Aço", nivel: 5, mana: 35, mult: 4.5 }], ult: { nome: "COLOSSO DIVINO", nivel: 7, mult: 10.0, recarga: 5 } },
    "Mago": { vida: 90, mana: 180, dano: 12, skills: [{ nome: "Dardo de Gelo", nivel: 1, mana: 15, mult: 2.0 }, { nome: "Explosão de Fogo", nivel: 3, mana: 35, mult: 4.0 }, { nome: "Relâmpago Arcano", nivel: 5, mana: 60, mult: 8.0 }], ult: { nome: "APOCALIPSE", nivel: 7, mult: 18.0, recarga: 5 } },
    "Arqueiro": { vida: 120, mana: 90, dano: 25, skills: [{ nome: "Tiro Preciso", nivel: 1, mana: 12, mult: 1.7 }, { nome: "Flecha Envenenada", nivel: 3, mana: 25, mult: 3.0 }, { nome: "Saraivada", nivel: 5, mana: 40, mult: 5.5 }], ult: { nome: "FLECHA DO DESTINO", nivel: 7, mult: 12.0, recarga: 5 } }
};

let jogador = { 
    x: 0, y: 0, classe: "", nivel: 1, xp: 0, xpProx: 100, 
    vidaMax: 100, vida: 100, manaMax: 50, mana: 50, 
    danoBase: 20, dinheiro: 50, pocoes: 3, ultCharge: 0 
};

let mundo = {}; 
let explorado = {}; 
let npcs = {}; 
let emCombate = false;

// Sistema de Save
function salvarJogo() {
    const saveData = { jogador, mundo, explorado, npcs, seed: WORLD_SEED };
    localStorage.setItem("rpg_mundo_infinito_save", JSON.stringify(saveData));
}

function carregarJogo() {
    const saved = localStorage.getItem("rpg_mundo_infinito_save");
    if (!saved) return false;
    try {
        const data = JSON.parse(saved);
        if (data.seed !== WORLD_SEED) return false;
        jogador = data.jogador;
        mundo = data.mundo || {};
        explorado = data.explorado || {};
        npcs = data.npcs || {};
        return true;
    } catch (e) { return false; }
}

function resetarJogo() {
    if (!confirm("Tem certeza? TODO o progresso será apagado!")) return;
    localStorage.clear();
    location.reload();
}

// Geração de Mundo
function noise(x, y) {
    let n = Math.sin(x * 12.9898 + y * 78.233 + WORLD_SEED) * 43758.5453;
    return n - Math.floor(n);
}

function pegarTile(x, y) {
    let chave = `${x},${y}`;
    if (!mundo[chave]) {
        let v = noise(x * WORLD_NOISE_SCALE, y * WORLD_NOISE_SCALE);
        mundo[chave] = v < 0.15 ? "water" : v < 0.30 ? "forest" : v < 0.45 ? "mountain" : "grass";
        if ((mundo[chave] === "grass" || mundo[chave] === "forest") && Math.random() < 0.04) {
            npcs[chave] = { vida: 50 + (jogador.nivel * 15) };
        }
    }
    return mundo[chave];
}

// Loop de Regeneração
setInterval(() => {
    if (!emCombate && jogador.mana < jogador.manaMax) {
        jogador.mana = Math.min(jogador.manaMax, jogador.mana + 2);
        atualizarUI();
        salvarJogo();
    }
}, 1000);

// Interface
function mudarAba(evt, abaNome) {
    document.querySelectorAll(".aba-content").forEach(el => el.style.display = "none");
    document.querySelectorAll(".aba-btn").forEach(el => el.classList.remove("active"));
    document.getElementById(abaNome).style.display = "block";
    evt.currentTarget.classList.add("active");
}

function alternarInventario() {
    const modal = document.getElementById("modal-inv");
    const overlay = document.getElementById("overlay");
    const estaAberto = modal.style.display === "block";
    if (!estaAberto && emCombate) return;
    modal.style.display = estaAberto ? "none" : "block";
    overlay.style.display = estaAberto ? "none" : "block";
    atualizarUI();
}

function selecionarItem(id) {
    const detalhe = document.getElementById("pocao-detalhes");
    detalhe.style.display = detalhe.style.display === "block" ? "none" : "block";
}

function usarPocao() {
    if (jogador.pocoes > 0 && jogador.vida < jogador.vidaMax) {
        jogador.pocoes--;
        let cura = Math.floor(jogador.vidaMax * 0.4);
        jogador.vida = Math.min(jogador.vidaMax, jogador.vida + cura);
        adicionarLog(`Poção usada! +${cura} Vida`, "#2ecc71");
        atualizarUI();
        salvarJogo();
    } else if (jogador.vida >= jogador.vidaMax) {
        alert("Vida cheia!");
    } else {
        alert("Sem poções!");
    }
}

function atualizarUI() {
    document.getElementById("uiClasse").textContent = jogador.classe || "---";
    document.getElementById("uiNivel").textContent = jogador.nivel;
    document.getElementById("uiDinheiro").textContent = jogador.dinheiro;
    document.getElementById("txtVida").textContent = `${Math.floor(jogador.vida)}/${jogador.vidaMax}`;
    document.getElementById("txtMana").textContent = `${Math.floor(jogador.mana)}/${jogador.manaMax}`;
    document.getElementById("vidaBarra").style.width = (jogador.vida / jogador.vidaMax * 100) + "%";
    document.getElementById("manaBarra").style.width = (jogador.mana / jogador.manaMax * 100) + "%";
    document.getElementById("miniPocoes").textContent = jogador.pocoes;
    document.getElementById("invPocoes").textContent = jogador.pocoes;
    document.getElementById("miniDano").textContent = jogador.danoBase;
    document.getElementById("invXP").textContent = `${Math.floor(jogador.xp)} / ${Math.floor(jogador.xpProx)}`;

    const sDiv = document.getElementById("lista-skills");
    if (jogador.classe) {
        let html = "";
        CLASSES[jogador.classe].skills.forEach(s => {
            let tranca = jogador.nivel < s.nivel ? "🔒" : "✨";
            html += `<div>${tranca} Lv.${s.nivel}: ${s.nome}</div>`;
        });
        let u = CLASSES[jogador.classe].ult;
        html += `<div style="margin-top:5px; color:var(--gold)">${jogador.nivel < u.nivel ? "🔒" : "🔥"} Lv.${u.nivel}: ${u.nome}</div>`;
        sDiv.innerHTML = html;
    }
}

function adicionarLog(msg, cor = "#eee") {
    const logDiv = document.getElementById("log");
    logDiv.innerHTML = `<div style="margin-bottom:5px; color:${cor}">> ${msg}</div>` + logDiv.innerHTML;
}

// Combate
function iniciarCombate(inimigo, chave) {
    emCombate = true;
    jogador.ultCharge = 0;
    adicionarLog("⚠️ Inimigo detectado!", "#ff4757");

    setTimeout(() => {
        while (emCombate) {
            jogador.ultCharge++;
            let cUlt = CLASSES[jogador.classe].ult;
            let canUlt = (jogador.nivel >= cUlt.nivel && jogador.ultCharge >= cUlt.recarga);
            
            let acao = prompt(`Inimigo: ${Math.max(0, inimigo.vida)} HP\nSua Vida: ${Math.floor(jogador.vida)}\n\n1-Ataque 2-Skills 3-Poção 4-ULTIMATE 0-Fugir`);

            if (acao === "1") {
                let d = jogador.danoBase + Math.floor(Math.random() * 5);
                inimigo.vida -= d;
                adicionarLog(`Você atacou: ${d} dano`, "#e74c3c");
            } else if (acao === "2") {
                let skills = CLASSES[jogador.classe].skills.filter(s => jogador.nivel >= s.nivel);
                let sEsc = prompt(skills.map((s, i) => `${i+1}-${s.nome}(${s.mana}MP)`).join("\n"));
                let sSel = skills[parseInt(sEsc)-1];
                if (sSel && jogador.mana >= sSel.mana) {
                    jogador.mana -= sSel.mana;
                    inimigo.vida -= Math.floor(jogador.danoBase * sSel.mult);
                    adicionarLog(`Usou ${sSel.nome}!`, "#3498db");
                } else continue;
            } else if (acao === "4" && canUlt) {
                inimigo.vida -= Math.floor(jogador.danoBase * cUlt.mult);
                jogador.ultCharge = 0;
                adicionarLog(`ULTIMATE: ${cUlt.nome}!`, "#f1c40f");
            } else if (acao === "0") {
                emCombate = false; break;
            } else if (acao === "3") {
                usarPocao(); continue;
            } else continue;

            if (inimigo.vida <= 0) {
                adicionarLog("Vitória! +60XP +25G", "#2ecc71");
                jogador.xp += 60; jogador.dinheiro += 25;
                if (jogador.xp >= jogador.xpProx) {
                    jogador.nivel++; jogador.xp = 0; jogador.xpProx *= 1.7;
                    jogador.vidaMax += 30; jogador.manaMax += 20;
                    jogador.vida = jogador.vidaMax; jogador.mana = jogador.manaMax;
                    adicionarLog("LEVEL UP!", "#f1c40f");
                }
                delete npcs[chave]; emCombate = false; break;
            }

            let dInimigo = 10 + (jogador.nivel * 3);
            jogador.vida -= dInimigo;
            if (jogador.vida <= 0) { alert("Game Over!"); location.reload(); return; }
        }
        desenhar();
        salvarJogo();
    }, 100);
}

// Movimentação e Render
function desenhar() {
    const mapaDiv = document.getElementById("mapa");
    mapaDiv.innerHTML = "";
    for (let i = -12; i <= 12; i++) {
        for (let j = -12; j <= 12; j++) {
            let wx = jogador.x + j, wy = jogador.y + i;
            let chave = `${wx},${wy}`;
            let tile = document.createElement("div");
            let tipo = pegarTile(wx, wy);

            if (Math.sqrt(i*i + j*j) <= 12) {
                tile.className = `tile ${tipo}`;
                explorado[chave] = tipo;
                if (npcs[chave]) tile.classList.add("npc-mark");
            } else if (explorado[chave]) {
                tile.className = `tile ${explorado[chave]}`;
                tile.style.opacity = "0.3";
            } else tile.className = "tile hidden";

            if (wx === jogador.x && wy === jogador.y) tile.classList.add("player");
            mapaDiv.appendChild(tile);
        }
    }
    atualizarUI();
}

function mover(dx, dy) {
    if (emCombate || document.getElementById("modal-inv").style.display === "block") return;
    let nx = jogador.x + dx, ny = jogador.y + dy;
    let t = pegarTile(nx, ny);
    if (t !== "water" && t !== "mountain") {
        jogador.x = nx; jogador.y = ny;
        if (npcs[`${nx},${ny}`]) iniciarCombate(npcs[`${nx},${ny}`], `${nx},${ny}`);
    }
    desenhar();
    salvarJogo();
}

function selecionarClasse() {
    let esc = prompt("Escolha: 1-Guerreiro 2-Mago 3-Arqueiro");
    let nome = esc === "2" ? "Mago" : esc === "3" ? "Arqueiro" : "Guerreiro";
    jogador.classe = nome;
    jogador.vidaMax = CLASSES[nome].vida; jogador.vida = jogador.vidaMax;
    jogador.manaMax = CLASSES[nome].mana; jogador.mana = jogador.manaMax;
    jogador.danoBase = CLASSES[nome].dano;
    localStorage.setItem("rpg_classe_persistente", nome);
    atualizarUI();
}

window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (k === "h") alternarInventario();
    if (["w","a","s","d"].includes(k)) mover(k==="d"?1:k==="a"?-1:0, k==="s"?1:k==="w"?-1:0);
});

// Inicialização
if (!carregarJogo()) selecionarClasse();
desenhar();
adicionarLog("Mundo Infinito Carregado.", "#f1c40f");

// --- LOGIN ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtual = user;
        document.getElementById('tela-login').style.display = 'none';
        document.getElementById('ui').style.display = 'flex';
        document.getElementById('container-principal').style.display = 'flex';
        const docSnap = await getDoc(doc(db, "saves", user.uid));
        if (docSnap.exists()) {
            jogador = docSnap.data();
        } else {
            let n = prompt("Escolha: 1-Guerreiro 2-Mago 3-Arqueiro");
            jogador.classe = n === "2" ? "Mago" : n === "3" ? "Arqueiro" : "Guerreiro";
            const b = CLASSES[jogador.classe];
            jogador.vidaMax = b.vida; jogador.vida = b.vida;
            jogador.manaMax = b.mana; jogador.mana = b.mana;
            jogador.danoBase = b.dano;
        }
        desenharMapa();
    }
});

async function salvarJogo() { if(usuarioAtual) await setDoc(doc(db, "saves", usuarioAtual.uid), jogador); }
document.getElementById('btn-entrar').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('senha').value);
window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (["w","a","s","d"].includes(k)) mover(k==="d"?1:k==="a"?-1:0, k==="s"?1:k==="w"?-1:0);
});
