import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword 
} from "firebase/auth";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc 
} from "firebase/firestore";

// --- CONFIGURAÇÃO FIREBASE ---
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

// --- VARIÁVEIS GLOBAIS ---
const WORLD_SEED = 42;
const WORLD_NOISE_SCALE = 0.08;
let usuarioAtual = null;
let emCombate = false;
let mundo = {}; 
let explorado = {}; 
let npcs = {};

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

// --- AUTENTICAÇÃO ---

// Observador de Login
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtual = user;
        document.getElementById('tela-login').style.display = 'none';
        
        // Tenta carregar save do Firestore
        const docSnap = await getDoc(doc(db, "saves", user.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            jogador = data.jogador;
            mundo = data.mundo || {};
            npcs = data.npcs || {};
            adicionarLog("Bem-vindo de volta, Herói!", "#f1c40f");
        } else {
            selecionarClasse();
        }
        desenhar();
    } else {
        document.getElementById('tela-login').style.display = 'block';
    }
});

// Botão Entrar
document.getElementById('btn-entrar').onclick = () => {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    signInWithEmailAndPassword(auth, email, senha)
        .catch(err => document.getElementById('status-login').textContent = "Erro: " + err.message);
};

// Botão Criar Conta
document.getElementById('btn-criar').onclick = () => {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    createUserWithEmailAndPassword(auth, email, senha)
        .then(() => alert("Conta criada com sucesso!"))
        .catch(err => document.getElementById('status-login').textContent = "Erro: " + err.message);
};

// --- SISTEMA DE SAVE ---
async function salvarJogo() {
    if (usuarioAtual) {
        await setDoc(doc(db, "saves", usuarioAtual.uid), {
            jogador, mundo, explorado, npcs, seed: WORLD_SEED
        });
    }
}

// --- LÓGICA DO MUNDO (Geração Procedural) ---
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

// --- INTERFACE ---
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
        sDiv.innerHTML = html;
    }
}

function adicionarLog(msg, cor = "#eee") {
    const logDiv = document.getElementById("log");
    logDiv.innerHTML = `<div style="margin-bottom:5px; color:${cor}">> ${msg}</div>` + logDiv.innerHTML;
}

// --- MOVIMENTAÇÃO E RENDER ---
function desenhar() {
    const mapaDiv = document.getElementById("mapa");
    mapaDiv.innerHTML = "";
    // Renderiza uma área de 11x11 em volta do jogador
    for (let i = -5; i <= 5; i++) {
        for (let j = -5; j <= 5; j++) {
            let wx = jogador.x + j, wy = jogador.y + i;
            let chave = `${wx},${wy}`;
            let tile = document.createElement("div");
            let tipo = pegarTile(wx, wy);

            tile.className = `tile ${tipo}`;
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
        jogador.x = nx; 
        jogador.y = ny;
        if (npcs[`${nx},${ny}`]) iniciarCombate(npcs[`${nx},${ny}`], `${nx},${ny}`);
    }
    desenhar();
    salvarJogo();
}

function selecionarClasse() {
    let esc = prompt("Escolha sua classe:\n1-Guerreiro\n2-Mago\n3-Arqueiro");
    let nome = esc === "2" ? "Mago" : esc === "3" ? "Arqueiro" : "Guerreiro";
    jogador.classe = nome;
    const c = CLASSES[nome];
    jogador.vidaMax = c.vida; jogador.vida = c.vida;
    jogador.manaMax = c.mana; jogador.mana = c.mana;
    jogador.danoBase = c.dano;
    salvarJogo();
}

// --- EVENTOS ---
window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (k === "h") alternarInventario(); // Certifique-se que alternarInventario está definida
    if (["w","a","s","d"].includes(k)) mover(k==="d"?1:k==="a"?-1:0, k==="s"?1:k==="w"?-1:0);
});

// Funções de Interface (Globais para o HTML acessar)
window.alternarInventario = function() {
    const modal = document.getElementById("modal-inv");
    const overlay = document.getElementById("overlay");
    const estaAberto = modal.style.display === "block";
    modal.style.display = estaAberto ? "none" : "block";
    overlay.style.display = estaAberto ? "none" : "block";
};

window.mudarAba = function(evt, abaNome) {
    document.querySelectorAll(".aba-content").forEach(el => el.style.display = "none");
    document.querySelectorAll(".aba-btn").forEach(el => el.classList.remove("active"));
    document.getElementById(abaNome).style.display = "block";
    evt.currentTarget.classList.add("active");
};

// Regeneração Passiva
setInterval(() => {
    if (usuarioAtual && !emCombate && jogador.mana < jogador.manaMax) {
        jogador.mana = Math.min(jogador.manaMax, jogador.mana + 2);
        atualizarUI();
    }
}, 1000);
