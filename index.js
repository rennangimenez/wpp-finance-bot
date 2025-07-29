require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mongoose = require('mongoose');
const cron = require('node-cron');

const Gasto = require('./models/Gasto');
const Categoria = require('./models/Categoria');

// ⚡ Cole aqui o ID do grupo que apareceu no console
const ALLOWED_GROUP_ID = "120363420189472861@g.us";

// Conexão MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('📦 Conectado ao MongoDB!'))
    .catch(err => console.error('❌ Erro MongoDB:', err));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('✅ Bot conectado ao WhatsApp!'));

// 📌 Usando message_create para capturar mensagens de todos (inclusive você)
client.on('message_create', async (msg) => {
    try {
        const chat = await msg.getChat();

        // Log no console
        console.log(`📩 Chat: ${chat.name} - ID: ${chat.id._serialized} - Msg: ${msg.body}`);

        // Filtra pelo grupo correto
        if (!chat.isGroup || chat.id._serialized !== ALLOWED_GROUP_ID) {
            return; // Ignora tudo fora do grupo permitido
        }

        const texto = msg.body.trim();
        const partes = texto.split(' ');
        const comando = partes[0].toLowerCase();
        const args = partes.slice(1);

        // -----------------------
        // Comandos
        // -----------------------

        if (comando === '/ping') {
            return msg.reply('🏓 Pong! Bot online.');
        }

        if (comando === '/saldo') {
            const categorias = await Categoria.find();
            if (categorias.length === 0) {
                return msg.reply('⚠️ Nenhuma categoria cadastrada. Use /add-categoria.');
            }

            let resposta = '📌 *Saldo Atual:*\n';
            for (let cat of categorias) {
                const gastos = await Gasto.aggregate([
                    { $match: { categoria: cat.nome } },
                    { $group: { _id: null, total: { $sum: "$valor" } } }
                ]);
                const total = gastos[0]?.total || 0;
                const saldo = cat.limite - total;
                resposta += `- ${cat.nome}: R$${saldo} restante (gasto R$${total}, limite R$${cat.limite})\n`;
            }
            return msg.reply(resposta);
        }

        if (comando === '/reset') {
            await Gasto.deleteMany({});
            return msg.reply('🔄 Todos os registros apagados! Novo mês iniciado.');
        }

        if (comando === '/add-categoria') {
            if (args.length < 2) {
                return msg.reply('❌ Uso: /add-categoria <nome> <limite>');
            }
            const nome = args[0].toLowerCase();
            const limite = parseFloat(args[1]);
            if (isNaN(limite)) return msg.reply('❌ O limite precisa ser um número.');

            try {
                await Categoria.create({ nome, limite });
                return msg.reply(`✅ Categoria "${nome}" criada com limite R$${limite}`);
            } catch (err) {
                return msg.reply(`⚠️ Categoria "${nome}" já existe.`);
            }
        }

        if (comando === '/rmv-categoria') {
            if (args.length < 1) return msg.reply('❌ Uso: /rmv-categoria <nome>');
            const nome = args[0].toLowerCase();
            const result = await Categoria.deleteOne({ nome });
            if (result.deletedCount > 0) {
                return msg.reply(`✅ Categoria "${nome}" removida.`);
            } else {
                return msg.reply(`⚠️ Categoria "${nome}" não encontrada.`);
            }
        }

        if (comando === '/altera-valor-limite') {
            if (args.length < 2) return msg.reply('❌ Uso: /altera-valor-limite <nome> <novoLimite>');
            const nome = args[0].toLowerCase();
            const novoLimite = parseFloat(args[1]);
            if (isNaN(novoLimite)) return msg.reply('❌ O novo limite precisa ser um número.');

            const categoria = await Categoria.findOne({ nome });
            if (!categoria) return msg.reply(`⚠️ Categoria "${nome}" não encontrada.`);

            categoria.limite = novoLimite;
            await categoria.save();
            return msg.reply(`✅ Limite da categoria "${nome}" atualizado para R$${novoLimite}`);
        }

        // -----------------------
        // Registro de gasto sem /
        // -----------------------
        if (!texto.startsWith('/')) {
            if (partes.length === 2) {
                const categoriaNome = partes[0].toLowerCase();
                const valor = parseFloat(partes[1]);
                const categoria = await Categoria.findOne({ nome: categoriaNome });

                if (categoria && !isNaN(valor)) {
                    await Gasto.create({ categoria: categoriaNome, valor });

                    const gastos = await Gasto.aggregate([
                        { $match: { categoria: categoriaNome } },
                        { $group: { _id: null, total: { $sum: "$valor" } } }
                    ]);
                    const total = gastos[0]?.total || 0;
                    const saldo = categoria.limite - total;

                    return msg.reply(
                        `✅ Registrado: ${categoriaNome} R$${valor}\n` +
                        `📊 Total gasto: R$${total}\n` +
                        `💰 Saldo restante: R$${saldo}`
                    );
                } else {
                    return msg.reply(`⚠️ Categoria "${categoriaNome}" não encontrada. Use /add-categoria primeiro.`);
                }
            }
        }

    } catch (err) {
        console.error("❌ Erro ao processar mensagem:", err);
    }
});

// Reset automático todo dia 1
cron.schedule('0 0 1 * *', async () => {
    await Gasto.deleteMany({});
    console.log('🔄 Reset mensal executado.');
});

client.initialize();
