let jogadas = 0;
let maquinaSelecionada = null;
let statusMaquinas = { plush: "disponivel", toy: "disponivel" };
let iniciandoJogo = false;

function clicarMaquina(id){

  if(
  statusMaquinas[id] !== "disponivel" &&
  statusMaquinas[id] !== "minha"
){
  notificar("Essa máquina não está disponível!");
  return;
}


  // toggle seleção
  maquinaSelecionada =
    maquinaSelecionada === id ? null : id;


  // redesenha os botões SEM ir no firebase
  ["plush","toy"].forEach(m => {

    const btn = document.getElementById(
      "status" + m.charAt(0).toUpperCase() + m.slice(1)
    );

    if (!btn) return;

    // ocupada ou indisponível
    if(
  statusMaquinas[m] === "ocupada" ||
  statusMaquinas[m] === "indisponivel"
){
  btn.innerText =
    statusMaquinas[m] === "ocupada"
      ? "Ocupada"
      : "Indisponível";

  btn.className = "sel-btn-status sel-indisponivel";
  return;
}


    // selecionada
    if(maquinaSelecionada === m){
      btn.innerText = "Selecionada";
      btn.className = "sel-btn-status sel-selecionada";
    }
    else{
      btn.innerText = "Selecionar";
      btn.className = "sel-btn-status sel-disponivel";
    }

  });

}

  
function iniciarJogo() {

  if(iniciandoJogo) return; // 🚨 BLOQUEIA DUPLO CLIQUE

  if (!maquinaSelecionada) 
    return notificar("Selecione uma máquina!");

  if (jogadas <= 0) 
    return notificar("Selecione o número de jogadas!");
  iniciandoJogo = true; // 🔒 trava botão
  setBtnLoading("btnIniciar", true);

  firebase.auth().onAuthStateChanged(user => {

    if (!user) return notificar("Faça login!");

    const maquinaRef = db.collection("maquinas").doc(maquinaSelecionada);
    const userRef = db.collection("users").doc(user.uid);

    db.runTransaction(async (transaction) => {

      const agora = Date.now();
      const maquinaDoc = await transaction.get(maquinaRef);
      if (!maquinaDoc.exists)
        throw new Error("Máquina não encontrada.");

      
const dados = maquinaDoc.data();

// ✅ PEGA O USUÁRIO UMA ÚNICA VEZ
const userDoc = await transaction.get(userRef);
if (!userDoc.exists)
  throw new Error("Usuário não encontrado.");

const userData = userDoc.data();

let saldo = userData.saldo || 0;
const username = userData.username;


// 🔥 AGORA pode usar saldo
if(dados.jogando && dados.uid === user.uid){

  let valorJogada = maquinaSelecionada === "toy" ? 5 : 2;
  let total = jogadas * valorJogada;

  if (saldo < total)
    throw new Error("Saldo insuficiente!");

  saldo -= total;

  const tempoExtra = jogadas * 60000;

  transaction.update(maquinaRef, {
    fim: dados.fim + tempoExtra
  });

  transaction.update(userRef, { saldo });

  return saldo;
}



// 🔴 se for OUTRA pessoa → bloqueia
if(dados.jogando && dados.fim > agora){

  const jogadorAtual = dados.jogador?.trim()
    ? dados.jogador
    : "Outro jogador";

  throw new Error(
    `${jogadorAtual} foi mais rápido no clique. Aguarde liberar!`
  );
}

      let valorJogada = maquinaSelecionada === "toy" ? 5 : 2;
      let total = jogadas * valorJogada;

      if (saldo < total)
        throw new Error("Saldo insuficiente!");

      saldo -= total;

      // ⏰ 1 minuto por jogada
const tempoTotal = jogadas * 1 * 60 * 1000;


      
      // 🔥 TRAVAR MÁQUINA
transaction.update(maquinaRef, {
  jogando: true,
  jogador: username,
  uid: user.uid,

  inicio: agora,              // ⭐ novo (opcional mas profissional)
  tempoTotal: tempoTotal,     // ⭐ guarda o tempo comprado
  fim: agora + tempoTotal     // usado para calcular o restante
});


      // 🔥 atualizar saldo
      transaction.update(userRef, { saldo });

      return saldo;

    })
    .then((saldoAtualizado) => {
      notificar(`🎮 Máquina ${maquinaSelecionada.toUpperCase()} iniciada!`); 
       iniciandoJogo = false;
  setBtnLoading("btnIniciar", false);
    })
    .catch(err => {
      notificar(err.message);
      iniciandoJogo = false;
  setBtnLoading("btnIniciar", false);
    });

  });

}

// 🔹 Listener para liberar máquinas automaticamente
setInterval(async () => {
  const agora = Date.now();
  for (const nome of ["plush","toy"]) {
    const doc = await db.collection("maquinas").doc(nome).get();
    if (!doc.exists) continue;

    const dados = doc.data();
    
    // libera máquina se o tempo acabou
if (dados.jogando && dados.fim < agora) {
  await doc.ref.update({
    jogando: false,
    jogador: "",
    uid: "",
    inicio: null,
    tempoTotal: 0,
    fim: null
  });
}


    // atualiza status visual
    atualizarStatusMaquina(doc);
  }
}, 1000);




let listenerMaquinas = null;

async function abrirTelaSelecionar(){

  irPara("telaSelecionar");

  // 🔥 verifica internet imediatamente
  if(!navigator.onLine){
    notificar("Você está desconectado. Feche e volte a abrir o site.","a");
  }
window.addEventListener("offline", () => {

  const telaSelecionar = document.getElementById("telaSelecionar");

  // verifica se a tela está visível
  if(telaSelecionar && telaSelecionar.classList.contains("base")){
      notificar("Você está desconectado. Feche e volte a abrir o site.","a");
  }

});

  

  document.getElementById("loader").style.display = "block";

  document.querySelectorAll(".sel-maquinas .sel-card")
    .forEach(c => c.style.display = "none");

  // mata listener antigo
  if (listenerMaquinas) listenerMaquinas();

  // 🔹 leitura inicial
  const snapshotInicial = await db.collection("maquinas").get();
  snapshotInicial.forEach(doc => {
    atualizarStatusMaquina(doc);
  });

  // 🔹 listener em tempo real
  listenerMaquinas = db.collection("maquinas")
    .onSnapshot(snapshot => {
      snapshot.forEach(doc => {
        atualizarStatusMaquina(doc);
      });
    });

  document.getElementById("loader").style.display = "none";
  document.querySelectorAll(".sel-maquinas .sel-card")
    .forEach(c => c.style.display = "block");

}

function atualizarStatusMaquina(doc){

  const id = doc.id;
  const dados = doc.data();
  const agora = Date.now();

  const btn = document.getElementById(
    "status" + id.charAt(0).toUpperCase() + id.slice(1)
  );

  if(!btn) return;

  const card = btn.closest(".sel-card");

  const ocupada = dados.jogando && dados.fim > agora;
  const uid = auth.currentUser?.uid;

  const souEu = ocupada && dados.uid === uid;

  let novoEstado = "disponivel";

  // 🔥 PRIORIDADE MÁXIMA → sou eu jogando
  if(souEu){
    novoEstado = "minha";
  }
  else if(ocupada){
    novoEstado = "ocupada";
  }
  else if(dados.status !== "disponivel"){
    novoEstado = "indisponivel";
  }

  // evita redesenho desnecessário
  if(statusMaquinas[id] === novoEstado) return;

  statusMaquinas[id] = novoEstado;

  // só limpa seleção se OUTRO travou
  if(novoEstado === "ocupada" && maquinaSelecionada === id){
    maquinaSelecionada = null;
  }

  // -------- UI ----------

  // 🟢 MINHA máquina (parece disponível)
if(novoEstado === "minha"){

  card.style.pointerEvents = "auto";
  card.style.opacity = "1";

  btn.innerText = "Selecionar"; // 🔥 parece livre
  btn.className = "sel-btn-status sel-disponivel";

  return;
}

  // 🔴 ocupada por outro
  if(novoEstado === "ocupada"){

    btn.innerText = "Ocupada";
    btn.className = "sel-btn-status sel-indisponivel";
    card.style.pointerEvents = "none";
    card.style.opacity = "0.6";

    return;
  }

  // ⚫ manutenção
  if(novoEstado === "indisponivel"){

    btn.innerText = "Indisponível";
    btn.className = "sel-btn-status sel-indisponivel";
    card.style.pointerEvents = "none";
    card.style.opacity = "0.5";

    return;
  }

  // 🟡 disponível
  card.style.pointerEvents = "auto";
  card.style.opacity = "1";

  if(maquinaSelecionada === id){
    btn.innerText = "Selecionada";
    btn.className = "sel-btn-status sel-selecionada";
  }else{
    btn.innerText = "Selecionar";
    btn.className = "sel-btn-status sel-disponivel";
  }
}


function toggleJogadas(){
  const lista = document.getElementById("listaJogadas");
  lista.style.display = lista.style.display === "block" ? "none" : "block";
}

function selecionarJogada(valor){
  jogadas = valor;
  document.getElementById("valorJogadas").innerText =
    String(valor).padStart(2, "0");

  document.getElementById("listaJogadas").style.display = "none";
}

/* FECHAR AO CLICAR FORA */
document.addEventListener("click", e => {
  if (!e.target.closest(".sel-dropdown") &&
      !e.target.closest(".sel-lista")) {
    document.getElementById("listaJogadas").style.display = "none";
  }
});

const perfil = document.getElementById('perfil');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const sendBtn = document.getElementById('send-btn');


auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // Se não estiver logado, volta para a tela de login
    irPara('telacadastro/Login');
    return;
  }

  // Mostra a inicial do perfil (username)
  const userDoc = await db.collection('users').doc(user.uid).get();
  if (userDoc.exists) {
    const username = userDoc.data().username;
    perfil.innerText = username.charAt(0).toUpperCase();
  }

  sendBtn.onclick = async () => {
    const text = chatInput.value.trim();
    if (!text) return;


  // Busca o nome do usuário no Firestore
  const userDoc = await db.collection('users').doc(user.uid).get();
let nomeUsuario = 'Usuário';

if (userDoc.exists && userDoc.data().username) {
  nomeUsuario = userDoc.data().username;
}

await db.collection('chat').add({
  username: nomeUsuario, // ✅ campo correto
  uid: user.uid,
  message: text,
  timestamp: firebase.firestore.FieldValue.serverTimestamp()
});

chatInput.value = '';
};



  // Receber mensagens em tempo real
db.collection('chat').orderBy('timestamp')
  .onSnapshot(snapshot => {
    chatMessages.innerHTML = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const div = document.createElement('div');

      div.classList.add('message');
      div.classList.add(data.uid === user.uid ? 'sent' : 'received');

      const nome = data.user || 'Usuário'; // 👈 garante nome
      div.textContent = `${data.username}: ${data.message}`;


      chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
});

let telaAtual = document.querySelector(".tela.base");
let historicoTelas = [];

function irPara(id){
    const nova = document.getElementById(id);
    if(!nova || nova === telaAtual) return;

    historicoTelas.push(telaAtual.id);

    // nova começa fora da tela (direita)
    nova.style.transition = "none";
    nova.style.transform = "translateX(100%)";
    nova.classList.add("base");

    nova.offsetWidth;

    // anima nova entrando
    nova.style.transition = "transform .35s ease";
    nova.style.transform = "translateX(0)";

    // anima atual só um pouco para esquerda
    telaAtual.style.transition = "transform .35s ease";
    telaAtual.style.transform = "translateX(-30%)";

    setTimeout(()=>{
        telaAtual.style.transition = "";
        telaAtual.style.transform = "";
        telaAtual.classList.remove("base");

        telaAtual = nova;
    }, 350);
}



function voltarPara(idTela) {
    const telaDestino = document.getElementById(idTela);
    if (!telaDestino) return;

    // tela atual sai para a direita
    telaAtual.style.transition = "transform .35s ease";
    telaAtual.style.transform = "translateX(100%)";

    // tela destino começa recuada (-30%) e visível
    telaDestino.style.transition = "none";
    telaDestino.style.transform = "translateX(-30%)";
    telaDestino.classList.add("base");

    telaDestino.offsetWidth; // força reflow

    // anima a tela destino para o centro
    telaDestino.style.transition = "transform .35s ease";
    telaDestino.style.transform = "translateX(0)";

    setTimeout(() => {
        // limpa tela atual
        telaAtual.classList.remove("base");
        telaAtual.style.transition = "";
        telaAtual.style.transform = "";

        // atualiza referência
        telaAtual = telaDestino;
    }, 350);
}


function irSemAnimacao(id){
    const nova = document.getElementById(id);
    if(!nova || nova === telaAtual) return;

    // remove a tela atual
    telaAtual.classList.remove("base");

    // limpa qualquer resíduo de animação
    telaAtual.style.transition = "";
    telaAtual.style.transform = "";
    nova.style.transition = "";
    nova.style.transform = "";

    // mostra a nova tela instantaneamente
    nova.classList.add("base");

    telaAtual = nova;
}
function irDeBaixo(id){
    const nova = document.getElementById(id);
    if(!nova || nova === telaAtual) return;

    // estado inicial
    nova.style.transition = "none";
    nova.style.transform = "translateY(100%)";
    nova.classList.add("base");

    nova.offsetWidth;

    // anima subida
    nova.style.transition = "transform .5s ease";
    nova.style.transform = "translateY(0)";

    setTimeout(()=>{
        nova.style.transition = "";
        telaAtual = nova;
    }, 350);
}

function fecharParaBaixo(idAnterior){
    const atual = telaAtual;
    const anterior = document.getElementById(idAnterior);
    if(!anterior) return;

    // garante que a tela de trás esteja visível
    anterior.classList.add("base");

    atual.style.transition = "transform .5s ease";
    atual.style.transform = "translateY(100%)";

    setTimeout(()=>{
        atual.classList.remove("base");
        atual.style.transition = "";
        atual.style.transform = "";

        telaAtual = anterior;
    }, 350);
}

async function entrar() {
  const email = document.getElementById("emailExibido").innerText.trim();
  const senha = document.getElementById("senha").value.trim();

  if (!email || !senha) {
    notificar("Digite a senha");
    return;
  }

  setBtnLoading("btnEntrar", true);

  try {
    await auth.signInWithEmailAndPassword(email, senha);

// salva usuário
localStorage.setItem("usuarioLogado", email);

// 🔥 MUITO IMPORTANTE:
localStorage.removeItem("usuarioSaiu"); 
// ou coloque "false"

irPara("telaHome");



  } catch (err) {

  let mensagem = "";

  switch(err.code){

    case "auth/wrong-password":
      mensagem = "Senha incorreta";
      break;

    case "auth/user-not-found":
      mensagem = "Email não cadastrado";
      break;

    case "auth/invalid-email":
      mensagem = "Email inválido";
      break;

    case "auth/too-many-requests":
      mensagem = "Muitas tentativas. Aguarde alguns minutos.";
      break;

    case "auth/network-request-failed":
      mensagem = "Sem conexão com a internet.";
      break;

    case "auth/user-disabled":
      mensagem = "Sua conta foi bloqueada por descumprir regras. entre em contato com o suporte para mais informações.","a";
      break;

  default:
      mensagem = " Senha incorreta.";
  }

  notificar(mensagem);
  console.error(err);

} finally {
  setBtnLoading("btnEntrar", false);
}
}
let emailCadastro = "";
let usernameCadastro = "";

function mostrarTela(id){
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');
}

let verificandoEmail = false;

async function irParaUsuario(btn){

  const emailInput = document.getElementById('emailLogin');
  const email = emailInput.value.trim();

  if(!email){
    notificar("Digite um email válido");
    return;
  }

  btn.classList.add("loading");
  verificandoEmail = true;

  try {

    await auth.createUserWithEmailAndPassword(email, "teste123");

    // remove usuário de teste
    const user = auth.currentUser;
    await user.delete();
    await auth.signOut();

    emailCadastro = email;
    irPara('telaCPF');

  } catch(err) {

    if(err.code === "auth/email-already-in-use"){

      emailCadastro = email;
      document.getElementById("emailExibido").innerText = email;
      irPara("telaSenha");

    } 
    else if(err.code === "auth/invalid-email"){
      notificar("Email inválido");
    } 
    else {
      notificar("Erro ao verificar email");
    }

  } finally {

    verificandoEmail = false;
    btn.classList.remove("loading");

  }
}



async function irParaSenha(btn){
  const username = document.getElementById('usernameCadastro').value.trim();
  if(!username){
    notificar("Digite o nome de usuário");
    return;
  }

  // 🔥 ativa loader
  setBtnLoading(btn, true);

  try{
    const snap = await db.collection("users")
      .where("username", "==", username)
      .get();

    if(!snap.empty){
      notificar("Nome de usuário já existe");
      setBtnLoading(btn, false); // ❌ erro → remove loader
      return;
    }

    usernameCadastro = username;

    setBtnLoading(btn, false); // ✅ DESLIGA
    irPara('telaCadastroSenha');

  }catch(err){
    notificar("Erro ao verificar usuário");
    setBtnLoading(btn, false); // ❌ erro → remove loader
  }
}
async function cpfJaCadastrado(cpf){
  const snap = await db
    .collection("users")
    .where("cpf", "==", cpf)
    .limit(1)
    .get();

  return !snap.empty;
}
async function finalizarCadastro(btn){
  const senha1 = document.getElementById('senha1').value;
  const senha2 = document.getElementById('senha2').value;

  if(!senha1 || !senha2){
    notificar("Digite a senha duas vezes");
    return;
  }

  if(senha1 !== senha2){
    notificar("As senhas não são iguais");
    return;
  }

  // 🔥 ATIVA LOADER NO BOTÃO
  setBtnLoading(btn, true);

  try {
  const cred = await auth.createUserWithEmailAndPassword(
    emailCadastro,
    senha1
  );

  await db.collection("users").doc(cred.user.uid).set({
    email: emailCadastro,
    username: usernameCadastro,
    cpf: localStorage.getItem("cpfUsuario"),
    dataNascimento: localStorage.getItem("dataNascimento"),
    saldo: 0,
    pelucias: 0,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });

  notificar("Conta criada com sucesso!");

    // ✅ DESLIGA O LOADER ANTES DA TROCA
    setBtnLoading(btn, false);

    // 🔥 ANIMAÇÃO NORMAL
    irPara('telaHome');

  }catch(err){
    notificar(err.message);

    // ❌ ERRO → REMOVE LOADER
    setBtnLoading(btn, false);
  }
}


function notificar(msg, tipo = "v") {

  const container = document.getElementById("notificacoes");
  if (!container) return;

  const div = document.createElement("div");

  if(tipo === "a"){
    div.className = "notificacao a"; // 👈 ESSA É A CHAVE
  }else{
    div.className = "notificacao";
  }

  div.innerText = msg;

  container.appendChild(div);

  requestAnimationFrame(() => {
    div.classList.add("ativa");
  });

  setTimeout(() => {
    div.classList.remove("ativa");
    setTimeout(() => div.remove(), 400);
  }, 3000);
}






/* ================= VARIÁVEIS ================= */
let valorRecarga = 0;

/* ================= SELECIONAR VALOR ================= */
function selecionarValor(valor){
  valorRecarga = valor;

  const el = document.getElementById("valorSelecionado");
  if(el){
    el.innerText = "R$ " + valor.toFixed(2).replace(".", ",");
  }
}

/* ================= PAGAMENTO (SIMULADO) ================= */
function pagar(){
  if(valorRecarga <= 0){
    notificar("Selecione um valor para recarga");
    return;
  }

  notificar("Pagamento em desenvolvimento 💳");
}

/* ================= ATUALIZAÇÃO EM TEMPO REAL ================= */
let unsubscribeUser = null;
let userData = null; // 🔥 guarda os dados em memória
let conectadoAoServidor = false;



firebase.auth().onAuthStateChanged((user) => {

  // mata listener antigo
  if(unsubscribeUser){
    unsubscribeUser();
    unsubscribeUser = null;
  }

  if(!user) return;

  unsubscribeUser = db.collection("users")
.doc(user.uid)
.onSnapshot({

    includeMetadataChanges: true

}, (doc) => {

    // 🔥 só aceita dado do servidor
    if(doc.metadata.fromCache){
        mostrarSemInternet();
        return;
    }

    userData = doc.data();

    atualizarInterface();

});
});
function mostrarSemInternet(){

  const saldoSel  = document.getElementById("saldoUsuario");
  const saldoCart = document.getElementById("saldoCarteira");

  if(saldoSel){
    saldoSel.textContent = "undefined";
  }

  if(saldoCart){
    saldoCart.textContent = "undefined";
  }

}


function formatarSaldo(valor){
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}



function atualizarInterface(){

  if(!navigator.onLine){
    mostrarSemInternet();
    return;
  }

  if(!userData) return;

  if(!userData) return;

  const saldo = userData.saldo || 0;
  const pelucias = userData.pelucias || 0;

  const nomeUser = document.getElementById("nomeUser");
  const letraPerfil = document.getElementById("letraPerfil");

  if(nomeUser){
    nomeUser.innerText = "Olá, " + (userData.username || "Usuário");
  }

  if(letraPerfil && userData.username){
    letraPerfil.innerText = userData.username.charAt(0).toUpperCase();
  }

  /* ===== TELA SELECIONAR ===== */
  const saldoSel = document.getElementById("saldoUsuario");

  if(saldoSel){
    saldoSel.innerText =
      "Saldo: " + formatarSaldo(saldo);
  }

  /* ===== TELA CARTEIRA ===== */
  const saldoCart = document.getElementById("saldoCarteira");
  const pelCart   = document.getElementById("peluciasCarteira");

  if(saldoCart){
    saldoCart.innerText =
      formatarSaldo(saldo);
  }

  if(pelCart){
    pelCart.innerText =
      pelucias + " pelúcias acumuladas";
  }

}


function abrirCarteira(){

  // 1️⃣ abre a tela (sua animação)
  irSemAnimacao("telaCarteira");

  // 2️⃣ força zero imediatamente
  const saldoCart = document.getElementById("saldoCarteira");
  const pelCart   = document.getElementById("peluciasCarteira");

  if(saldoCart){
    saldoCart.textContent = "R$ 0,00";
  }

  if(pelCart){
    pelCart.textContent = "0 pelúcias acumuladas";
  }

  // 3️⃣ após a animação / pequeno delay, mostra saldo real
  setTimeout(() => {

    if(typeof atualizarInterface === "function"){
      atualizarInterface();
    }

  }, 250); // ajuste se sua animação for mais longa

}



auth.onAuthStateChanged(async (user) => {

  // 🔥 ignora enquanto estiver só verificando email
  if (verificandoEmail) return;

  if (!user) return;

  const textoOla = document.getElementById("textoOla");
  const avatar   = document.getElementById("avatarLetra");

  if (!textoOla || !avatar) return;

  try {
    const snap = await db.collection("users").doc(user.uid).get();

    let username = "Usuário";

    if (snap.exists && snap.data().username) {
      username = snap.data().username;
    }

    textoOla.innerText = "Olá, " + username;
    avatar.innerText  = username.charAt(0).toUpperCase();

  } catch (e) {
    console.error("Erro ao carregar nome:", e);
  }
});

// ================= LOGOUT =================
function sairConta() {

  auth.signOut().then(() => {

    // bloqueia login automático
    localStorage.setItem("usuarioSaiu", "true");

    // 🔥 remove dados do login
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("loginEmail");
    localStorage.removeItem("loginSenha");

    voltarPara("tela1");
  });

}




auth.onAuthStateChanged(async user => {
    if (!user) return;

    const emailEl = document.getElementById("campoEmail");
    const nomeEl  = document.getElementById("campoNome");

    if (!emailEl || !nomeEl) return;

    emailEl.innerText = user.email;

    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();

    let username = "—";

    if (snap.exists) {
        const dados = snap.data();
        if (dados.username) {
            username = dados.username;
        }
    }

    nomeEl.innerText = username;
});




function fecharPopup(){
    document.getElementById("popupNome").style.display = "none";
}

async function salvarNovoNome(){
    const novo = document.getElementById("novoNome").value.trim();

    if (novo.length < 3) {
        notificar("O nome deve ter pelo menos 3 letras.");
        return;
    }

    const user = auth.currentUser;
    if (!user) return;



    document.getElementById("campoNome").innerText = novo;
    window.jaMudouNome = true;
    fecharPopup();
    notificar("Apelido alterado com sucesso!");
}


function alterarSenha(){
    const email = auth.currentUser.email;
    auth.sendPasswordResetEmail(email)
        .then(() => notificar("Link de redefinição enviado para " + email))
        .catch(e => notificar(e.message));
}


function excluirConta(){
    document.getElementById("popupExcluir").style.display = "flex";
}

function fecharPopupExcluir(){
    document.getElementById("popupExcluir").style.display = "none";
}

async function confirmarExclusao(){
    const senha = document.getElementById("senhaExcluir").value.trim();
    if (!senha) {
        notificar("Digite sua senha.");
        return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
        const cred = firebase.auth.EmailAuthProvider.credential(user.email, senha);
        await user.reauthenticateWithCredential(cred);

        await db.collection("users").doc(user.uid).delete();
        await user.delete();

        notificar("Conta excluída com sucesso.");
        voltarPara("telacadastroLogin");

    } catch (e) {
        notificar("Erro: " + e.message);
    }
}


let podeAlterarUsername = false;

auth.onAuthStateChanged(async user => {
    if (!user) return;

    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();

    if (!snap.exists) return;

    const dados = snap.data();

    // Mostra username
    document.getElementById("campoNome").innerText =
        dados.username || "—";

    // controla se pode alterar
    if (dados.usernameAlterado === true) {
        podeAlterarUsername = false;
    } else {
        podeAlterarUsername = true;
    }
});

function alterarNome(){
    if (!podeAlterarUsername) {
        notificar("Você só pode alterar o apelido uma vez.");
        return;
    }
    document.getElementById("popupNome").style.display = "flex";
}

function fecharPopup(){
    document.getElementById("popupNome").style.display = "none";
}

async function salvarNovoNome(){
    const novo = document.getElementById("novoNome").value.trim();

    if (novo.length < 3) {
        notificar("O apelido deve ter pelo menos 3 letras.");
        return;
    }

    const user = auth.currentUser;
    if (!user) return;

    // 🔎 verifica duplicado
    const consulta = await db
        .collection("users")
        .where("username", "==", novo)
        .get();

    if (!consulta.empty) {
        notificar("Esse apelido já está em uso.");
        return;
    }

    // ✅ salva definitivamente
    await db.collection("users").doc(user.uid).update({
        username: novo,
        usernameAlterado: true
    });

    document.getElementById("campoNome").innerText = novo;
    podeAlterarUsername = false;

    fecharPopup();
    notificar("Apelido alterado com sucesso!");
}

function setBtnLoading(btn, loading){

  // aceita ID OU o próprio botão
  if(typeof btn === "string"){
    btn = document.getElementById(btn);
  }

  if(!btn) return;

  if(loading){

    // evita duplo clique
    if(btn.classList.contains("loading")) return;

    btn.classList.add("loading");
    btn.disabled = true;

  }else{

    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

function redefinirSenha(){
  const email = document.getElementById("emailExibido").innerText.trim();

  if(!email){
    notificar("Email não encontrado");
    return;
  }

  auth.sendPasswordResetEmail(email)
    .then(() => {
      notificar(`Enviamos um email de redefinição para:\n${email}`);
    })
    .catch(err => {
      if(err.code === "auth/invalid-email"){
        notificar("Email inválido");
      }else if(err.code === "auth/user-not-found"){
        notificar("Usuário não encontrado");
      }else{
        notificar("Erro ao enviar email de redefinição");
        console.error(err);
      }
    });
}
function continuarCPF(){
  let cpf = document.getElementById("cpf").value;

  if(cpf.trim() === ""){
    notificar("Digite seu CPF", "erro");
    return;
  }

  cpf = cpf.replace(/\D/g, "");

  if(!validarCPF(cpf)){
    notificar("CPF inválido", "erro");
    return;
  }

  // USA O MESMO LOADER DAS OUTRAS TELAS
  const loader = document.getElementById("loader");
  if(loader) loader.style.display = "flex";

  setTimeout(() => {
    localStorage.setItem("cpfUsuario", cpf);

    if(loader) loader.style.display = "none";

    irPara("telaNascimento");
  }, 1200);
}

async function continuarCPF(btn){
  let cpf = document.getElementById("cpf").value;

  if(cpf.trim() === ""){
    notificar("Digite seu CPF", "erro");
    return;
  }

  cpf = cpf.replace(/\D/g, "");

  if(!validarCPF(cpf)){
    notificar("CPF inválido", "erro");
    return;
  }

  // 🔥 LOADING NO BOTÃO
  setBtnLoading(btn, true);

  try{
    // 🔍 VERIFICA NO FIRESTORE
    const existe = await cpfJaCadastrado(cpf);

    if(existe){
      setBtnLoading(btn, false);
      notificar("Este CPF já está cadastrado em outra conta", "erro");
      return;
    }

    // 💾 SALVA TEMPORARIAMENTE
    localStorage.setItem("cpfUsuario", cpf);

    setBtnLoading(btn, false);

    // ➡️ PRÓXIMA TELA
    irPara("telaNascimento");

  }catch(e){
    setBtnLoading(btn, false);
    notificar("Erro ao verificar CPF. Tente novamente.", "erro");
  }
}


function continuarNascimento(btn){
  const data = document.getElementById("dataNascimento").value;

  if(!data){
    notificar("Informe sua data de nascimento", "erro");
    return;
  }

  setBtnLoading(btn, true);

  setTimeout(() => {
    if(!maiorDe18(data)){
      setBtnLoading(btn, false);
      notificar("Você precisa ter 18 anos ou mais", "erro");
      return;
    }

    localStorage.setItem("dataNascimento", data);

    setBtnLoading(btn, false);
    notificar("Idade confirmada", "sucesso");
    irPara("telaCadastroUsuario");
  }, 1200);
}



function maiorDe18(data){
  const hoje = new Date();
  const nasc = new Date(data);

  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();

  if(m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())){
    idade--;
  }

  return idade >= 18;
}
function validarCPF(cpf) {
  cpf = cpf.replace(/[^\d]+/g,'');

  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++)
    soma += parseInt(cpf.substring(i-1, i)) * (11 - i);

  resto = (soma * 10) % 11;
  if ((resto == 10) || (resto == 11)) resto = 0;
  if (resto != parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++)
    soma += parseInt(cpf.substring(i-1, i)) * (12 - i);

  resto = (soma * 10) % 11;
  if ((resto == 10) || (resto == 11)) resto = 0;
  if (resto != parseInt(cpf.substring(10, 11))) return false;

return true;
}
function verificarLoginAutomatico(){

    const usuario = localStorage.getItem("usuarioLogado");

    if(usuario){
        voltarPara("telaHome");
    }else{
        voltarPara("tela1");
    }

}






let mensagensNaoLidas = 0;
let chatAberto = false;

const badgeChat = document.getElementById("badgeChat");

// pega ultimo timestamp salvo
let ultimoLido = localStorage.getItem("ultimoLido") || 0;


// ESCUTAR CHAT
db.collection("chat")
.orderBy("timestamp")
.onSnapshot(snapshot => {

    mensagensNaoLidas = 0;

    snapshot.forEach(doc => {

        const msg = doc.data();

        if(msg.timestamp > ultimoLido){
            mensagensNaoLidas++;
        }

    });

    atualizarBadge();

});
function atualizarBadge(){

    if(mensagensNaoLidas > 0){

        badgeChat.style.display = "flex";
        badgeChat.innerText = mensagensNaoLidas > 99 
            ? "99+" 
            : mensagensNaoLidas;

    }else{
        badgeChat.style.display = "none";
    }

}
function abrirChat(){

    chatAberto = true;

    // pega o timestamp MAIS RECENTE
    db.collection("chat")
    .orderBy("timestamp", "desc")
    .limit(1)
    .get()
    .then(snapshot => {

        if(!snapshot.empty){

            ultimoLido = snapshot.docs[0].data().timestamp;

            localStorage.setItem("ultimoLido", ultimoLido);
        }

        mensagensNaoLidas = 0;
        atualizarBadge();

    });

    irDeBaixo('telaChat');
}

async function verificarVersaoSite(){

  try{

    const doc = await db
      .collection("config")
      .doc("app")
      .get();

    if(!doc.exists) return;

    const versaoBanco = doc.data().versao;
    const versaoAtual = "1.0.0"; // 🔥 sua versão do site

    if(versaoBanco !== versaoAtual){

      mostrarPopupAtualizacao();

    }

  }catch(e){
    console.error("Erro ao verificar versão:", e);
  }

}

function atualizarSite(){

    // limpa cache do navegador
    if('caches' in window){
        caches.keys().then(names=>{
            names.forEach(name => caches.delete(name));
        });
    }

    // força reload REAL
    window.location.reload(true);
}

function mostrarPopupAtualizacao(){

   document.getElementById("popupAtualizacao")
           .style.display = "flex";

}
function mostrarPopupAtualizacao(){

  const popup = document.getElementById("popupUpdate");

  // 🔥 proteção anti-erro
  if(!popup){
    console.warn("PopupUpdate não encontrado no HTML");
    return;
  }

  popup.style.display = "flex";
}
