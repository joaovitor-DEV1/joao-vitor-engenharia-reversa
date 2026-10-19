/*
 * Servidor HTTP e camada de aplicação da AutoCerta.
 * O arquivo concentra rotas, validações e regras de negócio; manter as consultas
 * parametrizadas reduz o risco de SQL injection. As rotas de dados usam exigirLogin
 * para exigir uma sessão autenticada, mas atualmente não há autorização por perfil.
 */
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db/conexao');
const { criptografar, descriptografar } = require('./seguranca');

const app = express();
const MINUTOS_SESSAO = 30; // Limita a duração do cookie de sessão a 30 minutos.

app.use(express.json());
app.use(session({
    secret: 'oficina-autocerta-sessao', // Segredo fixo é um risco; em produção use segredo forte fora do código.
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: MINUTOS_SESSAO * 60 * 1000, httpOnly: true } // httpOnly reduz acesso ao cookie via JavaScript.
}));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/login.html'));

function exigirLogin(req, res, next) {
    if (!req.session.usuario) {
        return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
    next();
}

// ===================== LOGIN =====================
app.post('/api/login', (req, res) => {
    const { login, senha } = req.body;
    if (!login || !senha) {
        return res.status(400).json({ erro: 'Informe usuário e senha.' });
    }
    // O placeholder ? mantém o valor do login separado do SQL e mitiga SQL injection.
    const usuario = db.prepare('SELECT * FROM usuarios WHERE login = ?').get(login.trim());
    if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
        return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
    }
    // Armazena apenas os atributos necessários na sessão, não a senha nem seu hash.
    req.session.usuario = { id: usuario.id, nome: usuario.nome };
    res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', exigirLogin, (req, res) => res.json(req.session.usuario));

// ===================== CLIENTES =====================
const clienteJson = c => ({ ...c, cpf: descriptografar(c.cpf) });

function validarCliente(corpo, idAtual) {
    const nome = (corpo.nome || '').trim();
    const cpf = String(corpo.cpf || '').replace(/\D/g, '');
    if (!nome) return 'Informe o nome do cliente.';
    if (cpf.length !== 11) return 'O CPF deve ter 11 dígitos.';
    if (corpo.email && !/^\S+@\S+\.\S+$/.test(corpo.email)) return 'E-mail inválido.';
    // Como o CPF usa criptografia aleatória, não é possível comparar ciphertexts;
    // a implementação descriptografa os registros para verificar duplicidade.
    const repetido = db.prepare('SELECT * FROM clientes').all()
        .some(c => c.id !== idAtual && descriptografar(c.cpf) === cpf);
    if (repetido) return 'Já existe um cliente com este CPF.';
    return null;
}

app.get('/api/clientes', exigirLogin, (req, res) => {
    const termo = (req.query.busca || '').trim().toLowerCase();
    const digitos = termo.replace(/\D/g, '');
    const lista = db.prepare('SELECT * FROM clientes ORDER BY nome').all().map(clienteJson);
    // o CPF está criptografado no banco, então a busca é feita depois de descriptografar
    res.json(lista.filter(c => !termo
        || c.nome.toLowerCase().includes(termo)
        || (c.email || '').toLowerCase().includes(termo)
        || (c.telefone || '').includes(termo)
        || (digitos && c.cpf.includes(digitos))));
});

app.post('/api/clientes', exigirLogin, (req, res) => {
    const erro = validarCliente(req.body, null);
    if (erro) return res.status(400).json({ erro });
    const { nome, cpf, telefone, email } = req.body;
    db.prepare('INSERT INTO clientes (nome, cpf, telefone, email) VALUES (?,?,?,?)')
        .run(nome.trim(), criptografar(String(cpf).replace(/\D/g, '')), telefone || '', email || '');
    res.status(201).json({ ok: true });
});

app.put('/api/clientes/:id', exigirLogin, (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM clientes WHERE id = ?').get(id)) {
        return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    const erro = validarCliente(req.body, id);
    if (erro) return res.status(400).json({ erro });
    const { nome, cpf, telefone, email } = req.body;
    db.prepare('UPDATE clientes SET nome=?, cpf=?, telefone=?, email=? WHERE id=?')
        .run(nome.trim(), criptografar(String(cpf).replace(/\D/g, '')), telefone || '', email || '', id);
    res.json({ ok: true });
});

// ===================== VEÍCULOS =====================
// aceita placa antiga (ABC1234) e Mercosul (ABC1D23)
// Aceita padrão antigo ABC1234 e Mercosul ABC1D23 após normalização.
const PLACA_VALIDA = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

app.get('/api/veiculos', exigirLogin, (req, res) => {
    res.json(db.prepare(`
        SELECT v.*, c.nome AS cliente_nome
        FROM veiculos v JOIN clientes c ON c.id = v.cliente_id
        ORDER BY v.modelo`).all());
});

app.post('/api/veiculos', exigirLogin, (req, res) => {
    const { modelo, tipo, marca, cliente_id } = req.body;
    const placa = String(req.body.placa || '').replace(/[\s-]/g, '').toUpperCase();
    if (!PLACA_VALIDA.test(placa)) return res.status(400).json({ erro: 'Informe uma placa válida.' });
    if (!modelo || !modelo.trim()) return res.status(400).json({ erro: 'Informe o modelo do veículo.' });
    if (!tipo || !tipo.trim()) return res.status(400).json({ erro: 'Informe o tipo do veículo.' });
    if (!cliente_id) return res.status(400).json({ erro: 'Selecione o cliente do veículo.' });
    if (!db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id)) {
        return res.status(400).json({ erro: 'Cliente não encontrado.' });
    }
    if (db.prepare('SELECT id FROM veiculos WHERE placa = ?').get(placa)) {
        return res.status(400).json({ erro: 'Já existe um veículo com esta placa.' });
    }
    db.prepare('INSERT INTO veiculos (placa, modelo, tipo, marca, cliente_id) VALUES (?,?,?,?,?)')
        .run(placa, modelo.trim(), tipo.trim(), (marca || '').trim(), cliente_id);
    res.status(201).json({ ok: true });
});

// ===================== AGENDAMENTOS =====================
// Além do formato ISO, reconstrói a data para rejeitar datas impossíveis como 2026-02-31.
function dataValida(texto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto || '')) return false;
    const d = new Date(texto + 'T00:00:00');
    return !isNaN(d) && d.toISOString().slice(0, 10) === texto;
}

app.get('/api/agendamentos', exigirLogin, (req, res) => {
    const lista = db.prepare(`
        SELECT a.id, a.data_agendamento, a.servico,
               v.placa, v.modelo AS veiculo_modelo, v.tipo, v.marca,
               c.nome AS cliente_nome, c.cpf AS cliente_cpf, c.telefone, c.email
        FROM agendamentos a
        JOIN veiculos v ON v.id = a.veiculo_id
        JOIN clientes c ON c.id = v.cliente_id
        ORDER BY strftime('%Y-%m', a.data_agendamento), a.data_agendamento`).all();
    res.json(lista.map(a => ({ ...a, cliente_cpf: descriptografar(a.cliente_cpf) })));
});

app.post('/api/agendamentos', exigirLogin, (req, res) => {
    const { veiculo_id, data_agendamento, servico } = req.body;
    if (!veiculo_id || !db.prepare('SELECT id FROM veiculos WHERE id = ?').get(veiculo_id)) {
        return res.status(400).json({ erro: 'Selecione um veículo.' });
    }
    if (!dataValida(data_agendamento)) return res.status(400).json({ erro: 'Informe uma data válida.' });
    if (!servico || !servico.trim()) return res.status(400).json({ erro: 'Informe o serviço.' });
    db.prepare('INSERT INTO agendamentos (veiculo_id, data_agendamento, servico) VALUES (?,?,?)')
        .run(veiculo_id, data_agendamento, servico.trim());
    res.status(201).json({ ok: true });
});

app.put('/api/agendamentos/:id', exigirLogin, (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM agendamentos WHERE id = ?').get(id)) {
        return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    }
    if (!dataValida(req.body.data_agendamento)) {
        return res.status(400).json({ erro: 'Informe uma data válida.' });
    }
    db.prepare('UPDATE agendamentos SET data_agendamento = ? WHERE id = ?')
        .run(req.body.data_agendamento, id);
    res.json({ ok: true });
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));
