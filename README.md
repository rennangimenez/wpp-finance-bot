# 📱 WPP Finance Bot

Um bot para **controle financeiro no WhatsApp**, utilizando [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), MongoDB e Node.js.  
O bot permite registrar gastos em categorias, acompanhar saldo restante, alterar limites e resetar os dados mensalmente.

---

## 🚀 Funcionalidades

- ✅ Registrar categorias com limite de gastos
- ✅ Registrar gastos informando categoria e valor
- ✅ Consultar saldo por categoria
- ✅ Alterar limite de uma categoria
- ✅ Remover categorias
- ✅ Reset automático todo início de mês
- ✅ Comandos via WhatsApp (funciona direto em grupo)

---

## 📦 Requisitos

- Node.js **v20 ou superior**
- MongoDB Atlas (ou local)
- WhatsApp no celular para escanear QR Code

---

## ⚙️ Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/seu-usuario/wpp-finance-bot.git
cd wpp-finance-bot
npm install
```

---

## 🔑 Configuração do Ambiente

1. Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

2. Abra o arquivo `.env` e edite a string do MongoDB:

```env
MONGO_URI=mongodb+srv://SEU_USUARIO:SUA_SENHA@SEU_CLUSTER.mongodb.net/financebot
```

---

## ▶️ Executando o Bot

```bash
node index.js
```

- No terminal, escaneie o QR Code com o app do WhatsApp.  
- Mande qualquer mensagem no grupo **Controle Financeiro** para capturar o **ID do grupo**.  
- Cole o ID no `index.js` na constante:

```js
const ALLOWED_GROUP_ID = "COLE_AQUI_O_ID_DO_SEU_GRUPO";
```

- Reinicie o bot.

---

## 💬 Comandos Disponíveis

| Comando                          | Descrição                                               |
|----------------------------------|-------------------------------------------------------|
| `/ping`                          | Testa se o bot está online                            |
| `/add-categoria <nome> <limite>` | Cria uma nova categoria com limite de gastos           |
| `/saldo`                         | Mostra o saldo de todas as categorias                 |
| `/rmv-categoria <nome>`          | Remove a categoria especificada                       |
| `/altera-valor-limite <nome> <valor>` | Altera o limite de uma categoria                |
| `/reset`                         | Reseta todos os gastos (início de novo mês)           |
| `<categoria> <valor>`            | Registra um gasto sem usar comando, ex: `mercado 150` |

---

## 📂 Estrutura do Projeto

```
wpp-finance-bot/
├── .wwebjs_auth/         # Sessão autenticada do WhatsApp
├── .wwebjs_cache/        # Cache do WhatsApp Web
├── models/
│   ├── Categoria.js      # Schema da categoria
│   └── Gasto.js          # Schema dos gastos
├── node_modules/         # Dependências do projeto
├── .env                  # Variáveis de ambiente (não subir pro git)
├── .env.example          # Modelo do .env
├── .gitignore            # Arquivos ignorados pelo git
├── index.js              # Bot principal
├── package.json          # Configuração do projeto
└── README.md             # Este arquivo
```

---

## 🛡️ Segurança

- **Nunca suba o arquivo `.env` para o GitHub.**  
- O arquivo `.gitignore` já está configurado para ignorar `.env` e `.wwebjs_auth/`.  
