import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "ID",
    appId: "ID_DO_APP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let usuarioAtual = null;
let emCombate = false;
let monstroAtual = null;

const CLASSES = {
    "Guerreiro": { vida: 180, mana: 50, dano: 20 },
    "Mago": { vida: 90, mana: 180, dano: 12 },
    "Arqueiro": { vida: 120, mana: 90, dano: 25 }
};

const MONSTROS = [
    { nome: "Limo Verde", hpMax: 40, hp: 40, dano: 6, xp: 20, ouro: 10 },
    { nome: "Esqueleto", hpMax: 70, hp: 70, dano: 12, xp: 50, ouro: 25 },
    { nome: "Ogro", hpMax: 150, hp: 150, dano: 22, xp: 120, ouro: 60 }
];

let jogador = { 
    x: 0, y: 0, classe: "", nivel: 1, xp: 0, xpProx: 100, 
    vidaMax: 100, vida: 100, manaMax: 50, mana: 50, 
    danoBase: 20, dinheiro: 50, pocoes: 3
};

// --- NÚCLEO ---
async function salvarJogo() {
    if (usuarioAtual) await setDoc(doc(db, "saves", usuarioAtual.uid), jogador);
}

function atualizarUI() {
    document.getElementById("uiClasse").textContent = jogador.classe || "---";
    document.getElementById("uiNivel").textContent = jogador.nivel;
    document.getElementById("uiDinheiro").textContent = jogador.dinheiro;
    document.getElementById("txtVida").textContent = `${Math.floor(jogador.vida)}/${jogador.vidaMax}`;
    document.getElementById("vidaBarra").style.width = (jogador.vida / jogador.vidaMax * 100) + "%";
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
            tile.className = "tile grass";
            if (wx === 0 && wy === 0) tile.style.border = "2px solid gold"; // Vila
            if (wx === jogador.x && wy === jogador.y) tile.classList.add("player");
            mapaDiv.appendChild(tile);
        }
    }
    atualizarUI();
}

function mover(dx, dy) {
    if (emCombate || document.getElementById("modal-inv").style.display === "block") return;
    jogador.x += dx; jogador.y += dy;
    
    // Loja no 0,0
    if (jogador.x === 0 && jogador.y === 0) {
        document.getElementById("modal-loja").style.display = "block";
        document.getElementById("overlay").style.display = "block";
    } else if (Math.random() < 0.15) {
        iniciarCombate();
    }
    
    desenharMapa();
    salvarJogo();
}

// --- LÓGICA DE COMBATE ---
function iniciarCombate() {
    emCombate = true;
    monstroAtual = { ...MONSTROS[Math.floor(Math.random() * MONSTROS.length)] };
    document.getElementById("combate-nome-monstro").textContent = monstroAtual.nome;
    document.getElementById("combate-log").innerHTML = `Um ${monstroAtual.nome} bloqueia seu caminho!`;
    document.getElementById("modal-combate").style.display = "block";
    document.getElementById("overlay").style.display = "block";
    atualizarBarraMonstro();
}

function atualizarBarraMonstro() {
    const perc = (monstroAtual.hp / monstroAtual.hpMax) * 100;
    document.getElementById("combateVidaMonstro").style.width = perc + "%";
}

function acaoCombate(tipo) {
    const log = document.getElementById("combate-log");
    if (tipo === 'atacar') {
        let d = Math.floor(jogador.danoBase * (0.8 + Math.random() * 0.4));
        monstroAtual.hp -= d;
        log.innerHTML = `⚔️ Você causou ${d} de dano!`;
        if (monstroAtual.hp <= 0) return vitoria();
    } else if (tipo === 'curar') {
        if (jogador.pocoes > 0) {
            jogador.pocoes--;
            jogador.vida = Math.min(jogador.vidaMax, jogador.vida + 40);
            log.innerHTML = "🧪 Você usou uma poção!";
            atualizarUI();
        } else { log.innerHTML = "❌ Sem poções!"; return; }
    } else if (tipo === 'fugir') {
        if (Math.random() > 0.5) { finalizarCombate(); return; }
        else log.innerHTML = "🏃 Falhou ao fugir!";
    }

    atualizarBarraMonstro();
    setTimeout(() => {
        let dm = Math.floor(monstroAtual.dano * (0.8 + Math.random() * 0.4));
        jogador.vida -= dm;
        log.innerHTML += `<br>💥 Inimigo causou ${dm} de dano!`;
        atualizarUI();
        if (jogador.vida <= 0) morrer();
    }, 500);
}

function vitoria() {
    alert(`🏆 Ganhou ${monstroAtual.xp} XP e 💰 ${monstroAtual.ouro} Ouro!`);
    jogador.xp += monstroAtual.xp;
    jogador.dinheiro += monstroAtual.ouro;
    if (jogador.xp >= jogador.xpProx) {
        jogador.nivel++; jogador.xp = 0; jogador.xpProx *= 1.8;
        jogador.vidaMax += 25; jogador.vida = jogador.vidaMax;
    }
    finalizarCombate();
}

function finalizarCombate() {
    emCombate = false;
    document.getElementById("modal-combate").style.display = "none";
    document.getElementById("overlay").style.display = "none";
    salvarJogo();
}

function morrer() {
    alert("💀 Você desmaiou e foi levado de volta à Vila.");
    jogador.vida = jogador.vidaMax; jogador.x = 0; jogador.y = 0;
    finalizarCombate();
    desenharMapa();
}

// --- EVENTOS ---
document.getElementById("btn-atacar").onclick = () => acaoCombate('atacar');
document.getElementById("btn-curar-luta").onclick = () => acaoCombate('curar');
document.getElementById("btn-fugir").onclick = () => acaoCombate('fugir');
document.getElementById("btn-fechar-loja").onclick = () => {
    document.getElementById("modal-loja").style.display = "none";
    document.getElementById("overlay").style.display = "none";
};
document.getElementById("comprar-pocao").onclick = () => {
    if (jogador.dinheiro >= 20) {
        jogador.dinheiro -= 20; jogador.pocoes++;
        atualizarUI(); salvarJogo();
    } else alert("Ouro insuficiente!");
};

// Reutilizando seus eventos originais
document.getElementById('btn-entrar').onclick = async () => {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    try { await signInWithEmailAndPassword(auth, email, senha); } 
    catch (e) { document.getElementById('status-login').innerText = "Erro ao entrar."; }
};

document.getElementById('btn-criar').onclick = async () => {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    try { await createUserWithEmailAndPassword(auth, email, senha); alert("Conta criada!"); } 
    catch (e) { document.getElementById('status-login').innerText = e.message; }
};

document.getElementById('btn-sair').onclick = () => signOut(auth);
document.getElementById('btn-fechar-inv').onclick = () => {
    document.getElementById("modal-inv").style.display = "none";
    document.getElementById("overlay").style.display = "none";
};

document.querySelectorAll('.aba-btn').forEach(btn => {
    btn.onclick = (e) => {
        document.querySelectorAll('.aba-content').forEach(c => c.style.display = 'none');
        document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(e.target.dataset.aba).style.display = 'block';
        e.target.classList.add('active');
    };
});

window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (k === "h") {
        const m = document.getElementById("modal-inv");
        m.style.display = m.style.display === "block" ? "none" : "block";
        document.getElementById("overlay").style.display = m.style.display;
    }
    if (["w","a","s","d"].includes(k)) mover(k==="d"?1:k==="a"?-1:0, k==="s"?1:k==="w"?-1:0);
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtual = user;
        document.getElementById('tela-login').style.display = 'none';
        document.getElementById('ui').style.display = 'flex';
        document.getElementById('container-principal').style.display = 'flex';
        const docSnap = await getDoc(doc(db, "saves", user.uid));
        if (docSnap.exists()) { jogador = docSnap.data(); } 
        else {
            let esc = prompt("Escolha: 1-Guerreiro 2-Mago 3-Arqueiro");
            let n = esc === "2" ? "Mago" : esc === "3" ? "Arqueiro" : "Guerreiro";
            jogador.classe = n;
            jogador.vidaMax = CLASSES[n].vida; jogador.vida = jogador.vidaMax;
            jogador.danoBase = CLASSES[n].dano;
            salvarJogo();
        }
        desenharMapa();
    } else { document.getElementById('tela-login').style.display = 'flex'; }
});
