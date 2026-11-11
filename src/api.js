// Na Vercel, /api é encaminhado à AWS pelo vercel.json, sem HTTP direto no navegador.
// Localmente, VITE_API_URL continua apontando para o Java (localhost ou AWS).
const baseUrl = (import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || '')).replace(/\/$/, '');

// Centraliza o envio do access token. Todas as rotas Java exigem Bearer token.
// getAccessTokenSilently é fornecido pelo SDK e cuida de obter/renovar o token.
export async function chamarApi(getAccessTokenSilently, caminho, metodo = 'GET', dados) {
  const token = await getAccessTokenSilently();
  let resposta;
  try {
    resposta = await fetch(`${baseUrl}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(dados !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(dados !== undefined ? { body: JSON.stringify(dados) } : {}),
    });
  } catch {
    throw new Error('Não foi possível conectar à API. Confira a URL, a conexão e o CORS do backend.');
  }

  // DELETE retorna 204, portanto não há JSON para ler.
  if (resposta.status === 204) return null;
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (resposta.status === 401) throw new Error('Token inválido ou expirado. Saia e entre novamente.');
    if (resposta.status === 403) throw new Error('Acesso negado. Confira o papel do usuário e os claims da Action no Auth0.');
    if (resposta.status === 404) throw new Error('Artigo não encontrado. Atualize a lista.');
    const campos = corpo?.erros ? Object.entries(corpo.erros).map(([campo, erro]) => `${campo}: ${erro}`).join('; ') : '';
    throw new Error(campos || corpo?.detail || `Erro na API (${resposta.status}).`);
  }
  return corpo;
}
