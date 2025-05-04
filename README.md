```
CREATE TABLE bookmarks (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  text TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  ip_address INET NOT NULL
);

```
