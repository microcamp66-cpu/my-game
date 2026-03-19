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

let usuarioAtual = null;
let emCombate = false;
let inimigoAtual = null;

const CLASSES = {
    "Guerreiro": { vida: 180, mana: 50, dano: 20, skills: [{nome: "Golpe Pesado", custo: 15, mult: 2}] },
    "Mago": { vida: 90, mana: 180, dano: 12, skills: [{nome: "Bola de Fogo", custo: 30, mult: 3}] },
    "Arqueiro": { vida: 120, mana: 90, dano: 25, skills: [{nome: "Tiro Preciso", custo: 20, mult: 1.8}] }
};

let jogador = { 
    x: 0, y: 0, classe: "", nivel: 1, xp: 0, xpProx: 100, 
    vidaMax: 100, vida: 100, manaMax: 50, mana: 50, 
    danoBase: 20, dinheiro: 50, pocoes: 3
};

// --- CORE DO JOGO ---

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
    document.getElementById("invXP").textContent = `${Math.floor(jogador.xp)} / ${Math.floor(jogador.xpProx)}`;
    
    desenharHabilidades();
}

function desenharHabilidades() {
    const lista = document.getElementById("lista-skills");
    if (!jogador.classe) return;
    lista.innerHTML = "";
    
    // Botão de Ataque Básico (Sempre visível)
    const btnAtk = document.createElement("button");
    btnAtk.innerText = "⚔️ Ataque Básico";
    btnAtk.style.width = "100%";
    btnAtk.onclick = () => realizarTurno("basico");
    lista.appendChild(btnAtk);

    // Habilidades da Classe
    CLASSES[jogador.classe].skills.forEach(skill => {
        const btn = document.createElement("button");
        btn.innerHTML = `✨ ${skill.nome} (${skill.custo} MP)`;
        btn.style.width = "100%";
        btn.style.marginTop = "5px";
        btn.onclick = () => realizarTurno("skill", skill);
        lista.appendChild(btn);
    });
}

// --- SISTEMA DE COMBATE POR TURNO ---

function verificarEncontro() {
    let seed = Math.abs((jogador.x * 31 + jogador.y * 17) % 100);
    if (seed < 10) iniciarCombate();
}

function iniciarCombate() {
    emCombate = true;
    inimigoAtual = {
        nome: "Goblin",
        vida: 40 + (jogador.nivel * 10),
        dano: 8 + (jogador.nivel * 2)
    };
    logMsg(`⚠️ Um ${inimigoAtual.nome} apareceu! Sua vez.`, "var(--gold)");
}

function realizarTurno(tipo, skill = null) {
    if (!emCombate) return;

    let danoCausado = jogador.danoBase;

    if (tipo === "skill") {
        if (jogador.mana < skill.custo) {
            logMsg("Mana insuficiente!", "var(--red)");
            return;
        }
        jogador.mana -= skill.custo;
        danoCausado = Math.floor(jogador.danoBase * skill.mult);
        logMsg(`✨ Você usou ${skill.nome}!`);
    }

    // Ataque do Jogador
    inimigoAtual.vida -= danoCausado;
    logMsg(`⚔️ Você causou ${danoCausado} de dano. (Inimigo: ${Math.max(0, inimigoAtual.vida)} HP)`);

    if (inimigoAtual.vida <= 0) {
        vitoria();
        return;
    }

    // Turno do Inimigo (Automático após o seu)
    setTimeout(() => {
        const danoInimigo = inimigoAtual.dano;
        jogador.vida -= danoInimigo;
        logMsg(`👾 O ${inimigoAtual.nome} atacou e causou ${danoInimigo} de dano!`, "var(--red)");
        
        if (jogador.vida <= 0) {
            logMsg("💀 Você foi derrotado!", "var(--red)");
            jogador.vida = jogador.vidaMax;
            emCombate = false;
        }
        atualizarUI();
    }, 600);
}

function vitoria() {
    logMsg("✅ Vitória! +30 XP", "#2ecc71");
    jogador.xp += 30;
    if (jogador.xp >= jogador.xpProx) {
        jogador.nivel++;
        jogador.xp = 0;
        jogador.vidaMax += 20;
        jogador.vida = jogador.vidaMax;
        logMsg("Level Up!", "var(--gold)");
    }
    emCombate = false;
    salvarJogo();
    atualizarUI();
}

function logMsg(msg, cor = "#eee") {
    const log = document.getElementById("log");
    log.innerHTML += `<p style="color:${cor}">${msg}</p>`;
    log.scrollTop = log.scrollHeight;
}

// --- MOVIMENTAÇÃO E MAPA ---

function desenharMapa() {
    const mapaDiv = document.getElementById("mapa");
    mapaDiv.innerHTML = "";
    for (let i = -5; i <= 5; i++) {
        for (let j = -12; j <= 12; j++) {
            let wx = jogador.x + j, wy = jogador.y + i;
            let tile = document.createElement("div");
            tile.className = "tile grass";
            if (wx === jogador.x && wy === jogador.y) tile.classList.add("player");
            mapaDiv.appendChild(tile);
        }
    }
    atualizarUI();
}

function mover(dx, dy) {
    if (emCombate) return;
    jogador.x += dx; jogador.y += dy;
    desenharMapa();
    verificarEncontro();
}

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
