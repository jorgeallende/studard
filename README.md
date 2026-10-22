# Studard

PWA de flashcards em português, feita com React, TypeScript, Vite e Supabase. Matérias contêm temas, e temas contêm cards com pergunta e resposta.

Inclui criação, edição e exclusão, favoritos, busca por pergunta/resposta/matéria/tema, animação 3D ao virar o card, estudo por tema ou matéria, revisões agendadas, histórico de progresso e backup em JSON. O layout se adapta ao celular e respeita a preferência por movimento reduzido.

## Rodar localmente

Requer Node.js 22 LTS (22.12+) ou 24+ e npm.

```bash
npm ci
npm run dev
```

Acesse a URL indicada pelo Vite, normalmente `http://localhost:5173`.

Sem variáveis do Supabase, o app funciona no modo local. Na primeira abertura, cria uma biblioteca de exemplo com 4 matérias, 9 temas e 23 flashcards. Você pode editar ou excluir esses exemplos. Nada é enviado para a nuvem nesse modo.

## Configurar seu Supabase

1. No projeto Supabase, abra o **SQL Editor** e execute o conteúdo de [`supabase/migrations/202610220001_study_library.sql`](supabase/migrations/202610220001_study_library.sql).
2. Em **Authentication → Sign In / Providers → Email** (ou **Authentication → Providers → Email**, conforme a interface), habilite **Email** e desative **Confirm email**. Salve a alteração. Essa configuração do servidor permite criar a conta e entrar imediatamente com e-mail e senha, sem confirmação. Ela não é alterada pelo script SQL nem pelo código do navegador.
3. Em **Authentication → URL Configuration**, configure a **Site URL** para `https://studard.vercel.app`. As **Redirect URLs** podem incluir essa URL, `http://localhost:5173` e `http://localhost:4173`. O login com senha acontece diretamente no app e não depende de um link por e-mail.
4. Copie `.env.example` para `.env.local` e preencha:

```dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
```

A chave pública atual, que começa com `sb_publishable_`, e a chave `anon` legada são compatíveis. `VITE_SUPABASE_ANON_KEY` também é aceito como alternativa. Nunca coloque uma chave `service_role` ou secreta em variáveis `VITE_*`: elas são incorporadas ao navegador.

5. Reinicie o servidor Vite após alterar as variáveis. Abra **Minha conta → Criar conta**, informe seu e-mail e uma senha de pelo menos 8 caracteres e repita a senha. A entrada é imediata quando **Confirm email** está desativado. Para uma conta existente, use **Entrar** com e-mail e senha.

A confirmação de e-mail é uma configuração administrativa do Supabase: a chave pública usada no app não tem permissão para mudá-la. Se o cadastro retornar sem sessão porque a confirmação continua ativa, o app informa a pendência e não trata o usuário como autenticado. Senhas são enviadas somente ao Supabase Auth e não são salvas nos backups ou na biblioteca local.

## Publicar na Vercel

1. No projeto Vercel, abra **Settings → Environment Variables**.
2. Adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os mesmos valores do seu `.env.local`. Selecione o ambiente **Production** e, se necessário, **Preview**.
3. Use o preset **Vite**, comando de build `npm run build` e diretório de saída `dist`.
4. Publique as alterações de código e faça um novo deploy. Alterar variáveis não atualiza uma build já publicada: use **Deployments → Redeploy** depois de salvar as variáveis.
5. Se o PWA estiver aberto com uma versão antiga, use o aviso **Atualizar app** ou recarregue a página após o deploy.

O arquivo `.env.local` é ignorado pelo Git. Ele configura apenas sua máquina; a Vercel precisa receber as variáveis no painel. O modal “A sincronização ainda não foi configurada” indica que a build em uso não recebeu uma das variáveis do Supabase.

Não é necessário rodar novamente a migração para trocar o tipo de login. Não inclua a chave `service_role` no app ou nas variáveis `VITE_*`.

## Dados e sincronização

- Cada usuário tem uma linha em `study_libraries`. O documento JSONB contém a hierarquia completa e o histórico. Esta escolha mantém a aplicação pessoal simples e permite salvar a biblioteca em uma transação.
- RLS permite ler somente a biblioteca do próprio usuário. As gravações usam a função `save_study_library`, que identifica o usuário pela sessão e confere a revisão esperada.
- O app mantém uma cópia por conta no `localStorage`. Alterações são salvas localmente de imediato e sincronizadas após uma pequena pausa. Ao recuperar a conexão, ele confere a versão remota e envia as alterações pendentes. Ao voltar à aba, busca alterações remotas quando não há edições locais pendentes.
- Se houver edições simultâneas em dispositivos diferentes, o app informa o conflito. Exporte a cópia local em **Preferências** antes de carregar a versão da nuvem. Não há mesclagem automática.
- A biblioteca local e as bibliotecas das contas são separadas. Para levar seus cards locais à conta, exporte no modo local, entre na conta e restaure o backup em **Preferências**. Restaurar substitui a biblioteca atual, com confirmação.
- Sair da conta preserva seu cache offline neste dispositivo. Use dispositivos pessoais para estudar com dados privados.
- Backups são validados antes da importação e aceitam arquivos de até 10 MB. A biblioteca na nuvem também tem limite de 10 MB por documento.

## Revisões

Os intervalos são simples e fixos: **Preciso rever** agenda para 10 minutos; **Lembrei**, para o dia seguinte; **Foi fácil**, para 4 dias depois. Cada card recebe uma avaliação por passagem na sessão. Ao concluir, é possível estudar novamente. Esta versão não implementa algoritmos adaptativos como FSRS ou SM-2.

O objetivo visual é de 20 revisões por dia. Os números de constância, atividade e lembrança são calculados com base nas suas avaliações reais, usando o calendário local do dispositivo.

## PWA e publicação

```bash
npm run build
npm run preview
```

A build gera o manifesto, os ícones e o service worker dentro de `dist/`. O modo offline e a instalação devem ser verificados na build de produção; o servidor de desenvolvimento não registra o service worker.

Publique `dist/` em uma hospedagem estática com **HTTPS**. Configure as variáveis do Supabase no ambiente de build da hospedagem e adicione o domínio às URLs de redirecionamento no Supabase. As fontes e os demais recursos da interface são locais e ficam disponíveis offline após o primeiro carregamento completo.

No Chrome/Edge, use o botão **Instalar Studard** ou a opção de instalação do navegador. No iPhone/iPad, abra no Safari e escolha **Compartilhar → Adicionar à Tela de Início**. Quando uma atualização estiver pronta, o app oferece um botão para aplicá-la.

A sincronização offline acontece com o app aberto e a conexão restabelecida. Não há sincronização de banco em segundo plano com o app fechado. Limpar os dados do navegador remove o cache local; mantenha a sincronização ou um backup para preservar seus cards.

## Verificações

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de unidade verificam os intervalos, o histórico, a constância, a exclusão em cascata e a validação de backups. Os testes de banco executam a migração real no PostgreSQL via PGlite, com um stub de autenticação, e verificam RLS, permissões e conflitos de revisão. Não acessam seu projeto remoto.

Os testes de navegador usam a build de produção nas versões desktop e mobile, cobrindo criação/edição, estudo, favoritos, busca, exclusão, backup, persistência e recarga offline. Para usar um Chrome já instalado:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e
```

Os testes de autenticação interceptam as requisições HTTP do Supabase para verificar login com senha, cadastro com sessão imediata, erros de credenciais, validação de senhas e persistência da sessão. Eles não criam contas nem enviam e-mails reais.

A URL/chave do Supabase, a migração aplicada e **Confirm email** desativado são necessários para testar o cadastro real e a sincronização contra seu projeto.

Referências de implementação: [React](https://react.dev/learn/creating-a-react-app), [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [Vite PWA](https://vite-pwa-org.netlify.app/guide/).
