/*
 * Proteção do CPF em repouso. AES-256-GCM fornece confidencialidade e autenticação
 * do conteúdo; IV aleatório por operação evita reutilizar o mesmo nonce.
 * A chave fixa no código é apenas adequada a demonstração: em produção deve vir
 * de um gestor de segredos/variável de ambiente e ter processo de rotação.
 */
// Criptografia reversível do CPF (AES-256-GCM).
// O CPF é gravado no banco já criptografado; só a aplicação consegue ler.
const crypto = require('crypto');

const CHAVE = crypto.scryptSync('oficina-autocerta-chave-secreta', 'sal-da-oficina', 32);

function criptografar(texto) {
    const iv = crypto.randomBytes(12);
    const cifra = crypto.createCipheriv('aes-256-gcm', CHAVE, iv);
    const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
    const tag = cifra.getAuthTag();
    return [iv, tag, dados].map(b => b.toString('base64')).join(':');
}

function descriptografar(valor) {
    const [iv, tag, dados] = valor.split(':').map(p => Buffer.from(p, 'base64'));
    const decifra = crypto.createDecipheriv('aes-256-gcm', CHAVE, iv);
    decifra.setAuthTag(tag);
    return Buffer.concat([decifra.update(dados), decifra.final()]).toString('utf8');
}

module.exports = { criptografar, descriptografar };
