require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mongoose = require('mongoose');
const cron = require('node-cron');

const Gasto = require('./models/Gasto');
const Categoria = require('./models/Categoria');

// ID do grupo (vem do .env)
const ALLOWED_GROUP_ID = process.env.GROUP_ID;

// Conexão com MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('📦 Conectado ao MongoDB!'))
    .catch(err => console.error('❌ Erro MongoDB:', err));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    },
    takeoverOnConflict: true,
    bypassCSP: true,
    webVersionCache: {} // garante mensagens próprias
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('✅ Bot conectado ao WhatsApp!'));

client.on('message', async (message) => {
    const chat = await message.getChat();

    // Ignora mensagens fora do grupo permitido
    if (chat.id._serialized !== ALLOWED_GROUP_ID) return;

    const msg = message.body.trim().toLowerCase();

    console.log(`📩 Mensagem recebida: ${message.body}`);

    // === Comandos ===
    if (msg === '/help') {
        return message.reply(
            `📌 *Lista de Comandos*\n\n` +
            `/add-categoria <nome> <limite> - Adiciona nova categoria\n` +
            `/altera-valor-limite <nome> <novo_valor> - Altera limite de uma categoria\n` +
            `/ping - Testa se o bot está online\n` +
            `/reset - Reseta todos os gastos\n` +
            `/rmv-categoria <nome> - Remove uma categoria\n` +
            `/saldo - Mostra saldo restante por categoria`
        );
    }

    if (msg === '/ping') {
        return message.reply('🏓 Pong!');
    }

    if (msg.startsWith('/add-categoria')) {
        const parts = message.body.split(' ');
        if (parts.length < 3) {
            return message.reply('❌ Uso correto: /add-categoria <nome> <limite>');
        }
        const nome = parts[1].toLowerCase();
        const limite = parseFloat(parts[2]);
        if (isNaN(limite)) return message.reply('❌ O limite deve ser um número.');

        const existe = await Categoria.findOne({ nome });
        if (existe) return message.reply(`⚠️ Categoria "${nome}" já existe.`);

        await Categoria.create({ nome, limite });
        return message.reply(`✅ Categoria "${nome}" criada com limite de R$${limite.toFixed(2)}`);
    }

    if (msg.startsWith('/altera-valor-limite')) {
        const parts = message.body.split(' ');
        if (parts.length < 3) {
            return message.reply('❌ Uso correto: /altera-valor-limite <nome> <novo_valor>');
        }
        const nome = parts[1].toLowerCase();
        const novoLimite = parseFloat(parts[2]);
        if (isNaN(novoLimite)) return message.reply('❌ O valor deve ser um número.');

        const categoria = await Categoria.findOne({ nome });
        if (!categoria) return message.reply(`⚠️ Categoria "${nome}" não encontrada.`);

        categoria.limite = novoLimite;
        await categoria.save();
        return message.reply(`✅ Limite da categoria "${nome}" atualizado para R$${novoLimite.toFixed(2)}`);
    }

    if (msg.startsWith('/rmv-categoria')) {
        const parts = message.body.split(' ');
        if (parts.length < 2) {
            return message.reply('❌ Uso correto: /rmv-categoria <nome>');
        }
        const nome = parts[1].toLowerCase();
        const categoria = await Categoria.findOneAndDelete({ nome });

        if (!categoria) return message.reply(`⚠️ Categoria "${nome}" não encontrada.`);
        return message.reply(`🗑️ Categoria "${nome}" removida com sucesso.`);
    }

    if (msg === '/saldo') {
        const categorias = await Categoria.find();
        if (categorias.length === 0) return message.reply('⚠️ Nenhuma categoria encontrada.');

        let resposta = '📊 *Saldo por Categoria:*\n\n';
        for (const categoria of categorias) {
            const gastos = await Gasto.find({ categoria: categoria.nome });
            const total = gastos.reduce((acc, g) => acc + g.valor, 0);
            const restante = categoria.limite - total;
            resposta += `• ${categoria.nome}: R$${restante.toFixed(2)} restantes (Limite: R$${categoria.limite})\n`;
        }
        return message.reply(resposta);
    }

    if (msg === '/reset') {
        await Gasto.deleteMany({});
        return message.reply('🔄 Todos os gastos foram resetados.');
    }

    // Registro de gastos sem comando
    const parts = message.body.split(' ');
    if (parts.length === 2) {
        const categoriaNome = parts[0].toLowerCase();
        const valor = parseFloat(parts[1]);

        if (!isNaN(valor)) {
            const categoria = await Categoria.findOne({ nome: categoriaNome });
            if (!categoria) {
                return message.reply(`⚠️ Categoria "${categoriaNome}" não encontrada. Use /add-categoria primeiro.`);
            }

            await Gasto.create({ categoria: categoria.nome, valor });
            return message.reply(`✅ Gasto de R$${valor.toFixed(2)} registrado em "${categoriaNome}".`);
        }
    }
});

// Reset automático no dia 1
cron.schedule('0 0 1 * *', async () => {
    await Gasto.deleteMany({});
    console.log('🔄 Reset mensal executado.');
});

client.initialize();
