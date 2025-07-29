const mongoose = require('mongoose');

const CategoriaSchema = new mongoose.Schema({
    nome: { type: String, required: true, unique: true },
    limite: { type: Number, required: true }
});

module.exports = mongoose.model('Categoria', CategoriaSchema);
