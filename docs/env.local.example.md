### Local dev `.env.local` example

Create `ERPTH/.env.local` with:

```bash
VITE_API_BASE_URL=/api
VITE_PROXY_TARGET=http://127.0.0.1:8069
```

If you want to point to a remote backend instead:

```bash
VITE_API_BASE_URL=/api
VITE_PROXY_TARGET=https://qacc.erpth.net
```


