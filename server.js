const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ posts: [] }).write();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('./'));

app.get('/api/posts', (req, res) => {
    try {
        const posts = db.get('posts').value();
        res.json({ posts });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/posts', (req, res) => {
    try {
        const { username, prompt, jsonConfig } = req.body;
        let parsedJson = {};

        if (typeof jsonConfig === 'string' && jsonConfig.trim()) {
            try { parsedJson = JSON.parse(jsonConfig); } catch (e) { parsedJson = { raw: jsonConfig }; }
        } else if (typeof jsonConfig === 'object') {
            parsedJson = jsonConfig;
        }

        const genderPrefix = "handsome man, 1man, male, masculine facial features, short dark hair";
        const cleanPrompt = prompt ? prompt.replace(/\[.*\]/g, '') : 'editorial portrait';
        const finalPrompt = `${genderPrefix}, ${cleanPrompt}`;

        const encodedPrompt = encodeURIComponent(finalPrompt);
        const seed = Math.floor(Math.random() * 100000);
        
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=1000&nologo=true&seed=${seed}&model=flux`;
        const createdAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const newPost = {
            id: Date.now(),
            username: username || 'Anónimo',
            prompt: finalPrompt,
            jsonConfig: parsedJson,
            imageUrl,
            likes: 0,
            createdAt
        };

        db.get('posts').unshift(newPost).write();
        io.emit('new_post', newPost);

        res.status(201).json({ status: 'success', post: newPost });
    } catch (err) {
        console.error('Error al procesar:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/posts/:id/like', (req, res) => {
    try {
        const postId = Number(req.params.id);
        const post = db.get('posts').find({ id: postId }).value();

        if (post) {
            const newLikes = (post.likes || 0) + 1;
            db.get('posts').find({ id: postId }).assign({ likes: newLikes }).write();
            io.emit('update_like', { id: postId, likes: newLikes });
            res.json({ status: 'success', likes: newLikes });
        } else {
            res.status(404).json({ error: 'Post no encontrado' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

server.listen(5000, () => {
    console.log('🚀 Servidor AvatarVerse (Flux Engine) activo en http://localhost:5000');
});
