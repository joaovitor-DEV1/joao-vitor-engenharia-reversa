# Engenharia reversa — Oficina AutoCerta

Documentação técnica do sistema web recebido, com código comentado, DER, mapa de API/front-end, análise de segurança e verificações reproduzíveis.

## Executar o sistema

Requisitos declarados pelo projeto: Node.js **22.13 ou superior**.

```bash
cd sistema_comentado
npm install
npm start
```

Acesse http://localhost:3000. Credenciais de demonstração estão no arquivo `sistema_comentado/LEIA-ME.txt`.

> O ambiente usado para preparar este material não conseguiu baixar dependências do npm por falha DNS (`EAI_AGAIN registry.npmjs.org`). Portanto, não afirmamos que o servidor HTTP foi executado aqui. As verificações efetivamente executadas estão em `docs/evidencias/resultado-testes.txt` e abrangem SQLite, integridade, estrutura do código e criptografia. Os testes HTTP de ponta a ponta devem ser repetidos após `npm install` em ambiente com acesso ao registry.

## Conteúdo

- `docs/documentacao.pdf`: relatório de entrega.
- `docs/documentacao.md`: relatório-fonte editável.
- `docs/der.png` e `docs/DER.dot`: diagrama entidade-relacionamento e fonte.
- `docs/fluxo-agendamento.png` e `docs/fluxo-agendamento.dot`: fluxo da funcionalidade.
- `docs/evidencias/`: script de verificações, resultado real e limitação do ambiente.
- `sistema_comentado/`: cópia do sistema com comentários explicando decisões e riscos.

## Verificações locais

Com Python 3 e Node.js 22+:

```bash
python docs/evidencias/verificacao.py
```

São 24 verificações de estrutura, dados iniciais, restrições relacionais, contratos do código e ida-e-volta AES-GCM. Não substituem testes HTTP/E2E.

## Preparação do GitHub

Crie o repositório `nome-sobrenome-engenharia-reversa`, substituindo pelo seu nome e sobrenome, e envie esta pasta. O histórico de **8 commits em 3 dias diferentes** precisa ser criado por você no GitHub/local ao longo de dias distintos; não é possível fabricar honestamente essa cronologia retrospectivamente. Sugestão de divisão: (1) estrutura inicial, (2) levantamento de arquitetura, (3) DER, (4) mapa API, (5) mapa front-end, (6) segurança, (7) testes/evidências, (8) revisão do PDF e README. Depois cole o link no Classroom e clique em Entregar.
