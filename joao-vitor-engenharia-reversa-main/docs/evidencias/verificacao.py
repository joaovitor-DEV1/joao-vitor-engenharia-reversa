"""Verificações executáveis de estrutura, dados, integridade e criptografia.
Não são testes HTTP end-to-end: as dependências Express não puderam ser instaladas
neste ambiente (DNS da registry.npmjs.org indisponível). Execute com Python 3 e Node 22+.
"""
import pathlib, sqlite3, subprocess, unittest, re, shutil, tempfile
ROOT = pathlib.Path(__file__).resolve().parents[2]
SYS = ROOT / 'sistema_comentado'
SQL = (SYS/'db/oficina_db.sql').read_text(encoding='utf-8')
SERVER = (SYS/'server.js').read_text(encoding='utf-8')
SEC = (SYS/'seguranca.js').read_text(encoding='utf-8')
JS = (SYS/'public/js/comum.js').read_text(encoding='utf-8')
DBFILE = SYS/'db/oficina_db.sqlite' # referência histórica; os testes constroem um banco temporário a partir do SQL
class TestesReversos(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory(); cls.dbpath=pathlib.Path(cls.tmp.name)/'test.sqlite'
  cls.db=sqlite3.connect(cls.dbpath); cls.db.execute('PRAGMA foreign_keys=ON'); cls.db.executescript(SQL)
 @classmethod
 def tearDownClass(cls): cls.db.close(); cls.tmp.cleanup()
 def test01_tabelas_principais_existentes(self):
  nomes={x[0] for x in self.db.execute("select name from sqlite_master where type='table'")}; self.assertTrue({'usuarios','clientes','veiculos','agendamentos'} <= nomes)
 def test02_usuarios_semeados(self): self.assertEqual(3,self.db.execute('select count(*) from usuarios').fetchone()[0])
 def test03_clientes_semeados(self): self.assertEqual(3,self.db.execute('select count(*) from clientes').fetchone()[0])
 def test04_veiculos_semeados(self): self.assertEqual(4,self.db.execute('select count(*) from veiculos').fetchone()[0])
 def test05_agendamentos_semeados(self): self.assertEqual(4,self.db.execute('select count(*) from agendamentos').fetchone()[0])
 def test06_login_unico(self):
  with self.assertRaises(sqlite3.IntegrityError): self.db.execute("insert into usuarios(nome,login,senha) values('X','admin','hash')")
 def test07_placa_unica(self):
  with self.assertRaises(sqlite3.IntegrityError): self.db.execute("insert into veiculos(placa,modelo,tipo,cliente_id) values('ABC1D23','Duplicado','Carro',1)")
 def test08_fk_veiculo_cliente(self):
  with self.assertRaises(sqlite3.IntegrityError): self.db.execute("insert into veiculos(placa,modelo,tipo,cliente_id) values('ZZZ9Z99','X','Carro',9999)")
 def test09_fk_agendamento_veiculo(self):
  with self.assertRaises(sqlite3.IntegrityError): self.db.execute("insert into agendamentos(veiculo_id,data_agendamento,servico) values(9999,'2026-10-20','Teste')")
 def test10_agendamentos_tem_data_iso(self):
  for (d,) in self.db.execute('select data_agendamento from agendamentos'): self.assertRegex(d,r'^\d{4}-\d{2}-\d{2}$')
 def test11_agendamentos_relacionam_veiculo(self): self.assertEqual(0,self.db.execute('select count(*) from agendamentos a left join veiculos v on v.id=a.veiculo_id where v.id is null').fetchone()[0])
 def test12_veiculos_relacionam_cliente(self): self.assertEqual(0,self.db.execute('select count(*) from veiculos v left join clientes c on c.id=v.cliente_id where c.id is null').fetchone()[0])
 def test13_placa_regex_cobre_mercosul_e_antiga(self):
  pattern=re.search(r'const PLACA_VALIDA = (/.+?/);',SERVER).group(1)[1:-1]
  self.assertRegex('ABC1D23',pattern); self.assertRegex('ABC1234',pattern)
 def test14_placa_regex_rejeita_formato_invalido(self):
  pattern=re.search(r'const PLACA_VALIDA = (/.+?/);',SERVER).group(1)[1:-1]
  self.assertIsNone(re.fullmatch(pattern,'AB12D23'))
 def test15_rotas_protegidas_por_sessao(self):
  for r in ["app.get('/api/clientes', exigirLogin", "app.post('/api/clientes', exigirLogin", "app.get('/api/veiculos', exigirLogin", "app.get('/api/agendamentos', exigirLogin"]: self.assertIn(r,SERVER)
 def test16_consultas_com_parametros(self):
  self.assertIn("WHERE login = ?",SERVER); self.assertIn("WHERE id = ?",SERVER)
 def test17_hash_bcrypt_usado_no_login(self): self.assertIn('bcrypt.compareSync(senha, usuario.senha)',SERVER); self.assertIn("bcrypt.hashSync(s, 8)",(SYS/'db/gerar_sql.js').read_text())
 def test18_cookie_http_only_e_expiracao(self): self.assertIn('httpOnly: true',SERVER); self.assertIn('MINUTOS_SESSAO * 60 * 1000',SERVER)
 def test19_criptografia_cpf_aes_gcm(self):
  out=subprocess.check_output(['node','-e',f"const s=require({str(SYS/'seguranca.js')!r}); const p='52998224725'; const e=s.criptografar(p); if(s.descriptografar(e)!==p) process.exit(2); console.log(e.split(':').length)"]).decode().strip()
  self.assertEqual('3',out)
 def test20_criptografia_usa_iv_aleatorio(self): self.assertIn('crypto.randomBytes(12)',SEC); self.assertIn("'aes-256-gcm'",SEC)
 def test21_frontend_escapa_html(self): self.assertIn("replace(/</g, '&lt;')",JS); self.assertIn('esc(v.modelo)',(SYS/'public/js/veiculos.js').read_text())
 def test22_validacao_cpf_formato_e_duplicidade(self): self.assertIn('cpf.length !== 11',SERVER); self.assertIn('Já existe um cliente com este CPF.',SERVER)
 def test23_validacao_data_calendario(self): self.assertIn("d.toISOString().slice(0, 10) === texto",SERVER)
 def test24_logout_destroi_sessao(self): self.assertIn('req.session.destroy',SERVER)
if __name__=='__main__':
 suite=unittest.defaultTestLoader.loadTestsFromTestCase(TestesReversos)
 result=unittest.TextTestRunner(verbosity=2).run(suite)
 raise SystemExit(0 if result.wasSuccessful() else 1)
