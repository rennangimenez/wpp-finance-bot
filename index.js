require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mongoose = require('mongoose');

const Gasto = require('./models/Gasto');
const Categoria = require('./models/Categoria');

const ALLOWED_GROUP_ID = "120363420189472861@g.us";

// Conexão com MongoDB
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

// Exibir QR Code
client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('✅ Bot conectado ao WhatsApp!'));
client.on('disconnected', () => console.log('⚠️ Bot desconectado do WhatsApp!'));

// Escutar TODAS mensagens, inclusive as suas
client.on('message_create', async (message) => {
    const chat = await message.getChat();

    if (chat.id._serialized !== ALLOWED_GROUP_ID) return;

    const msg = message.body.trim().toLowerCase();
    console.log(`📩 Mensagem recebida: ${msg} (de ${message.fromMe ? "VOCÊ" : "outra pessoa"})`);

    switch (true) {
        case msg === '/help':
            message.reply(
                `📌 *Lista de comandos disponíveis:*\n\n` +
                `- 📂 /add-categoria [nome] [limite] → Adiciona nova categoria com limite\n` +
                `- ➕ /add-gasto [valor] [categoria] → Registra um gasto\n` +
                `- ✏️ /altera-valor-limite [categoria] [novoValor] → Altera o limite da categoria\n` +
                `- ❓ /help → Mostra esta lista de comandos\n` +
                `- 📋 /listar-categorias → Lista todas as categorias\n` +
                `- 🏓 /ping → Testa se o bot está online\n` +
                `- 🔄 /reset-mes → Apaga todos os gastos do mês\n` +
                `- 🗑️ /rmv-categoria [categoria] → Remove uma categoria\n` +
                `- 🗑️ /rmv-gasto [valor] [categoria] → Remove um gasto\n` +
                `- 📊 /saldo [categoria] → Mostra o saldo disponível na categoria\n` +
                `- 💰 /total → Mostra o total de gastos\n` +
                `- 📈 /total-categoria → Lista o total gasto por *cada* categoria (com avisos)`
            );
            break;

        case msg === '/ping':
            message.reply('🏓 Pong! Estou online!');
            break;

        case msg === '/total':
            const gastos = await Gasto.find();
            if (!gastos.length) {
                message.reply('⚠️ Nenhum gasto registrado ainda.');
            } else {
                const total = gastos.reduce((acc, g) => acc + g.valor, 0);
                message.reply(
                    `💰 *Resumo Geral dos Gastos*\n\n` +
                    `💸 Total gasto até agora: *R$ ${total.toFixed(2)}*`
                );
            }
            break;

        case msg === '/listar-categorias':
            {
                const categorias = await Categoria.find().sort({ nome: 1 });
                if (!categorias.length) {
                    message.reply('⚠️ Nenhuma categoria cadastrada.');
                } else {
                    const lista = categorias.map(c =>
                        `📂 *${c.nome}* → Limite: R$ ${c.limite.toFixed(2)}`
                    ).join('\n\n');
                    message.reply(`📋 *Categorias Cadastradas:*\n\n${lista}`);
                }
            }
            break;

        case msg === '/total-categoria':
            {
                const categorias = await Categoria.find().sort({ nome: 1 });
                if (!categorias.length) {
                    message.reply('⚠️ Nenhuma categoria cadastrada.');
                    break;
                }

                let resposta = `📈 *Total por Categoria*\n\n`;
                for (const c of categorias) {
                    const gastosCat = await Gasto.find({ categoria: c.nome });
                    const totalGasto = gastosCat.reduce((acc, g) => acc + g.valor, 0);

                    // Emojis de status
                    let status = '✅';
                    if (totalGasto > c.limite) status = '🚨';        // passou do limite
                    else if (totalGasto === c.limite) status = '⚠️'; // atingiu exatamente

                    const diff = (c.limite - totalGasto).toFixed(2);
                    const linha =
                        `${status} *${c.nome.toUpperCase()}*\n` +
                        `💸 Total gasto: *R$ ${totalGasto.toFixed(2)}*\n` +
                        `💰 Limite: *R$ ${c.limite.toFixed(2)}*\n` +
                        (totalGasto > c.limite
                            ? `❌ Excedente: *R$ ${(totalGasto - c.limite).toFixed(2)}*`
                            : `💳 Restante: *R$ ${diff}*`);
                    resposta += linha + `\n\n`;
                }

                message.reply(resposta.trim());
            }
            break;

        case msg === '/reset-mes':
            await Gasto.deleteMany({});
            message.reply('🔄 Todos os gastos foram resetados para este mês.');
            break;

        default:
            if (msg.startsWith('/add-categoria')) {
                const args = message.body.split(' ').slice(1);
                const nome = args[0];
                const limite = parseFloat(args[1]);

                if (!nome || isNaN(limite)) {
                    message.reply('⚠️ Uso correto: /add-categoria [nome] [limite]');
                    return;
                }

                await Categoria.create({ nome, limite });
                message.reply(`✅ Categoria *${nome}* criada com limite de R$ ${limite.toFixed(2)}!`);
                return;
            }

            if (msg.startsWith('/add-gasto')) {
                const args = message.body.split(' ').slice(1);
                const valor = parseFloat(args[0]);
                const categoriaNome = args.slice(1).join(' ');

                if (isNaN(valor) || !categoriaNome) {
                    message.reply('⚠️ Uso correto: /add-gasto [valor] [categoria]');
                    return;
                }

                const categoria = await Categoria.findOne({ nome: categoriaNome });
                if (!categoria) {
                    message.reply(`⚠️ Categoria "${categoriaNome}" não encontrada. Use /listar-categorias`);
                    return;
                }

                await Gasto.create({ valor, categoria: categoriaNome });

                // Calcular total gasto nessa categoria
                const gastosCategoria = await Gasto.find({ categoria: categoriaNome });
                const totalGasto = gastosCategoria.reduce((acc, g) => acc + g.valor, 0);

                message.reply(`✅ Gasto de R$ ${valor.toFixed(2)} registrado em *${categoriaNome}*.`);

                // ALERTA caso ultrapasse o limite
                if (totalGasto > categoria.limite) {
                    const excedente = totalGasto - categoria.limite;
                    message.reply(
                        `🚨 *${categoria.nome.toUpperCase()}*\n\n` +
                        `⚠️ O valor total planejado para esta categoria foi ultrapassado!!\n\n` +
                        `💰 Valor total: *R$ ${categoria.limite.toFixed(2)}*\n` +
                        `💸 Valor gasto: *R$ ${totalGasto.toFixed(2)}*\n` +
                        `❌ Valor excedente: *R$ ${excedente.toFixed(2)}*`
                    );
                }

                return;
            }

            if (msg.startsWith('/rmv-gasto')) {
                const args = message.body.split(' ').slice(1);
                const valor = parseFloat(args[0]);
                const categoriaNome = args.slice(1).join(' ');

                if (isNaN(valor) || !categoriaNome) {
                    message.reply('⚠️ Uso correto: /rmv-gasto [valor] [categoria]');
                    return;
                }

                const gasto = await Gasto.findOneAndDelete({ valor, categoria: categoriaNome });
                if (!gasto) {
                    message.reply(`⚠️ Gasto de R$ ${valor} na categoria "${categoriaNome}" não encontrado.`);
                    return;
                }

                message.reply(`🗑️ Gasto de R$ ${valor.toFixed(2)} removido da categoria *${categoriaNome}*.`);
                return;
            }

            if (msg.startsWith('/rmv-categoria')) {
                const args = message.body.split(' ').slice(1);
                const categoriaNome = args.join(' ');

                if (!categoriaNome) {
                    message.reply('⚠️ Uso correto: /rmv-categoria [categoria]');
                    return;
                }

                await Categoria.findOneAndDelete({ nome: categoriaNome });
                await Gasto.deleteMany({ categoria: categoriaNome });
                message.reply(`🗑️ Categoria *${categoriaNome}* e seus gastos foram removidos.`);
                return;
            }

            if (msg.startsWith('/altera-valor-limite')) {
                const args = message.body.split(' ').slice(1);
                const categoriaNome = args[0];
                const novoValor = parseFloat(args[1]);

                if (!categoriaNome || isNaN(novoValor)) {
                    message.reply('⚠️ Uso correto: /altera-valor-limite [categoria] [novoValor]');
                    return;
                }

                const categoria = await Categoria.findOneAndUpdate(
                    { nome: categoriaNome },
                    { limite: novoValor },
                    { new: true }
                );

                if (!categoria) {
                    message.reply(`⚠️ Categoria "${categoriaNome}" não encontrada.`);
                    return;
                }

                message.reply(`✏️ Limite da categoria *${categoriaNome}* atualizado para R$ ${novoValor.toFixed(2)}.`);
                return;
            }

            if (msg.startsWith('/saldo')) {
                const args = message.body.split(' ').slice(1);
                const categoriaNome = args.join(' ');

                if (!categoriaNome) {
                    message.reply('⚠️ Uso correto: /saldo [categoria]');
                    return;
                }

                const categoria = await Categoria.findOne({ nome: categoriaNome });
                if (!categoria) {
                    message.reply(`⚠️ Categoria "${categoriaNome}" não encontrada.`);
                    return;
                }

                const gastos = await Gasto.find({ categoria: categoriaNome });
                const totalGasto = gastos.reduce((acc, g) => acc + g.valor, 0);
                const saldo = categoria.limite - totalGasto;

                message.reply(
                    `📊 *${categoria.nome.toUpperCase()}*\n\n` +
                    `💰 Valor total: *R$ ${categoria.limite.toFixed(2)}*\n` +
                    `💸 Total gasto: *R$ ${totalGasto.toFixed(2)}*\n` +
                    `💳 Valor restante: *R$ ${saldo.toFixed(2)}*`
                );
                return;
            }
            break;
    }
});

client.initialize();
