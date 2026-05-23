const fastify = require('fastify')({ logger: false })
const path = require('path')
const Database = require('better-sqlite3')
const axios = require('axios')
require('dotenv').config()

// Токен
const YANDEX_TOKEN = process.env.YANDEX_TOKEN
if (!YANDEX_TOKEN) {
  console.error('Задайте YANDEX_TOKEN в .env файле')
  process.exit(1)
}

// Плагины
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public')
})

fastify.register(require('@fastify/view'), {
  engine: {
    pug: require('pug')
  },
  root: path.join(__dirname, 'views')
})

fastify.register(require('@fastify/formbody'))

// БД
const db = new Database('music.db')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL,
    track_id TEXT NOT NULL,
    track_title TEXT NOT NULL,
    track_artist TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, track_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    track_id TEXT NOT NULL,
    track_title TEXT NOT NULL,
    track_artist TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER NOT NULL,
    track_id TEXT NOT NULL,
    track_title TEXT NOT NULL,
    track_artist TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
  );
`)

// Маршруты
fastify.get('/', async (req, reply) => reply.redirect('/tracks'))

fastify.get('/tracks', async (req, reply) => {
  const userId = req.query.userId
  let user = null
  if (userId) {
    user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId)
  }
  return reply.view('tracks.pug', { user })
})

fastify.get('/favorites', async (req, reply) => {
  const userId = req.query.userId
  let user = null
  if (userId) {
    user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId)
  }
  return reply.view('favorites.pug', { user })
})

fastify.get('/playlists', async (req, reply) => {
  const userId = req.query.userId
  let user = null
  if (userId) {
    user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId)
  }
  return reply.view('playlists.pug', { user })
})

fastify.get('/playlist/:id', async (req, reply) => {
  const userId = req.query.userId
  let user = null
  if (userId) {
    user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId)
  }
  return reply.view('playlist.pug', { user })
})

fastify.get('/login', async (req, reply) => reply.view('login.pug', { user: null }))
fastify.get('/register', async (req, reply) => reply.view('register.pug', { user: null }))

// Авторизация
fastify.post('/api/register', async (req, reply) => {
  const { email, password } = req.body
  if (!email || !password) return reply.status(400).send({ error: 'Email и пароль обязательны' })
  const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (existingUser) return reply.status(400).send({ error: 'Пользователь уже существует' })
  const insert = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)')
  const result = insert.run(email, password)
  reply.send({ success: true, userId: result.lastInsertRowid })
})

fastify.post('/api/login', async (req, reply) => {
  const { email, password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password)
  if (!user) return reply.status(401).send({ error: 'Неверный email или пароль' })
  reply.send({ success: true, userId: user.id })
})

// Избранное
fastify.get('/api/favorites', async (req, reply) => {
  const userId = req.query.userId
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  const favorites = db.prepare('SELECT track_id, track_title, track_artist FROM favorites WHERE user_id = ? ORDER BY added_at DESC').all(userId)
  reply.send({ favorites })
})

fastify.post('/api/favorites', async (req, reply) => {
  const { userId, track_id, track_title, track_artist } = req.body
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  const existing = db.prepare('SELECT * FROM favorites WHERE user_id = ? AND track_id = ?').get(userId, track_id)
  if (existing) return reply.status(400).send({ error: 'Трек уже в избранном' })
  db.prepare('INSERT INTO favorites (user_id, track_id, track_title, track_artist) VALUES (?, ?, ?, ?)').run(userId, track_id, track_title, track_artist)
  reply.send({ success: true })
})

fastify.delete('/api/favorites/:trackId', async (req, reply) => {
  const userId = req.query.userId
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND track_id = ?').run(userId, req.params.trackId)
  reply.send({ success: true })
})

// Мои треки
fastify.get('/api/user-tracks', async (req, reply) => {
  const userId = req.query.userId
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  const tracks = db.prepare('SELECT track_id, track_title, track_artist FROM user_tracks WHERE user_id = ? ORDER BY added_at DESC').all(userId)
  reply.send({ tracks })
})

fastify.post('/api/user-tracks', async (req, reply) => {
  const { userId, track_id, track_title, track_artist } = req.body
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  const existing = db.prepare('SELECT * FROM user_tracks WHERE user_id = ? AND track_id = ?').get(userId, track_id)
  if (existing) return reply.status(400).send({ error: 'Трек уже в коллекции' })
  db.prepare('INSERT INTO user_tracks (user_id, track_id, track_title, track_artist) VALUES (?, ?, ?, ?)').run(userId, track_id, track_title, track_artist)
  reply.send({ success: true })
})

fastify.delete('/api/user-tracks/:trackId', async (req, reply) => {
  const userId = req.query.userId
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  db.prepare('DELETE FROM user_tracks WHERE user_id = ? AND track_id = ?').run(userId, req.params.trackId)
  reply.send({ success: true })
})

// Плейлисты
fastify.get('/api/playlists', async (req, reply) => {
  const userId = req.query.userId
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  const playlists = db.prepare(`
    SELECT p.id, p.name, COUNT(pt.track_id) as track_count
    FROM playlists p
    LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
    WHERE p.user_id = ?
    GROUP BY p.id ORDER BY p.created_at DESC
  `).all(userId)
  reply.send({ playlists })
})

fastify.post('/api/playlists', async (req, reply) => {
  const { userId, name } = req.body
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  if (!name?.trim()) return reply.status(400).send({ error: 'Введите название' })
  const result = db.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)').run(userId, name.trim())
  reply.send({ success: true, playlist: { id: result.lastInsertRowid, name: name.trim() } })
})

fastify.get('/api/playlists/:id', async (req, reply) => {
  const userId = req.query.userId
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, userId)
  if (!playlist) return reply.status(404).send({ error: 'Плейлист не найден' })
  const tracks = db.prepare('SELECT track_id, track_title, track_artist FROM playlist_tracks WHERE playlist_id = ? ORDER BY added_at DESC').all(req.params.id)
  reply.send({ playlist, tracks })
})

fastify.post('/api/playlists/:id/tracks', async (req, reply) => {
  const { userId, track_id, track_title, track_artist } = req.body
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, userId)
  if (!playlist) return reply.status(404).send({ error: 'Плейлист не найден' })
  db.prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, track_title, track_artist) VALUES (?, ?, ?, ?)').run(req.params.id, track_id, track_title, track_artist)
  reply.send({ success: true })
})

fastify.delete('/api/playlists/:id/tracks/:trackId', async (req, reply) => {
  const userId = req.query.userId
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, userId)
  if (!playlist) return reply.status(404).send({ error: 'Плейлист не найден' })
  db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(req.params.id, req.params.trackId)
  reply.send({ success: true })
})

fastify.delete('/api/playlists/:id', async (req, reply) => {
  const userId = req.query.userId
  if (!userId) return reply.status(401).send({ error: 'Не авторизован' })
  db.prepare('DELETE FROM playlists WHERE id = ? AND user_id = ?').run(req.params.id, userId)
  reply.send({ success: true })
})

// Поиск музыки
fastify.get('/api/search', async (req, reply) => {
  const { q } = req.query
  if (!q?.trim()) return reply.send({ tracks: [] })

  try {
    const response = await axios.get('https://api.music.yandex.net/search', {
      headers: { 'Authorization': `OAuth ${YANDEX_TOKEN}` },
      params: { text: q, type: 'track', page: 0 }
    })
    
    const tracks = response.data.result?.tracks?.results || []
    const formatted = tracks.slice(0, 20).map(track => ({
      id: track.id,
      title: track.title,
      artist: track.artists?.[0]?.name || 'Неизвестный исполнитель',
      duration: track.durationMs ? Math.floor(track.durationMs / 1000) : 0
    }))
    reply.send({ tracks: formatted })
  } catch (err) {
    console.error('Ошибка поиска:', err.message)
    if (err.response) {
      console.error('Статус:', err.response.status)
      console.error('Данные:', err.response.data)
    }
    reply.status(500).send({ error: 'Ошибка поиска' })
  }
})

// Запуск
fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log('Сервер: http://localhost:3000')
})