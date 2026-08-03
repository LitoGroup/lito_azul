# Lito Academy ✈ Azul — Landing de Indicação

Landing page do **programa de indicação da Lito Academy em parceria com a Azul Linhas Aéreas**.
Substitui o formulário do Google por uma página própria, com identidade visual de *cartão de
embarque*. Site estático, sem build: `HTML + CSS + JS`.

## Arquivos

| Arquivo       | O que é |
|---------------|---------|
| `index.html`  | Estrutura da página (hero, como funciona, aviso, formulário, sucesso, rodapé) |
| `styles.css`  | Estilos e identidade visual |
| `script.js`   | Validação, máscara de CPF, envio e tela de sucesso |

## Rodar localmente

É só abrir o `index.html` no navegador. Para servir localmente (recomendado):

```bash
npx serve .
```

## Conectar o backend

O envio tem **um único ponto de integração** em `script.js`:

```js
const ENDPOINT = ""; // coloque aqui a URL do seu backend
```

- Com `ENDPOINT` vazio → **modo demo**: o formulário valida e mostra a tela de sucesso,
  mas nada é enviado (os dados aparecem no console).
- Com uma URL → faz `POST` em **`multipart/form-data`** para essa URL (inclui o arquivo
  do currículo). O navegador define o `Content-Type` com o boundary automaticamente.

### Campos enviados (`POST multipart/form-data`)

| Campo                  | Tipo   | Valores |
|------------------------|--------|---------|
| `nome`                 | texto  | — |
| `cpf`                  | texto  | `000.000.000-00` |
| `email`                | texto  | e-mail da Gupy |
| `curriculo`            | arquivo| PDF, DOC ou DOCX (até 8 MB) |
| `cursos`               | texto  | — |
| `vaga`                 | texto  | — |
| `cvAtualizado`         | texto  | `Sim` / `Não` |
| `cvInformaLito`        | texto  | `Sim` / `Não` |
| `leuVaga`              | texto  | `Sim` / `Não` |
| `autorizaCompartilhar` | texto  | `Sim` / `Não` |
| `infoVerdadeiras`      | texto  | `Sim` / `Não` |
| `enviadoEm`            | texto  | ISO-8601 |

O backend só precisa receber esse `multipart/form-data`, salvar o arquivo `curriculo` e
gravar os campos onde você quiser (planilha, banco, e-mail).

## Publicar

Site estático — funciona em qualquer hospedagem (GitHub Pages, Vercel, Netlify, etc.).

## A fazer

- [ ] Implementar o backend e preencher `ENDPOINT`.
- [ ] Trocar as marcas tipográficas pelos logos oficiais da Lito Academy e da Azul.
