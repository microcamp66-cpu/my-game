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

let emCombate = false;

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
            tile.className = "tile grass";
            if (wx === jogador.x && wy === jogador.y) tile.classList.add("player");
            mapaDiv.appendChild(tile);
        }
    }
    atualizarUI();
}

function mover(dx, dy) {
    if (emCombate || document.getElementById("modal-inv").style.display === "block") return;
    jogador.x += dx; jogador.y += dy;
    desenharMapa();
    salvarJogo();
}

function selecionarClasse() {
    let esc = prompt("Escolha: 1-Guerreiro 2-Mago 3-Arqueiro");
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

// Eventos de Botões
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
        alert("Conta criada!");
    } catch (e) { document.getElementById('status-login').innerText = e.message; }
};

document.getElementById('btn-sair').onclick = () => signOut(auth);
document.getElementById('btn-fechar-inv').onclick = alternarInventario;

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
    if (k === "h") alternarInventario();
    if (["w","a","s","d"].includes(k)) mover(k==="d"?1:k==="a"?-1:0, k==="s"?1:k==="w"?-1:0);
});

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
