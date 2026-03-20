import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

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

// Configurações Globais
const WORLD_SEED = 42;
const WORLD_NOISE_SCALE = 0.08;
let usuarioAtual = null;
let emCombate = false;
let mundo = {}; 
let npcs = {};

const CLASSES = {
    "Guerreiro": { vida: 180, mana: 50, dano: 20, skills: [{ nome: "Corte Rápido", nivel: 1, mana: 10, mult: 1.5 }, { nome: "Impacto Terrestre", nivel: 3, mana: 20, mult: 2.5 }], ult: { nome: "COLOSSO", nivel: 7, mult: 10.0, recarga: 5 } },
    "Mago": { vida: 90, mana: 180, dano: 12, skills: [{ nome: "Dardo Gelo", nivel: 1, mana: 15, mult: 2.0 }, { nome: "Explosão Fogo", nivel: 3, mana: 35, mult: 4.0 }], ult: { nome: "APOCALIPSE", nivel: 7, mult: 18.0, recarga: 5 } },
    "Arqueiro": { vida: 120, mana: 90, dano: 25, skills: [{ nome: "Tiro Preciso", nivel: 1, mana: 12, mult: 1.7 }, { nome: "Venenosa", nivel: 3, mana: 25, mult: 3.0 }], ult: { nome: "DESTINO", nivel: 7, mult: 12.0, recarga: 5 } }
};

let jogador = { 
    x: 0, y: 0, classe: "", nivel: 1, xp: 0, xpProx: 100, 
    vidaMax: 100, vida: 100, manaMax: 50, mana: 50, 
    danoBase: 20, dinheiro: 50, pocoes: 3, ultCharge: 0 
};

// --- AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtual = user;
        document.getElementById('tela-login').style.display = 'none';
        const docSnap = await getDoc(doc(db, "saves", user.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            jogador = data.jogador;
            mundo = data.mundo || {};
            npcs = data.npcs || {};
        } else {
            selecionarClasse();
        }
        desenhar();
    }
});

document.getElementById('btn-entrar').onclick = () => {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    signInWithEmailAndPassword(auth, email, senha).catch(err => alert(err.message));
};

document.getElementById('btn-criar').onclick = () => {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    createUserWithEmailAndPassword(auth, email, senha).then(() => alert("Criado!")).catch(err => alert(err.message));
};

// --- MUNDO E RENDER ---
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

function desenhar() {
    const mapaDiv = document.getElementById("mapa");
    mapaDiv.innerHTML = "";
    for (let i = -5; i <= 5; i++) {
        for (let j = -5; j <= 5; j++) {
            let wx = jogador.x + j, wy = jogador.y + i;
            let chave = `${wx},${wy}`;
            let tile = document.createElement("div");
            tile.className = `tile ${pegarTile(wx, wy)}`;
            if (npcs[chave]) tile.classList.add("npc-mark");
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

// --- SISTEMAS ---
async function salvarJogo() {
    if (usuarioAtual) await setDoc(doc(db, "saves", usuarioAtual.uid), { jogador, mundo, npcs, seed: WORLD_SEED });
}

function atualizarUI() {
    document.getElementById("uiClasse").textContent = jogador.classe;
    document.getElementById("uiNivel").textContent = jogador.nivel;
    document.getElementById("uiDinheiro").textContent = jogador.dinheiro;
    document.getElementById("txtVida").textContent = `${Math.floor(jogador.vida)}/${jogador.vidaMax}`;
    document.getElementById("txtMana").textContent = `${Math.floor(jogador.mana)}/${jogador.manaMax}`;
    document.getElementById("vidaBarra").style.width = (jogador.vida / jogador.vidaMax * 100) + "%";
    document.getElementById("manaBarra").style.width = (jogador.mana / jogador.manaMax * 100) + "%";
    document.getElementById("miniPocoes").textContent = jogador.pocoes;
    document.getElementById("invPocoes").textContent = jogador.pocoes;
    document.getElementById("miniDano").textContent = jogador.danoBase;
    document.getElementById("invXP").textContent = jogador.xp + "/" + jogador.xpProx;
}

// Global para o botão do HTML
window.usarPocao = function() {
    if (jogador.pocoes > 0 && jogador.vida < jogador.vidaMax) {
        jogador.pocoes--;
        jogador.vida = Math.min(jogador.vidaMax, jogador.vida + (jogador.vidaMax * 0.4));
        adicionarLog("Curou vida!", "#2ecc71");
        atualizarUI();
        salvarJogo();
    }
};

window.alternarInventario = function() {
    const modal = document.getElementById("modal-inv");
    const overlay = document.getElementById("overlay");
    const aberto = modal.style.display === "block";
    modal.style.display = aberto ? "none" : "block";
    overlay.style.display = aberto ? "none" : "block";
};

function adicionarLog(msg, cor) {
    const log = document.getElementById("log");
    log.innerHTML = `<div style="color:${cor}">> ${msg}</div>` + log.innerHTML;
}

function iniciarCombate(inimigo, chave) {
    emCombate = true;
    adicionarLog("Combate iniciado!", "#e74c3c");
    setTimeout(() => {
        while(emCombate) {
            let acao = prompt(`Inimigo: ${inimigo.vida}HP | Sua Vida: ${jogador.vida}\n1-Ataque 2-Poção 0-Fuga`);
            if (acao === "1") {
                inimigo.vida -= jogador.danoBase;
                if (inimigo.vida <= 0) {
                    adicionarLog("Vitória! +50XP", "#2ecc71");
                    jogador.xp += 50; jogador.dinheiro += 20;
                    delete npcs[chave]; emCombate = false; break;
                }
                jogador.vida -= (10 + jogador.nivel * 2);
            } else if (acao === "2") { window.usarPocao(); }
            else { emCombate = false; break; }
            
            if (jogador.vida <= 0) { alert("Morreu!"); location.reload(); return; }
        }
        desenhar();
        salvarJogo();
    }, 100);
}

function selecionarClasse() {
    let esc = prompt("1-Guerreiro 2-Mago 3-Arqueiro");
    let nome = esc === "2" ? "Mago" : esc === "3" ? "Arqueiro" : "Guerreiro";
    jogador.classe = nome;
    jogador.vidaMax = CLASSES[nome].vida; jogador.vida = jogador.vidaMax;
    jogador.manaMax = CLASSES[nome].mana; jogador.mana = jogador.manaMax;
    jogador.danoBase = CLASSES[nome].dano;
    salvarJogo();
}

window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (k === "h") window.alternarInventario();
    if (["w","a","s","d"].includes(k)) mover(k==="d"?1:k==="a"?-1:0, k==="s"?1:k==="w"?-1:0);
});
