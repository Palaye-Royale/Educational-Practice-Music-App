SELECT id, email, created_at FROM users WHERE created_at > '2025-01-01';

INSERT INTO users (email, password) VALUES ('test5@mail.ru', '123');

UPDATE users SET password = '456' WHERE email = 'test5@mail.ru';

DELETE FROM users WHERE email = 'test5@mail.ru';

SELECT 
  u.email,
  p.name AS playlist_name,
  COUNT(pt.track_id) AS tracks_count
FROM users u
LEFT JOIN playlists p ON u.id = p.user_id
LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
GROUP BY u.id, p.id;
