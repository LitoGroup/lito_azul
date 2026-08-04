# Lito Academy ✈ Azul — Landing de Indicação + Painel

Landing page do **programa de indicação da Lito Academy em parceria com a Azul Linhas Aéreas**,
com identidade visual de *cartão de embarque*, e um **painel** onde a equipe da Lito acompanha as
candidaturas como cards. Site estático (`HTML + CSS + JS`) + **Supabase** (banco, storage e auth).

## Arquivos

| Arquivo              | O que é |
|----------------------|---------|
| `index.html`         | Landing pública (hero, como funciona, aviso, formulário, sucesso) |
| `styles.css`         | Estilos e identidade visual da landing |
| `script.js`          | Validação, máscara de CPF e envio para o Supabase |
| `painel.html`        | Painel interno (login + cards das candidaturas) |
| `painel.css`         | Estilos do painel |
| `painel.js`          | Login, listagem, filtros, status, download de currículo, tempo real |
| `supabase-config.js` | URL + chave **anon** (pública) compartilhada pelas duas páginas |
| `supabase-setup.sql` | Script que cria tabelas, políticas de segurança e bucket |
| `img/`               | Logos (`lito.png`, `azul.png`) |

## Como funciona

```
Candidato → index.html → (chave anon) → Supabase
                                          ├─ Storage: curriculosLAZ  (PDF/DOC)
                                          └─ Tabela:  candidaturasLAZ
Equipe Lito → painel.html → (login) → lê candidaturasLAZ → cards
```

- O **formulário** usa a chave **anon** só para **inserir** a candidatura e **subir** o currículo.
  Ele não consegue ler nada de volta.
- O **painel** exige **login** e só mostra dados para e-mails na allowlist `adminsLAZ`.
- Todas as tabelas/bucket usam o sufixo **LAZ** (`candidaturasLAZ`, `adminsLAZ`, `curriculosLAZ`).

## Setup do Supabase (uma vez)

1. **Criar o schema.** No Supabase Studio → **SQL Editor**, cole e rode o `supabase-setup.sql`.
   Antes de rodar, troque o e-mail de exemplo pelo seu na linha:
   ```sql
   insert into "adminsLAZ" (email) values ('troque-por-seu-email@exemplo.com')
   ```
   (esse é o e-mail que vai poder acessar o painel — pode adicionar mais linhas depois.)

2. **Criar o usuário do painel.** Studio → **Authentication → Users → Add user**.
   Use o **mesmo e-mail** cadastrado na `adminsLAZ` e defina uma senha. Marque como confirmado.

3. **(Recomendado) Desabilitar cadastro público.** Studio → **Authentication → Sign In / Providers**,
   desligue “Allow new users to sign up”. Assim ninguém cria conta sozinho.

Pronto. Abra `painel.html`, entre com o e-mail/senha e as candidaturas aparecem como cards.

> A chave **anon** em `supabase-config.js` é pública por design — a segurança vem do RLS.
> **Nunca** coloque a chave **service_role** (privada) em nenhum arquivo do site: ela ignora o RLS
> e expõe todos os dados. Ela só serve, no máximo, para administrar o projeto pelo servidor.

## Rodar localmente

```bash
python -m http.server 8123
```

Acesse `http://127.0.0.1:8123/index.html` (formulário) e `http://127.0.0.1:8123/painel.html` (painel).

## Publicar

Site estático — funciona em qualquer hospedagem (GitHub Pages, Vercel, Netlify, etc.).
Basta subir todos os arquivos, incluindo a pasta `img/`.

## Dados gravados (tabela `candidaturasLAZ`)

`nome`, `cpf`, `email`, `curriculo_path`, `curriculo_nome`, `cursos`, `vaga`,
`cv_atualizado`, `cv_informa_lito`, `leu_vaga`, `autoriza_compartilhar`, `info_verdadeiras`,
`status` (`nova` / `em_analise` / `indicada` / `arquivada`), `criado_em`, `enviado_em`.
