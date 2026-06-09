require('dotenv').config();
const express = require('express');
const path = require('path');
const { getDb } = require('./db');
const { OpenAI } = require('openai');

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function chatgptresponse(question, answer) {
    const modelo = [
        { "categoria": "TI e Equipamentos", "indicador": "Funcionamento dos cabos ethernet", "nota_0_a_5": 1, "descricao": "Muitos cabos inoperantes nas salas." },
        { "categoria": "TI e Equipamentos", "indicador": "Velocidade da internet (Wi-Fi/Cabo)", "nota_0_a_5": 1, "descricao": "Conexão lenta em ambos os meios." },
        { "categoria": "TI e Equipamentos", "indicador": "Desempenho dos computadores", "nota_0_a_5": 1, "descricao": "Máquinas disponibilizadas são lentas." },
        { "categoria": "TI e Equipamentos", "indicador": "Disponibilidade de computadores", "nota_0_a_5": 1, "descricao": "Quantidade insuficiente para os alunos." },
        { "categoria": "Infraestrutura (Banheiros)", "indicador": "Integridade das descargas", "nota_0_a_5": 0, "descricao": "Botões de plástico ausentes." },
        { "categoria": "Infraestrutura (Banheiros)", "indicador": "Integridade dos assentos sanitários", "nota_0_a_5": 0, "descricao": "Assentos quebrados." },
        { "categoria": "Infraestrutura (Banheiros)", "indicador": "Qualidade dos insumos de higiene", "nota_0_a_5": 1, "descricao": "Sabão líquido aguado, ineficaz." },
        { "categoria": "Infraestrutura (Banheiros)", "indicador": "Condições do piso e vazamentos", "nota_0_a_5": 0, "descricao": "Água escorrendo no chão das cabines." }
    ];

    const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: `Formate a entrada como um objeto JSON seguindo este modelo sempre: ${JSON.stringify(modelo)}. Retorne apenas o JSON, sem markdown.`
            },
            {
                role: 'user',
                content: `Pergunta: ${question}\nResposta: ${answer}`
            }
        ]
    });

    return response.choices[0].message.content;
}

const app = express();
const PORT = process.env.PORT || 3000;
const COLLECTION = 'respostas';

// Serve dashboard frontend
app.use(express.static(path.join(__dirname, 'public')));

app.get('/respostas', async (req, res) => {
    const db = await getDb();
    const docs = await db.collection(COLLECTION).find({}).toArray();
    
    await Promise.all(docs.map(async (doc) => {
        try {
            const rawText = await chatgptresponse(doc.question || doc.pergunta, doc.answer || doc.resposta);
            doc.metricas = JSON.parse(rawText);
            console.log(`Documento processado: ${doc._id}`);
        } catch (e) {
            console.error(`Erro ao gerar/parsear JSON para ${doc._id}:`, e);
            doc.metricas = null;
        }
    }));

    res.json({ total: docs.length, dados: docs });
});

// Aggregate: compute averages only from documents with formatted metricas
app.get('/metricas', async (req, res) => {
    const db = await getDb();
    const col = db.collection(COLLECTION);

    // Total document count (all responses, formatted or not)
    const totalDocs = await col.countDocuments();

    // Aggregate: unwind metricas, filter only entries with a numeric nota_0_a_5,
    // group by categoria to get avg and count, then compute a global average.
    const pipeline = [
        { $match: { metricas: { $exists: true, $ne: [] } } },
        { $unwind: '$metricas' },
        { $match: { 'metricas.nota_0_a_5': { $exists: true, $type: 'number' } } },
        {
            $group: {
                _id: '$metricas.categoria',
                avgNota: { $avg: '$metricas.nota_0_a_5' },
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1 } },
    ];

    const categorias = await col.aggregate(pipeline).toArray();

    // Global average across all formatted metrics
    const globalPipeline = [
        { $match: { metricas: { $exists: true, $ne: [] } } },
        { $unwind: '$metricas' },
        { $match: { 'metricas.nota_0_a_5': { $exists: true, $type: 'number' } } },
        {
            $group: {
                _id: null,
                avgNota: { $avg: '$metricas.nota_0_a_5' },
                totalMetricas: { $sum: 1 },
            },
        },
    ];

    const globalResult = await col.aggregate(globalPipeline).toArray();
    const global = globalResult[0] || { avgNota: 0, totalMetricas: 0 };

    // Equipamentos aggregate (categories matching equipment keywords)
    const equipKeywords = /equipamento|recurso.?tecnol|internet|wi-?fi|cabeada|computador|laborat|ti e equip/i;
    const equipCats = categorias.filter(c => c._id && equipKeywords.test(c._id));
    let equipAvg = null;
    if (equipCats.length > 0) {
        const totalEquipCount = equipCats.reduce((s, c) => s + c.count, 0);
        const weightedSum = equipCats.reduce((s, c) => s + c.avgNota * c.count, 0);
        equipAvg = weightedSum / totalEquipCount;
    }

    // Count formatted vs total docs
    const formattedDocs = await col.countDocuments({ metricas: { $exists: true, $ne: [] } });

    res.json({
        total: totalDocs,
        formattedCount: formattedDocs,
        globalAvg: global.avgNota,
        globalMetricasCount: global.totalMetricas,
        equipAvg,
        categorias: categorias.map(c => ({
            name: c._id || 'Sem categoria',
            avgNota: c.avgNota,
            count: c.count,
        })),
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});