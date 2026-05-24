// Общее
function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]))
}

function getUserId() {
  const id = localStorage.getItem('userId')
  if (!id && !['/login', '/register'].includes(window.location.pathname)) {
    window.location.href = '/login'
  }
  return id
}

// Обновляет все ссылки навигации, добавляя userId
function updateNavLinks() {
  const userId = getUserId()
  if (!userId) return
  
  const links = document.querySelectorAll('.nav-link')
  links.forEach(link => {
    const href = link.getAttribute('href')
    if (href && !href.includes('userId')) {
      link.setAttribute('href', `${href}?userId=${userId}`)
    }
  })
  
  // Обновляет все ссылки входа/регистрации, добавляя userId
  const authLinks = document.querySelectorAll('.auth-btn')
  authLinks.forEach(link => {
    const href = link.getAttribute('href')
    if (href && (href.includes('/login') || href.includes('/register'))) {
      return
    }
    if (href && !href.includes('userId')) {
      link.setAttribute('href', `${href}?userId=${userId}`)
    }
  })
}

// Вход
if (window.location.pathname === '/login') {
  const loginForm = document.getElementById('loginForm')
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault()
      const email = document.querySelector('#loginForm input[name="email"]').value
      const password = document.querySelector('#loginForm input[name="password"]').value
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('userId', data.userId)
        window.location.href = `/tracks?userId=${data.userId}`
      } else {
        alert(data.error)
      }
    }
  }
}

// Регистрация
if (window.location.pathname === '/register') {
  const registerForm = document.getElementById('registerForm')
  if (registerForm) {
    registerForm.onsubmit = async (e) => {
      e.preventDefault()
      const email = document.querySelector('#registerForm input[name="email"]').value
      const password = document.querySelector('#registerForm input[name="password"]').value
      const confirm = document.querySelector('#registerForm input[name="confirmPassword"]').value

      if (password !== confirm) {
        alert('Пароли не совпадают')
        return
      }

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()
      if (data.success) {
        alert('Вы зарегистрированы. Теперь войдите')
        window.location.href = '/login'
      } else {
        alert(data.error)
      }
    }
  }
}

// Поиск
const searchInput = document.getElementById('searchInput')
const searchBtn = document.getElementById('searchBtn')
const searchResults = document.getElementById('searchResults')

function displayTracks(tracks) {
  if (!searchResults) return
  if (!tracks?.length) {
    searchResults.innerHTML = '<p>Ничего не найдено</p>'
    return
  }
  searchResults.innerHTML = tracks.map(track => `
    <div class="track-item">
      <div class="track-cover-placeholder"></div>
      <div class="track-info">
        <div class="track-title">${escapeHtml(track.title)}</div>
        <div class="track-artist">${escapeHtml(track.artist)}</div>
      </div>
      <div class="track-actions">
        <button class="play-btn" data-id="${track.id}" data-title="${escapeHtml(track.title)}" data-artist="${escapeHtml(track.artist)}">▶</button>
        <button class="fav-btn" data-id="${track.id}" data-title="${escapeHtml(track.title)}" data-artist="${escapeHtml(track.artist)}">♥</button>
        <button class="save-btn" data-id="${track.id}" data-title="${escapeHtml(track.title)}" data-artist="${escapeHtml(track.artist)}">+</button>
        <button class="playlist-btn" data-id="${track.id}" data-title="${escapeHtml(track.title)}" data-artist="${escapeHtml(track.artist)}">🗁</button>
      </div>
    </div>
  `).join('')
}

async function handleAction(url, data, successMsg, btn) {
  const userId = getUserId()
  if (!userId) return
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...data })
    })
    if (res.ok) {
      alert(successMsg)
      btn.textContent = '×'
      btn.classList.add('btn-delete')
    } else {
      const err = await res.json()
      alert(err.error || 'Ошибка')
    }
  } catch (err) {
    console.error(err)
    alert('Ошибка')
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.fav-btn')
  if (btn) {
    e.preventDefault()
    handleAction('/api/favorites', {
      track_id: btn.dataset.id,
      track_title: btn.dataset.title,
      track_artist: btn.dataset.artist
    }, 'Добавлено в Избранное', btn)
  }
})

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.save-btn')
  if (btn) {
    e.preventDefault()
    handleAction('/api/user-tracks', {
      track_id: btn.dataset.id,
      track_title: btn.dataset.title,
      track_artist: btn.dataset.artist
    }, 'Добавлено в Мои треки', btn)
  }
})

// Заглушка, чтобы когда-нибудь настроить плеер
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.play-btn')
  if (btn) {
    e.preventDefault()
  }
})

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.playlist-btn')
  if (btn) {
    e.preventDefault()
    const trackId = btn.dataset.id
    const trackTitle = btn.dataset.title
    const trackArtist = btn.dataset.artist
    addToPlaylist(trackId, trackTitle, trackArtist)
  }
})

if (searchBtn && searchInput) {
  searchBtn.onclick = async () => {
    const query = searchInput.value.trim()
    if (!query) return alert('Введите название трека')
    searchResults.innerHTML = '<p>Поиск...</p>'
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      displayTracks(data.tracks || [])
    } catch (err) {
      searchResults.innerHTML = '<p>Ошибка поиска</p>'
    }
  }
}

// Избранное
async function loadFavorites() {
  const userId = getUserId()
  if (!userId || window.location.pathname !== '/favorites') return
  
  const res = await fetch(`/api/favorites?userId=${userId}`)
  const data = await res.json()
  const container = document.getElementById('favoritesList')
  
  if (!container) return
  
  if (data.favorites?.length) {
    container.innerHTML = data.favorites.map(fav => `
      <div class="track-item" data-id="${fav.track_id}">
        <div class="track-cover-placeholder"></div>
        <div class="track-info">
          <div class="track-title">${escapeHtml(fav.track_title)}</div>
          <div class="track-artist">${escapeHtml(fav.track_artist)}</div>
        </div>
        <div class="track-actions">
          <button class="remove-fav-btn" data-id="${fav.track_id}">×</button>
        </div>
      </div>
    `).join('')
    
    document.querySelectorAll('.remove-fav-btn').forEach(btn => {
      btn.onclick = async () => {
        const trackId = btn.dataset.id
        const delRes = await fetch(`/api/favorites/${trackId}?userId=${userId}`, { method: 'DELETE' })
        if (delRes.ok) {
          alert('Удалено из Избранного')
          loadFavorites()
        } else {
          alert('Ошибка удаления')
        }
      }
    })
  } else {
    container.innerHTML = '<p>Нет избранных треков</p>'
  }
}

// Мои треки
async function loadMyTracks() {
  const userId = getUserId()
  if (!userId || window.location.pathname !== '/tracks') return
  
  const res = await fetch(`/api/user-tracks?userId=${userId}`)
  const data = await res.json()
  const container = document.getElementById('myTracksList')
  
  if (!container) return
  
  if (data.tracks?.length) {
    container.innerHTML = data.tracks.map(track => `
      <div class="track-item" data-id="${track.track_id}">
        <div class="track-cover-placeholder"></div>
        <div class="track-info">
          <div class="track-title">${escapeHtml(track.track_title)}</div>
          <div class="track-artist">${escapeHtml(track.track_artist)}</div>
        </div>
        <div class="track-actions">
          <button class="remove-track-btn" data-id="${track.track_id}">×</button>
        </div>
      </div>
    `).join('')
    
    document.querySelectorAll('.remove-track-btn').forEach(btn => {
      btn.onclick = async () => {
        const trackId = btn.dataset.id
        const delRes = await fetch(`/api/user-tracks/${trackId}?userId=${userId}`, { method: 'DELETE' })
        if (delRes.ok) {
          alert('Удалено из Моих треков')
          loadMyTracks()
        } else {
          alert('Ошибка удаления')
        }
      }
    })
  } else {
    container.innerHTML = '<p>Нет сохранённых треков</p>'
  }
}

// Создание плейлиста
const createBtn = document.getElementById('createPlaylistBtn')
if (createBtn) {
  createBtn.onclick = async () => {
    const name = prompt('Введите название плейлиста:')
    if (!name?.trim()) return
    
    const userId = getUserId()
    if (!userId) return
    
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name: name.trim() })
    })
    
    if (res.ok) {
      alert('Плейлист создан')
      location.reload()
    } else {
      const err = await res.json()
      alert(err.error || 'Ошибка создания')
    }
  }
}

// Добавление трека в плейлист
async function addToPlaylist(trackId, trackTitle, trackArtist) {
  const userId = getUserId()
  if (!userId) return
  
  const res = await fetch(`/api/playlists?userId=${userId}`)
  const data = await res.json()
  
  if (!data.playlists?.length) {
    const create = confirm('У вас нет плейлистов')
    if (create) {
      const name = prompt('Введите название плейлиста:')
      if (!name?.trim()) return
      
      const createRes = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: name.trim() })
      })
      
      if (createRes.ok) {
        alert('Плейлист создан. Теперь добавьте трек заново')
        return
      } else {
        alert('Ошибка создания плейлиста')
        return
      }
    }
    return
  }
  
  const playlistOptions = data.playlists.map(p => `${p.id}: ${p.name}`).join('\n')
  const selectedId = prompt(`Выберите номер плейлиста:\n${playlistOptions}`)
  
  if (!selectedId) return
  
  const selectedPlaylist = data.playlists.find(p => p.id == selectedId)
  if (!selectedPlaylist) {
    alert('Неверный номер плейлиста')
    return
  }
  
  const addRes = await fetch(`/api/playlists/${selectedPlaylist.id}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      track_id: trackId,
      track_title: trackTitle,
      track_artist: trackArtist
    })
  })
  
  if (addRes.ok) {
    alert(`Трек добавлен в "${selectedPlaylist.name}"`)
  } else {
    const err = await addRes.json()
    alert(err.error || 'Ошибка добавления')
  }
}

// Загрузка плейлиста
async function loadPlaylistTracks() {
  const match = window.location.pathname.match(/\/playlist\/(\d+)/)
  if (!match) return
  
  const playlistId = match[1]
  const userId = getUserId()
  if (!userId) return
  
  const res = await fetch(`/api/playlists/${playlistId}?userId=${userId}`)
  const data = await res.json()
  
  const titleEl = document.getElementById('playlistName')
  const container = document.getElementById('playlistTracks')
  
  if (titleEl && data.playlist) {
    titleEl.textContent = `${escapeHtml(data.playlist.name)}`
  }
  
  if (!container) return
  
  if (data.tracks?.length) {
    container.innerHTML = data.tracks.map(track => `
      <div class="track-item" data-id="${track.track_id}">
        <div class="track-cover-placeholder"></div>
        <div class="track-info">
          <div class="track-title">${escapeHtml(track.track_title)}</div>
          <div class="track-artist">${escapeHtml(track.track_artist)}</div>
        </div>
        <div class="track-actions">
          <button class="remove-from-playlist-btn" data-playlist-id="${playlistId}" data-track-id="${track.track_id}">×</button>
        </div>
      </div>
    `).join('')
    
    document.querySelectorAll('.remove-from-playlist-btn').forEach(btn => {
      btn.onclick = async () => {
        const pid = btn.dataset.playlistId
        const tid = btn.dataset.trackId
        const delRes = await fetch(`/api/playlists/${pid}/tracks/${tid}?userId=${userId}`, { method: 'DELETE' })
        if (delRes.ok) {
          alert('Трек удалён из плейлиста')
          loadPlaylistTracks()
        } else {
          alert('Ошибка удаления')
        }
      }
    })
  } else {
    container.innerHTML = '<p>В этом плейлисте нет треков</p>'
  }
}

// Загрузка плейлистов
async function loadPlaylists() {
  const userId = getUserId()
  if (!userId || window.location.pathname !== '/playlists') return
  
  const res = await fetch(`/api/playlists?userId=${userId}`)
  const data = await res.json()
  const container = document.getElementById('playlistsGrid')
  
  if (!container) return
  
  if (data.playlists?.length) {
    container.innerHTML = data.playlists.map(p => `
      <div class="playlist-card" data-id="${p.id}">
        <div class="playlist-cover-placeholder"></div>
        <div class="playlist-info">
          <div class="playlist-name">${escapeHtml(p.name)}</div>
          <div class="playlist-count">${p.track_count} треков</div>
        </div>
        <a href="/playlist/${p.id}" class="playlist-link">Открыть →</a>
        <button class="delete-playlist-btn" data-id="${p.id}">×</button>
      </div>
    `).join('')
    
    document.querySelectorAll('.delete-playlist-btn').forEach(btn => {
      btn.onclick = async () => {
        const playlistId = btn.dataset.id
        if (confirm('Удалить этот плейлист?')) {
          const delRes = await fetch(`/api/playlists/${playlistId}?userId=${userId}`, { method: 'DELETE' })
          if (delRes.ok) {
            alert('Плейлист удалён')
            loadPlaylists()
          } else {
            alert('Ошибка удаления')
          }
        }
      }
    })
  } else {
    container.innerHTML = '<p>Нет плейлистов</p>'
  }
}

const logoutBtn = document.getElementById('logoutBtn')
if (logoutBtn) {
  logoutBtn.onclick = () => {
    localStorage.removeItem('userId')
    window.location.href = '/login'
  }
}

loadFavorites()
loadMyTracks()
loadPlaylists()
loadPlaylistTracks()
updateNavLinks()