import React from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';
import './style.css';

// Vite lê variáveis VITE_* durante o build. Nunca coloque Client Secret aqui.
const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
const configurado = domain && clientId && !clientId.startsWith('COLE_') && audience
  && (import.meta.env.PROD || import.meta.env.VITE_API_URL);

createRoot(document.getElementById('root')).render(
  configurado ? (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience,
        scope: 'openid profile email',
      }}
    >
      <App />
    </Auth0Provider>
  ) : (
    <main>
      <h1>Artigos</h1>
      <p>A configuração da aplicação está incompleta.</p>
      <p>{import.meta.env.DEV
        ? 'Preencha as variáveis do .env.local conforme o .env.example e reinicie o servidor.'
        : 'Configure as variáveis VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID e VITE_AUTH0_AUDIENCE no painel da Vercel e faça um novo deploy.'}</p>
    </main>
  ),
);
