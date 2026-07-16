// Reescribe rutas de SPA (sin extension de archivo) al index.html correspondiente
// para que recargar la pagina en rutas como /empleados/dashboard no devuelva 403 de S3.
function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Si la URI apunta a un archivo estatico (tiene extension), se sirve tal cual
    if (uri.includes('.')) {
        return request;
    }

    if (uri === '/empleados' || uri.startsWith('/empleados/')) {
        request.uri = '/empleados/index.html';
    } else {
        request.uri = '/index.html';
    }

    return request;
}
