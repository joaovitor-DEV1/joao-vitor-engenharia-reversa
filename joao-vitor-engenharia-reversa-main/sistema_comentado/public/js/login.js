/*
 * Fluxo de autenticação da tela: envia login/senha à API e só navega ao painel
 * depois de uma resposta de sucesso. Erros são mostrados como texto, não HTML.
 */
const erro = document.getElementById('erro');

function mostrarErro(msg) {
    erro.textContent = msg;
    erro.style.display = 'block';
}

// veio redirecionado porque a sessão expirou
if (new URLSearchParams(location.search).get('expirou')) {
    mostrarErro('Sua sessão expirou. Faça login novamente.');
}

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.style.display = 'none';
    try {
        await api('/api/login', {
            method: 'POST',
            body: {
                login: document.getElementById('login').value,
                senha: document.getElementById('senha').value
            }
        });
        window.location.href = '/principal.html';
    } catch (err) {
        mostrarErro(err.message);   // falha de autenticação: informa e fica no login
    }
});
