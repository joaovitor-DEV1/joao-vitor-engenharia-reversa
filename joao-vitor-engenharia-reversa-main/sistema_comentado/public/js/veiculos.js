/*
 * Tela de veículos: consulta a lista e carrega clientes no seletor antes de criar
 * um veículo, pois a relação cliente_id é obrigatória no banco e na regra de negócio.
 */
const tbody = document.getElementById('tbody');

iniciarPagina();
carregar();

async function carregar() {
    const veiculos = await api('/api/veiculos');
    tbody.innerHTML = veiculos.map(v => `
        <tr>
            <td>${esc(v.placa)}</td>
            <td>${esc(v.modelo)}</td>
            <td>${esc(v.tipo)}</td>
            <td>${esc(v.marca)}</td>
            <td>${esc(v.cliente_nome)}</td>
        </tr>`).join('') || '<tr><td colspan="5" class="vazio">Nenhum veículo cadastrado.</td></tr>';
}

document.getElementById('btn-novo').addEventListener('click', async () => {
    // o veículo precisa ser associado a um cliente: carrega a lista de clientes no select
    const clientes = await api('/api/clientes');
    document.getElementById('cliente').innerHTML =
        '<option value="">Selecione...</option>' +
        clientes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
    document.getElementById('form').reset();
    abrirModal('modal');
});
document.getElementById('btn-cancelar').addEventListener('click', () => fecharModal('modal'));

document.getElementById('form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
        await api('/api/veiculos', {
            method: 'POST',
            body: {
                placa: document.getElementById('placa').value,
                modelo: document.getElementById('modelo').value,
                tipo: document.getElementById('tipo').value,
                marca: document.getElementById('marca').value,
                cliente_id: Number(document.getElementById('cliente').value)
            }
        });
        fecharModal('modal');
        avisar('Veículo cadastrado.');
        carregar();
    } catch (err) {
        avisar(err.message, 'erro');
    }
});
