const mongoose = require('mongoose');

const GastoSchema = new mongoose.Schema({
    categoria: { type: String, required: true },
    valor: { type: Number, required: true },
    data: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Gasto', GastoSchema);
