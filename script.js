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

const CLASSES = {
    "Guerreiro": { vida: 180, mana: 50, dano: 20 },
    "Mago": { vida: 90, mana: 180, dano: 12 },
    "Arqueiro": { vida: 120, mana: 90, dano: 25 }
};

let jogador = { 
    x: 0, y: 0, classe: "", nivel: 1, xp: 0, xpProx: 100, 
    vidaMax: 100, vida: 100, manaMax: 50, mana: 50, 
    danoBase: 20, dinheiro: 50, pocoes: 3
};

// --- MECÂNICAS DE JOGO ---

async function salvarJogo() {
    if (usuarioAtual) {
        await setDoc(doc(db, "saves", usuarioAtual.uid), jogador);
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
}

function desenharMapa() {
    const mapaDiv = document.getElementById("mapa");
    mapaDiv.innerHTML = "";
    
    for (let i = -5; i <= 5; i++) {
        for (let j = -12; j <= 12; j++) {
            let wx = jogador.x + j, wy = jogador.y + i;
            let tile = document.createElement("div");
            
            // Gerador de terreno baseado em coordenadas (Pseudo-procedural)
            let noise = (Math.sin(wx * 0.5) + Math.cos(wy * 0.5));
            tile.className = "tile " + (noise > 1.2 ? "forest" : noise < -1.2 ? "water" : "grass");

            // Renderiza inimigos (Caveiras) baseados na "semente" da coordenada
            let seed = Math.abs((wx * 31 + wy * 17) % 100);
            if (seed < 5 && noise > -1.2 && (wx !== jogador.x || wy !== jogador.y)) {
                tile.classList.add("npc-mark");
            }

            if (wx === jogador.x && wy === jogador.y) tile.classList.add("player");
            mapaDiv.appendChild(tile);
        }
    }
    atualizarUI();
}

function mover(dx, dy) {
    if (emCombate || document.getElementById("modal-inv").style.display === "block") return;
    
    jogador.x += dx; 
    jogador.y += dy;
    
    desenharMapa();
    verificarEncontro();
}

function verificarEncontro() {
    // Mesma lógica da semente do mapa para detectar se pisou no monstro
    let seed = Math.abs((jogador.x * 31 + jogador.y * 17) % 100);
    let noise = (Math.sin(jogador.x * 0.5) + Math.cos(jogador.y * 0.5));
    
    if (seed < 5 && noise > -1.2) {
        iniciarCombate();
    }
}

function iniciarCombate() {
    emCombate = true;
    const log = document.getElementById("log");
    
    let monstroVida = 30 + (jogador.nivel * 15);
    let monstroDano = 5 + (jogador.nivel * 3);
    
    log.innerHTML += `<p style="color:var(--gold)">⚔️ <b>Combate iniciado contra Monstro Nvl ${jogador.nivel}!</b></p>`;

    let turno = setInterval(() => {
        // Jogador Ataca
        monstroVida -= jogador.danoBase;
        log.innerHTML += `<p>Você causou ${jogador.danoBase} de dano.</p>`;

        if (monstroVida <= 0) {
            log.innerHTML += `<p style="color:#2ecc71">✔ Vitória! +25 XP e +15 Ouro.</p>`;
            ganharXP(25);
            jogador.dinheiro += 15;
            finalizarCombate(turno);
            return;
        }

        // Monstro Ataca
        jogador.vida -= monstroDano;
        log.innerHTML += `<p style="color:var(--red)">Monstro causou ${monstroDano} de dano.</p>`;

        if (jogador.vida <= 0) {
            log.innerHTML += `<p style="color:var(--red)">💀 Você foi derrotado e perdeu 20 de ouro...</p>`;
            jogador.vida = jogador.vidaMax; // Ressuscita
            jogador.dinheiro = Math.max(0, jogador.dinheiro - 20);
            finalizarCombate(turno);
            return;
        }

        atualizarUI();
        log.scrollTop = log.scrollHeight;
    }, 1000);
}

function finalizarCombate(intervalo) {
    clearInterval(intervalo);
    emCombate = false;
    salvarJogo();
    atualizarUI();
}

function ganharXP(qtd) {
    jogador.xp += qtd;
    if (jogador.xp >= jogador.xpProx) {
        jogador.nivel++;
        jogador.xp = 0;
        jogador.xpProx *= 1.5;
        jogador.vidaMax += 25;
        jogador.vida = jogador.vidaMax;
        jogador.danoBase += 5;
        document.getElementById("log").innerHTML += `<p style="color:var(--gold)">✨ <b>LEVEL UP! Você agora é Nível ${jogador.nivel}!</b></p>`;
    }
}

// --- SISTEMA DE LOGIN E UI ---

function selecionarClasse() {
    let esc = prompt("Escolha sua classe: 1-Guerreiro 2-Mago 3-Arqueiro");
    let nome = esc === "2" ? "Mago" : esc === "3" ? "Arqueiro" : "Guerreiro";
    jogador.classe = nome;
    jogador.vidaMax = CLASSES[nome].vida; jogador.vida = jogador.vidaMax;
    jogador.manaMax = CLASSES[nome].mana; jogador.mana = jogador.manaMax;
    jogador.danoBase = CLASSES[nome].dano;
    atualizarUI();
    salvarJogo();
}

function alternarInventario() {
    const modal = document.getElementById("modal-inv");
    const overlay = document.getElementById("overlay");
    const estaVisivel = modal.style.display === "block";
    modal.style.display = estaVisivel ? "none" : "block";
    overlay.style.display = modal.style.display;
}

// Eventos
document.getElementById('btn-entrar').onclick = async () => {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    try { await signInWithEmailAndPassword(auth, email, senha); } 
    catch (e) { document.getElementById('status-login').innerText = "Erro ao entrar."; }
};

document.getElementById('btn-criar').onclick = async () => {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    try { 
        await createUserWithEmailAndPassword(auth, email, senha); 
        alert("Conta criada com sucesso!");
    } catch (e) { document.getElementById('status-login').innerText = "Erro ao criar conta."; }
};

document.getElementById('btn-sair').onclick = () => signOut(auth);
document.getElementById('btn-fechar-inv').onclick = alternarInventario;

// Sistema de abas do inventário
document.querySelectorAll('.aba-btn').forEach(btn => {
    btn.onclick = (e) => {
        document.querySelectorAll('.aba-content').forEach(c => c.style.display = 'none');
        document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(e.target.dataset.aba).style.display = 'block';
        e.target.classList.add('active');
    };
});

// Atalhos de teclado
window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (k === "h") alternarInventario();
    if (["w","a","s","d"].includes(k)) mover(k==="d"?1:k==="a"?-1:0, k==="s"?1:k==="w"?-1:0);
});

// Monitor de autenticação
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
            selecionarClasse();
        }
        desenharMapa();
    } else {
        usuarioAtual = null;
        document.getElementById('tela-login').style.display = 'flex';
        document.getElementById('ui').style.display = 'none';
        document.getElementById('container-principal').style.display = 'none';
    }
});
