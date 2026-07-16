/**
 * src/domain/kitchen/menu.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Carta oficial de Pardos Chicken — nombres y precios (S/) de la carta impresa.
 * Los precios incluyen IGV (18%) y recargo al consumo (10%).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const MENU_ITEMS = [
  // ── APERITIVOS ──────────────────────────────────────────────────────────────
  { id: 'AP01', category: 'Aperitivos', name: 'Tequeños Brasa (3 unidades)', price: 13.50 },
  { id: 'AP02', category: 'Aperitivos', name: 'Tequeños Brasa (6 unidades)', price: 19.90 },
  { id: 'AP03', category: 'Aperitivos', name: 'Anticucho (1)', price: 12.90 },
  { id: 'AP04', category: 'Aperitivos', name: 'Mini Pollitos Panko (6)', price: 14.50 },
  { id: 'AP05', category: 'Aperitivos', name: 'Piqueo Chorizo Cocktail', price: 16.50 },
  { id: 'AP06', category: 'Aperitivos', name: 'Piqueo Brocheta', price: 16.90 },
  { id: 'AP07', category: 'Aperitivos', name: 'Piqueo Mollejitas', price: 18.50 },
  { id: 'AP08', category: 'Aperitivos', name: 'Piqueo Anticucho', price: 18.50 },
  { id: 'AP09', category: 'Aperitivos', name: 'Chicharrón de Pollo (6)', price: 20.50 },

  // ── ESPECIALES AL PLATO ─────────────────────────────────────────────────────
  { id: 'ES01', category: 'Especiales al Plato', name: 'Carretillero', price: 28.90 },
  { id: 'ES02', category: 'Especiales al Plato', name: 'Mollejitas a la Parrilla', price: 30.50 },
  { id: 'ES03', category: 'Especiales al Plato', name: 'Anticuchos de Corazón', price: 31.50 },
  { id: 'ES04', category: 'Especiales al Plato', name: 'Chicharrón de Pollo', price: 33.90 },

  // ── ESPECIAL DEL MES ────────────────────────────────────────────────────────
  { id: 'EM01', category: 'Especial del Mes', name: 'Sánguche Brioche Brasa', price: 18.90 },
  { id: 'EM02', category: 'Especial del Mes', name: 'Sánguche Brioche Brasa con Papas Fritas', price: 23.90 },

  // ── ENSALADAS PARA COMPARTIR ────────────────────────────────────────────────
  { id: 'EC01', category: 'Ensaladas para Compartir', name: 'Ensalada Cocida (Regular)', price: 18.90 },
  { id: 'EC02', category: 'Ensaladas para Compartir', name: 'Ensalada Cocida (Grande)', price: 22.90 },
  { id: 'EC03', category: 'Ensaladas para Compartir', name: 'Ensalada Fresca (Regular)', price: 18.90 },
  { id: 'EC04', category: 'Ensaladas para Compartir', name: 'Ensalada Fresca (Grande)', price: 22.90 },

  // ── ENSALADAS DE FONDO ──────────────────────────────────────────────────────
  { id: 'EF01', category: 'Ensaladas de Fondo', name: 'Ensalada Delicia (Mediana con filete de pollo o mini pollitos panko)', price: 23.90 },
  { id: 'EF02', category: 'Ensaladas de Fondo', name: 'Ensalada Delicia (Grande solo ensalada)', price: 24.90 },
  { id: 'EF03', category: 'Ensaladas de Fondo', name: "Ensalada Cesar's (Mediana con filete de pollo o mini pollitos panko)", price: 24.90 },
  { id: 'EF04', category: 'Ensaladas de Fondo', name: "Ensalada Cesar's (Grande solo ensalada)", price: 25.90 },
  { id: 'EF05', category: 'Ensaladas de Fondo', name: 'Ensalada Sensación (Mediana con filete de pollo o mini pollitos panko)', price: 24.90 },
  { id: 'EF06', category: 'Ensaladas de Fondo', name: 'Ensalada Sensación (Grande solo ensalada)', price: 25.90 },
  { id: 'EF07', category: 'Ensaladas de Fondo', name: 'Ensalada Honey (Mediana con filete de pollo o mini pollitos panko)', price: 24.90 },
  { id: 'EF08', category: 'Ensaladas de Fondo', name: 'Ensalada Honey (Grande solo ensalada)', price: 25.90 },
  { id: 'EF09', category: 'Ensaladas de Fondo', name: 'Agrégale filete de pollo o mini pollitos panko a tu ensalada', price: 9.90 },

  // ── PARDOS BRASA ────────────────────────────────────────────────────────────
  { id: 'PB01', category: 'Pardos Brasa', name: '1/4 Pardos Brasa (Original)', price: 29.50 },
  { id: 'PB02', category: 'Pardos Brasa', name: '1/4 Pardos Brasa (Sabores Premium: a lo Bravo, Arrocero o Encamotado)', price: 34.50 },
  { id: 'PB03', category: 'Pardos Brasa', name: '1/2 Pardos Brasa (Original)', price: 47.50 },
  { id: 'PB04', category: 'Pardos Brasa', name: '1/2 Pardos Brasa (Sabores Premium: a lo Bravo, Arrocero o Encamotado)', price: 49.90 },

  // ── PARDOS PARRILLERO ───────────────────────────────────────────────────────
  { id: 'PP01', category: 'Pardos Parrillero', name: '1/4 Pardos Parrillero (Original)', price: 32.50 },
  { id: 'PP02', category: 'Pardos Parrillero', name: '1/4 Pardos Parrillero (BBQ/Hot)', price: 33.50 },
  { id: 'PP03', category: 'Pardos Parrillero', name: '1/4 Pardos Parrillero Sabores Premium (Original)', price: 35.90 },
  { id: 'PP04', category: 'Pardos Parrillero', name: '1/4 Pardos Parrillero Sabores Premium (BBQ/Hot)', price: 36.90 },
  { id: 'PP05', category: 'Pardos Parrillero', name: '1/2 Pardos Parrillero (Original)', price: 48.50 },
  { id: 'PP06', category: 'Pardos Parrillero', name: '1/2 Pardos Parrillero (BBQ/Hot)', price: 49.50 },
  { id: 'PP07', category: 'Pardos Parrillero', name: '1/2 Pardos Parrillero Sabores Premium (Original)', price: 50.90 },
  { id: 'PP08', category: 'Pardos Parrillero', name: '1/2 Pardos Parrillero Sabores Premium (BBQ/Hot)', price: 51.90 },

  // ── PARA LOS CARNÍVOROS ─────────────────────────────────────────────────────
  { id: 'CA01', category: 'Para los Carnívoros', name: 'Lomo a la Parrilla', price: 57.90 },
  { id: 'CA02', category: 'Para los Carnívoros', name: 'Bife a la Parrilla (trozado o entero)', price: 55.90 },

  // ── MENÚ KIDS ───────────────────────────────────────────────────────────────
  { id: 'MK01', category: 'Menú Kids', name: 'Menú Kids (1/8 Pardos Brasa, Chicharrón de Pollo (3) o Mini Pollitos Panko (4))', price: 21.90 },
  { id: 'MK02', category: 'Menú Kids', name: 'Agrega 1 bola de helado a tu menú kids', price: 4.90 },

  // ── PARRILLAS ───────────────────────────────────────────────────────────────
  { id: 'PR01', category: 'Parrillas', name: 'Parrilla Familiar Premium (máx. 6)', price: 174.00 },
  { id: 'PR02', category: 'Parrillas', name: 'Parrilla Sabor para 4 (máx. 5)', price: 132.00 },
  { id: 'PR03', category: 'Parrillas', name: 'Parrilla para 2 (máx. 3)', price: 95.90 },
  { id: 'PR04', category: 'Parrillas', name: 'Añade a tu parrilla ensalada regular Cocida o Fresca', price: 18.90 },

  // ── PARDOS BRASA FAMILIAR ───────────────────────────────────────────────────
  { id: 'PF01', category: 'Pardos Brasa Familiar', name: 'Pardos Brasa Familiar con papas fritas o ensalada Pardos grande', price: 71.50 },
  { id: 'PF02', category: 'Pardos Brasa Familiar', name: 'Pardos Brasa Familiar con papas fritas y ensalada Pardos regular', price: 84.90 },
  { id: 'PF03', category: 'Pardos Brasa Familiar', name: 'Pardos Brasa Familiar con papas fritas y ensalada Pardos grande', price: 86.40 },

  // ── GUARNICIONES ────────────────────────────────────────────────────────────
  { id: 'GU01', category: 'Guarniciones', name: 'Papas Fritas (1/2 porción)', price: 9.90 },
  { id: 'GU02', category: 'Guarniciones', name: 'Papas Fritas (porción)', price: 15.50 },
  { id: 'GU03', category: 'Guarniciones', name: 'Papas Doradas (porción)', price: 15.50 },
  { id: 'GU04', category: 'Guarniciones', name: 'Rejillas de Camote', price: 16.50 },
  { id: 'GU05', category: 'Guarniciones', name: 'Arroz de la Casa', price: 7.50 },
  { id: 'GU06', category: 'Guarniciones', name: 'Choclo', price: 9.90 },
  { id: 'GU07', category: 'Guarniciones', name: 'Palta', price: 9.90 },
  { id: 'GU08', category: 'Guarniciones', name: 'Huevo', price: 3.90 },
  { id: 'GU09', category: 'Guarniciones', name: 'Plátano', price: 3.90 },
  { id: 'GU10', category: 'Guarniciones', name: 'A lo Pobre (huevo y plátano)', price: 6.90 },

  // ── ADICIONA MÁS SABOR ──────────────────────────────────────────────────────
  { id: 'AD01', category: 'Adiciones', name: '1 Tequeño Brasa', price: 4.90 },
  { id: 'AD02', category: 'Adiciones', name: 'Anticucho (adición)', price: 12.90 },

  // ── POSTRES ─────────────────────────────────────────────────────────────────
  { id: 'PO01', category: 'Postres', name: 'Triple Dulzura (Vaso)', price: 9.90 },
  { id: 'PO02', category: 'Postres', name: 'Triple Dulzura (Copón)', price: 15.90 },
  { id: 'PO03', category: 'Postres', name: 'Mazamorra Pardos', price: 9.90 },
  { id: 'PO04', category: 'Postres', name: 'Pecado Tropical', price: 15.90 },
  { id: 'PO05', category: 'Postres', name: '1 Bola de Helado', price: 7.90 },
  { id: 'PO06', category: 'Postres', name: '2 Bolas de Helado', price: 13.90 },
  { id: 'PO07', category: 'Postres', name: 'Torta de Chocolate', price: 16.90 },
  { id: 'PO08', category: 'Postres', name: 'Cheesecake de Fresa', price: 16.90 },

  // ── BEBIDAS ─────────────────────────────────────────────────────────────────
  { id: 'BE01', category: 'Bebidas', name: 'Chicha Pardos (Vaso)', price: 6.90 },
  { id: 'BE02', category: 'Bebidas', name: 'Chicha Pardos (Vaso XL)', price: 9.90 },
  { id: 'BE03', category: 'Bebidas', name: 'Chicha Pardos (Frozen)', price: 12.50 },
  { id: 'BE04', category: 'Bebidas', name: 'Chicha Pardos (Jarra)', price: 21.90 },
  { id: 'BE05', category: 'Bebidas', name: 'Limonada (Vaso)', price: 7.90 },
  { id: 'BE06', category: 'Bebidas', name: 'Limonada (Vaso XL)', price: 10.50 },
  { id: 'BE07', category: 'Bebidas', name: 'Limonada (Frozen)', price: 13.50 },
  { id: 'BE08', category: 'Bebidas', name: 'Limonada (Jarra)', price: 22.90 },
  { id: 'BE09', category: 'Bebidas', name: 'Maracumango (Vaso)', price: 11.90 },
  { id: 'BE10', category: 'Bebidas', name: 'Maracumango (Vaso XL)', price: 14.90 },
  { id: 'BE11', category: 'Bebidas', name: 'Coca Cola / Inca Kola 500ml (regular/sin azúcar)', price: 7.00 },
  { id: 'BE12', category: 'Bebidas', name: 'Botella de agua San Luis en vidrio (con/sin gas)', price: 6.50 },

  // ── CÓCTELES · HAPPY DAY 2X26.90 ────────────────────────────────────────────
  { id: 'CO01', category: 'Cócteles', name: 'Chilcano Clásico', price: 18.90 },
  { id: 'CO02', category: 'Cócteles', name: 'Chilcano Maracumango', price: 19.90 },
  { id: 'CO03', category: 'Cócteles', name: 'Chilcano Fresa', price: 19.90 },
  { id: 'CO04', category: 'Cócteles', name: 'Pisco Sour Clásico', price: 18.90 },
  { id: 'CO05', category: 'Cócteles', name: 'Pisco Sour Maracuyá', price: 19.90 },
  { id: 'CO06', category: 'Cócteles', name: 'Copa de Sangría', price: 14.90 },
  { id: 'CO07', category: 'Cócteles', name: 'Algarrobina', price: 19.90 },
  { id: 'CO08', category: 'Cócteles', name: 'Machu Picchu', price: 19.90 },
  { id: 'CO09', category: 'Cócteles', name: 'Piña Colada', price: 20.90 },
  { id: 'CO10', category: 'Cócteles', name: 'Ice Chilcano de Maracumango', price: 23.90 },
  { id: 'CO11', category: 'Cócteles', name: 'Ice Chilcano de Fresa', price: 23.90 },
  { id: 'CO12', category: 'Cócteles', name: 'Ice Piña Colada', price: 24.90 },
  { id: 'CO13', category: 'Cócteles', name: 'Sangría Pardos (Copa)', price: 14.90 },
  { id: 'CO14', category: 'Cócteles', name: 'Sangría Pardos (Botella)', price: 35.90 },

  // ── CÓCTELES PREMIUM ────────────────────────────────────────────────────────
  { id: 'CP01', category: 'Cócteles Premium', name: 'Margarita Beer', price: 30.90 },
  { id: 'CP02', category: 'Cócteles Premium', name: 'Margarita Blue', price: 32.90 },

  // ── CERVEZAS Y VINOS ────────────────────────────────────────────────────────
  { id: 'CV01', category: 'Cervezas y Vinos', name: 'Cerveza Pilsen', price: 12.00 },
  { id: 'CV02', category: 'Cervezas y Vinos', name: 'Cerveza Cusqueña', price: 12.50 },
  { id: 'CV03', category: 'Cervezas y Vinos', name: 'Vino IntiPalka Syrah o Malbec', price: 70.90 },
  { id: 'CV04', category: 'Cervezas y Vinos', name: 'Vino Casillero del Diablo (Tinto/Blanco)', price: 95.00 },
  { id: 'CV05', category: 'Cervezas y Vinos', name: 'Descorche por botella', price: 20.00 },

  // ── INFUSIONES ──────────────────────────────────────────────────────────────
  { id: 'IN01', category: 'Infusiones', name: 'Anís, Manzanilla, Hierba Luisa o Té', price: 6.90 },
]

export const MENU_CATEGORIES = [...new Set(MENU_ITEMS.map(m => m.category))]
