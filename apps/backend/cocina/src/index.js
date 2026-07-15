import app from './server.js'

const PORT = process.env.PORT || 8080

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍗 svc-cocina escuchando en http://0.0.0.0:${PORT}`)
})
