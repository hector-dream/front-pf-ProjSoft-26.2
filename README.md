# Front da prova — React + Vite

Interface simples em JavaScript. Faz login com Auth0, lista avaliações e permite
ao ADMIN cadastrar, alterar o status e excluir. USER consulta a lista.
O backend verifica as permissões de verdade; esconder botões no React só organiza a tela.

## Executar localmente

Precisa de Node.js 22.12+ e do backend em execução.

**SPA** significa Single Page Application: é o nosso front React e o tipo da aplicação
que você criou no Auth0. Não é outro serviço que precisa criar.
O **Client ID** fica em Auth0 → Applications → Applications → `API Prova Final ProjSoft`
→ Settings → Basic Information → Client ID. Copie esse campo, não o Client Secret.

`.env.example` é um modelo de configuração; `.env.local` é a cópia usada na sua máquina.
O comando `Copy-Item` apenas cria essa cópia, dentro da pasta do front. Se `.env.local`
já existir, não precisa copiar de novo: abra-o e troque somente
`COLE_O_CLIENT_ID_DA_SPA` pelo Client ID. Domínio, audience e claims já estão alinhados
com o backend. `http://localhost:8080` é a URL correta para executar o Java localmente;
para usar a AWS no desenvolvimento, use `http://44.220.88.212:8080`.

```powershell
npm.cmd install
Copy-Item .env.example .env.local
# No .env.local, cole o Client ID da aplicação React criada no Auth0.
npm.cmd run dev
```

Abra `http://localhost:5173`. No terminal que permite scripts, também pode usar
`npm install` e `npm run dev`. O sufixo `.cmd` evita o bloqueio de npm.ps1 no PowerShell.

Variáveis de `.env.local`:

| Variável | Valor |
| --- | --- |
| `VITE_AUTH0_DOMAIN` | `dev-xmwdlx52eoqalffj.us.auth0.com` (sem https e sem barra) |
| `VITE_AUTH0_CLIENT_ID` | Client ID de Applications → Applications → sua SPA |
| `VITE_AUTH0_AUDIENCE` | `https://prova-api` |
| `VITE_AUTH0_ROLES_CLAIM` | `https://prova-api/roles` |
| `VITE_API_URL` | Só no desenvolvimento: `http://localhost:8080` ou `http://44.220.88.212:8080`. Em produção, o código usa `/api`. |

Reinicie o Vite depois de mudar variáveis. Elas entram no bundle durante o build.
Client ID e domínio são configurações públicas. Não coloque Client Secret, senhas,
tokens de acesso ou chaves AWS em variáveis `VITE_*`. `.env.local` está no `.gitignore`.

## Integração publicada: Vercel → AWS

Front: `https://front-pf-projsoft-262.vercel.app`.
Java: `http://44.220.88.212:8080` (testado: responde 401 sem token).
O login já funcionou, conforme verificado pelo usuário.

Em produção, `src/api.js` usa `/api`, independentemente de `VITE_API_URL`.
O `vercel.json` encaminha `/api/:path*` para `http://44.220.88.212:8080/:path*`.
Exemplo: o navegador chama `https://front-pf-projsoft-262.vercel.app/api/avaliacoes`
e a Vercel encaminha ao Java como `/avaliacoes`, preservando o método e o token.
O navegador só chama HTTPS no próprio domínio, evitando mixed content.
O trecho Vercel → AWS ainda usa HTTP; para criptografia nesse trecho também,
configure HTTPS no backend e altere o destination do rewrite.
Se o IP da EC2 mudar, atualize o destination em `vercel.json` e publique novamente.

Para ativar esta correção:

1. Envie as mudanças do backend para disparar o GitHub Actions.
2. Se existir a Variable `CORS_ALLOWED_ORIGINS` no GitHub, inclua
   `https://front-pf-projsoft-262.vercel.app` nela, pois sobrescreve o padrão do código.
   O teste remoto antes da correção retornou `403 Invalid CORS request` para essa origem.
3. Envie as mudanças do front para gerar outro deploy na Vercel. Não é preciso preencher
   a URL HTTP da AWS em `VITE_API_URL` na Vercel: o código de produção usa `/api`.
4. Abra o site e confira a listagem; teste cadastro, status e exclusão com ADMIN.

Sem acesso autenticado aos painéis/SSH, a publicação dessas alterações deve ser
feita pelo usuário. Os arquivos locais já estão preparados.

## Auth0

Em Applications → Applications, use uma **Single Page Application**.
Configure Allowed Callback URLs, Allowed Logout URLs e Allowed Web Origins com
`http://localhost:5173` e, depois do deploy, também com a origem HTTPS da Vercel.
Liste as duas origens separadas por vírgula nos campos. Salve as alterações.

Em Applications → APIs, mantenha uma API com Identifier `https://prova-api` e RS256.
Crie os papéis `ADMIN` e `USER` e atribua-os aos usuários de teste.
No Post Login, conecte e publique uma Action que envie os claims no **access token**:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://prova-api';
  if (event.resource_server?.identifier !== namespace) return;
  api.accessToken.setCustomClaim(`${namespace}/roles`, event.authorization?.roles || []);
  if (event.user.email) {
    api.accessToken.setCustomClaim(`${namespace}/email`, event.user.email);
  }
};
```

Não remova a Action antiga antes de conferir se outra aplicação depende dela.
Depois de alterar os papéis/Action, saia e entre novamente para obter um token novo.
O nome da SPA é livre; Identifier/audience e nomes dos claims precisam coincidir com o Java.

## Deploy do backend na AWS com GitHub Actions

O workflow está no outro repositório: `provaFinal/.github/workflows/deploy.yml`.
Ele testa e empacota com Java 25, publica a imagem no Docker Hub e reinicia o contêiner
na EC2 por SSH. O Dockerfile já foi corrigido para o JAR `provaFinal-*.jar`.

No repositório `hector-dream/provaFinal`, em Settings → Secrets and variables → Actions,
confirme os secrets existentes:

| Secret | Uso |
| --- | --- |
| `DOCKERHUB_TOKEN` | Publicar imagem em `hector0/provaf` |
| `HOST_TEST` | Host público da EC2 |
| `KEY_TEST` | Chave SSH privada do usuário ubuntu (somente no GitHub Secrets) |

Crie também a **Variable** (aba Variables, não é um secret) `CORS_ALLOWED_ORIGINS`
com `http://localhost:5173,https://front-pf-projsoft-262.vercel.app` (sem barra final).
O workflow passa esse valor ao Java. Sem essa Variable, o padrão já inclui essa
origem de produção e as origens locais.

A rede Docker `rede` e o PostgreSQL `postgres-aula`, banco `auladb`, precisam existir
na EC2, como no deploy original. Credenciais padrão do banco são as do application.properties;
se seu banco usa outras, ajuste o envio de DB_USER/DB_PASSWORD por secrets no workflow.
O issuer e a audience já têm defaults corretos no application.properties.

Envie as mudanças do backend à branch `master` para disparar o workflow ou use
Actions → Java CI with Maven → Run workflow. Confira todos os passos, inclusive o SSH.
A publicação depende do acesso aos repositórios/serviços; preparar os arquivos localmente
não executa o deploy. O front usa o encaminhamento da Vercel descrito acima.

## Primeiro deploy do front na Vercel

1. Envie este projeto ao repositório `hector-dream/front-pf-ProjSoft-26.2`.
2. Entre na Vercel → Add New → Project → importe esse repositório.
3. Framework: Vite. Root Directory: raiz do repositório (`.`).
4. Build Command: `npm run build`. Output Directory: `dist`. Use Node.js 22.12+.
5. Em Environment Variables, adicione as variáveis Auth0 da tabela acima.
   `VITE_API_URL` não é usada em produção: as chamadas vão para `/api` pelo rewrite.
6. Faça Deploy. Copie a origem de produção `https://SEU-PROJETO.vercel.app`.
7. Adicione essa origem aos três campos de URLs do Auth0 e à Variable
   `CORS_ALLOWED_ORIGINS` do repositório Java. Dispare novamente o deploy do backend.
8. Se mudar variáveis na Vercel, faça Redeploy: Vite incorpora os valores no build.

O arquivo `vercel.json` configura Vite, `dist`, o encaminhamento de `/api` para a AWS
e `Cache-Control: no-store` para essas respostas autenticadas. Não há React Router.

## Onde estudar e como adaptar na prova

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main.jsx` | Configuração do Auth0Provider, audience e callback |
| `src/api.js` | Obtém token, envia Bearer, lê JSON, trata erros e o DELETE sem corpo |
| `src/App.jsx` | Estados, formulário, lista e botões de status/exclusão |
| `src/style.css` | Só espaçamento, tabela e legibilidade |

**Listar:** `carregar()` chama GET `/avaliacoes` e salva o resultado em `avaliacoes`.
O JSX usa `.map()` para renderizar uma linha por registro.

**Cadastrar:** `cadastrar()` evita recarregar a página com `preventDefault()`, transforma
nota em número e envia POST com `emailAvaliado`, `comentarios` e `nota`. O Java define
ID, data, e-mail do avaliador e status inicial. Após sucesso, limpa o formulário e atualiza a lista.

**Trocar status:** o botão chama `alterarStatus(id, status)`, que envia PATCH para
`/avaliacoes/{id}/status` com `{ status: 'VISTO' }` ou `{ status: 'PENDENTE' }`.
Para adicionar outro status, altere primeiro o enum Java e depois as opções da tela.

**Excluir:** `excluir(id)` confirma com o usuário e envia DELETE para `/avaliacoes/{id}`.
O retorno 204 não contém JSON. O mesmo front funciona com o soft delete alternativo do Java.

**Permissões:** o front lê o claim de papéis do access token para exibir as ações de ADMIN.
Isso não valida a assinatura nem substitui segurança. Toda rota nova precisa da regra
correspondente no `SecurityConfig` do Java (e método HTTP no CORS, se for novo).

**Outro tema na prova:** altere campos do formulário/tabela, JSON enviado e caminhos
da API em App.jsx. Mantenha Auth0Provider e o helper de token. O Identifier genérico
`https://prova-api` pode continuar igual.

## Verificação

```powershell
npm.cmd run build
```

Depois de configurar Auth0 e iniciar o Java, teste com os dois usuários:

- Sem login: aparece o botão de entrar.
- USER: lista avaliações, sem formulário nem ações de escrita.
- ADMIN: cadastra nota 0 a 10; nova avaliação começa PENDENTE; alterna status e exclui.
- Recarregue a página para conferir persistência; saia e entre com o outro usuário.
- Token sem papel: a API retorna 403 e a tela mostra erro.
- Backend indisponível: aparece erro de conexão; falhas HTTP aparecem na tela.

Build local não comprova login real nem deploy. Essas verificações dependem das
configurações e dos serviços acima.

Referências: [Auth0 React](https://auth0.com/docs/quickstart/spa/react)
e [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite).
