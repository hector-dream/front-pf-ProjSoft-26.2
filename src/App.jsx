import { useCallback, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { jwtDecode } from 'jwt-decode';
import { chamarApi } from './api';

const formularioVazio = { emailAvaliado: '', comentarios: '', nota: '' };
const rolesClaim = import.meta.env.VITE_AUTH0_ROLES_CLAIM || 'https://prova-api/roles';

export default function App() {
  const { isLoading, isAuthenticated, user, error, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [papeis, setPapeis] = useState([]);
  const [formulario, setFormulario] = useState(formularioVazio);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const admin = papeis.includes('ADMIN');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setAvaliacoes(await chamarApi(getAccessTokenSilently, '/artigos'));
    } finally {
      setCarregando(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let ativo = true;
    async function iniciar() {
      try {
        const token = await getAccessTokenSilently();
        // Decodificar NÃO valida a assinatura: serve só para mostrar/esconder botões.
        // Quem autoriza cada operação de verdade é o SecurityConfig do Java.
        const roles = jwtDecode(token)[rolesClaim];
        if (ativo) setPapeis(Array.isArray(roles) ? roles : []);
        if (ativo) await carregar();
      } catch (e) {
        if (ativo) setErro(e.message);
      }
    }
    iniciar();
    return () => { ativo = false; };
  }, [isAuthenticated, getAccessTokenSilently, carregar]);

  // Reaproveitado para POST, PATCH e DELETE: evita clique duplicado e atualiza a lista.
  async function executar(acao, sucesso) {
    setErro('');
    setMensagem('');
    setSalvando(true);
    try {
      await acao();
      setMensagem(sucesso);
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  function cadastrar(event) {
    event.preventDefault();
    executar(async () => {
      // ID, e-mail do avaliador, data e status inicial são definidos pelo backend.
      await chamarApi(getAccessTokenSilently, '/artigos', 'POST', {
        ...formulario, nota: Number(formulario.nota),
      });
      setFormulario(formularioVazio);
    }, 'Artigo cadastrado.');
  }

  function alterarStatus(id, status) {
    // Para outro campo editável: crie a rota/DTO no Java e envie seu JSON aqui.
    executar(() => chamarApi(getAccessTokenSilently, `/artigos/${id}/status`, 'PATCH', { status }),
      'Status atualizado.');
  }

  function excluir(id) {
    if (!window.confirm(`Excluir o artigo ${id}?`)) return;
    // O front não muda ao trocar hard delete por soft delete no service Java.
    executar(() => chamarApi(getAccessTokenSilently, `/artigos/${id}`, 'DELETE'), 'Artigo excluído.');
  }

  if (isLoading) return <main><p>Carregando autenticação...</p></main>;

  return (
    <main>
      <h1>Artigos</h1>
      {(error || erro) && <p role="alert">{error?.message || erro}</p>}
      {mensagem && <p role="status">{mensagem}</p>}

      {!isAuthenticated ? (
        <>
          <p>Entre para consultar os artigos da nossa empresa!</p>
          <button onClick={() => loginWithRedirect().catch(e => setErro(e.message))}>Entrar com Auth0</button>
        </>
      ) : (
        <>
          <p>{user?.email || user?.name} | Papel: {papeis.join(', ') || 'não informado'}</p>
          <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>Sair</button>

          {/* ADMIN vê o formulário e ações. USER vê somente a listagem. */}
          {admin && (
            <section>
              <h2>Cadastrar artigo</h2>
              <form onSubmit={cadastrar}>
                <fieldset disabled={salvando}>
                  <label>Título
                    <input type="titulo" required maxLength={255} value={formulario.emailAvaliado}
                      onChange={e => setFormulario({ ...formulario, emailAvaliado: e.target.value })} />
                  </label>
                  <label>Descrição
                    <textarea required maxLength={4000} value={formulario.comentarios}
                      onChange={e => setFormulario({ ...formulario, comentarios: e.target.value })} />
                  </label>
                  <label>Nota (0 a 10)
                    <input type="number" min="0" max="10" step="0.01" required value={formulario.nota}
                      onChange={e => setFormulario({ ...formulario, nota: e.target.value })} />
                  </label>
                  <button type="submit">{salvando ? 'Aguarde...' : 'Cadastrar'}</button>
                </fieldset>
              </form>
            </section>
          )}

          <section>
            <h2>Lista de Artigos</h2>
            <button disabled={carregando || salvando} onClick={() => {
              setErro('');
              carregar().catch(e => setErro(e.message));
            }}>Atualizar lista</button>
            {carregando ? <p>Carregando artigos...</p> : (
              avaliacoes.length === 0 ? <p>Nenhum artigo para mostrar.</p> : (
                <div className="tabela">
                  <table>
                    <thead><tr>
                      <th>ID</th><th>Criador</th><th>Título</th><th>Descrição</th>
                      <th>Nota</th><th>Data</th><th>Prioridade</th>{admin && <th>Ações</th>}
                    </tr></thead>
                    <tbody>{avaliacoes.map(avaliacao => (
                      <tr key={avaliacao.id}>
                        <td>{avaliacao.id}</td>
                        <td>{avaliacao.emailAvaliador}</td>
                        <td>{avaliacao.emailAvaliado}</td>
                        <td className="comentarios">{avaliacao.comentarios}</td>
                        <td>{avaliacao.nota}</td>
                        <td>{new Date(avaliacao.dataAvaliacao).toLocaleString('pt-BR')}</td>
                        <td>{avaliacao.status}</td>
                        {admin && <td>
                          <button disabled={salvando} onClick={() => alterarStatus(avaliacao.id,
                            avaliacao.status === 'MINIMA' ? 'MAXIMA' : 'MINIMA')}>
                            Marcar como {avaliacao.status === 'MINIMA' ? 'MAXIMA' : 'MINIMA'}
                          </button>
                          <button disabled={salvando} onClick={() => excluir(avaliacao.id)}>Excluir</button>
                        </td>}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )
            )}
          </section>
        </>
      )}
    </main>
  );
}
